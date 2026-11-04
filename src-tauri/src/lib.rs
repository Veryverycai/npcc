mod commands;
mod error;
mod services;

use std::path::Path;
use std::sync::Arc;

use tauri::{Emitter, Manager};

use services::search::SearchRegistry;

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

/// Windows paints a taskbar button from the window's big icon (`ICON_BIG`).
/// Tauri only ever sets the small one, so the button falls back to the icon the
/// shell cached for `npcc.exe` -- and that cache survives an upgrade, leaving the
/// previous version's artwork in the taskbar while the exe on disk is new.
/// Attaching the big icon on every launch keeps the taskbar tied to the binary
/// that is actually running.
#[cfg(windows)]
fn install_taskbar_icon(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    use std::ffi::c_void;
    use std::os::windows::ffi::OsStrExt;

    #[link(name = "shell32")]
    extern "system" {
        fn ExtractIconExW(
            file: *const u16,
            index: i32,
            large: *mut *mut c_void,
            small: *mut *mut c_void,
            count: u32,
        ) -> u32;
    }

    #[link(name = "user32")]
    extern "system" {
        fn SendMessageW(hwnd: *mut c_void, msg: u32, wparam: usize, lparam: isize) -> isize;
    }

    const WM_SETICON: u32 = 0x0080;
    const ICON_BIG: usize = 1;

    let exe: Vec<u16> = std::env::current_exe()?
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let mut large: *mut c_void = std::ptr::null_mut();

    // Index 0 is the icon the shell shows for the exe, so this cannot drift from
    // the artwork baked in at build time. Passing a null small-icon slot keeps
    // the call from handing back a second handle nobody frees.
    let extracted = unsafe { ExtractIconExW(exe.as_ptr(), 0, &mut large, std::ptr::null_mut(), 1) };
    if extracted == 0 || large.is_null() {
        return Ok(());
    }

    let hwnd = window.hwnd()?;
    unsafe { SendMessageW(hwnd.0, WM_SETICON, ICON_BIG, large as isize) };
    Ok(())
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
        // The Windows taskbar reads ICON_BIG, which Tauri leaves empty; see
        // install_taskbar_icon for why that matters after an upgrade.
        .setup(|app| {
            #[cfg(windows)]
            if let Some(window) = app.get_webview_window("main") {
                if let Err(error) = install_taskbar_icon(&window) {
                    eprintln!("could not attach the taskbar icon: {error}");
                }
            }
            Ok(())
        })
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
            commands::state::config_dir,
            commands::state::startup_paths,
        ])
        // The menu bar is rendered by the webview (renderer/components/MenuBar.tsx)
        // so it can follow the editor theme; a native Win32 menu cannot.
        .run(tauri::generate_context!())
        .expect("failed to start Npcc");
}
