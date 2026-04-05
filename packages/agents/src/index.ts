import type { AgentActionLog, AgentMessage, ApprovalRequest, ProviderConfig } from '@antimatter/shared';
import { providerRegistry } from '@antimatter/providers';
import { builtInTools } from '@antimatter/tools';

export interface AgentRunContext {
  provider?: ProviderConfig;
  messages: AgentMessage[];
}

export interface AgentRunResult {
  reply: AgentMessage;
  logs: AgentActionLog[];
  approvalRequests: ApprovalRequest[];
}

export async function runSingleAgent(context: AgentRunContext): Promise<AgentRunResult> {
  const now = new Date().toISOString();
  const provider = context.provider;
  const logs: AgentActionLog[] = [
    {
      id: crypto.randomUUID(),
      kind: 'plan',
      title: 'Planned next step',
      detail: 'The agent reviewed the latest conversation and selected the next safe action.',
      createdAt: now
    },
    {
      id: crypto.randomUUID(),
      kind: 'info',
      title: 'Available tools',
      detail: builtInTools.map((tool) => `${tool.label} (${tool.risk})`).join(', '),
      createdAt: now
    }
  ];

  const content = provider
    ? await providerRegistry[provider.kind].createChat(
        {
          model: provider.model,
          messages: context.messages.map((message) => ({
            role: message.role === 'tool' ? 'assistant' : message.role,
            content: message.content
          }))
        },
        provider
      )
    : 'No provider is configured yet. Open Settings → Providers, add your API key or endpoint, choose a model, and try again.';

  return {
    reply: {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      createdAt: now
    },
    logs,
    approvalRequests: []
  };
}
