import type { ProviderConfig, ProviderKind, ProviderTestResult, TokenUsage } from '@antimatter/shared';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface ProviderContext {
  apiKey?: string;
  baseUrl?: string;
}

export interface ChatToolCall {
  id: string;
  type?: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatRequest {
  model: string;
  systemPrompt?: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    tool_calls?: ChatToolCall[];
    tool_call_id?: string;
    name?: string;
  }>;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, any>;
    };
  }>;
}

export interface ChatResponse {
  content: string | null;
  toolCalls: ChatToolCall[] | null;
  usage?: TokenUsage;
}

export interface ProviderClient {
  kind: ProviderKind;
  label: string;
  testConnection(config: ProviderConfig, context?: ProviderContext): Promise<ProviderTestResult>;
  createChat(request: ChatRequest, config: ProviderConfig, context?: ProviderContext): Promise<ChatResponse>;
}

class StubProviderClient implements ProviderClient {
  constructor(public kind: ProviderKind, public label: string) {}

  async testConnection(config: ProviderConfig): Promise<ProviderTestResult> {
    if (!config.model) {
      return { ok: false, message: 'Choose a default model before testing the provider.' };
    }
    return {
      ok: true,
      message: `${this.label} configuration looks structurally valid. Wire the concrete transport in the backend or browser runtime for production use.`
    };
  }

  async createChat(request: ChatRequest, config: ProviderConfig): Promise<ChatResponse> {
    const lastMessage = request.messages.at(-1)?.content ?? '';
    return {
      content: [
        `Provider: ${this.label}`,
        `Model: ${config.model}`,
        '',
        'This provider is currently scaffolded but not live in the web runtime.',
        'Use the Tauri backend integration or implement the browser transport here.',
        '',
        `Echo: ${lastMessage}`
      ].join('\n'),
      toolCalls: null
    };
  }
}

class OpenAICompatibleProviderClient implements ProviderClient {
  private globalWaitUntil = 0;

  constructor(
    public kind: ProviderKind,
    public label: string,
    private readonly fallbackBaseUrl?: string
  ) {}

  async testConnection(config: ProviderConfig, context?: ProviderContext): Promise<ProviderTestResult> {
    const baseUrl = this.resolveBaseUrl(config, context);
    if (!baseUrl) {
      return { ok: false, message: 'This provider needs a base URL.' };
    }
    if (this.kind !== 'local' && !context?.apiKey) {
      return { ok: false, message: 'Provide an API key in the runtime context to test this provider from the browser layer.' };
    }

    const response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(this.kind !== 'local' && context?.apiKey ? { Authorization: `Bearer ${context.apiKey}` } : {})
      }
    });

    return {
      ok: response.ok,
      message: response.ok ? `${this.label} responded successfully.` : `${this.label} returned ${response.status} ${response.statusText}.`
    };
  }

  async createChat(request: ChatRequest, config: ProviderConfig, context?: ProviderContext): Promise<ChatResponse> {
    const baseUrl = this.resolveBaseUrl(config, context);
    if (!baseUrl) {
      throw new Error('This provider needs a base URL before chat can run.');
    }
    if (this.kind !== 'local' && !context?.apiKey) {
      throw new Error('This provider needs an API key in the runtime context for browser-side chat.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.kind !== 'local' && context?.apiKey ? { Authorization: `Bearer ${context.apiKey}` } : {})
    };

    const body: Record<string, any> = {
      model: config.model,
      messages: request.messages,
      temperature: 0.2
    };

    // Include tools if provided (enables native function calling)
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools;
      body.tool_choice = 'auto';
    }

    let retries = 0;
    const maxRetries = 5;

    while (true) {
      // Check if we are in a global cooldown
      const now = Date.now();
      if (now < this.globalWaitUntil) {
        const waitTime = this.globalWaitUntil - now;
        console.info(`[${this.label}] In global cooldown. Waiting ${waitTime}ms...`);
        await sleep(waitTime);
      }

      let response: Response;
      try {
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
      } catch (err: any) {
        if (retries < maxRetries) {
          retries++;
          const waitTime = 1000 * Math.pow(2, retries);
          console.warn(`[${this.label}] Network error. Retrying (${retries}/${maxRetries}) after ${waitTime}ms...`);
          await sleep(waitTime);
          continue;
        }
        throw err;
      }

      if (response.ok) {
        const data = await response.json();
        return this.extractResponse(data);
      }

      const detail = await response.text();

      // Handle Rate Limits (429)
      if (response.status === 429 && retries < maxRetries) {
        retries++;
        const waitTime = this.parseRetryAfter(response, detail);
        
        // Set global cooldown for all requests to this provider
        this.globalWaitUntil = Date.now() + waitTime;
        
        console.warn(`[${this.label}] Rate limit hit. Retrying (${retries}/${maxRetries}) after ${waitTime}ms...`);
        await sleep(waitTime);
        continue;
      }

      // Handle Tools Rejected (400)
      const isToolRejected = response.status === 400
        && request.tools && request.tools.length > 0
        && (detail.includes('tool') || detail.includes('function'));

      if (isToolRejected) {
        const fallbackBody = { ...body };
        delete fallbackBody.tools;
        delete fallbackBody.tool_choice;

        const fallbackResponse = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(fallbackBody)
        });

        if (fallbackResponse.ok) {
          const data = await fallbackResponse.json();
          return this.extractResponse(data);
        }
        
        const retryDetail = await fallbackResponse.text();
        throw new Error(`${this.label} returned ${fallbackResponse.status}: ${retryDetail || fallbackResponse.statusText}`);
      }

      // Handle Transient Server Errors (5xx)
      if (response.status >= 500 && retries < maxRetries) {
        retries++;
        const waitTime = 1000 * Math.pow(2, retries); // Exponential backoff
        console.warn(`[${this.label}] Server error ${response.status}. Retrying (${retries}/${maxRetries}) after ${waitTime}ms...`);
        await sleep(waitTime);
        continue;
      }

      // Final error
      throw new Error(`${this.label} returned ${response.status}: ${detail || response.statusText}`);
    }
  }

  private parseRetryAfter(response: Response, body: string): number {
    // 1. Check Retry-After header
    const retryAfter = response.headers.get('Retry-After');
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) return seconds * 1000;
    }

    // 2. Parse Groq-specific message: "Please try again in 20.6925s."
    const match = body.match(/try again in ([\d.]+)s/);
    if (match) {
      return Math.ceil(parseFloat(match[1]) * 1000) + 500; // Add 500ms buffer
    }

    return 2000 * (1.5 ** (Math.random())); // Random 2-3s fallback
  }

  private extractResponse(data: any): ChatResponse {
    const message = data?.choices?.[0]?.message;
    if (!message) {
      throw new Error(`${this.label} did not return choices[0].message.`);
    }

    const content = typeof message.content === 'string' && message.content.length > 0
      ? message.content
      : null;

    const toolCalls = Array.isArray(message.tool_calls) && message.tool_calls.length > 0
      ? message.tool_calls.map((tc: any) => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments
          }
        }))
      : null;

    if (!content && !toolCalls) {
      throw new Error(`${this.label} response contained neither content nor tool_calls.`);
    }

    let usage: TokenUsage | undefined;
    if (data?.usage) {
      usage = {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      };
    }

    return { content, toolCalls, usage };
  }

  private resolveBaseUrl(config: ProviderConfig, context?: ProviderContext): string {
    return (context?.baseUrl || config.baseUrl || this.fallbackBaseUrl || '').replace(/\/$/, '');
  }
}

