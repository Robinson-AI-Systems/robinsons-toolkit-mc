/**
 * Vercel Handler — 120 tools
 * Full Vercel API: projects, deployments, domains, env vars, teams,
 * logs, analytics, edge configs, webhooks, aliases, checks, log drains,
 * deploy hooks, edge config tokens/schema, deployment protection,
 * speed insights, OIDC, and more.
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

const minProject = p => ({
  id: p.id, name: p.name, framework: p.framework,
  createdAt: p.createdAt, updatedAt: p.updatedAt,
  link: p.link ? { repo: p.link.repo, type: p.link.type, productionBranch: p.link.productionBranch } : null
});
const minDeployment = d => ({
  id: d.id, url: d.url, name: d.name,
  state: d.readyState || d.state, target: d.target,
  createdAt: d.createdAt, creator: d.creator?.username
});

async function execute(tool, args) {
  const { projectId, teamId } = args;

  // ── PROJECTS ──────────────────────────────────────────────────────────────
  if (tool === 'vercel_list_projects') {
    const { limit = 10, search } = args;
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

  // Get full project settings (all fields, not minified)
  if (tool === 'vercel_get_project_summary') {
    const project = await v('GET', `/v9/projects/${projectId}`, null, teamId);
    const deployments = await v('GET', `/v6/deployments?projectId=${projectId}&limit=1&target=production`, null, teamId);
    const envs = await v('GET', `/v9/projects/${projectId}/env`, null, teamId);
    const domains = await v('GET', `/v9/projects/${projectId}/domains?limit=5`, null, teamId);
    return {
      project: minProject(project),
      latestProduction: deployments.deployments?.[0] ? minDeployment(deployments.deployments[0]) : null,
      envVarCount: envs.envs?.length || 0,
      domains: domains.domains?.map(d => ({ name: d.name, verified: d.verified })) || []
    };
  }

  // ── DEPLOYMENTS ───────────────────────────────────────────────────────────
  if (tool === 'vercel_list_deployments') {
    const { limit = 10, state, target, since, until } = args;
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
    const { name, gitSource, files, target = 'production', regions } = args;
    const body = { name, target };
    if (gitSource) body.gitSource = gitSource;
    if (files) body.files = files;
    if (regions) body.regions = regions;
    return await v('POST', '/v13/deployments', body, teamId);
  }
  if (tool === 'vercel_cancel_deployment') { return await v('PATCH', `/v12/deployments/${args.deploymentId}/cancel`, {}, teamId); }
  if (tool === 'vercel_delete_deployment') { return await v('DELETE', `/v13/deployments/${args.deploymentId}`, null, teamId); }
  if (tool === 'vercel_redeploy') {
    return await v('POST', `/v13/deployments/${args.deploymentId}`, { target: args.target || 'production' }, teamId);
  }
  if (tool === 'vercel_promote_deployment') {
    return await v('POST', `/v10/projects/${projectId}/promote/${args.deploymentId}`, {}, teamId);
  }
  if (tool === 'vercel_rollback_deployment') {
    // If explicit deploymentId given, roll back to that. Otherwise find previous prod deployment.
    if (args.deploymentId) {
      return await v('POST', `/v10/projects/${projectId}/promote/${args.deploymentId}`, {}, teamId);
    }
    const deployments = await v('GET', `/v6/deployments?projectId=${projectId}&limit=5&state=READY&target=production`, null, teamId);
    const prev = deployments.deployments?.[1];
    if (!prev) throw new Error('No previous production deployment found to roll back to.');
    return await v('POST', `/v10/projects/${projectId}/promote/${prev.id}`, {}, teamId);
  }

  // NEW: Get latest production deployment for a project
  if (tool === 'vercel_get_latest_deployment') {
    const target = args.target || 'production';
    const d = await v('GET', `/v6/deployments?projectId=${projectId}&limit=1&target=${target}&state=READY`, null, teamId);
    if (!d.deployments?.[0]) throw new Error(`No READY ${target} deployment found for project ${projectId}`);
    return minDeployment(d.deployments[0]);
  }

  // NEW: Find a deployment by its URL (e.g. my-app-abc123.vercel.app)
  if (tool === 'vercel_find_deployment_by_url') {
    const { url } = args;
    if (!url) throw new Error('url is required');
    const d = await v('GET', `/v6/deployments?url=${encodeURIComponent(url)}&limit=5`, null, teamId);
    return { deployments: d.deployments?.map(minDeployment) || [] };
  }

  // NEW: List deployments that were triggered by a specific commit SHA
  if (tool === 'vercel_list_deployments_for_commit') {
    const { sha } = args;
    if (!sha) throw new Error('sha (git commit SHA) is required');
    let path = `/v6/deployments?meta-githubCommitSha=${sha}&limit=10`;
    if (projectId) path += `&projectId=${projectId}`;
    const d = await v('GET', path, null, teamId);
    return { deployments: d.deployments?.map(minDeployment) || [] };
  }

  // NEW: Poll a deployment until it reaches a terminal state (READY or ERROR)
  if (tool === 'vercel_wait_for_deployment') {
    const { deploymentId, timeoutSeconds = 300, pollIntervalSeconds = 5 } = args;
    if (!deploymentId) throw new Error('deploymentId is required');
    const terminalStates = new Set(['READY', 'ERROR', 'CANCELED']);
    const start = Date.now();
    let last = null;
    while (Date.now() - start < timeoutSeconds * 1000) {
      const d = await v('GET', `/v13/deployments/${deploymentId}`, null, teamId);
      const state = d.readyState || d.state;
      last = { id: d.id, url: d.url, state, errorMessage: d.errorMessage };
      if (terminalStates.has(state)) return { ...last, elapsed: Math.round((Date.now() - start) / 1000) + 's' };
      await new Promise(r => setTimeout(r, pollIntervalSeconds * 1000));
    }
    throw new Error(`Deployment ${deploymentId} did not reach terminal state within ${timeoutSeconds}s. Last state: ${last?.state}`);
  }

  // NEW: Quick deployment status check
  if (tool === 'vercel_get_deployment_status') {
    const d = await v('GET', `/v13/deployments/${args.deploymentId}`, null, teamId);
    return {
      id: d.id, url: d.url, state: d.readyState || d.state,
      target: d.target, errorMessage: d.errorMessage,
      createdAt: d.createdAt, ready: d.ready, buildingAt: d.buildingAt
    };
  }

  // NEW: List recent project activity (all deployment events)
  if (tool === 'vercel_list_project_activity') {
    const { limit = 20 } = args;
    const d = await v('GET', `/v6/deployments?projectId=${projectId}&limit=${limit}`, null, teamId);
    return {
      activity: d.deployments?.map(dep => ({
        id: dep.id, url: dep.url, state: dep.readyState || dep.state,
        target: dep.target, createdAt: dep.createdAt, creator: dep.creator?.username
      })) || []
    };
  }

  // ── DEPLOYMENT LOGS ───────────────────────────────────────────────────────
  if (tool === 'vercel_get_deployment_logs') {
    const { deploymentId, limit = 100, since, until } = args;
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

  // NEW: Get runtime logs for a specific serverless function in a deployment
  if (tool === 'vercel_get_runtime_logs') {
    const { deploymentId, name, limit = 50 } = args;
    let path = `/v2/deployments/${deploymentId}/events?limit=${limit}&builds=0`;
    if (name) path += `&name=${encodeURIComponent(name)}`;
    return await v('GET', path, null, teamId);
  }

  // ── LOG DRAINS (NEW) ──────────────────────────────────────────────────────
  // Log drains stream your Vercel logs to external services (Datadog, Papertrail, etc.)

  if (tool === 'vercel_list_log_drains') {
    const d = await v('GET', '/v2/log-drains', null, teamId);
    return { logDrains: d.map ? d.map(ld => ({ id: ld.id, name: ld.name, url: ld.url, sources: ld.sources, createdAt: ld.createdAt })) : d };
  }
  if (tool === 'vercel_create_log_drain') {
    const { name, url, sources, projectIds, secret, headers: customHeaders } = args;
    if (!url) throw new Error('url is required — the endpoint that will receive log events');
    const body = { name, url, sources: sources || ['lambda', 'static', 'edge', 'build', 'deployment'] };
    if (projectIds) body.projectIds = projectIds;
    if (secret) body.secret = secret;
    if (customHeaders) body.headers = customHeaders;
    return await v('POST', '/v2/log-drains', body, teamId);
  }
  if (tool === 'vercel_delete_log_drain') {
    if (!args.logDrainId) throw new Error('logDrainId is required');
    return await v('DELETE', `/v1/log-drains/${args.logDrainId}`, null, teamId);
  }

  // ── DEPLOYMENT HOOKS (NEW) ────────────────────────────────────────────────
  // Deploy hooks create webhook URLs that trigger a new deployment when called

  if (tool === 'vercel_list_deployment_hooks') {
    if (!projectId) throw new Error('projectId is required');
    return await v('GET', `/v1/projects/${projectId}/deploy-hooks`, null, teamId);
  }
  if (tool === 'vercel_create_deployment_hook') {
    const { name, ref } = args;
    if (!projectId) throw new Error('projectId is required');
    if (!name) throw new Error('name is required — a label for this hook (e.g. "trigger-from-cms")');
    return await v('POST', `/v1/projects/${projectId}/deploy-hooks`, { name, ref: ref || 'main' }, teamId);
  }
  if (tool === 'vercel_delete_deployment_hook') {
    if (!projectId) throw new Error('projectId is required');
    if (!args.hookId) throw new Error('hookId is required');
    return await v('DELETE', `/v1/projects/${projectId}/deploy-hooks/${args.hookId}`, null, teamId);
  }

  // ── EDGE CONFIG TOKENS (NEW) ──────────────────────────────────────────────
  // Edge Config tokens allow reading Edge Config from outside Vercel (e.g. in your app code)

  if (tool === 'vercel_list_edge_config_tokens') {
    if (!args.edgeConfigId) throw new Error('edgeConfigId is required');
    return await v('GET', `/v1/edge-config/${args.edgeConfigId}/tokens`, null, teamId);
  }
  if (tool === 'vercel_create_edge_config_token') {
    const { edgeConfigId, label } = args;
    if (!edgeConfigId) throw new Error('edgeConfigId is required');
    if (!label) throw new Error('label is required — a descriptive name for this token');
    return await v('POST', `/v1/edge-config/${edgeConfigId}/token`, { label }, teamId);
  }
  if (tool === 'vercel_delete_edge_config_token') {
    const { edgeConfigId, token } = args;
    if (!edgeConfigId || !token) throw new Error('edgeConfigId and token are required');
    return await v('DELETE', `/v1/edge-config/${edgeConfigId}/tokens/${token}`, null, teamId);
  }

  // ── EDGE CONFIG SCHEMA (NEW) ──────────────────────────────────────────────
  // Attach a JSON Schema to your Edge Config to validate items before they are saved

  if (tool === 'vercel_get_edge_config_schema') {
    if (!args.edgeConfigId) throw new Error('edgeConfigId is required');
    return await v('GET', `/v1/edge-config/${args.edgeConfigId}/schema`, null, teamId);
  }
  if (tool === 'vercel_update_edge_config_schema') {
    const { edgeConfigId, schema } = args;
    if (!edgeConfigId) throw new Error('edgeConfigId is required');
    if (!schema) throw new Error('schema is required — a JSON Schema object');
    return await v('PATCH', `/v1/edge-config/${edgeConfigId}/schema`, schema, teamId);
  }

  // ── ENVIRONMENT VARIABLES ─────────────────────────────────────────────────
  if (tool === 'vercel_list_env_vars') {
    const d = await v('GET', `/v9/projects/${projectId}/env`, null, teamId);
    return { envs: d.envs.map(e => ({ id: e.id, key: e.key, type: e.type, target: e.target, createdAt: e.createdAt })) };
  }
  if (tool === 'vercel_get_env_var') {
    return await v('GET', `/v9/projects/${projectId}/env/${args.envId}`, null, teamId);
  }

  // NEW: Decrypt and return the actual value of an env var
  if (tool === 'vercel_get_env_var_value') {
    const { envId } = args;
    if (!envId) throw new Error('envId is required');
    const d = await v('GET', `/v1/projects/${projectId}/env/${envId}?decrypt=true`, null, teamId);
    return { key: d.key, value: d.value, type: d.type, target: d.target };
  }

  if (tool === 'vercel_create_env_var') {
    const { key, value, type = 'encrypted', target } = args;
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
    const { env_vars } = args;
    const results = [];
    for (const ev of env_vars) {
      try {
        const r = await v('POST', `/v10/projects/${projectId}/env`, {
          key: ev.key, value: ev.value,
          type: ev.type || 'encrypted',
          target: ev.target || ['production', 'preview']
        }, teamId);
        results.push({ key: ev.key, success: true, id: r.id });
      } catch (e) {
        results.push({ key: ev.key, success: false, error: e.message });
      }
    }
    return { results, created: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length };
  }

  // NEW: Copy an existing env var to a different set of targets (e.g. from preview to production)
  if (tool === 'vercel_copy_env_var') {
    const { envId, targetEnvironments } = args;
    if (!envId) throw new Error('envId is required');
    if (!targetEnvironments?.length) throw new Error('targetEnvironments array is required e.g. ["production"]');
    // Fetch the original (decrypted) and re-create for new targets
    const original = await v('GET', `/v1/projects/${projectId}/env/${envId}?decrypt=true`, null, teamId);
    return await v('POST', `/v10/projects/${projectId}/env`, {
      key: original.key, value: original.value,
      type: original.type || 'encrypted', target: targetEnvironments
    }, teamId);
  }

  // ── DOMAINS ───────────────────────────────────────────────────────────────
  if (tool === 'vercel_list_domains') {
    const { limit = 10 } = args;
    const d = await v('GET', `/v5/domains?limit=${limit}`, null, teamId);
    return { domains: d.domains.map(dom => ({ id: dom.id, name: dom.name, verified: dom.verified, createdAt: dom.createdAt })), pagination: d.pagination };
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
    return await v('POST', '/v4/domains/buy', { name: args.domain, expectedPrice: args.expected_price, renew: args.renew !== false }, teamId);
  }
  if (tool === 'vercel_list_domain_nameservers') {
    return await v('GET', `/v2/domains/${args.domain}/nameservers`, null, teamId);
  }
  if (tool === 'vercel_transfer_domain') {
    return await v('POST', `/v4/domains/${args.domain}/transfer-in`, { authCode: args.auth_code, expectedPrice: args.expected_price }, teamId);
  }

  // NEW: Get details for one specific project domain (different from account-level domain)
  if (tool === 'vercel_get_project_domain') {
    if (!projectId) throw new Error('projectId is required');
    if (!args.domain) throw new Error('domain is required');
    return await v('GET', `/v9/projects/${projectId}/domains/${args.domain}`, null, teamId);
  }

  // NEW: Update a project domain (redirect, git branch binding, etc.)
  if (tool === 'vercel_update_project_domain') {
    const { domain, redirect, redirectStatusCode, gitBranch } = args;
    if (!projectId) throw new Error('projectId is required');
    if (!domain) throw new Error('domain is required');
    const body = {};
    if (redirect !== undefined) body.redirect = redirect;
    if (redirectStatusCode) body.redirectStatusCode = redirectStatusCode;
    if (gitBranch) body.gitBranch = gitBranch;
    return await v('PATCH', `/v9/projects/${projectId}/domains/${domain}`, body, teamId);
  }

  // ── DNS ───────────────────────────────────────────────────────────────────
  if (tool === 'vercel_list_dns_records') {
    return await v('GET', `/v4/domains/${args.domain}/records?limit=${args.limit || 20}`, null, teamId);
  }
  if (tool === 'vercel_create_dns_record') {
    const { domain, type, name, value, ttl = 60, mxPriority } = args;
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
    const { limit = 10 } = args;
    const d = await v('GET', `/v2/teams?limit=${limit}`);
    return { teams: d.teams?.map(t => ({ id: t.id, slug: t.slug, name: t.name })) };
  }
  if (tool === 'vercel_get_team') {
    return await v('GET', `/v2/teams/${args.teamId}`);
  }
  if (tool === 'vercel_create_team') {
    return await v('POST', '/v1/teams', { slug: args.slug, name: args.name });
  }
  if (tool === 'vercel_list_team_members') {
    const d = await v('GET', `/v2/teams/${args.teamId}/members?limit=${args.limit || 20}`);
    return { members: d.members?.map(m => ({ uid: m.uid, username: m.username, email: m.email, role: m.role })) };
  }
  if (tool === 'vercel_invite_team_member') {
    return await v('POST', `/v1/teams/${args.teamId}/members`, { email: args.email, role: args.role || 'MEMBER' });
  }
  if (tool === 'vercel_remove_team_member') {
    return await v('DELETE', `/v1/teams/${args.teamId}/members/${args.userId}`);
  }
  if (tool === 'vercel_update_team_member_role') {
    return await v('PATCH', `/v1/teams/${args.teamId}/members/${args.userId}`, { role: args.role });
  }

  // NEW: Get full team configuration
  if (tool === 'vercel_get_team_config') {
    const tid = args.teamId || process.env.VERCEL_TEAM_ID;
    if (!tid) throw new Error('teamId is required (or set VERCEL_TEAM_ID in .env)');
    return await v('GET', `/v2/teams/${tid}`);
  }

  // NEW: Update team settings (name, slug, description, etc.)
  if (tool === 'vercel_update_team_config') {
    const { name, slug, description, avatar, emailDomain, samlConfig } = args;
    const tid = args.teamId || process.env.VERCEL_TEAM_ID;
    if (!tid) throw new Error('teamId is required (or set VERCEL_TEAM_ID in .env)');
    const body = {};
    if (name) body.name = name;
    if (slug) body.slug = slug;
    if (description) body.description = description;
    if (avatar) body.avatar = avatar;
    if (emailDomain !== undefined) body.emailDomain = emailDomain;
    if (samlConfig) body.samlConfig = samlConfig;
    return await v('PATCH', `/v2/teams/${tid}`, body);
  }

  // ── ALIASES ───────────────────────────────────────────────────────────────
  if (tool === 'vercel_list_aliases') {
    let path = `/v4/aliases?limit=${args.limit || 10}`;
    if (projectId) path += `&projectId=${projectId}`;
    const d = await v('GET', path, null, teamId);
    return { aliases: d.aliases?.map(a => ({ uid: a.uid, alias: a.alias, deploymentId: a.deploymentId, createdAt: a.createdAt })) };
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
    return await v('POST', '/v1/edge-config', { name: args.name }, teamId);
  }
  if (tool === 'vercel_get_edge_config_items') {
    return await v('GET', `/v1/edge-config/${args.edgeConfigId}/items`, null, teamId);
  }
  if (tool === 'vercel_update_edge_config_items') {
    return await v('PATCH', `/v1/edge-config/${args.edgeConfigId}/items`, { items: args.items }, teamId);
  }
  if (tool === 'vercel_delete_edge_config') {
    return await v('DELETE', `/v1/edge-config/${args.edgeConfigId}`, null, teamId);
  }

  // ── WEBHOOKS ──────────────────────────────────────────────────────────────
  if (tool === 'vercel_list_webhooks') {
    return await v('GET', `/v1/webhooks?projectId=${projectId || ''}`, null, teamId);
  }
  if (tool === 'vercel_create_webhook') {
    return await v('POST', '/v1/webhooks', { url: args.url, events: args.events, projectIds: args.projectIds }, teamId);
  }
  if (tool === 'vercel_delete_webhook') {
    return await v('DELETE', `/v1/webhooks/${args.webhookId}`, null, teamId);
  }

  // ── CHECKS ────────────────────────────────────────────────────────────────
  if (tool === 'vercel_list_checks') {
    return await v('GET', `/v1/deployments/${args.deploymentId}/checks`, null, teamId);
  }
  if (tool === 'vercel_create_check') {
    return await v('POST', `/v1/deployments/${args.deploymentId}/checks`, {
      name: args.name, path: args.path,
      blocking: args.blocking || false, detailsUrl: args.detailsUrl
    }, teamId);
  }
  if (tool === 'vercel_update_check') {
    return await v('PATCH', `/v1/deployments/${args.deploymentId}/checks/${args.checkId}`, {
      name: args.name, status: args.status,
      conclusion: args.conclusion, output: args.output
    }, teamId);
  }

  // ── DEPLOYMENT PROTECTION (NEW) ───────────────────────────────────────────
  // Control password protection and trusted IPs for preview deployments

  if (tool === 'vercel_get_project_protection') {
    if (!projectId) throw new Error('projectId is required');
    const d = await v('GET', `/v9/projects/${projectId}`, null, teamId);
    return {
      ssoProtection: d.ssoProtection,
      passwordProtection: d.passwordProtection,
      trustedIps: d.trustedIps,
      deploymentProtection: d.deploymentProtection
    };
  }

  if (tool === 'vercel_update_project_protection') {
    // Toggle password protection, trusted IPs, and deployment protection mode
    const { passwordProtection, trustedIps, deploymentProtection } = args;
    if (!projectId) throw new Error('projectId is required');
    const body = {};
    if (passwordProtection !== undefined) body.passwordProtection = passwordProtection;
    if (trustedIps !== undefined) body.trustedIps = trustedIps;
    if (deploymentProtection !== undefined) body.deploymentProtection = deploymentProtection;
    return minProject(await v('PATCH', `/v9/projects/${projectId}`, body, teamId));
  }

  if (tool === 'vercel_list_protection_bypasses') {
    // List automation bypass secrets for deployment protection
    if (!projectId) throw new Error('projectId is required');
    const d = await v('GET', `/v9/projects/${projectId}`, null, teamId);
    return { protectionBypass: d.protectionBypass || {} };
  }

  // ── ANALYTICS ─────────────────────────────────────────────────────────────
  if (tool === 'vercel_get_project_analytics') {
    const { from, to } = args;
    let path = `/v1/web/insights/stats/web-vitals?projectId=${projectId}`;
    if (from) path += `&from=${from}`;
    if (to) path += `&to=${to}`;
    return await v('GET', path, null, teamId);
  }
  if (tool === 'vercel_get_bandwidth_usage') {
    return await v('GET', `/v1/web/analytics/bandwidth?projectId=${projectId}&from=${args.from || '-30d'}&to=${args.to || 'now'}`, null, teamId);
  }
  if (tool === 'vercel_get_function_invocations') {
    return await v('GET', `/v1/web/analytics/function-invocations?projectId=${projectId}&from=${args.from || '-30d'}&to=${args.to || 'now'}`, null, teamId);
  }
  if (tool === 'vercel_get_web_vitals') {
    return await v('GET', `/v1/web/insights/stats/web-vitals?projectId=${projectId}`, null, teamId);
  }

  // NEW: Get Speed Insights scores and performance data
  if (tool === 'vercel_get_speed_insights') {
    const { from, to, path: urlPath } = args;
    if (!projectId) throw new Error('projectId is required');
    let apiPath = `/v1/web/insights/stats/performance?projectId=${projectId}`;
    if (from) apiPath += `&from=${from}`;
    if (to) apiPath += `&to=${to}`;
    if (urlPath) apiPath += `&path=${encodeURIComponent(urlPath)}`;
    return await v('GET', apiPath, null, teamId);
  }

  // NEW: Get top pages by traffic and web vitals
  if (tool === 'vercel_get_top_pages') {
    if (!projectId) throw new Error('projectId is required');
    const { limit = 20, from, to } = args;
    let apiPath = `/v1/web/insights/stats/top-pages?projectId=${projectId}&limit=${limit}`;
    if (from) apiPath += `&from=${from}`;
    if (to) apiPath += `&to=${to}`;
    return await v('GET', apiPath, null, teamId);
  }

  // ── BILLING ───────────────────────────────────────────────────────────────
  if (tool === 'vercel_get_billing_summary') {
    const tid = teamId || process.env.VERCEL_TEAM_ID;
    if (!tid) throw new Error('teamId is required (or set VERCEL_TEAM_ID in .env)');
    return await v('GET', `/v2/teams/${tid}/billing`);
  }
  if (tool === 'vercel_get_usage_metrics') {
    const tid = teamId || process.env.VERCEL_TEAM_ID;
    return await v('GET', `/v2/usage?teamId=${tid}`);
  }
  if (tool === 'vercel_list_invoices') {
    const tid = teamId || process.env.VERCEL_TEAM_ID;
    return await v('GET', `/v1/invoices?teamId=${tid}`);
  }

  // ── SECRETS (legacy) ──────────────────────────────────────────────────────
  if (tool === 'vercel_list_secrets') {
    const d = await v('GET', '/v3/secrets', null, teamId);
    return { secrets: d.secrets?.map(s => ({ uid: s.uid, name: s.name, createdAt: s.created })) };
  }
  if (tool === 'vercel_create_secret') {
    return await v('POST', '/v2/secrets', { name: args.name, value: args.value, decryptable: args.decryptable || false }, teamId);
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
    return await v('POST', '/v1/security/firewall/ip-rules', { projectId, ip: args.ip, action: 'deny', note: args.note || 'Blocked via API' }, teamId);
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
    return await v('GET', `/v1/integrations/git-namespaces?provider=${args.provider || 'github'}`, null, teamId);
  }
  if (tool === 'vercel_get_git_integration_status') {
    return await v('GET', `/v1/projects/${projectId}/git-integration`, null, teamId);
  }

  // ── PROJECT MEMBERS ───────────────────────────────────────────────────────
  if (tool === 'vercel_list_project_members') {
    const d = await v('GET', `/v1/projects/${projectId}/members?limit=${args.limit || 20}`, null, teamId);
    return { members: d.members?.map(m => ({ uid: m.uid, username: m.username, email: m.email, role: m.role })) };
  }
  if (tool === 'vercel_add_project_member') {
    return await v('POST', `/v1/projects/${projectId}/members`, { uid: args.uid, role: args.role || 'MEMBER' }, teamId);
  }
  if (tool === 'vercel_remove_project_member') {
    return await v('DELETE', `/v1/projects/${projectId}/members/${args.uid}`, null, teamId);
  }

  // ── BUILDS ────────────────────────────────────────────────────────────────
  if (tool === 'vercel_list_project_builds') {
    return await v('GET', `/v2/deployments?projectId=${projectId}&limit=${args.limit || 5}`, null, teamId);
  }
  if (tool === 'vercel_get_deployment_health') {
    const d = await v('GET', `/v13/deployments/${args.deploymentId}`, null, teamId);
    return { id: d.id, state: d.readyState, url: d.url, errorMessage: d.errorMessage, buildingAt: d.buildingAt, ready: d.ready };
  }

  // ── ACCESS GROUPS (NEW — Enterprise) ─────────────────────────────────────
  if (tool === 'vercel_list_access_groups') {
    const tid = teamId || process.env.VERCEL_TEAM_ID;
    if (!tid) throw new Error('teamId is required (or set VERCEL_TEAM_ID in .env)');
    return await v('GET', `/v1/access-groups?teamId=${tid}`);
  }
  if (tool === 'vercel_get_access_group') {
    if (!args.accessGroupId) throw new Error('accessGroupId is required');
    return await v('GET', `/v1/access-groups/${args.accessGroupId}`, null, teamId);
  }

  // ── OIDC TOKEN (NEW) ──────────────────────────────────────────────────────
  // Generate an OIDC token for use in CI/CD pipelines (e.g. GitHub Actions)
  if (tool === 'vercel_get_oidc_token') {
    const body = {};
    if (args.audience) body.aud = args.audience;
    return await v('POST', '/v1/oidc/token', body, teamId);
  }

  // ── USER ──────────────────────────────────────────────────────────────────
  if (tool === 'vercel_get_user') { return await v('GET', '/v2/user'); }
  if (tool === 'vercel_list_user_events') { return await v('GET', `/v3/events?limit=${args.limit || 10}`, null, teamId); }


  // ── STORAGE — KV (Vercel KV / serverless Redis) ───────────────────────────
  if (tool === 'vercel_list_kv_stores') {
    const tid = teamId || process.env.VERCEL_TEAM_ID;
    const path = tid ? `/v1/storage/kv/namespaces?teamId=${tid}` : '/v1/storage/kv/namespaces';
    return await v('GET', path);
  }
  if (tool === 'vercel_get_kv_store') {
    if (!args.namespaceId) throw new Error('namespaceId is required');
    const tid = teamId || process.env.VERCEL_TEAM_ID;
    const path = `/v1/storage/kv/namespaces/${args.namespaceId}${tid ? `?teamId=${tid}` : ''}`;
    return await v('GET', path);
  }

  // ── WAF / ATTACK CHALLENGE MODE ───────────────────────────────────────────
  if (tool === 'vercel_get_attack_challenge_mode') {
    if (!projectId) throw new Error('projectId is required');
    return await v('GET', `/v1/security/firewall/attack-challenge?projectId=${projectId}`, null, teamId);
  }
  if (tool === 'vercel_update_attack_challenge_mode') {
    if (!projectId) throw new Error('projectId is required');
    const { action } = args; // 'auto' | 'forced_challenge' | 'redirect' | 'off'
    if (!action) throw new Error('action is required: auto | forced_challenge | redirect | off');
    return await v('PATCH', '/v1/security/firewall/attack-challenge', { projectId, action }, teamId);
  }

  // ── SKEW PROTECTION ───────────────────────────────────────────────────────
  // Skew protection prevents users from running mismatched JS/HTML after a deploy
  if (tool === 'vercel_get_skew_protection') {
    if (!projectId) throw new Error('projectId is required');
    const d = await v('GET', `/v9/projects/${projectId}`, null, teamId);
    return {
      skewProtection: d.skewProtection || null,
      id: d.id, name: d.name
    };
  }
  if (tool === 'vercel_update_skew_protection') {
    if (!projectId) throw new Error('projectId is required');
    const { enabled, maxAge } = args;
    const body = { skewProtection: enabled === false ? null : { maxAge: maxAge || 86400 } };
    return minProject(await v('PATCH', `/v9/projects/${projectId}`, body, teamId));
  }

  // ── TEAM ACCESS REQUESTS ──────────────────────────────────────────────────
  if (tool === 'vercel_get_team_access_requests') {
    const tid = args.teamId || process.env.VERCEL_TEAM_ID;
    if (!tid) throw new Error('teamId is required (or set VERCEL_TEAM_ID in .env)');
    return await v('GET', `/v1/teams/${tid}/join-requests`);
  }

  // ── USER NOTIFICATIONS ────────────────────────────────────────────────────
  if (tool === 'vercel_get_notification_settings') {
    return await v('GET', '/v2/user/notification-settings');
  }
  if (tool === 'vercel_update_notification_settings') {
    const { deploymentFailed, deploymentReady, deploymentCanceled, emailDeploymentFailed } = args;
    const body = {};
    if (deploymentFailed !== undefined) body.deploymentFailed = deploymentFailed;
    if (deploymentReady !== undefined) body.deploymentReady = deploymentReady;
    if (deploymentCanceled !== undefined) body.deploymentCanceled = deploymentCanceled;
    if (emailDeploymentFailed !== undefined) body.emailDeploymentFailed = emailDeploymentFailed;
    return await v('PATCH', '/v2/user/notification-settings', body);
  }

  // ── GIT REPOSITORY LINKING ────────────────────────────────────────────────
  if (tool === 'vercel_link_git_repository') {
    const { type, repo, repoId, org, gitCredentialId } = args;
    if (!projectId) throw new Error('projectId is required');
    if (!type || !repo) throw new Error('type (github|gitlab|bitbucket) and repo (owner/name) are required');
    const body = { type, repo };
    if (repoId) body.repoId = repoId;
    if (org) body.org = org;
    if (gitCredentialId) body.gitCredentialId = gitCredentialId;
    return await v('POST', `/v1/projects/${projectId}/link`, body, teamId);
  }
  if (tool === 'vercel_unlink_git_repository') {
    if (!projectId) throw new Error('projectId is required');
    return await v('DELETE', `/v1/projects/${projectId}/link`, null, teamId);
  }

  // ── ENV VAR UTILITIES ─────────────────────────────────────────────────────
  if (tool === 'vercel_get_project_env_by_key') {
    const { key } = args;
    if (!projectId || !key) throw new Error('projectId and key are required');
    const d = await v('GET', `/v9/projects/${projectId}/env`, null, teamId);
    const found = d.envs?.filter(e => e.key === key);
    if (!found?.length) throw new Error(`No env var found with key "${key}" in project ${projectId}`);
    return { envs: found };
  }
  if (tool === 'vercel_bulk_delete_env_vars') {
    const { envIds } = args;
    if (!projectId || !envIds?.length) throw new Error('projectId and envIds array are required');
    const results = [];
    for (const envId of envIds) {
      try {
        await v('DELETE', `/v9/projects/${projectId}/env/${envId}`, null, teamId);
        results.push({ envId, success: true });
      } catch (e) {
        results.push({ envId, success: false, error: e.message });
      }
    }
    return { results, deleted: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length };
  }

  // ── BILLING PLAN ──────────────────────────────────────────────────────────
  if (tool === 'vercel_get_team_billing_plan') {
    const tid = teamId || process.env.VERCEL_TEAM_ID;
    if (!tid) throw new Error('teamId is required (or set VERCEL_TEAM_ID in .env)');
    const [team, billing] = await Promise.all([
      v('GET', `/v2/teams/${tid}`),
      v('GET', `/v2/teams/${tid}/billing`)
    ]);
    return {
      plan: team.billing?.plan || team.plan,
      concurrentBuilds: billing?.concurrentBuilds,
      bandwidthLimit: billing?.bandwidthLimit,
      functionDuration: billing?.functionDuration,
      teamMembers: billing?.teamMembers,
      period: billing?.period
    };
  }

  // ── PAGE VIEWS ────────────────────────────────────────────────────────────
  if (tool === 'vercel_list_page_views') {
    if (!projectId) throw new Error('projectId is required');
    const { from, to } = args;
    let path = `/v1/web/analytics/stats/page-views?projectId=${projectId}`;
    if (from) path += `&from=${from}`;
    if (to) path += `&to=${to}`;
    return await v('GET', path, null, teamId);
  }

  // ── PROJECT GIT INFO ──────────────────────────────────────────────────────
  if (tool === 'vercel_get_project_git_info') {
    if (!projectId) throw new Error('projectId is required');
    // Get latest deployment and extract git metadata
    const d = await v('GET', `/v6/deployments?projectId=${projectId}&limit=1&state=READY`, null, teamId);
    const latest = d.deployments?.[0];
    if (!latest) return { gitInfo: null, message: 'No READY deployment found' };
    const detail = await v('GET', `/v13/deployments/${latest.id}`, null, teamId);
    return {
      deploymentId: detail.id,
      url: detail.url,
      branch: detail.meta?.githubCommitRef || detail.meta?.gitlabCommitRef || detail.meta?.bitbucketCommitRef || null,
      commit: detail.meta?.githubCommitSha || detail.meta?.gitlabCommitSha || detail.meta?.bitbucketCommitSha || null,
      commitMessage: detail.meta?.githubCommitMessage || detail.meta?.gitlabCommitMessage || detail.meta?.bitbucketCommitMessage || null,
      author: detail.meta?.githubCommitAuthorName || detail.meta?.gitlabCommitAuthorName || detail.meta?.bitbucketCommitAuthorName || null,
      repo: detail.meta?.githubRepo || detail.meta?.gitlabRepo || detail.meta?.bitbucketRepo || null
    };
  }

  // ── DEPLOYMENT REGIONS ────────────────────────────────────────────────────
  if (tool === 'vercel_list_deployment_regions') {
    if (!args.deploymentId) throw new Error('deploymentId is required');
    const d = await v('GET', `/v13/deployments/${args.deploymentId}`, null, teamId);
    return { regions: d.regions || [], deploymentId: d.id, url: d.url };
  }

  // ── PROTECTION BYPASS SECRETS ─────────────────────────────────────────────
  if (tool === 'vercel_add_protection_bypass') {
    if (!projectId) throw new Error('projectId is required');
    const { secret, description } = args;
    if (!secret) throw new Error('secret is required — the bypass token value');
    return await v('POST', `/v9/projects/${projectId}/protection-bypass`, { secret, description }, teamId);
  }
  if (tool === 'vercel_delete_protection_bypass') {
    if (!projectId) throw new Error('projectId is required');
    if (!args.secret) throw new Error('secret is required');
    return await v('DELETE', `/v9/projects/${projectId}/protection-bypass/${args.secret}`, null, teamId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SUPER TOOLS — Multi-step Vercel workflows in a single command
  // ══════════════════════════════════════════════════════════════════════════

  // SUPER: Create a deployment and block until it's READY or ERROR
  if (tool === 'vercel_deploy_and_wait') {
    const { name, gitSource, files, target = 'production', timeoutSeconds = 300 } = args;
    if (!name) throw new Error('name is required — the Vercel project name');

    // 1. Trigger the deployment
    const body = { name, target };
    if (gitSource) body.gitSource = gitSource;
    if (files) body.files = files;
    const deployment = await v('POST', '/v13/deployments', body, teamId);
    const deploymentId = deployment.id;

    // 2. Poll until terminal state
    const terminalStates = new Set(['READY', 'ERROR', 'CANCELED']);
    const start = Date.now();
    let last = null;
    while (Date.now() - start < timeoutSeconds * 1000) {
      const d = await v('GET', `/v13/deployments/${deploymentId}`, null, teamId);
      const state = d.readyState || d.state;
      last = { id: d.id, url: d.url, state, errorMessage: d.errorMessage, target: d.target };
      if (terminalStates.has(state)) {
        return { ...last, elapsed: Math.round((Date.now() - start) / 1000) + 's', success: state === 'READY' };
      }
      await new Promise(r => setTimeout(r, 5000));
    }
    throw new Error(`Deployment ${deploymentId} did not reach terminal state within ${timeoutSeconds}s. Last state: ${last?.state}`);
  }

  // SUPER: Promote a preview deployment to production, then verify health
  if (tool === 'vercel_safe_promote_to_production') {
    const { deploymentId, timeoutSeconds = 180 } = args;
    if (!projectId) throw new Error('projectId is required');
    if (!deploymentId) throw new Error('deploymentId is required — the preview deployment to promote');

    // 1. Get current production state (for rollback reference)
    const currentProd = await v('GET', `/v6/deployments?projectId=${projectId}&limit=1&state=READY&target=production`, null, teamId);
    const previousProdId = currentProd.deployments?.[0]?.id;

    // 2. Promote
    await v('POST', `/v10/projects/${projectId}/promote/${deploymentId}`, {}, teamId);

    // 3. Wait for the promoted deployment to settle
    await new Promise(r => setTimeout(r, 3000));

    // 4. Health check — confirm the promoted deployment is still READY
    const health = await v('GET', `/v13/deployments/${deploymentId}`, null, teamId);
    const state = health.readyState || health.state;

    return {
      promoted: true,
      deploymentId,
      url: health.url,
      state,
      healthy: state === 'READY',
      previousProductionId: previousProdId || null,
      rollbackCommand: previousProdId
        ? `execute_tool("vercel_rollback_deployment", { projectId: "${projectId}", deploymentId: "${previousProdId}" })`
        : null
    };
  }

  // SUPER: Copy all environment variables from one project to another
  if (tool === 'vercel_copy_project_env_vars') {
    const { sourceProjectId, destinationProjectId, targets, overwrite = false } = args;
    if (!sourceProjectId || !destinationProjectId) throw new Error('sourceProjectId and destinationProjectId are required');

    // 1. List source env vars
    const sourceEnvs = await v('GET', `/v9/projects/${sourceProjectId}/env`, null, teamId);
    const destEnvs = await v('GET', `/v9/projects/${destinationProjectId}/env`, null, teamId);
    const destKeys = new Set(destEnvs.envs?.map(e => `${e.key}:${e.target?.join(',')}`) || []);

    const results = [];
    for (const env of (sourceEnvs.envs || [])) {
      const targetList = targets || env.target;
      const conflictKey = `${env.key}:${targetList?.join(',')}`;
      if (!overwrite && destKeys.has(conflictKey)) {
        results.push({ key: env.key, skipped: true, reason: 'already exists' });
        continue;
      }
      try {
        // Decrypt the value
        const decrypted = await v('GET', `/v1/projects/${sourceProjectId}/env/${env.id}?decrypt=true`, null, teamId);
        await v('POST', `/v10/projects/${destinationProjectId}/env`, {
          key: env.key, value: decrypted.value, type: env.type || 'encrypted', target: targetList
        }, teamId);
        results.push({ key: env.key, success: true });
      } catch (e) {
        results.push({ key: env.key, success: false, error: e.message });
      }
    }
    return {
      sourceProject: sourceProjectId, destinationProject: destinationProjectId,
      copied: results.filter(r => r.success).length,
      skipped: results.filter(r => r.skipped).length,
      failed: results.filter(r => !r.success && !r.skipped).length,
      results
    };
  }

  // SUPER: Sync env vars between deployment targets within the same project
  if (tool === 'vercel_sync_env_between_targets') {
    const { fromTarget, toTarget } = args;
    if (!projectId) throw new Error('projectId is required');
    if (!fromTarget || !toTarget) throw new Error('fromTarget and toTarget are required (e.g. preview → production)');

    // Get all env vars in the source target
    const all = await v('GET', `/v9/projects/${projectId}/env`, null, teamId);
    const sourceEnvs = all.envs?.filter(e => Array.isArray(e.target) && e.target.includes(fromTarget)) || [];

    const results = [];
    for (const env of sourceEnvs) {
      try {
        const decrypted = await v('GET', `/v1/projects/${projectId}/env/${env.id}?decrypt=true`, null, teamId);
        // Check if this key already exists for the destination target
        const existing = all.envs?.find(e => e.key === env.key && Array.isArray(e.target) && e.target.includes(toTarget));
        if (existing) {
          await v('PATCH', `/v9/projects/${projectId}/env/${existing.id}`, { value: decrypted.value }, teamId);
          results.push({ key: env.key, action: 'updated' });
        } else {
          await v('POST', `/v10/projects/${projectId}/env`, {
            key: env.key, value: decrypted.value, type: env.type || 'encrypted', target: [toTarget]
          }, teamId);
          results.push({ key: env.key, action: 'created' });
        }
      } catch (e) {
        results.push({ key: env.key, action: 'failed', error: e.message });
      }
    }
    return {
      fromTarget, toTarget, projectId,
      synced: results.filter(r => r.action !== 'failed').length,
      failed: results.filter(r => r.action === 'failed').length,
      results
    };
  }

  // SUPER: Add a custom domain to a project, get DNS config, and attempt verification
  if (tool === 'vercel_setup_custom_domain') {
    const { domain } = args;
    if (!projectId || !domain) throw new Error('projectId and domain are required');

    // 1. Add the domain
    let addResult;
    try {
      addResult = await v('POST', `/v10/projects/${projectId}/domains`, { name: domain }, teamId);
    } catch (e) {
      if (!e.message.includes('already')) throw e;
      addResult = { name: domain, alreadyExists: true };
    }

    // 2. Get DNS config needed
    const config = await v('GET', `/v6/domains/${domain}/config`, null, teamId);

    // 3. Attempt verification
    let verification = null;
    try {
      verification = await v('POST', `/v9/projects/${projectId}/domains/${domain}/verify`, {}, teamId);
    } catch (e) {
      verification = { verified: false, error: e.message };
    }

    return {
      domain,
      added: !addResult.alreadyExists,
      verified: verification?.verified || false,
      dnsRecordsNeeded: config?.cnames?.map(c => ({ type: 'CNAME', name: domain, value: c })) ||
                        config?.aValues?.map(a => ({ type: 'A', name: '@', value: a })) || [],
      verificationRecords: config?.serviceType === 'external'
        ? [{ type: 'TXT', name: `_vercel.${domain}`, value: verification?.verification?.[0]?.value || 'check Vercel dashboard' }]
        : [],
      nextStep: verification?.verified
        ? 'Domain is verified and ready'
        : 'Configure the DNS records above in your registrar, then call vercel_verify_domain'
    };
  }

  // SUPER: Get a complete deployment report — status, build summary, checks, and file count
  if (tool === 'vercel_full_deployment_report') {
    const { deploymentId } = args;
    if (!deploymentId) throw new Error('deploymentId is required');

    const [detail, builds, checks, files] = await Promise.all([
      v('GET', `/v13/deployments/${deploymentId}`, null, teamId),
      v('GET', `/v1/deployments/${deploymentId}/builds`, null, teamId).catch(() => ({ builds: [] })),
      v('GET', `/v1/deployments/${deploymentId}/checks`, null, teamId).catch(() => ({ checks: [] })),
      v('GET', `/v6/deployments/${deploymentId}/files`, null, teamId).catch(() => [])
    ]);

    const state = detail.readyState || detail.state;
    const buildEntries = builds.builds || [];
    const checkEntries = checks.checks || [];

    return {
      id: detail.id,
      url: detail.url,
      state,
      target: detail.target,
      createdAt: detail.createdAt,
      ready: detail.ready,
      errorMessage: detail.errorMessage || null,
      git: {
        branch: detail.meta?.githubCommitRef || null,
        commit: detail.meta?.githubCommitSha?.slice(0, 8) || null,
        message: detail.meta?.githubCommitMessage || null,
        author: detail.meta?.githubCommitAuthorName || null
      },
      build: {
        entryCount: buildEntries.length,
        status: buildEntries[0]?.readyState || 'unknown',
        entrypoints: buildEntries.map(b => b.entrypoint).filter(Boolean).slice(0, 5)
      },
      checks: {
        total: checkEntries.length,
        passed: checkEntries.filter(c => c.conclusion === 'succeeded').length,
        failed: checkEntries.filter(c => c.conclusion === 'failed').length,
        pending: checkEntries.filter(c => !c.conclusion).length
      },
      outputFiles: Array.isArray(files) ? files.length : 0
    };
  }

  // SUPER: Update an env var value and immediately trigger a redeploy
  if (tool === 'vercel_rotate_env_and_redeploy') {
    const { key, newValue, target: envTarget = ['production'], timeoutSeconds = 300 } = args;
    if (!projectId || !key || !newValue) throw new Error('projectId, key, and newValue are required');

    // 1. Find the env var by key
    const allEnvs = await v('GET', `/v9/projects/${projectId}/env`, null, teamId);
    const matches = allEnvs.envs?.filter(e => e.key === key && e.target?.some(t => envTarget.includes(t)));
    if (!matches?.length) throw new Error(`No env var found with key "${key}" for targets ${envTarget.join(', ')}`);

    // 2. Update each matching env var
    for (const env of matches) {
      await v('PATCH', `/v9/projects/${projectId}/env/${env.id}`, { value: newValue }, teamId);
    }

    // 3. Get the latest production deployment to re-deploy from same git source
    const deployments = await v('GET', `/v6/deployments?projectId=${projectId}&limit=1&target=production&state=READY`, null, teamId);
    const latest = deployments.deployments?.[0];
    if (!latest) throw new Error('No previous READY production deployment found to redeploy from');

    // 4. Trigger a new deployment using the same git source
    const latestDetail = await v('GET', `/v13/deployments/${latest.id}`, null, teamId);
    const gitSource = latestDetail.meta?.githubCommitSha
      ? { type: 'github', ref: latestDetail.meta.githubCommitRef, sha: latestDetail.meta.githubCommitSha, repoId: latestDetail.gitSource?.repoId }
      : null;

    const newDeployBody = { name: latestDetail.name, target: 'production' };
    if (gitSource?.repoId) newDeployBody.gitSource = gitSource;

    const newDeploy = await v('POST', '/v13/deployments', newDeployBody, teamId);

    // 5. Wait for new deployment to be READY
    const terminalStates = new Set(['READY', 'ERROR', 'CANCELED']);
    const start = Date.now();
    let lastState = null;
    while (Date.now() - start < timeoutSeconds * 1000) {
      const d = await v('GET', `/v13/deployments/${newDeploy.id}`, null, teamId);
      lastState = d.readyState || d.state;
      if (terminalStates.has(lastState)) {
        return {
          envUpdated: key, newDeploymentId: d.id, url: d.url, state: lastState,
          success: lastState === 'READY',
          elapsed: Math.round((Date.now() - start) / 1000) + 's'
        };
      }
      await new Promise(r => setTimeout(r, 5000));
    }
    throw new Error(`Redeploy triggered but did not reach READY within ${timeoutSeconds}s. deploymentId: ${newDeploy.id}`);
  }

  // SUPER: Emergency rollback — promote the previous production deployment
  if (tool === 'vercel_emergency_rollback') {
    const { timeoutSeconds = 180 } = args;
    if (!projectId) throw new Error('projectId is required');

    // 1. Get last 3 READY production deployments
    const deployments = await v('GET', `/v6/deployments?projectId=${projectId}&limit=3&state=READY&target=production`, null, teamId);
    const list = deployments.deployments || [];
    if (list.length < 2) throw new Error('Cannot rollback: fewer than 2 READY production deployments found');

    const currentDeploy = list[0];
    const targetDeploy = list[1];

    // 2. Promote the previous deployment
    await v('POST', `/v10/projects/${projectId}/promote/${targetDeploy.id}`, {}, teamId);

    // 3. Brief wait then verify
    await new Promise(r => setTimeout(r, 3000));
    const verification = await v('GET', `/v13/deployments/${targetDeploy.id}`, null, teamId);

    return {
      rolledBack: true,
      from: { id: currentDeploy.id, url: currentDeploy.url, createdAt: currentDeploy.createdAt },
      to: { id: targetDeploy.id, url: targetDeploy.url, createdAt: targetDeploy.createdAt },
      currentState: verification.readyState || verification.state,
      success: (verification.readyState || verification.state) === 'READY'
    };
  }

  // SUPER: Comprehensive project config audit — surface issues before they become problems
  if (tool === 'vercel_audit_project_config') {
    if (!projectId) throw new Error('projectId is required');

    const [project, envs, domains, deployments] = await Promise.all([
      v('GET', `/v9/projects/${projectId}`, null, teamId),
      v('GET', `/v9/projects/${projectId}/env`, null, teamId),
      v('GET', `/v9/projects/${projectId}/domains?limit=20`, null, teamId),
      v('GET', `/v6/deployments?projectId=${projectId}&limit=3&target=production`, null, teamId)
    ]);

    const issues = [];
    const warnings = [];

    // Check domains
    const unverifiedDomains = domains.domains?.filter(d => !d.verified) || [];
    if (unverifiedDomains.length) {
      issues.push(`${unverifiedDomains.length} unverified domain(s): ${unverifiedDomains.map(d => d.name).join(', ')}`);
    }

    // Check latest deployment
    const latestDeploy = deployments.deployments?.[0];
    if (!latestDeploy) {
      warnings.push('No production deployments found');
    } else if (latestDeploy.readyState === 'ERROR') {
      issues.push(`Latest production deployment is in ERROR state (id: ${latestDeploy.id})`);
    }

    // Check env var coverage (look for envs missing production target)
    const allEnvKeys = envs.envs || [];
    const missingProd = allEnvKeys.filter(e => !e.target?.includes('production') && e.target?.length > 0);
    if (missingProd.length) {
      warnings.push(`${missingProd.length} env var(s) not set for production: ${missingProd.map(e => e.key).join(', ')}`);
    }

    // Check for framework
    if (!project.framework) {
      warnings.push('No framework detected — consider setting the framework in project settings');
    }

    // Check git link
    if (!project.link) {
      warnings.push('Project is not connected to a git repository');
    }

    return {
      projectId, projectName: project.name,
      framework: project.framework || null,
      gitConnected: !!project.link,
      latestDeployment: latestDeploy ? {
        id: latestDeploy.id, url: latestDeploy.url,
        state: latestDeploy.readyState || latestDeploy.state,
        createdAt: latestDeploy.createdAt
      } : null,
      domains: {
        total: domains.domains?.length || 0,
        verified: (domains.domains?.filter(d => d.verified) || []).length,
        unverified: unverifiedDomains.length
      },
      envVars: { total: allEnvKeys.length, missingProduction: missingProd.length },
      issues: issues.length ? issues : ['none'],
      warnings: warnings.length ? warnings : ['none'],
      healthStatus: issues.length > 0 ? 'issues' : warnings.length > 0 ? 'warnings' : 'healthy'
    };
  }


  // List all domains attached to a specific project (project-scoped, unlike vercel_list_domains which is account-scoped)
  if (tool === 'vercel_list_project_domains') {
    if (!projectId) throw new Error('projectId is required');
    const { limit = 50 } = args;
    const d = await v('GET', `/v9/projects/${projectId}/domains?limit=${limit}`, null, teamId);
    return { domains: d.domains?.map(dom => ({ name: dom.name, verified: dom.verified, redirect: dom.redirect, gitBranch: dom.gitBranch, createdAt: dom.createdAt })) || [], projectId };
  }

  throw new Error(`Unknown Vercel tool: ${tool}`);
}

export default { execute };
