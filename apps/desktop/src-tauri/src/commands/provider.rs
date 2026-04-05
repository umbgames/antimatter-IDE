use crate::{
    models::{ChatMessage, ProviderConfig, ProviderTestResult},
    storage,
};
use reqwest::{header, Client};
use serde_json::json;

#[tauri::command]
pub fn load_providers() -> Vec<ProviderConfig> {
    storage::load_providers()
}

#[tauri::command]
pub fn save_provider(config: ProviderConfig, api_key: Option<String>) -> Result<(), String> {
    storage::save_provider(&config, api_key)
}

#[tauri::command]
pub async fn test_provider_connection(config: ProviderConfig) -> ProviderTestResult {
    let has_secret = storage::get_provider_secret(&config.id).is_some() || config.api_key_stored;
    if !has_secret && config.kind != "local" {
        return ProviderTestResult {
            ok: false,
            message: "No API key is stored for this provider yet. Save one first, then test again.".into(),
        };
    }

    let client = Client::new();
    let result = match config.kind.as_str() {
        "groq" | "openai" | "openai-compatible" | "local" => {
            test_openai_compatible_connection(&client, &config).await
        }
        "anthropic" => Ok("Anthropic is configured. Live HTTP transport is not wired in this starter yet.".into()),
        "gemini" => Ok("Gemini is configured. Live HTTP transport is not wired in this starter yet.".into()),
        _ => Err("Unknown provider kind.".into()),
    };

    match result {
        Ok(message) => ProviderTestResult { ok: true, message },
        Err(message) => ProviderTestResult { ok: false, message },
    }
}

#[tauri::command]
pub async fn chat_with_provider(provider_id: String, messages: Vec<ChatMessage>) -> Result<String, String> {
    let config = storage::load_providers()
        .into_iter()
        .find(|entry| entry.id == provider_id)
        .ok_or_else(|| "Provider not found. Save it in Settings → Providers first.".to_string())?;

    match config.kind.as_str() {
        "groq" | "openai" | "openai-compatible" | "local" => {
            let client = Client::new();
            send_openai_compatible_chat(&client, &config, &messages).await
        }
        "anthropic" => Err("Anthropic transport is not wired in this starter yet. Groq, OpenAI, local OpenAI-compatible, and custom OpenAI-compatible endpoints are live.".into()),
        "gemini" => Err("Gemini transport is not wired in this starter yet. Groq, OpenAI, local OpenAI-compatible, and custom OpenAI-compatible endpoints are live.".into()),
        _ => Err("Unsupported provider kind.".into()),
    }
}

async fn test_openai_compatible_connection(client: &Client, config: &ProviderConfig) -> Result<String, String> {
    let url = format!("{}/models", normalized_base_url(config)?);
    let mut request = client.get(url).header(header::CONTENT_TYPE, "application/json");

    if config.kind != "local" {
        let secret = storage::get_provider_secret(&config.id)
            .ok_or_else(|| "No API key is stored for this provider yet. Save one first, then test again.".to_string())?;
        request = request.bearer_auth(secret);
    }

    let response = request.send().await.map_err(format_network_error)?;
    if response.status().is_success() {
        Ok(format!("{} connection succeeded. Antimatter does not provide models; performance depends on your selected provider, endpoint, and hardware.", config.label))
    } else {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        Err(format!("Connection test failed with {}. {}", status, compact_error_body(&body)))
    }
}

async fn send_openai_compatible_chat(
    client: &Client,
    config: &ProviderConfig,
    messages: &[ChatMessage],
) -> Result<String, String> {
    if config.model.trim().is_empty() {
        return Err("Choose a default model before running the agent.".into());
    }

    let url = format!("{}/chat/completions", normalized_base_url(config)?);
    let normalized_messages: Vec<_> = messages
        .iter()
        .map(|message| json!({
            "role": normalize_role(&message.role),
            "content": message.content,
        }))
        .collect();

    let mut request = client
        .post(url)
        .header(header::CONTENT_TYPE, "application/json")
        .json(&json!({
            "model": config.model,
            "messages": normalized_messages,
            "temperature": 0.2,
        }));

    if config.kind != "local" {
        let secret = storage::get_provider_secret(&config.id)
            .ok_or_else(|| "No API key is stored for this provider yet. Save one in Settings → Providers before running the agent.".to_string())?;
        request = request.bearer_auth(secret);
    }

    let response = request.send().await.map_err(format_network_error)?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Provider returned {}. {}", status, compact_error_body(&body)));
    }

    let json: serde_json::Value = response.json().await.map_err(format_network_error)?;
    json.get("choices")
        .and_then(|choices| choices.get(0))
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(|content| content.as_str())
        .map(|content| content.to_string())
        .ok_or_else(|| "Provider response did not contain assistant text in choices[0].message.content.".to_string())
}

fn normalized_base_url(config: &ProviderConfig) -> Result<String, String> {
    let base = if let Some(base_url) = config.base_url.as_deref() {
        let trimmed = base_url.trim();
        if trimmed.is_empty() {
            default_base_url(config.kind.as_str())
        } else {
            trimmed.to_string()
        }
    } else {
        default_base_url(config.kind.as_str())
    };

    if base.is_empty() {
        return Err("This provider requires a base URL. Add one in Settings → Providers.".into());
    }

    Ok(base.trim_end_matches('/').to_string())
}

fn default_base_url(kind: &str) -> String {
    match kind {
        "groq" => "https://api.groq.com/openai/v1".to_string(),
        "openai" => "https://api.openai.com/v1".to_string(),
        _ => String::new(),
    }
}

fn normalize_role(role: &str) -> &'static str {
    match role {
        "system" => "system",
        "assistant" | "tool" => "assistant",
        _ => "user",
    }
}

fn compact_error_body(body: &str) -> String {
    let collapsed = body.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.len() > 240 {
        format!("{}…", &collapsed[..240])
    } else if collapsed.is_empty() {
        "No response body was returned.".into()
    } else {
        collapsed
    }
}

fn format_network_error(error: reqwest::Error) -> String {
    if error.is_timeout() {
        "The request timed out while reaching the provider endpoint.".into()
    } else if error.is_connect() {
        "Could not connect to the provider endpoint. Check the base URL, network access, or local server status.".into()
    } else {
        error.to_string()
    }
}
