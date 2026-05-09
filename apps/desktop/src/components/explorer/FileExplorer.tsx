import { useState, useEffect } from 'react';
import type { WorkspaceEntry } from '@antimatter/shared';
import { useAppStore } from '@/store/appStore';
import { openFileAsTab, readDirectory } from '@/lib/tauri';
import { clsx } from 'clsx';
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import { 
  DiJavascript1, DiReact, DiHtml5, DiCss3, DiSass, DiLess, DiPython, DiJava, DiRust, DiGo, DiDatabase, DiSwift, DiRuby
} from 'react-icons/di';
import {
  BiLogoTypescript, BiLogoVuejs, BiLogoMarkdown, BiImage, BiVideo, BiMusic
} from 'react-icons/bi';
import {
  VscFileZip, VscTerminalCmd, VscFileBinary, VscFile, VscJson
} from 'react-icons/vsc';

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (!fileName.includes('.')) return <VscFile size={14} style={{ opacity: 0.8 }} />;
  
  switch (ext) {
    case 'ts': return <BiLogoTypescript size={14} style={{ color: '#3178c6' }} />;
    case 'tsx': return <DiReact size={14} style={{ color: '#61dafb' }} />;
    case 'js': return <DiJavascript1 size={14} style={{ color: '#f7df1e' }} />;
    case 'jsx': return <DiReact size={14} style={{ color: '#61dafb' }} />;
    case 'vue': return <BiLogoVuejs size={14} style={{ color: '#4fc08d' }} />;
    case 'html': return <DiHtml5 size={14} style={{ color: '#e34f26' }} />;
    case 'css': return <DiCss3 size={14} style={{ color: '#1572b6' }} />;
    case 'scss': return <DiSass size={14} style={{ color: '#cc6699' }} />;
    case 'less': return <DiLess size={14} style={{ color: '#1d365d' }} />;
    case 'json': case 'toml': case 'yaml': case 'yml': return <VscJson size={14} style={{ color: '#22c55e' }} />;
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': case 'webp': case 'ico': return <BiImage size={14} style={{ color: '#a855f7' }} />;
    case 'mp4': case 'webm': case 'mkv': case 'avi': return <BiVideo size={14} style={{ color: '#ec4899' }} />;
    case 'mp3': case 'wav': case 'ogg': case 'flac': return <BiMusic size={14} style={{ color: '#f43f5e' }} />;
    case 'zip': case 'rar': case '7z': case 'tar': case 'gz': return <VscFileZip size={14} style={{ color: '#ef4444' }} />;
    case 'md': case 'txt': case 'rtf': return <BiLogoMarkdown size={14} style={{ color: '#000000' }} />;
    case 'py': return <DiPython size={14} style={{ color: '#3776ab' }} />;
    case 'java': return <DiJava size={14} style={{ color: '#b07219' }} />;
    case 'rs': return <DiRust size={14} style={{ color: '#dea584' }} />;
    case 'go': return <DiGo size={14} style={{ color: '#00add8' }} />;
    case 'rb': return <DiRuby size={14} style={{ color: '#701516' }} />;
    case 'swift': return <DiSwift size={14} style={{ color: '#f05138' }} />;
    case 'sh': case 'bat': case 'cmd': case 'ps1': return <VscTerminalCmd size={14} style={{ color: '#14b8a6' }} />;
    case 'sql': case 'db': case 'sqlite': return <DiDatabase size={14} style={{ color: '#f97316' }} />;
    case 'exe': case 'dll': case 'so': case 'dylib': return <VscFileBinary size={14} style={{ color: '#64748b' }} />;
    default: return <VscFile size={14} style={{ opacity: 0.8 }} />;
  }
}


interface ContextMenuConfig {
  x: number;
  y: number;
  entry: WorkspaceEntry;
}

interface FileTreeItemProps {
  entry: WorkspaceEntry;
  depth: number;
  onContextMenu: (e: React.MouseEvent, entry: WorkspaceEntry) => void;
  refreshTrigger: number;
}

