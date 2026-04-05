mod commands;
mod models;
mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::settings::load_settings,
            commands::settings::save_settings,
            commands::settings::get_recent_projects,
            commands::settings::save_recent_project,
            commands::provider::load_providers,
            commands::provider::save_provider,
            commands::provider::test_provider_connection,
            commands::provider::chat_with_provider,
            commands::workspace::read_directory,
            commands::workspace::read_workspace_file,
            commands::workspace::write_workspace_file,
            commands::workspace::search_workspace,
            commands::workspace::execute_terminal_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Antimatter");
}
