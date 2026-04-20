import { useRef, useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Command } from '@tauri-apps/plugin-shell';

export function BottomPanel() {
  const { bottomPanelTab, setBottomPanelTab, workspacePath } = useAppStore();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const childRef = useRef<any>(null);

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



    const startShell = async () => {
      try {
        const cmd = Command.create('powershell', ['-NoLogo'], { cwd: workspacePath || undefined });
        cmd.on('close', () => { term.writeln('\r\nConsole closed.'); });
        cmd.on('error', err => { term.writeln('\r\n\x1B[31mConsole error: ' + err + '\x1B[0m'); });
        
        // Correct event patterns for Tauri v2 Shell plugin
        cmd.stdout.on('data', (line) => {
          term.write(line);
        });
        cmd.stderr.on('data', (line) => {
          term.write(`\x1B[31m${line}\x1B[0m`);
        });

        const child = await cmd.spawn();
        childRef.current = child;

        term.writeln(`\x1B[32mAntimatter Terminal (Fallback Shell)\x1B[0m`);
        term.writeln(`\x1B[34mRunning in: ${workspacePath || 'Global'}\x1B[0m\r\n`);

        // Route keystrokes properly with local echo
        term.onData((data) => {
          const code = data.charCodeAt(0);
          if (code === 13) { // Enter
            term.write('\r\n');
            child.write('\r\n');
          } else if (code === 127 || code === 8) { // Backspace
            term.write('\b \b');
            child.write('\b');
          } else {
            term.write(data);
            child.write(data);
          }
        });

      } catch (e: any) {
        term.writeln(`\r\n\x1B[31mFailed to start shell: ${e.message}\x1B[0m`);
      }
    };
    
    startShell();

    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (childRef.current) {
         childRef.current.kill().catch(() => {});
      }
      term.dispose();
      xtermRef.current = null;
    };
  }, [workspacePath]);

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
          <div className="terminal-output" style={{ padding: 0, overflow: 'hidden', borderTop: 'none' }}>
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
