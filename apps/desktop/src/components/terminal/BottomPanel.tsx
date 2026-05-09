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

  // Subscribe to agent output
  useEffect(() => {
    const unsub = useAppStore.subscribe(
      (state) => {
        const queue = state.terminalOutputQueue;
        if (queue.length > 0 && xtermRef.current) {
          queue.forEach((text: string) => xtermRef.current!.write(text));
          useAppStore.getState().clearTerminalOutputQueue();
        }
      }
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'var(--font-mono)',
      theme: {
        background: '#08090d',
        foreground: '#c8d0e0',
        cursor: '#6366f1'
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
      let currentCwd = workspacePath || '';
      term.writeln(`\x1B[32mAntimatter Terminal\x1B[0m`);
      
      let commandBuffer = '';
      let isExecuting = false;
      const prompt = () => term.write(`\r\n\x1B[32m${currentCwd || '~'}>\x1B[0m `);
      prompt();

      // Route keystrokes and execute commands
      term.onData(async (data) => {
        if (isExecuting) return; // Ignore input while command is running

        const code = data.charCodeAt(0);
        if (code === 13) { // Enter
          term.write('\r\n');
          const cmdText = commandBuffer.trim();
          commandBuffer = '';

          if (cmdText) {
            isExecuting = true;
            try {
              // Handle CD explicitly to track the directory in the REPL
              if (cmdText.trim().toLowerCase().startsWith('cd ')) {
                const target = cmdText.trim().substring(3).trim();
                const cdCmd = Command.create('powershell', ['-NoLogo', '-Command', `cd '${target}'; (Get-Location).Path`], { cwd: currentCwd || undefined });
                const output = await cdCmd.execute();
                if (output.code === 0) {
                  currentCwd = output.stdout.trim();
                } else {
                  term.write(`\x1B[31m${output.stderr.trim()}\x1B[0m\r\n`);
                }
              } else {
                const cmd = Command.create('powershell', ['-NoLogo', '-Command', cmdText], { cwd: currentCwd || undefined });
                
                cmd.stdout.on('data', (line) => {
                  term.write(line + '\r\n');
                });
                cmd.stderr.on('data', (line) => {
                  term.write(`\x1B[31m${line}\x1B[0m\r\n`);
                });

                const child = await cmd.spawn();
                childRef.current = child;

                await new Promise((resolve) => {
                  cmd.on('close', ({ code }: any) => {
                    if (code !== 0 && code !== null) {
                      term.write(`\x1B[90m[Exit code: ${code}]\x1B[0m\r\n`);
                    }
                    resolve(null);
                  });
                  cmd.on('error', () => resolve(null));
                });
              }
            } catch (e: any) {
              term.write(`\r\n\x1B[31mError: ${e.message}\x1B[0m\r\n`);
            } finally {
              isExecuting = false;
              childRef.current = null;
              prompt();
            }
          } else {
            prompt();
          }
        } else if (code === 127 || code === 8) { // Backspace
          if (commandBuffer.length > 0) {
            commandBuffer = commandBuffer.slice(0, -1);
            term.write('\b \b');
          }
        } else {
          commandBuffer += data;
          term.write(data);
        }
      });
    };
    
    startShell();

    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    // Expose to agent tools
    (window as any)._antimatterReadConsole = () => {
      if (!term) return 'Terminal not initialized.';
      const buffer = term.buffer.active;
      let text = '';
      const start = Math.max(0, buffer.length - 200); // last 200 lines
      for (let i = start; i < buffer.length; i++) {
         const line = buffer.getLine(i);
         if (line) text += line.translateToString(true) + '\n';
      }
      return text;
    };

    return () => {
      window.removeEventListener('resize', handleResize);
      delete (window as any)._antimatterReadConsole;
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
