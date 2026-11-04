mod commands;
mod error;
mod menu;
mod services;

use std::path::Path;
use std::sync::Arc;

use tauri::{Emitter, Manager};

use services::search::SearchRegistry;

/// Menu clicks are forwarded to the renderer as this event, carrying a command id.
pub const MENU_COMMAND_EVENT: &str = "menu://command";
/// A second instance forwards the files it was launched with on this event.
pub const OPEN_PATHS_EVENT: &str = "open://paths";

/// Command-line arguments that name an existing file, used by "open with".
pub fn file_args() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|arg| !arg.starts_with('-'))
        .filter(|arg| Path::new(arg).is_file())
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
            let paths: Vec<String> = argv
                .into_iter()
                .skip(1)
                .filter(|arg| !arg.starts_with('-'))
                .filter(|arg| Path::new(arg).is_file())
                .collect();
            if !paths.is_empty() {
                let _ = app.emit(OPEN_PATHS_EVENT, paths);
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(Arc::new(SearchRegistry::default()))
        .invoke_handler(tauri::generate_handler![
            commands::file::read_file,
            commands::file::write_file,
            commands::file::file_exists,
            commands::file::reveal_in_explorer,
            commands::search::search_in_folder,
            commands::search::cancel_search,
            commands::plugin::list_plugins,
            commands::plugin::plugin_manifest,
            commands::plugin::open_plugin_window,
            commands::state::load_state,
            commands::state::save_state,
            commands::state::set_recent_files,
            commands::state::config_dir,
            commands::state::startup_paths,
        ])
        .setup(|app| {
            let (menu, recent) = menu::build(app.handle())?;
            app.set_menu(menu)?;
            app.manage(recent);
            Ok(())
        })
        .on_menu_event(|app, event| {
            let _ = app.emit(MENU_COMMAND_EVENT, event.id().0.clone());
        })
        .run(tauri::generate_context!())
        .expect("failed to start Npcc");
}
