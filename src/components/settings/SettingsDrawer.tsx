import { useAppStore } from '@/store/appStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ open, onClose }: Props) {
  const { 
    theme, setTheme, 
    agentDockSide, setAgentDockSide, 
    bottomPanelOpen, toggleBottomPanel,
    providerConfigs, selectedProviderId, setSelectedProviderId,
    inlineCompletionsEnabled, setInlineCompletionsEnabled
  } = useAppStore();

  if (!open) return null;

  return (
    <div className="overlay">
      <div className="modal drawer">
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
            <label className="checkbox-row" style={{ marginTop: '12px' }}>
              <input type="checkbox" checked={bottomPanelOpen} onChange={toggleBottomPanel} />
              <span>Show bottom terminal panel by default</span>
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
