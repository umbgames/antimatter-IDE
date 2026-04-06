import type { RecentProject } from '@antimatter/shared';
import { useAppStore } from '@/store/appStore';
import { openFolderPicker, readDirectory, saveRecentProject } from '@/lib/tauri';
import { FolderOpen, FilePlus, HardDrive } from 'lucide-react';

export function StartupMenu() {
  const { recentProjects, setWorkspacePath, setWorkspaceEntries, setRecentProjects } = useAppStore();

  const handleOpenFolder = async () => {
    const path = await openFolderPicker();
    if (path) {
      const entries = await readDirectory(path);
      setWorkspacePath(path);
      setWorkspaceEntries(entries);
      await saveRecentProject(path);
      // Refresh recent projects list
      const updated = await import('@/lib/tauri').then(m => m.getRecentProjects());
      setRecentProjects(updated);
    }
  };

  const handleRecentClick = async (path: string) => {
    try {
      const entries = await readDirectory(path);
      setWorkspacePath(path);
      setWorkspaceEntries(entries);
      await saveRecentProject(path);
    } catch (error) {
      console.error('Failed to open recent project', error);
      // Optionally remove from list if not found
    }
  };

  const handleEmptyWorkspace = () => {
    setWorkspacePath('');
    setWorkspaceEntries([]);
    useAppStore.setState({ welcomeVisible: true });
  };

  return (
    <div className="overlay startup-overlay">
      <div className="modal startup-menu">
        <div className="hero-card">
          <div className="eyebrow">UMB GAMES AND TECHNOLOGY LTD</div>
          <h1>Antimatter</h1>
          <p>The local-first agentic IDE. Select a workspace to begin.</p>
          
          <div className="row-actions startup-actions">
            <button className="button primary large" onClick={handleOpenFolder}>
              <FolderOpen size={16} /> Open Folder...
            </button>
            <button className="button subtle large" onClick={handleEmptyWorkspace}>
              <FilePlus size={16} /> New Empty Workspace
            </button>
          </div>
        </div>

        <div className="startup-recent">
          <h3>Recent Workspaces</h3>
          {recentProjects.length === 0 ? (
            <div className="empty-state compact">No recent workspaces found.</div>
          ) : (
            <div className="recent-list">
              {recentProjects.map((project: RecentProject) => (
                <button 
                  key={project.path} 
                  className="recent-item startup-recent-item"
                  onClick={() => handleRecentClick(project.path)}
                >
                  <div className="recent-item-info" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HardDrive size={16} className="text-secondary" />
                    <div>
                      <strong>{project.name}</strong>
                      <span style={{ display: 'block' }}>{project.path}</span>
                    </div>
                  </div>
                  <span className="recent-item-date">{new Date(project.lastOpenedAt).toLocaleDateString()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
