use crate::models::{AppSettings, ProviderConfig, RecentProject};
use keyring::Entry;
use std::{fs, path::PathBuf};

const APP_DIR: &str = "antimatter";
const SETTINGS_FILE: &str = "settings.json";
const PROVIDERS_FILE: &str = "providers.json";
const RECENTS_FILE: &str = "recent_projects.json";
const KEYRING_SERVICE: &str = "Antimatter";

fn app_config_dir() -> PathBuf {
    let base = std::env::var("HOME")
        .map(PathBuf::from)
        .or_else(|_| std::env::var("USERPROFILE").map(PathBuf::from))
        .unwrap_or_else(|_| PathBuf::from("."));

    let dir = base.join(format!(".{}", APP_DIR));
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    dir
}

fn read_json<T: serde::de::DeserializeOwned>(file_name: &str) -> Option<T> {
    let path = app_config_dir().join(file_name);
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

fn write_json<T: serde::Serialize>(file_name: &str, data: &T) -> Result<(), String> {
    let path = app_config_dir().join(file_name);
    let content = serde_json::to_string_pretty(data).map_err(|err| err.to_string())?;
    fs::write(path, content).map_err(|err| err.to_string())
}

pub fn load_settings() -> AppSettings {
    read_json(SETTINGS_FILE).unwrap_or(AppSettings {
        theme: "dark".into(),
        agent_dock_side: "right".into(),
        default_provider_id: None,
        telemetry_enabled: false,
        show_welcome_on_launch: true,
        custom_openai_base_url: None,
    })
}

pub fn save_settings(settings: &AppSettings) -> Result<(), String> {
    write_json(SETTINGS_FILE, settings)
}

pub fn load_providers() -> Vec<ProviderConfig> {
    read_json(PROVIDERS_FILE).unwrap_or_default()
}

pub fn save_provider(config: &ProviderConfig, api_key: Option<String>) -> Result<(), String> {
    let mut providers = load_providers();
    if let Some(index) = providers.iter().position(|entry| entry.id == config.id) {
        providers[index] = config.clone();
    } else {
        providers.push(config.clone());
    }

    if let Some(secret) = api_key {
        let entry = Entry::new(KEYRING_SERVICE, &config.id).map_err(|err| format!("Keyring init: {}", err))?;
        // Force delete first to avoid attribute mismatch on some OS versions
        let _ = entry.delete_credential(); 
        entry.set_password(&secret).map_err(|err| format!("Keyring save: {}", err))?;
    }

    write_json(PROVIDERS_FILE, &providers)
}

pub fn get_provider_secret(provider_id: &str) -> Result<Option<String>, String> {
    let entry = Entry::new(KEYRING_SERVICE, provider_id).map_err(|err| format!("Keyring init: {}", err))?;
    match entry.get_password() {
        Ok(pass) => Ok(Some(pass)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(format!("Keyring retrieval: {}", err)),
    }
}

pub fn get_recent_projects() -> Vec<RecentProject> {
    read_json(RECENTS_FILE).unwrap_or_default()
}

pub fn save_recent_project(path: &str) -> Result<(), String> {
    let mut projects = get_recent_projects();
    let name = PathBuf::from(path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(path)
        .to_string();
    let now = format!("{}", chrono_like_now());

    if let Some(index) = projects.iter().position(|entry| entry.path == path) {
        projects[index].last_opened_at = now;
    } else {
        projects.insert(
            0,
            RecentProject {
                name,
                path: path.to_string(),
                last_opened_at: now,
            },
        );
    }

    projects.truncate(20);
    write_json(RECENTS_FILE, &projects)
}

fn chrono_like_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{}", timestamp)
}
