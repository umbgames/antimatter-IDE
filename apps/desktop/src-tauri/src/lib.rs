mod commands;
mod models;
mod storage;

use std::collections::HashMap;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let lsp_state = commands::lsp::LspState {
        process_map: Mutex::new(HashMap::new()),
    };

    let pty_state = commands::pty::PtyState {
        writer: Mutex::new(None),
    };

    tauri::Builder::default()
        .manage(lsp_state)
        .manage(pty_state)
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
            commands::provider::chat_with_provider_stream,
            commands::provider::transcribe_audio,
            commands::workspace::read_directory,
            commands::workspace::read_workspace_file,
            commands::workspace::write_workspace_file,
            commands::workspace::search_workspace,
            commands::workspace::execute_terminal_command,
            commands::workspace::get_git_status,
            commands::workspace::get_git_diff,
            commands::workspace::delete_workspace_file,
            commands::workspace::rename_workspace_file,
            commands::workspace::create_workspace_directory,
            commands::workspace::list_directory_recursive,
            commands::workspace::get_file_info,
            commands::workspace::analyze_file,
            commands::workspace::analyze_project,
            commands::workspace::analyze_dependencies,
            commands::workspace::grep_search,
            commands::workspace::bulk_replace,
            commands::workspace::fetch_url,
            commands::workspace::find_symbols,
            commands::workspace::read_files_batch,
            commands::workspace::generate_repo_map,
            commands::lsp::start_lsp,
            commands::lsp::send_lsp_message,
            commands::vision::capture_screen,
            commands::pty::spawn_pty,
            commands::pty::write_pty,
            commands::pty::resize_pty,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Antimatter");
}
