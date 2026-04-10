import React, { useEffect, useMemo } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { clsx } from 'clsx';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { CommandPalette } from './components/palette/CommandPalette';
import { Toolbar } from './components/layout/Toolbar';
import { FileExplorer } from './components/explorer/FileExplorer';
import { EditorShell } from './components/editor/EditorShell';
import { BottomPanel } from './components/terminal/BottomPanel';
import { AgentPanel } from './components/agents/AgentPanel';
import { StatusBar } from './components/layout/StatusBar';
import { SettingsDrawer } from './components/settings/SettingsDrawer';
import { ProviderSettingsModal } from './components/providers/ProviderSettingsModal';
import { DiffReviewModal } from './components/editor/DiffReviewModal';
import { WelcomeScreen } from './components/welcome/WelcomeScreen';
import { StartupMenu } from './components/layout/StartupMenu';
import { SearchPanel } from './components/explorer/SearchPanel';
import { SourceControlPanel } from './components/explorer/SourceControlPanel';
import { codebaseIndexer } from './services/CodebaseIndexer';
import { runAgentLoop } from '@antimatter/agents';
import { useAppStore, deriveSettingsFromStore, initialProviders } from './store/appStore';
import {
  getRecentProjects,
  loadProviders,
  loadSettings,
  saveSettings,
  writeWorkspaceFile
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
    workspacePath,
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
    setWelcomeVisible,
    setPendingChange,
    workspaceEntries,
    activePersona
  } = useAppStore();

  const [sidebarTab, setSidebarTab] = React.useState<'explorer' | 'search' | 'source'>('explorer');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Index workspace for semantic search
  useEffect(() => {
    if (workspacePath && workspaceEntries.length > 0) {
       const runIndexing = async () => {
         const files = workspaceEntries
           .filter((e: any) => !e.isDirectory && !e.path.includes('.git') && (e.path.endsWith('.ts') || e.path.endsWith('.tsx') || e.path.endsWith('.rs')))
           .slice(0, 50);

         const fileData = await Promise.all(
           files.map(async (f: any) => ({
             path: f.path,
             content: await (await import('./lib/tauri')).readWorkspaceFile(f.path)
           }))
         );
         
         await codebaseIndexer.index(fileData);
       };
       runIndexing();
    }
  }, [workspacePath, workspaceEntries]);

  useEffect(() => {
    void Promise.all([loadSettings(), getRecentProjects(), loadProviders()])
      .then(([settings, recentProjects, providers]) => {
        setTheme(settings.theme);
        setAgentDockSide(settings.agentDockSide);
        setRecentProjects(recentProjects);
        if (providers.length > 0) {
          const mergedProviders = initialProviders.map((defaultConfig) => {
            const saved = providers.find((p) => p.id === defaultConfig.id || p.kind === defaultConfig.kind);
            return saved ? { ...defaultConfig, ...saved } : defaultConfig;
          });
          const customProviders = providers.filter(
            (p) => !initialProviders.some((def) => def.id === p.id || def.kind === p.kind)
          );
          setProviderConfigs([...mergedProviders, ...customProviders]);
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

    const context = {
      provider: selectedProvider,
      messages: [...messages, userMessage],
      workspacePath: workspacePath || undefined,
      persona: activePersona,
      createChat: async (request: any, config: any) => {
        const tauri = await import('./lib/tauri');
        return await tauri.chatWithProvider(config.id, request.messages);
      }
    };

    const result = await runAgentLoop(context, async (toolId, args) => {
      // Dynamic imports to keep App.tsx clean and avoid circularity
      const tauri = await import('./lib/tauri');
      
      switch (toolId) {
        case 'read-file':
          return await tauri.readWorkspaceFile(args.path);
        case 'write-file':
        case 'patch-file':
          // Approvals are handled by the agent loop return, but we need to return something here
          // if it's a read-only request for the diffing
          return await tauri.readWorkspaceFile(args.path);
        case 'search-workspace':
          if (!workspacePath) throw new Error('No workspace open');
          return await tauri.searchWorkspace(workspacePath, args.query);
        case 'query-codebase':
          return await codebaseIndexer.search(args.query);
        case 'terminal-exec':
          if (!workspacePath) throw new Error('No workspace open');
          return await tauri.executeTerminal({ cwd: workspacePath, command: args.command });
        default:
          throw new Error(`Tool ${toolId} not implemented in runtime.`);
      }
    });

    appendLogs(result.logs);
    setApprovalRequests(result.approvalRequests);
    appendMessage(result.reply);

    // If there's a diff in the FIRST approval request (standard workflow), surface it immediately
    const firstWithDiff = result.approvalRequests.find(r => r.diff);
    if (firstWithDiff?.diff) {
      setPendingChange(firstWithDiff.diff);
    }
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
            <div className="sidebar-tabs">
              <button 
                className={clsx('sidebar-tab', { active: sidebarTab === 'explorer' })}
                onClick={() => setSidebarTab('explorer')}
              >
                Explorer
              </button>
              <button 
                className={clsx('sidebar-tab', { active: sidebarTab === 'search' })}
                onClick={() => setSidebarTab('search')}
              >
                Search
              </button>
              <button 
                className={clsx('sidebar-tab', { active: sidebarTab === 'source' })}
                onClick={() => setSidebarTab('source')}
              >
                Source
              </button>
            </div>
            {sidebarTab === 'explorer' && <FileExplorer />}
            {sidebarTab === 'search' && <SearchPanel />}
            {sidebarTab === 'source' && <SourceControlPanel />}
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
      <DiffReviewModal />
      {workspacePath === undefined && <StartupMenu />}
    </div>
  );
}
