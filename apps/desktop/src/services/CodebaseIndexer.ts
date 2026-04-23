export interface CodeChunk {
  path: string;
  text: string;
  embedding?: number[];
}

export type IndexingProgressCallback = (current: number, total: number) => void;

class CodebaseIndexer {
  private worker: Worker | null = null;
  private chunks: CodeChunk[] = [];
  private isIndexing = false;
  private messageIdCounter = 0;
  private pendingRequests = new Map<number, { resolve: Function, reject: Function }>();
  private onProgress?: IndexingProgressCallback;

  async init(onProgress?: IndexingProgressCallback) {
    if (this.worker) return;
    this.onProgress = onProgress;
    
    this.worker = new Worker(new URL('./indexer.worker.ts', import.meta.url), { type: 'module' });
    
    this.worker.onmessage = (e) => {
      const { type, payload, id } = e.data;
      if (type === 'progress' && this.onProgress) {
        this.onProgress(payload.current, payload.total);
      } else if (type === 'done') {
        this.chunks = payload;
        this.isIndexing = false;
        if (id !== undefined && this.pendingRequests.has(id)) {
          this.pendingRequests.get(id)!.resolve();
          this.pendingRequests.delete(id);
        }
      } else if (type === 'searchResults') {
        if (id !== undefined && this.pendingRequests.has(id)) {
          this.pendingRequests.get(id)!.resolve(payload);
          this.pendingRequests.delete(id);
        }
      } else if (type === 'ready') {
         // worker initialized model
      }
    };
    
    this.worker.postMessage({ type: 'init' });
  }

  async index(files: { path: string; content: string }[], onProgress?: IndexingProgressCallback) {
    if (this.isIndexing) return;
    this.isIndexing = true;
    if (onProgress) this.onProgress = onProgress;
    await this.init(this.onProgress);

    return new Promise<void>((resolve, reject) => {
      const id = ++this.messageIdCounter;
      this.pendingRequests.set(id, { resolve, reject });
      this.worker!.postMessage({ type: 'index', payload: { files }, id });
    });
  }

  async search(query: string, topK = 5): Promise<CodeChunk[]> {
    await this.init();
    if (this.chunks.length === 0) return [];
    
    return new Promise<CodeChunk[]>((resolve, reject) => {
      const id = ++this.messageIdCounter;
      this.pendingRequests.set(id, { resolve, reject });
      this.worker!.postMessage({ type: 'search', payload: { query, chunks: this.chunks, topK }, id });
    });
  }
}

export const codebaseIndexer = new CodebaseIndexer();
