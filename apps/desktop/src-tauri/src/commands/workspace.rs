use crate::models::{SearchResult, TerminalRequest, TerminalResponse, WorkspaceEntry, GitStatus, GitFile};
use std::{fs, path::PathBuf, process::Command, str};
use walkdir::WalkDir;

#[tauri::command]
pub fn read_directory(path: String) -> Result<Vec<WorkspaceEntry>, String> {
    let entries = fs::read_dir(path).map_err(|err| err.to_string())?;
    let mut items = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path();
        items.push(WorkspaceEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: path.to_string_lossy().to_string(),
            is_directory: path.is_dir(),
        });
    }

    items.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(items)
}

#[tauri::command]
pub fn read_workspace_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn write_workspace_file(path: String, content: String) -> Result<(), String> {
    fs::write(path, content).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn search_workspace(root: String, query: String) -> Result<Vec<SearchResult>, String> {
    let mut results = Vec::new();
    for entry in WalkDir::new(root).max_depth(6).into_iter().filter_map(Result::ok) {
        let path = entry.path();
        if path.is_file() {
            if let Ok(content) = fs::read_to_string(path) {
                for (index, line) in content.lines().enumerate() {
                    if line.to_lowercase().contains(&query.to_lowercase()) {
                        results.push(SearchResult {
                            file_path: path.to_string_lossy().to_string(),
                            line: index + 1,
                            preview: line.trim().to_string(),
                        });
                    }
                    if results.len() >= 100 {
                        return Ok(results);
                    }
                }
            }
        }
    }
    Ok(results)
}

#[tauri::command]
pub fn execute_terminal_command(request: TerminalRequest) -> TerminalResponse {
    let denied = ["rm -rf", "shutdown", "reboot", "mkfs", ":(){:|:&};:"];
    if denied.iter().any(|pattern| request.command.contains(pattern)) {
        return TerminalResponse {
            allowed: false,
            stdout: String::new(),
            stderr: String::new(),
            exit_code: 126,
            message: Some("Command denied by the starter execution policy. Add an approval flow before enabling destructive commands.".into()),
        };
    }

    let cwd = PathBuf::from(request.cwd);
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", &request.command])
            .current_dir(cwd)
            .output()
    } else {
        Command::new("sh")
            .args(["-lc", &request.command])
            .current_dir(cwd)
            .output()
    };

    match output {
        Ok(output) => TerminalResponse {
            allowed: true,
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            exit_code: output.status.code().unwrap_or_default(),
            message: Some("Guarded terminal execution completed. For production use, add explicit approval policies and process streaming.".into()),
        },
        Err(err) => TerminalResponse {
            allowed: false,
            stdout: String::new(),
            stderr: err.to_string(),
            exit_code: 1,
            message: Some("Terminal execution failed before process launch.".into()),
        },
    }
}
#[tauri::command]
pub fn get_git_status(path: String) -> Result<GitStatus, String> {
    let mut status = GitStatus {
        staged: Vec::new(),
        unstaged: Vec::new(),
        branch: String::new(),
    };

    let cwd = PathBuf::from(path);
    if !cwd.join(".git").exists() {
        return Err("Not a git repository".into());
    }

    // Get branch name
    let branch_output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&cwd)
        .output()
        .map_err(|e| e.to_string())?;
    status.branch = String::from_utf8_lossy(&branch_output.stdout).trim().into();

    // Get status porcelan
    let status_output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&cwd)
        .output()
        .map_err(|e| e.to_string())?;
    
    let stdout = String::from_utf8_lossy(&status_output.stdout);
    for line in stdout.lines() {
        if line.len() < 3 { continue; }
        let (x, y) = (line.chars().nth(0).unwrap(), line.chars().nth(1).unwrap());
        let file_path = &line[3..];

        let git_file = GitFile {
            path: file_path.into(),
            status: match (x, y) {
                ('A', _) | ('M', ' ') | ('D', ' ') | ('R', ' ') => "staged",
                (_, 'M') | (_, 'D') | ('?', '?') => "unstaged",
                _ => "modified", // general
            }.into(),
        };

        if x != ' ' && x != '?' {
            status.staged.push(git_file.clone());
        }
        if y != ' ' || x == '?' {
            status.unstaged.push(git_file);
        }
    }

    Ok(status)
}

#[tauri::command]
pub fn get_git_diff(path: String, staged: bool) -> Result<String, String> {
    let cwd = PathBuf::from(path);
    let mut args = vec!["diff"];
    if staged {
        args.push("--cached");
    }

    let output = Command::new("git")
        .args(args)
        .current_dir(&cwd)
        .output()
        .map_err(|e| e.to_string())?;
    
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
