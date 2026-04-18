use crate::models::{SearchResult, TerminalRequest, TerminalResponse, WorkspaceEntry, GitStatus, GitFile};
use std::{fs, path::PathBuf, process::Command, time::SystemTime};
use walkdir::WalkDir;
use serde::{Deserialize, Serialize};

// ─── File Analysis Types ───

#[derive(Serialize, Deserialize, Clone)]
pub struct FileInfo {
    pub path: String,
    pub size_bytes: u64,
    pub modified: String,
    pub is_directory: bool,
    pub line_count: Option<usize>,
    pub language: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct FileAnalysis {
    pub path: String,
    pub language: String,
    pub line_count: usize,
    pub imports: Vec<String>,
    pub exports: Vec<String>,
    pub functions: Vec<String>,
    pub classes: Vec<String>,
    pub todos: Vec<String>,
    pub issues: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ProjectAnalysis {
    pub total_files: usize,
    pub total_lines: usize,
    pub total_size_bytes: u64,
    pub languages: Vec<LanguageBreakdown>,
    pub frameworks: Vec<String>,
    pub tree: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct LanguageBreakdown {
    pub language: String,
    pub files: usize,
    pub lines: usize,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DependencyAnalysis {
    pub manifest: String,
    pub dependencies: Vec<DependencyInfo>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DependencyInfo {
    pub name: String,
    pub version: String,
    pub kind: String, // "dependency", "devDependency", etc.
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GrepMatch {
    pub file: String,
    pub line: usize,
    pub content: String,
    pub context_before: String,
    pub context_after: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct BulkReplaceResult {
    pub files_modified: usize,
    pub total_replacements: usize,
    pub details: Vec<String>,
}

// ─── Existing Commands ───

#[tauri::command]
pub fn read_directory(path: String) -> Result<Vec<WorkspaceEntry>, String> {
    let entries = fs::read_dir(&path).map_err(|err| format!("Cannot read directory '{}': {}", path, err))?;
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
    fs::read_to_string(&path).map_err(|err| format!("Cannot read '{}': {}", path, err))
}

#[tauri::command]
pub fn write_workspace_file(path: String, content: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|err| format!("Failed to create directories for {}: {}", path, err))?;
    }
    fs::write(&path, content).map_err(|err| format!("Failed to write {}: {}", path, err))
}

#[tauri::command]
pub fn search_workspace(root: String, query: String) -> Result<Vec<SearchResult>, String> {
    let mut results = Vec::new();
    for entry in WalkDir::new(&root).max_depth(6).into_iter().filter_map(Result::ok) {
        let path = entry.path();
        if path.is_file() {
            // Skip binary-looking files and hidden dirs
            let path_str = path.to_string_lossy();
            if path_str.contains(".git") || path_str.contains("node_modules") || path_str.contains("target") {
                continue;
            }
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
    let cwd = PathBuf::from(&request.cwd);
    if !cwd.exists() {
        return TerminalResponse {
            allowed: false,
            stdout: String::new(),
            stderr: format!("Working directory does not exist: {}", request.cwd),
            exit_code: 1,
            message: Some("Invalid working directory.".into()),
        };
    }

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
            message: None,
        },
        Err(err) => TerminalResponse {
            allowed: false,
            stdout: String::new(),
            stderr: err.to_string(),
            exit_code: 1,
            message: Some("Terminal execution failed.".into()),
        },
    }
}

// ─── New File Operations ───

#[tauri::command]
pub fn delete_workspace_file(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    if p.is_dir() {
        fs::remove_dir(&path).map_err(|e| format!("Cannot delete directory '{}': {}", path, e))?;
        Ok(format!("Deleted directory: {}", path))
    } else if p.is_file() {
        fs::remove_file(&path).map_err(|e| format!("Cannot delete file '{}': {}", path, e))?;
        Ok(format!("Deleted file: {}", path))
    } else {
        Err(format!("Path does not exist: {}", path))
    }
}

#[tauri::command]
pub fn rename_workspace_file(from: String, to: String) -> Result<String, String> {
    let dest = PathBuf::from(&to);
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Cannot create destination dirs: {}", e))?;
    }
    fs::rename(&from, &to).map_err(|e| format!("Cannot rename '{}' → '{}': {}", from, to, e))?;
    Ok(format!("Renamed {} → {}", from, to))
}

#[tauri::command]
pub fn create_workspace_directory(path: String) -> Result<String, String> {
    fs::create_dir_all(&path).map_err(|e| format!("Cannot create directory '{}': {}", path, e))?;
    Ok(format!("Created directory: {}", path))
}

#[tauri::command]
pub fn list_directory_recursive(path: String, max_depth: Option<usize>) -> Result<Vec<WorkspaceEntry>, String> {
    let depth = max_depth.unwrap_or(3);
    let mut items = Vec::new();

    for entry in WalkDir::new(&path).max_depth(depth).into_iter().filter_map(Result::ok) {
        let p = entry.path();
        let name = p.to_string_lossy().to_string();
        // Skip hidden dirs and bulky dirs
        if name.contains(".git") || name.contains("node_modules") || name.contains("target/debug") || name.contains("target/release") {
            continue;
        }
        items.push(WorkspaceEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: p.to_string_lossy().to_string(),
            is_directory: p.is_dir(),
        });
        if items.len() >= 500 {
            break;
        }
    }

    Ok(items)
}

// ─── File Info ───

#[tauri::command]
pub fn get_file_info(path: String) -> Result<FileInfo, String> {
    let p = PathBuf::from(&path);
    let meta = fs::metadata(&path).map_err(|e| format!("Cannot stat '{}': {}", path, e))?;

    let modified = meta.modified()
        .unwrap_or(SystemTime::UNIX_EPOCH)
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| format!("{}s since epoch", d.as_secs()))
        .unwrap_or_default();

    let line_count = if meta.is_file() {
        fs::read_to_string(&path).ok().map(|c| c.lines().count())
    } else {
        None
    };

    let language = infer_language_from_path(&p);

    Ok(FileInfo {
        path,
        size_bytes: meta.len(),
        modified,
        is_directory: meta.is_dir(),
        line_count,
        language,
    })
}

// ─── Code Analysis ───

#[tauri::command]
pub fn analyze_file(path: String) -> Result<FileAnalysis, String> {
    let content = fs::read_to_string(&path).map_err(|e| format!("Cannot read '{}': {}", path, e))?;
    let p = PathBuf::from(&path);
    let language = infer_language_from_path(&p);
    let lines: Vec<&str> = content.lines().collect();
    let line_count = lines.len();

    let mut imports = Vec::new();
    let mut exports = Vec::new();
    let mut functions = Vec::new();
    let mut classes = Vec::new();
    let mut todos = Vec::new();
    let mut issues = Vec::new();

    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();

        // Imports
        if trimmed.starts_with("import ") || trimmed.starts_with("from ") || trimmed.starts_with("use ") || trimmed.starts_with("require(") || trimmed.starts_with("const ") && trimmed.contains("require(") {
            imports.push(trimmed.to_string());
        }

        // Exports
        if trimmed.starts_with("export ") || trimmed.starts_with("pub ") || trimmed.starts_with("module.exports") {
            let short = if trimmed.len() > 100 { format!("{}...", &trimmed[..100]) } else { trimmed.to_string() };
            exports.push(short);
        }

        // Functions
        if trimmed.starts_with("function ") || trimmed.starts_with("async function ")
            || trimmed.contains("fn ") && (trimmed.starts_with("pub") || trimmed.starts_with("fn ") || trimmed.starts_with("async fn"))
            || trimmed.starts_with("def ") {
            let short = if trimmed.len() > 120 { format!("{}...", &trimmed[..120]) } else { trimmed.to_string() };
            functions.push(format!("L{}: {}", i + 1, short));
        }

        // Arrow functions assigned to const/let
        if (trimmed.starts_with("const ") || trimmed.starts_with("let ")) && (trimmed.contains("=>") || trimmed.contains("= function")) {
            let short = if trimmed.len() > 120 { format!("{}...", &trimmed[..120]) } else { trimmed.to_string() };
            functions.push(format!("L{}: {}", i + 1, short));
        }

        // Classes / structs
        if trimmed.starts_with("class ") || trimmed.starts_with("export class ") || trimmed.starts_with("struct ") || trimmed.starts_with("pub struct ") || trimmed.starts_with("interface ") || trimmed.starts_with("export interface ") {
            let short = if trimmed.len() > 100 { format!("{}...", &trimmed[..100]) } else { trimmed.to_string() };
            classes.push(format!("L{}: {}", i + 1, short));
        }

        // TODOs and FIXMEs
        let upper = trimmed.to_uppercase();
        if upper.contains("TODO") || upper.contains("FIXME") || upper.contains("HACK") || upper.contains("XXX") {
            todos.push(format!("L{}: {}", i + 1, trimmed));
        }

        // Potential issues
        if trimmed.contains("console.log") && !trimmed.starts_with("//") {
            issues.push(format!("L{}: console.log left in code", i + 1));
        }
        if trimmed.contains("debugger") && !trimmed.starts_with("//") {
            issues.push(format!("L{}: debugger statement", i + 1));
        }
        if trimmed.contains("any") && (language == "typescript" || language == "tsx") && !trimmed.starts_with("//") {
            if trimmed.contains(": any") || trimmed.contains("<any>") || trimmed.contains("as any") {
                issues.push(format!("L{}: `any` type usage", i + 1));
            }
        }
    }

    // Limit arrays to avoid huge responses
    imports.truncate(30);
    exports.truncate(30);
    functions.truncate(50);
    classes.truncate(20);
    todos.truncate(20);
    issues.truncate(30);

    Ok(FileAnalysis {
        path,
        language,
        line_count,
        imports,
        exports,
        functions,
        classes,
        todos,
        issues,
    })
}

#[tauri::command]
pub fn analyze_project(root: String) -> Result<ProjectAnalysis, String> {
    let mut total_files = 0usize;
    let mut total_lines = 0usize;
    let mut total_size: u64 = 0;
    let mut lang_map: std::collections::HashMap<String, (usize, usize)> = std::collections::HashMap::new();
    let mut tree = Vec::new();
    let mut detected_frameworks = Vec::new();

    for entry in WalkDir::new(&root).max_depth(5).into_iter().filter_map(Result::ok) {
        let path = entry.path();
        let rel = path.strip_prefix(&root).unwrap_or(path).to_string_lossy().to_string();

        // Skip junk directories
        if rel.contains(".git") || rel.contains("node_modules") || rel.contains("target/debug") || rel.contains("target/release") || rel.contains("__pycache__") {
            continue;
        }

        if path.is_dir() {
            if tree.len() < 100 {
                tree.push(format!("📁 {}/", rel));
            }
        } else {
            total_files += 1;
            let size = fs::metadata(path).map(|m| m.len()).unwrap_or(0);
            total_size += size;

            let lang = infer_language_from_path(path);
            let lines = fs::read_to_string(path).map(|c| c.lines().count()).unwrap_or(0);
            total_lines += lines;

            let entry = lang_map.entry(lang).or_insert((0, 0));
            entry.0 += 1;
            entry.1 += lines;

            if tree.len() < 100 {
                tree.push(format!("  📄 {} ({} lines)", rel, lines));
            }
        }
    }

    // Detect frameworks
    let has_file = |name: &str| PathBuf::from(&root).join(name).exists();
    if has_file("package.json") { detected_frameworks.push("Node.js".to_string()); }
    if has_file("Cargo.toml") { detected_frameworks.push("Rust/Cargo".to_string()); }
    if has_file("requirements.txt") || has_file("pyproject.toml") { detected_frameworks.push("Python".to_string()); }
    if has_file("tsconfig.json") { detected_frameworks.push("TypeScript".to_string()); }
    if has_file("next.config.js") || has_file("next.config.mjs") { detected_frameworks.push("Next.js".to_string()); }
    if has_file("vite.config.ts") || has_file("vite.config.js") { detected_frameworks.push("Vite".to_string()); }
    if has_file("tauri.conf.json") || has_file("src-tauri/tauri.conf.json") { detected_frameworks.push("Tauri".to_string()); }
    if has_file("angular.json") { detected_frameworks.push("Angular".to_string()); }
    if has_file("tailwind.config.js") || has_file("tailwind.config.ts") { detected_frameworks.push("Tailwind CSS".to_string()); }

    let mut languages: Vec<LanguageBreakdown> = lang_map.into_iter()
        .filter(|(l, _)| l != "unknown")
        .map(|(language, (files, lines))| LanguageBreakdown { language, files, lines })
        .collect();
    languages.sort_by(|a, b| b.lines.cmp(&a.lines));

    Ok(ProjectAnalysis {
        total_files,
        total_lines,
        total_size_bytes: total_size,
        languages,
        frameworks: detected_frameworks,
        tree,
    })
}

#[tauri::command]
pub fn analyze_dependencies(root: String, manifest_path: Option<String>) -> Result<DependencyAnalysis, String> {
    let root_path = PathBuf::from(&root);
    
    // Try package.json first, then Cargo.toml
    let manifest = if let Some(mp) = manifest_path {
        PathBuf::from(mp)
    } else if root_path.join("package.json").exists() {
        root_path.join("package.json")
    } else if root_path.join("Cargo.toml").exists() {
        root_path.join("Cargo.toml")
    } else {
        return Err("No package.json or Cargo.toml found in workspace.".into());
    };

    let content = fs::read_to_string(&manifest).map_err(|e| format!("Cannot read manifest: {}", e))?;
    let manifest_name = manifest.file_name().unwrap_or_default().to_string_lossy().to_string();
    let mut deps = Vec::new();

    if manifest_name == "package.json" {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(d) = json.get("dependencies").and_then(|v| v.as_object()) {
                for (name, ver) in d {
                    deps.push(DependencyInfo {
                        name: name.clone(),
                        version: ver.as_str().unwrap_or("*").to_string(),
                        kind: "dependency".into(),
                    });
                }
            }
            if let Some(d) = json.get("devDependencies").and_then(|v| v.as_object()) {
                for (name, ver) in d {
                    deps.push(DependencyInfo {
                        name: name.clone(),
                        version: ver.as_str().unwrap_or("*").to_string(),
                        kind: "devDependency".into(),
                    });
                }
            }
        }
    } else if manifest_name == "Cargo.toml" {
        // Simple TOML parsing for dependencies section
        let mut section = String::new();
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with('[') {
                section = trimmed.trim_matches(|c| c == '[' || c == ']').to_string();
            } else if section.contains("dependencies") && trimmed.contains('=') {
                let parts: Vec<&str> = trimmed.splitn(2, '=').collect();
                if parts.len() == 2 {
                    let name = parts[0].trim().to_string();
                    let ver = parts[1].trim().trim_matches('"').to_string();
                    deps.push(DependencyInfo {
                        name,
                        version: ver,
                        kind: section.clone(),
                    });
                }
            }
        }
    }

    Ok(DependencyAnalysis {
        manifest: manifest.to_string_lossy().to_string(),
        dependencies: deps,
    })
}

