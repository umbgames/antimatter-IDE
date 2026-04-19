import type { AgentActionLog, AgentMessage, ApprovalRequest, ProviderConfig } from '@antimatter/shared';
import { providerRegistry } from '@antimatter/providers';
import type { ChatResponse } from '@antimatter/providers';
import { builtInTools, toOpenAITools } from '@antimatter/tools';

export interface AgentRunContext {
  provider?: ProviderConfig;
  messages: AgentMessage[];
  workspacePath?: string;
  persona?: 'engineer' | 'architect' | 'qa';
  createChat?: (
    request: { model: string; messages: { role: string; content: string; tool_calls?: any[]; tool_call_id?: string; name?: string }[]; tools?: any[] },
    config: ProviderConfig
  ) => Promise<ChatResponse>;
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

// ─── Persona Prompts ───

const ENGINEER_PROMPT = `
## Your Persona: Engineer
Focus on writing clean, efficient, and well-tested code. Prioritize implementation details, bug fixes, feature additions, and getting things done. When asked to create something, DO IT immediately using tools — don't just describe what you would do.
`;

const ARCHITECT_PROMPT = `
## Your Persona: Architect
Focus on high-level system design, scalability, and technical debt. Prioritize modularity, design patterns, and overall project structure. When reviewing code, analyze dependencies, coupling, and suggest improvements.
`;

const QA_PROMPT = `
## Your Persona: QA Engineer
Focus on reliability, edge cases, and testing. Prioritize finding bugs, writing test suites, and ensuring code quality. Use analyze-file and grep-search to look for potential issues.
`;

// ─── System Prompt ───

function buildSystemPrompt(): string {
  const toolDocs = builtInTools.map(t => {
    const schema = t.schema ? `  Schema: ${t.schema}` : '';
    return `### ${t.id} — ${t.label}\n  ${t.description}\n${schema}`;
  }).join('\n\n');

  return `
# Antimatter IDE Agent

You are **Antimatter**, a powerful agentic IDE assistant built by UMB GAMES AND TECHNOLOGY LTD.
You operate inside a desktop IDE and can directly read, write, and modify files, run terminal commands, analyze code, search the web, and more.

## Core Rules

1. **Act, don't describe.** When asked to create a file, write code, or run a command — DO IT using the available tools. Never just show code in your response without also writing it to a file.
2. **Use tools aggressively.** Call tools whenever you need to interact with the workspace. You can call tools either via native function calling OR via the XML format below — use whichever your architecture supports.
3. **Think briefly, then act.** Start each response with a one-line thought, then immediately use a tool.
4. **Be precise with paths.** Use the workspace path as the root. If the workspace is at \`C:/projects/myapp\`, a file at \`src/index.ts\` should be \`C:/projects/myapp/src/index.ts\`.
5. **Use terminal-exec freely.** You have direct terminal access. Use it for: installing packages (npm/pip/cargo), running builds, running tests, git commands, file system operations, or anything else needed.
6. **Analyze before modifying.** When working on existing code, use read-file or analyze-file first to understand the current state before making changes.
7. **Professional tone.** Be concise, technical, and helpful. No unnecessary chatter.

## Tool Call Format (XML Fallback)

If you do NOT support native function/tool calling, use this exact XML format:
\`\`\`
<tool_call id="tool-id">{"key": "value"}</tool_call>
\`\`\`

The JSON must be valid. The tool_call tag must be on its own line.

## Available Tools

${toolDocs}

## Tool Usage Examples

**Create a file:**
<tool_call id="write-file">{"path": "C:/projects/myapp/index.html", "content": "<!DOCTYPE html>\\n<html>\\n<head><title>Hello</title></head>\\n<body><h1>Hello World</h1></body>\\n</html>"}</tool_call>

**Read a file:**
<tool_call id="read-file">{"path": "C:/projects/myapp/src/main.ts"}</tool_call>

**Run terminal command:**
<tool_call id="terminal-exec">{"command": "npm install express"}</tool_call>

**Search codebase:**
<tool_call id="grep-search">{"pattern": "useState", "include": "*.tsx"}</tool_call>

**Analyze a file:**
<tool_call id="analyze-file">{"path": "C:/projects/myapp/src/App.tsx"}</tool_call>

**Analyze project structure:**
<tool_call id="analyze-project">{}</tool_call>

**List directory:**
<tool_call id="list-directory">{"path": "C:/projects/myapp/src", "recursive": true, "maxDepth": 3}</tool_call>

**Patch existing file (search and replace):**
<tool_call id="patch-file">{"path": "C:/projects/myapp/src/main.ts", "replacements": [{"search": "console.log('old')", "replace": "console.log('new')"}]}</tool_call>

**Fetch documentation from the web:**
<tool_call id="fetch-url">{"url": "https://docs.example.com/api"}</tool_call>

**Delete a file:**
<tool_call id="delete-file">{"path": "C:/projects/myapp/temp.txt"}</tool_call>

**Rename / move a file:**
<tool_call id="rename-file">{"from": "C:/projects/myapp/old.ts", "to": "C:/projects/myapp/src/new.ts"}</tool_call>

**Find and replace across files:**
<tool_call id="bulk-replace">{"search": "oldFunction", "replace": "newFunction", "include": "*.ts"}</tool_call>

## Workflow Patterns

**Creating a new project file:**
1. Think about what to create
2. Use write-file to create it immediately
3. If needed, use terminal-exec to install dependencies

**Modifying existing code:**
1. Use read-file or analyze-file to understand current code
2. Use patch-file for targeted changes, or write-file for full rewrites
3. Optionally run tests via terminal-exec

**Debugging:**
1. Use analyze-file to find issues
2. Use grep-search to find related code
3. Use read-file to examine specific files
4. Apply fixes with patch-file

**Building/Running:**
1. Use terminal-exec to run any command: npm/yarn/cargo/python/git
2. Read the output and fix any issues

Remember: You have FULL access to the terminal and file system. Use it. Don't ask for permission — just do it.
`;
}

// ─── Tool Call Parser (XML Fallback) ───

function parseToolCall(response: string): { toolId: string; args: any } | null {
  // Strategy 1: Standard XML format <tool_call id="...">...</tool_call>
  const xmlMatch = response.match(/<tool_call\s+id=["']([^"']+)["']\s*>([\s\S]*?)<\/tool_call>/);
  if (xmlMatch) {
    const toolId = xmlMatch[1];
    const raw = xmlMatch[2].trim();
    try {
      const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      return { toolId, args: JSON.parse(cleaned) };
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { return { toolId, args: JSON.parse(jsonMatch[0]) }; } catch { /* next strategy */ }
      }
    }
  }

