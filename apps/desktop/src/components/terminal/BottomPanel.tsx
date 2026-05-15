import { useRef, useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export function BottomPanel() {
  const { bottomPanelTab, setBottomPanelTab, workspacePath } = useAppStore();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const ptySpawnedRef = useRef(false);

  // Subscribe to agent output queue (for agent-driven terminal writes)
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
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
      theme: {
        background: '#08090d',
        foreground: '#c8d0e0',
        cursor: '#6366f1',
        cursorAccent: '#08090d',
        selectionBackground: 'rgba(99, 102, 241, 0.3)',
        black: '#1a1b26',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#c0caf5',
        brightBlack: '#414868',
        brightRed: '#f7768e',
        brightGreen: '#9ece6a',
        brightYellow: '#e0af68',
        brightBlue: '#7aa2f7',
        brightMagenta: '#bb9af7',
        brightCyan: '#7dcfff',
        brightWhite: '#c0caf5',
      },
      convertEol: true,
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    // Small delay to ensure the container has real dimensions before fitting
    setTimeout(() => fitAddon.fit(), 50);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // ─── Real PTY Connection ───
    const connectPty = async () => {
      try {
        // Listen for output from the PTY backend
        const unlisten = await listen<string>('pty-output', (event) => {
          if (xtermRef.current) {
            xtermRef.current.write(event.payload);
          }
        });
        unlistenRef.current = unlisten;

        // Spawn the real PTY shell
        const dims = fitAddon.proposeDimensions();
        await invoke('spawn_pty', {
          cwd: workspacePath || null,
          rows: dims?.rows || 24,
          cols: dims?.cols || 80,
        });
        ptySpawnedRef.current = true;

        // Forward ALL keystrokes from xterm directly to the PTY stdin
        term.onData((data) => {
          invoke('write_pty', { data }).catch((err) => {
            console.error('PTY write error:', err);
          });
        });

        // Forward binary data (e.g. special keys) too
        term.onBinary((data) => {
          invoke('write_pty', { data }).catch((err) => {
            console.error('PTY binary write error:', err);
          });
        });

      } catch (err) {
        console.error('Failed to spawn PTY:', err);
        term.writeln(`\x1B[31mFailed to start terminal: ${err}\x1B[0m`);
        term.writeln('\x1B[90mFalling back to display-only mode.\x1B[0m');
      }
    };

    connectPty();

    // Handle window resize → refit terminal
    const handleResize = () => {
      fitAddon.fit();
      // Notify backend of new size
      if (ptySpawnedRef.current) {
        const dims = fitAddon.proposeDimensions();
        if (dims) {
          invoke('resize_pty', { rows: dims.rows, cols: dims.cols }).catch(() => {});
        }
      }
    };
    window.addEventListener('resize', handleResize);

    // Expose terminal buffer to agent tools for reading console output
    (window as any)._antimatterReadConsole = () => {
      if (!term) return 'Terminal not initialized.';
      const buffer = term.buffer.active;
      let text = '';
      const start = Math.max(0, buffer.length - 200);
      for (let i = start; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) text += line.translateToString(true) + '\n';
      }
      return text;
    };

    return () => {
      window.removeEventListener('resize', handleResize);
      delete (window as any)._antimatterReadConsole;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      term.dispose();
      xtermRef.current = null;
      ptySpawnedRef.current = false;
    };
  }, [workspacePath]);

  // Refit terminal when the tab becomes visible or panel resizes
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
