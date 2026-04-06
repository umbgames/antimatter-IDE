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

interface AppState {
  theme: ThemeMode;
  workspacePath?: string;
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
  setTheme: (theme: ThemeMode) => void;
  setWorkspacePath: (path?: string) => void;
  setWorkspaceEntries: (entries: WorkspaceEntry[]) => void;
  openFile: (file: OpenFile) => void;
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
  inlineCompletionsEnabled: boolean;
  setInlineCompletionsEnabled: (enabled: boolean) => void;
  activePersona: 'engineer' | 'architect' | 'qa';
  setActivePersona: (persona: 'engineer' | 'architect' | 'qa') => void;
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

export const useAppStore = create<AppState>((set) => ({
  theme: 'dark',
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
  activePersona: 'engineer',
  messages: [
    {
      id: crypto.randomUUID(),
      role: 'system',
      content:
        'Antimatter is local-first. Bring your own provider key or custom endpoint. Performance depends on the connected provider or hardware you already control.',
      createdAt: new Date().toISOString()
    }
  ],
  actionLogs: [],
  approvalRequests: [],
  paletteItems: [],
  setTheme: (theme) => set({ theme }),
  setWorkspacePath: (workspacePath) => set({ workspacePath }),
  setWorkspaceEntries: (workspaceEntries) => set({ workspaceEntries }),
  openFile: (file) =>
    set((state) => {
      const exists = state.openFiles.some((entry) => entry.path === file.path);
      return {
        openFiles: exists ? state.openFiles : [...state.openFiles, file],
        activeFilePath: file.path,
        welcomeVisible: false
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
  setActivePersona: (activePersona) => set({ activePersona })
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
