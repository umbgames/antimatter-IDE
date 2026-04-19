import Editor from '@monaco-editor/react';
import type { OpenFile } from '@antimatter/shared';
import { useAppStore } from '@/store/appStore';
import { chatWithProvider } from '@/lib/tauri';
import { useRef } from 'react';

export function EditorShell() {
  const { openFiles, activeFilePath, theme, openFile, updateOpenFileContent, selectedProviderId, inlineCompletionsEnabled } = useAppStore();
  const completionProviderRef = useRef<any>(null);
  const activeFile = openFiles.find((file: OpenFile) => file.path === activeFilePath) ?? openFiles[0];

  const handleEditorMount = (_editor: any, monaco: any) => {
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
          const prompt = `You are a code completion engine. Complete the following code line:
          FILE: ${activeFile.path}
          CODE UNTIL CURSOR: 
          ${model.getValueInRange({ startLineNumber: 1, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column })}
          
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
  };

  if (!activeFile) {
    return <div className="panel editor-panel empty-state">Open a file to start editing.</div>;
  }

  return (
    <section className="panel editor-panel">
      <div className="tabs">
        {openFiles.map((file: OpenFile) => (
          <button key={file.path} className={`tab ${file.path === activeFile.path ? 'active' : ''}`} onClick={() => openFile(file)}>
            {file.name}
            {file.dirty ? ' •' : ''}
          </button>
        ))}
      </div>
      <div className="editor-surface">
        <Editor
          height="100%"
          language={activeFile.language}
          value={activeFile.content}
          theme={theme === 'dark' ? 'antimatter-dark' : 'antimatter-light'}
          onChange={(value) => updateOpenFileContent(activeFile.path, value ?? '')}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
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
