import type { AgentActionLog, AgentMessage, ApprovalRequest, ProviderConfig } from '@antimatter/shared';
import { providerRegistry } from '@antimatter/providers';
import { builtInTools } from '@antimatter/tools';

export interface AgentRunContext {
  provider?: ProviderConfig;
  messages: AgentMessage[];
  workspacePath?: string;
  persona?: 'engineer' | 'architect' | 'qa';
  createChat?: (request: { model: string; messages: { role: string; content: string }[] }, config: ProviderConfig) => Promise<string>;
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

const ENGINEER_PROMPT = `
You are the Antimatter Engineer. Your focus is on writing clean, efficient, and well-tested code.
You prioritize implementation details, bug fixes, and feature additions.
`;

const ARCHITECT_PROMPT = `
You are the Antimatter Architect. Your focus is on high-level system design, scalability, and technical debt.
You prioritize modularity, patterns, and overall project structure.
`;

const QA_PROMPT = `
You are the Antimatter QA. Your focus is on reliability, edge cases, and testing.
You prioritize finding bugs, writing test suites, and ensuring code quality.
`;

const BASE_SYSTEM_PROMPT = `
You are Antimatter, a powerful agentic IDE assistant built by UMB GAMES AND TECHNOLOGY LTD.
You help the user by reasoning through complex tasks and using tools to observe or modify the workspace.

AVAILABLE TOOLS:
${builtInTools.map(t => `- ${t.id}: ${t.description} (Risk: ${t.risk})`).join('\n')}

TOOL CALL FORMAT:
To use a tool, wrap the call in XML-like tags. For example:
<tool_call id="read-file">{"path": "src/main.rs"}</tool_call>
<tool_call id="patch-file">{"path": "src/main.ts", "replacements": [{"search": "old exact text", "replace": "new text"}]}</tool_call>

RULES:
1. Only call ONE tool at a time.
2. After a read-only tool call, you will automatically receive an <observation> and generation will loop back to you.
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

  logs.push({
    id: crypto.randomUUID(),
    kind: 'plan',
    title: 'Reasoning...',
    detail: 'Analyzing context and selecting next action.',
    createdAt: now
  });

  const personaPrompt = context.persona === 'architect' ? ARCHITECT_PROMPT : 
                        context.persona === 'qa' ? QA_PROMPT : ENGINEER_PROMPT;

  let loopCount = 0;
  const MAX_LOOPS = 8;

  while (loopCount < MAX_LOOPS) {
    loopCount++;
    try {
      const chatMessages = [
        { role: 'system', content: BASE_SYSTEM_PROMPT + "\n" + personaPrompt },
        ...currentMessages.map(m => ({ role: m.role as any, content: m.content }))
      ];

      let response: string;
      if (context.createChat) {
        response = await context.createChat({ model: provider.model, messages: chatMessages }, provider);
      } else {
        response = await providerRegistry[provider.kind].createChat({ model: provider.model, messages: chatMessages }, provider);
      }

      currentMessages.push({ id: crypto.randomUUID(), role: 'assistant', content: response, createdAt: new Date().toISOString() });

      const toolCallMatch = response.match(/<tool_call id="([^"]+)">([\s\S]*?)<\/tool_call>/);
      
      if (toolCallMatch) {
        const toolId = toolCallMatch[1];
        const toolArgsRaw = toolCallMatch[2];
        let toolArgs: any = {};
        try { 
          const cleaned = toolArgsRaw.replace(/```json/g, "").replace(/```/g, "").trim();
          toolArgs = JSON.parse(cleaned); 
        } catch (e) { /* ignore parse error */ }

        const tool = builtInTools.find(t => t.id === toolId);
        
        if (tool) {
          logs.push({
            id: crypto.randomUUID(),
            kind: 'tool',
            title: `Using ${tool.label}`,
            detail: `Args: ${JSON.stringify(toolArgs)}`,
            createdAt: new Date().toISOString()
          });

          if (tool.risk === 'approval-required' || tool.risk === 'guarded') {
            let diffPayload = undefined;
            
            if (toolId === 'write-file' || toolId === 'patch-file') {
               try {
                 const original = await executeTool('read-file', { path: toolArgs.path });
                 let proposed = toolArgs.content || '';
                 const origText = typeof original === 'string' ? original : '';
                 
                 if (toolId === 'patch-file' && Array.isArray(toolArgs.replacements)) {
                    proposed = origText;
                    for (const r of toolArgs.replacements) {
                      if (r.search && typeof r.replace === 'string') {
                         proposed = proposed.replace(r.search, r.replace);
                      }
                    }
                 }

                 diffPayload = {
                   filePath: toolArgs.path,
                   original: origText,
                   proposed
                 };
               } catch (e) {
                 diffPayload = {
                   filePath: toolArgs.path,
                   original: '',
                   proposed: toolArgs.content || ''
                 };
               }
            }

            return {
              reply: currentMessages[currentMessages.length - 1],
              logs,
              approvalRequests: [{
                id: crypto.randomUUID(),
                title: `Approve ${tool.label}`,
                description: `Agent wants to ${tool.description.toLowerCase()}`,
                risk: tool.risk === 'guarded' ? 'high' : 'medium',
                diff: diffPayload,
                toolCall: { toolId, args: toolArgs }
              }]
            };
          }

          // Execute read-only tools automatically internally and loop back
          try {
            const observation = await executeTool(toolId, toolArgs);
            currentMessages.push({
               id: crypto.randomUUID(),
               role: 'user', // We feed observation back as user to bypass typical LLM system limits
               content: `<observation>\n${JSON.stringify(observation, null, 2)}\n</observation>`,
               createdAt: new Date().toISOString()
            });
            continue;
          } catch (err: any) {
            logs.push({
              id: crypto.randomUUID(),
              kind: 'error',
              title: 'Tool execution failed',
              detail: err.message || String(err),
              createdAt: new Date().toISOString()
            });
            currentMessages.push({
               id: crypto.randomUUID(),
               role: 'user',
               content: `<error>\nTool failed: ${err.message || String(err)}\n</error>`,
               createdAt: new Date().toISOString()
            });
            continue;
          }
        }
      }

      break;

    } catch (err: any) {
      const errorDetail = err.message || String(err);
      return {
        reply: { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${errorDetail}`, createdAt: new Date().toISOString() },
        logs: [...logs, { id: crypto.randomUUID(), kind: 'error', title: 'Provider error', detail: errorDetail, createdAt: new Date().toISOString() }],
        approvalRequests: []
      };
    }
  }

  return {
    reply: currentMessages[currentMessages.length - 1] ?? { id: crypto.randomUUID(), role: 'assistant', content: 'Agent stopped unexpectedly.', createdAt: now },
    logs,
    approvalRequests: []
  };
}

// Keep the old export for backward compatibility if needed
export async function runSingleAgent(context: AgentRunContext): Promise<AgentRunResult> {
  return runAgentLoop(context, async () => ({ error: 'Use runAgentLoop for tool support' }));
}
