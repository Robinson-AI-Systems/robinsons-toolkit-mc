/**
 * n8n Handler — 52 tools
 * Workflow automation: workflows, executions, credentials,
 * variables, tags, users, webhooks, source control, and Super Tools.
 */

function getConfig() {
  const base = process.env.N8N_BASE_URL;
  const key = process.env.N8N_API_KEY;
  if (!base) throw new Error('N8N_BASE_URL not set in .env (e.g. https://n8n.yourdomain.com)');
  if (!key) throw new Error('N8N_API_KEY not set in .env');
  return { base: base.replace(/\/$/, ''), key };
}

async function n8n(method, path, body) {
  const { base, key } = getConfig();
  const res = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return { success: true };
  const data = await res.json();
  if (!res.ok) throw new Error(`n8n ${res.status}: ${data.message || JSON.stringify(data)}`);
  return data;
}

async function execute(tool, args) {

  // ── WORKFLOWS ─────────────────────────────────────────────────────────────
  if (tool === 'n8n_list_workflows') {
    const { limit = 50, cursor, active, tags, name } = args;
    let path = `/workflows?limit=${limit}`;
    if (cursor) path += `&cursor=${cursor}`;
    if (active !== undefined) path += `&active=${active}`;
    if (tags) path += `&tags=${encodeURIComponent(tags)}`;
    if (name) path += `&name=${encodeURIComponent(name)}`;
    return await n8n('GET', path);
  }
  if (tool === 'n8n_get_workflow') {
    return await n8n('GET', `/workflows/${args.workflow_id}`);
  }
  if (tool === 'n8n_create_workflow') {
    const { name, nodes = [], connections = {}, settings = {}, active = false, tags } = args;
    if (!name) throw new Error('name is required');
    const body = { name, nodes, connections, settings, active };
    if (tags) body.tags = tags;
    return await n8n('POST', '/workflows', body);
  }
  if (tool === 'n8n_update_workflow') {
    const { workflow_id, name, nodes, connections, settings, active } = args;
    const body = {};
    if (name !== undefined) body.name = name;
    if (nodes !== undefined) body.nodes = nodes;
    if (connections !== undefined) body.connections = connections;
    if (settings !== undefined) body.settings = settings;
    if (active !== undefined) body.active = active;
    return await n8n('PATCH', `/workflows/${workflow_id}`, body);
  }
  if (tool === 'n8n_delete_workflow') {
    return await n8n('DELETE', `/workflows/${args.workflow_id}`);
  }
  if (tool === 'n8n_activate_workflow') {
    return await n8n('PATCH', `/workflows/${args.workflow_id}/activate`);
  }
  if (tool === 'n8n_deactivate_workflow') {
    return await n8n('PATCH', `/workflows/${args.workflow_id}/deactivate`);
  }
  if (tool === 'n8n_get_workflow_tags') {
    return await n8n('GET', `/workflows/${args.workflow_id}/tags`);
  }
  if (tool === 'n8n_update_workflow_tags') {
    return await n8n('PUT', `/workflows/${args.workflow_id}/tags`, args.tag_ids.map(id => ({ id })));
  }
  if (tool === 'n8n_transfer_workflow') {
    return await n8n('PUT', `/workflows/${args.workflow_id}/transfer`, { destinationProjectId: args.project_id });
  }

  // ── EXECUTIONS ────────────────────────────────────────────────────────────
  if (tool === 'n8n_list_executions') {
    const { limit = 20, cursor, workflow_id, status, include_data = false } = args;
    let path = `/executions?limit=${limit}&includeData=${include_data}`;
    if (cursor) path += `&cursor=${cursor}`;
    if (workflow_id) path += `&workflowId=${workflow_id}`;
    if (status) path += `&status=${status}`;
    return await n8n('GET', path);
  }
  if (tool === 'n8n_get_execution') {
    return await n8n('GET', `/executions/${args.execution_id}?includeData=${args.include_data || false}`);
  }
  if (tool === 'n8n_delete_execution') {
    return await n8n('DELETE', `/executions/${args.execution_id}`);
  }
  if (tool === 'n8n_execute_workflow') {
    const { workflow_id, payload } = args;
    if (!workflow_id) throw new Error('workflow_id is required');
    return await n8n('POST', `/workflows/${workflow_id}/run`, payload || {});
  }
  if (tool === 'n8n_stop_execution') {
    return await n8n('POST', `/executions/${args.execution_id}/stop`);
  }
  if (tool === 'n8n_retry_execution') {
    return await n8n('POST', `/executions/${args.execution_id}/retry`, { loadWorkflow: args.load_workflow !== false });
  }
  if (tool === 'n8n_delete_executions_bulk') {
    // Delete executions by status, workflow, or before a date
    const { status, workflow_id, before_date } = args;
    const body = {};
    if (status) body.executionStatus = status;
    if (workflow_id) body.workflowId = workflow_id;
    if (before_date) body.deleteBefore = before_date;
    return await n8n('DELETE', '/executions', body);
  }

  // ── CREDENTIALS ───────────────────────────────────────────────────────────
  if (tool === 'n8n_list_credentials') {
    const { limit = 50 } = args;
    return await n8n('GET', `/credentials?limit=${limit}`);
  }
  if (tool === 'n8n_get_credential') {
    return await n8n('GET', `/credentials/${args.credential_id}`);
  }
  if (tool === 'n8n_create_credential') {
    const { name, type, data } = args;
    if (!name || !type) throw new Error('name and type are required');
    return await n8n('POST', '/credentials', { name, type, data: data || {} });
  }
  if (tool === 'n8n_update_credential') {
    const { credential_id, name, data } = args;
    const body = {};
    if (name) body.name = name;
    if (data) body.data = data;
    return await n8n('PATCH', `/credentials/${credential_id}`, body);
  }
  if (tool === 'n8n_delete_credential') {
    return await n8n('DELETE', `/credentials/${args.credential_id}`);
  }
  if (tool === 'n8n_get_credential_schema') {
    return await n8n('GET', `/credential-types/${args.credential_type_name}/schema`);
  }

  // ── VARIABLES ─────────────────────────────────────────────────────────────
  if (tool === 'n8n_list_variables') {
    return await n8n('GET', '/variables');
  }
  if (tool === 'n8n_create_variable') {
    if (!args.key || args.value === undefined) throw new Error('key and value are required');
    return await n8n('POST', '/variables', { key: args.key, value: String(args.value) });
  }
  if (tool === 'n8n_delete_variable') {
    return await n8n('DELETE', `/variables/${args.variable_id}`);
  }

  // ── TAGS ──────────────────────────────────────────────────────────────────
  if (tool === 'n8n_list_tags') {
    return await n8n('GET', `/tags?limit=${args.limit || 50}`);
  }
  if (tool === 'n8n_create_tag') {
    if (!args.name) throw new Error('name is required');
    return await n8n('POST', '/tags', { name: args.name });
  }
  if (tool === 'n8n_update_tag') {
    return await n8n('PATCH', `/tags/${args.tag_id}`, { name: args.name });
  }
  if (tool === 'n8n_delete_tag') {
    return await n8n('DELETE', `/tags/${args.tag_id}`);
  }
  if (tool === 'n8n_get_tag') {
    return await n8n('GET', `/tags/${args.tag_id}`);
  }

  // ── USERS ─────────────────────────────────────────────────────────────────
  if (tool === 'n8n_list_users') {
    return await n8n('GET', `/users?limit=${args.limit || 50}`);
  }
  if (tool === 'n8n_get_user') {
    return await n8n('GET', `/users/${args.user_id}`);
  }
  if (tool === 'n8n_create_users') {
    // Invite users by email
    const { emails, role = 'member' } = args;
    if (!emails?.length) throw new Error('emails array is required');
    return await n8n('POST', '/users', emails.map(email => ({ email, role })));
  }
  if (tool === 'n8n_delete_user') {
    return await n8n('DELETE', `/users/${args.user_id}`);
  }
  if (tool === 'n8n_change_user_role') {
    return await n8n('PATCH', `/users/${args.user_id}/role`, { newRoleName: args.role });
  }

  // ── PROJECTS ──────────────────────────────────────────────────────────────
  if (tool === 'n8n_list_projects') {
    return await n8n('GET', `/projects?limit=${args.limit || 50}`);
  }
  if (tool === 'n8n_create_project') {
    return await n8n('POST', '/projects', { name: args.name });
  }
  if (tool === 'n8n_delete_project') {
    return await n8n('DELETE', `/projects/${args.project_id}`);
  }
  if (tool === 'n8n_update_project') {
    return await n8n('PUT', `/projects/${args.project_id}`, { name: args.name });
  }

  // ── AUDIT LOG ─────────────────────────────────────────────────────────────
  if (tool === 'n8n_generate_audit') {
    return await n8n('POST', '/audit', { additionalOptions: args.options || {} });
  }

  // ── SOURCE CONTROL ────────────────────────────────────────────────────────
  if (tool === 'n8n_pull_from_source_control') {
    return await n8n('POST', '/source-control/pull', { force: args.force || false });
  }
  if (tool === 'n8n_push_to_source_control') {
    return await n8n('POST', '/source-control/push', { message: args.message || 'Update from n8n' });
  }

  // ── INSTANCE / HEALTH ─────────────────────────────────────────────────────
  if (tool === 'n8n_get_instance_info') {
    return await n8n('GET', '/');
  }
  if (tool === 'n8n_health_check') {
    try {
      const data = await n8n('GET', '/');
      return { healthy: true, version: data.n8nVersion, instance_id: data.instanceId };
    } catch (e) { return { healthy: false, error: e.message }; }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SUPER TOOLS
  // ══════════════════════════════════════════════════════════════════════════

  // SUPER: Bulk activate or deactivate all workflows matching a tag or name pattern
  if (tool === 'n8n_bulk_set_workflow_active') {
    const { tag, name_contains, active } = args;
    if (active === undefined) throw new Error('active (true/false) is required');
    const allWorkflows = await n8n('GET', `/workflows?limit=100${tag ? '&tags='+encodeURIComponent(tag) : ''}`);
    const workflows = (allWorkflows.data || []).filter(w => !name_contains || w.name.toLowerCase().includes(name_contains.toLowerCase()));
    const results = [];
    for (const w of workflows) {
      const endpoint = active ? 'activate' : 'deactivate';
      const result = await n8n('PATCH', `/workflows/${w.id}/${endpoint}`).catch(e => ({ error: e.message }));
      results.push({ id: w.id, name: w.name, success: !result.error });
    }
    return { total: workflows.length, succeeded: results.filter(r => r.success).length, results };
  }

  // SUPER: Full workflow dashboard — counts by status, recent failures, active workflows
  if (tool === 'n8n_workflow_dashboard') {
    const [workflows, failedExecs, users, tags] = await Promise.all([
      n8n('GET', '/workflows?limit=100'),
      n8n('GET', '/executions?limit=10&status=error'),
      n8n('GET', '/users?limit=10').catch(() => ({ data: [] })),
      n8n('GET', '/tags?limit=50').catch(() => ({ data: [] }))
    ]);
    const all = workflows.data || [];
    return {
      workflows: { total: all.length, active: all.filter(w => w.active).length, inactive: all.filter(w => !w.active).length },
      recent_failures: (failedExecs.data || []).map(e => ({ id: e.id, workflow_id: e.workflowId, started: e.startedAt, finished: e.stoppedAt })),
      users: (users.data || []).length,
      tags: (tags.data || []).map(t => t.name),
      checked_at: new Date().toISOString()
    };
  }

  throw new Error(`Unknown n8n tool: ${tool}`);
}

export default { execute };
