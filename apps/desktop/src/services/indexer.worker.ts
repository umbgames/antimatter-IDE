import { pipeline, env } from '@xenova/transformers';

// CRITICAL: Allow local cached models so the indexer works offline.
// The model is downloaded once and cached in the browser's Cache API.
env.allowLocalModels = true;
env.useBrowserCache = true;

let modelPipeline: any = null;
let initFailed = false;

async function initPipeline() {
  if (initFailed) return; // Don't retry if model download failed (offline)
  if (modelPipeline) return;
  
  try {
    modelPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  } catch (err) {
    initFailed = true;
    console.warn('[Indexer] Model init failed (likely offline). Semantic search disabled.', err);
    self.postMessage({ type: 'error', payload: 'Semantic search unavailable — model not cached and offline.' });
  }
}

// Symbol boundary patterns for splitting code at natural boundaries
const BOUNDARY_PATTERNS = [
  /^(?:export\s+)?(?:async\s+)?function\s+/,
  /^(?:export\s+)?(?:default\s+)?class\s+/,
  /^(?:export\s+)?interface\s+/,
  /^(?:export\s+)?type\s+/,
  /^(?:export\s+)?enum\s+/,
  /^(?:pub\s+)?(?:async\s+)?fn\s+/,
  /^(?:pub\s+)?struct\s+/,
  /^(?:pub\s+)?enum\s+/,
  /^impl\s+/,
  /^def\s+/,
  /^class\s+/,
];

function isBoundary(line: string): boolean {
  const trimmed = line.trim();
  return BOUNDARY_PATTERNS.some(p => p.test(trimmed));
}

function chunkContent(content: string, path: string) {
  const chunks: Array<{ path: string; text: string }> = [];
  if (content.length === 0) return chunks;

  const lines = content.split('\n');
  const MAX_CHUNK_LINES = 60;
  const MIN_CHUNK_LINES = 10;

  let currentChunk: string[] = [];
  let lineCount = 0;

  for (const line of lines) {
    // If we hit a boundary and have enough lines, flush the current chunk
    if (isBoundary(line) && lineCount >= MIN_CHUNK_LINES) {
      chunks.push({ path, text: currentChunk.join('\n') });
      currentChunk = [];
      lineCount = 0;
    }

    currentChunk.push(line);
    lineCount++;

    // Force flush if chunk is too large
    if (lineCount >= MAX_CHUNK_LINES) {
      chunks.push({ path, text: currentChunk.join('\n') });
      currentChunk = [];
      lineCount = 0;
    }
  }

  // Flush remaining
  if (currentChunk.length > 0) {
    chunks.push({ path, text: currentChunk.join('\n') });
  }

  return chunks;
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload, id } = e.data;

  if (type === 'init') {
    await initPipeline();
    self.postMessage({ type: 'ready' });
  } 
  else if (type === 'index') {
    const { files } = payload;
    await initPipeline();

    // Graceful offline degradation: skip embedding if model not available
    if (!modelPipeline) {
      self.postMessage({ type: 'done', payload: [], id });
      return;
    }
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

    self.postMessage({ type: 'done', payload: processedChunks, id });
  }
  else if (type === 'search') {
    const { query, chunks, topK } = payload;
    await initPipeline();

    // Graceful offline degradation
    if (!modelPipeline) {
      self.postMessage({ type: 'searchResults', payload: [], id });
      return;
    }
    
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

    self.postMessage({ type: 'searchResults', payload: results, id });
  }
};
