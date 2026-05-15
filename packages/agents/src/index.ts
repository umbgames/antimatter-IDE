import type { AgentActionLog, AgentMessage, ApprovalRequest, ProviderConfig } from '@antimatter/shared';
import { providerRegistry } from '@antimatter/providers';
import type { ChatResponse } from '@antimatter/providers';
import { builtInTools, toOpenAITools } from '@antimatter/tools';

export interface AgentRunContext {
  provider?: ProviderConfig;
  messages: AgentMessage[];
  workspacePath?: string;
  persona?: 'engineer' | 'architect' | 'qa';
  repoMap?: string; // Pre-computed compact file tree + symbol outline
  createChat?: (
    request: { model: string; messages: { role: string; content: string; tool_calls?: any[]; tool_call_id?: string; name?: string }[]; tools?: any[] },
    config: ProviderConfig,
    onStreamUpdate?: (content: string) => void
  ) => Promise<ChatResponse>;
  onTokensUsed?: (tokens: number) => void;
  onStreamUpdate?: (content: string) => void;
}

// ─── File Content Cache (avoids re-reading unchanged files) ───
const fileContentCache = new Map<string, { content: string; readAt: number }>();
const CACHE_TTL_MS = 30_000; // 30 seconds

export function getCachedFile(path: string): string | null {
  const entry = fileContentCache.get(path);
  if (entry && Date.now() - entry.readAt < CACHE_TTL_MS) return entry.content;
  return null;
}

export function setCachedFile(path: string, content: string): void {
  fileContentCache.set(path, { content, readAt: Date.now() });
  // Evict old entries if cache grows too large
  if (fileContentCache.size > 200) {
    const oldest = [...fileContentCache.entries()].sort((a, b) => a[1].readAt - b[1].readAt);
    for (let i = 0; i < 50; i++) fileContentCache.delete(oldest[i][0]);
  }
}

