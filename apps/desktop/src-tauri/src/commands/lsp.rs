use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

// A registry holding running LSP processes via their stdin
pub struct LspState {
    pub process_map: Mutex<HashMap<String, std::process::ChildStdin>>,
}

// ─── LSP Spawner ───

#[tauri::command]
pub fn start_lsp(
    app: AppHandle,
    state: State<'_, LspState>,
    language: String,
    bin_path: String,
    args: Vec<String>,
    root_path: String,
) -> Result<String, String> {
    let mut map = state.process_map.lock().unwrap();

    // If already running for this language, ignore or restart
    if map.contains_key(&language) {
        return Ok(format!("LSP for {} is already running", language));
    }

    let mut cmd = Command::new(&bin_path);
    cmd.args(args);
    cmd.current_dir(root_path);
    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn LSP {}: {}", bin_path, e))?;

    let stdin = child.stdin.take().ok_or("Failed to open stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to open stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to open stderr")?;

    map.insert(language.clone(), stdin);

    // ─── Stdout Reader Thread (JSON-RPC) ───
    let lang_clone = language.clone();
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        loop {
            // Read until \r\n\r\n
            let mut line = String::new();
            let mut content_length: Option<usize> = None;

            loop {
                line.clear();
                match reader.read_line(&mut line) {
                    Ok(0) => return, // EOF
                    Ok(_) => {
                        let trimmed = line.trim();
                        if trimmed.is_empty() {
                            break; // End of headers
                        }
                        if trimmed.starts_with("Content-Length:") {
                            if let Some(len_str) = trimmed.split(':').nth(1) {
                                if let Ok(len) = len_str.trim().parse::<usize>() {
                                    content_length = Some(len);
                                }
                            }
                        }
                    }
                    Err(_) => return,
                }
            }

            if let Some(len) = content_length {
                let mut buf = vec![0u8; len];
                if reader.read_exact(&mut buf).is_ok() {
                    if let Ok(message) = String::from_utf8(buf) {
                        // Forward to frontend
                        let payload = serde_json::json!({
                            "language": lang_clone,
                            "message": message
                        });
                        let _ = app_clone.emit("lsp-message", payload);
                    }
                }
            }
        }
    });

    // ─── Stderr Logger Thread ───
    let lang_err = language.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(err_line) = line {
                println!("[LSP {} ERROR] {}", lang_err, err_line);
            }
        }
    });

    Ok(format!("Started LSP for {}", language))
}

#[tauri::command]
pub fn send_lsp_message(
    state: State<'_, LspState>,
    language: String,
    message: String,
) -> Result<(), String> {
    let mut map = state.process_map.lock().unwrap();

    if let Some(stdin) = map.get_mut(&language) {
        let payload = format!("Content-Length: {}\r\n\r\n{}", message.len(), message);
        stdin.write_all(payload.as_bytes()).map_err(|e| e.to_string())?;
        stdin.flush().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err(format!("LSP not running for language: {}", language))
    }
}
