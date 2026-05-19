import { create } from 'zustand';
import type {
  AgentActionLog,
  AgentDockSide,
  AgentMessage,
  AppSettings,
  ApprovalRequest,
  BottomPanelTab,
  DiffPreview,
  GitStatus,
  OpenFile,
  ProviderConfig,
  RecentProject,
  ThemeMode,
  WorkspaceEntry
} from '@antimatter/shared';
import { providerDefaults } from '@antimatter/providers';

export interface PaletteItem {
  id: string;
  title: string;
  category: string;
  action: () => void;
}

export type AIEditStats = { 
  addedLines: number[];
  removedLines: number[];
  addedCount: number;
  removedCount: number;
};

interface AppState {
  theme: ThemeMode;
  workspacePath: string | null;
  workspaceEntries: WorkspaceEntry[];
  openFiles: OpenFile[];
  activeFilePath?: string;
  agentDockSide: AgentDockSide;
  bottomPanelTab: BottomPanelTab;
  bottomPanelOpen: boolean;
  settingsOpen: boolean;
  providersOpen: boolean;
  commandPaletteOpen: boolean;
  welcomeVisible: boolean;
  recentProjects: RecentProject[];
  providerConfigs: ProviderConfig[];
  messages: AgentMessage[];
  actionLogs: AgentActionLog[];
  approvalRequests: ApprovalRequest[];
  selectedProviderId?: string;
  paletteItems: PaletteItem[];
  gitStatus?: GitStatus;
  pendingChange?: DiffPreview;
  inlineCompletionsEnabled: boolean;
  learnerModeEnabled: boolean;
  activePersona: 'engineer' | 'architect' | 'qa';

  // ─── New State ───
  isAgentRunning: boolean;
  fileWatcherEnabled: boolean;
  sessionTokens: number;
  indexingProgress: { status: 'idle' | 'indexing' | 'ready'; current: number; total: number };
  terminalOutputQueue: string[];
  aiEdits: Record<string, AIEditStats>;
  streamingMessage: string;
  agentBackups: Record<string, string | null>;

  // ─── Actions ───
  setTheme: (theme: ThemeMode) => void;
  setWorkspacePath: (path?: string) => void;
  setWorkspaceEntries: (entries: WorkspaceEntry[]) => void;
  openFile: (file: OpenFile) => void;
  closeFile: (path: string) => void;
  updateOpenFileContent: (path: string, content: string) => void;
  saveFileLocallyMarked: (path: string) => void;
  setAgentDockSide: (side: AgentDockSide) => void;
  setBottomPanelTab: (tab: BottomPanelTab) => void;
  toggleBottomPanel: () => void;
  setSettingsOpen: (open: boolean) => void;
  setProvidersOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setWelcomeVisible: (visible: boolean) => void;
  setRecentProjects: (projects: RecentProject[]) => void;
  setProviderConfigs: (providers: ProviderConfig[]) => void;
  upsertProviderConfig: (provider: ProviderConfig) => void;
  appendMessage: (message: AgentMessage) => void;
  appendLogs: (logs: AgentActionLog[]) => void;
  setApprovalRequests: (requests: ApprovalRequest[]) => void;
  setSelectedProviderId: (id?: string) => void;
  registerPaletteItems: (items: PaletteItem[]) => void;
  refreshGitStatus: () => Promise<void>;
  setPendingChange: (change?: DiffPreview) => void;
  setInlineCompletionsEnabled: (enabled: boolean) => void;
  setLearnerModeEnabled: (enabled: boolean) => void;
  setActivePersona: (persona: 'engineer' | 'architect' | 'qa') => void;
  setWorkspace: (path: string | null, entries: WorkspaceEntry[]) => void;

  // ─── New Actions ───
  setIsAgentRunning: (running: boolean) => void;
  clearConversation: () => void;
  setFileWatcherEnabled: (enabled: boolean) => void;
  incrementSessionTokens: (tokens: number) => void;
  setIndexingProgress: (progress: { status: 'idle' | 'indexing' | 'ready'; current: number; total: number }) => void;
  appendTerminalOutput: (text: string) => void;
  clearTerminalOutputQueue: () => void;
  updateAIEdits: (path: string, stats: Partial<AIEditStats>) => void;
  clearAIEdits: () => void;
  setStreamingMessage: (content: string) => void;
  setAgentBackups: (backups: Record<string, string | null>) => void;
}

export const initialProviders: ProviderConfig[] = providerDefaults.map((provider, index) => ({
  id: `provider-${index + 1}`,
  label: provider.label,
  kind: provider.kind,
  model: provider.model,
  notes: provider.notes,
  apiKeyStored: false,
  status: 'unknown'
}));

const INITIAL_SYSTEM_MESSAGE: AgentMessage = {
  id: crypto.randomUUID(),
  role: 'system',
  content:
    'Antimatter is local-first. Bring your own provider key or custom endpoint. Performance depends on the connected provider or hardware you already control.',
  createdAt: new Date().toISOString()
};