// ─── Grep Search ───

#[tauri::command]
pub fn grep_search(root: String, pattern: String, include: Option<String>, sub_path: Option<String>) -> Result<Vec<GrepMatch>, String> {
    let base = if let Some(sp) = sub_path {
        PathBuf::from(&root).join(sp)
    } else {
        PathBuf::from(&root)
    };

    let re = regex::Regex::new(&pattern).map_err(|e| format!("Invalid regex: {}", e))?;
    let ext_filter = include.as_deref().and_then(|i| i.strip_prefix("*."));
    let mut matches = Vec::new();

    for entry in WalkDir::new(&base).max_depth(8).into_iter().filter_map(Result::ok) {
        let path = entry.path();
        if !path.is_file() { continue; }

        let path_str = path.to_string_lossy();
        if path_str.contains(".git") || path_str.contains("node_modules") || path_str.contains("target/debug") {
            continue;
        }

        if let Some(ext) = ext_filter {
            if !path_str.ends_with(ext) { continue; }
        }

        if let Ok(content) = fs::read_to_string(path) {
            let lines: Vec<&str> = content.lines().collect();
            for (i, line) in lines.iter().enumerate() {
                if re.is_match(line) {
                    matches.push(GrepMatch {
                        file: path.to_string_lossy().to_string(),
                        line: i + 1,
                        content: line.to_string(),
                        context_before: if i > 0 { lines[i - 1].to_string() } else { String::new() },
                        context_after: if i + 1 < lines.len() { lines[i + 1].to_string() } else { String::new() },
                    });
                }
                if matches.len() >= 200 { return Ok(matches); }
            }
        }
    }

    Ok(matches)
}

