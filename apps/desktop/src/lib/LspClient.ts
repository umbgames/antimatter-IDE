import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Basic JSON-RPC Structure
interface RpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: any;
}

interface RpcResponse {
  jsonrpc: '2.0';
  id?: number;
  result?: any;
  error?: any;
  method?: string;
  params?: any;
}

export class LspClient {
  private rpcId = 1;
  private pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private isInitialized = false;

  constructor(
    public readonly language: string,
    public readonly binPath: string,
    private readonly workspacePath: string
  ) {}

  public async start() {
    await invoke('start_lsp', {
      language: this.language,
      binPath: this.binPath,
      args: [],
      rootPath: this.workspacePath
    });

    listen<{ language: string; message: string }>('lsp-message', (event) => {
      if (event.payload.language === this.language) {
        this.handleMessage(event.payload.message);
      }
    });

    await this.initialize();
  }

  private async initialize() {
    const result = await this.sendRequest('initialize', {
      processId: null,
      rootUri: `file://${this.workspacePath.replace(/\\/g, '/')}`,
      capabilities: {},
      trace: 'off'
    });
    this.sendNotification('initialized', {});
    this.isInitialized = true;
    console.log(`[LSP] ${this.language} initialized:`, result);
  }

  public notifyDocumentOpened(uri: string, text: string, version: number) {
    if (!this.isInitialized) return;
    this.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri: `file://${uri.replace(/\\/g, '/')}`,
        languageId: this.language,
        version,
        text
      }
    });
  }

  public notifyDocumentChanged(uri: string, text: string, version: number) {
    if (!this.isInitialized) return;
    this.sendNotification('textDocument/didChange', {
      textDocument: { uri: `file://${uri.replace(/\\/g, '/')}`, version },
      contentChanges: [{ text }]
    });
  }

  public async getHover(uri: string, line: number, character: number) {
    if (!this.isInitialized) return null;
    return this.sendRequest('textDocument/hover', {
      textDocument: { uri: `file://${uri.replace(/\\/g, '/')}` },
      position: { line, character }
    });
  }

  public async getCompletions(uri: string, line: number, character: number) {
    if (!this.isInitialized) return null;
    return this.sendRequest('textDocument/completion', {
      textDocument: { uri: `file://${uri.replace(/\\/g, '/')}` },
      position: { line, character }
    });
  }

  private handleMessage(rawMessage: string) {
    try {
      const parsed: RpcResponse = JSON.parse(rawMessage);
      if (parsed.id !== undefined && this.pendingRequests.has(parsed.id)) {
        const { resolve, reject } = this.pendingRequests.get(parsed.id)!;
        this.pendingRequests.delete(parsed.id);
        if (parsed.error) reject(parsed.error);
        else resolve(parsed.result);
      } else if (parsed.method === 'textDocument/publishDiagnostics') {
        // Handle diagnostics later
      }
    } catch (e) {
      console.warn(`[LSP] Failed to parse message for ${this.language}:`, rawMessage);
    }
  }

  private sendRequest(method: string, params: any): Promise<any> {
    const id = this.rpcId++;
    const payload: RpcRequest = { jsonrpc: '2.0', id, method, params };
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      invoke('send_lsp_message', { language: this.language, message: JSON.stringify(payload) })
        .catch(err => {
          this.pendingRequests.delete(id);
          reject(err);
        });
    });
  }

  private sendNotification(method: string, params: any) {
    const payload = { jsonrpc: '2.0', method, params };
    invoke('send_lsp_message', { language: this.language, message: JSON.stringify(payload) }).catch(console.error);
  }
}