function FileTreeItem({ entry, depth, onContextMenu, refreshTrigger }: FileTreeItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<WorkspaceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { openFile } = useAppStore();

  const loadChildren = async () => {
    if (!entry.isDirectory) return;
    setIsLoading(true);
    try {
      const results = await readDirectory(entry.path);
      setChildren(results);
    } catch (err) {
      console.error('Failed to load sub-directory', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && entry.isDirectory) {
      loadChildren();
    }
  }, [isOpen, refreshTrigger, entry.path]);

  const toggleOpen = async () => {
    if (!entry.isDirectory) {
      const file = await openFileAsTab(entry.path);
      openFile(file);
      return;
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="tree-item-container">
      <button
        className={clsx('tree-item', { 'is-directory': entry.isDirectory, 'is-open': isOpen })}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        onClick={toggleOpen}
        onContextMenu={(e) => onContextMenu(e, entry)}
      >
        <span className="tree-item__icon" style={{ display: 'flex', alignItems: 'center' }}>
          {entry.isDirectory ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', opacity: 0.6, marginRight: '4px' }}>
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          ) : null}
          {entry.isDirectory ? (
            isOpen ? <FolderOpen size={14} style={{ color: '#60a5fa' }} /> : <Folder size={14} style={{ color: '#60a5fa' }} />
          ) : (
            getFileIcon(entry.name)
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
              <FileTreeItem 
                key={child.path} 
                entry={child} 
                depth={depth + 1} 
                onContextMenu={onContextMenu} 
                refreshTrigger={refreshTrigger}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function FileExplorer() {
  const { workspacePath, workspaceEntries, setWorkspacePath, setWorkspaceEntries } = useAppStore();
  const [contextMenu, setContextMenu] = useState<ContextMenuConfig | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleCloseWorkspace = () => {
    setWorkspacePath(undefined);
    setWorkspaceEntries([]);
  };

  const handleContextMenu = (e: React.MouseEvent, entry: WorkspaceEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const closeMenu = () => setContextMenu(null);

  const refreshWorkspace = async () => {
    if (!workspacePath) return;
    try {
      const results = await readDirectory(workspacePath);
      setWorkspaceEntries(results);
      setRefreshTrigger(v => v + 1);
    } catch {}
    closeMenu();
  };

  const runFileOp = async (cmdStr: string) => {
    try {
      const { executeTerminal } = await import('@/lib/tauri');
      const { workspacePath } = useAppStore.getState();
      if (workspacePath) {
        await executeTerminal({ cwd: workspacePath, command: `powershell -Command "${cmdStr}"` });
        setTimeout(() => refreshWorkspace(), 300);
      }
    } catch (e) {
      console.error("File op error", e);
    }
  };

  const handleRename = () => {
    if (!contextMenu) return;
    const newName = prompt('New name:', contextMenu.entry.name);
    if (newName && newName !== contextMenu.entry.name) {
       runFileOp(`Rename-Item -LiteralPath '${contextMenu.entry.path}' -NewName '${newName}'`);
    }
    closeMenu();
  };

  const handleDelete = () => {
    if (!contextMenu) return;
    if (confirm(`Are you sure you want to delete ${contextMenu.entry.name}?`)) {
       runFileOp(`Remove-Item -LiteralPath '${contextMenu.entry.path}' -Recurse -Force`);
    }
    closeMenu();
  };

  const handleNewFile = async () => {
    if (!contextMenu) return;
    const isDir = contextMenu.entry.isDirectory;
    const parentPath = isDir ? contextMenu.entry.path : contextMenu.entry.path.replace(/[\\/][^\\/]+$/, '');
    const newName = prompt('New file name:');
    if (newName) {
       const { writeWorkspaceFile } = await import('@/lib/tauri');
       try {
         await writeWorkspaceFile(`${parentPath}/${newName}`, '');
         setTimeout(() => refreshWorkspace(), 200);
       } catch (e) {
         runFileOp(`New-Item -Path '${parentPath}/${newName}' -ItemType File`);
       }
    }
    closeMenu();
  };

  const handleNewFolder = () => {
    if (!contextMenu) return;
    const isDir = contextMenu.entry.isDirectory;
    const parentPath = isDir ? contextMenu.entry.path : contextMenu.entry.path.replace(/[\\/][^\\/]+$/, '');
    const newName = prompt('New folder name:');
    if (newName) {
       runFileOp(`New-Item -Path '${parentPath}/${newName}' -ItemType Directory`);
    }
    closeMenu();
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
    <aside className="panel explorer-panel" onClick={closeMenu}>
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
      
      <div className="explorer-tree" onContextMenu={(e) => {
        // Workspace-level context menu
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, entry: { name: 'Root', path: workspacePath, isDirectory: true } })
      }}>
        {workspaceEntries.length === 0 ? (
          <div className="empty-state compact">No files found. Right click to create one.</div>
        ) : (
          workspaceEntries.map((entry: WorkspaceEntry) => (
            <FileTreeItem 
              key={entry.path} 
              entry={entry} 
              depth={0} 
              onContextMenu={handleContextMenu}
              refreshTrigger={refreshTrigger}
            />
          ))
        )}
      </div>

      {contextMenu && (
        <div 
          className="dropdown-menu" 
          style={{ top: contextMenu.y, left: contextMenu.x, width: '180px' }} 
          onClick={e => e.stopPropagation()}
        >
          <button className="dropdown-menu__item" onClick={handleNewFile}>New File...</button>
          <button className="dropdown-menu__item" onClick={handleNewFolder}>New Folder...</button>
          <div className="dropdown-menu__separator" />
          <button className="dropdown-menu__item" onClick={handleRename}>Rename</button>
          <button className="dropdown-menu__item" onClick={handleDelete} style={{ color: 'var(--danger)' }}>Delete</button>
        </div>
      )}
    </aside>
  );
}
