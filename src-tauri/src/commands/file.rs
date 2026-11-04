use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::services::encoding::{self, Encoding};
use crate::services::eol::{self, Eol};

/// Above this size we open a read-only preview instead of the whole file.
const PREVIEW_LIMIT_BYTES: u64 = 20 * 1024 * 1024;
/// Above this size the file is refused outright.
const HARD_LIMIT_BYTES: u64 = 50 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadFileResult {
    pub path: String,
    pub content: String,
    pub encoding: Encoding,
    pub eol: Eol,
    pub size_bytes: u64,
    pub mtime_ms: u64,
    pub truncated: bool,
    pub had_errors: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteFileRequest {
    pub path: String,
    pub content: String,
    pub encoding: Encoding,
    pub eol: Eol,
    #[serde(default)]
    pub backup: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteFileResult {
    pub path: String,
    pub size_bytes: u64,
    pub mtime_ms: u64,
    pub had_errors: bool,
}

fn mtime_ms(metadata: &std::fs::Metadata) -> u64 {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn temp_path(path: &Path) -> PathBuf {
    let name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "npcc".into());
    path.with_file_name(format!(".{name}.npcc-tmp"))
}

fn backup_path(path: &Path) -> PathBuf {
    let name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "npcc".into());
    path.with_file_name(format!("{name}.bak"))
}

#[tauri::command]
pub fn read_file(path: String, encoding: Option<Encoding>) -> Result<ReadFileResult, AppError> {
    let file_path = PathBuf::from(&path);
    let metadata = std::fs::metadata(&file_path)?;
    if metadata.is_dir() {
        return Err(AppError::Invalid(format!("{path} is a directory")));
    }
    if metadata.len() > HARD_LIMIT_BYTES {
        return Err(AppError::FileTooLarge(metadata.len()));
    }

    let truncated = metadata.len() > PREVIEW_LIMIT_BYTES;
    let bytes = if truncated {
        let file = std::fs::File::open(&file_path)?;
        let mut buffer = Vec::with_capacity(PREVIEW_LIMIT_BYTES as usize);
        file.take(PREVIEW_LIMIT_BYTES).read_to_end(&mut buffer)?;
        buffer
    } else {
        std::fs::read(&file_path)?
    };

    // An explicit encoding means "reopen with this" and skips detection.
    let (text, encoding, had_errors) = match encoding {
        Some(requested) => {
            let (decoded, errors) = encoding::decode(&bytes, requested);
            (decoded, requested, errors)
        }
        None => encoding::decode_auto(&bytes),
    };
    let eol = eol::detect(&text);

    Ok(ReadFileResult {
        path: dunce::canonicalize(&file_path)
            .unwrap_or_else(|_| file_path.clone())
            .display()
            .to_string(),
        content: eol::to_lf(&text),
        encoding,
        eol,
        size_bytes: metadata.len(),
        mtime_ms: mtime_ms(&metadata),
        truncated,
        had_errors,
    })
}

#[tauri::command]
pub fn write_file(request: WriteFileRequest) -> Result<WriteFileResult, AppError> {
    if request.path.trim().is_empty() {
        return Err(AppError::Invalid("empty path".into()));
    }
    let file_path = PathBuf::from(&request.path);
    if file_path.is_dir() {
        return Err(AppError::Invalid(format!(
            "{} is a directory",
            request.path
        )));
    }

    let normalized = eol::normalize(&request.content, request.eol);
    let (bytes, had_errors) = encoding::encode(&normalized, request.encoding);

    if file_path.exists() {
        let metadata = std::fs::metadata(&file_path)?;
        if metadata.permissions().readonly() {
            return Err(AppError::ReadOnly(request.path.clone()));
        }
        if request.backup {
            std::fs::copy(&file_path, backup_path(&file_path))?;
        }
    } else if let Some(parent) = file_path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)?;
        }
    }

    // Write next to the target and rename: a crash can never leave a half file.
    let temp = temp_path(&file_path);
    std::fs::write(&temp, &bytes)?;
    if let Err(err) = std::fs::rename(&temp, &file_path) {
        let _ = std::fs::remove_file(&temp);
        return Err(match err.kind() {
            std::io::ErrorKind::PermissionDenied => AppError::ReadOnly(request.path.clone()),
            _ => AppError::from(err),
        });
    }

    let metadata = std::fs::metadata(&file_path)?;
    Ok(WriteFileResult {
        path: file_path.display().to_string(),
        size_bytes: metadata.len(),
        mtime_ms: mtime_ms(&metadata),
        had_errors,
    })
}

