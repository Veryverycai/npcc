use serde_json::Value;
use tauri::AppHandle;

use crate::error::AppError;
use crate::services::store;

/// The renderer owns the state schema; Rust only persists it. That keeps a
/// single source of truth for defaults and migrations (see `src/shared`).
#[tauri::command]
pub fn load_state(app: AppHandle, name: String) -> Result<Option<Value>, AppError> {
    let path = store::state_path(&app, &name)?;
    store::read_json::<Value>(&path)
}

#[tauri::command]
pub fn save_state(app: AppHandle, name: String, value: Value) -> Result<(), AppError> {
    let path = store::state_path(&app, &name)?;
    store::write_json(&path, &value)
}

#[tauri::command]
pub fn config_dir(app: AppHandle) -> Result<String, AppError> {
    Ok(store::config_dir(&app)?.display().to_string())
}

/// Files passed on the command line, so `npcc file.txt` opens a tab.
#[tauri::command]
pub fn startup_paths() -> Vec<String> {
    crate::file_args()
}
