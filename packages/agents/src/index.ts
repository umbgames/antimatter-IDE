import type { AgentActionLog, AgentMessage, ApprovalRequest, ProviderConfig } from '@antimatter/shared';
import { providerRegistry } from '@antimatter/providers';
import { builtInTools } from '@antimatter/tools';

export interface AgentRunContext {
  provider?: ProviderConfig;
  messages: AgentMessage[];
  workspacePath?: string;
}

export interface AgentRunResult {
  reply: AgentMessage;
  logs: AgentActionLog[];
  approvalRequests: ApprovalRequest[];
}

export interface ToolCall {
  tool: string;
  args: Record<string, any>;
  raw: string;
}

const SYSTEM_PROMPT = `
You are Antimatter, a powerful agentic IDE assistant built by UMB GAMES AND TECHNOLOGY LTD.
You help the user by reasoning through complex tasks and using tools to observe or modify the workspace.

AVAILABLE TOOLS:
${builtInTools.map(t => `- ${t.id}: ${t.description} (Risk: ${t.risk})`).join('\n')}

TOOL CALL FORMAT:
To use a tool, wrap the call in XML-like tags. For example:
<tool_call id="read-file">{"path": "src/main.rs"}</tool_call>
<tool_call id="search-workspace">{"query": "todo"}</tool_call>

RULES:
1. Only call ONE tool at a time.
2. After a tool call, wait for the observation before continuing.
3. If you need to write or patch a file, explain WHY first.
4. Professional, technical, and concise tone.
5. "read-only" tools execute automatically. "approval-required" or "guarded" tools will stop for user permission.

Always start with a brief "Thought" about your current plan.
`;

export async function runAgentLoop(
  context: AgentRunContext,
  executeTool: (toolId: string, args: any) => Promise<any>
): Promise<AgentRunResult> {
  const now = new Date().toISOString();
  const logs: AgentActionLog[] = [];
  const currentMessages = [...context.messages];
  const provider = context.provider;

  if (!provider) {
    return {
      reply: { id: crypto.randomUUID(), role: 'assistant', content: 'No provider configured.', createdAt: now },
      logs,
      approvalRequests: []
    };
  }

  // Initial step: Log the start
  logs.push({
    id: crypto.randomUUID(),
    kind: 'plan',
    title: 'Reasoning...',
    detail: 'Analyzing context and selecting next action.',
    createdAt: now
  });

  try {
    const response = await providerRegistry[provider.kind].createChat(
      {
        model: provider.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...currentMessages.map(m => ({ role: m.role as any, content: m.content }))
        ]
      },
      provider
    );

    // 1. Parse for tool calls
    const toolCallMatch = response.match(/<tool_call id="([^"]+)">([\s\S]*?)<\/tool_call>/);
    
    if (toolCallMatch) {
      const toolId = toolCallMatch[1];
      const toolArgsRaw = toolCallMatch[2];
      let toolArgs = {};
      try { toolArgs = JSON.parse(toolArgsRaw); } catch (e) { /* ignore parse error */ }

      const tool = builtInTools.find(t => t.id === toolId);
      
      if (tool) {
        // Log the intent
        logs.push({
          id: crypto.randomUUID(),
          kind: 'tool',
          title: `Using ${tool.label}`,
          detail: `Args: ${JSON.stringify(toolArgs)}`,
          createdAt: new Date().toISOString()
        });

        // Handle approvals
        if (tool.risk === 'approval-required' || tool.risk === 'guarded') {
          return {
            reply: { id: crypto.randomUUID(), role: 'assistant', content: response, createdAt: now },
            logs,
            approvalRequests: [{
              id: crypto.randomUUID(),
              title: `Approve ${tool.label}`,
              description: `Agent wants to ${tool.description.toLowerCase()}`,
              risk: tool.risk === 'guarded' ? 'high' : 'medium',
              // Note: Ideally we'd calculate a diff here for file writes
            }]
          };
        }

        // Execute read-only tools automatically (Single step for now, recursion can vary)
        try {
          const observation = await executeTool(toolId, toolArgs);
          const fullReply = `${response}\n\n<observation>\n${JSON.stringify(observation, null, 2)}\n</observation>`;
          
          return {
            reply: { id: crypto.randomUUID(), role: 'assistant', content: fullReply, createdAt: now },
            logs,
            approvalRequests: []
          };
        } catch (err: any) {
          logs.push({
            id: crypto.randomUUID(),
            kind: 'error',
            title: 'Tool execution failed',
            detail: err.message || String(err),
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    return {
      reply: { id: crypto.randomUUID(), role: 'assistant', content: response, createdAt: now },
      logs,
      approvalRequests: []
    };

  } catch (err: any) {
    return {
      reply: { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${err.message}`, createdAt: now },
      logs: [...logs, { id: crypto.randomUUID(), kind: 'error', title: 'Provider error', detail: err.message, createdAt: now }],
      approvalRequests: []
    };
  }
}

// Keep the old export for backward compatibility if needed
export async function runSingleAgent(context: AgentRunContext): Promise<AgentRunResult> {
  return runAgentLoop(context, async () => ({ error: 'Use runAgentLoop for tool support' }));
}
