import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { clsx } from 'clsx';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { CommandPalette } from './components/palette/CommandPalette';
import { Toolbar } from './components/layout/Toolbar';
import { FileExplorer } from './components/explorer/FileExplorer';
import { EditorShell } from './components/editor/EditorShell';
import { BottomPanel } from './components/terminal/BottomPanel';
import { AgentPanel } from './components/agents/AgentPanel';
import { StatusBar } from './components/layout/StatusBar';
import { SettingsDrawer } from './components/settings/SettingsDrawer';
import { ProviderSettingsModal } from './components/providers/ProviderSettingsModal';
import { DiffReviewModal } from './components/editor/DiffReviewModal';
import { WelcomeScreen } from './components/welcome/WelcomeScreen';
import { StartupMenu } from './components/layout/StartupMenu';
import { SearchPanel } from './components/explorer/SearchPanel';
import { SourceControlPanel } from './components/explorer/SourceControlPanel';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { codebaseIndexer } from './services/CodebaseIndexer';
import { runAgentLoop } from '@antimatter/agents';
import { useAppStore, deriveSettingsFromStore, initialProviders } from './store/appStore';
import {
  getRecentProjects,
  loadProviders,
  loadSettings,
  saveSettings,
  writeWorkspaceFile,
  readDirectory
} from './lib/tauri';

async function calculateLineDiff(oldStr: string, newStr: string) {
  const { diffLines } = await import('diff');
  const changes = diffLines(oldStr, newStr);
  const addedLines: number[] = [];
  const removedLines: number[] = [];
  let addedCount = 0;
  let removedCount = 0;
  
  let currentLinePos = 1;

  for (const part of changes) {
    const lineCount = part.count || 0;
    if (part.added) {
      for (let i = 0; i < lineCount; i++) {
        addedLines.push(currentLinePos + i);
      }
      addedCount += lineCount;
      currentLinePos += lineCount;
    } else if (part.removed) {
      removedCount += lineCount;
      // removed lines don't exist in the current document, so we can't easily mark them on a specific line number safely for background colors without jumping through hoops, 
      // but we maintain the count for the summary.
    } else {
      currentLinePos += lineCount;
    }
  }

  return { addedLines, removedLines, addedCount, removedCount };
}

