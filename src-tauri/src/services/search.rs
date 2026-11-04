use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use globset::{Glob, GlobSet, GlobSetBuilder};
use ignore::WalkBuilder;
use regex::Regex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::error::AppError;
use crate::services::{encoding, eol};

pub const SEARCH_PROGRESS_EVENT: &str = "search://progress";
/// Files larger than this are skipped by "find in files".
const SEARCH_MAX_FILE_BYTES: u64 = 5 * 1024 * 1024;
const PREVIEW_MAX_CHARS: usize = 240;
const FLUSH_EVERY_FILES: usize = 20;
const FLUSH_EVERY_MS: u128 = 250;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchOptions {
    pub root: String,
    pub query: String,
    #[serde(default)]
    pub regex: bool,
    #[serde(default)]
    pub case_sensitive: bool,
    #[serde(default)]
    pub whole_word: bool,
    #[serde(default)]
    pub include: Option<String>,
    #[serde(default)]
    pub exclude: Option<String>,
    #[serde(default = "default_max_results")]
    pub max_results: usize,
    #[serde(default = "default_max_per_file")]
    pub max_per_file: usize,
}

fn default_max_results() -> usize {
    5000
}

fn default_max_per_file() -> usize {
    200
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    pub line: usize,
    pub column: usize,
    pub length: usize,
    pub preview: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSearchResult {
    pub path: String,
    pub matches: Vec<SearchMatch>,
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchProgress {
    pub search_id: u64,
    pub scanned_files: usize,
    pub matched_files: usize,
    pub done: bool,
    pub cancelled: bool,
    pub results: Vec<FileSearchResult>,
}

/// Tracks running searches so the renderer can cancel them.
#[derive(Default)]
pub struct SearchRegistry {
    next_id: AtomicU64,
    cancel: Mutex<HashMap<u64, Arc<AtomicBool>>>,
}

impl SearchRegistry {
    fn register(&self) -> (u64, Arc<AtomicBool>) {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst) + 1;
        let flag = Arc::new(AtomicBool::new(false));
        if let Ok(mut map) = self.cancel.lock() {
            map.insert(id, flag.clone());
        }
        (id, flag)
    }

    fn finish(&self, id: u64) {
        if let Ok(mut map) = self.cancel.lock() {
            map.remove(&id);
        }
    }

    pub fn request_cancel(&self, id: u64) -> bool {
        if let Ok(map) = self.cancel.lock() {
            if let Some(flag) = map.get(&id) {
                flag.store(true, Ordering::SeqCst);
                return true;
            }
        }
        false
    }
}

fn build_matcher(opts: &SearchOptions) -> Result<Regex, AppError> {
    if opts.query.is_empty() {
        return Err(AppError::Invalid("search query is empty".into()));
    }
    let mut pattern = if opts.regex {
        opts.query.clone()
    } else {
        regex::escape(&opts.query)
    };
    if opts.whole_word {
        pattern = format!(r"\b(?:{pattern})\b");
    }
    if !opts.case_sensitive {
        pattern = format!("(?i){pattern}");
    }
    Regex::new(&pattern).map_err(|err| AppError::Invalid(err.to_string()))
}

/// Splits a `a;b|c` spec into trimmed, non-empty patterns.
fn split_patterns(spec: Option<&str>) -> Vec<&str> {
    match spec {
        Some(raw) => raw
            .split([';', ',', '|'])
            .map(str::trim)
            .filter(|part| !part.is_empty())
            .collect(),
        None => Vec::new(),
    }
}

/// A pattern without any wildcard or separator, e.g. `node_modules`, names a
/// directory. Those are skipped while walking instead of being glob-matched,
/// which keeps large trees from being traversed at all.
fn bare_dir_names(spec: Option<&str>) -> Vec<String> {
    split_patterns(spec)
        .into_iter()
        .filter(|part| !part.contains(['*', '?', '[', '/', '\\']))
        .map(str::to_ascii_lowercase)
        .collect()
}

fn build_glob_set(spec: Option<&str>) -> Result<Option<GlobSet>, AppError> {
    let patterns = split_patterns(spec);
    if patterns.is_empty() {
        return Ok(None);
    }
    let mut builder = GlobSetBuilder::new();
    for pattern in patterns {
        builder.add(Glob::new(pattern).map_err(|err| AppError::Invalid(err.to_string()))?);
        // `node_modules` alone would never match `node_modules/a/b.js`, so a
        // bare name is expanded into the directory forms users expect.
        if !pattern.contains(['*', '?', '[', '/', '\\']) {
            for expanded in [format!("{pattern}/**"), format!("**/{pattern}/**")] {
                builder
                    .add(Glob::new(&expanded).map_err(|err| AppError::Invalid(err.to_string()))?);
            }
        }
    }
    let set = builder
        .build()
        .map_err(|err| AppError::Invalid(err.to_string()))?;
    Ok(Some(set))
}

fn matches_set(set: &GlobSet, relative: &Path, file_name: &str) -> bool {
    set.is_match(relative) || set.is_match(file_name)
}

/// Test helper: matches a path against an optional glob set.
#[cfg(test)]
fn matches_any(set: &Option<GlobSet>, relative: &Path, file_name: &str) -> bool {
    match set {
        Some(set) => matches_set(set, relative, file_name),
        None => false,
    }
}

fn is_probably_binary(bytes: &[u8]) -> bool {
    let sample = &bytes[..bytes.len().min(8192)];
    sample.contains(&0u8)
}

fn preview_of(line: &str) -> String {
    line.trim_end()
        .chars()
        .take(PREVIEW_MAX_CHARS)
        .collect::<String>()
}

fn scan_file(path: &Path, matcher: &Regex, max_per_file: usize) -> Option<FileSearchResult> {
    let metadata = std::fs::metadata(path).ok()?;
    if metadata.len() > SEARCH_MAX_FILE_BYTES {
        return None;
    }
    let bytes = std::fs::read(path).ok()?;
    if bytes.is_empty() || is_probably_binary(&bytes) {
        return None;
    }
    let (raw_text, _encoding, _had_errors) = encoding::decode_auto(&bytes);
    let text = eol::to_lf(&raw_text);

    let mut matches = Vec::new();
    let mut truncated = false;
    for (index, line) in text.split('\n').enumerate() {
        if matches.len() >= max_per_file {
            truncated = true;
            break;
        }
        if !matcher.is_match(line) {
            continue;
        }
        let preview = preview_of(line);
        for found in matcher.find_iter(line) {
            matches.push(SearchMatch {
                line: index + 1,
                column: line[..found.start()].chars().count() + 1,
                length: found.as_str().chars().count().max(1),
                preview: preview.clone(),
            });
            if matches.len() >= max_per_file {
                truncated = true;
                break;
            }
        }
    }

    if matches.is_empty() {
        None
    } else {
        Some(FileSearchResult {
            path: path.display().to_string(),
            matches,
            truncated,
        })
    }
}

/// Starts a background search. Progress arrives as `search://progress` events.
pub fn spawn(
    app: AppHandle,
    registry: Arc<SearchRegistry>,
    opts: SearchOptions,
) -> Result<u64, AppError> {
    let matcher = build_matcher(&opts)?;
    let root = PathBuf::from(&opts.root);
    if !root.is_dir() {
        return Err(AppError::NotFound(opts.root.clone()));
    }
    let includes = build_glob_set(opts.include.as_deref())?;
    let excludes = build_glob_set(opts.exclude.as_deref())?;
    let skip_dirs = bare_dir_names(opts.exclude.as_deref());
    let (search_id, cancel_flag) = registry.register();
    let registry_for_task = registry.clone();
    let limits = (opts.max_results, opts.max_per_file);

    std::thread::spawn(move || {
        let mut builder = WalkBuilder::new(&root);
        builder
            // Hidden entries stay out of scope, so `.git`/`.cache` are never
            // descended into unless the user globs them explicitly.
            .hidden(true)
            .git_ignore(true)
            .git_global(false)
            .git_exclude(true)
            .follow_links(false);
        if !skip_dirs.is_empty() {
            builder.filter_entry(move |entry| {
                if !entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false) {
                    return true;
                }
                let name = entry.file_name().to_string_lossy().to_ascii_lowercase();
                !skip_dirs.iter().any(|skip| skip == &name)
            });
        }

        let mut scanned = 0usize;
        let mut matched_files = 0usize;
        let mut total_matches = 0usize;
        let mut cancelled = false;
        let mut batch: Vec<FileSearchResult> = Vec::new();
        let mut last_flush = Instant::now();

        for entry in builder.build().flatten() {
            if cancel_flag.load(Ordering::SeqCst) {
                cancelled = true;
                break;
            }
            let path = entry.path();
            if !entry
                .file_type()
                .map(|kind| kind.is_file())
                .unwrap_or(false)
            {
                continue;
            }
            let file_name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or_default();
            let relative = path.strip_prefix(&root).unwrap_or(path);
            if let Some(set) = &includes {
                if !matches_set(set, relative, file_name) {
                    continue;
                }
            }
            if let Some(set) = &excludes {
                if matches_set(set, relative, file_name) {
                    continue;
                }
            }

            scanned += 1;
            if let Some(result) = scan_file(path, &matcher, limits.1) {
                total_matches += result.matches.len();
                matched_files += 1;
                batch.push(result);
            }

            let flush_due = batch.len() >= FLUSH_EVERY_FILES
                || last_flush.elapsed().as_millis() >= FLUSH_EVERY_MS;
            if flush_due {
                let _ = app.emit(
                    SEARCH_PROGRESS_EVENT,
                    SearchProgress {
                        search_id,
                        scanned_files: scanned,
                        matched_files,
                        done: false,
                        cancelled: false,
                        results: std::mem::take(&mut batch),
                    },
                );
                last_flush = Instant::now();
            }
            if total_matches >= limits.0 {
                break;
            }
        }

        let _ = app.emit(
            SEARCH_PROGRESS_EVENT,
            SearchProgress {
                search_id,
                scanned_files: scanned,
                matched_files,
                done: true,
                cancelled,
                results: std::mem::take(&mut batch),
            },
        );
        registry_for_task.finish(search_id);
    });

    Ok(search_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options(query: &str) -> SearchOptions {
        SearchOptions {
            root: ".".into(),
            query: query.into(),
            regex: false,
            case_sensitive: false,
            whole_word: false,
            include: None,
            exclude: None,
            max_results: 100,
            max_per_file: 10,
        }
    }

    #[test]
    fn literal_query_is_escaped() {
        let matcher = build_matcher(&options("a.b")).unwrap();
        assert!(matcher.is_match("xa.by"));
        assert!(!matcher.is_match("axby"));
    }

    #[test]
    fn case_insensitive_by_default() {
        let matcher = build_matcher(&options("hello")).unwrap();
        assert!(matcher.is_match("HELLO"));
    }

    #[test]
    fn whole_word_bounds_the_match() {
        let mut opts = options("cat");
        opts.whole_word = true;
        let matcher = build_matcher(&opts).unwrap();
        assert!(matcher.is_match("a cat sat"));
        assert!(!matcher.is_match("concatenate"));
    }

    #[test]
    fn invalid_regex_is_rejected() {
        let mut opts = options("(unclosed");
        opts.regex = true;
        assert!(build_matcher(&opts).is_err());
    }

    #[test]
    fn empty_query_is_rejected() {
        assert!(build_matcher(&options("")).is_err());
    }

    #[test]
    fn glob_set_matches_relative_paths() {
        let set = build_glob_set(Some("*.rs, src/**/*.ts")).unwrap();
        assert!(matches_any(&set, Path::new("src/a/b.ts"), "b.ts"));
        assert!(matches_any(&set, Path::new("deep/main.rs"), "main.rs"));
        assert!(!matches_any(&set, Path::new("deep/main.c"), "main.c"));
    }

    #[test]
    fn bare_names_expand_to_directory_globs() {
        let set = build_glob_set(Some("node_modules,.git")).unwrap();
        assert!(matches_any(
            &set,
            Path::new("node_modules/react/index.js"),
            "index.js"
        ));
        assert!(matches_any(&set, Path::new("pkg/.git/config"), "config"));
        assert!(!matches_any(&set, Path::new("src/main.rs"), "main.rs"));
    }

    #[test]
    fn bare_dir_names_ignore_wildcard_patterns() {
        assert_eq!(
            bare_dir_names(Some("node_modules, *.log, src/**, .git")),
            vec!["node_modules".to_string(), ".git".to_string()]
        );
        assert!(bare_dir_names(None).is_empty());
    }

    #[test]
    fn binary_detection_flags_nul_bytes() {
        assert!(is_probably_binary(&[1, 2, 0, 4]));
        assert!(!is_probably_binary(b"plain text"));
    }
}
