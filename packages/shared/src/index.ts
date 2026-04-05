export type ThemeMode = 'dark' | 'light';
export type AgentDockSide = 'left' | 'right';
export type BottomPanelTab = 'terminal' | 'problems' | 'output';
export type ProviderKind =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'groq'
  | 'local'
  | 'openai-compatible';

export interface WorkspaceEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface OpenFile {
  path: string;
  name: string;
  language: string;
  content: string;
  dirty?: boolean;
}

export interface RecentProject {
  name: string;
  path: string;
  lastOpenedAt: string;
}

export interface ProviderConfig {
  id: string;
  label: string;
  kind: ProviderKind;
  baseUrl?: string;
  model: string;
  apiKeyStored: boolean;
  status: 'unknown' | 'connected' | 'failed';
  notes?: string;
}

export interface ProviderTestResult {
  ok: boolean;
  message: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  createdAt: string;
}

export interface AgentActionLog {
  id: string;
  kind: 'plan' | 'tool' | 'approval' | 'info' | 'error';
  title: string;
  detail: string;
  createdAt: string;
}

export interface DiffPreview {
  filePath: string;
  original: string;
  proposed: string;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  diff?: DiffPreview;
}

export interface AppSettings {
  theme: ThemeMode;
  agentDockSide: AgentDockSide;
  defaultProviderId?: string;
  telemetryEnabled: boolean;
  showWelcomeOnLaunch: boolean;
  customOpenAIBaseUrl?: string;
}

export interface SearchResult {
  filePath: string;
  line: number;
  preview: string;
}

export interface TerminalRequest {
  cwd: string;
  command: string;
}

export interface TerminalResponse {
  allowed: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  message?: string;
}

export const APP_NAME = 'Antimatter';
export const APP_TAGLINE = 'A local-first agentic IDE for developers who want leverage without lock-in.';
