use std::sync::Arc;

use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::services::search::{self, SearchOptions, SearchRegistry};

#[tauri::command]
pub fn search_in_folder(
    app: AppHandle,
    registry: State<'_, Arc<SearchRegistry>>,
    options: SearchOptions,
) -> Result<u64, AppError> {
    search::spawn(app, registry.inner().clone(), options)
}

#[tauri::command]
pub fn cancel_search(registry: State<'_, Arc<SearchRegistry>>, search_id: u64) -> bool {
    registry.request_cancel(search_id)
}
