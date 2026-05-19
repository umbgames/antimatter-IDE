import type { ProviderConfig } from '@antimatter/shared';
import { useAppStore } from '@/store/appStore';
import { learnerEngine } from '@/services/LearnerEngine';
import { useSyncExternalStore } from 'react';

interface Props {
  onToggleProviders: () => void;
}

export function StatusBar({ onToggleProviders }: Props) {
  const { theme, workspacePath, openFiles, providerConfigs, selectedProviderId, indexingProgress } = useAppStore();
  const learnerModeEnabled = useAppStore(s => s.learnerModeEnabled);
  const activeFilePath = useAppStore(s => s.activeFilePath);
  const provider = providerConfigs.find((entry: ProviderConfig) => entry.id === selectedProviderId);

  // Subscribe to learner engine for live progress
  const sessions = useSyncExternalStore(
    (cb) => learnerEngine.subscribe(cb),
    () => learnerEngine.getSnapshot()
  );

  const activeSession = activeFilePath ? learnerEngine.getSession(activeFilePath) : undefined;
  const learnerProgress = activeFilePath ? learnerEngine.getProgress(activeFilePath) : 0;
  const learnerStatus = activeFilePath ? learnerEngine.getStatus(activeFilePath) : 'idle';

  return (
    <footer className="statusbar">
      <div className="statusbar__left">
        <span>{theme === 'dark' ? 'Dark' : 'Light'} theme</span>
        <span>{workspacePath ?? 'No workspace open'}</span>
        {indexingProgress.status !== 'idle' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {indexingProgress.status === 'indexing' && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="spin">
                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
                <path d="M12 2C6.48 2 2 6.48 2 12" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="2" r="2" fill="#ec4899" />
              </svg>
            )}
            {indexingProgress.status === 'indexing' 
              ? `Indexing: ${indexingProgress.current}/${indexingProgress.total} files` 
              : `Indexed ${indexingProgress.total} files`}
          </span>
        )}
      </div>
      <div className="statusbar__right">
        {/* ─── Learner Mode Indicator ─── */}
        {learnerModeEnabled && (
          <span className={`learner-statusbar-badge ${learnerStatus}`}>
            🎓 {learnerStatus === 'generating' 
              ? 'Generating...' 
              : learnerStatus === 'active' 
                ? `Learning ${learnerProgress}%` 
                : 'Learner Mode'}
          </span>
        )}
        <span>{openFiles.length} open tabs</span>
        <button className="status-link" onClick={onToggleProviders}>
          {provider ? `${provider.label} · ${provider.model}` : 'Configure provider'}
        </button>
      </div>
    </footer>
  );
}

