import { useState } from 'react';
import type { ProviderConfig, ProviderKind } from '@antimatter/shared';
import { providerDefaults } from '@antimatter/providers';
import { saveProvider, testProviderConnection } from '@/lib/tauri';
import { useAppStore } from '@/store/appStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ProviderSettingsModal({ open, onClose }: Props) {
  const { providerConfigs, upsertProviderConfig, setSelectedProviderId } = useAppStore();
  const template = providerDefaults[0];
  const [draft, setDraft] = useState<ProviderConfig>({
    id: crypto.randomUUID(),
    label: template.label,
    kind: template.kind,
    model: template.model,
    baseUrl: '',
    apiKeyStored: false,
    status: 'unknown',
    notes: template.notes
  });
  const [apiKey, setApiKey] = useState('');
  const [feedback, setFeedback] = useState('');

  if (!open) return null;

  const handleKindChange = (kind: ProviderKind) => {
    const preset = providerDefaults.find((entry) => entry.kind === kind)!;
    setDraft((current) => ({
      ...current,
      kind,
      label: preset.label,
      model: preset.model,
      notes: preset.notes
    }));
  };

  const handleSave = async () => {
    const next = { ...draft, apiKeyStored: Boolean(apiKey) || draft.apiKeyStored };
    await saveProvider(next, apiKey || undefined);
    upsertProviderConfig(next);
    setSelectedProviderId(next.id);
    setFeedback('Provider saved locally. Antimatter does not store bundled credentials.');
    setApiKey('');
  };

  const handleTest = async () => {
    const result = await testProviderConnection(draft, apiKey || undefined);
    setFeedback(result.message);
    setDraft((current) => ({ ...current, status: result.ok ? 'connected' : 'failed' }));
  };

  return (
    <div className="overlay">
      <div className="modal wide">
        <div className="panel__header">
          <div>
            <h3>Providers</h3>
            <p>Bring your own API key or endpoint. Antimatter does not provide the model itself.</p>
          </div>
          <button className="button subtle" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="provider-layout">
          <div className="provider-list">
            {providerConfigs.map((provider: ProviderConfig) => (
              <button key={provider.id} className="provider-card" onClick={() => setDraft(provider)}>
                <strong>{provider.label}</strong>
                <span>{provider.kind}</span>
                <span>Status: {provider.status}</span>
              </button>
            ))}
          </div>

          <div className="provider-form">
            <label>
              Provider kind
              <select value={draft.kind} onChange={(event) => handleKindChange(event.target.value as ProviderKind)}>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Gemini</option>
                <option value="groq">Groq</option>
                <option value="local">Local endpoint</option>
                <option value="openai-compatible">OpenAI-compatible endpoint</option>
              </select>
            </label>

            <label>
              Label
              <input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
            </label>

            <label>
              Model
              <input value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} />
            </label>

            <label>
              Base URL
              <input
                placeholder={draft.kind === 'groq' ? 'Defaults to https://api.groq.com/openai/v1' : 'Optional for managed providers, required for local/custom endpoints'}
                value={draft.baseUrl ?? ''}
                onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
              />
            </label>

            <label>
              API key
              <input
                type="password"
                placeholder="Stored securely where available"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>

            <label>
              Notes
              <textarea value={draft.notes ?? ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={4} />
            </label>

            <div className="row-actions">
              <button className="button subtle" onClick={handleTest}>
                Test connection
              </button>
              <button className="button primary" onClick={handleSave}>
                Save provider
              </button>
            </div>

            <div className="helper-text">{feedback}</div>
            {draft.kind === 'groq' && (
              <div className="helper-text">
                Groq provides ultra-fast inference, but model quality, speed, and availability still depend on Groq's infrastructure and the model you select.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
