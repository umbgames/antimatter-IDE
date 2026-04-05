import { useState } from 'react';
import type { WorkspaceEntry } from '@antimatter/shared';
import { useAppStore } from '@/store/appStore';
import { openFileAsTab, readDirectory } from '@/lib/tauri';

export function FileExplorer() {
  const { workspacePath, workspaceEntries, setWorkspaceEntries, setWorkspacePath, openFile } = useAppStore();
  const [pathInput, setPathInput] = useState(workspacePath ?? '');

  const handleLoad = async () => {
    if (!pathInput) return;
    const entries = await readDirectory(pathInput);
    setWorkspacePath(pathInput);
    setWorkspaceEntries(entries);
  };

  const handleOpen = async (path: string, isDirectory: boolean) => {
    if (isDirectory) return;
    const file = await openFileAsTab(path);
    openFile(file);
  };

  return (
    <aside className="panel explorer-panel">
      <div className="panel__header">
        <div>
          <h3>Explorer</h3>
          <p>Open a local folder. Antimatter stays local-first.</p>
        </div>
      </div>
      <div className="explorer-pathbar">
        <input
          value={pathInput}
          onChange={(event) => setPathInput(event.target.value)}
          placeholder="/path/to/workspace"
        />
        <button className="button primary" onClick={handleLoad}>
          Open
        </button>
      </div>
      <div className="explorer-tree">
        {workspaceEntries.length === 0 ? (
          <div className="empty-state compact">No files loaded yet.</div>
        ) : (
          workspaceEntries.map((entry: WorkspaceEntry) => (
            <button
              key={entry.path}
              className="tree-item"
              onClick={() => {
                void handleOpen(entry.path, entry.isDirectory);
              }}
            >
              <span>{entry.isDirectory ? '📁' : '📄'}</span>
              <span>{entry.name}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