export function App() {
  // Use specific selectors to prevent re-rendering when logs/messages change
  const theme = useAppStore(s => s.theme);
  const agentDockSide = useAppStore(s => s.agentDockSide);
  const settingsOpen = useAppStore(s => s.settingsOpen);
  const providersOpen = useAppStore(s => s.providersOpen);
  const commandPaletteOpen = useAppStore(s => s.commandPaletteOpen);
  const welcomeVisible = useAppStore(s => s.welcomeVisible);
  const openFiles = useAppStore(s => s.openFiles);
  const activeFilePath = useAppStore(s => s.activeFilePath);
  const workspacePath = useAppStore(s => s.workspacePath);
  const workspaceEntries = useAppStore(s => s.workspaceEntries);
  const providerConfigs = useAppStore(s => s.providerConfigs);
  const selectedProviderId = useAppStore(s => s.selectedProviderId);
  const bottomPanelOpen = useAppStore(s => s.bottomPanelOpen);

  const setTheme = useAppStore(s => s.setTheme);
  const setAgentDockSide = useAppStore(s => s.setAgentDockSide);
  const setSettingsOpen = useAppStore(s => s.setSettingsOpen);
  const setProvidersOpen = useAppStore(s => s.setProvidersOpen);
  const setCommandPaletteOpen = useAppStore(s => s.setCommandPaletteOpen);
  const setRecentProjects = useAppStore(s => s.setRecentProjects);
  const setProviderConfigs = useAppStore(s => s.setProviderConfigs);
  const setSelectedProviderId = useAppStore(s => s.setSelectedProviderId);
  const registerPaletteItems = useAppStore(s => s.registerPaletteItems);
  const appendMessage = useAppStore(s => s.appendMessage);
  const appendLogs = useAppStore(s => s.appendLogs);
  const setApprovalRequests = useAppStore(s => s.setApprovalRequests);
  const saveFileLocallyMarked = useAppStore(s => s.saveFileLocallyMarked);
  const toggleBottomPanel = useAppStore(s => s.toggleBottomPanel);
  const setWelcomeVisible = useAppStore(s => s.setWelcomeVisible);
  const setPendingChange = useAppStore(s => s.setPendingChange);
  const setIsAgentRunning = useAppStore(s => s.setIsAgentRunning);
  const setWorkspaceEntries = useAppStore(s => s.setWorkspaceEntries);
  const clearConversation = useAppStore(s => s.clearConversation);

  const [sidebarTab, setSidebarTab] = React.useState<'explorer' | 'search' | 'source'>('explorer');
  const indexingVersion = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Index workspace for semantic search
  useEffect(() => {
    if (workspacePath && workspaceEntries.length > 0) {
       const version = ++indexingVersion.current;
       const runIndexing = async () => {
         try {
           // Small delay to let the UI settle after opening a workspace
           await new Promise(r => setTimeout(r, 1000));
           if (version !== indexingVersion.current) return;

           const tauri = await import('./lib/tauri');
           
           // Fetch all files recursively to index them all
           useAppStore.getState().setIndexingProgress({ status: 'indexing', current: 0, total: 0 });
           
           const allFiles = await tauri.listDirectoryRecursive(workspacePath, 5);
           const validFiles = allFiles
             .filter((e: any) => !e.isDirectory && !e.path.includes('.git') && !e.path.includes('node_modules') && 
               (e.path.endsWith('.ts') || e.path.endsWith('.tsx') || e.path.endsWith('.rs') || e.path.endsWith('.js') || e.path.endsWith('.py')));

           if (validFiles.length === 0) {
             useAppStore.getState().setIndexingProgress({ status: 'ready', current: 0, total: 0 });
             return;
           }

           useAppStore.getState().setIndexingProgress({ status: 'indexing', current: 0, total: validFiles.length });

           // Load content in batches to prevent UI block
           const fileData = [];
           const batchSize = 10;
           for (let i = 0; i < validFiles.length; i += batchSize) {
             if (version !== indexingVersion.current) return; // aborted
             const batch = validFiles.slice(i, i + batchSize);
             const batchData = await Promise.all(
               batch.map(async (f: any) => ({
                 path: f.path,
                 content: await tauri.readWorkspaceFile(f.path)
               }))
             );
             fileData.push(...batchData);
           }
           
           if (version === indexingVersion.current) {
             await codebaseIndexer.index(fileData, (current, total) => {
               useAppStore.getState().setIndexingProgress({ status: 'indexing', current, total });
             });
             useAppStore.getState().setIndexingProgress({ status: 'ready', current: validFiles.length, total: validFiles.length });
           }
         } catch (err) {
           console.error('Indexing failed:', err);
           useAppStore.getState().setIndexingProgress({ status: 'idle', current: 0, total: 0 });
         }
       };
       runIndexing();
    }
  }, [workspacePath, workspaceEntries]);

  useEffect(() => {
    void Promise.all([loadSettings(), getRecentProjects(), loadProviders()])
      .then(([settings, recentProjects, providers]) => {
        setTheme(settings.theme);
        setAgentDockSide(settings.agentDockSide);
        setRecentProjects(recentProjects);
        if (providers.length > 0) {
          const mergedProviders = initialProviders.map((defaultConfig) => {
            const saved = providers.find((p) => p.id === defaultConfig.id || p.kind === defaultConfig.kind);
            return saved ? { ...defaultConfig, ...saved } : defaultConfig;
          });
          const customProviders = providers.filter(
            (p) => !initialProviders.some((def) => def.id === p.id || def.kind === p.kind)
          );
          setProviderConfigs([...mergedProviders, ...customProviders]);
        }
        if (settings.defaultProviderId) {
          setSelectedProviderId(settings.defaultProviderId);
        }
      })
      .catch(() => undefined);
  }, [setAgentDockSide, setProviderConfigs, setRecentProjects, setSelectedProviderId, setTheme]);

  const selectedProvider = useMemo(() => 
    providerConfigs.find((provider) => provider.id === selectedProviderId),
    [providerConfigs, selectedProviderId]
  );

  /* ─── File Actions ─── */
  const saveActiveFile = useCallback(async () => {
    const file = openFiles.find((entry) => entry.path === activeFilePath);
    if (!file) return;
    await writeWorkspaceFile(file.path, file.content);
    saveFileLocallyMarked(file.path);
  }, [activeFilePath, openFiles, saveFileLocallyMarked]);

  const closeActiveFile = useCallback(() => {
    const activePath = useAppStore.getState().activeFilePath;
    if (activePath) {
      useAppStore.getState().closeFile(activePath);
    }
  }, []);

  const closeAllFiles = useCallback(() => {
    useAppStore.setState({
      openFiles: [],
      activeFilePath: undefined,
      welcomeVisible: true
    });
  }, []);

  const newFile = useCallback(() => {
    const id = crypto.randomUUID().slice(0, 8);
    const file = {
      path: `untitled-${id}`,
      name: `untitled-${id}`,
      language: 'plaintext',
      content: '',
      dirty: true
    };
    useAppStore.getState().openFile(file);
  }, []);

  const openFolder = useCallback(() => {
    const input = document.querySelector('.explorer-pathbar input') as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.select();
    }
  }, []);

  /* ─── Keyboard Shortcuts ─── */
  useKeyboardShortcuts({
    'mod+p': () => setCommandPaletteOpen(true),
    'mod+,': () => setSettingsOpen(true),
    'mod+b': () => toggleBottomPanel(),
    'mod+s': () => { void saveActiveFile(); },
    'mod+w': () => closeActiveFile(),
    'mod+n': () => newFile()
  });

  /* ─── Command Palette Items ─── */
  const paletteItems = useMemo(
    () => [
      { id: 'open-settings', title: 'Preferences: Open Settings', category: 'General', action: () => setSettingsOpen(true) },
      { id: 'open-providers', title: 'Providers: Configure', category: 'AI', action: () => setProvidersOpen(true) },
      { id: 'toggle-theme', title: `View: Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`, category: 'View', action: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
      { id: 'move-agent-left', title: 'Layout: Dock Agent Panel Left', category: 'Layout', action: () => setAgentDockSide('left') },
      { id: 'move-agent-right', title: 'Layout: Dock Agent Panel Right', category: 'Layout', action: () => setAgentDockSide('right') },
      { id: 'new-file', title: 'File: New File', category: 'File', action: newFile },
      { id: 'save-file', title: 'File: Save', category: 'File', action: () => { void saveActiveFile(); } },
      { id: 'close-file', title: 'File: Close File', category: 'File', action: closeActiveFile },
      { id: 'toggle-terminal', title: `View: ${bottomPanelOpen ? 'Hide' : 'Show'} Terminal`, category: 'View', action: toggleBottomPanel },
      { id: 'welcome', title: 'Help: Show Welcome', category: 'Help', action: () => setWelcomeVisible(true) },
      { id: 'clear-chat', title: 'Agent: Clear Conversation', category: 'AI', action: clearConversation }
    ],
    [setAgentDockSide, setProvidersOpen, setSettingsOpen, setTheme, theme, bottomPanelOpen, toggleBottomPanel, setWelcomeVisible, newFile, saveActiveFile, closeActiveFile]
  );

  useEffect(() => {
    registerPaletteItems(paletteItems);
  }, [paletteItems, registerPaletteItems]);

  /* ─── File Watcher (auto-refresh explorer) ─── */
  useEffect(() => {
    if (!workspacePath) return;
    const interval = setInterval(async () => {
      try {
        const entries = await readDirectory(workspacePath);
        setWorkspaceEntries(entries);
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [workspacePath, setWorkspaceEntries]);

  /* ─── Agent ─── */
  const onAgentPrompt = useCallback(async (prompt: string) => {
    const now = new Date().toISOString();
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: prompt,
      createdAt: now
    };
    appendMessage(userMessage);
    setApprovalRequests([]);
    setIsAgentRunning(true);
    useAppStore.getState().clearAIEdits();
    useAppStore.getState().setAgentBackups({});

    const state = useAppStore.getState();
    const context = {
      provider: selectedProvider,
      messages: [...state.messages],
      workspacePath: state.workspacePath || undefined,
      persona: state.activePersona,
      onTokensUsed: (tokens: number) => {
        useAppStore.getState().incrementSessionTokens(tokens);
      },
      onStreamUpdate: (content: string) => {
        useAppStore.getState().setStreamingMessage(content);
      },
      createChat: async (request: any, config: any, onStreamUpdate?: (content: string) => void) => {
        const tauri = await import('./lib/tauri');
        const mappedMessages = request.messages.map((m: any) => {
          const msg: any = { role: m.role, content: m.content };
          if (m.tool_calls) msg.toolCalls = m.tool_calls;
          if (m.tool_call_id) msg.toolCallId = m.tool_call_id;
          if (m.name) msg.name = m.name;
          return msg;
        });
        if (onStreamUpdate) {
          return await tauri.chatWithProviderStream(config.id, mappedMessages, request.tools, onStreamUpdate);
        }
        return await tauri.chatWithProvider(config.id, mappedMessages, request.tools);
      }
    };

    const executeToolImpl = async (toolId: string, args: any): Promise<any> => {
      const tauri = await import('./lib/tauri');
      const currentPath = useAppStore.getState().workspacePath;
      
      const storeBackup = async (filePath: string) => {
        const state = useAppStore.getState();
        if (state.agentBackups[filePath] !== undefined) return;
        try {
           const original = await tauri.readWorkspaceFile(filePath);
           state.setAgentBackups({ ...state.agentBackups, [filePath]: original });
        } catch {
           state.setAgentBackups({ ...state.agentBackups, [filePath]: null });
        }
      };
      
      switch (toolId) {
        case 'read-file': {
          let content = await tauri.readWorkspaceFile(args.path);
          if (args.start_line !== undefined || args.end_line !== undefined) {
             const lines = content.split(/\r?\n/);
             const start = Math.max(0, (args.start_line || 1) - 1);
             const end = args.end_line ? Math.min(lines.length, args.end_line) : lines.length;
             content = lines.slice(start, end).join('\n');
             content += `\n\n[Displaying lines ${start + 1} to ${end} of ${lines.length}. Use start_line/end_line to read more.]`;
          } else if (content.length > 20000) {
             const lines = content.split(/\r?\n/);
             content = lines.slice(0, 400).join('\n');
             content += `\n\n[File truncated at 400 lines because it is too large (${lines.length} total lines). Pass start_line and end_line arguments to read the rest, or use grep-search.]`;
          }
          return content;
        }
        case 'write-file': {
          await storeBackup(args.path);
          let original = '';
          try { original = await tauri.readWorkspaceFile(args.path); } catch { /* new file */ }
          const proposed = args.content || '';
          await tauri.writeWorkspaceFile(args.path, proposed);
          
          const diffResult = await calculateLineDiff(original, proposed);
          useAppStore.getState().updateAIEdits(args.path, diffResult);
          
          return `Successfully wrote to ${args.path}`;
        }
        case 'patch-file': {
          await storeBackup(args.path);
          let original = '';
          try { original = await tauri.readWorkspaceFile(args.path); } catch { /* new file */ }
          let proposed = original;
          if (Array.isArray(args.replacements)) {
            for (const r of args.replacements) {
              if (r.search && typeof r.replace === 'string') {
                proposed = proposed.replace(r.search, r.replace);
              }
            }
          }
          await tauri.writeWorkspaceFile(args.path, proposed);
          
          const diffResult = await calculateLineDiff(original, proposed);
          useAppStore.getState().updateAIEdits(args.path, diffResult);
          
          return `Successfully patched ${args.path}`;
        }
        case 'replace-lines': {
          await storeBackup(args.path);
          const original = await tauri.readWorkspaceFile(args.path);
          const lines = original.split(/\r?\n/);
          const startIdx = Math.max(0, (args.start_line || 1) - 1);
          const endIdx = typeof args.end_line === 'number' ? Math.min(lines.length - 1, args.end_line - 1) : startIdx;
          
          if (startIdx >= lines.length) {
            lines.push(args.replacement);
          } else {
            lines.splice(startIdx, Math.max(1, endIdx - startIdx + 1), args.replacement);
          }
          const proposed = lines.join('\n');
          await tauri.writeWorkspaceFile(args.path, proposed);
          
          const diffResult = await calculateLineDiff(original, proposed);
          useAppStore.getState().updateAIEdits(args.path, diffResult);
          
          return `Successfully replaced lines ${startIdx + 1} to ${endIdx + 1} in ${args.path}`;
        }
        case 'delete-file':
          await storeBackup(args.path);
          return await tauri.deleteWorkspaceFile(args.path);
        case 'rename-file':
          await storeBackup(args.from);
          await storeBackup(args.to);
          return await tauri.renameWorkspaceFile(args.from, args.to);
        case 'list-directory': {
          if (args.recursive) {
            return await tauri.listDirectoryRecursive(args.path || currentPath || '', args.maxDepth);
          }
          return await tauri.readDirectory(args.path || currentPath || '');
        }
        case 'create-directory':
          return await tauri.createWorkspaceDirectory(args.path);
        case 'search-workspace':
          if (!currentPath) throw new Error('No workspace open');
          return await tauri.searchWorkspace(currentPath, args.query);
        case 'grep-search':
          if (!currentPath) throw new Error('No workspace open');
          return await tauri.grepSearch(currentPath, args.pattern, args.include, args.path);
        case 'query-codebase': {
          const results = await codebaseIndexer.search(args.query);
          return results.map(r => ({ path: r.path, text: r.text }));
        }
        case 'terminal-exec': {
          if (!currentPath) throw new Error('No workspace open');
          useAppStore.getState().setBottomPanelTab('terminal');
          
          return new Promise(async (resolve, reject) => {
            const { Command } = await import('@tauri-apps/plugin-shell');
            const cmd = Command.create('powershell', ['-NoLogo', '-Command', args.command], { cwd: currentPath });
            
            let output = '';
            useAppStore.getState().appendTerminalOutput(`\x1B[33m\r\n> ${args.command}\x1B[0m\r\n`);

            cmd.stdout.on('data', (line: string) => {
              output += line + '\n';
              useAppStore.getState().appendTerminalOutput(line + '\r\n');
            });
            cmd.stderr.on('data', (line: string) => {
              output += line + '\n';
              useAppStore.getState().appendTerminalOutput(`\x1B[31m${line}\x1B[0m\r\n`);
            });
            
            cmd.on('close', ({ code }: any) => {
              useAppStore.getState().appendTerminalOutput(`\x1B[90mExit code: ${code}\x1B[0m\r\n`);
              resolve(output || 'Command executed successfully with no output.');
            });
            
            cmd.on('error', (err: any) => {
               reject(err);
            });
            
            cmd.spawn().catch(reject);
          });
        }
        case 'run-background-command': {
          if (!currentPath) throw new Error('No workspace open');
          useAppStore.getState().setBottomPanelTab('terminal');
          
          const jobId = crypto.randomUUID().slice(0, 8);
          const { Command } = await import('@tauri-apps/plugin-shell');
          const cmd = Command.create('powershell', ['-NoLogo', '-Command', args.command], { cwd: currentPath });
          
          (window as any)[`_cmd_${jobId}`] = { status: 'running', output: '' };

          useAppStore.getState().appendTerminalOutput(`\x1B[35m\r\n> [Bg ${jobId}] ${args.command}\x1B[0m\r\n`);

          cmd.stdout.on('data', (line: string) => {
            (window as any)[`_cmd_${jobId}`].output += line + '\n';
            useAppStore.getState().appendTerminalOutput(`\x1B[35m[${jobId}]\x1B[0m ${line}\r\n`);
          });
          cmd.stderr.on('data', (line: string) => {
            (window as any)[`_cmd_${jobId}`].output += line + '\n';
            useAppStore.getState().appendTerminalOutput(`\x1B[31m[${jobId}] ${line}\x1B[0m\r\n`);
          });
          
          cmd.on('close', ({ code }: any) => {
            (window as any)[`_cmd_${jobId}`].status = 'done';
            (window as any)[`_cmd_${jobId}`].code = code;
            useAppStore.getState().appendTerminalOutput(`\x1B[90m[${jobId}] Exit code: ${code}\x1B[0m\r\n`);
          });
          
          cmd.spawn().catch((err: any) => {
            (window as any)[`_cmd_${jobId}`].status = 'error';
            (window as any)[`_cmd_${jobId}`].output += '\nError: ' + err;
          });
          
          return `Started background command with ID: ${jobId}. Use check-command to see status and output.`;
        }
        case 'check-command': {
          const job = (window as any)[`_cmd_${args.jobId}`];
          if (!job) return `No background command found with ID ${args.jobId}`;
          return `Status: ${job.status}\nExit Code: ${job.code ?? 'N/A'}\n\nOutput:\n${job.output.slice(-10000)}`;
        }
        case 'read-console': {
          if (typeof (window as any)._antimatterReadConsole === 'function') {
            return (window as any)._antimatterReadConsole();
          }
          return 'Console read function not available. Ensure the terminal panel is open.';
        }
        case 'analyze-file':
          return await tauri.analyzeFile(args.path);
        case 'analyze-project':
          if (!currentPath) throw new Error('No workspace open');
          return await tauri.analyzeProject(currentPath);
        case 'analyze-dependencies':
          if (!currentPath) throw new Error('No workspace open');
          return await tauri.analyzeDependencies(currentPath, args.path);
        case 'get-file-info':
          return await tauri.getFileInfo(args.path);
        case 'fetch-url':
          return await tauri.fetchUrl(args.url);
        case 'bulk-replace':
          if (!currentPath) throw new Error('No workspace open');
          return await tauri.bulkReplace(currentPath, args.search, args.replace, args.include, args.path);
        case 'delegate-task': {
          const validPersonas = ['engineer', 'architect', 'qa'];
          const persona = validPersonas.includes(args.persona) ? args.persona : 'engineer';
          
          useAppStore.getState().appendLogs([{
            id: crypto.randomUUID(),
            kind: 'info',
            title: `Delegating to ${persona}`,
            detail: (args.task || '').slice(0, 100) + '...',
            createdAt: new Date().toISOString()
          }]);

          const state = useAppStore.getState();
          const subContext = {
            provider: selectedProvider,
            messages: [{ id: crypto.randomUUID(), role: 'user' as const, content: `Task assigned by main agent: ${args.task}`, createdAt: new Date().toISOString() }],
            workspacePath: state.workspacePath || undefined,
            persona: persona as 'engineer' | 'architect' | 'qa',
            createChat: async (request: any, config: any) => {
              const tauri = await import('./lib/tauri');
              const mappedMessages = request.messages.map((m: any) => {
                const msg: any = { role: m.role, content: m.content };
                if (m.tool_calls) msg.toolCalls = m.tool_calls;
                if (m.tool_call_id) msg.toolCallId = m.tool_call_id;
                if (m.name) msg.name = m.name;
                return msg;
              });
              // Sub-agents run silently without streaming UI text
              return await tauri.chatWithProvider(config.id, mappedMessages, request.tools);
            }
          };

          const subResult = await runAgentLoop(subContext, executeToolImpl);
          // Return the final reply from the sub-agent
          return `Sub-agent (${persona}) completed the task. Final Report: ${subResult.reply?.content || 'No response'}`;
        }
        default:
          throw new Error(`Tool "${toolId}" is not implemented.`);
      }
    };

    const result = await runAgentLoop(context, executeToolImpl);
    appendLogs(result.logs);
    setApprovalRequests(result.approvalRequests);
    appendMessage(result.reply);
    setIsAgentRunning(false);
    useAppStore.getState().setStreamingMessage('');

    const firstWithDiff = result.approvalRequests.find(r => r.diff);
    if (firstWithDiff?.diff) {
      setPendingChange(firstWithDiff.diff);
    }

    // Auto-refresh workspace entries after agent finishes (it may have created/deleted files)
    if (workspacePath) {
      readDirectory(workspacePath).then(entries => setWorkspaceEntries(entries)).catch(() => {});
    }
  }, [selectedProvider, appendMessage, appendLogs, setApprovalRequests, setPendingChange, setIsAgentRunning, workspacePath, setWorkspaceEntries]);

  const onApproveTool = useCallback(async (request: any) => {
    setApprovalRequests(useAppStore.getState().approvalRequests.filter(r => r.id !== request.id));
    if (!request.toolCall) return;
    
    const tauri = await import('./lib/tauri');
    const { toolId, args } = request.toolCall;
    
    let result;
    try {
      if (toolId === 'write-file' || toolId === 'patch-file') {
        const proposedContent = request.diff?.proposed ?? args.content ?? '';
        await tauri.writeWorkspaceFile(args.path, proposedContent);
        result = `Successfully wrote to ${args.path}`;
      } else if (toolId === 'terminal-exec') {
        const currentPath = useAppStore.getState().workspacePath;
        if (!currentPath) throw new Error('No workspace open');
        result = await tauri.executeTerminal({ cwd: currentPath, command: args.command });
      } else {
        result = `Tool ${toolId} executed`;
      }
      void onAgentPrompt(`<observation>\n${JSON.stringify(result, null, 2)}\n</observation>`);
    } catch (err: any) {
      void onAgentPrompt(`<error>\nTool failed: ${err.message || String(err)}\n</error>`);
    }
  }, [setApprovalRequests, onAgentPrompt]);

  const onRejectTool = useCallback((request: any) => {
    setApprovalRequests(useAppStore.getState().approvalRequests.filter(r => r.id !== request.id));
    void onAgentPrompt(`<error>\nUser rejected the tool execution.\n</error>`);
  }, [setApprovalRequests, onAgentPrompt]);

  /* ─── Persist Settings ─── */
  const persistSettings = useCallback(async () => {
    await saveSettings(deriveSettingsFromStore(useAppStore.getState()));
  }, []);

  useEffect(() => {
    void persistSettings();
  }, [theme, agentDockSide, persistSettings]);

  /* ─── Render ─── */
  return (
    <div className="app-shell">
      <Toolbar
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenProviders={() => setProvidersOpen(true)}
        onOpenFolder={openFolder}
        onSaveFile={() => { void saveActiveFile(); }}
        onNewFile={newFile}
        onCloseFile={closeActiveFile}
        onCloseAllFiles={closeAllFiles}
        onToggleTerminal={toggleBottomPanel}
        onRunCommand={() => {
          if (!bottomPanelOpen) toggleBottomPanel();
          useAppStore.getState().setBottomPanelTab('terminal');
        }}
      />

      <div className="workspace-shell">
        <PanelGroup direction="horizontal">
          {agentDockSide === 'left' && (
            <>
              <Panel defaultSize={22} minSize={16}>
                <ErrorBoundary>
                   <AgentPanel onSubmit={onAgentPrompt} onApprove={onApproveTool} onReject={onRejectTool} />
                </ErrorBoundary>
              </Panel>
              <PanelResizeHandle className="resize-handle vertical" />
            </>
          )}

          <Panel defaultSize={18} minSize={12}>
            <div className="sidebar-tabs">
              {(['explorer', 'search', 'source'] as const).map(tab => (
                 <button 
                   key={tab}
                   className={clsx('sidebar-tab', { active: sidebarTab === tab })}
                   onClick={() => setSidebarTab(tab)}
                 >
                   {tab.charAt(0).toUpperCase() + tab.slice(1)}
                 </button>
              ))}
            </div>
            <ErrorBoundary>
               {sidebarTab === 'explorer' && <FileExplorer />}
               {sidebarTab === 'search' && <SearchPanel />}
               {sidebarTab === 'source' && <SourceControlPanel />}
            </ErrorBoundary>
          </Panel>
          <PanelResizeHandle className="resize-handle vertical" />

          <Panel>
            <PanelGroup direction="vertical">
              <Panel>
                <ErrorBoundary>
                   {welcomeVisible && openFiles.length === 0 ? <WelcomeScreen /> : <EditorShell />}
                </ErrorBoundary>
              </Panel>
              {bottomPanelOpen && (
                <>
                  <PanelResizeHandle className="resize-handle horizontal" />
                  <Panel defaultSize={24} minSize={14} collapsible>
                    <ErrorBoundary>
                       <BottomPanel />
                    </ErrorBoundary>
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

          {agentDockSide === 'right' && (
            <>
              <PanelResizeHandle className="resize-handle vertical" />
              <Panel defaultSize={24} minSize={16}>
                <ErrorBoundary>
                   <AgentPanel onSubmit={onAgentPrompt} onApprove={onApproveTool} onReject={onRejectTool} />
                </ErrorBoundary>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      <StatusBar onToggleProviders={() => setProvidersOpen(true)} />
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ProviderSettingsModal open={providersOpen} onClose={() => setProvidersOpen(false)} />
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      <DiffReviewModal />
      {workspacePath === null && <StartupMenu />}
    </div>
  );
}