export const useAppStore = create<AppState>((set) => ({
  theme: 'dark',
  workspacePath: null,
  workspaceEntries: [],
  openFiles: [],
  agentDockSide: 'right',
  bottomPanelTab: 'terminal',
  bottomPanelOpen: true,
  settingsOpen: false,
  providersOpen: false,
  commandPaletteOpen: false,
  welcomeVisible: true,
  recentProjects: [],
  providerConfigs: initialProviders,
  inlineCompletionsEnabled: true,
  learnerModeEnabled: false,
  activePersona: 'engineer',
  messages: [INITIAL_SYSTEM_MESSAGE],
  actionLogs: [],
  approvalRequests: [],
  paletteItems: [],

  // ─── New defaults ───
  isAgentRunning: false,
  fileWatcherEnabled: true,
  sessionTokens: 0,
  indexingProgress: { status: 'idle', current: 0, total: 0 },
  terminalOutputQueue: [],
  aiEdits: {},
  streamingMessage: '',
  agentBackups: {},

  // ─── Actions ───
  setTheme: (theme) => set({ theme }),
  setWorkspacePath: (workspacePath) => set({ workspacePath }),
  setWorkspaceEntries: (workspaceEntries) => set({ workspaceEntries }),
  setWorkspace: (workspacePath, workspaceEntries) => set({ workspacePath, workspaceEntries }),
  openFile: (file) =>
    set((state) => {
      const exists = state.openFiles.some((entry) => entry.path === file.path);
      return {
        openFiles: exists ? state.openFiles : [...state.openFiles, file],
        activeFilePath: file.path,
        welcomeVisible: false
      };
    }),
  closeFile: (path) =>
    set((state) => {
      const idx = state.openFiles.findIndex((f) => f.path === path);
      if (idx === -1) return state;
      const remaining = state.openFiles.filter((f) => f.path !== path);
      let nextActive = state.activeFilePath;
      if (state.activeFilePath === path) {
        nextActive = remaining.length > 0
          ? remaining[Math.min(idx, remaining.length - 1)]?.path
          : undefined;
      }
      return {
        openFiles: remaining,
        activeFilePath: nextActive,
        welcomeVisible: remaining.length === 0 && !nextActive
      };
    }),
  updateOpenFileContent: (path, content) =>
    set((state) => ({
      openFiles: state.openFiles.map((file) =>
        file.path === path ? { ...file, content, dirty: true } : file
      )
    })),
  saveFileLocallyMarked: (path) =>
    set((state) => ({
      openFiles: state.openFiles.map((file) =>
        file.path === path ? { ...file, dirty: false } : file
      )
    })),
  setAgentDockSide: (agentDockSide) => set({ agentDockSide }),
  setBottomPanelTab: (bottomPanelTab) => set({ bottomPanelTab }),
  toggleBottomPanel: () => set((state) => ({ bottomPanelOpen: !state.bottomPanelOpen })),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setProvidersOpen: (providersOpen) => set({ providersOpen }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setWelcomeVisible: (welcomeVisible) => set({ welcomeVisible }),
  setRecentProjects: (recentProjects) => set({ recentProjects }),
  setProviderConfigs: (providerConfigs) => set({ providerConfigs }),
  upsertProviderConfig: (provider) =>
    set((state) => ({
      providerConfigs: state.providerConfigs.some((entry) => entry.id === provider.id)
        ? state.providerConfigs.map((entry) => (entry.id === provider.id ? provider : entry))
        : [...state.providerConfigs, provider]
    })),
  appendMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  appendLogs: (logs) => set((state) => ({ actionLogs: [...logs, ...state.actionLogs].slice(0, 100) })),
  setApprovalRequests: (approvalRequests) => set({ approvalRequests }),
  setSelectedProviderId: (selectedProviderId) => set({ selectedProviderId }),
  registerPaletteItems: (paletteItems) => set({ paletteItems }),
  refreshGitStatus: async () => {
    const { workspacePath } = useAppStore.getState();
    if (!workspacePath) return;
    try {
      const { getGitStatus } = await import('@/lib/tauri');
      const status = await getGitStatus(workspacePath);
      set({ gitStatus: status });
    } catch (e) {
      set({ gitStatus: undefined });
    }
  },
  setPendingChange: (pendingChange) => set({ pendingChange }),
  setInlineCompletionsEnabled: (inlineCompletionsEnabled) => set({ inlineCompletionsEnabled }),
  setLearnerModeEnabled: (learnerModeEnabled) => set({ learnerModeEnabled }),
  setActivePersona: (activePersona) => set({ activePersona }),

  // ─── New Actions ───
  setIsAgentRunning: (isAgentRunning) => set({ isAgentRunning }),
  clearConversation: () => set({
    messages: [INITIAL_SYSTEM_MESSAGE],
    actionLogs: [],
    approvalRequests: [],
    isAgentRunning: false,
    sessionTokens: 0
  }),
  setFileWatcherEnabled: (fileWatcherEnabled) => set({ fileWatcherEnabled }),
  incrementSessionTokens: (tokens) => set((s) => ({ sessionTokens: s.sessionTokens + tokens })),
  setIndexingProgress: (indexingProgress) => set({ indexingProgress }),
  appendTerminalOutput: (text) => set((state) => ({ terminalOutputQueue: [...state.terminalOutputQueue, text] })),
  clearTerminalOutputQueue: () => set({ terminalOutputQueue: [] }),
  updateAIEdits: (path, stats) => set((state) => {
    const existing = state.aiEdits[path] || { addedLines: [], removedLines: [], addedCount: 0, removedCount: 0 };
    return {
      aiEdits: {
        ...state.aiEdits,
        [path]: {
          addedLines: stats.addedLines || existing.addedLines,
          removedLines: stats.removedLines || existing.removedLines,
          addedCount: existing.addedCount + (stats.addedCount || 0),
          removedCount: existing.removedCount + (stats.removedCount || 0)
        }
      }
    };
  }),
  clearAIEdits: () => set({ aiEdits: {} }),
  setStreamingMessage: (streamingMessage) => set({ streamingMessage }),
  setAgentBackups: (agentBackups) => set({ agentBackups }),
}));

export function deriveSettingsFromStore(state: AppState): AppSettings {
  return {
    theme: state.theme,
    agentDockSide: state.agentDockSide,
    defaultProviderId: state.selectedProviderId,
    telemetryEnabled: false,
    showWelcomeOnLaunch: state.welcomeVisible
  };
}