// ─── Bulk Replace ───

#[tauri::command]
pub fn bulk_replace(root: String, search: String, replace: String, include: Option<String>, sub_path: Option<String>) -> Result<BulkReplaceResult, String> {
    let base = if let Some(sp) = sub_path {
        PathBuf::from(&root).join(sp)
    } else {
        PathBuf::from(&root)
    };

    let ext_filter = include.as_deref().and_then(|i| i.strip_prefix("*."));
    let mut files_modified = 0;
    let mut total_replacements = 0;
    let mut details = Vec::new();

    for entry in WalkDir::new(&base).max_depth(8).into_iter().filter_map(Result::ok) {
        let path = entry.path();
        if !path.is_file() { continue; }

        let path_str = path.to_string_lossy();
        if path_str.contains(".git") || path_str.contains("node_modules") || path_str.contains("target/debug") {
            continue;
        }

        if let Some(ext) = ext_filter {
            if !path_str.ends_with(ext) { continue; }
        }

        if let Ok(content) = fs::read_to_string(path) {
            let count = content.matches(&search).count();
            if count > 0 {
                let new_content = content.replace(&search, &replace);
                fs::write(path, new_content).map_err(|e| format!("Cannot write '{}': {}", path_str, e))?;
                files_modified += 1;
                total_replacements += count;
                details.push(format!("{}: {} replacement(s)", path_str, count));
            }
        }
    }

    Ok(BulkReplaceResult {
        files_modified,
        total_replacements,
        details,
    })
}

