import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import Editor from '@monaco-editor/react';
import type { OpenFile } from '@antimatter/shared';
import { useAppStore } from '@/store/appStore';
import { chatWithProvider } from '@/lib/tauri';
import { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { LspClient } from '@/lib/LspClient';

// ─── CRITICAL FIX: Use local monaco-editor bundle instead of CDN ───
// This prevents the editor from downloading ~5MB from unpkg.com on every launch
// and makes file opening work completely offline.
loader.config({ monaco });

export function EditorShell() {
  const { openFiles, activeFilePath, theme, openFile, closeFile, updateOpenFileContent, selectedProviderId, inlineCompletionsEnabled, workspacePath } = useAppStore();
  const completionProviderRef = useRef<any>(null);
  const hoverProviderRef = useRef<any>(null);
  const lspCompleteRef = useRef<any>(null);
  const activeFile = openFiles.find((file: OpenFile) => file.path === activeFilePath) ?? openFiles[0];
  const lspClients = useRef<Map<string, LspClient>>(new Map());
  const monacoEditorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsCollectionRef = useRef<any>(null);
  const aiEdits = useAppStore(s => s.aiEdits);

  const handleEditorWillMount = (monaco: any) => {
    monaco.editor.defineTheme('antimatter-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#13141a',
      }
    });

    monaco.editor.defineTheme('antimatter-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff',
      }
    });
  };

  const handleEditorMount = (_editor: any, monaco: any) => {
    monacoEditorRef.current = _editor;
    monacoRef.current = monaco;

    if (completionProviderRef.current) {
       completionProviderRef.current.dispose();
    }

    completionProviderRef.current = monaco.languages.registerInlineCompletionsProvider({ pattern: '**' }, {
      provideInlineCompletions: async (model: any, position: any) => {
        if (!inlineCompletionsEnabled || !selectedProviderId) return;

        const linePrefix = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });
        
        if (linePrefix.trim().length < 3) return;

        // Simple debounce handled by Monaco calling logic mostly, but we add a small delay
        await new Promise(r => setTimeout(r, 600));

        try {
          const startLine = Math.max(1, position.lineNumber - 50);
          const codeBeforeCursor = model.getValueInRange({ 
            startLineNumber: startLine, 
            startColumn: 1, 
            endLineNumber: position.lineNumber, 
            endColumn: position.column 
          });

          const prompt = `You are a code completion engine. Complete the following code line:
          FILE: ${activeFile.path}
          CODE UNTIL CURSOR (last 50 lines): 
          ${codeBeforeCursor}
          
          PROVIDE ONLY THE REMAINING CODE FOR THE CURRENT LINE OR BLOCK. NO EXPLANATIONS.`;

          const completion = await chatWithProvider(selectedProviderId, [{ role: 'user', content: prompt }]);
          
          return {
            items: [{
              insertText: completion.content?.trim() ?? '',
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column
              }
            }]
          };
        } catch {
          return { items: [] };
        }
      },
      freeInlineCompletions: () => {}
    });

    // Clean previous hover provider
    if (hoverProviderRef.current) {
        hoverProviderRef.current.dispose();
    }

    // Register dynamic hover provider using active LSP clients
    hoverProviderRef.current = monaco.languages.registerHoverProvider('*', {
      provideHover: async (model: any, position: any) => {
        const lang = model.getLanguageId();
        const client = lspClients.current.get(lang);
        if (!client) return null;

        try {
          const res = await client.getHover(model.uri.path, position.lineNumber - 1, position.column - 1);
          if (res && res.contents) {
            return {
              contents: Array.isArray(res.contents) ? res.contents : [res.contents]
            };
          }
        } catch {
           return null;
        }
        return null;
      }
    });

    if (lspCompleteRef.current) lspCompleteRef.current.dispose();

    lspCompleteRef.current = monaco.languages.registerCompletionItemProvider('*', {
      triggerCharacters: ['.', ':', '>', '/', '"', "'"],
      provideCompletionItems: async (model: any, position: any) => {
        const lang = model.getLanguageId();
        const client = lspClients.current.get(lang);
        if (!client) return { items: [] };

        try {
          const res = await client.getCompletions(model.uri.path, position.lineNumber - 1, position.column - 1);
          if (res && res.items) {
             const items = res.items.map((item: any) => ({
               label: item.label,
               kind: item.kind, // Maps to monaco.languages.CompletionItemKind
               insertText: item.insertText || item.label,
               documentation: item.documentation,
               detail: item.detail,
               range: {
                  startLineNumber: position.lineNumber,
                  startColumn: position.column,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column
               }
             }));
             return { items };
          }
        } catch {
        }
        return { items: [] };
      }
    });

    // Try starting Emmet (Phase 4)
    // @ts-ignore
    import('emmet-monaco-es').then(({ emmetHTML, emmetCSS, emmetJSX }) => {
       emmetHTML(monaco);
       emmetCSS(monaco);
       emmetJSX(monaco);
    }).catch(() => {
       console.warn('emmet-monaco-es not installed yet. Skipping.');
    });

    // Register Git Gutter and Formatter hooks
    _editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, async () => {
       // Phase 3 native formatter via Tauri
       const activeModel = _editor.getModel();
       if (!activeModel) return;
       const m_lang = activeModel.getLanguageId();
       
       const { executeTerminal } = await import('@/lib/tauri');
       const ext = activeModel.uri.path.split('.').pop()?.toLowerCase();
       let cmd = '';
       if (m_lang === 'rust') cmd = `rustfmt "${activeModel.uri.path}"`;
       else if (['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html'].includes(ext || '')) {
           cmd = `npx prettier --write "${activeModel.uri.path}"`;
       }
       
       if (cmd) {
          try {
             await executeTerminal({ cwd: workspacePath || '.', command: cmd });
             // Reload file content gracefully into the model
             const newContent = await (await import('@/lib/tauri')).readWorkspaceFile(activeModel.uri.path);
             activeModel.setValue(newContent);
          } catch(e) {
             console.error("Format Failed", e);
          }
       }
    });
  };

  useEffect(() => {
    if (!workspacePath || !activeFile) return;

    // Auto-spawn LSPs based on common languages (fire-and-forget, non-blocking)
    const lang = activeFile.language;
    if (!lspClients.current.has(lang)) {
        let binPath = '';
        if (lang === 'rust') binPath = 'rust-analyzer';
        else if (lang === 'python') binPath = 'pyright-langserver';
        else if (lang === 'go') binPath = 'gopls';
        
        if (binPath) {
            const client = new LspClient(lang, binPath, workspacePath);
            lspClients.current.set(lang, client);
            // Non-blocking: don't await — LSP init happens in background
            client.start().catch((err) => {
              console.warn(`[LSP] Failed to start ${binPath}:`, err);
              lspClients.current.delete(lang);
            });
        }
    }

    // Notify LSP of document switch (non-blocking)
    const client = lspClients.current.get(lang);
    if (client) {
        client.notifyDocumentOpened(activeFile.path, activeFile.content, 1);
    }
  }, [activeFile?.path, workspacePath]);

  const handleEditorChange = (value: string | undefined) => {
    updateOpenFileContent(activeFile.path, value ?? '');
    
    // Notify LSP
    const client = lspClients.current.get(activeFile.language);
    if (client) {
        client.notifyDocumentChanged(activeFile.path, value ?? '', 2);
    }
  };

  useEffect(() => {
    if (!monacoEditorRef.current || !monacoRef.current || !activeFile) return;

    if (!decorationsCollectionRef.current) {
      decorationsCollectionRef.current = monacoEditorRef.current.createDecorationsCollection();
    }

    const fileEdits = aiEdits[activeFile.path];
    if (fileEdits && fileEdits.addedLines.length > 0) {
      const monaco = monacoRef.current;
      const decorations = fileEdits.addedLines.map((line: number) => ({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'ai-added-line',
          linesDecorationsClassName: 'ai-added-line-gutter',
        }
      }));
      decorationsCollectionRef.current.set(decorations);
    } else {
      decorationsCollectionRef.current.clear();
    }
  }, [aiEdits, activeFile?.path]);

  if (!activeFile) {
    return <div className="panel editor-panel empty-state">Open a file to start editing.</div>;
  }

  return (
    <section className="panel editor-panel">
      <div className="tabs">
        {openFiles.map((file: OpenFile) => (
          <div key={file.path} className={`tab ${file.path === activeFile.path ? 'active' : ''}`} onClick={() => openFile(file)}>
            <span className="tab-label">{file.name}{file.dirty ? ' •' : ''}</span>
            <button 
              className="tab-close-btn" 
              onClick={(e) => { e.stopPropagation(); closeFile(file.path); }}
              title="Close"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <div className="editor-surface">
        <Editor
          path={activeFile.path}
          height="100%"
          language={activeFile.language}
          value={activeFile.content}
          theme={theme === 'dark' ? 'antimatter-dark' : 'antimatter-light'}
          loading={<div className="spinner-tiny" style={{ margin: 'auto' }} />}
          beforeMount={handleEditorWillMount}
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            smoothScrolling: true,
            padding: { top: 16 },
            automaticLayout: true,
            inlineSuggest: { enabled: true },
            suggest: { showInlineDetails: true }
          }}
        />
      </div>
    </section>
  );
}
