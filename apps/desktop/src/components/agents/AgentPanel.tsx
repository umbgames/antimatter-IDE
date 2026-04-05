import { useMemo, useState } from 'react';
import { builtInTools } from '@antimatter/tools';
import { useAppStore } from '@/store/appStore';
import { DiffPreviewCard } from './DiffPreviewCard';

interface Props {
  onSubmit: (prompt: string) => Promise<void>;
}

export function AgentPanel({ onSubmit }: Props) {
  const { messages, actionLogs, approvalRequests, providerConfigs, selectedProviderId, setSelectedProviderId } = useAppStore();
  const [prompt, setPrompt] = useState('Summarize the current file and suggest the next refactor.');
  const selectedProvider = useMemo(
    () => providerConfigs.find((provider) => provider.id === selectedProviderId),
    [providerConfigs, selectedProviderId]
  );

  return (
    <aside className="panel agent-panel">
      <div className="panel__header stacked-gap">
        <div>
          <h3>Agent</h3>
          <p>Single-agent workflow with explicit tools, logs, and approvals.</p>
        </div>
        <select value={selectedProviderId ?? ''} onChange={(event) => setSelectedProviderId(event.target.value || undefined)}>
          <option value="">No provider selected</option>
          {providerConfigs.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label} · {provider.model}
            </option>
          ))}
        </select>
      </div>

      <div className="agent-warning">
        Antimatter does not provide a model. Speed, latency, and quality depend on the provider, endpoint, or hardware you connect.
      </div>

      <div className="agent-section">
        <strong>Conversation</strong>
        <div className="message-list">
          {messages.map((message) => (
            <article key={message.id} className={`message message--${message.role}`}>
              <header>{message.role}</header>
              <p>{message.content}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="agent-section">
        <strong>Tools</strong>
        <div className="tool-pills">
          {builtInTools.map((tool) => (
            <span key={tool.id} className="pill">
              {tool.label}
            </span>
          ))}
        </div>
      </div>

      <div className="agent-section">
        <strong>Action log</strong>
        <div className="log-list">
          {actionLogs.length === 0 ? (
            <div className="empty-state compact">No actions yet.</div>
          ) : (
            actionLogs.map((log) => (
              <article key={log.id} className="log-entry">
                <header>{log.title}</header>
                <p>{log.detail}</p>
              </article>
            ))
          )}
        </div>
      </div>

      {approvalRequests.length > 0 && (
        <div className="agent-section">
          <strong>Approvals</strong>
          {approvalRequests.map((request) => (
            <DiffPreviewCard key={request.id} request={request} />
          ))}
        </div>
      )}

      <div className="agent-compose">
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} />
        <button
          className="button primary"
          onClick={() => {
            void onSubmit(prompt);
            setPrompt('');
          }}
        >
          Run agent
        </button>
        <div className="helper-text">Current provider: {selectedProvider ? `${selectedProvider.label} / ${selectedProvider.model}` : 'none selected'}</div>
      </div>
    </aside>
  );
}
