import React, { useEffect, useMemo, useCallback, useRef } from 'react';
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
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { codebaseIndexer } from './services/CodebaseIndexer';
import { runAgentLoop } from '@antimatter/agents';
import { useAppStore, deriveSettingsFromStore, initialProviders } from './store/appStore';
import {
  getRecentProjects,
  loadProviders,
  loadSettings,
  saveSettings,
  writeWorkspaceFile,
  readDirectory
} from './lib/tauri';

export function App() {
  // Use specific selectors to prevent re-rendering when logs/messages change
  const theme = useAppStore(s => s.theme);
  const agentDockSide = useAppStore(s => s.agentDockSide);
  const settingsOpen = useAppStore(s => s.settingsOpen);
  const providersOpen = useAppStore(s => s.providersOpen);
  const commandPaletteOpen = useAppStore(s => s.commandPaletteOpen);
  const welcomeVisible = useAppStore(s => s.welcomeVisible);
  const openFiles = useAppStore(s => s.openFiles);
  const activeFilePath = useAppStore(s => s.activeFilePath);
  const workspacePath = useAppStore(s => s.workspacePath);
  const workspaceEntries = useAppStore(s => s.workspaceEntries);
  const providerConfigs = useAppStore(s => s.providerConfigs);
  const selectedProviderId = useAppStore(s => s.selectedProviderId);
  const bottomPanelOpen = useAppStore(s => s.bottomPanelOpen);

  const setTheme = useAppStore(s => s.setTheme);
  const setAgentDockSide = useAppStore(s => s.setAgentDockSide);
  const setSettingsOpen = useAppStore(s => s.setSettingsOpen);
  const setProvidersOpen = useAppStore(s => s.setProvidersOpen);
  const setCommandPaletteOpen = useAppStore(s => s.setCommandPaletteOpen);
  const setRecentProjects = useAppStore(s => s.setRecentProjects);
  const setProviderConfigs = useAppStore(s => s.setProviderConfigs);
  const setSelectedProviderId = useAppStore(s => s.setSelectedProviderId);
  const registerPaletteItems = useAppStore(s => s.registerPaletteItems);
  const appendMessage = useAppStore(s => s.appendMessage);
  const appendLogs = useAppStore(s => s.appendLogs);
  const setApprovalRequests = useAppStore(s => s.setApprovalRequests);
  const saveFileLocallyMarked = useAppStore(s => s.saveFileLocallyMarked);
  const toggleBottomPanel = useAppStore(s => s.toggleBottomPanel);
  const setWelcomeVisible = useAppStore(s => s.setWelcomeVisible);
  const setPendingChange = useAppStore(s => s.setPendingChange);
  const setIsAgentRunning = useAppStore(s => s.setIsAgentRunning);
  const setWorkspaceEntries = useAppStore(s => s.setWorkspaceEntries);
  const clearConversation = useAppStore(s => s.clearConversation);

  const [sidebarTab, setSidebarTab] = React.useState<'explorer' | 'search' | 'source'>('explorer');
  const indexingVersion = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Index workspace for semantic search
  useEffect(() => {
    if (workspacePath && workspaceEntries.length > 0) {
       const version = ++indexingVersion.current;
       const runIndexing = async () => {
         try {
           // Small delay to let the UI settle after opening a workspace
           await new Promise(r => setTimeout(r, 1000));
           if (version !== indexingVersion.current) return;

           const files = workspaceEntries
             .filter((e: any) => !e.isDirectory && !e.path.includes('.git') && 
               (e.path.endsWith('.ts') || e.path.endsWith('.tsx') || e.path.endsWith('.rs') || e.path.endsWith('.js') || e.path.endsWith('.py')))
             .slice(0, 50);

           const tauri = await import('./lib/tauri');
           const fileData = await Promise.all(
             files.map(async (f: any) => ({
               path: f.path,
               content: await tauri.readWorkspaceFile(f.path)
             }))
           );
           
           if (version === indexingVersion.current) {
             await codebaseIndexer.index(fileData);
           }
         } catch (err) {
           console.error('Indexing failed:', err);
         }
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

  const selectedProvider = useMemo(() => 
    providerConfigs.find((provider) => provider.id === selectedProviderId),
    [providerConfigs, selectedProviderId]
  );

  /* ─── File Actions ─── */
  const saveActiveFile = useCallback(async () => {
    const file = openFiles.find((entry) => entry.path === activeFilePath);
    if (!file) return;
    await writeWorkspaceFile(file.path, file.content);
    saveFileLocallyMarked(file.path);
  }, [activeFilePath, openFiles, saveFileLocallyMarked]);

  const closeActiveFile = useCallback(() => {
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
  }, []);

  const closeAllFiles = useCallback(() => {
    useAppStore.setState({
      openFiles: [],
      activeFilePath: undefined,
      welcomeVisible: true
    });
  }, []);

  const newFile = useCallback(() => {
    const id = crypto.randomUUID().slice(0, 8);
    const file = {
      path: `untitled-${id}`,
      name: `untitled-${id}`,
      language: 'plaintext',
      content: '',
      dirty: true
    };
    useAppStore.getState().openFile(file);
  }, []);

  const openFolder = useCallback(() => {
    const input = document.querySelector('.explorer-pathbar input') as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.select();
    }
  }, []);

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
      { id: 'welcome', title: 'Help: Show Welcome', category: 'Help', action: () => setWelcomeVisible(true) },
      { id: 'clear-chat', title: 'Agent: Clear Conversation', category: 'AI', action: clearConversation }
    ],
    [setAgentDockSide, setProvidersOpen, setSettingsOpen, setTheme, theme, bottomPanelOpen, toggleBottomPanel, setWelcomeVisible, newFile, saveActiveFile, closeActiveFile]
  );

  useEffect(() => {
    registerPaletteItems(paletteItems);
  }, [paletteItems, registerPaletteItems]);

  /* ─── File Watcher (auto-refresh explorer) ─── */
  useEffect(() => {
    if (!workspacePath) return;
    const interval = setInterval(async () => {
      try {
        const entries = await readDirectory(workspacePath);
        setWorkspaceEntries(entries);
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [workspacePath, setWorkspaceEntries]);

  /* ─── Agent ─── */
  const onAgentPrompt = useCallback(async (prompt: string) => {
    const now = new Date().toISOString();
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: prompt,
      createdAt: now
    };
    appendMessage(userMessage);
    setApprovalRequests([]);
    setIsAgentRunning(true);

    const state = useAppStore.getState();
    const context = {
      provider: selectedProvider,
      messages: [...state.messages],
      workspacePath: state.workspacePath || undefined,
      persona: state.activePersona,
      createChat: async (request: any, config: any) => {
        const tauri = await import('./lib/tauri');
        return await tauri.chatWithProvider(config.id, request.messages, request.tools);
      }
    };

    const result = await runAgentLoop(context, async (toolId, args) => {
      const tauri = await import('./lib/tauri');
      const currentPath = useAppStore.getState().workspacePath;
      
      switch (toolId) {
        case 'read-file':
          return await tauri.readWorkspaceFile(args.path);
        case 'write-file':
          await tauri.writeWorkspaceFile(args.path, args.content || '');
          return `Successfully wrote to ${args.path}`;
        case 'patch-file': {
          const original = await tauri.readWorkspaceFile(args.path);
          let proposed = original;
          if (Array.isArray(args.replacements)) {
            for (const r of args.replacements) {
              if (r.search && typeof r.replace === 'string') {
                proposed = proposed.replace(r.search, r.replace);
              }
            }
          }
          await tauri.writeWorkspaceFile(args.path, proposed);
          return `Successfully patched ${args.path}`;
        }
        case 'delete-file':
          return await tauri.deleteWorkspaceFile(args.path);
        case 'rename-file':
          return await tauri.renameWorkspaceFile(args.from, args.to);
        case 'list-directory': {
          if (args.recursive) {
            return await tauri.listDirectoryRecursive(args.path || currentPath || '', args.maxDepth);
          }
          return await tauri.readDirectory(args.path || currentPath || '');
        }
        case 'create-directory':
          return await tauri.createWorkspaceDirectory(args.path);
        case 'search-workspace':
          if (!currentPath) throw new Error('No workspace open');
          return await tauri.searchWorkspace(currentPath, args.query);
        case 'grep-search':
          if (!currentPath) throw new Error('No workspace open');
          return await tauri.grepSearch(currentPath, args.pattern, args.include, args.path);
        case 'query-codebase':
          return await codebaseIndexer.search(args.query);
        case 'terminal-exec':
          if (!currentPath) throw new Error('No workspace open');
          return await tauri.executeTerminal({ cwd: currentPath, command: args.command });
        case 'analyze-file':
          return await tauri.analyzeFile(args.path);
        case 'analyze-project':
          if (!currentPath) throw new Error('No workspace open');
          return await tauri.analyzeProject(currentPath);
        case 'analyze-dependencies':
          if (!currentPath) throw new Error('No workspace open');
          return await tauri.analyzeDependencies(currentPath, args.path);
        case 'get-file-info':
          return await tauri.getFileInfo(args.path);
        case 'fetch-url':
          return await tauri.fetchUrl(args.url);
        case 'bulk-replace':
          if (!currentPath) throw new Error('No workspace open');
          return await tauri.bulkReplace(currentPath, args.search, args.replace, args.include, args.path);
        default:
          throw new Error(`Tool "${toolId}" is not implemented.`);
      }
    });

    appendLogs(result.logs);
    setApprovalRequests(result.approvalRequests);
    appendMessage(result.reply);
    setIsAgentRunning(false);

    const firstWithDiff = result.approvalRequests.find(r => r.diff);
    if (firstWithDiff?.diff) {
      setPendingChange(firstWithDiff.diff);
    }

    // Auto-refresh workspace entries after agent finishes (it may have created/deleted files)
    if (workspacePath) {
      readDirectory(workspacePath).then(entries => setWorkspaceEntries(entries)).catch(() => {});
    }
  }, [selectedProvider, appendMessage, appendLogs, setApprovalRequests, setPendingChange, setIsAgentRunning, workspacePath, setWorkspaceEntries]);

  const onApproveTool = useCallback(async (request: any) => {
    setApprovalRequests(useAppStore.getState().approvalRequests.filter(r => r.id !== request.id));
    if (!request.toolCall) return;
    
    const tauri = await import('./lib/tauri');
    const { toolId, args } = request.toolCall;
    
    let result;
    try {
      if (toolId === 'write-file' || toolId === 'patch-file') {
        const proposedContent = request.diff?.proposed ?? args.content ?? '';
        await tauri.writeWorkspaceFile(args.path, proposedContent);
        result = `Successfully wrote to ${args.path}`;
      } else if (toolId === 'terminal-exec') {
        const currentPath = useAppStore.getState().workspacePath;
        if (!currentPath) throw new Error('No workspace open');
        result = await tauri.executeTerminal({ cwd: currentPath, command: args.command });
      } else {
        result = `Tool ${toolId} executed`;
      }
      void onAgentPrompt(`<observation>\n${JSON.stringify(result, null, 2)}\n</observation>`);
    } catch (err: any) {
      void onAgentPrompt(`<error>\nTool failed: ${err.message || String(err)}\n</error>`);
    }
  }, [setApprovalRequests, onAgentPrompt]);

  const onRejectTool = useCallback((request: any) => {
    setApprovalRequests(useAppStore.getState().approvalRequests.filter(r => r.id !== request.id));
    void onAgentPrompt(`<error>\nUser rejected the tool execution.\n</error>`);
  }, [setApprovalRequests, onAgentPrompt]);

  /* ─── Persist Settings ─── */
  const persistSettings = useCallback(async () => {
    await saveSettings(deriveSettingsFromStore(useAppStore.getState()));
  }, []);

  useEffect(() => {
    void persistSettings();
  }, [theme, agentDockSide, persistSettings]);

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
        <PanelGroup direction="horizontal">
          {agentDockSide === 'left' && (
            <>
              <Panel defaultSize={22} minSize={16}>
                <ErrorBoundary>
                   <AgentPanel onSubmit={onAgentPrompt} onApprove={onApproveTool} onReject={onRejectTool} />
                </ErrorBoundary>
              </Panel>
              <PanelResizeHandle className="resize-handle vertical" />
            </>
          )}

          <Panel defaultSize={18} minSize={12}>
            <div className="sidebar-tabs">
              {(['explorer', 'search', 'source'] as const).map(tab => (
                 <button 
                   key={tab}
                   className={clsx('sidebar-tab', { active: sidebarTab === tab })}
                   onClick={() => setSidebarTab(tab)}
                 >
                   {tab.charAt(0).toUpperCase() + tab.slice(1)}
                 </button>
              ))}
            </div>
            <ErrorBoundary>
               {sidebarTab === 'explorer' && <FileExplorer />}
               {sidebarTab === 'search' && <SearchPanel />}
               {sidebarTab === 'source' && <SourceControlPanel />}
            </ErrorBoundary>
          </Panel>
          <PanelResizeHandle className="resize-handle vertical" />

          <Panel>
            <PanelGroup direction="vertical">
              <Panel>
                <ErrorBoundary>
                   {welcomeVisible && openFiles.length === 0 ? <WelcomeScreen /> : <EditorShell />}
                </ErrorBoundary>
              </Panel>
              {bottomPanelOpen && (
                <>
                  <PanelResizeHandle className="resize-handle horizontal" />
                  <Panel defaultSize={24} minSize={14} collapsible>
                    <ErrorBoundary>
                       <BottomPanel />
                    </ErrorBoundary>
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

          {agentDockSide === 'right' && (
            <>
              <PanelResizeHandle className="resize-handle vertical" />
              <Panel defaultSize={24} minSize={16}>
                <ErrorBoundary>
                   <AgentPanel onSubmit={onAgentPrompt} onApprove={onApproveTool} onReject={onRejectTool} />
                </ErrorBoundary>
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
      {workspacePath === null && <StartupMenu />}
    </div>
  );
}
