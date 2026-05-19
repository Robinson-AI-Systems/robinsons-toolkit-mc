/**
 * Supabase Handler — 38 tools
 * Database operations, auth management, storage, edge functions,
 * realtime, and project management via the Supabase Management API.
 */

const MGMT_BASE = 'https://api.supabase.com/v1';

function mgmtHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set in .env');
  return { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };
}

function projectHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'apikey': key };
}

const projectUrl = (ref) => {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error('SUPABASE_URL not set in .env');
  if (ref) return `https://${ref}.supabase.co`;
  return url;
};

async function mgmt(method, path, body) {
  const res = await fetch(`${MGMT_BASE}${path}`, {
    method, headers: mgmtHeaders(),
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return { success: true };
  const data = await res.json();
  if (!res.ok) throw new Error(`Supabase Mgmt ${res.status}: ${data.message || JSON.stringify(data)}`);
  return data;
}

async function proj(method, path, body, projectRef) {
  const base = projectUrl(projectRef);
  const res = await fetch(`${base}${path}`, {
    method, headers: projectHeaders(),
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return { success: true };
  const data = await res.json();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${data.message || data.hint || JSON.stringify(data)}`);
  return data;
}

async function execute(tool, args) {
  const { project_ref } = args;

  // ── PROJECT MANAGEMENT ────────────────────────────────────────────────────
  if (tool === 'supabase_list_projects') { return await mgmt('GET', '/projects'); }
  if (tool === 'supabase_get_project') { return await mgmt('GET', `/projects/${project_ref}`); }
  if (tool === 'supabase_pause_project') { return await mgmt('POST', `/projects/${project_ref}/pause`, {}); }
  if (tool === 'supabase_restore_project') { return await mgmt('POST', `/projects/${project_ref}/restore`, {}); }
  if (tool === 'supabase_get_project_health') { return await mgmt('GET', `/projects/${project_ref}/health`); }

  // ── SQL / DATABASE ────────────────────────────────────────────────────────
  if (tool === 'supabase_run_sql') {
    if (!args.sql) throw new Error('sql is required');
    return await proj('POST', '/rest/v1/rpc/query', { query: args.sql }, project_ref);
  }
  if (tool === 'supabase_run_query_via_mgmt') {
    // More reliable SQL execution via management API
    return await mgmt('POST', `/projects/${project_ref}/database/query`, { query: args.sql });
  }
  if (tool === 'supabase_list_tables') {
    return await mgmt('GET', `/projects/${project_ref}/database/tables?included_schemas=public`);
  }
  if (tool === 'supabase_describe_table') {
    const { schema = 'public', table_name } = args;
    return await mgmt('GET', `/projects/${project_ref}/database/columns?table_id=${table_name}&schema=${schema}`);
  }
  if (tool === 'supabase_list_migrations') { return await mgmt('GET', `/projects/${project_ref}/database/migrations`); }
  if (tool === 'supabase_run_migration') {
    return await mgmt('POST', `/projects/${project_ref}/database/migrations`, { name: args.name, statements: [args.sql] });
  }

  // ── REALTIME ──────────────────────────────────────────────────────────────
  if (tool === 'supabase_list_publications') {
    return await mgmt('GET', `/projects/${project_ref}/database/publications`);
  }

  // ── AUTH / USERS ──────────────────────────────────────────────────────────
  if (tool === 'supabase_list_users') {
    const { page = 1, per_page = 50 } = args;
    return await proj('GET', `/auth/v1/admin/users?page=${page}&per_page=${per_page}`, null, project_ref);
  }
  if (tool === 'supabase_get_user') {
    return await proj('GET', `/auth/v1/admin/users/${args.user_id}`, null, project_ref);
  }
  if (tool === 'supabase_create_user') {
    const { email, password, phone, email_confirm = true, user_metadata } = args;
    const body = { email, password, phone, email_confirm };
    if (user_metadata) body.user_metadata = user_metadata;
    return await proj('POST', '/auth/v1/admin/users', body, project_ref);
  }
  if (tool === 'supabase_update_user') {
    const { user_id, ...updates } = args;
    return await proj('PUT', `/auth/v1/admin/users/${user_id}`, updates, project_ref);
  }
  if (tool === 'supabase_delete_user') {
    return await proj('DELETE', `/auth/v1/admin/users/${args.user_id}`, null, project_ref);
  }
  if (tool === 'supabase_invite_user') {
    return await proj('POST', '/auth/v1/invite', { email: args.email, data: args.metadata || {} }, project_ref);
  }
  if (tool === 'supabase_send_password_reset') {
    return await proj('POST', '/auth/v1/recover', { email: args.email }, project_ref);
  }
  if (tool === 'supabase_list_auth_providers') {
    return await mgmt('GET', `/projects/${project_ref}/config/auth`);
  }
  if (tool === 'supabase_update_auth_config') {
    const { project_ref: ref, ...config } = args;
    return await mgmt('PATCH', `/projects/${project_ref}/config/auth`, config);
  }

  // ── STORAGE ───────────────────────────────────────────────────────────────
  if (tool === 'supabase_list_buckets') {
    return await proj('GET', '/storage/v1/bucket', null, project_ref);
  }
  if (tool === 'supabase_create_bucket') {
    return await proj('POST', '/storage/v1/bucket', { id: args.name, name: args.name, public: args.public || false, fileSizeLimit: args.file_size_limit }, project_ref);
  }
  if (tool === 'supabase_delete_bucket') {
    return await proj('DELETE', `/storage/v1/bucket/${args.bucket_id}`, null, project_ref);
  }
  if (tool === 'supabase_empty_bucket') {
    return await proj('POST', `/storage/v1/bucket/${args.bucket_id}/empty`, {}, project_ref);
  }
  if (tool === 'supabase_list_objects') {
    const { bucket_id, prefix = '', limit = 100, offset = 0, search } = args;
    return await proj('POST', `/storage/v1/object/list/${bucket_id}`, { prefix, limit, offset, search: search || '' }, project_ref);
  }
  if (tool === 'supabase_get_signed_url') {
    const { bucket_id, path: filePath, expires_in = 3600 } = args;
    return await proj('POST', `/storage/v1/object/sign/${bucket_id}/${filePath}`, { expiresIn: expires_in }, project_ref);
  }
  if (tool === 'supabase_delete_objects') {
    return await proj('DELETE', `/storage/v1/object/${args.bucket_id}`, { prefixes: args.paths }, project_ref);
  }
  if (tool === 'supabase_move_object') {
    return await proj('POST', `/storage/v1/object/move`, { bucketId: args.bucket_id, sourceKey: args.source_path, destinationKey: args.destination_path }, project_ref);
  }
  if (tool === 'supabase_copy_object') {
    return await proj('POST', `/storage/v1/object/copy`, { bucketId: args.bucket_id, sourceKey: args.source_path, destinationKey: args.destination_path }, project_ref);
  }

  // ── EDGE FUNCTIONS ────────────────────────────────────────────────────────
  if (tool === 'supabase_list_edge_functions') {
    return await mgmt('GET', `/projects/${project_ref}/functions`);
  }
  if (tool === 'supabase_get_edge_function') {
    return await mgmt('GET', `/projects/${project_ref}/functions/${args.function_slug}`);
  }
  if (tool === 'supabase_delete_edge_function') {
    return await mgmt('DELETE', `/projects/${project_ref}/functions/${args.function_slug}`);
  }
  if (tool === 'supabase_invoke_edge_function') {
    const { function_slug, body: fnBody, method: fnMethod = 'POST' } = args;
    return await proj(fnMethod, `/functions/v1/${function_slug}`, fnBody, project_ref);
  }

  // ── API KEYS ──────────────────────────────────────────────────────────────
  if (tool === 'supabase_get_api_keys') { return await mgmt('GET', `/projects/${project_ref}/api-keys`); }
  if (tool === 'supabase_get_project_url') {
    const config = await mgmt('GET', `/projects/${project_ref}/api`);
    return { url: `https://${project_ref}.supabase.co`, anon_key: config.anon_key, service_role_key: '***hidden***' };
  }

  throw new Error(`Unknown Supabase tool: ${tool}`);
}

export default { execute };
