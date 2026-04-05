import type { ProviderConfig, ProviderKind, ProviderTestResult } from '@antimatter/shared';

export interface ProviderContext {
  apiKey?: string;
  baseUrl?: string;
}

export interface ChatRequest {
  model: string;
  systemPrompt?: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}

export interface ProviderClient {
  kind: ProviderKind;
  label: string;
  testConnection(config: ProviderConfig, context?: ProviderContext): Promise<ProviderTestResult>;
  createChat(request: ChatRequest, config: ProviderConfig, context?: ProviderContext): Promise<string>;
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

  async createChat(request: ChatRequest, config: ProviderConfig): Promise<string> {
    const lastMessage = request.messages.at(-1)?.content ?? '';
    return [
      `Provider: ${this.label}`,
      `Model: ${config.model}`,
      '',
      'This provider is currently scaffolded but not live in the web runtime.',
      'Use the Tauri backend integration or implement the browser transport here.',
      '',
      `Echo: ${lastMessage}`
    ].join('\n');
  }
}

class OpenAICompatibleProviderClient implements ProviderClient {
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

  async createChat(request: ChatRequest, config: ProviderConfig, context?: ProviderContext): Promise<string> {
    const baseUrl = this.resolveBaseUrl(config, context);
    if (!baseUrl) {
      throw new Error('This provider needs a base URL before chat can run.');
    }
    if (this.kind !== 'local' && !context?.apiKey) {
      throw new Error('This provider needs an API key in the runtime context for browser-side chat.');
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.kind !== 'local' && context?.apiKey ? { Authorization: `Bearer ${context.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: config.model,
        messages: request.messages,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`${this.label} returned ${response.status}: ${detail || response.statusText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error(`${this.label} did not return assistant text in choices[0].message.content.`);
    }
    return content;
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
