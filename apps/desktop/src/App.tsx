import { useEffect, useMemo } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { APP_NAME } from '@antimatter/shared';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { CommandPalette } from './components/palette/CommandPalette';
import { TitleBar } from './components/layout/TitleBar';
import { Toolbar } from './components/layout/Toolbar';
import { FileExplorer } from './components/explorer/FileExplorer';
import { EditorShell } from './components/editor/EditorShell';
import { BottomPanel } from './components/terminal/BottomPanel';
import { AgentPanel } from './components/agents/AgentPanel';
import { StatusBar } from './components/layout/StatusBar';
import { SettingsDrawer } from './components/settings/SettingsDrawer';
import { ProviderSettingsModal } from './components/providers/ProviderSettingsModal';
import { WelcomeScreen } from './components/welcome/WelcomeScreen';
import { useAppStore, deriveSettingsFromStore } from './store/appStore';
import {
  getRecentProjects,
  loadProviders,
  loadSettings,
  saveSettings,
  writeWorkspaceFile,
  chatWithProvider
} from './lib/tauri';

export function App() {
  const {
    theme,
    agentDockSide,
    settingsOpen,
    providersOpen,
    commandPaletteOpen,
    welcomeVisible,
    openFiles,
    activeFilePath,
    providerConfigs,
    selectedProviderId,
    messages,
    bottomPanelOpen,
    setTheme,
    setAgentDockSide,
    setSettingsOpen,
    setProvidersOpen,
    setCommandPaletteOpen,
    setRecentProjects,
    setProviderConfigs,
    setSelectedProviderId,
    registerPaletteItems,
    appendMessage,
    appendLogs,
    setApprovalRequests,
    saveFileLocallyMarked,
    toggleBottomPanel,
    setWelcomeVisible
  } = useAppStore();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    void Promise.all([loadSettings(), getRecentProjects(), loadProviders()])
      .then(([settings, recentProjects, providers]) => {
        setTheme(settings.theme);
        setAgentDockSide(settings.agentDockSide);
        setRecentProjects(recentProjects);
        if (providers.length > 0) {
          setProviderConfigs(providers);
        }
        if (settings.defaultProviderId) {
          setSelectedProviderId(settings.defaultProviderId);
        }
      })
      .catch(() => undefined);
  }, [setAgentDockSide, setProviderConfigs, setRecentProjects, setSelectedProviderId, setTheme]);

  const selectedProvider = providerConfigs.find((provider) => provider.id === selectedProviderId);

  /* ─── File Actions ─── */
  const saveActiveFile = async () => {
    const file = openFiles.find((entry) => entry.path === activeFilePath);
    if (!file) return;
    await writeWorkspaceFile(file.path, file.content);
    saveFileLocallyMarked(file.path);
  };

  const closeActiveFile = () => {
    const state = useAppStore.getState();
    const files = state.openFiles;
    const activePath = state.activeFilePath;
    if (!activePath || files.length === 0) return;
    const idx = files.findIndex((f) => f.path === activePath);
    const remaining = files.filter((f) => f.path !== activePath);
    const nextActive = remaining.length > 0
      ? remaining[Math.min(idx, remaining.length - 1)]?.path
      : undefined;
    useAppStore.setState({
      openFiles: remaining,
      activeFilePath: nextActive,
      welcomeVisible: remaining.length === 0
    });
  };

  const closeAllFiles = () => {
    useAppStore.setState({
      openFiles: [],
      activeFilePath: undefined,
      welcomeVisible: true
    });
  };

  const newFile = () => {
    const id = crypto.randomUUID().slice(0, 8);
    const file = {
      path: `untitled-${id}`,
      name: `untitled-${id}`,
      language: 'plaintext',
      content: '',
      dirty: true
    };
    useAppStore.getState().openFile(file);
  };

  const openFolder = () => {
    // Focus the explorer path input — the FileExplorer handles the actual folder loading
    const input = document.querySelector('.explorer-pathbar input') as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.select();
    }
  };

  /* ─── Keyboard Shortcuts ─── */
  useKeyboardShortcuts({
    'mod+p': () => setCommandPaletteOpen(true),
    'mod+,': () => setSettingsOpen(true),
    'mod+b': () => toggleBottomPanel(),
    'mod+s': () => { void saveActiveFile(); },
    'mod+w': () => closeActiveFile(),
    'mod+n': () => newFile()
  });

  /* ─── Command Palette Items ─── */
  const paletteItems = useMemo(
    () => [
      { id: 'open-settings', title: 'Preferences: Open Settings', category: 'General', action: () => setSettingsOpen(true) },
      { id: 'open-providers', title: 'Providers: Configure', category: 'AI', action: () => setProvidersOpen(true) },
      { id: 'toggle-theme', title: `View: Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`, category: 'View', action: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
      { id: 'move-agent-left', title: 'Layout: Dock Agent Panel Left', category: 'Layout', action: () => setAgentDockSide('left') },
      { id: 'move-agent-right', title: 'Layout: Dock Agent Panel Right', category: 'Layout', action: () => setAgentDockSide('right') },
      { id: 'new-file', title: 'File: New File', category: 'File', action: newFile },
      { id: 'save-file', title: 'File: Save', category: 'File', action: () => { void saveActiveFile(); } },
      { id: 'close-file', title: 'File: Close File', category: 'File', action: closeActiveFile },
      { id: 'toggle-terminal', title: `View: ${bottomPanelOpen ? 'Hide' : 'Show'} Terminal`, category: 'View', action: toggleBottomPanel },
      { id: 'welcome', title: 'Help: Show Welcome', category: 'Help', action: () => setWelcomeVisible(true) }
    ],
    [setAgentDockSide, setProvidersOpen, setSettingsOpen, setTheme, theme, bottomPanelOpen, toggleBottomPanel, setWelcomeVisible]
  );

  useEffect(() => {
    registerPaletteItems(paletteItems);
  }, [paletteItems, registerPaletteItems]);

  /* ─── Agent ─── */
  const onAgentPrompt = async (prompt: string) => {
    const now = new Date().toISOString();
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: prompt,
      createdAt: now
    };
    appendMessage(userMessage);

    const plannedLogs = [
      {
        id: crypto.randomUUID(),
        kind: 'plan' as const,
        title: 'Planned next step',
        detail: selectedProvider
          ? `Routing through ${selectedProvider.label} · ${selectedProvider.model}`
          : 'No provider selected — configure one first.',
        createdAt: now
      }
    ];
    appendLogs(plannedLogs);
    setApprovalRequests([]);

    let content: string;
    if (!selectedProvider) {
      content = 'No provider configured. Go to Agents → Configure Providers to set one up.';
    } else {
      try {
        content = await chatWithProvider(
          selectedProvider.id,
          [...messages, userMessage].map((message) => ({ role: message.role, content: message.content }))
        );
      } catch (error) {
        content = error instanceof Error ? error.message : 'Provider request failed.';
        appendLogs([
          {
            id: crypto.randomUUID(),
            kind: 'error',
            title: 'Provider error',
            detail: content,
            createdAt: new Date().toISOString()
          }
        ]);
      }
    }

    appendMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      createdAt: new Date().toISOString()
    });
  };

  /* ─── Persist Settings ─── */
  const persistSettings = async () => {
    await saveSettings(deriveSettingsFromStore(useAppStore.getState()));
  };

  useEffect(() => {
    void persistSettings();
  }, [theme, agentDockSide]);

  /* ─── Render ─── */
  return (
    <div className="app-shell">
      <TitleBar title={APP_NAME} />
      <Toolbar
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenProviders={() => setProvidersOpen(true)}
        onOpenFolder={openFolder}
        onSaveFile={() => { void saveActiveFile(); }}
        onNewFile={newFile}
        onCloseFile={closeActiveFile}
        onCloseAllFiles={closeAllFiles}
        onToggleTerminal={toggleBottomPanel}
        onRunCommand={() => {
          if (!bottomPanelOpen) toggleBottomPanel();
          useAppStore.getState().setBottomPanelTab('terminal');
        }}
      />

      <div className="workspace-shell">
        <PanelGroup autoSaveId="antimatter-root-layout" direction="horizontal">
          {agentDockSide === 'left' && (
            <>
              <Panel defaultSize={22} minSize={16}>
                <AgentPanel onSubmit={onAgentPrompt} />
              </Panel>
              <PanelResizeHandle className="resize-handle vertical" />
            </>
          )}

          <Panel defaultSize={18} minSize={12}>
            <FileExplorer />
          </Panel>
          <PanelResizeHandle className="resize-handle vertical" />

          <Panel>
            <PanelGroup autoSaveId="antimatter-center-layout" direction="vertical">
              <Panel>
                {welcomeVisible && openFiles.length === 0 ? <WelcomeScreen /> : <EditorShell />}
              </Panel>
              {bottomPanelOpen && (
                <>
                  <PanelResizeHandle className="resize-handle horizontal" />
                  <Panel defaultSize={24} minSize={14} collapsible>
                    <BottomPanel />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

          {agentDockSide === 'right' && (
            <>
              <PanelResizeHandle className="resize-handle vertical" />
              <Panel defaultSize={24} minSize={16}>
                <AgentPanel onSubmit={onAgentPrompt} />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      <StatusBar onToggleProviders={() => setProvidersOpen(true)} />
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ProviderSettingsModal open={providersOpen} onClose={() => setProvidersOpen(false)} />
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </div>
  );
}