  // Strategy 2: Backtick-wrapped
  const backtickMatch = response.match(/```(?:xml|tool)?\s*<tool_call\s+id=["']([^"']+)["']\s*>([\s\S]*?)<\/tool_call>\s*```/);
  if (backtickMatch) {
    const toolId = backtickMatch[1];
    const raw = backtickMatch[2].trim();
    try {
      const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      return { toolId, args: JSON.parse(cleaned) };
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { return { toolId, args: JSON.parse(jsonMatch[0]) }; } catch { /* continue */ }
      }
    }
  }

  // Strategy 3: Inline pattern (some models)
  const inlineMatch = response.match(/tool_call[:\s]+["']?([\w][\w-]+)["']?\s*(\{[\s\S]*?\})/i);
  if (inlineMatch) {
    try {
      return { toolId: inlineMatch[1], args: JSON.parse(inlineMatch[2]) };
    } catch { /* continue */ }
  }

  return null;
}

/**
 * Try to detect if the model wants to create a file but failed to use the tool format.
 */
function detectImplicitFileCreation(response: string, workspacePath?: string): { toolId: string; args: any } | null {
  const filePattern = /(?:creat|writ|sav|generat)\w*\s+(?:a\s+)?(?:file\s+)?(?:called\s+|named\s+)?[`"']?([a-zA-Z0-9_/\\.-]+\.[a-zA-Z]+)[`"']?/i;
  const fileMatch = response.match(filePattern);
  if (!fileMatch) return null;
  
  const fileName = fileMatch[1];
  const codeBlocks = [...response.matchAll(/```[\w]*\n([\s\S]*?)```/g)];
  if (codeBlocks.length === 0) return null;
  
  let largestBlock = '';
  for (const block of codeBlocks) {
    if (block[1].length > largestBlock.length) {
      largestBlock = block[1];
    }
  }
  
  if (largestBlock.trim().length < 10) return null;
  
  const fullPath = workspacePath ? `${workspacePath}/${fileName}`.replace(/\\/g, '/') : fileName;
  
  return {
    toolId: 'write-file',
    args: { path: fullPath, content: largestBlock.trimEnd() }
  };
}

// ─── Native Tool Call Types ───

interface NativeToolCall {
  id: string;
  type?: string;
  function: {
    name: string;
    arguments: string;
  };
}

// ─── Agent Loop ───

export async function runAgentLoop(
  context: AgentRunContext,
  executeTool: (toolId: string, args: any) => Promise<any>
): Promise<AgentRunResult> {
  const now = new Date().toISOString();
  const logs: AgentActionLog[] = [];
  const currentMessages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    createdAt: string;
    toolCalls?: NativeToolCall[];
    toolCallId?: string;
    name?: string;
  }> = [...context.messages.map(m => ({ ...m, toolCalls: undefined as NativeToolCall[] | undefined, toolCallId: undefined as string | undefined, name: undefined as string | undefined }))];
  const provider = context.provider;

  if (!provider) {
    return {
      reply: { id: crypto.randomUUID(), role: 'assistant', content: 'No provider configured. Go to Settings → Providers and configure one.', createdAt: now },
      logs,
      approvalRequests: []
    };
  }

  logs.push({
    id: crypto.randomUUID(),
    kind: 'plan',
    title: 'Agent started',
    detail: `Using ${provider.label} (${provider.model})`,
    createdAt: now
  });

  const personaPrompt = context.persona === 'architect' ? ARCHITECT_PROMPT : 
                        context.persona === 'qa' ? QA_PROMPT : ENGINEER_PROMPT;

  // Inject workspace context
  const workspaceContext = context.workspacePath 
    ? `\n\n## Current Workspace\nPath: \`${context.workspacePath}\`\nAll file operations should use absolute paths based on this workspace root.`
    : '\n\nNo workspace is currently open. The user may need to open one first.';

  // Get native tools for the API
  const nativeTools = toOpenAITools();

  let loopCount = 0;
  const MAX_LOOPS = 12;

  while (loopCount < MAX_LOOPS) {
    loopCount++;
    try {
      // ─── Context Window Management ───
      const MAX_CONTEXT_CHARS = 48000;
      let trimmedMessages = [...currentMessages];
      let totalChars = trimmedMessages.reduce((sum, m) => sum + m.content.length, 0);
      
      while (totalChars > MAX_CONTEXT_CHARS && trimmedMessages.length > 3) {
        const removeIdx = Math.min(1, trimmedMessages.length - 2);
        totalChars -= trimmedMessages[removeIdx].content.length;
        trimmedMessages.splice(removeIdx, 1);
      }

      // Truncate individually long messages
      trimmedMessages = trimmedMessages.map(m => {
        if (m.content.length > 6000 && (m.content.startsWith('<observation>') || m.role === 'user')) {
          return { ...m, content: m.content.slice(0, 6000) + '\n...[truncated]' };
        }
        return m;
      });

      // Build messages array for the API, including tool calling metadata
      const chatMessages = [
        { role: 'system' as const, content: buildSystemPrompt() + personaPrompt + workspaceContext },
        ...trimmedMessages.map(m => {
          const msg: any = { role: m.role, content: m.content };
          if (m.toolCalls) msg.tool_calls = m.toolCalls;
          if (m.toolCallId) msg.tool_call_id = m.toolCallId;
          if (m.name) msg.name = m.name;
          return msg;
        })
      ];

      let chatResponse: ChatResponse;

      if (context.createChat) {
        // Tauri backend path — pass tools for native calling
        chatResponse = await context.createChat(
          { model: provider.model, messages: chatMessages, tools: nativeTools },
          provider
        );
      } else {
        // Browser-side provider path
        chatResponse = await providerRegistry[provider.kind].createChat(
          { model: provider.model, messages: chatMessages, tools: nativeTools },
          provider
        );
      }

      const responseContent = chatResponse.content || '';
      const responseToolCalls = chatResponse.toolCalls;

      // ─── NATIVE TOOL CALLS ───
      // If the model used native function calling, handle it directly
      if (responseToolCalls && responseToolCalls.length > 0) {
        // Store the assistant message with tool_calls for conversation history
        currentMessages.push({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: responseContent,
          createdAt: new Date().toISOString(),
          toolCalls: responseToolCalls as NativeToolCall[],
        });

        // Log any text content the model included alongside tool calls
        if (responseContent.trim()) {
          logs.push({
            id: crypto.randomUUID(),
            kind: 'info',
            title: 'Agent thinking',
            detail: responseContent.slice(0, 300),
            createdAt: new Date().toISOString()
          });
        }

        // Execute each tool call
        for (const tc of responseToolCalls) {
          const toolId = tc.function.name;
          let toolArgs: any;
          try {
            toolArgs = JSON.parse(tc.function.arguments);
          } catch {
            toolArgs = {};
          }

          const tool = builtInTools.find(t => t.id === toolId);
          const toolLabel = tool?.label ?? toolId;

          logs.push({
            id: crypto.randomUUID(),
            kind: 'tool',
            title: toolLabel,
            detail: toolId === 'write-file'
              ? `Writing ${toolArgs.path} (${(toolArgs.content?.length || 0)} chars)`
              : toolId === 'terminal-exec'
              ? `$ ${toolArgs.command}`
              : `${JSON.stringify(toolArgs).slice(0, 250)}`,
            createdAt: new Date().toISOString()
          });

          try {
            const observation = await executeTool(toolId, toolArgs);
            const obsText = typeof observation === 'string' ? observation : JSON.stringify(observation, null, 2);

            logs.push({
              id: crypto.randomUUID(),
              kind: 'success',
              title: `${toolLabel} ✓`,
              detail: obsText.slice(0, 400),
              createdAt: new Date().toISOString()
            });

            // Feed result back as a tool role message with the matching tool_call_id
            currentMessages.push({
              id: crypto.randomUUID(),
              role: 'tool',
              content: obsText.slice(0, 8000),
              createdAt: new Date().toISOString(),
              toolCallId: tc.id,
              name: toolId,
            });
          } catch (err: any) {
            const errMsg = err.message || String(err);
            logs.push({
              id: crypto.randomUUID(),
              kind: 'error',
              title: `${toolLabel} failed`,
              detail: errMsg,
              createdAt: new Date().toISOString()
            });

            currentMessages.push({
              id: crypto.randomUUID(),
              role: 'tool',
              content: `Error: ${errMsg}`,
              createdAt: new Date().toISOString(),
              toolCallId: tc.id,
              name: toolId,
            });
          }
        }

        // Continue the loop — model needs to see tool results
        continue;
      }

      // ─── TEXT RESPONSE (no native tool calls) ───
      if (!responseContent || responseContent.trim().length === 0) {
        logs.push({
          id: crypto.randomUUID(),
          kind: 'error',
          title: 'Empty response from model',
          detail: `${provider.label} returned no content. This may indicate a provider issue or rate limit.`,
          createdAt: new Date().toISOString()
        });
        return {
          reply: { id: crypto.randomUUID(), role: 'assistant', content: 'Error: Model returned an empty response. Check your provider configuration.', createdAt: new Date().toISOString() },
          logs,
          approvalRequests: []
        };
      }

      currentMessages.push({ id: crypto.randomUUID(), role: 'assistant', content: responseContent, createdAt: new Date().toISOString() });

      // ─── XML TOOL CALL PARSING (fallback for models without native tool calling) ───
      let parsedCall = parseToolCall(responseContent);
      
      // Fallback: implicit file creation detection
      if (!parsedCall && loopCount <= 2) {
        parsedCall = detectImplicitFileCreation(responseContent, context.workspacePath);
        if (parsedCall) {
          logs.push({
            id: crypto.randomUUID(),
            kind: 'info',
            title: 'Auto-detected file creation',
            detail: `Model described creating "${parsedCall.args.path}" without using tool format. Executing automatically.`,
            createdAt: new Date().toISOString()
          });
        }
      }

      if (parsedCall) {
        const { toolId, args: toolArgs } = parsedCall;
        const tool = builtInTools.find(t => t.id === toolId);
        
        if (tool) {
          logs.push({
            id: crypto.randomUUID(),
            kind: 'tool',
            title: `${tool.label}`,
            detail: toolId === 'write-file' 
              ? `Writing ${toolArgs.path} (${(toolArgs.content?.length || 0)} chars)`
              : toolId === 'terminal-exec'
              ? `$ ${toolArgs.command}`
              : `${JSON.stringify(toolArgs).slice(0, 250)}`,
            createdAt: new Date().toISOString()
          });

          try {
            const observation = await executeTool(toolId, toolArgs);
            const obsText = typeof observation === 'string' ? observation : JSON.stringify(observation, null, 2);
            
            logs.push({
              id: crypto.randomUUID(),
              kind: 'success',
              title: `${tool.label} ✓`,
              detail: obsText.slice(0, 400),
              createdAt: new Date().toISOString()
            });

            currentMessages.push({
               id: crypto.randomUUID(),
               role: 'user',
               content: `<observation>\n${obsText.slice(0, 8000)}\n</observation>`,
               createdAt: new Date().toISOString()
            });
            continue;
          } catch (err: any) {
            const errMsg = err.message || String(err);
            logs.push({
              id: crypto.randomUUID(),
              kind: 'error',
              title: `${tool.label} failed`,
              detail: errMsg,
              createdAt: new Date().toISOString()
            });
            currentMessages.push({
               id: crypto.randomUUID(),
               role: 'user',
               content: `<error>\nTool "${toolId}" failed: ${errMsg}\n</error>`,
               createdAt: new Date().toISOString()
            });
            continue;
          }
        } else {
          logs.push({
            id: crypto.randomUUID(),
            kind: 'error',
            title: 'Unknown tool',
            detail: `Model tried "${toolId}". Available: ${builtInTools.map(t => t.id).join(', ')}`,
            createdAt: new Date().toISOString()
          });
          currentMessages.push({
            id: crypto.randomUUID(),
            role: 'user',
            content: `<error>\nUnknown tool "${toolId}". Available tools: ${builtInTools.map(t => t.id).join(', ')}\n</error>`,
            createdAt: new Date().toISOString()
          });
          continue;
        }
      }

      // No tool call — final response
      logs.push({
        id: crypto.randomUUID(),
        kind: 'info',
        title: 'Agent finished',
        detail: `Completed in ${loopCount} step(s).`,
        createdAt: new Date().toISOString()
      });
      break;

    } catch (err: any) {
      const errorDetail = err.message || String(err);
      logs.push({
        id: crypto.randomUUID(),
        kind: 'error',
        title: 'Provider error',
        detail: errorDetail,
        createdAt: new Date().toISOString()
      });
      return {
        reply: { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${errorDetail}`, createdAt: new Date().toISOString() },
        logs,
        approvalRequests: []
      };
    }
  }

  if (loopCount >= MAX_LOOPS) {
    logs.push({
      id: crypto.randomUUID(),
      kind: 'error',
      title: 'Loop limit reached',
      detail: `Agent used ${MAX_LOOPS} iterations. Consider breaking your request into smaller steps.`,
      createdAt: new Date().toISOString()
    });
  }

  // Find the last assistant message for the reply
  const lastAssistantMsg = [...currentMessages].reverse().find(m => m.role === 'assistant');

  return {
    reply: lastAssistantMsg
      ? { id: lastAssistantMsg.id, role: 'assistant', content: lastAssistantMsg.content, createdAt: lastAssistantMsg.createdAt }
      : { id: crypto.randomUUID(), role: 'assistant', content: 'Agent stopped.', createdAt: now },
    logs,
    approvalRequests: []
  };
}

export async function runSingleAgent(context: AgentRunContext): Promise<AgentRunResult> {
  return runAgentLoop(context, async () => ({ error: 'Use runAgentLoop for tool support' }));
}