// ─── Fetch URL ───

#[tauri::command]
pub async fn fetch_url(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(&url)
        .header("User-Agent", "Antimatter-IDE/0.1")
        .send().await
        .map_err(|e| format!("Failed to fetch '{}': {}", url, e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}: {}", resp.status(), url));
    }

    let body = resp.text().await.map_err(|e| format!("Failed to read response: {}", e))?;

    // Strip HTML tags for cleaner output
    let content_type_is_html = body.trim_start().starts_with("<!") || body.trim_start().starts_with("<html");
    if content_type_is_html {
        Ok(strip_html_tags(&body))
    } else {
        // Limit text size
        if body.len() > 50_000 {
            Ok(format!("{}...\n\n[Truncated at 50KB]", &body[..50_000]))
        } else {
            Ok(body)
        }
    }
}

// ─── Git Commands ───

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

    let branch_output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&cwd)
        .output()
        .map_err(|e| e.to_string())?;
    status.branch = String::from_utf8_lossy(&branch_output.stdout).trim().into();

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
                _ => "modified",
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

// ─── Helpers ───

fn infer_language_from_path(path: &std::path::Path) -> String {
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    match ext {
        "ts" => "typescript",
        "tsx" => "tsx",
        "js" | "mjs" | "cjs" => "javascript",
        "jsx" => "jsx",
        "rs" => "rust",
        "py" => "python",
        "json" => "json",
        "html" | "htm" => "html",
        "css" | "scss" | "sass" => "css",
        "md" | "markdown" => "markdown",
        "toml" => "toml",
        "yaml" | "yml" => "yaml",
        "sh" | "bash" | "zsh" => "shell",
        "sql" => "sql",
        "go" => "go",
        "java" => "java",
        "c" | "h" => "c",
        "cpp" | "cc" | "hpp" => "cpp",
        "cs" => "csharp",
        "rb" => "ruby",
        "php" => "php",
        "swift" => "swift",
        "kt" => "kotlin",
        "lua" => "lua",
        _ => "unknown",
    }.to_string()
}

fn strip_html_tags(html: &str) -> String {
    let mut result = String::with_capacity(html.len());
    let mut in_tag = false;
    let mut in_script = false;
    let mut in_style = false;

    for c in html.chars() {
        if c == '<' {
            in_tag = true;
            continue;
        }
        if c == '>' {
            in_tag = false;
            // Check for script/style tags
            let lower = result.to_lowercase();
            if lower.ends_with("script") { in_script = true; }
            if lower.ends_with("/script") { in_script = false; }
            if lower.ends_with("style") { in_style = true; }
            if lower.ends_with("/style") { in_style = false; }
            continue;
        }
        if !in_tag && !in_script && !in_style {
            result.push(c);
        }
    }

    // Collapse whitespace
    let collapsed: String = result.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.len() > 30_000 {
        format!("{}...\n\n[Truncated]", &collapsed[..30_000])
    } else {
        collapsed
    }
}
