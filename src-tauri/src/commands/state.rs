use serde::Deserialize;
use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::error::AppError;
use crate::menu::RecentMenuState;
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

/// One label for a "最近打开" slot. The renderer owns the paths; the menu only
/// shows names, so a stale entry can never open the wrong file.
#[derive(Deserialize)]
pub struct RecentMenuEntry {
    pub name: String,
}

/// Relabels the five File-menu slots; `entries` is already ordered newest first.
#[tauri::command]
pub fn set_recent_files(app: AppHandle, entries: Vec<RecentMenuEntry>) -> Result<(), AppError> {
    let state = app.state::<RecentMenuState>();
    let slots = state
        .0
        .lock()
        .map_err(|err| AppError::Io(err.to_string()))?;
    for (index, slot) in slots.iter().enumerate() {
        let result = match entries.get(index) {
            Some(entry) => slot
                .set_text(format!("{}. {}", index + 1, entry.name))
                .and_then(|_| slot.set_enabled(true)),
            None => slot
                .set_text("（空）")
                .and_then(|_| slot.set_enabled(false)),
        };
        result.map_err(|err| AppError::Io(err.to_string()))?;
    }
    Ok(())
}
