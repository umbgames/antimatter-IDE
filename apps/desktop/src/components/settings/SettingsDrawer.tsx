import { useAppStore } from '@/store/appStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ open, onClose }: Props) {
  const { theme, setTheme, agentDockSide, setAgentDockSide, bottomPanelOpen, toggleBottomPanel } = useAppStore();

  if (!open) return null;

  return (
    <div className="overlay">
      <div className="modal drawer">
        <div className="panel__header">
          <div>
            <h3>Settings</h3>
            <p>Local-only defaults. Telemetry stays off by default.</p>
          </div>
          <button className="button subtle" onClick={onClose}>
            Close
          </button>
        </div>

        <section className="form-section">
          <label>
            Theme
            <select value={theme} onChange={(event) => setTheme(event.target.value as 'dark' | 'light')}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>

          <label>
            Agent panel dock
            <select value={agentDockSide} onChange={(event) => setAgentDockSide(event.target.value as 'left' | 'right')}>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>

          <label className="checkbox-row">
            <input type="checkbox" checked={bottomPanelOpen} onChange={toggleBottomPanel} />
            <span>Show bottom panel</span>
          </label>
        </section>
      </div>
    </div>
  );
}
