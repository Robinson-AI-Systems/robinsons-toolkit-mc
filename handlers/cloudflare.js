/**
 * Cloudflare Handler — 58 tools
 * Workers, KV, R2, DNS, Zones, Pages, and firewall rules.
 */

const BASE = 'https://api.cloudflare.com/client/v4';

function headers() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN not set in .env');
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const ACCT = () => process.env.CLOUDFLARE_ACCOUNT_ID;

async function cf(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: headers(),
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!data.success && data.errors?.length) throw new Error(`Cloudflare: ${data.errors.map(e => e.message).join(', ')}`);
  return data.result !== undefined ? data.result : data;
}

async function execute(tool, args) {
  const { zone_id, namespace_id, bucket_name, worker_name } = args;

  // ── ZONES ─────────────────────────────────────────────────────────────────
  if (tool === 'cf_list_zones') {
    return await cf('GET', `/zones?per_page=${args.per_page || 20}&name=${args.name || ''}&status=${args.status || ''}`);
  }
  if (tool === 'cf_get_zone') { return await cf('GET', `/zones/${zone_id}`); }
  if (tool === 'cf_create_zone') {
    return await cf('POST', '/zones', { name: args.name, account: { id: ACCT() }, jump_start: args.jump_start !== false });
  }
  if (tool === 'cf_delete_zone') { return await cf('DELETE', `/zones/${zone_id}`); }
  if (tool === 'cf_purge_cache') {
    const body = args.purge_everything ? { purge_everything: true } : { files: args.files };
    return await cf('POST', `/zones/${zone_id}/purge_cache`, body);
  }
  if (tool === 'cf_get_zone_settings') { return await cf('GET', `/zones/${zone_id}/settings`); }
  if (tool === 'cf_update_zone_setting') {
    return await cf('PATCH', `/zones/${zone_id}/settings/${args.setting_id}`, { value: args.value });
  }
  if (tool === 'cf_get_analytics') {
    return await cf('GET', `/zones/${zone_id}/analytics/dashboard?since=${args.since || '-1440'}&until=${args.until || '0'}&continuous=false`);
  }

  // ── DNS RECORDS ───────────────────────────────────────────────────────────
  if (tool === 'cf_list_dns_records') {
    let path = `/zones/${zone_id}/dns_records?per_page=${args.per_page || 100}`;
    if (args.type) path += `&type=${args.type}`;
    if (args.name) path += `&name=${args.name}`;
    return await cf('GET', path);
  }
  if (tool === 'cf_get_dns_record') { return await cf('GET', `/zones/${zone_id}/dns_records/${args.record_id}`); }
  if (tool === 'cf_create_dns_record') {
    const { type, name, content, ttl = 1, proxied = false, priority } = args;
    if (!type || !name || !content) throw new Error('type, name, and content are required');
    const body = { type, name, content, ttl, proxied };
    if (priority !== undefined) body.priority = priority;
    return await cf('POST', `/zones/${zone_id}/dns_records`, body);
  }
  if (tool === 'cf_update_dns_record') {
    const { record_id, type, name, content, ttl, proxied } = args;
    const body = {};
    if (type) body.type = type; if (name) body.name = name; if (content) body.content = content;
    if (ttl !== undefined) body.ttl = ttl; if (proxied !== undefined) body.proxied = proxied;
    return await cf('PATCH', `/zones/${zone_id}/dns_records/${record_id}`, body);
  }
  if (tool === 'cf_delete_dns_record') { return await cf('DELETE', `/zones/${zone_id}/dns_records/${args.record_id}`); }
  if (tool === 'cf_import_dns_records') {
    // BIND format import — send as multipart (simplified version)
    return { note: 'DNS import requires multipart upload. Use the Cloudflare dashboard or CLI for bulk imports. Use cf_create_dns_record for individual records.' };
  }

  // ── WORKERS ───────────────────────────────────────────────────────────────
  if (tool === 'cf_list_workers') {
    return await cf('GET', `/accounts/${ACCT()}/workers/scripts`);
  }
  if (tool === 'cf_get_worker') {
    return await cf('GET', `/accounts/${ACCT()}/workers/scripts/${worker_name}`);
  }
  if (tool === 'cf_deploy_worker') {
    const { name, script, compatibility_date = '2024-01-01', bindings } = args;
    if (!name || !script) throw new Error('name and script (JS source code) are required');
    // Workers deployment uses multipart form data
    const formData = new FormData();
    formData.append('worker.js', new Blob([script], { type: 'application/javascript' }), 'worker.js');
    const metadata = { main_module: 'worker.js', compatibility_date, bindings: bindings || [] };
    formData.append('metadata', JSON.stringify(metadata));
    const res = await fetch(`${BASE}/accounts/${ACCT()}/workers/scripts/${name}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
      body: formData
    });
    const data = await res.json();
    if (!data.success) throw new Error(`Worker deploy failed: ${data.errors?.map(e => e.message).join(', ')}`);
    return data.result;
  }
  if (tool === 'cf_delete_worker') {
    return await cf('DELETE', `/accounts/${ACCT()}/workers/scripts/${worker_name}`);
  }
  if (tool === 'cf_list_worker_routes') { return await cf('GET', `/zones/${zone_id}/workers/routes`); }
  if (tool === 'cf_create_worker_route') {
    return await cf('POST', `/zones/${zone_id}/workers/routes`, { pattern: args.pattern, script: args.script_name });
  }
  if (tool === 'cf_delete_worker_route') { return await cf('DELETE', `/zones/${zone_id}/workers/routes/${args.route_id}`); }
  if (tool === 'cf_list_worker_cron_triggers') {
    return await cf('GET', `/accounts/${ACCT()}/workers/scripts/${worker_name}/schedules`);
  }
  if (tool === 'cf_update_worker_cron_triggers') {
    return await cf('PUT', `/accounts/${ACCT()}/workers/scripts/${worker_name}/schedules`, args.schedules || []);
  }
  if (tool === 'cf_get_worker_subdomain') { return await cf('GET', `/accounts/${ACCT()}/workers/subdomain`); }

  // ── KV NAMESPACES ─────────────────────────────────────────────────────────
  if (tool === 'cf_list_kv_namespaces') {
    return await cf('GET', `/accounts/${ACCT()}/storage/kv/namespaces?per_page=${args.per_page || 20}`);
  }
  if (tool === 'cf_create_kv_namespace') {
    return await cf('POST', `/accounts/${ACCT()}/storage/kv/namespaces`, { title: args.title });
  }
  if (tool === 'cf_delete_kv_namespace') {
    return await cf('DELETE', `/accounts/${ACCT()}/storage/kv/namespaces/${namespace_id}`);
  }
  if (tool === 'cf_rename_kv_namespace') {
    return await cf('PUT', `/accounts/${ACCT()}/storage/kv/namespaces/${namespace_id}`, { title: args.title });
  }

  // ── KV VALUES ─────────────────────────────────────────────────────────────
  if (tool === 'cf_kv_get') {
    const res = await fetch(`${BASE}/accounts/${ACCT()}/storage/kv/namespaces/${namespace_id}/values/${encodeURIComponent(args.key)}`, { headers: headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`KV get failed: ${res.status}`);
    return await res.text();
  }
  if (tool === 'cf_kv_put') {
    const url = `${BASE}/accounts/${ACCT()}/storage/kv/namespaces/${namespace_id}/values/${encodeURIComponent(args.key)}`;
    let body = args.value;
    const headers_obj = { 'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` };
    if (args.expiration) headers_obj['cf-expiration'] = args.expiration;
    if (args.expiration_ttl) headers_obj['cf-expiration-ttl'] = args.expiration_ttl;
    if (args.metadata) {
      const form = new FormData();
      form.append('value', args.value); form.append('metadata', JSON.stringify(args.metadata));
      const res = await fetch(url, { method: 'PUT', headers: headers_obj, body: form });
      return res.ok ? { success: true } : { success: false };
    }
    const res = await fetch(url, { method: 'PUT', headers: { ...headers_obj, 'Content-Type': 'text/plain' }, body });
    return res.ok ? { success: true } : { success: false };
  }
  if (tool === 'cf_kv_delete') {
    return await cf('DELETE', `/accounts/${ACCT()}/storage/kv/namespaces/${namespace_id}/values/${encodeURIComponent(args.key)}`);
  }
  if (tool === 'cf_kv_list_keys') {
    let path = `/accounts/${ACCT()}/storage/kv/namespaces/${namespace_id}/keys?limit=${args.limit || 100}`;
    if (args.prefix) path += `&prefix=${encodeURIComponent(args.prefix)}`;
    if (args.cursor) path += `&cursor=${args.cursor}`;
    return await cf('GET', path);
  }
  if (tool === 'cf_kv_bulk_put') {
    // items: array of { key, value, expiration_ttl?, metadata? }
    return await cf('PUT', `/accounts/${ACCT()}/storage/kv/namespaces/${namespace_id}/bulk`, args.items);
  }
  if (tool === 'cf_kv_bulk_delete') {
    return await cf('DELETE', `/accounts/${ACCT()}/storage/kv/namespaces/${namespace_id}/bulk`, args.keys);
  }

  // ── R2 BUCKETS ────────────────────────────────────────────────────────────
  if (tool === 'cf_list_r2_buckets') {
    return await cf('GET', `/accounts/${ACCT()}/r2/buckets?per_page=${args.per_page || 20}`);
  }
  if (tool === 'cf_get_r2_bucket') { return await cf('GET', `/accounts/${ACCT()}/r2/buckets/${bucket_name}`); }
  if (tool === 'cf_create_r2_bucket') {
    return await cf('POST', `/accounts/${ACCT()}/r2/buckets`, { name: args.name, locationHint: args.location_hint });
  }
  if (tool === 'cf_delete_r2_bucket') { return await cf('DELETE', `/accounts/${ACCT()}/r2/buckets/${bucket_name}`); }
  if (tool === 'cf_get_r2_bucket_cors') { return await cf('GET', `/accounts/${ACCT()}/r2/buckets/${bucket_name}/cors`); }
  if (tool === 'cf_put_r2_bucket_cors') {
    return await cf('PUT', `/accounts/${ACCT()}/r2/buckets/${bucket_name}/cors`, { rules: args.rules });
  }

  // ── PAGES ─────────────────────────────────────────────────────────────────
  if (tool === 'cf_list_pages_projects') {
    return await cf('GET', `/accounts/${ACCT()}/pages/projects?per_page=${args.per_page || 20}`);
  }
  if (tool === 'cf_get_pages_project') {
    return await cf('GET', `/accounts/${ACCT()}/pages/projects/${args.project_name}`);
  }
  if (tool === 'cf_list_pages_deployments') {
    return await cf('GET', `/accounts/${ACCT()}/pages/projects/${args.project_name}/deployments?per_page=${args.per_page || 10}`);
  }
  if (tool === 'cf_get_pages_deployment') {
    return await cf('GET', `/accounts/${ACCT()}/pages/projects/${args.project_name}/deployments/${args.deployment_id}`);
  }
  if (tool === 'cf_retry_pages_deployment') {
    return await cf('POST', `/accounts/${ACCT()}/pages/projects/${args.project_name}/deployments/${args.deployment_id}/retry`, {});
  }
  if (tool === 'cf_rollback_pages_deployment') {
    return await cf('POST', `/accounts/${ACCT()}/pages/projects/${args.project_name}/deployments/${args.deployment_id}/rollback`, {});
  }
  if (tool === 'cf_list_pages_domains') {
    return await cf('GET', `/accounts/${ACCT()}/pages/projects/${args.project_name}/domains`);
  }
  if (tool === 'cf_add_pages_domain') {
    return await cf('POST', `/accounts/${ACCT()}/pages/projects/${args.project_name}/domains`, { name: args.domain });
  }

  // ── FIREWALL / WAF ────────────────────────────────────────────────────────
  if (tool === 'cf_list_firewall_rules') {
    return await cf('GET', `/zones/${zone_id}/firewall/rules?per_page=${args.per_page || 20}`);
  }
  if (tool === 'cf_create_firewall_rule') {
    const { action, expression, description } = args;
    const filter = await cf('POST', `/zones/${zone_id}/filters`, [{ expression, description }]);
    return await cf('POST', `/zones/${zone_id}/firewall/rules`, [{ action, filter: { id: filter[0].id }, description }]);
  }
  if (tool === 'cf_delete_firewall_rule') {
    return await cf('DELETE', `/zones/${zone_id}/firewall/rules/${args.rule_id}`);
  }
  if (tool === 'cf_list_rate_limits') {
    return await cf('GET', `/zones/${zone_id}/rate_limits?per_page=${args.per_page || 20}`);
  }

  // ── ACCOUNT ───────────────────────────────────────────────────────────────
  if (tool === 'cf_get_account') { return await cf('GET', `/accounts/${ACCT()}`); }
  if (tool === 'cf_list_account_members') { return await cf('GET', `/accounts/${ACCT()}/members?per_page=${args.per_page || 20}`); }

  throw new Error(`Unknown Cloudflare tool: ${tool}`);
}

export default { execute };
