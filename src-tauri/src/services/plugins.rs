use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::error::AppError;

use super::store;

/// Declarative surface a plugin may add to the app. Nothing here executes
/// third-party code: contributions are data the renderer interprets.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct PluginContributions {
    pub commands: Vec<PluginCommand>,
    pub languages: Vec<PluginLanguage>,
    pub themes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginCommand {
    pub id: String,
    pub title: String,
    /// Command id this contribution dispatches to (validated against the menu).
    pub command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginLanguage {
    pub extensions: Vec<String>,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub main: Option<String>,
    #[serde(default)]
    pub contributes: PluginContributions,
    /// Absolute plugin directory, filled in while scanning.
    #[serde(default)]
    pub dir: String,
}

/// Plugin ids become directory names and window labels, so keep them tame.
fn is_safe_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
        && !id.contains("..")
}

pub fn plugins_root(app: &AppHandle) -> Result<PathBuf, AppError> {
    Ok(store::config_dir(app)?.join("plugins"))
}

/// Scans `<config>/plugins/<id>/plugin.json`. Broken manifests are skipped so a
/// single bad plugin can never stop the app from starting.
pub fn list(app: &AppHandle) -> Vec<PluginManifest> {
    let Ok(root) = plugins_root(app) else {
        return Vec::new();
    };
    let Ok(entries) = std::fs::read_dir(&root) else {
        return Vec::new();
    };

    let mut plugins = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Ok(raw) = std::fs::read_to_string(path.join("plugin.json")) else {
            continue;
        };
        let Ok(mut manifest) = serde_json::from_str::<PluginManifest>(&raw) else {
            continue;
        };
        let dir_name = entry.file_name().to_string_lossy().to_string();
        if !is_safe_id(&manifest.id) || manifest.id != dir_name {
            continue;
        }
        let unsafe_main = manifest
            .main
            .as_deref()
            .map(|main| main.contains("..") || Path::new(main).is_absolute())
            .unwrap_or(false);
        if unsafe_main {
            manifest.main = None;
        }
        manifest.dir = path.display().to_string();
        plugins.push(manifest);
    }

    plugins.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    plugins
}

pub fn find(app: &AppHandle, id: &str) -> Result<PluginManifest, AppError> {
    list(app)
        .into_iter()
        .find(|plugin| plugin.id == id)
        .ok_or_else(|| AppError::NotFound(format!("plugin {id}")))
}
