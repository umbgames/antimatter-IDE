use crate::{models::AppSettings, storage};

#[tauri::command]
pub fn load_settings() -> AppSettings {
    storage::load_settings()
}

#[tauri::command]
pub fn save_settings(settings: AppSettings) -> Result<(), String> {
    storage::save_settings(&settings)
}

#[tauri::command]
pub fn get_recent_projects() -> Vec<crate::models::RecentProject> {
    storage::get_recent_projects()
}

#[tauri::command]
pub fn save_recent_project(path: String) -> Result<(), String> {
    storage::save_recent_project(&path)
}
