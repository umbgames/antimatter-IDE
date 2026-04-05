import { useEffect, useMemo } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { APP_NAME } from '@antimatter/shared';
import { runSingleAgent } from '@antimatter/agents';
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
    providerConfigs,
    selectedProviderId,
    messages,
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
    saveFileLocallyMarked
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

  const saveActiveFile = async () => {
    const file = openFiles.find((entry) => entry.path === activeFilePath);
    if (!file) return;
    await writeWorkspaceFile(file.path, file.content);
    saveFileLocallyMarked(file.path);
  };

  useKeyboardShortcuts({
    'mod+p': () => setCommandPaletteOpen(true),
    'mod+,': () => setSettingsOpen(true),
    'mod+b': () => useAppStore.getState().toggleBottomPanel(),
    'mod+s': () => {
      void saveActiveFile();
    }
  });

  const paletteItems = useMemo(
    () => [
      { id: 'open-settings', title: 'Open Settings', category: 'General', action: () => setSettingsOpen(true) },
      { id: 'open-providers', title: 'Open Provider Settings', category: 'AI', action: () => setProvidersOpen(true) },
      { id: 'toggle-theme', title: 'Toggle Theme', category: 'View', action: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
      { id: 'move-agent-left', title: 'Dock Agent Panel Left', category: 'Layout', action: () => setAgentDockSide('left') },
      { id: 'move-agent-right', title: 'Dock Agent Panel Right', category: 'Layout', action: () => setAgentDockSide('right') }
    ],
    [setAgentDockSide, setProvidersOpen, setSettingsOpen, setTheme, theme]
  );

  useEffect(() => {
    registerPaletteItems(paletteItems);
  }, [paletteItems, registerPaletteItems]);

  const onAgentPrompt = async (prompt: string) => {
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: prompt,
      createdAt: new Date().toISOString()
    };
    appendMessage(userMessage);
    const result = await runSingleAgent({ provider: selectedProvider, messages: [...messages, userMessage] });
    appendMessage(result.reply);
    appendLogs(result.logs);
    setApprovalRequests(result.approvalRequests);
  };

  const persistSettings = async () => {
    await saveSettings(deriveSettingsFromStore(useAppStore.getState()));
  };

  useEffect(() => {
    void persistSettings();
  }, [theme, agentDockSide]);

  return (
    <div className="app-shell">
      <TitleBar title={APP_NAME} />
      <Toolbar onOpenSettings={() => setSettingsOpen(true)} onOpenProviders={() => setProvidersOpen(true)} />

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
              <PanelResizeHandle className="resize-handle horizontal" />
              <Panel defaultSize={24} minSize={14} collapsible>
                <BottomPanel />
              </Panel>
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
