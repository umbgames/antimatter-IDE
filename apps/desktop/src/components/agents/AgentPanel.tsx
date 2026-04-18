import { useState, useRef, useEffect, useCallback } from 'react';
import type { AgentActionLog, AgentMessage, ApprovalRequest, ProviderConfig } from '@antimatter/shared';
import { useAppStore } from '@/store/appStore';
import { DiffPreviewCard } from './DiffPreviewCard';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Send, Bot, User, TerminalSquare, Trash2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  onSubmit: (prompt: string) => Promise<void>;
  onApprove: (request: ApprovalRequest) => Promise<void>;
  onReject: (request: ApprovalRequest) => void;
}

export function AgentPanel({ onSubmit, onApprove, onReject }: Props) {
  const {
    messages, actionLogs, approvalRequests, providerConfigs,
    selectedProviderId, setSelectedProviderId,
    activePersona, setActivePersona,
    isAgentRunning, clearConversation
  } = useAppStore();

  const [prompt, setPrompt] = useState('');
  const [logsCollapsed, setLogsCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      // Only auto-scroll if user is near the bottom
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      if (isNearBottom) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [messages, actionLogs]);

  // Auto-resize textarea
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  // Submit on Enter (Shift+Enter for newline)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim() && selectedProviderId && !isAgentRunning) {
        void onSubmit(prompt);
        setPrompt('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    }
  }, [prompt, selectedProviderId, isAgentRunning, onSubmit]);

  // Filter out system messages for display
  const displayMessages = messages.filter(m => m.role !== 'system');

  return (
    <aside className="panel agent-panel">
      <div className="panel__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bot size={16} className="text-secondary" />
          <h3>Agent</h3>
          {isAgentRunning && (
            <div className="agent-running-badge">
              <Loader2 size={12} className="spin" />
              <span>Working</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button
            className="button subtle"
            style={{ padding: '2px 6px', fontSize: '11px' }}
            onClick={clearConversation}
            title="Clear conversation"
          >
            <Trash2 size={12} />
          </button>
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

      <div className="agent-scroll-area" ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
        <div className="agent-section">
          <div className="message-list">
            {displayMessages.length === 0 ? (
               <div className="empty-state compact">
                 <div style={{ textAlign: 'center' }}>
                   <Bot size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                   <p>How can I help you today?</p>
                   <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                     I can create files, run commands, analyze code, and more.
                   </p>
                 </div>
               </div>
            ) : (
              displayMessages.map((message: AgentMessage) => {
                const content = message.content;

                // Handle thought blocks
                const thoughtMatch = content.match(/<thought>([\s\S]*?)<\/thought>/);
                const isThinking = content.includes('<thought>') && !content.includes('</thought>');
                let displayContent = content.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim();
                if (isThinking) {
                  displayContent = displayContent.replace(/<thought>[\s\S]*/, '').trim();
                }

                // Hide observation/error messages from display
                if (content.startsWith('<observation>') || content.startsWith('<error>')) {
                  return null;
                }

                // Strip tool_call XML from display
                displayContent = displayContent.replace(/<tool_call[\s\S]*?<\/tool_call>/g, '').trim();

                const isError = message.role === 'assistant' && message.content.startsWith('Error:');
                const isAssistant = message.role === 'assistant' || message.role === 'tool';

                return (
                  <article
                    key={message.id}
                    className={clsx('message', `message--${message.role}`, {
                      'message--error': isError,
                      'message--assistant': isAssistant,
                      'message--user': message.role === 'user'
                    })}
                  >
                    <header className="message-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isAssistant ? <Bot size={12} /> : <User size={12} />}
                        <span>{isError ? 'Error' : isAssistant ? 'Antimatter' : 'You'}</span>
                      </div>
                      <span className="message-time">
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </header>

                    <div className="message-body">
                      {thoughtMatch && (
                        <details className="thought-block">
                          <summary>💭 Thought Process</summary>
                          <div className="thought-content">{thoughtMatch[1].trim()}</div>
                        </details>
                      )}
                      {isThinking && (
                        <div className="thinking-indicator">
                          <Loader2 size={12} className="spin" /> Thinking...
                        </div>
                      )}
                      {displayContent && (
                        isAssistant
                          ? <MarkdownRenderer content={displayContent} />
                          : <p className="md-paragraph">{displayContent}</p>
                      )}
                    </div>
                  </article>
                );
              })
            )}

            {/* Streaming / typing indicator */}
            {isAgentRunning && (
              <div className="message message--assistant message--streaming">
                <header className="message-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bot size={12} />
                    <span>Antimatter</span>
                  </div>
                </header>
                <div className="message-body">
                  <div className="typing-dots">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Logs - Collapsible */}
        {actionLogs.length > 0 && (
          <div className="agent-section">
            <button
              className="log-toggle"
              onClick={() => setLogsCollapsed(!logsCollapsed)}
            >
              {logsCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              <TerminalSquare size={12} />
              <span>Action Log ({actionLogs.length})</span>
            </button>
            {!logsCollapsed && (
              <div className="log-list">
                {actionLogs.slice(0, 20).map((log: AgentActionLog) => {
                  const kindColor =
                    log.kind === 'error' ? 'var(--danger)' :
                    log.kind === 'success' ? 'var(--success)' :
                    log.kind === 'tool' ? 'var(--accent)' :
                    'var(--text-muted)';
                  const kindIcon =
                    log.kind === 'error' ? '✗' :
                    log.kind === 'success' ? '✓' :
                    log.kind === 'tool' ? '⚙' :
                    '→';

                  return (
                    <article
                      key={log.id}
                      className="log-entry"
                      style={{ borderLeftColor: kindColor }}
                    >
                      <header>
                        <span style={{ color: kindColor, fontWeight: 600 }}>{kindIcon}</span>
                        {log.title}
                      </header>
                      <p style={{ color: log.kind === 'error' ? 'var(--danger)' : undefined }}>
                        {log.detail.length > 300 ? log.detail.slice(0, 300) + '…' : log.detail}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Approval Requests */}
        {approvalRequests.length > 0 && (
          <div className="agent-section">
            <strong>Approvals</strong>
            {approvalRequests.map((request: ApprovalRequest) => (
              <DiffPreviewCard key={request.id} request={request} onApprove={onApprove} onReject={onReject} />
            ))}
          </div>
        )}
      </div>

      {/* Compose Area */}
      <div className="agent-compose">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder={isAgentRunning ? 'Agent is working...' : 'Ask anything... (Enter to send, Shift+Enter for newline)'}
          rows={1}
          disabled={isAgentRunning}
          className="agent-textarea"
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="helper-text">
            {selectedProviderId ? '' : '⚠ Select a provider first'}
          </span>
          <button
            className="button primary"
            disabled={!prompt.trim() || !selectedProviderId || isAgentRunning}
            onClick={() => {
              void onSubmit(prompt);
              setPrompt('');
              if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
              }
            }}
          >
            {isAgentRunning ? (
              <><Loader2 size={14} className="spin" style={{ marginRight: '6px' }} /> Working...</>
            ) : (
              <><Send size={14} style={{ marginRight: '6px' }} /> Send</>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
