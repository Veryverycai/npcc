use crate::error::AppError;
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// Names the renderer is allowed to persist through `load_state` / `save_state`.
pub const STATE_FILES: [&str; 3] = ["settings", "session", "recent"];

pub fn config_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|err| AppError::Io(err.to_string()))?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn state_path(app: &AppHandle, name: &str) -> Result<PathBuf, AppError> {
    if !STATE_FILES.contains(&name) {
        return Err(AppError::Invalid(format!("unknown state file: {name}")));
    }
    Ok(config_dir(app)?.join(format!("{name}.json")))
}

pub fn read_json<T: DeserializeOwned>(path: &Path) -> Result<Option<T>, AppError> {
    if !path.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(path)?;
    if raw.trim().is_empty() {
        return Ok(None);
    }
    serde_json::from_str(&raw)
        .map(Some)
        .map_err(|err| AppError::Io(format!("corrupt state file {}: {err}", path.display())))
}

pub fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<(), AppError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let payload = serde_json::to_vec_pretty(value).map_err(|err| AppError::Io(err.to_string()))?;
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, payload)?;
    // Rename is atomic on the same volume, so a crash cannot truncate the file.
    std::fs::rename(&tmp, path)?;
    Ok(())
}
