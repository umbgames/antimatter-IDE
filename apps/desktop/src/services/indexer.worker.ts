import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

let modelPipeline: any = null;

async function initPipeline() {
  if (!modelPipeline) {
    modelPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
}

function chunkContent(content: string, path: string) {
  const chunks: Array<{ path: string; text: string }> = [];
  const chunkSize = 800; // slightly larger chunks
  const overlap = 200;
  
  if (content.length === 0) return chunks;

  for (let i = 0; i < content.length; i += chunkSize - overlap) {
    const text = content.substring(i, i + chunkSize);
    chunks.push({ path, text });
  }
  return chunks;
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'init') {
    await initPipeline();
    self.postMessage({ type: 'ready' });
  } 
  else if (type === 'index') {
    const { files } = payload;
    await initPipeline();

    const allChunks: Array<{ path: string; text: string }> = [];
    for (const file of files) {
      allChunks.push(...chunkContent(file.content, file.path));
    }

    let processedChunks: any[] = [];
    
    // Process in batches
    const batchSize = 8;
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      
      const embeddings = await Promise.all(
        batch.map(chunk => modelPipeline(chunk.text, { pooling: 'mean', normalize: true }))
      );
      
      batch.forEach((chunk, idx) => {
        (chunk as any).embedding = Array.from(embeddings[idx].data);
      });
      
      processedChunks.push(...batch);

      // Report progress based on files approximation
      const estimatedFilesProcessed = Math.min(
        files.length, 
        Math.ceil((i + batchSize) / (allChunks.length / files.length || 1))
      );
      
      self.postMessage({ 
        type: 'progress', 
        payload: { current: estimatedFilesProcessed, total: files.length } 
      });
    }

    self.postMessage({ type: 'done', payload: processedChunks });
  }
  else if (type === 'search') {
    const { query, chunks, topK } = payload;
    await initPipeline();
    
    const queryResult = await modelPipeline(query, { pooling: 'mean', normalize: true });
    const queryEmbedding = Array.from(queryResult.data) as number[];

    const results = chunks
      .map((chunk: any) => {
        let dot = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < queryEmbedding.length; i++) {
            dot += queryEmbedding[i] * chunk.embedding[i];
            normA += queryEmbedding[i] * queryEmbedding[i];
            normB += chunk.embedding[i] * chunk.embedding[i];
        }
        const score = dot / (Math.sqrt(normA) * Math.sqrt(normB));
        return { chunk, score };
      })
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, topK)
      .map((r: any) => r.chunk);

    self.postMessage({ type: 'searchResults', payload: results });
  }
};
