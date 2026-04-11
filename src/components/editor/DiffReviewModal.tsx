import { DiffEditor } from '@monaco-editor/react';
import { useAppStore } from '@/store/appStore';
import { writeWorkspaceFile } from '@/lib/tauri';
import { Check, X, AlertTriangle } from 'lucide-react';

export function DiffReviewModal() {
  const { pendingChange, setPendingChange, openFiles, saveFileLocallyMarked, theme } = useAppStore();

  if (!pendingChange) return null;

  const handleAccept = async () => {
    // 1. Write to file (Auto-save requirement)
    await writeWorkspaceFile(pendingChange.filePath, pendingChange.proposed);
    
    // 2. Mark as clean in store
    saveFileLocallyMarked(pendingChange.filePath);
    
    // 3. Update editor content if open
    const openFile = openFiles.find(f => f.path === pendingChange.filePath);
    if (openFile) {
      useAppStore.getState().updateOpenFileContent(pendingChange.filePath, pendingChange.proposed);
    }

    // 4. Close modal
    setPendingChange(undefined);
  };

  const handleDecline = () => {
    setPendingChange(undefined);
  };

  return (
    <div className="overlay">
      <div className="modal" style={{ width: '90vw', height: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="panel__header" style={{ padding: '12px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="brand-mark" style={{ background: 'var(--warning)' }}>
               <AlertTriangle size={14} />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Review AI Proposal</h3>
              <p style={{ display: 'block', fontSize: '11px', opacity: 0.7 }}>
                The agent wants to modify <strong>{pendingChange.filePath.split(/[\\/]/).pop()}</strong>. Review the changes below.
              </p>
            </div>
          </div>
          <div className="row-actions">
            <button className="button subtle" onClick={handleDecline}>
              <X size={14} style={{ marginRight: '6px' }} />
              Decline
            </button>
            <button className="button primary" onClick={handleAccept}>
              <Check size={14} style={{ marginRight: '6px' }} />
              Accept Changes
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, background: 'var(--bg-panel)' }}>
          <DiffEditor
            height="100%"
            original={pendingChange.original}
            modified={pendingChange.proposed}
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            options={{
              renderSideBySide: true,
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              automaticLayout: true,
              scrollBeyondLastLine: false,
              padding: { top: 12 }
            }}
          />
        </div>
      </div>
    </div>
  );
}
