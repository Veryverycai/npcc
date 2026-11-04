use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::error::AppError;
use crate::services::plugins::{self, PluginManifest};

#[tauri::command]
pub fn list_plugins(app: AppHandle) -> Vec<PluginManifest> {
    plugins::list(&app)
}

#[tauri::command]
pub fn plugin_manifest(app: AppHandle, id: String) -> Result<PluginManifest, AppError> {
    plugins::find(&app, &id)
}

/// Opens the plugin in its own window. That window gets a dedicated capability
/// (`capabilities/plugin.json`) with no file system permissions; its host page
/// talks to the editor only through the renderer-side RPC bridge. Third-party
/// script execution is a later milestone — manifests are declarative today.
#[tauri::command]
pub fn open_plugin_window(app: AppHandle, id: String) -> Result<(), AppError> {
    let manifest = plugins::find(&app, &id)?;
    let label = format!("plugin-{id}");

    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.unminimize();
        let _ = existing.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App(format!("plugin.html?id={id}").into()),
    )
    .title(format!("插件 · {}", manifest.name))
    .inner_size(820.0, 600.0)
    .min_inner_size(520.0, 360.0)
    .build()
    .map_err(|err| AppError::Io(err.to_string()))?;

    Ok(())
}
