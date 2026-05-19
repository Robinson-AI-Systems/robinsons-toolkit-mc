/**
 * Fly.io Handler — 35 tools (NEW - not in original toolkit)
 * Full Fly.io Machines API + Apps API for deploying containerized services.
 * Useful for YardSync background workers, scheduled jobs, and microservices.
 */

const MACHINES_BASE = 'https://api.machines.dev/v1';
const GRAPHQL_BASE = 'https://api.fly.io/graphql';

function headers() {
  const token = process.env.FLY_API_TOKEN;
  if (!token) throw new Error('FLY_API_TOKEN not set in .env. Get one from fly.io/user/personal_access_tokens');
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function fly(method, path, body) {
  const res = await fetch(`${MACHINES_BASE}${path}`, {
    method, headers: headers(),
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return { success: true };
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`Fly.io API ${res.status}: ${data.error || data.message || JSON.stringify(data)}`);
  return data;
}

async function flyGraphQL(query, variables) {
  const res = await fetch(GRAPHQL_BASE, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ query, variables })
  });
  const data = await res.json();
  if (data.errors) throw new Error(`Fly GraphQL: ${JSON.stringify(data.errors)}`);
  return data.data;
}

async function execute(tool, args) {
  const { app_name, machine_id } = args;

  // ── APPS ──────────────────────────────────────────────────────────────────
  if (tool === 'fly_list_apps') {
    const data = await flyGraphQL(`query { apps { nodes { id name status hostname currentRelease { version createdAt } } } }`);
    return data.apps.nodes;
  }
  if (tool === 'fly_get_app') {
    return await fly('GET', `/apps/${app_name}`);
  }
  if (tool === 'fly_create_app') {
    const { name, org_slug = 'personal', network } = args;
    return await fly('POST', '/apps', { app_name: name, org_slug, network });
  }
  if (tool === 'fly_delete_app') {
    return await fly('DELETE', `/apps/${app_name}`);
  }
  if (tool === 'fly_restart_app') {
    return await fly('POST', `/apps/${app_name}/restart`, {});
  }
  if (tool === 'fly_allocate_ip') {
    const { type = 'shared_v4', region } = args;
    return await flyGraphQL(
      `mutation($appId: ID!, $type: IPAddressType!, $region: String) { allocateIpAddress(input: { appId: $appId, type: $type, region: $region }) { ipAddress { id address type region } } }`,
      { appId: app_name, type: type.toUpperCase(), region }
    );
  }
  if (tool === 'fly_release_ip') {
    return await flyGraphQL(
      `mutation($ipAddressId: ID!) { releaseIpAddress(input: { ipAddressId: $ipAddressId }) { app { name } } }`,
      { ipAddressId: args.ip_id }
    );
  }
  if (tool === 'fly_list_ips') {
    const data = await flyGraphQL(`query($name: String!) { app(name: $name) { ipAddresses { nodes { id address type region createdAt } } } }`, { name: app_name });
    return data.app?.ipAddresses?.nodes || [];
  }

  // ── MACHINES ──────────────────────────────────────────────────────────────
  if (tool === 'fly_list_machines') {
    const { state, region } = args;
    let path = `/apps/${app_name}/machines`;
    const params = [];
    if (state) params.push(`state=${state}`);
    if (region) params.push(`region=${region}`);
    if (params.length) path += `?${params.join('&')}`;
    return await fly('GET', path);
  }
  if (tool === 'fly_get_machine') {
    return await fly('GET', `/apps/${app_name}/machines/${machine_id}`);
  }
  if (tool === 'fly_create_machine') {
    const { name, region = 'iad', image, env, services, mounts, size = 'shared-cpu-1x', memory_mb = 256, cmd, schedule } = args;
    if (!image) throw new Error('image is required (e.g. "flyio/hellofly:latest" or "ghcr.io/user/repo:tag")');
    const config = {
      image,
      env: env || {},
      services: services || [],
      mounts: mounts || [],
      guest: { cpu_kind: size.split('-')[0], cpus: 1, memory_mb }
    };
    if (cmd) config.init = { cmd };
    if (schedule) config.schedule = schedule;
    const body = { name, region, config };
    return await fly('POST', `/apps/${app_name}/machines`, body);
  }
  if (tool === 'fly_update_machine') {
    const { config } = args;
    return await fly('POST', `/apps/${app_name}/machines/${machine_id}`, { config });
  }
  if (tool === 'fly_start_machine') { return await fly('POST', `/apps/${app_name}/machines/${machine_id}/start`, {}); }
  if (tool === 'fly_stop_machine') {
    return await fly('POST', `/apps/${app_name}/machines/${machine_id}/stop`, { signal: args.signal || 'SIGTERM', timeout: args.timeout_seconds });
  }
  if (tool === 'fly_restart_machine') { return await fly('POST', `/apps/${app_name}/machines/${machine_id}/restart`, {}); }
  if (tool === 'fly_destroy_machine') {
    return await fly('DELETE', `/apps/${app_name}/machines/${machine_id}?force=${args.force || false}`);
  }
  if (tool === 'fly_exec_machine') {
    return await fly('POST', `/apps/${app_name}/machines/${machine_id}/exec`, { command: args.command, timeout: args.timeout_seconds || 30 });
  }
  if (tool === 'fly_list_machine_events') {
    return await fly('GET', `/apps/${app_name}/machines/${machine_id}/events`);
  }
  if (tool === 'fly_list_machine_versions') {
    return await fly('GET', `/apps/${app_name}/machines/${machine_id}/versions`);
  }
  if (tool === 'fly_wait_for_machine_state') {
    const { state = 'started', timeout_seconds = 60 } = args;
    return await fly('GET', `/apps/${app_name}/machines/${machine_id}/wait?state=${state}&timeout=${timeout_seconds}`);
  }
  if (tool === 'fly_get_machine_logs') {
    // Logs API is via NATS streams in production; this returns recent events as a fallback
    const events = await fly('GET', `/apps/${app_name}/machines/${machine_id}/events`);
    return { events, note: 'For real-time logs, use the Fly CLI: fly logs -a ' + app_name };
  }

  // ── SECRETS ───────────────────────────────────────────────────────────────
  if (tool === 'fly_list_secrets') {
    const data = await flyGraphQL(`query($name: String!) { app(name: $name) { secrets { name digest createdAt } } }`, { name: app_name });
    return data.app?.secrets || [];
  }
  if (tool === 'fly_set_secrets') {
    const { secrets } = args; // { KEY1: "value1", KEY2: "value2" }
    const secretsArr = Object.entries(secrets).map(([key, value]) => ({ key, value }));
    return await flyGraphQL(
      `mutation($appId: ID!, $secrets: [SecretInput!]!) { setSecrets(input: { appId: $appId, secrets: $secrets }) { release { id version } } }`,
      { appId: app_name, secrets: secretsArr }
    );
  }
  if (tool === 'fly_unset_secrets') {
    return await flyGraphQL(
      `mutation($appId: ID!, $keys: [String!]!) { unsetSecrets(input: { appId: $appId, keys: $keys }) { release { id version } } }`,
      { appId: app_name, keys: args.keys }
    );
  }

  // ── DEPLOYMENTS & RELEASES ────────────────────────────────────────────────
  if (tool === 'fly_list_releases') {
    const data = await flyGraphQL(`query($name: String!) { app(name: $name) { releases(first: 20) { nodes { version status reason description user { email } createdAt } } } }`, { name: app_name });
    return data.app?.releases?.nodes || [];
  }
  if (tool === 'fly_get_release') {
    const data = await flyGraphQL(`query($name: String!, $version: Int!) { app(name: $name) { release(version: $version) { version status reason description createdAt config } } }`, { name: app_name, version: args.version });
    return data.app?.release;
  }
  if (tool === 'fly_rollback_release') {
    return await flyGraphQL(
      `mutation($appId: ID!, $version: Int!) { rollback(input: { appId: $appId, version: $version }) { release { id version status } } }`,
      { appId: app_name, version: args.target_version }
    );
  }

  // ── VOLUMES ───────────────────────────────────────────────────────────────
  if (tool === 'fly_list_volumes') {
    return await fly('GET', `/apps/${app_name}/volumes`);
  }
  if (tool === 'fly_get_volume') {
    return await fly('GET', `/apps/${app_name}/volumes/${args.volume_id}`);
  }
  if (tool === 'fly_create_volume') {
    const { name, region = 'iad', size_gb = 1, encrypted = true } = args;
    return await fly('POST', `/apps/${app_name}/volumes`, { name, region, size_gb, encrypted });
  }
  if (tool === 'fly_delete_volume') {
    return await fly('DELETE', `/apps/${app_name}/volumes/${args.volume_id}`);
  }
  if (tool === 'fly_extend_volume') {
    return await fly('PUT', `/apps/${app_name}/volumes/${args.volume_id}/extend`, { size_gb: args.new_size_gb });
  }
  if (tool === 'fly_list_volume_snapshots') {
    return await fly('GET', `/apps/${app_name}/volumes/${args.volume_id}/snapshots`);
  }

  // ── REGIONS & PLATFORM ────────────────────────────────────────────────────
  if (tool === 'fly_list_regions') {
    const data = await flyGraphQL(`query { platform { regions { code name latitude longitude gatewayAvailable } } }`);
    return data.platform.regions;
  }
  if (tool === 'fly_list_organizations') {
    const data = await flyGraphQL(`query { organizations { nodes { id slug name type } } }`);
    return data.organizations.nodes;
  }

  // ── POSTGRES (Fly Postgres clusters) ──────────────────────────────────────
  if (tool === 'fly_pg_attach_app') {
    return await flyGraphQL(
      `mutation($input: AttachPostgresClusterInput!) { attachPostgresCluster(input: $input) { postgresClusterApp { name } environmentVariableName connectionString } }`,
      { input: { appId: args.app_name, postgresClusterAppId: args.postgres_app_name, databaseName: args.database_name, variableName: args.env_var_name || 'DATABASE_URL' } }
    );
  }
  if (tool === 'fly_pg_detach_app') {
    return await flyGraphQL(
      `mutation($input: DetachPostgresClusterInput!) { detachPostgresCluster(input: $input) { postgresClusterApp { name } } }`,
      { input: { appId: args.app_name, postgresClusterAppId: args.postgres_app_name } }
    );
  }

  throw new Error(`Unknown Fly.io tool: ${tool}`);
}

export default { execute };
