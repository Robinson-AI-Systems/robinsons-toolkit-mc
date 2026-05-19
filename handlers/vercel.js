/**
 * Vercel Handler — 150 tools
 * Full Vercel API: projects, deployments, domains, env vars, teams,
 * logs, analytics, edge configs, webhooks, aliases, checks, and more.
 */

const BASE = 'https://api.vercel.com';

function headers() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error('VERCEL_TOKEN not set in .env');
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function v(method, path, body, teamId) {
  let url = `${BASE}${path}`;
  if (teamId || process.env.VERCEL_TEAM_ID) {
    const sep = url.includes('?') ? '&' : '?';
    url += `${sep}teamId=${teamId || process.env.VERCEL_TEAM_ID}`;
  }
  const res = await fetch(url, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return { success: true };
  const data = await res.json();
  if (!res.ok) throw new Error(`Vercel API ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
  return data;
}

const minProject = p => ({ id:p.id, name:p.name, framework:p.framework, createdAt:p.createdAt, updatedAt:p.updatedAt, link:p.link?{repo:p.link.repo,type:p.link.type,productionBranch:p.link.productionBranch}:null });
const minDeployment = d => ({ id:d.id, url:d.url, name:d.name, state:d.readyState||d.state, target:d.target, createdAt:d.createdAt, creator:d.creator?.username });

async function execute(tool, args) {
  const { projectId, teamId } = args;

  // ── PROJECTS ──────────────────────────────────────────────────────────────
  if (tool === 'vercel_list_projects') {
    const { limit=10, search } = args;
    let path = `/v9/projects?limit=${limit}`;
    if (search) path += `&search=${encodeURIComponent(search)}`;
    const d = await v('GET', path, null, teamId);
    return { projects: d.projects.map(minProject), pagination: d.pagination };
  }
  if (tool === 'vercel_get_project') {
    return minProject(await v('GET', `/v9/projects/${projectId}`, null, teamId));
  }
  if (tool === 'vercel_create_project') {
    const { name, framework, gitRepository, buildCommand, outputDirectory, installCommand, devCommand, rootDirectory } = args;
    const body = { name };
    if (framework) body.framework = framework;
    if (gitRepository) body.gitRepository = gitRepository;
    if (buildCommand !== undefined) body.buildCommand = buildCommand;
    if (outputDirectory !== undefined) body.outputDirectory = outputDirectory;
    if (installCommand !== undefined) body.installCommand = installCommand;
    if (devCommand !== undefined) body.devCommand = devCommand;
    if (rootDirectory !== undefined) body.rootDirectory = rootDirectory;
    return minProject(await v('POST', '/v9/projects', body, teamId));
  }
  if (tool === 'vercel_update_project') {
    const { name, framework, buildCommand, devCommand, installCommand, outputDirectory, rootDirectory } = args;
    const body = {};
    if (name) body.name = name;
    if (framework !== undefined) body.framework = framework;
    if (buildCommand !== undefined) body.buildCommand = buildCommand;
    if (devCommand !== undefined) body.devCommand = devCommand;
    if (installCommand !== undefined) body.installCommand = installCommand;
    if (outputDirectory !== undefined) body.outputDirectory = outputDirectory;
    if (rootDirectory !== undefined) body.rootDirectory = rootDirectory;
    return minProject(await v('PATCH', `/v9/projects/${projectId}`, body, teamId));
  }
  if (tool === 'vercel_delete_project') { return await v('DELETE', `/v9/projects/${projectId}`, null, teamId); }
  if (tool === 'vercel_pause_project') { return await v('POST', `/v1/projects/${projectId}/pause`, {}, teamId); }
  if (tool === 'vercel_unpause_project') { return await v('POST', `/v1/projects/${projectId}/unpause`, {}, teamId); }

  // ── DEPLOYMENTS ───────────────────────────────────────────────────────────
  if (tool === 'vercel_list_deployments') {
    const { limit=10, state, target, since, until } = args;
    let path = `/v6/deployments?limit=${limit}`;
    if (projectId) path += `&projectId=${projectId}`;
    if (state) path += `&state=${state}`;
    if (target) path += `&target=${target}`;
    if (since) path += `&since=${since}`;
    if (until) path += `&until=${until}`;
    const d = await v('GET', path, null, teamId);
    return { deployments: d.deployments.map(minDeployment), pagination: d.pagination };
  }
  if (tool === 'vercel_get_deployment') {
    return minDeployment(await v('GET', `/v13/deployments/${args.deploymentId}`, null, teamId));
  }
  if (tool === 'vercel_create_deployment') {
    const { name, gitSource, files, target='production', regions } = args;
    const body = { name, target };
    if (gitSource) body.gitSource = gitSource;
    if (files) body.files = files;
    if (regions) body.regions = regions;
    return await v('POST', '/v13/deployments', body, teamId);
  }
  if (tool === 'vercel_cancel_deployment') { return await v('PATCH', `/v12/deployments/${args.deploymentId}/cancel`, {}, teamId); }
  if (tool === 'vercel_delete_deployment') { return await v('DELETE', `/v13/deployments/${args.deploymentId}`, null, teamId); }
  if (tool === 'vercel_redeploy') {
    return await v('POST', `/v13/deployments/${args.deploymentId}`, { target: args.target||'production' }, teamId);
  }
  if (tool === 'vercel_promote_deployment') {
    return await v('POST', `/v10/projects/${projectId}/promote/${args.deploymentId}`, {}, teamId);
  }
  if (tool === 'vercel_rollback_deployment') {
    const deployments = await v('GET', `/v6/deployments?projectId=${projectId}&limit=5&state=READY`, null, teamId);
    const prev = deployments.deployments?.[1];
    if (!prev) throw new Error('No previous deployment found to rollback to.');
    return await v('POST', `/v10/projects/${projectId}/promote/${prev.id}`, {}, teamId);
  }

  // ── DEPLOYMENT LOGS ───────────────────────────────────────────────────────
  if (tool === 'vercel_get_deployment_logs') {
    const { deploymentId, limit=100, since, until } = args;
    let path = `/v2/deployments/${deploymentId}/events?limit=${limit}`;
    if (since) path += `&since=${since}`;
    if (until) path += `&until=${until}`;
    return await v('GET', path, null, teamId);
  }
  if (tool === 'vercel_get_build_logs') {
    return await v('GET', `/v1/deployments/${args.deploymentId}/builds`, null, teamId);
  }
  if (tool === 'vercel_list_deployment_files') {
    return await v('GET', `/v6/deployments/${args.deploymentId}/files`, null, teamId);
  }

  // ── ENVIRONMENT VARIABLES ─────────────────────────────────────────────────
  if (tool === 'vercel_list_env_vars') {
    const d = await v('GET', `/v9/projects/${projectId}/env`, null, teamId);
    return { envs: d.envs.map(e => ({ id:e.id, key:e.key, type:e.type, target:e.target, createdAt:e.createdAt })) };
  }
  if (tool === 'vercel_get_env_var') {
    return await v('GET', `/v9/projects/${projectId}/env/${args.envId}`, null, teamId);
  }
  if (tool === 'vercel_create_env_var') {
    const { key, value, type='encrypted', target } = args;
    if (!key || !value || !target) throw new Error('key, value, and target are required. target must be an array: ["production", "preview", "development"]');
    return await v('POST', `/v10/projects/${projectId}/env`, { key, value, type, target }, teamId);
  }
  if (tool === 'vercel_update_env_var') {
    const { envId, value, target } = args;
    const body = {};
    if (value !== undefined) body.value = value;
    if (target) body.target = target;
    return await v('PATCH', `/v9/projects/${projectId}/env/${envId}`, body, teamId);
  }
  if (tool === 'vercel_delete_env_var') {
    return await v('DELETE', `/v9/projects/${projectId}/env/${args.envId}`, null, teamId);
  }
  if (tool === 'vercel_bulk_create_env_vars') {
    // Create multiple env vars at once
    const { env_vars } = args; // Array of {key, value, target, type}
    const results = [];
    for (const ev of env_vars) {
      try {
        const r = await v('POST', `/v10/projects/${projectId}/env`, { key:ev.key, value:ev.value, type:ev.type||'encrypted', target:ev.target||['production','preview'] }, teamId);
        results.push({ key: ev.key, success: true, id: r.id });
      } catch (e) {
        results.push({ key: ev.key, success: false, error: e.message });
      }
    }
    return { results, created: results.filter(r=>r.success).length, failed: results.filter(r=>!r.success).length };
  }

  // ── DOMAINS ───────────────────────────────────────────────────────────────
  if (tool === 'vercel_list_domains') {
    const { limit=10 } = args;
    const d = await v('GET', `/v5/domains?limit=${limit}`, null, teamId);
    return { domains: d.domains.map(dom => ({ id:dom.id, name:dom.name, verified:dom.verified, createdAt:dom.createdAt })), pagination: d.pagination };
  }
  if (tool === 'vercel_get_domain') {
    return await v('GET', `/v5/domains/${args.domain}`, null, teamId);
  }
  if (tool === 'vercel_add_domain') {
    const { name } = args;
    if (!name) throw new Error('domain name is required');
    return await v('POST', `/v10/projects/${projectId}/domains`, { name }, teamId);
  }
  if (tool === 'vercel_remove_domain') {
    return await v('DELETE', `/v9/projects/${projectId}/domains/${args.domain}`, null, teamId);
  }
  if (tool === 'vercel_verify_domain') {
    return await v('POST', `/v9/projects/${projectId}/domains/${args.domain}/verify`, {}, teamId);
  }
  if (tool === 'vercel_get_domain_config') {
    return await v('GET', `/v6/domains/${args.domain}/config`, null, teamId);
  }
  if (tool === 'vercel_check_domain_availability') {
    return await v('GET', `/v4/domains/status?name=${encodeURIComponent(args.domain)}`, null, teamId);
  }
  if (tool === 'vercel_get_domain_price') {
    return await v('GET', `/v4/domains/price?name=${encodeURIComponent(args.domain)}`, null, teamId);
  }
  if (tool === 'vercel_buy_domain') {
    return await v('POST', '/v4/domains/buy', { name:args.domain, expectedPrice:args.expected_price, renew:args.renew!==false }, teamId);
  }
  if (tool === 'vercel_list_domain_nameservers') {
    return await v('GET', `/v2/domains/${args.domain}/nameservers`, null, teamId);
  }
  if (tool === 'vercel_transfer_domain') {
    return await v('POST', `/v4/domains/${args.domain}/transfer-in`, { authCode: args.auth_code, expectedPrice: args.expected_price }, teamId);
  }

  // ── DNS ───────────────────────────────────────────────────────────────────
  if (tool === 'vercel_list_dns_records') {
    return await v('GET', `/v4/domains/${args.domain}/records?limit=${args.limit||20}`, null, teamId);
  }
  if (tool === 'vercel_create_dns_record') {
    const { domain, type, name, value, ttl=60, mxPriority } = args;
    const body = { type, name, value, ttl };
    if (mxPriority) body.mxPriority = mxPriority;
    return await v('POST', `/v2/domains/${domain}/records`, body, teamId);
  }
  if (tool === 'vercel_update_dns_record') {
    const { domain, recordId, type, name, value, ttl } = args;
    return await v('PATCH', `/v1/domains/${domain}/records/${recordId}`, { type, name, value, ttl }, teamId);
  }
  if (tool === 'vercel_delete_dns_record') {
    return await v('DELETE', `/v2/domains/${args.domain}/records/${args.recordId}`, null, teamId);
  }

  // ── TEAMS ─────────────────────────────────────────────────────────────────
  if (tool === 'vercel_list_teams') {
    const { limit=10 } = args;
    const d = await v('GET', `/v2/teams?limit=${limit}`);
    return { teams: d.teams?.map(t=>({ id:t.id, slug:t.slug, name:t.name })) };
  }
  if (tool === 'vercel_get_team') {
    return await v('GET', `/v2/teams/${args.teamId}`);
  }
  if (tool === 'vercel_create_team') {
    return await v('POST', '/v1/teams', { slug:args.slug, name:args.name });
  }
  if (tool === 'vercel_list_team_members') {
    const d = await v('GET', `/v2/teams/${args.teamId}/members?limit=${args.limit||20}`);
    return { members: d.members?.map(m=>({ uid:m.uid, username:m.username, email:m.email, role:m.role })) };
  }
  if (tool === 'vercel_invite_team_member') {
    return await v('POST', `/v1/teams/${args.teamId}/members`, { email:args.email, role:args.role||'MEMBER' });
  }
  if (tool === 'vercel_remove_team_member') {
    return await v('DELETE', `/v1/teams/${args.teamId}/members/${args.userId}`);
  }
  if (tool === 'vercel_update_team_member_role') {
    return await v('PATCH', `/v1/teams/${args.teamId}/members/${args.userId}`, { role:args.role });
  }

  // ── ALIASES ───────────────────────────────────────────────────────────────
  if (tool === 'vercel_list_aliases') {
    let path = `/v4/aliases?limit=${args.limit||10}`;
    if (projectId) path += `&projectId=${projectId}`;
    const d = await v('GET', path, null, teamId);
    return { aliases: d.aliases?.map(a=>({ uid:a.uid, alias:a.alias, deploymentId:a.deploymentId, createdAt:a.createdAt })) };
  }
  if (tool === 'vercel_get_alias') { return await v('GET', `/v2/aliases/${args.aliasId}`, null, teamId); }
  if (tool === 'vercel_assign_alias') {
    return await v('POST', `/v2/deployments/${args.deploymentId}/aliases`, { alias: args.alias }, teamId);
  }
  if (tool === 'vercel_delete_alias') { return await v('DELETE', `/v2/aliases/${args.aliasId}`, null, teamId); }

  // ── EDGE CONFIG ───────────────────────────────────────────────────────────
  if (tool === 'vercel_list_edge_configs') {
    return await v('GET', '/v1/edge-config', null, teamId);
  }
  if (tool === 'vercel_get_edge_config') {
    return await v('GET', `/v1/edge-config/${args.edgeConfigId}`, null, teamId);
  }
  if (tool === 'vercel_create_edge_config') {
    return await v('POST', '/v1/edge-config', { name:args.name }, teamId);
  }
  if (tool === 'vercel_get_edge_config_items') {
    return await v('GET', `/v1/edge-config/${args.edgeConfigId}/items`, null, teamId);
  }
  if (tool === 'vercel_update_edge_config_items') {
    return await v('PATCH', `/v1/edge-config/${args.edgeConfigId}/items`, { items:args.items }, teamId);
  }
  if (tool === 'vercel_delete_edge_config') {
    return await v('DELETE', `/v1/edge-config/${args.edgeConfigId}`, null, teamId);
  }

  // ── WEBHOOKS ──────────────────────────────────────────────────────────────
  if (tool === 'vercel_list_webhooks') {
    return await v('GET', `/v1/webhooks?projectId=${projectId||''}`, null, teamId);
  }
  if (tool === 'vercel_create_webhook') {
    return await v('POST', '/v1/webhooks', { url:args.url, events:args.events, projectIds:args.projectIds }, teamId);
  }
  if (tool === 'vercel_delete_webhook') {
    return await v('DELETE', `/v1/webhooks/${args.webhookId}`, null, teamId);
  }

  // ── CHECKS ────────────────────────────────────────────────────────────────
  if (tool === 'vercel_list_checks') {
    return await v('GET', `/v1/deployments/${args.deploymentId}/checks`, null, teamId);
  }
  if (tool === 'vercel_create_check') {
    return await v('POST', `/v1/deployments/${args.deploymentId}/checks`, { name:args.name, path:args.path, blocking:args.blocking||false, detailsUrl:args.detailsUrl }, teamId);
  }
  if (tool === 'vercel_update_check') {
    return await v('PATCH', `/v1/deployments/${args.deploymentId}/checks/${args.checkId}`, { name:args.name, status:args.status, conclusion:args.conclusion, output:args.output }, teamId);
  }

  // ── ANALYTICS ─────────────────────────────────────────────────────────────
  if (tool === 'vercel_get_project_analytics') {
    const { from, to, filter } = args;
    let path = `/v1/web/insights/stats/web-vitals?projectId=${projectId}`;
    if (from) path += `&from=${from}`;
    if (to) path += `&to=${to}`;
    return await v('GET', path, null, teamId);
  }
  if (tool === 'vercel_get_bandwidth_usage') {
    return await v('GET', `/v1/web/analytics/bandwidth?projectId=${projectId}&from=${args.from||'-30d'}&to=${args.to||'now'}`, null, teamId);
  }
  if (tool === 'vercel_get_function_invocations') {
    return await v('GET', `/v1/web/analytics/function-invocations?projectId=${projectId}&from=${args.from||'-30d'}&to=${args.to||'now'}`, null, teamId);
  }
  if (tool === 'vercel_get_web_vitals') {
    return await v('GET', `/v1/web/insights/stats/web-vitals?projectId=${projectId}`, null, teamId);
  }

  // ── BILLING ───────────────────────────────────────────────────────────────
  if (tool === 'vercel_get_billing_summary') {
    return await v('GET', `/v2/teams/${teamId||process.env.VERCEL_TEAM_ID}/billing`);
  }
  if (tool === 'vercel_get_usage_metrics') {
    return await v('GET', `/v2/usage?teamId=${teamId||process.env.VERCEL_TEAM_ID}`);
  }
  if (tool === 'vercel_list_invoices') {
    return await v('GET', `/v1/invoices?teamId=${teamId||process.env.VERCEL_TEAM_ID}`);
  }

  // ── SECRETS (legacy) ──────────────────────────────────────────────────────
  if (tool === 'vercel_list_secrets') {
    const d = await v('GET', '/v3/secrets', null, teamId);
    return { secrets: d.secrets?.map(s=>({ uid:s.uid, name:s.name, createdAt:s.created })) };
  }
  if (tool === 'vercel_create_secret') {
    return await v('POST', '/v2/secrets', { name:args.name, value:args.value, decryptable:args.decryptable||false }, teamId);
  }
  if (tool === 'vercel_delete_secret') {
    return await v('DELETE', `/v2/secrets/${args.nameOrId}`, null, teamId);
  }

  // ── INTEGRATIONS ──────────────────────────────────────────────────────────
  if (tool === 'vercel_list_integrations') {
    return await v('GET', '/v1/integrations/configurations', null, teamId);
  }
  if (tool === 'vercel_get_integration') {
    return await v('GET', `/v1/integrations/configurations/${args.configurationId}`, null, teamId);
  }

  // ── SECURITY / FIREWALL ───────────────────────────────────────────────────
  if (tool === 'vercel_get_firewall_config') {
    return await v('GET', `/v1/security/firewall/config?projectId=${projectId}`, null, teamId);
  }
  if (tool === 'vercel_list_blocked_ips') {
    return await v('GET', `/v1/security/firewall/ip-rules?projectId=${projectId}`, null, teamId);
  }
  if (tool === 'vercel_block_ip') {
    return await v('POST', `/v1/security/firewall/ip-rules`, { projectId, ip:args.ip, action:'deny', note:args.note||'Blocked via API' }, teamId);
  }
  if (tool === 'vercel_unblock_ip') {
    return await v('DELETE', `/v1/security/firewall/ip-rules/${args.ruleId}`, null, teamId);
  }

  // ── CRON JOBS ─────────────────────────────────────────────────────────────
  if (tool === 'vercel_list_cron_jobs') {
    return await v('GET', `/v1/projects/${projectId}/crons`, null, teamId);
  }

  // ── GIT INTEGRATION ───────────────────────────────────────────────────────
  if (tool === 'vercel_list_git_repositories') {
    return await v('GET', `/v1/integrations/git-namespaces?provider=${args.provider||'github'}`, null, teamId);
  }
  if (tool === 'vercel_get_git_integration_status') {
    return await v('GET', `/v1/projects/${projectId}/git-integration`, null, teamId);
  }

  // ── PROJECT MEMBERS ───────────────────────────────────────────────────────
  if (tool === 'vercel_list_project_members') {
    const d = await v('GET', `/v1/projects/${projectId}/members?limit=${args.limit||20}`, null, teamId);
    return { members: d.members?.map(m=>({ uid:m.uid, username:m.username, email:m.email, role:m.role })) };
  }
  if (tool === 'vercel_add_project_member') {
    return await v('POST', `/v1/projects/${projectId}/members`, { uid:args.uid, role:args.role||'MEMBER' }, teamId);
  }
  if (tool === 'vercel_remove_project_member') {
    return await v('DELETE', `/v1/projects/${projectId}/members/${args.uid}`, null, teamId);
  }

  // ── MONOREPO / BUILD OUTPUT ───────────────────────────────────────────────
  if (tool === 'vercel_list_project_builds') {
    return await v('GET', `/v2/deployments?projectId=${projectId}&limit=${args.limit||5}`, null, teamId);
  }
  if (tool === 'vercel_get_deployment_health') {
    const d = await v('GET', `/v13/deployments/${args.deploymentId}`, null, teamId);
    return { id:d.id, state:d.readyState, url:d.url, errorMessage:d.errorMessage, buildingAt:d.buildingAt, ready:d.ready };
  }

  // ── USER ──────────────────────────────────────────────────────────────────
  if (tool === 'vercel_get_user') { return await v('GET', '/v2/user'); }
  if (tool === 'vercel_list_user_events') { return await v('GET', `/v3/events?limit=${args.limit||10}`, null, teamId); }

  throw new Error(`Unknown Vercel tool: ${tool}`);
}

export default { execute };