export const providerRegistry: Record<ProviderKind, ProviderClient> = {
  openai: new OpenAICompatibleProviderClient('openai', 'OpenAI', 'https://api.openai.com/v1'),
  anthropic: new StubProviderClient('anthropic', 'Anthropic'),
  gemini: new StubProviderClient('gemini', 'Gemini'),
  groq: new OpenAICompatibleProviderClient('groq', 'Groq', 'https://api.groq.com/openai/v1'),
  local: new OpenAICompatibleProviderClient('local', 'Local Endpoint'),
  'openai-compatible': new OpenAICompatibleProviderClient('openai-compatible', 'OpenAI-Compatible Endpoint')
};

export const providerDefaults: Array<Pick<ProviderConfig, 'label' | 'kind' | 'model' | 'notes' | 'baseUrl'>> = [
  {
    label: 'OpenAI',
    kind: 'openai',
    model: 'gpt-4.1-mini',
    baseUrl: 'https://api.openai.com/v1',
    notes: 'Use your own OpenAI API key. Latency and pricing depend on your OpenAI account and model choice.'
  },
  {
    label: 'Anthropic',
    kind: 'anthropic',
    model: 'claude-3-7-sonnet-latest',
    notes: 'Bring your own Anthropic key. Model availability depends on your Anthropic account.'
  },
  {
    label: 'Gemini',
    kind: 'gemini',
    model: 'gemini-2.5-pro',
    notes: 'Connect your own Gemini API credentials.'
  },
  {
    label: 'Groq',
    kind: 'groq',
    model: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
    notes: 'Bring your own Groq API key. Groq offers ultra-fast inference, but latency, throughput, and model availability depend on Groq and your selected model.'
  },
  {
    label: 'Local Endpoint',
    kind: 'local',
    model: 'your-local-model',
    notes: 'Antimatter does not ship a model. Point this at an endpoint you already run locally or self-host.'
  },
  {
    label: 'Custom OpenAI-Compatible',
    kind: 'openai-compatible',
    model: 'compatible-model',
    notes: 'Use any compatible base URL. Performance depends on the remote or self-hosted endpoint.'
  }
];
