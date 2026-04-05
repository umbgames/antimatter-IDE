import Editor from '@monaco-editor/react';
import type { OpenFile } from '@antimatter/shared';
import { useAppStore } from '@/store/appStore';

export function EditorShell() {
  const { openFiles, activeFilePath, theme, openFile, updateOpenFileContent } = useAppStore();
  const activeFile = openFiles.find((file: OpenFile) => file.path === activeFilePath) ?? openFiles[0];

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
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          onChange={(value) => updateOpenFileContent(activeFile.path, value ?? '')}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            smoothScrolling: true,
            padding: { top: 16 },
            automaticLayout: true
          }}
        />
      </div>
    </section>
  );
}
