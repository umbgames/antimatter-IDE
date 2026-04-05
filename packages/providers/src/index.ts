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
      message: `${this.label} configuration looks structurally valid. Replace this stub with a live API probe for production use.`
    };
  }

  async createChat(request: ChatRequest, config: ProviderConfig): Promise<string> {
    const lastMessage = request.messages.at(-1)?.content ?? '';
    return [
      `Provider: ${this.label}`,
      `Model: ${config.model}`,
      '',
      'This starter uses a provider abstraction with conservative stub implementations.',
      'Wire the concrete HTTP client for your chosen provider here.',
      '',
      `Echo: ${lastMessage}`
    ].join('\n');
  }
}

export const providerRegistry: Record<ProviderKind, ProviderClient> = {
  openai: new StubProviderClient('openai', 'OpenAI'),
  anthropic: new StubProviderClient('anthropic', 'Anthropic'),
  gemini: new StubProviderClient('gemini', 'Gemini'),
  local: new StubProviderClient('local', 'Local Endpoint'),
  'openai-compatible': new StubProviderClient('openai-compatible', 'OpenAI-Compatible Endpoint')
};

export const providerDefaults: Array<Pick<ProviderConfig, 'label' | 'kind' | 'model' | 'notes'>> = [
  {
    label: 'OpenAI',
    kind: 'openai',
    model: 'gpt-4.1-mini',
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
