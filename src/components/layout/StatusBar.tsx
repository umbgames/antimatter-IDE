import type { ProviderConfig } from '@antimatter/shared';
import { useAppStore } from '@/store/appStore';

interface Props {
  onToggleProviders: () => void;
}

export function StatusBar({ onToggleProviders }: Props) {
  const { theme, workspacePath, openFiles, providerConfigs, selectedProviderId } = useAppStore();
  const provider = providerConfigs.find((entry: ProviderConfig) => entry.id === selectedProviderId);

  return (
    <footer className="statusbar">
      <div className="statusbar__left">
        <span>{theme === 'dark' ? 'Dark' : 'Light'} theme</span>
        <span>{workspacePath ?? 'No workspace open'}</span>
      </div>
      <div className="statusbar__right">
        <span>{openFiles.length} open tabs</span>
        <button className="status-link" onClick={onToggleProviders}>
          {provider ? `${provider.label} · ${provider.model}` : 'Configure provider'}
        </button>
      </div>
    </footer>
  );
}