#[tauri::command]
pub fn file_exists(path: String) -> bool {
    Path::new(&path).is_file()
}

#[tauri::command]
pub fn reveal_in_explorer(path: String) -> Result<(), AppError> {
    let target = PathBuf::from(&path);
    if !target.exists() {
        return Err(AppError::NotFound(path));
    }
    let resolved = dunce::canonicalize(&target).unwrap_or(target);

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(format!("/select,{}", resolved.display()))
            .spawn()
            .map_err(|err| AppError::Io(err.to_string()))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&resolved)
            .spawn()
            .map_err(|err| AppError::Io(err.to_string()))?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let dir = resolved.parent().unwrap_or(&resolved);
        std::process::Command::new("xdg-open")
            .arg(dir)
            .spawn()
            .map_err(|err| AppError::Io(err.to_string()))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Temp directory that cleans itself up when the test ends.
    struct TempDir(PathBuf);

    impl TempDir {
        fn new(name: &str) -> Self {
            let dir = std::env::temp_dir().join(format!("npcc-{}-{name}", std::process::id()));
            std::fs::create_dir_all(&dir).unwrap();
            TempDir(dir)
        }

        fn file(&self, name: &str, bytes: &[u8]) -> PathBuf {
            let path = self.0.join(name);
            std::fs::write(&path, bytes).unwrap();
            path
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn write(path: &Path, content: &str, encoding: Encoding, eol: Eol) -> WriteFileResult {
        write_file(WriteFileRequest {
            path: path.display().to_string(),
            content: content.to_string(),
            encoding,
            eol,
            backup: false,
        })
        .unwrap()
    }

    /// M1 acceptance: read -> edit -> save -> read back must keep the bytes.
    #[test]
    fn roundtrip_keeps_gbk_crlf_bytes() {
        let temp = TempDir::new("gbk");
        let original = vec![0xD6, 0xD0, 0xCE, 0xC4, b'\r', b'\n', b'h', b'i'];
        let path = temp.file("a.txt", &original);

        let read = read_file(path.display().to_string(), None).unwrap();
        assert_eq!(read.encoding, Encoding::Gbk);
        assert_eq!(read.eol, Eol::Crlf);
        assert_eq!(read.content, "中文\nhi");
        assert!(!read.truncated);

        write(&path, &read.content, read.encoding, read.eol);
        assert_eq!(std::fs::read(&path).unwrap(), original);
    }

    #[test]
    fn roundtrip_keeps_utf16_and_bom() {
        let temp = TempDir::new("utf16");
        let (original, _) = encoding::encode("näpcc 编辑器\r\n", Encoding::Utf16Le);
        let path = temp.file("b.txt", &original);

        let read = read_file(path.display().to_string(), None).unwrap();
        assert_eq!(read.encoding, Encoding::Utf16Le);
        assert_eq!(read.eol, Eol::Crlf);

        write(&path, &read.content, read.encoding, read.eol);
        assert_eq!(std::fs::read(&path).unwrap(), original);
    }

    #[test]
    fn explicit_encoding_overrides_detection() {
        let temp = TempDir::new("reopen");
        let original = vec![0xD6, 0xD0, 0xCE, 0xC4];
        let path = temp.file("c.txt", &original);

        let as_gbk = read_file(path.display().to_string(), Some(Encoding::Gbk)).unwrap();
        assert_eq!(as_gbk.content, "中文");

        // Re-reading as UTF-8 must not corrupt or rewrite the source file.
        let as_utf8 = read_file(path.display().to_string(), Some(Encoding::Utf8)).unwrap();
        assert!(as_utf8.had_errors);
        assert_eq!(std::fs::read(&path).unwrap(), original);
    }

    #[test]
    fn writing_a_new_file_creates_missing_directories() {
        let temp = TempDir::new("newdir");
        let path = temp.0.join("nested/deeper/new.txt");
        let result = write(&path, "hello\n", Encoding::Utf8, Eol::Lf);
        assert_eq!(result.size_bytes, 6);
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "hello\n");
    }

    #[test]
    fn directories_are_rejected() {
        let temp = TempDir::new("dir");
        assert!(read_file(temp.0.display().to_string(), None).is_err());
    }
}
