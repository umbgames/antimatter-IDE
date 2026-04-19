import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { GitBranch, RefreshCw, Plus, Minus, Wand2 } from 'lucide-react';
import { getGitDiff, chatWithProvider } from '@/lib/tauri';

export function SourceControlPanel() {
  const { gitStatus, refreshGitStatus, workspacePath, selectedProviderId } = useAppStore();
  const [commitMessage, setCommitMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (workspacePath) {
      refreshGitStatus();
    }
  }, [workspacePath, refreshGitStatus]);

  const handleAISuggest = async () => {
    if (!workspacePath || !selectedProviderId) return;
    setIsGenerating(true);
    try {
      const hasStaged = (gitStatus?.staged.length ?? 0) > 0;
      const diff = await getGitDiff(workspacePath, hasStaged);
      
      if (!diff.trim()) {
        setCommitMessage('No changes to describe.');
        return;
      }

      const prompt = `Write a professional, concise git commit message for these changes. Use conventional commits format if appropriate. Return ONLY the message.
      
      DIFF:
      ${diff.slice(0, 4000)}`;

      const suggestion = await chatWithProvider(selectedProviderId, [
        { role: 'user', content: prompt }
      ]);
      setCommitMessage(suggestion.content?.trim() ?? '');
    } catch (e: any) {
      setCommitMessage(`Error generating message: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!workspacePath) {
    return <div className="empty-state compact">Open a folder to see source control.</div>;
  }

  if (!gitStatus) {
    return (
      <div className="empty-state compact">
        <p>This folder is not a git repository.</p>
        <button className="button primary" style={{ marginTop: '12px' }}>Initialize Repository</button>
      </div>
    );
  }

  return (
    <div className="search-panel">
      <div className="panel__header" style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <GitBranch size={14} className="text-muted" />
          <strong style={{ fontSize: '11px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{gitStatus.branch}</strong>
        </div>
        <button className="button-icon subtle" onClick={() => refreshGitStatus()}>
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="search-results" style={{ padding: '8px 0' }}>
        {gitStatus.staged.length > 0 && (
          <section style={{ marginBottom: '16px' }}>
            <h4 className="dropdown-menu__label" style={{ padding: '4px 12px', fontSize: '10px' }}>Staged Changes</h4>
            {gitStatus.staged.map((file) => (
              <div key={file.path} className="tree-item" style={{ padding: '4px 12px' }}>
                <Plus size={12} style={{ color: 'var(--success)' }} />
                <span className="tree-item__label">{file.path}</span>
              </div>
            ))}
          </section>
        )}

        {gitStatus.unstaged.length > 0 && (
          <section>
            <h4 className="dropdown-menu__label" style={{ padding: '4px 12px', fontSize: '10px' }}>Changes</h4>
            {gitStatus.unstaged.map((file) => (
              <div key={file.path} className="tree-item" style={{ padding: '4px 12px' }}>
                <Minus size={12} style={{ color: 'var(--warning)' }} />
                <span className="tree-item__label">{file.path}</span>
              </div>
            ))}
          </section>
        )}

        {gitStatus.staged.length === 0 && gitStatus.unstaged.length === 0 && (
          <div className="empty-state compact">No changes detected.</div>
        )}
      </div>

      <div className="agent-compose" style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
        <textarea 
          placeholder="Commit message (Enter to commit)" 
          style={{ minHeight: '60px', marginBottom: '8px' }}
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
        />
        <div className="row-actions">
           <button className="button primary" style={{ flex: 1 }} disabled={!commitMessage.trim()}>Commit</button>
           <button 
             className="button subtle" 
             onClick={handleAISuggest}
             disabled={isGenerating}
           >
             <Wand2 size={12} style={{ marginRight: '6px' }} />
             {isGenerating ? 'Thinking...' : 'AI Suggest'}
           </button>
        </div>
      </div>
    </div>
  );
}
