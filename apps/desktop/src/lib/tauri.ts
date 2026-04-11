import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type {
  AppSettings,
  GitStatus,
  OpenFile,
  ProviderConfig,
  ProviderTestResult,
  RecentProject,
  SearchResult,
  TerminalRequest,
  TerminalResponse,
  WorkspaceEntry
} from '@antimatter/shared';

export async function readDirectory(path: string): Promise<WorkspaceEntry[]> {
  return invoke('read_directory', { path });
}

export async function readWorkspaceFile(path: string): Promise<string> {
  return invoke('read_workspace_file', { path });
}

export async function writeWorkspaceFile(path: string, content: string): Promise<void> {
  return invoke('write_workspace_file', { path, content });
}

export async function searchWorkspace(root: string, query: string): Promise<SearchResult[]> {
  return invoke('search_workspace', { root, query });
}

export async function saveRecentProject(path: string): Promise<void> {
  return invoke('save_recent_project', { path });
}

export async function getRecentProjects(): Promise<RecentProject[]> {
  return invoke('get_recent_projects');
}

export async function loadSettings(): Promise<AppSettings> {
  return invoke('load_settings');
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke('save_settings', { settings });
}

export async function loadProviders(): Promise<ProviderConfig[]> {
  return invoke('load_providers');
}

export async function saveProvider(config: ProviderConfig, apiKey?: string): Promise<void> {
  return invoke('save_provider', { config, apiKey });
}

export async function testProviderConnection(config: ProviderConfig, apiKey?: string): Promise<ProviderTestResult> {
  return invoke('test_provider_connection', { config, apiKey });
}

export async function executeTerminal(request: TerminalRequest): Promise<TerminalResponse> {
  return invoke('execute_terminal_command', { request });
}

export async function getGitStatus(path: string): Promise<GitStatus> {
  return invoke('get_git_status', { path });
}

export async function getGitDiff(path: string, staged: boolean): Promise<string> {
  return invoke('get_git_diff', { path, staged });
}

export async function openFolderPicker(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Select Workspace Folder'
  });
  if (Array.isArray(selected)) return selected[0];
  return selected;
}

export async function openFileAsTab(path: string): Promise<OpenFile> {
  const content = await readWorkspaceFile(path);
  const name = path.split(/[\\/]/).pop() ?? path;
  const language = inferLanguage(name);
  return { path, name, content, language };
}

function inferLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
      return 'typescript';
    case 'tsx':
      return 'typescript';
    case 'js':
      return 'javascript';
    case 'jsx':
      return 'javascript';
    case 'rs':
      return 'rust';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    case 'toml':
      return 'ini';
    default:
      return 'plaintext';
  }
}


export interface RuntimeChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

export async function chatWithProvider(providerId: string, messages: RuntimeChatMessage[]): Promise<string> {
  return invoke('chat_with_provider', { providerId, messages });
}
