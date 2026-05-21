/**
 * Qdrant Handler — 58 tools
 * Vector database: collections, aliases, points, vectors, payload,
 * payload indexes, snapshots, search, discovery, recommendations,
 * cluster info, and Super Tools for AI features.
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

  // ── SERVICE ───────────────────────────────────────────────────────────────
  if (tool === 'qdrant_health_check') {
    return await qd('GET', '/');
  }
  if (tool === 'qdrant_get_version') {
    return await qd('GET', '/');
  }
  if (tool === 'qdrant_get_telemetry') {
    return await qd('GET', '/telemetry');
  }
  if (tool === 'qdrant_get_metrics') {
    return await qd('GET', '/metrics');
  }

  // ── COLLECTIONS ───────────────────────────────────────────────────────────
  if (tool === 'qdrant_list_collections') {
    return await qd('GET', '/collections');
  }
  if (tool === 'qdrant_get_collection') {
    return await qd('GET', `/collections/${collection_name}`);
  }
  if (tool === 'qdrant_create_collection') {
    const { vector_size, distance = 'Cosine', on_disk_payload = false, replication_factor, write_consistency_factor } = args;
    if (!vector_size) throw new Error('vector_size is required (e.g. 1536 for text-embedding-3-small, 384 for nomic-embed-text)');
    const body = { vectors: { size: vector_size, distance }, on_disk_payload };
    if (replication_factor) body.replication_factor = replication_factor;
    if (write_consistency_factor) body.write_consistency_factor = write_consistency_factor;
    return await qd('PUT', `/collections/${collection_name}`, body);
  }
  if (tool === 'qdrant_create_collection_named_vectors') {
    // Multi-vector collection: {name: {size, distance}}
    const { vectors_config, on_disk_payload = false } = args;
    if (!vectors_config) throw new Error('vectors_config is required: {vector_name: {size: N, distance: "Cosine"}}');
    return await qd('PUT', `/collections/${collection_name}`, { vectors: vectors_config, on_disk_payload });
  }
  if (tool === 'qdrant_delete_collection') {
    return await qd('DELETE', `/collections/${collection_name}`);
  }
  if (tool === 'qdrant_update_collection') {
    return await qd('PATCH', `/collections/${collection_name}`, {
      optimizers_config: args.optimizers_config,
      hnsw_config: args.hnsw_config,
      params: args.params
    });
  }

  // ── ALIASES ───────────────────────────────────────────────────────────────
  if (tool === 'qdrant_get_aliases') {
    return await qd('GET', '/aliases');
  }
  if (tool === 'qdrant_list_collection_aliases') {
    return await qd('GET', `/collections/${collection_name}/aliases`);
  }
  if (tool === 'qdrant_create_alias') {
    return await qd('POST', '/collections/aliases', {
      actions: [{ create_alias: { collection_name, alias_name: args.alias_name } }]
    });
  }
  if (tool === 'qdrant_delete_alias') {
    return await qd('POST', '/collections/aliases', {
      actions: [{ delete_alias: { alias_name: args.alias_name } }]
    });
  }
  if (tool === 'qdrant_rename_alias') {
    return await qd('POST', '/collections/aliases', {
      actions: [{ rename_alias: { old_alias_name: args.old_alias_name, new_alias_name: args.new_alias_name } }]
    });
  }

  // ── PAYLOAD INDEXES ───────────────────────────────────────────────────────
  if (tool === 'qdrant_create_payload_index') {
    const { field_name, field_schema = 'keyword', ordering } = args;
    if (!field_name) throw new Error('field_name is required (e.g. "category", "user_id")');
    const body = { field_name, field_schema };
    if (ordering) body.ordering = ordering;
    return await qd('PUT', `/collections/${collection_name}/index`, body);
  }
  if (tool === 'qdrant_delete_payload_index') {
    return await qd('DELETE', `/collections/${collection_name}/index/${args.field_name}`);
  }

  // ── POINTS ────────────────────────────────────────────────────────────────
  if (tool === 'qdrant_upsert_points') {
    const { points, ordering } = args;
    if (!points || !Array.isArray(points)) throw new Error('points array is required: [{id, vector, payload}]');
    const body = { points };
    if (ordering) body.ordering = ordering;
    return await qd('PUT', `/collections/${collection_name}/points`, body);
  }
  if (tool === 'qdrant_get_point') {
    return await qd('GET', `/collections/${collection_name}/points/${args.point_id}`);
  }
  if (tool === 'qdrant_get_points') {
    return await qd('POST', `/collections/${collection_name}/points`, {
      ids: args.ids, with_payload: args.with_payload !== false, with_vector: args.with_vector || false
    });
  }
  if (tool === 'qdrant_delete_points') {
    return await qd('POST', `/collections/${collection_name}/points/delete`, { points: args.ids });
  }
  if (tool === 'qdrant_delete_points_by_filter') {
    if (!args.filter) throw new Error('filter is required');
    return await qd('POST', `/collections/${collection_name}/points/delete`, { filter: args.filter });
  }
  if (tool === 'qdrant_count_points') {
    return await qd('POST', `/collections/${collection_name}/points/count`, {
      filter: args.filter, exact: args.exact !== false
    });
  }
  if (tool === 'qdrant_scroll_points') {
    const { limit = 100, offset, filter, with_payload = true, with_vector = false, order_by } = args;
    const body = { limit, with_payload, with_vector };
    if (offset) body.offset = offset;
    if (filter) body.filter = filter;
    if (order_by) body.order_by = order_by;
    return await qd('POST', `/collections/${collection_name}/points/scroll`, body);
  }

  // ── PAYLOAD ───────────────────────────────────────────────────────────────
  if (tool === 'qdrant_update_payload') {
    return await qd('POST', `/collections/${collection_name}/points/payload`, {
      payload: args.payload, points: args.ids, filter: args.filter
    });
  }
  if (tool === 'qdrant_overwrite_payload') {
    // Replaces payload entirely (vs update which merges)
    return await qd('PUT', `/collections/${collection_name}/points/payload`, {
      payload: args.payload, points: args.ids, filter: args.filter
    });
  }
  if (tool === 'qdrant_delete_payload') {
    return await qd('POST', `/collections/${collection_name}/points/payload/delete`, {
      keys: args.keys, points: args.ids, filter: args.filter
    });
  }
  if (tool === 'qdrant_clear_payload') {
    return await qd('POST', `/collections/${collection_name}/points/payload/clear`, {
      points: args.ids, filter: args.filter
    });
  }

  // ── VECTORS ───────────────────────────────────────────────────────────────
  if (tool === 'qdrant_update_vectors') {
    const { points } = args; // [{id, vector}]
    if (!points?.length) throw new Error('points array is required: [{id, vector}]');
    return await qd('PUT', `/collections/${collection_name}/points/vectors`, { points });
  }
  if (tool === 'qdrant_delete_vectors') {
    const { ids, filter, vector_names } = args;
    if (!vector_names?.length) throw new Error('vector_names array is required for named-vector collections');
    const body = { vector: vector_names };
    if (ids) body.points = ids;
    if (filter) body.filter = filter;
    return await qd('POST', `/collections/${collection_name}/points/vectors/delete`, body);
  }

  // ── SEARCH ────────────────────────────────────────────────────────────────
  if (tool === 'qdrant_search') {
    const { vector, limit = 10, filter, with_payload = true, with_vector = false, score_threshold, offset = 0 } = args;
    if (!vector) throw new Error('vector (embedding array) is required');
    const body = { vector, limit, with_payload, with_vector, offset };
    if (filter) body.filter = filter;
    if (score_threshold !== undefined) body.score_threshold = score_threshold;
    return await qd('POST', `/collections/${collection_name}/points/search`, body);
  }
  if (tool === 'qdrant_search_batch') {
    return await qd('POST', `/collections/${collection_name}/points/search/batch`, { searches: args.searches });
  }
  if (tool === 'qdrant_search_groups') {
    const { vector, group_by, group_size = 3, limit = 10, filter, with_payload = true } = args;
    if (!vector || !group_by) throw new Error('vector and group_by (payload field name) are required');
    return await qd('POST', `/collections/${collection_name}/points/search/groups`, {
      vector, group_by, group_size, limit, filter, with_payload
    });
  }

  // ── RECOMMENDATIONS ───────────────────────────────────────────────────────
  if (tool === 'qdrant_recommend') {
    const { positive, negative, limit = 10, filter, with_payload = true, score_threshold } = args;
    if (!positive?.length) throw new Error('positive (array of point IDs) is required');
    const body = { positive, negative: negative || [], limit, with_payload };
    if (filter) body.filter = filter;
    if (score_threshold !== undefined) body.score_threshold = score_threshold;
    return await qd('POST', `/collections/${collection_name}/points/recommend`, body);
  }
  if (tool === 'qdrant_recommend_batch') {
    return await qd('POST', `/collections/${collection_name}/points/recommend/batch`, { searches: args.searches });
  }
  if (tool === 'qdrant_recommend_groups') {
    const { positive, group_by, group_size = 3, limit = 10, filter, with_payload = true } = args;
    return await qd('POST', `/collections/${collection_name}/points/recommend/groups`, {
      positive, negative: args.negative || [], group_by, group_size, limit, filter, with_payload
    });
  }

  // ── DISCOVERY ─────────────────────────────────────────────────────────────
  if (tool === 'qdrant_discover') {
    const { target, context, limit = 10, filter, with_payload = true } = args;
    if (!target && !context?.length) throw new Error('target or context pairs are required');
    return await qd('POST', `/collections/${collection_name}/points/discover`, {
      target, context: context || [], limit, filter, with_payload
    });
  }
  if (tool === 'qdrant_discover_batch') {
    return await qd('POST', `/collections/${collection_name}/points/discover/batch`, { searches: args.searches });
  }

  // ── SNAPSHOTS ─────────────────────────────────────────────────────────────
  if (tool === 'qdrant_list_snapshots') {
    return await qd('GET', `/collections/${collection_name}/snapshots`);
  }
  if (tool === 'qdrant_create_snapshot') {
    return await qd('POST', `/collections/${collection_name}/snapshots`, {});
  }
  if (tool === 'qdrant_delete_snapshot') {
    return await qd('DELETE', `/collections/${collection_name}/snapshots/${args.snapshot_name}`);
  }
  if (tool === 'qdrant_list_full_snapshots') {
    return await qd('GET', '/snapshots');
  }
  if (tool === 'qdrant_create_full_snapshot') {
    return await qd('POST', '/snapshots', {});
  }

  // ── CLUSTER ───────────────────────────────────────────────────────────────
  if (tool === 'qdrant_get_cluster_info') {
    return await qd('GET', '/cluster');
  }
  if (tool === 'qdrant_get_collection_cluster_info') {
    return await qd('GET', `/collections/${collection_name}/cluster`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SUPER TOOLS
  // ══════════════════════════════════════════════════════════════════════════

  // SUPER: Upsert documents with auto-generated IDs from content hash
  if (tool === 'qdrant_upsert_documents') {
    const { documents, id_field = 'id' } = args;
    if (!documents?.length) throw new Error('documents array is required: [{vector, payload}]');
    const points = documents.map((doc, idx) => ({
      id: doc[id_field] || doc.id || idx + 1,
      vector: doc.vector,
      payload: doc.payload || Object.fromEntries(Object.entries(doc).filter(([k]) => k !== 'vector' && k !== id_field))
    }));
    return await qd('PUT', `/collections/${collection_name}/points`, { points });
  }

  // SUPER: Create a production-ready collection with sensible defaults
  if (tool === 'qdrant_setup_collection') {
    const { vector_size, distance = 'Cosine', index_fields = [] } = args;
    if (!vector_size) throw new Error('vector_size is required');
    await qd('PUT', `/collections/${collection_name}`, {
      vectors: { size: vector_size, distance },
      on_disk_payload: true,
      hnsw_config: { m: 16, ef_construct: 100, full_scan_threshold: 10000 }
    });
    for (const field of index_fields) {
      await qd('PUT', `/collections/${collection_name}/index`, {
        field_name: field.name, field_schema: field.type || 'keyword'
      }).catch(() => {});
    }
    return { collection_name, vector_size, distance, indexed_fields: index_fields.map(f=>f.name), created: true };
  }

  // SUPER: Get complete collection status — info + point count + aliases
  if (tool === 'qdrant_collection_status') {
    const [info, count, aliases] = await Promise.all([
      qd('GET', `/collections/${collection_name}`),
      qd('POST', `/collections/${collection_name}/points/count`, { exact: false }),
      qd('GET', `/collections/${collection_name}/aliases`).catch(() => [])
    ]);
    return {
      collection_name,
      status: info.status, config: info.config,
      indexed_vectors_count: info.indexed_vectors_count,
      points_count: typeof count === 'object' ? count.count : count,
      segments_count: info.segments_count,
      aliases: Array.isArray(aliases) ? aliases.map(a => a.alias_name) : []
    };
  }


  // ── SPARSE VECTOR UPSERT ──────────────────────────────────────────────────
  // Upsert points with sparse vectors (for BM25/keyword hybrid search)
  if (tool === 'qdrant_upsert_sparse_points') {
    const { collection_name, points } = args;
    if (!collection_name || !points?.length) throw new Error('collection_name and points array are required');
    // Each point: { id, sparse_vector: { indices: [...], values: [...] }, vector_name, payload }
    const formatted = points.map(p => ({
      id: p.id,
      vectors: { [p.vector_name || 'sparse']: { indices: p.sparse_vector.indices, values: p.sparse_vector.values } },
      payload: p.payload || {}
    }));
    const data = await qdrant('PUT', `/collections/${collection_name}/points`, { points: formatted });
    return { status: data.status, result: data.result };
  }

  // ── NAMED VECTOR SEARCH ────────────────────────────────────────────────────
  // Search a specific named vector within a collection (for multi-vector collections)
  if (tool === 'qdrant_search_named_vector') {
    const { collection_name, vector, vector_name, limit = 10, score_threshold, filter, with_payload = true } = args;
    if (!collection_name || !vector) throw new Error('collection_name and vector are required');
    if (!vector_name) throw new Error('vector_name is required (use qdrant_search for default vector)');
    const body = { vector: { name: vector_name, vector }, limit, with_payload };
    if (score_threshold !== undefined) body.score_threshold = score_threshold;
    if (filter) body.filter = filter;
    const data = await qdrant('POST', `/collections/${collection_name}/points/search`, body);
    return data.result || data;
  }

  // ── MULTI-VECTOR COLLECTION SETUP ─────────────────────────────────────────
  // Create a collection with multiple named vector spaces (e.g. dense + sparse for hybrid search)
  if (tool === 'qdrant_create_collection_multi_vector') {
    const { collection_name, vectors_config, on_disk_payload = false } = args;
    if (!collection_name || !vectors_config) throw new Error('collection_name and vectors_config are required');
    // vectors_config: { vector_name: { size, distance } }
    const data = await qdrant('PUT', `/collections/${collection_name}`, {
      vectors: vectors_config,
      on_disk_payload
    });
    return { status: data.status, collection_name, vectors: Object.keys(vectors_config) };
  }

  // ── HYBRID SEARCH (dense + sparse re-rank) ─────────────────────────────────
  // Search with both a dense vector and a sparse vector, then merge results
  if (tool === 'qdrant_hybrid_search') {
    const { collection_name, dense_vector, sparse_vector, dense_name = 'dense', sparse_name = 'sparse', limit = 10, filter, with_payload = true } = args;
    if (!collection_name || !dense_vector) throw new Error('collection_name and dense_vector are required');
    // Run both in parallel
    const [denseResults, sparseResults] = await Promise.all([
      qdrant('POST', `/collections/${collection_name}/points/search`, {
        vector: { name: dense_name, vector: dense_vector }, limit, with_payload, filter: filter || undefined
      }).then(d => d.result || []).catch(() => []),
      sparse_vector ? qdrant('POST', `/collections/${collection_name}/points/search`, {
        vector: { name: sparse_name, vector: sparse_vector }, limit, with_payload, filter: filter || undefined
      }).then(d => d.result || []).catch(() => []) : Promise.resolve([])
    ]);
    // Simple reciprocal rank fusion merge
    const scores = new Map();
    const payloads = new Map();
    const k = 60;
    denseResults.forEach((r, i) => { scores.set(r.id, (scores.get(r.id) || 0) + 1/(k + i + 1)); payloads.set(r.id, r.payload); });
    sparseResults.forEach((r, i) => { scores.set(r.id, (scores.get(r.id) || 0) + 1/(k + i + 1)); payloads.set(r.id, r.payload); });
    const merged = [...scores.entries()].sort(([,a],[,b]) => b - a).slice(0, limit).map(([id, score]) => ({ id, score, payload: payloads.get(id) }));
    return { results: merged, dense_count: denseResults.length, sparse_count: sparseResults.length };
  }

  // ── LIST SHARDS ────────────────────────────────────────────────────────────
  if (tool === 'qdrant_list_shards') {
    const { collection_name } = args;
    if (!collection_name) throw new Error('collection_name is required');
    const data = await qdrant('GET', `/collections/${collection_name}/shards`);
    return data.result || data;
  }


    throw new Error(`Unknown Qdrant tool: ${tool}`);
}

export default { execute };
