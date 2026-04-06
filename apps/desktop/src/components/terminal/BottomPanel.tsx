import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import { executeTerminal } from '@/lib/tauri';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

export function BottomPanel() {
  const { bottomPanelTab, setBottomPanelTab, workspacePath } = useAppStore();
  const [command, setCommand] = useState('');
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'var(--font-mono)',
      theme: {
        background: '#08090d',
        foreground: '#c8d0e0',
        cursor: '#4d8eff'
      },
      convertEol: true
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln('\x1B[1;34mAntimatter Terminal\x1B[0m');
    term.writeln('Type a command and press Enter.\n');

    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      xtermRef.current = null;
    };
  }, []);

  const run = useCallback(async (cmd?: string) => {
    const activeCmd = cmd || command;
    if (!activeCmd.trim()) return;
    
    setCommand('');
    const term = xtermRef.current;
    if (term) {
      term.writeln(`\r\n\x1B[1;32m$ ${activeCmd}\x1B[0m`);
    }
    
    try {
      const result = await executeTerminal({ cwd: workspacePath ?? '.', command: activeCmd });
      if (term) {
        if (result.message) term.writeln(`\x1B[1;30m${result.message}\x1B[0m`);
        if (result.stdout) term.write(result.stdout);
        if (result.stderr) term.write(`\x1B[31m${result.stderr}\x1B[0m`);
      }
    } catch (e: any) {
      term?.writeln(`\x1B[31mError: ${e.message}\x1B[0m`);
    }
  }, [command, workspacePath]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') run();
  };

  useEffect(() => {
    if (bottomPanelTab === 'terminal' && fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current?.fit(), 0);
    }
  }, [bottomPanelTab]);

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
          <div className="terminal-input-row" style={{ borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '13px', display: 'flex', alignItems: 'center', paddingLeft: '8px' }}>$</span>
            <input 
              value={command} 
              onChange={(event) => setCommand(event.target.value)} 
              onKeyDown={handleKeyDown}
              style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text)', fontFamily: 'var(--font-mono)', outline: 'none' }}
              placeholder="Type command..."
              autoFocus
            />
          </div>
          <div className="terminal-output" style={{ padding: 0, overflow: 'hidden' }}>
             <div ref={terminalRef} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>
      )}
      {bottomPanelTab === 'problems' && <div className="empty-state compact">No problems reported.</div>}
      {bottomPanelTab === 'output' && (
        <div className="empty-state compact">Provider tests, agent traces, and future build output will appear here.</div>
      )}
    </section>
  );
}
