import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { executeTerminal } from '@/lib/tauri';

export function BottomPanel() {
  const { bottomPanelTab, setBottomPanelTab, workspacePath } = useAppStore();
  const [command, setCommand] = useState('npm run test');
  const [output, setOutput] = useState('Terminal output will appear here. Command execution is guarded by policy.\n');
  const outputRef = useRef<HTMLPreElement>(null);

  const run = async () => {
    if (!command.trim()) return;
    const currentCmd = command;
    setCommand('');
    setOutput(prev => prev + `\n$ ${currentCmd}\n`);
    
    try {
      const result = await executeTerminal({ cwd: workspacePath ?? '.', command: currentCmd });
      setOutput(prev => prev + [result.message, result.stdout, result.stderr].filter(Boolean).join('\n\n') + '\n');
    } catch (e: any) {
      setOutput(prev => prev + `Error: ${e.message}\n`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') run();
  };

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

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
            <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '13px', display: 'flex', alignItems: 'center' }}>$</span>
            <input 
              value={command} 
              onChange={(event) => setCommand(event.target.value)} 
              onKeyDown={handleKeyDown}
              style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text)', fontFamily: 'var(--font-mono)', outline: 'none' }}
              autoFocus
            />
            <button className="button subtle" onClick={run} disabled={!command.trim()}>
              Enter
            </button>
          </div>
          <pre className="terminal-output" ref={outputRef}>{output}</pre>
        </div>
      )}
      {bottomPanelTab === 'problems' && <div className="empty-state compact">No problems reported.</div>}
      {bottomPanelTab === 'output' && (
        <div className="empty-state compact">Provider tests, agent traces, and future build output will appear here.</div>
      )}
    </section>
  );
}
