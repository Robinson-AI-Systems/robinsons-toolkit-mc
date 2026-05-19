/**
 * Qdrant Handler — 18 tools
 * Vector database operations: collections, points (vectors),
 * search, and payload management. For AI features in YardSync/Cortiware.
 */

function getConfig() {
  const url = process.env.QDRANT_URL;
  if (!url) throw new Error('QDRANT_URL not set in .env');
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.QDRANT_API_KEY) headers['api-key'] = process.env.QDRANT_API_KEY;
  return { url: url.replace(/\/$/, ''), headers };
}

async function qd(method, path, body) {
  const { url, headers } = getConfig();
  const res = await fetch(`${url}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return { success: true };
  const data = await res.json();
  if (!res.ok) throw new Error(`Qdrant ${res.status}: ${data.status?.error || JSON.stringify(data)}`);
  return data.result !== undefined ? data.result : data;
}

async function execute(tool, args) {
  const { collection_name } = args;

  // ── COLLECTIONS ───────────────────────────────────────────────────────────
  if (tool === 'qdrant_list_collections') { return await qd('GET', '/collections'); }
  if (tool === 'qdrant_get_collection') { return await qd('GET', `/collections/${collection_name}`); }
  if (tool === 'qdrant_create_collection') {
    const { vector_size, distance = 'Cosine', on_disk_payload = false } = args;
    if (!vector_size) throw new Error('vector_size is required (e.g. 1536 for OpenAI text-embedding-3-small)');
    return await qd('PUT', `/collections/${collection_name}`, {
      vectors: { size: vector_size, distance },
      on_disk_payload
    });
  }
  if (tool === 'qdrant_delete_collection') { return await qd('DELETE', `/collections/${collection_name}`); }
  if (tool === 'qdrant_get_collection_info') { return await qd('GET', `/collections/${collection_name}`); }
  if (tool === 'qdrant_update_collection') {
    return await qd('PATCH', `/collections/${collection_name}`, { optimizers_config: args.optimizers_config, hnsw_config: args.hnsw_config });
  }

  // ── POINTS (VECTORS) ──────────────────────────────────────────────────────
  if (tool === 'qdrant_upsert_points') {
    const { points } = args;
    // points: [{id, vector, payload}]
    if (!points || !Array.isArray(points)) throw new Error('points array is required: [{id, vector, payload}]');
    return await qd('PUT', `/collections/${collection_name}/points`, { points });
  }
  if (tool === 'qdrant_get_point') {
    return await qd('GET', `/collections/${collection_name}/points/${args.point_id}`);
  }
  if (tool === 'qdrant_get_points') {
    return await qd('POST', `/collections/${collection_name}/points`, { ids: args.ids, with_payload: args.with_payload !== false, with_vector: args.with_vector || false });
  }
  if (tool === 'qdrant_delete_points') {
    return await qd('POST', `/collections/${collection_name}/points/delete`, { points: args.ids });
  }
  if (tool === 'qdrant_count_points') {
    return await qd('POST', `/collections/${collection_name}/points/count`, { filter: args.filter, exact: args.exact !== false });
  }
  if (tool === 'qdrant_scroll_points') {
    const { limit = 100, offset, filter, with_payload = true, with_vector = false } = args;
    return await qd('POST', `/collections/${collection_name}/points/scroll`, { limit, offset, filter, with_payload, with_vector });
  }
  if (tool === 'qdrant_update_payload') {
    return await qd('POST', `/collections/${collection_name}/points/payload`, { payload: args.payload, points: args.ids });
  }
  if (tool === 'qdrant_delete_payload') {
    return await qd('POST', `/collections/${collection_name}/points/payload/delete`, { keys: args.keys, points: args.ids });
  }

  // ── SEARCH ────────────────────────────────────────────────────────────────
  if (tool === 'qdrant_search') {
    const { vector, limit = 10, filter, with_payload = true, with_vector = false, score_threshold } = args;
    if (!vector) throw new Error('vector (embedding array) is required');
    const body = { vector, limit, with_payload, with_vector };
    if (filter) body.filter = filter;
    if (score_threshold !== undefined) body.score_threshold = score_threshold;
    return await qd('POST', `/collections/${collection_name}/points/search`, body);
  }
  if (tool === 'qdrant_search_batch') {
    const { searches } = args;
    return await qd('POST', `/collections/${collection_name}/points/search/batch`, { searches });
  }
  if (tool === 'qdrant_recommend') {
    const { positive, negative, limit = 10, filter, with_payload = true } = args;
    return await qd('POST', `/collections/${collection_name}/points/recommend`, { positive, negative: negative || [], limit, filter, with_payload });
  }

  throw new Error(`Unknown Qdrant tool: ${tool}`);
}

export default { execute };
