import { useState, useRef, useEffect, useCallback } from 'react';
import type { AgentActionLog, AgentMessage, ApprovalRequest, ProviderConfig } from '@antimatter/shared';
import { useAppStore } from '@/store/appStore';
import { DiffPreviewCard } from './DiffPreviewCard';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Send, User, TerminalSquare, Trash2, ChevronDown, ChevronRight, ListTodo, FileCode2 } from 'lucide-react';
import logo from '@/assets/logo.svg';
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
    isAgentRunning, clearConversation, sessionTokens, aiEdits
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
          <div className="brand-mark" style={{ width: '16px', height: '16px' }}>
             <img src={logo} alt="Antimatter" />
          </div>
          <h3>Agent</h3>
          {isAgentRunning && (
            <div className="agent-running-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="spin">
                <circle cx="12" cy="12" r="10" stroke="rgba(99, 102, 241, 0.2)" strokeWidth="2" />
                <path d="M12 2C6.48 2 2 6.48 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="2" r="2" fill="#ec4899" />
              </svg>
              <span>Working</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {sessionTokens > 0 && (
            <div className="token-counter" style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '4px' }} title="Tokens used this session">
              {sessionTokens.toLocaleString()} tkns
            </div>
          )}
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
                   <img src={logo} alt="Antimatter" style={{ width: '48px', height: '48px', opacity: 0.8, marginBottom: '16px' }} />
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

                // Handle plan blocks
                const planMatch = content.match(/<plan>([\s\S]*?)<\/plan>/);
                const isPlanning = content.includes('<plan>') && !content.includes('</plan>');
                displayContent = displayContent.replace(/<plan>[\s\S]*?<\/plan>/g, '').trim();
                if (isPlanning) {
                  displayContent = displayContent.replace(/<plan>[\s\S]*/, '').trim();
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
                        {isAssistant ? (
                          <div style={{ width: '12px', height: '12px' }}>
                            <img src={logo} alt="A" style={{ width: '100%', height: '100%' }} />
                          </div>
                        ) : <User size={12} />}
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
                      {(planMatch || isPlanning) && (
                        <div className="strategy-board" style={{ margin: '8px 0', padding: '12px', background: 'var(--surface-sunken)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--accent)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            <ListTodo size={14} /> Active Strategy
                            {isPlanning && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="spin" style={{ marginLeft: 'auto' }}>
                                <circle cx="12" cy="12" r="10" stroke="rgba(99, 102, 241, 0.2)" strokeWidth="2" />
                                <path d="M12 2C6.48 2 2 6.48 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                            )}
                          </div>
                          <div className="strategy-content" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            <MarkdownRenderer content={planMatch ? planMatch[1].trim() : content.split('<plan>')[1].trim()} />
                          </div>
                        </div>
                      )}
                      {isThinking && (
                        <div className="thinking-indicator">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="spin">
                            <circle cx="12" cy="12" r="10" stroke="rgba(99, 102, 241, 0.2)" strokeWidth="2" />
                            <path d="M12 2C6.48 2 2 6.48 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                          Thinking...
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
                    <div style={{ width: '12px', height: '12px' }}>
                      <img src={logo} alt="A" style={{ width: '100%', height: '100%' }} />
                    </div>
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

        {/* AI File Edits Summary */}
        {Object.keys(aiEdits).length > 0 && (
          <div className="agent-section">
            <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileCode2 size={12} /> AI Edits Summary
            </strong>
            <div className="log-list" style={{ marginTop: '4px' }}>
              {Object.entries(aiEdits).map(([path, stats]: any) => {
                const fileName = path.split(/[\\/]/).pop();
                return (
                  <div key={path} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', background: 'var(--bg-muted)', padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <span title={path} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px', color: 'var(--text-secondary)' }}>{fileName}</span>
                    <div style={{ display: 'flex', gap: '6px', fontWeight: 500 }}>
                      <span style={{ color: 'var(--success)' }}>+{stats.addedCount}</span>
                      <span style={{ color: 'var(--danger)' }}>-{stats.removedCount}</span>
                    </div>
                  </div>
                );
              })}
            </div>
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
        <div style={{ position: 'relative' }}>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={isAgentRunning ? 'Agent is working...' : 'Ask anything... (Enter to send, Shift+Enter for newline)'}
            rows={1}
            disabled={isAgentRunning}
            className="agent-textarea"
            style={{ paddingRight: '40px' }}
          />
          <button
            className="chat-send-icon-btn"
            disabled={!prompt.trim() || !selectedProviderId || isAgentRunning}
            onClick={() => {
              void onSubmit(prompt);
              setPrompt('');
              if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
              }
            }}
            style={{
              position: 'absolute',
              right: '8px',
              bottom: '8px',
              background: 'transparent',
              border: 'none',
              padding: '4px',
              cursor: (!prompt.trim() || !selectedProviderId || isAgentRunning) ? 'default' : 'pointer',
              color: (!prompt.trim() || !selectedProviderId || isAgentRunning) ? 'var(--text-muted)' : 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: (!prompt.trim() || !selectedProviderId || isAgentRunning) ? 0.5 : 1
            }}
          >
            {isAgentRunning ? (
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="spin">
                <circle cx="12" cy="12" r="10" stroke="rgba(99, 102, 241, 0.2)" strokeWidth="2" />
                <path d="M12 2C6.48 2 2 6.48 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : <Send size={16} />}
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
          <span className="helper-text" style={{ fontSize: '11px', color: 'var(--danger)' }}>
            {selectedProviderId ? '' : '⚠ Select a provider first'}
          </span>
        </div>
      </div>
    </aside>
  );
}
