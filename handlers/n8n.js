/**
 * n8n Handler — 14 tools
 * Workflow automation: list, activate, execute, and manage
 * n8n workflows and executions.
 */

function getConfig() {
  const url = process.env.N8N_BASE_URL;
  const key = process.env.N8N_API_KEY;
  if (!url || !key) throw new Error('N8N_BASE_URL and N8N_API_KEY must be set in .env');
  return { url: url.replace(/\/$/, ''), key };
}

async function n8n(method, path, body) {
  const { url, key } = getConfig();
  const res = await fetch(`${url}/api/v1${path}`, {
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
    const { limit = 20, cursor, active } = args;
    let path = `/workflows?limit=${limit}`;
    if (cursor) path += `&cursor=${cursor}`;
    if (active !== undefined) path += `&active=${active}`;
    return await n8n('GET', path);
  }
  if (tool === 'n8n_get_workflow') { return await n8n('GET', `/workflows/${args.workflow_id}`); }
  if (tool === 'n8n_activate_workflow') { return await n8n('PATCH', `/workflows/${args.workflow_id}`, { active: true }); }
  if (tool === 'n8n_deactivate_workflow') { return await n8n('PATCH', `/workflows/${args.workflow_id}`, { active: false }); }
  if (tool === 'n8n_delete_workflow') { return await n8n('DELETE', `/workflows/${args.workflow_id}`); }
  if (tool === 'n8n_create_workflow') {
    const { name, nodes = [], connections = {}, settings = {}, active = false } = args;
    if (!name) throw new Error('name is required');
    return await n8n('POST', '/workflows', { name, nodes, connections, settings, active });
  }
  if (tool === 'n8n_update_workflow') {
    const { workflow_id, name, nodes, connections, settings, active } = args;
    const body = {};
    if (name) body.name = name; if (nodes) body.nodes = nodes;
    if (connections) body.connections = connections; if (settings) body.settings = settings;
    if (active !== undefined) body.active = active;
    return await n8n('PUT', `/workflows/${args.workflow_id}`, body);
  }
  if (tool === 'n8n_get_workflow_tags') { return await n8n('GET', `/workflows/${args.workflow_id}/tags`); }

  // ── EXECUTIONS ────────────────────────────────────────────────────────────
  if (tool === 'n8n_list_executions') {
    const { workflow_id, status, limit = 20 } = args;
    let path = `/executions?limit=${limit}`;
    if (workflow_id) path += `&workflowId=${workflow_id}`;
    if (status) path += `&status=${status}`;
    const data = await n8n('GET', path);
    return { executions: data.data?.map(e => ({ id: e.id, workflowId: e.workflowId, status: e.status, startedAt: e.startedAt, stoppedAt: e.stoppedAt, finished: e.finished })) };
  }
  if (tool === 'n8n_get_execution') { return await n8n('GET', `/executions/${args.execution_id}`); }
  if (tool === 'n8n_delete_execution') { return await n8n('DELETE', `/executions/${args.execution_id}`); }
  if (tool === 'n8n_execute_workflow') {
    // Trigger a workflow via webhook or manual execution
    const { workflow_id, data: inputData } = args;
    return await n8n('POST', `/workflows/${workflow_id}/run`, { workflowData: {}, runData: inputData || {} });
  }

  // ── CREDENTIALS ───────────────────────────────────────────────────────────
  if (tool === 'n8n_list_credentials') {
    return await n8n('GET', `/credentials?limit=${args.limit || 20}`);
  }

  throw new Error(`Unknown n8n tool: ${tool}`);
}

export default { execute };
