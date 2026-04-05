import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { executeTerminal } from '@/lib/tauri';

export function BottomPanel() {
  const { bottomPanelTab, setBottomPanelTab, workspacePath } = useAppStore();
  const [command, setCommand] = useState('npm run test');
  const [output, setOutput] = useState('Terminal output will appear here. Command execution is guarded by policy.');

  const run = async () => {
    const result = await executeTerminal({ cwd: workspacePath ?? '.', command });
    setOutput(
      [result.message, result.stdout, result.stderr].filter(Boolean).join('\n\n') || 'Command completed with no output.'
    );
  };

  return (
    <section className="panel bottom-panel">
      <div className="panel__header inline-tabs">
        {(['terminal', 'problems', 'output'] as const).map((tab) => (
          <button key={tab} className={`tab ${tab === bottomPanelTab ? 'active' : ''}`} onClick={() => setBottomPanelTab(tab)}>
            {tab}
          </button>
        ))}
      </div>
      {bottomPanelTab === 'terminal' && (
        <div className="terminal-panel">
          <div className="terminal-input-row">
            <input value={command} onChange={(event) => setCommand(event.target.value)} />
            <button className="button primary" onClick={run}>
              Run
            </button>
          </div>
          <pre className="terminal-output">{output}</pre>
        </div>
      )}
      {bottomPanelTab === 'problems' && <div className="empty-state compact">No problems reported.</div>}
      {bottomPanelTab === 'output' && (
        <div className="empty-state compact">Provider tests, agent traces, and future build output will appear here.</div>
      )}
    </section>
  );
}
