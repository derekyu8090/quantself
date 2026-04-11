use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

/// Read a JSON data file from ~/health-dashboard/public/data/
#[tauri::command]
fn read_health_data(filename: String) -> Result<String, String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let path = std::path::PathBuf::from(&home)
        .join("health-dashboard")
        .join("public")
        .join("data")
        .join(&filename);
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", filename, e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![read_health_data])
        .setup(|app| {
            // Build tray menu
            let show_i = MenuItem::with_id(app, "show", "Show Dashboard", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit QuantSelf", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            // Build tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("QuantSelf")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