export function invalidateCachedFile(path: string): void {
  fileContentCache.delete(path);
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

function buildSystemPrompt(repoMap?: string, isFirstTurn?: boolean): string {
  // Compact tool reference — only names + one-line descriptions
  const toolRef = builtInTools.map(t => `- **${t.id}**: ${t.description.split('.')[0]}.`).join('\n');

  const repoSection = repoMap 
    ? `\n## Repository Map\nThis is a snapshot of the workspace structure and key symbols. Use it to navigate efficiently without listing directories manually.\n\`\`\`\n${repoMap}\n\`\`\`\n`
    : '';

  // Only include examples on first turn to save context
  const examples = isFirstTurn ? `
## Tool Call Format (XML Fallback)
If you do NOT have native function calling, use: \`<tool_call id="tool-id">{"key": "value"}</tool_call>\`

## Key Examples
- Write: \`<tool_call id="write-file">{"path": "abs/path", "content": "..."}\`
- Patch: \`<tool_call id="patch-file">{"path": "abs/path", "replacements": [{"search": "old", "replace": "new"}]}\`
- Search: \`<tool_call id="grep-search">{"pattern": "regex", "include": "*.ts"}\`
- Terminal: \`<tool_call id="terminal-exec">{"command": "npm install"}\`
- Read batch: \`<tool_call id="read-files">{"paths": ["file1", "file2"]}\`
- Find symbol: \`<tool_call id="find-symbols">{"name": "handleSubmit", "kind": "function"}\`
` : '';

  return `
# Antimatter IDE Agent

You are **Antimatter**, a powerful agentic IDE assistant built by UMB GAMES AND TECHNOLOGY LTD.
You operate inside a desktop IDE with full file system and terminal access.

## Core Rules
1. **Act, don't describe.** Use tools immediately. Never show code without writing it to a file.
2. **Be efficient with large repos.** Use \`find-symbols\`, \`grep-search\`, and \`analyze-file\` to navigate. Read specific line ranges instead of full files. Use \`read-files\` to batch-read multiple files.
3. **Plan complex work.** For multi-step tasks, start with a \`<plan>\` block:
   <plan>
   - [ ] Step 1
   - [ ] Step 2
   </plan>
4. **Use absolute paths.** Always construct full paths from the workspace root.
5. **Prefer patch-file over write-file** for existing files — it's safer and uses less context.
6. **Use the repo map** (below) to understand project structure before exploring manually.
7. **Terminal is unrestricted.** Run any command: npm, cargo, git, python, etc.
8. **Be concise.** Short technical responses. No fluff.
${repoSection}
## Available Tools
${toolRef}
${examples}
Remember: You have FULL access to the terminal and file system. Act decisively.
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
  }> = [...context.messages.map(m => ({ ...m, toolCalls: m.toolCalls as NativeToolCall[] | undefined, toolCallId: m.toolCallId, name: m.name }))];
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
  const MAX_LOOPS = 25;
  const isFirstTurn = currentMessages.filter(m => m.role === 'assistant').length === 0;

  while (loopCount < MAX_LOOPS) {
    loopCount++;
    try {
      // ─── Smart Context Window Management ───
      let MAX_CONTEXT_CHARS = 128000;
      let MAX_MESSAGE_CHARS = 32000;
      let MAX_TOOL_RESULT_CHARS = 12000;

      if (provider.kind === 'groq') {
        MAX_CONTEXT_CHARS = 20000;
        MAX_MESSAGE_CHARS = 6000;
        MAX_TOOL_RESULT_CHARS = 4000;
      }

      let trimmedMessages = [...currentMessages];

      // 1. Compress tool results — summarize large observations
      trimmedMessages = trimmedMessages.map(m => {
        if (m.role === 'tool' && m.content && m.content.length > MAX_TOOL_RESULT_CHARS) {
          const lines = m.content.split('\n');
          const head = lines.slice(0, 40).join('\n');
          const tail = lines.slice(-20).join('\n');
          return { ...m, content: `${head}\n\n... [${lines.length - 60} lines omitted for context efficiency] ...\n\n${tail}` };
        }
        if (m.content && m.content.length > MAX_MESSAGE_CHARS && (m.content.startsWith('<observation>') || m.role === 'user' || m.role === 'tool')) {
          return { ...m, content: m.content.slice(0, MAX_MESSAGE_CHARS) + '\n...[truncated]' };
        }
        return m;
      });

      // 2. Importance-scored pruning — keep first user msg, last 6 exchanges, and all tool-result pairs
      let totalChars = trimmedMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
      while (totalChars > MAX_CONTEXT_CHARS && trimmedMessages.length > 4) {
        // Find the oldest non-critical message to remove (skip first user msg and recent messages)
        let removeIdx = -1;
        for (let i = 1; i < trimmedMessages.length - 4; i++) {
          const m = trimmedMessages[i];
          // Don't remove tool messages that have a matching assistant tool_call
          if (m.role === 'tool' && m.toolCallId) continue;
          // Don't remove assistant messages with tool_calls that have pending results
          if (m.role === 'assistant' && m.toolCalls) {
            const hasResult = trimmedMessages.some(tm => tm.toolCallId && m.toolCalls?.some(tc => tc.id === tm.toolCallId));
            if (hasResult) continue;
          }
          removeIdx = i;
          break;
        }
        if (removeIdx === -1) removeIdx = 1;
        totalChars -= (trimmedMessages[removeIdx].content?.length || 0);
        trimmedMessages.splice(removeIdx, 1);
      }

      // Build messages array for the API
      const chatMessages = [
        { role: 'system' as const, content: buildSystemPrompt(context.repoMap, isFirstTurn && loopCount === 1) + personaPrompt + workspaceContext },
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
          provider,
          context.onStreamUpdate
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

      if (chatResponse.usage?.totalTokens && context.onTokensUsed) {
        context.onTokensUsed(chatResponse.usage.totalTokens);
      }

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

            let finalContent = obsText;
            if (!obsText.startsWith('data:image/')) {
              finalContent = obsText.slice(0, 8000);
            }

            // Feed result back as a tool role message with the matching tool_call_id
            if (obsText.startsWith('data:image/')) {
               currentMessages.push({
                 id: crypto.randomUUID(),
                 role: 'tool',
                 content: 'Screenshot captured successfully. I have appended the image to the context window.',
                 createdAt: new Date().toISOString(),
                 toolCallId: tc.id,
                 name: toolId,
               });
               currentMessages.push({
                 id: crypto.randomUUID(),
                 role: 'user',
                 content: finalContent,
                 createdAt: new Date().toISOString(),
               });
            } else {
               currentMessages.push({
                 id: crypto.randomUUID(),
                 role: 'tool',
                 content: finalContent,
                 createdAt: new Date().toISOString(),
                 toolCallId: tc.id,
                 name: toolId,
               });
            }
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
        // Retry once — empty responses are often transient (rate limit edge case)
        if (loopCount < MAX_LOOPS) {
          logs.push({
            id: crypto.randomUUID(),
            kind: 'info',
            title: 'Empty response — retrying',
            detail: `${provider.label} returned no content. Retrying in 2 seconds...`,
            createdAt: new Date().toISOString()
          });
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        logs.push({
          id: crypto.randomUUID(),
          kind: 'error',
          title: 'Empty response from model',
          detail: `${provider.label} returned no content after retries. This may indicate a provider issue or rate limit.`,
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

            let finalContent = obsText;
            if (!obsText.startsWith('data:image/')) {
               finalContent = `<observation>\n${obsText.slice(0, 8000)}\n</observation>`;
            }
            
            currentMessages.push({
               id: crypto.randomUUID(),
               role: 'user',
               content: finalContent,
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
      
      // If the backend tagged this as a rate limit, wait and retry instead of killing the agent
      if (errorDetail.includes('[RATE_LIMITED]') && loopCount < MAX_LOOPS) {
        logs.push({
          id: crypto.randomUUID(),
          kind: 'info',
          title: 'Rate limited — waiting',
          detail: 'Provider rate limit hit. Waiting 5 seconds before retrying...',
          createdAt: new Date().toISOString()
        });
        await new Promise(resolve => setTimeout(resolve, 5000));
        // Don't increment loopCount — this wasn't a real iteration
        loopCount--;
        continue;
      }

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
      detail: `Agent used ${MAX_LOOPS} iterations across ${logs.filter(l => l.kind === 'tool').length} tool calls. Consider breaking complex work into smaller requests.`,
      createdAt: new Date().toISOString()
    });
  }

  // Find the last assistant message for the reply
  const lastAssistantMsg = [...currentMessages].reverse().find(m => m.role === 'assistant');

  return {
    reply: lastAssistantMsg
      ? { 
          id: lastAssistantMsg.id, 
          role: 'assistant', 
          content: lastAssistantMsg.content, 
          createdAt: lastAssistantMsg.createdAt,
          toolCalls: lastAssistantMsg.toolCalls
        }

      : { id: crypto.randomUUID(), role: 'assistant', content: 'Agent stopped.', createdAt: now },
    logs,
    approvalRequests: []
  };
}

export async function runSingleAgent(context: AgentRunContext): Promise<AgentRunResult> {
  return runAgentLoop(context, async () => ({ error: 'Use runAgentLoop for tool support' }));
}
