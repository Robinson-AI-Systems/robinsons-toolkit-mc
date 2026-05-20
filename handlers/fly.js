/**
 * Fly.io Handler — 100 tools
 * Machines API + GraphQL API for apps, machines, volumes, secrets,
 * certificates, Postgres clusters, networking, scaling, builds, health checks,
 * app config, billing, and Super Tools.
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
  if (tool === 'fly_get_app') { return await fly('GET', `/apps/${app_name}`); }
  if (tool === 'fly_create_app') {
    const { name, org_slug = 'personal', network } = args;
    return await fly('POST', '/apps', { app_name: name, org_slug, network });
  }
  if (tool === 'fly_delete_app') { return await fly('DELETE', `/apps/${app_name}`); }
  if (tool === 'fly_restart_app') { return await fly('POST', `/apps/${app_name}/restart`, {}); }

  // Move an app to a different organization
  if (tool === 'fly_move_app') {
    const data = await flyGraphQL(
      `mutation($appId: ID!, $organizationId: ID!) { moveApp(input: { appId: $appId, organizationId: $organizationId }) { app { id name } } }`,
      { appId: app_name, organizationId: args.org_id }
    );
    return data.moveApp?.app;
  }

  // Get the current fly.toml-equivalent config for an app
  if (tool === 'fly_get_app_config') {
    return await fly('GET', `/apps/${app_name}/machines`).then(machines => {
      const first = machines[0];
      return { app_name, machine_count: machines.length, sample_config: first?.config, regions: [...new Set(machines.map(m => m.region))] };
    });
  }

  // Get aggregated status for all machines in an app
  if (tool === 'fly_get_app_status') {
    const machines = await fly('GET', `/apps/${app_name}/machines`);
    const states = {};
    for (const m of machines) states[m.state] = (states[m.state] || 0) + 1;
    return {
      app_name, total: machines.length, by_state: states,
      healthy: machines.filter(m => m.state === 'started').length,
      regions: [...new Set(machines.map(m => m.region))],
      machines: machines.map(m => ({ id: m.id, name: m.name, state: m.state, region: m.region, image: m.config?.image }))
    };
  }

  // Scale total machine count up or down
  if (tool === 'fly_scale_machines_count') {
    const { target_count, region = 'iad', image, size = 'shared-cpu-1x', memory_mb = 256 } = args;
    if (!target_count) throw new Error('target_count is required');
    const machines = await fly('GET', `/apps/${app_name}/machines`);
    const current = machines.filter(m => m.state !== 'destroyed').length;
    const results = { app_name, previous_count: current, target_count, created: [], destroyed: [] };
    if (target_count > current) {
      const toCreate = target_count - current;
      const template = machines.find(m => m.state === 'started') || machines[0];
      for (let i = 0; i < toCreate; i++) {
        const m = await fly('POST', `/apps/${app_name}/machines`, {
          region,
          config: template?.config || { image, guest: { cpu_kind: 'shared', cpus: 1, memory_mb }, env: {}, services: [] }
        });
        results.created.push(m.id);
      }
    } else if (target_count < current) {
      const toDestroy = current - target_count;
      const stoppable = machines.filter(m => m.state !== 'destroyed').slice(0, toDestroy);
      for (const m of stoppable) {
        await fly('DELETE', `/apps/${app_name}/machines/${m.id}?force=true`);
        results.destroyed.push(m.id);
      }
    }
    return results;
  }

  // ── IP ADDRESSES ──────────────────────────────────────────────────────────
  if (tool === 'fly_list_ips') {
    const data = await flyGraphQL(`query($name: String!) { app(name: $name) { ipAddresses { nodes { id address type region createdAt } } } }`, { name: app_name });
    return data.app?.ipAddresses?.nodes || [];
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
  if (tool === 'fly_get_machine') { return await fly('GET', `/apps/${app_name}/machines/${machine_id}`); }
  if (tool === 'fly_create_machine') {
    const { name, region = 'iad', image, env, services, mounts, size = 'shared-cpu-1x', memory_mb = 256, cmd, schedule } = args;
    if (!image) throw new Error('image is required (e.g. "flyio/hellofly:latest")');
    const config = {
      image, env: env || {}, services: services || [], mounts: mounts || [],
      guest: { cpu_kind: size.includes('perf') ? 'performance' : 'shared', cpus: 1, memory_mb }
    };
    if (cmd) config.init = { cmd };
    if (schedule) config.schedule = schedule;
    return await fly('POST', `/apps/${app_name}/machines`, { name, region, config });
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
  if (tool === 'fly_list_machine_events') { return await fly('GET', `/apps/${app_name}/machines/${machine_id}/events`); }
  if (tool === 'fly_list_machine_versions') { return await fly('GET', `/apps/${app_name}/machines/${machine_id}/versions`); }
  if (tool === 'fly_wait_for_machine_state') {
    const { state = 'started', timeout_seconds = 60 } = args;
    return await fly('GET', `/apps/${app_name}/machines/${machine_id}/wait?state=${state}&timeout=${timeout_seconds}`);
  }
  if (tool === 'fly_get_machine_logs') {
    const events = await fly('GET', `/apps/${app_name}/machines/${machine_id}/events`);
    return { events, note: 'For real-time logs use: fly logs -a ' + app_name };
  }

  // Remove a machine from load balancer rotation without stopping it
  if (tool === 'fly_cordon_machine') {
    return await fly('POST', `/apps/${app_name}/machines/${machine_id}/cordon`, {});
  }

  // Restore a machine to load balancer rotation
  if (tool === 'fly_uncordon_machine') {
    return await fly('POST', `/apps/${app_name}/machines/${machine_id}/uncordon`, {});
  }

  // Clone a machine to the same or a different region
  if (tool === 'fly_clone_machine') {
    const { target_region, name } = args;
    const source = await fly('GET', `/apps/${app_name}/machines/${machine_id}`);
    const body = { config: source.config };
    if (target_region) body.region = target_region;
    if (name) body.name = name;
    return await fly('POST', `/apps/${app_name}/machines`, body);
  }

  // Send a signal to a running machine
  if (tool === 'fly_signal_machine') {
    const { signal = 'SIGUSR1' } = args;
    return await fly('POST', `/apps/${app_name}/machines/${machine_id}/signal`, { signal });
  }

  // Get metadata key-value store on a machine
  if (tool === 'fly_get_machine_metadata') {
    return await fly('GET', `/apps/${app_name}/machines/${machine_id}/metadata`);
  }

  // Set a metadata key on a machine
  if (tool === 'fly_set_machine_metadata') {
    const { key, value } = args;
    if (!key) throw new Error('key is required');
    return await fly('POST', `/apps/${app_name}/machines/${machine_id}/metadata/${key}`, { value });
  }

  // Delete a metadata key from a machine
  if (tool === 'fly_delete_machine_metadata') {
    return await fly('DELETE', `/apps/${app_name}/machines/${machine_id}/metadata/${args.key}`);
  }

  // ── SECRETS ───────────────────────────────────────────────────────────────
  if (tool === 'fly_list_secrets') {
    const data = await flyGraphQL(`query($name: String!) { app(name: $name) { secrets { name digest createdAt } } }`, { name: app_name });
    return data.app?.secrets || [];
  }
  if (tool === 'fly_set_secrets') {
    const secretsArr = Object.entries(args.secrets).map(([key, value]) => ({ key, value }));
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
    const data = await flyGraphQL(`query($name: String!, $version: Int!) { app(name: $name) { release(version: $version) { version status reason description createdAt } } }`, { name: app_name, version: args.version });
    return data.app?.release;
  }
  if (tool === 'fly_rollback_release') {
    return await flyGraphQL(
      `mutation($appId: ID!, $version: Int!) { rollback(input: { appId: $appId, version: $version }) { release { id version status } } }`,
      { appId: app_name, version: args.target_version }
    );
  }

  // ── CERTIFICATES (custom domains) ────────────────────────────────────────
  if (tool === 'fly_list_certificates') {
    const data = await flyGraphQL(`query($name: String!) { app(name: $name) { certificates { nodes { id hostname dnsValidationHostname dnsValidationTarget createdAt source } } } }`, { name: app_name });
    return data.app?.certificates?.nodes || [];
  }
  if (tool === 'fly_get_certificate') {
    const data = await flyGraphQL(`query($name: String!, $hostname: String!) { app(name: $name) { certificate(hostname: $hostname) { id hostname configured source isApex dnsValidationTarget dnsValidationHostname } } }`, { name: app_name, hostname: args.hostname });
    return data.app?.certificate;
  }
  if (tool === 'fly_add_certificate') {
    if (!args.hostname) throw new Error('hostname is required (e.g. "myapp.example.com")');
    const data = await flyGraphQL(
      `mutation($appId: ID!, $hostname: String!) { addCertificate(appId: $appId, hostname: $hostname) { certificate { id hostname dnsValidationTarget dnsValidationHostname } } }`,
      { appId: app_name, hostname: args.hostname }
    );
    return data.addCertificate?.certificate;
  }
  if (tool === 'fly_delete_certificate') {
    const data = await flyGraphQL(
      `mutation($appId: ID!, $hostname: String!) { deleteCertificate(appId: $appId, hostname: $hostname) { app { name } certificate { hostname } } }`,
      { appId: app_name, hostname: args.hostname }
    );
    return data.deleteCertificate;
  }
  if (tool === 'fly_check_certificate') {
    const data = await flyGraphQL(`query($name: String!, $hostname: String!) { app(name: $name) { certificate(hostname: $hostname) { configured dnsValidationTarget dnsValidationHostname isApex } } }`, { name: app_name, hostname: args.hostname });
    const cert = data.app?.certificate;
    return { hostname: args.hostname, configured: cert?.configured, needs_dns_record: !cert?.configured, dns_validation_target: cert?.dnsValidationTarget, dns_validation_hostname: cert?.dnsValidationHostname };
  }

  // ── VOLUMES ───────────────────────────────────────────────────────────────
  if (tool === 'fly_list_volumes') { return await fly('GET', `/apps/${app_name}/volumes`); }
  if (tool === 'fly_get_volume') { return await fly('GET', `/apps/${app_name}/volumes/${args.volume_id}`); }
  if (tool === 'fly_create_volume') {
    const { name, region = 'iad', size_gb = 1, encrypted = true, snapshot_id, fstype = 'ext4' } = args;
    if (!name) throw new Error('name is required');
    const body = { name, region, size_gb, encrypted, fstype };
    if (snapshot_id) body.snapshot_id = snapshot_id;
    return await fly('POST', `/apps/${app_name}/volumes`, body);
  }
  if (tool === 'fly_delete_volume') { return await fly('DELETE', `/apps/${app_name}/volumes/${args.volume_id}`); }
  if (tool === 'fly_extend_volume') {
    return await fly('PUT', `/apps/${app_name}/volumes/${args.volume_id}/extend`, { size_gb: args.new_size_gb });
  }
  if (tool === 'fly_list_volume_snapshots') {
    return await fly('GET', `/apps/${app_name}/volumes/${args.volume_id}/snapshots`);
  }
  if (tool === 'fly_create_volume_snapshot') {
    return await fly('POST', `/apps/${app_name}/volumes/${args.volume_id}/snapshots`, {});
  }
  if (tool === 'fly_fork_volume') {
    const { target_region, name } = args;
    return await fly('POST', `/apps/${app_name}/volumes`, {
      name: name || `fork-${args.volume_id}`,
      region: target_region || args.region || 'iad',
      source_volume_id: args.volume_id,
      size_gb: args.size_gb || 1
    });
  }

  // ── FLY POSTGRES ──────────────────────────────────────────────────────────
  // List Postgres cluster apps (apps with "postgres_clusters" role)
  if (tool === 'fly_pg_list') {
    const data = await flyGraphQL(`query { apps { nodes { id name status postgresAppRole { name } } } }`);
    return (data.apps?.nodes || []).filter(a => a.postgresAppRole?.name === 'pg_upstream');
  }

  // Create a new Fly Postgres cluster
  if (tool === 'fly_pg_create') {
    const { name, region = 'iad', vm_size = 'shared-cpu-1x', volume_size_gb = 1, org_slug = 'personal', replicas = 1 } = args;
    if (!name) throw new Error('name is required');
    return await flyGraphQL(
      `mutation($input: CreatePostgresClusterInput!) { createPostgresCluster(input: $input) { postgresClusterApp { id name hostname } } }`,
      { input: { name, region, vmSize: vm_size, volumeSizeGb: volume_size_gb, organizationId: org_slug, count: replicas } }
    );
  }

  // Attach a Postgres cluster to an app
  if (tool === 'fly_pg_attach_app') {
    return await flyGraphQL(
      `mutation($input: AttachPostgresClusterInput!) { attachPostgresCluster(input: $input) { postgresClusterApp { name } environmentVariableName connectionString } }`,
      { input: { appId: args.app_name, postgresClusterAppId: args.postgres_app_name, databaseName: args.database_name, variableName: args.env_var_name || 'DATABASE_URL' } }
    );
  }

  // Detach a Postgres cluster from an app
  if (tool === 'fly_pg_detach_app') {
    return await flyGraphQL(
      `mutation($input: DetachPostgresClusterInput!) { detachPostgresCluster(input: $input) { postgresClusterApp { name } } }`,
      { input: { appId: args.app_name, postgresClusterAppId: args.postgres_app_name } }
    );
  }

  // Get connection string for a Postgres cluster
  if (tool === 'fly_pg_get_connection_string') {
    const data = await flyGraphQL(`query($name: String!) { app(name: $name) { postgresAppRole { name } hostname } }`, { name: app_name });
    const hostname = data.app?.hostname;
    if (!hostname) throw new Error(`App ${app_name} not found or is not a Postgres cluster`);
    return {
      app_name, hostname,
      connection_string: `postgres://postgres:YOUR_PASSWORD@${hostname}:5432/postgres`,
      note: 'Replace YOUR_PASSWORD with the actual password from your app secrets (fly secrets list -a ' + app_name + ')'
    };
  }

  // Trigger Postgres failover (leader election)
  if (tool === 'fly_pg_failover') {
    return await flyGraphQL(
      `mutation($appId: ID!) { failoverPostgresCluster(input: { appId: $appId }) { app { name } } }`,
      { appId: app_name }
    );
  }

  // List Postgres cluster users
  if (tool === 'fly_pg_list_users') {
    const data = await flyGraphQL(`query($name: String!) { app(name: $name) { postgresUsers { nodes { username databases isSuperuser } } } }`, { name: app_name });
    return data.app?.postgresUsers?.nodes || [];
  }

  // List Postgres databases in a cluster
  if (tool === 'fly_pg_list_databases') {
    const data = await flyGraphQL(`query($name: String!) { app(name: $name) { postgresDatabases { nodes { name users { nodes { username } } } } } }`, { name: app_name });
    return data.app?.postgresDatabases?.nodes || [];
  }

  // ── NETWORKING ────────────────────────────────────────────────────────────
  // WireGuard peer management
  if (tool === 'fly_list_wireguard_peers') {
    const data = await flyGraphQL(`query($name: String!) { organization(slug: $name) { wireGuardPeers { nodes { id name pubkey endpoint } } } }`, { name: args.org_slug || 'personal' });
    return data.organization?.wireGuardPeers?.nodes || [];
  }
  if (tool === 'fly_create_wireguard_peer') {
    const { org_slug = 'personal', peer_name, region = 'iad', pubkey, peerip } = args;
    const data = await flyGraphQL(
      `mutation($input: AddWireGuardPeerInput!) { addWireGuardPeer(input: $input) { peerip privkey pubkey } }`,
      { input: { organizationId: org_slug, name: peer_name, region, pubkey, peerip } }
    );
    return data.addWireGuardPeer;
  }
  if (tool === 'fly_delete_wireguard_peer') {
    return await flyGraphQL(
      `mutation($input: RemoveWireGuardPeerInput!) { removeWireGuardPeer(input: $input) { organization { id } } }`,
      { input: { organizationId: args.org_slug || 'personal', name: args.peer_name } }
    );
  }

  // ── REGIONS & PLATFORM ────────────────────────────────────────────────────
  if (tool === 'fly_list_regions') {
    const data = await flyGraphQL(`query { platform { regions { code name latitude longitude gatewayAvailable } } }`);
    return data.platform.regions;
  }
  if (tool === 'fly_list_vm_sizes') {
    const data = await flyGraphQL(`query { platform { vmSizes { name cpuCores memorySizeBytes } } }`);
    return (data.platform?.vmSizes || []).map(s => ({
      name: s.name,
      cpus: s.cpuCores,
      memory_gb: s.memorySizeBytes ? (s.memorySizeBytes / 1073741824).toFixed(1) : 'variable'
    }));
  }
  if (tool === 'fly_get_platform_status') {
    const data = await flyGraphQL(`query { platform { requestRegion } viewer { email } }`);
    return { request_region: data.platform?.requestRegion, authenticated_as: data.viewer?.email };
  }
  if (tool === 'fly_list_organizations') {
    const data = await flyGraphQL(`query { organizations { nodes { id slug name type } } }`);
    return data.organizations.nodes;
  }
  if (tool === 'fly_get_organization') {
    const data = await flyGraphQL(`query($slug: String!) { organization(slug: $slug) { id slug name type memberships { nodes { role user { email name } } } } }`, { slug: args.org_slug });
    return data.organization;
  }
  if (tool === 'fly_list_org_members') {
    const data = await flyGraphQL(`query($slug: String!) { organization(slug: $slug) { memberships { nodes { role createdAt user { id email name } } } } }`, { slug: args.org_slug || 'personal' });
    return data.organization?.memberships?.nodes || [];
  }
  if (tool === 'fly_add_org_member') {
    return await flyGraphQL(
      `mutation($input: CreateOrganizationInvitationInput!) { createOrganizationInvitation(input: $input) { invitation { id email createdAt } } }`,
      { input: { organizationId: args.org_slug, email: args.email } }
    );
  }

  // ── TOKENS ────────────────────────────────────────────────────────────────
  if (tool === 'fly_list_tokens') {
    const data = await flyGraphQL(`query($name: String!) { app(name: $name) { limitedAccessTokens { nodes { id name expiry } } } }`, { name: app_name });
    return data.app?.limitedAccessTokens?.nodes || [];
  }
  if (tool === 'fly_create_deploy_token') {
    const { name = 'deploy-token', expiry } = args;
    const data = await flyGraphQL(
      `mutation($appId: ID!, $name: String!, $expiry: String) { createLimitedAccessToken(input: { appId: $appId, name: $name, expiry: $expiry, profile: "deploy" }) { limitedAccessToken { id name tokenHeader } } }`,
      { appId: app_name, name, expiry }
    );
    return data.createLimitedAccessToken?.limitedAccessToken;
  }
  if (tool === 'fly_revoke_token') {
    return await flyGraphQL(
      `mutation($id: ID!) { deleteLimitedAccessToken(input: { id: $id }) { token { id } } }`,
      { id: args.token_id }
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SUPER TOOLS
  // ══════════════════════════════════════════════════════════════════════════

  // SUPER: Create a machine and poll until it reaches 'started' state
  if (tool === 'fly_deploy_and_wait') {
    const { name, region = 'iad', image, env, services, memory_mb = 256, timeout_seconds = 120 } = args;
    if (!image) throw new Error('image is required');
    const machine = await fly('POST', `/apps/${app_name}/machines`, {
      name, region,
      config: { image, env: env || {}, services: services || [], guest: { cpu_kind: 'shared', cpus: 1, memory_mb } }
    });
    const machineId = machine.id;
    const deadline = Date.now() + timeout_seconds * 1000;
    let finalState;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000));
      const current = await fly('GET', `/apps/${app_name}/machines/${machineId}`);
      finalState = current.state;
      if (finalState === 'started') break;
      if (finalState === 'failed' || finalState === 'destroyed') break;
    }
    return { machine_id: machineId, final_state: finalState, started: finalState === 'started', region, image };
  }

  // SUPER: Comprehensive app health — machines, IPs, certs, recent releases
  if (tool === 'fly_full_app_health') {
    const [machines, ips, releases, secrets, certs] = await Promise.all([
      fly('GET', `/apps/${app_name}/machines`).catch(() => []),
      flyGraphQL(`query($name: String!) { app(name: $name) { ipAddresses { nodes { id address type } } } }`, { name: app_name }).then(d => d.app?.ipAddresses?.nodes || []).catch(() => []),
      flyGraphQL(`query($name: String!) { app(name: $name) { releases(first: 5) { nodes { version status createdAt } } } }`, { name: app_name }).then(d => d.app?.releases?.nodes || []).catch(() => []),
      flyGraphQL(`query($name: String!) { app(name: $name) { secrets { name } } }`, { name: app_name }).then(d => d.app?.secrets || []).catch(() => []),
      flyGraphQL(`query($name: String!) { app(name: $name) { certificates { nodes { hostname configured } } } }`, { name: app_name }).then(d => d.app?.certificates?.nodes || []).catch(() => [])
    ]);
    const machineStates = {};
    for (const m of machines) machineStates[m.state] = (machineStates[m.state] || 0) + 1;
    return {
      app_name,
      machines: { total: machines.length, by_state: machineStates, regions: [...new Set(machines.map(m => m.region))] },
      ips: ips.map(ip => ({ address: ip.address, type: ip.type })),
      certificates: certs.map(c => ({ hostname: c.hostname, configured: c.configured })),
      secrets_count: secrets.length,
      recent_releases: releases,
      healthy: machines.filter(m => m.state === 'started').length === machines.length && machines.length > 0
    };
  }

  // ── APP ENVIRONMENT VARIABLES ─────────────────────────────────────────────
  if (tool === 'fly_set_env_variables') {
    const { variables } = args;
    if (!variables || typeof variables !== 'object') throw new Error('variables must be an object (key-value pairs)');
    const result = await flyGraphQL(
      `mutation($input: SetSecretsInput!) { setSecrets(input: $input) { release { version status } } }`,
      { input: { appId: app_name, secrets: variables } }
    );
    return { success: true, release: result.setSecrets?.release, variables_set: Object.keys(variables).length };
  }

  if (tool === 'fly_get_env_variables') {
    const data = await flyGraphQL(`query($name: String!) { app(name: $name) { config { env } } }`, { name: app_name });
    return data.app?.config?.env || {};
  }

  // ── APP METADATA & SETTINGS ────────────────────────────────────────────────
  if (tool === 'fly_list_app_info') {
    const data = await flyGraphQL(
      `query($name: String!) { app(name: $name) { id name organization { slug } status hostname primaryRegion createdAt } }`,
      { name: app_name }
    );
    return data.app || {};
  }

  if (tool === 'fly_set_app_description') {
    const { description } = args;
    const data = await flyGraphQL(
      `mutation($input: UpdateAppInput!) { updateApp(input: $input) { app { id description } } }`,
      { input: { appId: app_name, description } }
    );
    return { app_name, description: data.updateApp?.app?.description };
  }

  if (tool === 'fly_list_app_regions') {
    const data = await flyGraphQL(
      `query($name: String!) { app(name: $name) { machines { nodes { region } } } }`,
      { name: app_name }
    );
    const machines = data.app?.machines?.nodes || [];
    const regions = [...new Set(machines.map(m => m.region))];
    return { app_name, regions, machine_count: machines.length };
  }

  if (tool === 'fly_set_app_regions') {
    const { regions, count_per_region = 1 } = args;
    if (!Array.isArray(regions) || regions.length === 0) throw new Error('regions must be a non-empty array');
    const machines = await fly('GET', `/apps/${app_name}/machines`);
    const current_regions = [...new Set(machines.map(m => m.region))];
    const to_create = regions.filter(r => !current_regions.includes(r));
    const created = [];
    const template = machines.find(m => m.state === 'started') || machines[0];
    for (const region of to_create) {
      for (let i = 0; i < count_per_region; i++) {
        const m = await fly('POST', `/apps/${app_name}/machines`, {
          region,
          config: template?.config || { image: 'nginx:latest', guest: { cpus: 1, memory_mb: 256 }, services: [] }
        });
        created.push({ region, machine_id: m.id });
      }
    }
    return { app_name, target_regions: regions, created, current_regions };
  }

  // ── BUILDS (GH Deploy Integration) ─────────────────────────────────────────
  if (tool === 'fly_list_builds') {
    const data = await flyGraphQL(
      `query($appId: ID!) { app(id: $appId) { builds(first: 25) { nodes { id status createdAt updatedAt commitSha } } } }`,
      { appId: app_name }
    );
    return data.app?.builds?.nodes || [];
  }

  if (tool === 'fly_get_build') {
    const { build_id } = args;
    if (!build_id) throw new Error('build_id is required');
    const data = await flyGraphQL(`query($buildId: ID!) { build(id: $buildId) { id status startedAt completedAt commitSha commitMessage } }`, { buildId: build_id });
    return data.build || {};
  }

  if (tool === 'fly_deploy_from_image') {
    const { image, skip_health_checks = false } = args;
    if (!image) throw new Error('image is required (e.g., "my-app:v1.0" or registry URL)');
    const result = await flyGraphQL(
      `mutation($input: DeployImageInput!) { deployImage(input: $input) { release { version status createdAt } } }`,
      { input: { appId: app_name, image, skipHealthChecks: skip_health_checks } }
    );
    return result.deployImage?.release || {};
  }

  if (tool === 'fly_deploy_with_volumes') {
    const { image, volume_mounts = {}, skip_health_checks = false } = args;
    if (!image) throw new Error('image is required');
    const mounts = Object.entries(volume_mounts).map(([dest, vol_id]) => ({ destination: dest, volumeId: vol_id }));
    const result = await flyGraphQL(
      `mutation($input: DeployImageInput!) { deployImage(input: $input) { release { version status } } }`,
      { input: { appId: app_name, image, mounts, skipHealthChecks: skip_health_checks } }
    );
    return { release: result.deployImage?.release, mounts };
  }

  // ── HEALTH & MONITORING ────────────────────────────────────────────────────
  if (tool === 'fly_list_health_checks') {
    const data = await flyGraphQL(
      `query($name: String!) { app(name: $name) { healthChecks { nodes { id protocol port path } } } }`,
      { name: app_name }
    );
    return data.app?.healthChecks?.nodes || [];
  }

  if (tool === 'fly_get_health_check') {
    const { check_id } = args;
    if (!check_id) throw new Error('check_id is required');
    const data = await flyGraphQL(
      `query($checkId: ID!) { healthCheck(id: $checkId) { id protocol port path interval timeout successThreshold failureThreshold } }`,
      { checkId: check_id }
    );
    return data.healthCheck || {};
  }

  if (tool === 'fly_update_health_check') {
    const { check_id, protocol, port, path, interval = 30, timeout = 5, success_threshold = 1, failure_threshold = 3 } = args;
    if (!check_id) throw new Error('check_id is required');
    const result = await flyGraphQL(
      `mutation($input: UpdateHealthCheckInput!) { updateHealthCheck(input: $input) { healthCheck { id } } }`,
      { input: { id: check_id, protocol, port, path, interval, timeout, successThreshold: success_threshold, failureThreshold: failure_threshold } }
    );
    return { health_check_id: result.updateHealthCheck?.healthCheck?.id, updated: true };
  }

  if (tool === 'fly_get_app_metrics') {
    const data = await flyGraphQL(
      `query($name: String!) { app(name: $name) { machines { nodes { state config { guest { cpus memory_mb } } } } } }`,
      { name: app_name }
    );
    const machines = data.app?.machines?.nodes || [];
    const total_cpus = machines.reduce((acc, m) => acc + (m.config?.guest?.cpus || 0), 0);
    const total_memory_mb = machines.reduce((acc, m) => acc + (m.config?.guest?.memory_mb || 0), 0);
    const running = machines.filter(m => m.state === 'started').length;
    return { app_name, total_machines: machines.length, running_machines: running, total_cpus, total_memory_mb, average_cpu_per_machine: (total_cpus / Math.max(machines.length, 1)).toFixed(2) };
  }

  if (tool === 'fly_get_machine_stats') {
    if (!machine_id) throw new Error('machine_id is required');
    const data = await fly('GET', `/apps/${app_name}/machines/${machine_id}`);
    const checks = data.checks || [];
    return {
      machine_id,
      state: data.state,
      region: data.region,
      config: { cpus: data.config?.guest?.cpus, memory_mb: data.config?.guest?.memory_mb },
      health_checks: checks.length,
      processes: data.processes?.length || 0
    };
  }

  // ── MACHINE LIFECYCLE ──────────────────────────────────────────────────────
  if (tool === 'fly_machine_rebuild_from_image') {
    if (!machine_id) throw new Error('machine_id is required');
    const { image, skip_health_checks = false } = args;
    if (!image) throw new Error('image is required');
    const result = await flyGraphQL(
      `mutation($input: RebuildMachineInput!) { rebuildMachine(input: $input) { machine { id state } } }`,
      { input: { id: machine_id, image, skipHealthChecks: skip_health_checks } }
    );
    return result.rebuildMachine?.machine || {};
  }

  if (tool === 'fly_machine_update_restart_policy') {
    if (!machine_id) throw new Error('machine_id is required');
    const { policy = 'always', max_retries = 0 } = args;
    const restartPolicy = { policy, maxRetries: max_retries };
    const result = await fly('PATCH', `/apps/${app_name}/machines/${machine_id}`, { config: { restart: restartPolicy } });
    return { machine_id, restart_policy: result.config?.restart };
  }

  if (tool === 'fly_list_machine_releases') {
    if (!machine_id) throw new Error('machine_id is required');
    const data = await flyGraphQL(
      `query($machineId: ID!) { machine(id: $machineId) { releases { nodes { version status createdAt } } } }`,
      { machineId: machine_id }
    );
    return data.machine?.releases?.nodes || [];
  }

  if (tool === 'fly_wait_machine_healthy') {
    if (!machine_id) throw new Error('machine_id is required');
    const { max_wait_seconds = 60, check_interval_ms = 2000 } = args;
    const start = Date.now();
    while (Date.now() - start < max_wait_seconds * 1000) {
      const m = await fly('GET', `/apps/${app_name}/machines/${machine_id}`);
      const checks = m.checks || [];
      const all_passed = checks.length > 0 && checks.every(c => c.status === 'passing');
      if (m.state === 'started' && all_passed) return { machine_id, healthy: true, state: m.state, checks_passed: checks.filter(c => c.status === 'passing').length };
      await new Promise(r => setTimeout(r, check_interval_ms));
    }
    throw new Error(`Machine ${machine_id} did not become healthy within ${max_wait_seconds}s`);
  }

  // ── IP & NETWORKING ────────────────────────────────────────────────────────
  if (tool === 'fly_get_ip_details') {
    const { ip_address } = args;
    if (!ip_address) throw new Error('ip_address is required');
    const data = await flyGraphQL(
      `query($address: String!) { platform { ips(where: { address: $address }) { nodes { address type region createdAt } } } }`,
      { address: ip_address }
    );
    return data.platform?.ips?.nodes?.[0] || { address: ip_address, note: 'IP not found' };
  }

  if (tool === 'fly_list_private_networks') {
    const data = await flyGraphQL(
      `query { platform { networks { nodes { id name description createdAt } } } }`
    );
    return data.platform?.networks?.nodes || [];
  }

  // ── BILLING & USAGE ────────────────────────────────────────────────────────
  if (tool === 'fly_get_app_bill') {
    const data = await flyGraphQL(
      `query($name: String!) { app(name: $name) { billingStatus { month charges { item amount } } } }`,
      { name: app_name }
    );
    const billing = data.app?.billingStatus || {};
    return { app_name, month: billing.month, charges: billing.charges, total: billing.charges?.reduce((s, c) => s + c.amount, 0) };
  }

  if (tool === 'fly_get_organization_bill') {
    const { org_slug } = args;
    if (!org_slug) throw new Error('org_slug is required');
    const data = await flyGraphQL(
      `query($slug: String!) { organization(slug: $slug) { billingStatus { month charges { item amount } } } }`,
      { slug: org_slug }
    );
    const billing = data.organization?.billingStatus || {};
    return { organization: org_slug, month: billing.month, charges: billing.charges, total: billing.charges?.reduce((s, c) => s + c.amount, 0) };
  }

  // ── MACHINE FEATURES ───────────────────────────────────────────────────────
  if (tool === 'fly_machine_get_process_stats') {
    if (!machine_id) throw new Error('machine_id is required');
    const data = await fly('GET', `/apps/${app_name}/machines/${machine_id}/processes`);
    return data || [];
  }

  if (tool === 'fly_machine_set_metadata') {
    if (!machine_id) throw new Error('machine_id is required');
    const { key, value } = args;
    if (!key || !value) throw new Error('key and value are required');
    const result = await fly('PATCH', `/apps/${app_name}/machines/${machine_id}`, { metadata: { [key]: value } });
    return { machine_id, metadata_updated: result.metadata };
  }

  // SUPER: Provision a Postgres cluster and attach it to an app
  if (tool === 'fly_provision_postgres_and_attach') {
    const { postgres_name, region = 'iad', vm_size = 'shared-cpu-1x', volume_size_gb = 1, env_var = 'DATABASE_URL' } = args;
    if (!postgres_name) throw new Error('postgres_name is required (name for the Postgres cluster app)');
    const created = await flyGraphQL(
      `mutation($input: CreatePostgresClusterInput!) { createPostgresCluster(input: $input) { postgresClusterApp { id name hostname } } }`,
      { input: { name: postgres_name, region, vmSize: vm_size, volumeSizeGb: volume_size_gb, organizationId: 'personal', count: 1 } }
    );
    const pgApp = created.createPostgresCluster?.postgresClusterApp;
    if (!pgApp) throw new Error('Postgres cluster creation failed');
    if (app_name) {
      const attached = await flyGraphQL(
        `mutation($input: AttachPostgresClusterInput!) { attachPostgresCluster(input: $input) { environmentVariableName connectionString } }`,
        { input: { appId: app_name, postgresClusterAppId: postgres_name, variableName: env_var } }
      );
      return { postgres_app: pgApp, attached_to: app_name, env_var, connection_string: attached.attachPostgresCluster?.connectionString };
    }
    return { postgres_app: pgApp, note: 'Postgres created but not attached — provide app_name to attach automatically' };
  }

  // SUPER: Find the last stable release and roll back to it
  if (tool === 'fly_emergency_rollback') {
    const data = await flyGraphQL(`query($name: String!) { app(name: $name) { releases(first: 10) { nodes { version status createdAt } } } }`, { name: app_name });
    const releases = data.app?.releases?.nodes || [];
    const current = releases[0];
    const previous = releases.find((r, i) => i > 0 && r.status === 'complete');
    if (!previous) throw new Error(`No previous stable release found for ${app_name}`);
    const rollback = await flyGraphQL(
      `mutation($appId: ID!, $version: Int!) { rollback(input: { appId: $appId, version: $version }) { release { id version status } } }`,
      { appId: app_name, version: previous.version }
    );
    return {
      rolled_back_from: current?.version,
      rolled_back_to: previous.version,
      result: rollback.rollback?.release,
      previous_release_date: previous.createdAt
    };
  }

  throw new Error(`Unknown Fly.io tool: ${tool}`);
}

export default { execute };
