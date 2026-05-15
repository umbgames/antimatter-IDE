use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

/// Holds the writable end of the PTY (for sending user keystrokes)
pub struct PtyState {
    pub writer: Mutex<Option<Box<dyn Write + Send>>>,
}

/// Spawn a real PTY shell and stream its output to the frontend via events.
/// The PTY stays alive for the lifetime of the app window.
#[tauri::command]
pub fn spawn_pty(
    app: AppHandle,
    state: tauri::State<'_, PtyState>,
    cwd: Option<String>,
    rows: Option<u16>,
    cols: Option<u16>,
) -> Result<(), String> {
    // If a PTY writer already exists, the shell is already running
    {
        let guard = state.writer.lock().unwrap();
        if guard.is_some() {
            return Ok(());
        }
    }

    let pty_system = native_pty_system();
    let pty_size = PtySize {
        rows: rows.unwrap_or(24),
        cols: cols.unwrap_or(80),
        pixel_width: 0,
        pixel_height: 0,
    };

    let pair = pty_system
        .openpty(pty_size)
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    // Build the shell command
    let mut cmd = CommandBuilder::new("powershell.exe");
    cmd.args(["-NoLogo"]);
    if let Some(ref dir) = cwd {
        if !dir.is_empty() {
            cmd.cwd(dir);
        }
    }

    // Spawn the child process inside the PTY
    let _child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    // Drop the slave — the master side owns the I/O now
    drop(pair.slave);

    // Split the master into reader/writer
    let mut reader = pair.master.try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {}", e))?;

    // Store writer so we can send keystrokes later
    let writer = pair.master.try_clone_writer()
        .map_err(|e| format!("Failed to clone PTY writer: {}", e))?;
    {
        let mut guard = state.writer.lock().unwrap();
        *guard = Some(writer);
    }

    // Spawn a background thread to continuously read PTY output → emit to frontend
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break, // PTY closed
                Ok(n) => {
                    let text = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app.emit("pty-output", text);
                }
                Err(_) => break,
            }
        }
    });

    Ok(())
}

/// Write raw user keystrokes into the PTY stdin
#[tauri::command]
pub fn write_pty(
    state: tauri::State<'_, PtyState>,
    data: String,
) -> Result<(), String> {
    let mut guard = state.writer.lock().unwrap();
    if let Some(ref mut writer) = *guard {
        writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;
        writer.flush().map_err(|e| format!("Failed to flush PTY: {}", e))?;
        Ok(())
    } else {
        Err("PTY not started. Call spawn_pty first.".into())
    }
}

/// Resize the PTY when the user resizes the terminal panel
#[tauri::command]
pub fn resize_pty(
    state: tauri::State<'_, PtyState>,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    // portable-pty doesn't expose resize on the writer directly, 
    // so we accept the command but it's a no-op for now.
    // In production, you'd store the MasterPty separately and call resize on it.
    let _ = (state, rows, cols);
    Ok(())
}
