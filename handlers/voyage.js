/**
 * Voyage AI Handler — 12 tools
 * State-of-the-art embeddings (voyage-3, voyage-code-3, voyage-finance-2,
 * voyage-law-2, voyage-multilingual-2), reranking, and RAG Super Tools.
 * API base: https://api.voyageai.com/v1
 */

const BASE = 'https://api.voyageai.com/v1';

function headers() {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error('VOYAGE_API_KEY not set in .env');
  return { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function voy(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Voyage AI ${res.status}: ${err.detail || err.message || res.statusText}`);
  }
  return await res.json();
}

function cosine(a, b) {
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; ma += a[i]*a[i]; mb += b[i]*b[i]; }
  return dot / (Math.sqrt(ma) * Math.sqrt(mb));
}

async function execute(tool, args) {

  // ── EMBEDDINGS ────────────────────────────────────────────────────────────
  if (tool === 'voyage_embed') {
    const { texts, model = 'voyage-3', input_type } = args;
    if (!texts?.length) throw new Error('texts array is required');
    const body = { input: texts, model };
    if (input_type) body.input_type = input_type; // 'query' or 'document'
    const data = await voy('POST', '/embeddings', body);
    return {
      embeddings: (data.data || []).map(e => e.embedding),
      model: data.model,
      usage: data.usage
    };
  }

  if (tool === 'voyage_embed_query') {
    // Single query embedding — optimized for search/retrieval
    const { query, model = 'voyage-3' } = args;
    if (!query) throw new Error('query is required');
    const data = await voy('POST', '/embeddings', { input: [query], model, input_type: 'query' });
    return {
      embedding: data.data?.[0]?.embedding,
      model: data.model,
      usage: data.usage
    };
  }

  if (tool === 'voyage_embed_documents') {
    // Batch embed documents — optimized for storage/indexing
    const { documents, model = 'voyage-3' } = args;
    if (!documents?.length) throw new Error('documents array is required');
    const data = await voy('POST', '/embeddings', { input: documents, model, input_type: 'document' });
    return {
      embeddings: (data.data || []).map(e => e.embedding),
      model: data.model,
      total_tokens: data.usage?.total_tokens,
      count: documents.length
    };
  }

  if (tool === 'voyage_embed_code') {
    const { texts } = args;
    if (!texts?.length) throw new Error('texts array is required');
    const data = await voy('POST', '/embeddings', { input: texts, model: 'voyage-code-3', input_type: 'document' });
    return {
      embeddings: (data.data || []).map(e => e.embedding),
      model: 'voyage-code-3',
      usage: data.usage
    };
  }

  if (tool === 'voyage_embed_finance') {
    const { texts, input_type = 'document' } = args;
    if (!texts?.length) throw new Error('texts array is required');
    const data = await voy('POST', '/embeddings', { input: texts, model: 'voyage-finance-2', input_type });
    return {
      embeddings: (data.data || []).map(e => e.embedding),
      model: 'voyage-finance-2',
      usage: data.usage
    };
  }

  if (tool === 'voyage_embed_legal') {
    const { texts, input_type = 'document' } = args;
    if (!texts?.length) throw new Error('texts array is required');
    const data = await voy('POST', '/embeddings', { input: texts, model: 'voyage-law-2', input_type });
    return {
      embeddings: (data.data || []).map(e => e.embedding),
      model: 'voyage-law-2',
      usage: data.usage
    };
  }

  if (tool === 'voyage_embed_multilingual') {
    const { texts, input_type = 'document' } = args;
    if (!texts?.length) throw new Error('texts array is required');
    const data = await voy('POST', '/embeddings', { input: texts, model: 'voyage-multilingual-2', input_type });
    return {
      embeddings: (data.data || []).map(e => e.embedding),
      model: 'voyage-multilingual-2',
      usage: data.usage
    };
  }

  // ── RERANKING ────────────────────────────────────────────────────────────
  if (tool === 'voyage_rerank') {
    const { query, documents, model = 'rerank-2', top_k, return_documents = true } = args;
    if (!query) throw new Error('query is required');
    if (!documents?.length) throw new Error('documents array is required');
    const body = { query, documents, model, return_documents };
    if (top_k) body.top_k = top_k;
    const data = await voy('POST', '/rerank', body);
    return {
      results: (data.data || []).map(r => ({
        index: r.index,
        relevance_score: r.relevance_score,
        document: r.document
      })),
      model: data.model,
      usage: data.usage
    };
  }

  // ── MODELS ────────────────────────────────────────────────────────────────
  if (tool === 'voyage_list_models') {
    // Voyage doesn't have a /models endpoint, return static list
    return [
      { id: 'voyage-3', type: 'embedding', context_length: 32000, dimensions: 1024, description: 'Latest general-purpose embedding model. Best for most use cases.' },
      { id: 'voyage-3-lite', type: 'embedding', context_length: 32000, dimensions: 512, description: 'Optimized for latency and cost. Slightly lower quality.' },
      { id: 'voyage-code-3', type: 'embedding', context_length: 32000, dimensions: 1024, description: 'Best-in-class for code retrieval and code search.' },
      { id: 'voyage-finance-2', type: 'embedding', context_length: 32000, dimensions: 1024, description: 'Optimized for financial documents and filings.' },
      { id: 'voyage-law-2', type: 'embedding', context_length: 16000, dimensions: 1024, description: 'Optimized for legal text, contracts, and case law.' },
      { id: 'voyage-multilingual-2', type: 'embedding', context_length: 32000, dimensions: 1024, description: 'Strong multilingual support across 10+ languages.' },
      { id: 'rerank-2', type: 'reranking', context_length: 16000, description: 'High-quality cross-encoder reranker. Improves retrieval precision.' },
      { id: 'rerank-2-lite', type: 'reranking', context_length: 16000, description: 'Faster, cheaper reranker with slightly lower accuracy.' }
    ];
  }

  // ── SUPER TOOLS ───────────────────────────────────────────────────────────

  if (tool === 'voyage_compare_similarity') {
    // Embed two texts and return cosine similarity
    const { text1, text2, model = 'voyage-3' } = args;
    if (!text1 || !text2) throw new Error('text1 and text2 are required');
    const data = await voy('POST', '/embeddings', { input: [text1, text2], model, input_type: 'document' });
    const [emb1, emb2] = (data.data || []).map(e => e.embedding);
    if (!emb1 || !emb2) throw new Error('Failed to generate embeddings for both texts');
    const similarity = cosine(emb1, emb2);
    return {
      similarity: Math.round(similarity * 10000) / 10000,
      interpretation: similarity > 0.9 ? 'Very similar' : similarity > 0.7 ? 'Similar' : similarity > 0.5 ? 'Somewhat similar' : 'Different',
      model
    };
  }

  if (tool === 'voyage_search_pipeline') {
    // Embed query + search vectors + rerank in one call
    // Note: vectors must be provided (this tool doesn’t call Qdrant directly)
    const { query, candidate_documents, model = 'voyage-3', rerank_model = 'rerank-2', top_k = 5 } = args;
    if (!query) throw new Error('query is required');
    if (!candidate_documents?.length) throw new Error('candidate_documents array of strings is required');
    // 1. Embed the query
    const qData = await voy('POST', '/embeddings', { input: [query], model, input_type: 'query' });
    const queryEmbedding = qData.data?.[0]?.embedding;
    // 2. Score via cosine similarity
    const docData = await voy('POST', '/embeddings', { input: candidate_documents, model, input_type: 'document' });
    const docEmbeddings = (docData.data || []).map(e => e.embedding);
    const scored = candidate_documents.map((doc, i) => ({
      document: doc, index: i,
      cosine_score: cosine(queryEmbedding, docEmbeddings[i])
    })).sort((a, b) => b.cosine_score - a.cosine_score).slice(0, top_k * 2);
    // 3. Rerank the top candidates
    const rerankDocs = scored.map(s => s.document);
    const rrData = await voy('POST', '/rerank', { query, documents: rerankDocs, model: rerank_model, top_k, return_documents: true });
    return {
      results: (rrData.data || []).map(r => ({ document: r.document, relevance_score: r.relevance_score, index: r.index })),
      query_embedding_tokens: qData.usage?.total_tokens,
      rerank_model
    };
  }

  throw new Error(`Unknown voyage tool: ${tool}`);
}

export default { execute };
