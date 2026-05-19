import { useAppStore } from '@/store/appStore';
import { learnerEngine } from '@/services/LearnerEngine';

interface Props {
  open: boolean;
  onClose: () => void;
}

const KEYBINDINGS = [
  { id: 'mod+p', label: 'Command Palette', description: 'Open the command palette' },
  { id: 'mod+,', label: 'Settings', description: 'Open settings' },
  { id: 'mod+b', label: 'Toggle Terminal', description: 'Show/hide the bottom panel' },
  { id: 'mod+s', label: 'Save File', description: 'Save the active file' },
  { id: 'mod+w', label: 'Close File', description: 'Close the active tab' },
  { id: 'mod+n', label: 'New File', description: 'Create a new untitled file' },
];

export function SettingsDrawer({ open, onClose }: Props) {
  const { 
    theme, setTheme, 
    agentDockSide, setAgentDockSide, 
    bottomPanelOpen, toggleBottomPanel,
    providerConfigs, selectedProviderId, setSelectedProviderId,
    inlineCompletionsEnabled, setInlineCompletionsEnabled,
    learnerModeEnabled, setLearnerModeEnabled,
    fileWatcherEnabled, setFileWatcherEnabled,
    clearConversation
  } = useAppStore();

  if (!open) return null;

  const isMac = navigator.platform.toLowerCase().includes('mac');
  const modKey = isMac ? '⌘' : 'Ctrl';

  return (
    <div className="overlay">
      <div className="modal drawer" style={{ maxHeight: 'calc(100vh - 48px)', overflow: 'auto' }}>
        <div className="panel__header">
          <div>
            <h3>Settings</h3>
          </div>
          <button className="button-icon subtle" onClick={onClose}>
            ✕
          </button>
        </div>

        <section className="settings-section">
          <h4 className="settings-group-title">Appearance</h4>
          <div className="settings-group">
            <label className="settings-block">
              <span className="settings-label-title">Color Theme</span>
              <span className="settings-label-desc">Select the application theme</span>
              <select className="settings-select" value={theme} onChange={(event) => setTheme(event.target.value as 'dark' | 'light')}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
          </div>

          <h4 className="settings-group-title">Layout</h4>
          <div className="settings-group">
            <label className="settings-block">
              <span className="settings-label-title">Agent Panel Location</span>
              <span className="settings-label-desc">Where the AI assistant is docked</span>
              <select className="settings-select" value={agentDockSide} onChange={(event) => setAgentDockSide(event.target.value as 'left' | 'right')}>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </label>
          </div>

          <h4 className="settings-group-title">AI Assistant</h4>
          <div className="settings-group">
            <label className="settings-block">
              <span className="settings-label-title">Default Provider</span>
              <span className="settings-label-desc">Select which AI provider powers the agent</span>
              <select className="settings-select" value={selectedProviderId || ''} onChange={(event) => setSelectedProviderId(event.target.value)}>
                <option value="" disabled>Select a provider...</option>
                {providerConfigs.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.label} ({provider.model})
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-row" style={{ marginTop: '12px' }}>
              <input type="checkbox" checked={inlineCompletionsEnabled} onChange={(e) => setInlineCompletionsEnabled(e.target.checked)} />
              <span>Enable Inline AI Autocomplete (Ghost Text)</span>
            </label>
            <label className="checkbox-row learner-mode-toggle" style={{ marginTop: '8px' }}>
              <input 
                type="checkbox" 
                checked={learnerModeEnabled} 
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setLearnerModeEnabled(enabled);
                  if (!enabled) {
                    learnerEngine.clearAll();
                  }
                  // Learner mode takes priority over inline completions
                  if (enabled && inlineCompletionsEnabled) {
                    setInlineCompletionsEnabled(false);
                  }
                }} 
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span>Learner Mode</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  AI generates code from filenames and teaches you to write it token-by-token
                </span>
              </div>
            </label>
            <label className="checkbox-row" style={{ marginTop: '8px' }}>
              <input type="checkbox" checked={bottomPanelOpen} onChange={toggleBottomPanel} />
              <span>Show bottom terminal panel by default</span>
            </label>
            <label className="checkbox-row" style={{ marginTop: '8px' }}>
              <input type="checkbox" checked={fileWatcherEnabled} onChange={(e) => setFileWatcherEnabled(e.target.checked)} />
              <span>Auto-refresh file explorer (5s polling)</span>
            </label>
            <div style={{ marginTop: '12px' }}>
              <button className="button" onClick={clearConversation}>
                Clear Conversation History
              </button>
            </div>
          </div>

          <h4 className="settings-group-title">Keyboard Shortcuts</h4>
          <div className="settings-group">
            <div className="keybinding-list">
              {KEYBINDINGS.map((kb) => (
                <div key={kb.id} className="keybinding-row">
                  <div className="keybinding-info">
                    <span className="keybinding-label">{kb.label}</span>
                    <span className="keybinding-desc">{kb.description}</span>
                  </div>
                  <kbd className="keybinding-keys">
                    {kb.id.replace('mod', modKey).split('+').map((key, i) => (
                      <span key={i}>
                        {i > 0 && <span className="keybinding-sep">+</span>}
                        <span className="keybinding-key">{key.toUpperCase()}</span>
                      </span>
                    ))}
                  </kbd>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
              Keybinding customization coming soon. Use the Command Palette ({modKey}+P) to access all commands.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
