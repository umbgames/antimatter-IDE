import { pipeline, env } from '@xenova/transformers';

// Configure transformers for local-only use if needed, but for now we'll use the CDN cache
env.allowLocalModels = false;
env.useBrowserCache = true;

export interface CodeChunk {
  path: string;
  text: string;
  embedding?: number[];
}

class CodebaseIndexer {
  private pipeline: any = null;
  private chunks: CodeChunk[] = [];
  private isIndexing = false;

  async init() {
    if (this.pipeline) return;
    this.pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  async index(files: { path: string; content: string }[]) {
    if (this.isIndexing) return;
    this.isIndexing = true;
    await this.init();

    const newChunks: CodeChunk[] = [];
    
    // Simple chunking strategy: split by 500 characters with 100 char overlap
    // For a real product, we'd use tree-sitter or similar to chunk by function/class
    for (const file of files) {
      if (file.content.length === 0) continue;
      
      const chunkSize = 500;
      const overlap = 100;
      
      for (let i = 0; i < file.content.length; i += chunkSize - overlap) {
        const text = file.content.substring(i, i + chunkSize);
        newChunks.push({ path: file.path, text });
      }
    }

    // Generate embeddings in batches of 10 to not block the main thread too long
    for (let i = 0; i < newChunks.length; i += 10) {
      const batch = newChunks.slice(i, i + 10);
      const embeddings = await Promise.all(
        batch.map(chunk => this.pipeline(chunk.text, { pooling: 'mean', normalize: true }))
      );
      
      batch.forEach((chunk, idx) => {
        chunk.embedding = Array.from(embeddings[idx].data);
      });
    }

    this.chunks = newChunks;
    this.isIndexing = false;
  }

  async search(query: string, topK = 5): Promise<CodeChunk[]> {
    await this.init();
    const queryResult = await this.pipeline(query, { pooling: 'mean', normalize: true });
    const queryEmbedding = Array.from(queryResult.data) as number[];

    const results = this.chunks
      .map(chunk => ({
        chunk,
        score: this.cosineSimilarity(queryEmbedding, chunk.embedding!)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(r => r.chunk);

    return results;
  }

  private cosineSimilarity(a: number[], b: number[]) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export const codebaseIndexer = new CodebaseIndexer();
