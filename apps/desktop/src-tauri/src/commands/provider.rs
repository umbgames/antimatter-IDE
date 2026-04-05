use crate::{models::{ProviderConfig, ProviderTestResult}, storage};

#[tauri::command]
pub fn load_providers() -> Vec<ProviderConfig> {
    storage::load_providers()
}

#[tauri::command]
pub fn save_provider(config: ProviderConfig, api_key: Option<String>) -> Result<(), String> {
    storage::save_provider(&config, api_key)
}

#[tauri::command]
pub fn test_provider_connection(config: ProviderConfig) -> ProviderTestResult {
    let has_secret = storage::get_provider_secret(&config.id).is_some() || config.api_key_stored;
    if !has_secret && config.kind != "local" {
        return ProviderTestResult {
            ok: false,
            message: "No API key is stored for this provider yet. Save one first, then test again.".into(),
        };
    }

    if config.kind == "local" && config.base_url.as_deref().unwrap_or_default().is_empty() {
        return ProviderTestResult {
            ok: false,
            message: "Local endpoints need a base URL. Antimatter does not include a local model binary.".into(),
        };
    }

    ProviderTestResult {
        ok: true,
        message: format!(
            "{} is configured. Replace this stub with a live network probe if you want runtime validation.",
            config.label
        ),
    }
}
