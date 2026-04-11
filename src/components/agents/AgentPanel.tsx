import { useState } from 'react';
import type { AgentActionLog, AgentMessage, ApprovalRequest, ProviderConfig } from '@antimatter/shared';
import { useAppStore } from '@/store/appStore';
import { DiffPreviewCard } from './DiffPreviewCard';
import { Send, Bot, User, TerminalSquare } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  onSubmit: (prompt: string) => Promise<void>;
}

export function AgentPanel({ onSubmit }: Props) {
  const { messages, actionLogs, approvalRequests, providerConfigs, selectedProviderId, setSelectedProviderId, activePersona, setActivePersona } = useAppStore();
  const [prompt, setPrompt] = useState('');

  return (
    <aside className="panel agent-panel">
      <div className="panel__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bot size={16} className="text-secondary" />
          <h3>Agent</h3>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <select 
            className="settings-select" 
            style={{ maxWidth: '100px', padding: '2px 4px', fontSize: '11px' }} 
            value={activePersona} 
            onChange={(event) => setActivePersona(event.target.value as any)}
          >
            <option value="engineer">Engineer</option>
            <option value="architect">Architect</option>
            <option value="qa">QA</option>
          </select>
          <select 
            className="settings-select" 
            style={{ maxWidth: '120px', padding: '2px 4px', fontSize: '11px' }} 
            value={selectedProviderId ?? ''} 
            onChange={(event) => setSelectedProviderId(event.target.value || undefined)}
          >
            <option value="">Select provider</option>
            {providerConfigs.map((provider: ProviderConfig) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="agent-scroll-area" style={{ flex: 1, overflowY: 'auto' }}>
        <div className="agent-section">
          <div className="message-list">
            {messages.length === 0 ? (
               <div className="empty-state compact">How can I help you today?</div>
            ) : (
              messages.map((message: AgentMessage) => (
                <article key={message.id} className={clsx('message', `message--${message.role}`, { 'message--error': message.role === 'assistant' && message.content.startsWith('Error:') })}>
                  <header style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {message.role === 'assistant' || message.role === 'tool' ? <Bot size={12} /> : <User size={12} />}
                    {message.role === 'assistant' && message.content.startsWith('Error:') ? 'System Error' : message.role}
                  </header>
                  <p>{message.content}</p>
                </article>
              ))
            )}
          </div>
        </div>

        {actionLogs.length > 0 && (
          <div className="agent-section">
            <strong style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><TerminalSquare size={12}/> Action Log</strong>
            <div className="log-list">
              {actionLogs.map((log: AgentActionLog) => (
                <article key={log.id} className="log-entry">
                  <header>{log.title}</header>
                  <p>{log.detail}</p>
                </article>
              ))}
            </div>
          </div>
        )}

        {approvalRequests.length > 0 && (
          <div className="agent-section">
            <strong>Approvals</strong>
            {approvalRequests.map((request: ApprovalRequest) => (
              <DiffPreviewCard key={request.id} request={request} />
            ))}
          </div>
        )}
      </div>

      <div className="agent-compose">
        <textarea 
          value={prompt} 
          onChange={(event) => setPrompt(event.target.value)} 
          placeholder="Ask the agent to build something..."
          rows={3} 
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            className="button primary"
            disabled={!prompt.trim() || !selectedProviderId}
            onClick={() => {
              void onSubmit(prompt);
              setPrompt('');
            }}
          >
            <Send size={14} style={{ marginRight: '6px' }} /> Run agent
          </button>
        </div>
      </div>
    </aside>
  );
}
