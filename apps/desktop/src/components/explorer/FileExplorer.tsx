import React, { useState, useEffect } from 'react';
import type { WorkspaceEntry } from '@antimatter/shared';
import { useAppStore } from '@/store/appStore';
import { openFileAsTab, readDirectory } from '@/lib/tauri';
import { clsx } from 'clsx';

interface FileTreeItemProps {
  entry: WorkspaceEntry;
  depth: number;
}

function FileTreeItem({ entry, depth }: FileTreeItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<WorkspaceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { openFile } = useAppStore();

  const toggleOpen = async () => {
    if (!entry.isDirectory) {
      const file = await openFileAsTab(entry.path);
      openFile(file);
      return;
    }

    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen && children.length === 0) {
      setIsLoading(true);
      try {
        const results = await readDirectory(entry.path);
        setChildren(results);
      } catch (err) {
        console.error('Failed to load sub-directory', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="tree-item-container">
      <button
        className={clsx('tree-item', { 'is-directory': entry.isDirectory, 'is-open': isOpen })}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        onClick={toggleOpen}
      >
        <span className="tree-item__icon">
          {entry.isDirectory ? (
            <span className={clsx('chevron', { 'expanded': isOpen })}>
              {isOpen ? '▼' : '▶'}
            </span>
          ) : (
            '📄'
          )}
        </span>
        <span className="tree-item__label">{entry.name}</span>
        {isLoading && <span className="spinner-tiny" />}
      </button>
      
      {isOpen && entry.isDirectory && (
        <div className="tree-item__children">
          {children.length === 0 && !isLoading ? (
            <div className="tree-item empty-state" style={{ paddingLeft: `${(depth + 1) * 12 + 12}px` }}>
              (empty)
            </div>
          ) : (
            children.map((child) => (
              <FileTreeItem key={child.path} entry={child} depth={depth + 1} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function FileExplorer() {
  const { workspacePath, workspaceEntries, setWorkspacePath, setWorkspaceEntries } = useAppStore();

  const handleCloseWorkspace = () => {
    setWorkspacePath(undefined);
    setWorkspaceEntries([]);
  };

  if (!workspacePath) {
    return (
      <aside className="panel explorer-panel">
        <div className="panel__header">
          <h3>Explorer</h3>
        </div>
        <div className="empty-state-centered">
          <p>No workspace open.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="panel explorer-panel">
      <div className="panel__header">
        <div className="flex-between">
          <div>
            <h3>Explorer</h3>
            <p className="path-text" title={workspacePath}>{workspacePath.split(/[\\/]/).pop() || workspacePath}</p>
          </div>
          <button className="button-icon subtle" onClick={handleCloseWorkspace} title="Close Workspace">
            ✕
          </button>
        </div>
      </div>
      
      <div className="explorer-tree">
        {workspaceEntries.length === 0 ? (
          <div className="empty-state compact">No files found.</div>
        ) : (
          workspaceEntries.map((entry: WorkspaceEntry) => (
            <FileTreeItem key={entry.path} entry={entry} depth={0} />
          ))
        )}
      </div>
    </aside>
  );
}
