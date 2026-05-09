use crate::{
    models::{ChatMessage, ChatResponse, ProviderConfig, ProviderTestResult, ToolCall, ToolCallFunction},
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
pub async fn test_provider_connection(config: ProviderConfig, api_key: Option<String>) -> ProviderTestResult {
    let has_secret = api_key.is_some() || storage::get_provider_secret(&config.id).map(|s| s.is_some()).unwrap_or(false) || config.api_key_stored;
    if !has_secret && config.kind != "local" {
        return ProviderTestResult {
            ok: false,
            message: format!("No API key is stored for '{}' yet. Save one in Settings → Providers first, or enter one in the API key field to test it.", config.label),
        };
    }

    let client = Client::new();
    let result = match config.kind.as_str() {
        "groq" | "openai" | "openai-compatible" | "local" => {
            test_openai_compatible_connection(&client, &config, api_key).await
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
pub async fn chat_with_provider(
    provider_id: String,
    messages: Vec<ChatMessage>,
    tools: Option<serde_json::Value>,
) -> Result<ChatResponse, String> {
    let config = storage::load_providers()
        .into_iter()
        .find(|entry| entry.id == provider_id)
        .ok_or_else(|| format!("Provider '{}' (ID: {}) not found. Save it in Settings → Providers first.", provider_id, provider_id))?;

    match config.kind.as_str() {
        "groq" | "openai" | "openai-compatible" | "local" => {
            let client = Client::new();
            send_openai_compatible_chat(&client, &config, &messages, tools.as_ref()).await
        }
        "anthropic" => Err("Anthropic transport is not wired in this starter yet.".into()),
        "gemini" => Err("Gemini transport is not wired in this starter yet.".into()),
        _ => Err("Unsupported provider kind.".into()),
    }
}

#[tauri::command]
pub async fn chat_with_provider_stream(
    provider_id: String,
    messages: Vec<ChatMessage>,
    tools: Option<serde_json::Value>,
    on_event: tauri::ipc::Channel<String>,
) -> Result<ChatResponse, String> {
    let config = storage::load_providers()
        .into_iter()
        .find(|entry| entry.id == provider_id)
        .ok_or_else(|| format!("Provider '{}' not found.", provider_id))?;

    match config.kind.as_str() {
        "groq" | "openai" | "openai-compatible" | "local" => {
            let client = Client::new();
            send_openai_compatible_chat_stream(&client, &config, &messages, tools.as_ref(), on_event).await
        }
        _ => Err("Streaming is currently only supported for OpenAI-compatible providers.".into()),
    }
}

#[tauri::command]
pub async fn transcribe_audio(
    provider_id: String,
    audio_bytes: Vec<u8>,
) -> Result<String, String> {
    let config = storage::load_providers()
        .into_iter()
        .find(|entry| entry.id == provider_id)
        .ok_or_else(|| format!("Provider '{}' not found.", provider_id))?;

    let client = Client::new();
    let base_url = normalized_base_url(&config)?;
    let url = format!("{}/audio/transcriptions", base_url);

    let secret = storage::get_provider_secret(&config.id)?
        .ok_or_else(|| format!("No API key is stored for '{}'.", config.label))?;

    let model = if config.kind == "groq" {
        "whisper-large-v3"
    } else {
        "whisper-1"
    };

    let part = reqwest::multipart::Part::bytes(audio_bytes)
        .file_name("audio.webm")
        .mime_str("audio/webm")
        .map_err(|e| e.to_string())?;

    let form = reqwest::multipart::Form::new()
        .part("file", part)
        .text("model", model.to_string());

    let response = client
        .post(&url)
        .bearer_auth(secret)
        .multipart(form)
        .send()
        .await
        .map_err(format_network_error)?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Provider returned {}. {}", status, compact_error_body(&body)));
    }

    let json: serde_json::Value = response.json().await.map_err(format_network_error)?;
    
    let text = json.get("text")
        .and_then(|t| t.as_str())
        .ok_or_else(|| "No text returned from transcription".to_string())?;

    Ok(text.to_string())
}

async fn test_openai_compatible_connection(
    client: &Client, 
    config: &ProviderConfig,
    api_key: Option<String>
) -> Result<String, String> {
    let url = format!("{}/models", normalized_base_url(config)?);
    let mut request = client.get(url).header(header::CONTENT_TYPE, "application/json");

    if config.kind != "local" {
        let secret = match api_key {
            Some(key) => key,
            None => storage::get_provider_secret(&config.id)?
                .ok_or_else(|| format!("No API key is stored for '{}' yet. Save one first, then test again.", config.label))?
        };
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
    tools: Option<&serde_json::Value>,
) -> Result<ChatResponse, String> {
    if config.model.trim().is_empty() {
        return Err("Choose a default model before running the agent.".into());
    }

    let url = format!("{}/chat/completions", normalized_base_url(config)?);

    // Build message array with full tool-calling support
    let normalized_messages: Vec<serde_json::Value> = messages
        .iter()
        .map(|msg| {
            let role = normalize_role(&msg.role);
            let mut m = json!({ "role": role });

            // Content — always include (can be null for assistant tool-call messages)
            if msg.content.is_empty() && msg.tool_calls.is_some() {
                m["content"] = serde_json::Value::Null;
            } else if msg.content.starts_with("data:image/") {
                m["content"] = json!([
                    { "type": "text", "text": "Attached screenshot:" },
                    { "type": "image_url", "image_url": { "url": &msg.content } }
                ]);
            } else {
                m["content"] = json!(msg.content);
            }

            // tool_calls — when replaying an assistant message that called tools
            if let Some(ref tc) = msg.tool_calls {
                let calls: Vec<serde_json::Value> = tc.iter().map(|call| {
                    json!({
                        "id": call.id,
                        "type": "function",
                        "function": {
                            "name": call.function.name,
                            "arguments": call.function.arguments
                        }
                    })
                }).collect();
                m["tool_calls"] = json!(calls);
            }

            // tool_call_id — when this is a tool result message
            if let Some(ref tcid) = msg.tool_call_id {
                m["role"] = json!("tool");
                m["tool_call_id"] = json!(tcid);
            }

            // name — optional function name on tool result messages
            if let Some(ref name) = msg.name {
                m["name"] = json!(name);
            }

            m
        })
        .collect();

    let secret = if config.kind != "local" {
        Some(storage::get_provider_secret(&config.id)?
            .ok_or_else(|| format!("No API key is stored for '{}' yet. Save one in Settings → Providers before running the agent.", config.label))?)
    } else {
        None
    };

    // Build payload — include tools if provided
    let mut payload = json!({
        "model": config.model,
        "messages": normalized_messages,
        "temperature": 0.2,
    });

    if let Some(tools_val) = tools {
        if tools_val.is_array() && !tools_val.as_array().unwrap().is_empty() {
            payload["tools"] = tools_val.clone();
            payload["tool_choice"] = json!("auto");
        }
    }

    let mut retries = 0;
    let max_retries = 5;

    loop {
        let mut request = client
            .post(&url)
            .header(header::CONTENT_TYPE, "application/json")
            .json(&payload);

        if let Some(ref key) = secret {
            request = request.bearer_auth(key);
        }

        let response = match request.send().await {
            Ok(r) => r,
            Err(e) => {
                if retries < max_retries {
                    retries += 1;
                    tokio::time::sleep(std::time::Duration::from_millis(1000 * (1 << retries))).await;
                    continue;
                }
                return Err(format_network_error(e));
            }
        };

        if response.status().is_success() {
            match extract_chat_response(response).await {
                Ok(resp) => return Ok(resp),
                Err(e) => {
                    if retries < max_retries && e.contains("neither content nor tool_calls") {
                        retries += 1;
                        tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
                        continue;
                    }
                    return Err(e);
                }
            }
        }

        let status = response.status();
        let headers = response.headers().clone();
        let body = response.text().await.unwrap_or_default();

        if status.as_u16() == 429 && retries < max_retries {
            retries += 1;
            let wait_time = parse_retry_after(&headers, &body);
            tokio::time::sleep(std::time::Duration::from_millis(wait_time)).await;
            continue;
        }

        if status.as_u16() >= 500 && retries < max_retries {
            retries += 1;
            tokio::time::sleep(std::time::Duration::from_millis(1000 * (1 << retries))).await;
            continue;
        }

        // If tools caused a rejection (some providers/models don't support them),
        // retry without tools — falling back to system-prompt-only tool descriptions
        let is_tool_related_error = status.as_u16() == 400
            && (body.contains("tool") || body.contains("function"));

        if is_tool_related_error && tools.is_some() {
            let fallback_payload = json!({
                "model": config.model,
                "messages": normalized_messages,
                "temperature": 0.2,
            });

            let mut retry_request = client
                .post(&url)
                .header(header::CONTENT_TYPE, "application/json")
                .json(&fallback_payload);

            if let Some(ref key) = secret {
                retry_request = retry_request.bearer_auth(key);
            }

            let retry_response = retry_request.send().await.map_err(format_network_error)?;

            if !retry_response.status().is_success() {
                let retry_status = retry_response.status();
                let retry_body = retry_response.text().await.unwrap_or_default();
                return Err(format!("Provider returned {}. {}", retry_status, compact_error_body(&retry_body)));
            }

            return extract_chat_response(retry_response).await;
        }

        return Err(format!("Provider returned {}. {}", status, compact_error_body(&body)));
    }
}

async fn send_openai_compatible_chat_stream(
    client: &Client,
    config: &ProviderConfig,
    messages: &[ChatMessage],
    tools: Option<&serde_json::Value>,
    on_event: tauri::ipc::Channel<String>,
) -> Result<ChatResponse, String> {
    if config.model.trim().is_empty() {
        return Err("Choose a default model before running the agent.".into());
    }

    let url = format!("{}/chat/completions", normalized_base_url(config)?);

    let normalized_messages: Vec<serde_json::Value> = messages
        .iter()
        .map(|msg| {
            let role = normalize_role(&msg.role);
            let mut m = json!({ "role": role });
            if msg.content.is_empty() && msg.tool_calls.is_some() {
                m["content"] = serde_json::Value::Null;
            } else if msg.content.starts_with("data:image/") {
                m["content"] = json!([
                    { "type": "text", "text": "Attached screenshot:" },
                    { "type": "image_url", "image_url": { "url": &msg.content } }
                ]);
            } else {
                m["content"] = json!(msg.content);
            }
            if let Some(ref tc) = msg.tool_calls {
                let calls: Vec<serde_json::Value> = tc.iter().map(|call| {
                    json!({
                        "id": call.id,
                        "type": "function",
                        "function": {
                            "name": call.function.name,
                            "arguments": call.function.arguments
                        }
                    })
                }).collect();
                m["tool_calls"] = json!(calls);
            }
            if let Some(ref tcid) = msg.tool_call_id {
                m["role"] = json!("tool");
                m["tool_call_id"] = json!(tcid);
            }
            if let Some(ref name) = msg.name {
                m["name"] = json!(name);
            }
            m
        })
        .collect();

    let secret = if config.kind != "local" {
        Some(storage::get_provider_secret(&config.id)?
            .ok_or_else(|| format!("No API key stored for '{}'.", config.label))?)
    } else {
        None
    };

    let mut payload = json!({
        "model": config.model,
        "messages": normalized_messages,
        "temperature": 0.2,
        "stream": true,
    });

    if let Some(tools_val) = tools {
        if tools_val.is_array() && !tools_val.as_array().unwrap().is_empty() {
            payload["tools"] = tools_val.clone();
            payload["tool_choice"] = json!("auto");
        }
    }

    let mut retries = 0;
    let max_retries = 5;

    loop {
        let mut request = client
            .post(&url)
            .header(header::CONTENT_TYPE, "application/json")
            .json(&payload);

        if let Some(ref key) = secret {
            request = request.bearer_auth(key);
        }

        let mut response = match request.send().await {
            Ok(r) => r,
            Err(e) => {
                if retries < max_retries {
                    retries += 1;
                    tokio::time::sleep(std::time::Duration::from_millis(1000 * (1 << retries))).await;
                    continue;
                }
                return Err(format_network_error(e));
            }
        };

        if !response.status().is_success() {
            let status = response.status();
            let headers = response.headers().clone();
            let body = response.text().await.unwrap_or_default();

            if status.as_u16() == 429 && retries < max_retries {
                retries += 1;
                let wait_time = parse_retry_after(&headers, &body);
                tokio::time::sleep(std::time::Duration::from_millis(wait_time)).await;
                continue;
            }

            if status.as_u16() >= 500 && retries < max_retries {
                retries += 1;
                tokio::time::sleep(std::time::Duration::from_millis(1000 * (1 << retries))).await;
                continue;
            }

            return Err(format!("Provider returned {}. {}", status, compact_error_body(&body)));
        }

        let mut full_content = String::new();
        let mut tool_calls_map: std::collections::BTreeMap<usize, ToolCall> = std::collections::BTreeMap::new();
        let mut stream_error = false;

        while let Some(chunk_res) = response.chunk().await.ok() {
            let chunk = match chunk_res {
                Some(c) => c,
                None => break,
            };
            let chunk_str = String::from_utf8_lossy(&chunk);
            for line in chunk_str.lines() {
                let line = line.trim();
                if line.starts_with("data: ") {
                    let data = &line[6..];
                    if data == "[DONE]" {
                        continue;
                    }
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                        if let Some(choices) = json.get("choices").and_then(|c| c.as_array()) {
                            if let Some(choice) = choices.get(0) {
                                if let Some(delta) = choice.get("delta") {
                                    // Accumulate text content
                                    if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                                        full_content.push_str(content);
                                        let _ = on_event.send(content.to_string());
                                    }
                                    // Accumulate tool calls
                                    if let Some(tcs) = delta.get("tool_calls").and_then(|t| t.as_array()) {
                                        for tc in tcs {
                                            if let Some(index) = tc.get("index").and_then(|i| i.as_u64()).map(|i| i as usize) {
                                                let entry = tool_calls_map.entry(index).or_insert_with(|| ToolCall {
                                                    id: tc.get("id").and_then(|i| i.as_str()).unwrap_or_default().to_string(),
                                                    call_type: tc.get("type").and_then(|t| t.as_str()).map(|s| s.to_string()),
                                                    function: ToolCallFunction {
                                                        name: String::new(),
                                                        arguments: String::new(),
                                                    },
                                                });
                                                if let Some(function) = tc.get("function") {
                                                    if let Some(name) = function.get("name").and_then(|n| n.as_str()) {
                                                        entry.function.name.push_str(name);
                                                    }
                                                    if let Some(args) = function.get("arguments").and_then(|a| a.as_str()) {
                                                        entry.function.arguments.push_str(args);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        let final_tool_calls: Vec<ToolCall> = tool_calls_map.into_values().collect();

        if full_content.is_empty() && final_tool_calls.is_empty() {
            if retries < max_retries {
                retries += 1;
                tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
                continue;
            }
            return Err("Provider stream returned neither content nor tool_calls.".to_string());
        }

        return Ok(ChatResponse {
            content: if full_content.is_empty() { None } else { Some(full_content) },
            tool_calls: if final_tool_calls.is_empty() { None } else { Some(final_tool_calls) },
            usage: None,
        });
    }
}

/// Extract the full ChatResponse (content + tool_calls) from a successful API response.
async fn extract_chat_response(response: reqwest::Response) -> Result<ChatResponse, String> {
    let json: serde_json::Value = response.json().await.map_err(format_network_error)?;

    let message = json.get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .ok_or_else(|| "Provider response did not contain choices[0].message.".to_string())?;

    // Extract content (may be null for tool-calling responses)
    let content = message.get("content")
        .and_then(|c| c.as_str())
        .map(|s| s.to_string());

    // Extract tool_calls if present
    let tool_calls = message.get("tool_calls")
        .and_then(|tc| tc.as_array())
        .map(|arr| {
            arr.iter().filter_map(|tc| {
                let id = tc.get("id")?.as_str()?.to_string();
                let call_type = tc.get("type").and_then(|t| t.as_str()).map(|s| s.to_string());
                let function = tc.get("function")?;
                let name = function.get("name")?.as_str()?.to_string();
                let arguments = function.get("arguments")?.as_str()?.to_string();
                Some(ToolCall {
                    id,
                    call_type,
                    function: ToolCallFunction { name, arguments },
                })
            }).collect::<Vec<_>>()
        })
        .filter(|v: &Vec<ToolCall>| !v.is_empty());

    let usage: Option<crate::models::TokenUsage> = json.get("usage")
        .and_then(|u| serde_json::from_value(u.clone()).ok());

    if content.is_none() && tool_calls.is_none() {
        return Err("Provider response contained neither content nor tool_calls.".to_string());
    }

    Ok(ChatResponse {
        content,
        tool_calls,
        usage,
    })
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
        "assistant" => "assistant",
        "tool" => "tool",
        _ => "user",
    }
}

fn parse_retry_after(headers: &header::HeaderMap, body: &str) -> u64 {
    if let Some(retry_after) = headers.get(header::RETRY_AFTER) {
        if let Ok(sec_str) = retry_after.to_str() {
            if let Ok(sec) = sec_str.parse::<u64>() {
                return sec * 1000;
            }
        }
    }
    // Parse Groq-specific message: "Please try again in 20.6925s."
    if let Some(start) = body.find("try again in ") {
        let after_start = &body[start + "try again in ".len()..];
        if let Some(end) = after_start.find('s') {
            let num_str = &after_start[..end];
            if let Ok(sec) = num_str.parse::<f64>() {
                return (sec * 1000.0) as u64 + 500; // Add 500ms buffer
            }
        }
    }
    
    // Default fallback (2s)
    2000
}

fn compact_error_body(body: &str) -> String {
    let msg = if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(body) {
        if let Some(err) = parsed.get("error").and_then(|e| e.get("message")).and_then(|m| m.as_str()) {
            err.to_string()
        } else {
            body.to_string()
        }
    } else {
        body.to_string()
    };
    let collapsed = msg.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.len() > 600 {
        format!("{}…", &collapsed[..600])
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
