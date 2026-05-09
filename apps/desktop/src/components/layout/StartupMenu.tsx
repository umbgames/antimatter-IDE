import type { RecentProject } from '@antimatter/shared';
import { useAppStore } from '@/store/appStore';
import { openFolderPicker, readDirectory, saveRecentProject } from '@/lib/tauri';
import { FolderOpen, FilePlus, HardDrive } from 'lucide-react';
import logo from '@/assets/logo.svg';

export function StartupMenu() {
  const recentProjects = useAppStore(s => s.recentProjects);
  const setWorkspace = useAppStore(s => s.setWorkspace);
  const setRecentProjects = useAppStore(s => s.setRecentProjects);
  const setWelcomeVisible = useAppStore(s => s.setWelcomeVisible);

  const handleOpenFolder = async () => {
    try {
      const path = await openFolderPicker();
      if (path) {
        // Read directory FIRST
        const entries = await readDirectory(path);
        // Batch update workspace state
        setWorkspace(path, entries);
        await saveRecentProject(path);

        // Refresh recent projects list
        const tauri = await import('@/lib/tauri');
        const updated = await tauri.getRecentProjects();
        setRecentProjects(updated);
      }
    } catch (error) {
      console.error('Failed to open folder', error);
    }
  };

  const handleRecentClick = async (path: string) => {
    try {
      const entries = await readDirectory(path);
      setWorkspace(path, entries);
      await saveRecentProject(path);
    } catch (error) {
      console.error('Failed to open recent project', error);
    }
  };

  const handleEmptyWorkspace = () => {
    setWorkspace('', []);
    setWelcomeVisible(true);
  };

  const sortedProjects = [...recentProjects].sort((a, b) =>
    new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime()
  ).slice(0, 5);

  return (
    <div className="overlay startup-overlay">
      <div className="modal startup-menu">
        <div className="hero-card">
          <div className="eyebrow">UMB GAMES AND TECHNOLOGY LTD</div>
          <div className="startup-logo">
            <img src={logo} alt="Antimatter Logo" style={{ width: '64px', height: '64px', marginBottom: '16px' }} />
          </div>
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
          {sortedProjects.length === 0 ? (
            <div className="empty-state compact">No recent workspaces found.</div>
          ) : (
            <div className="recent-list">
              {sortedProjects.map((project: RecentProject) => (
                <button
                  key={project.path}
                  className="recent-item startup-recent-item"
                  onClick={() => handleRecentClick(project.path)}
                >
                  <div className="recent-item-info" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HardDrive size={16} className="text-secondary" />
                    <div style={{ textAlign: 'left' }}>
                      <strong style={{ display: 'block' }}>{project.name}</strong>
                      <span style={{ display: 'block', fontSize: '11px', opacity: 0.6, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {project.path}
                      </span>
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
