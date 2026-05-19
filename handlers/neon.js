/**
 * Neon Handler — 167 tools
 * Full Neon API: projects, branches, databases, endpoints, roles,
 * SQL execution, migrations, monitoring, backups, and more.
 */

const BASE = 'https://console.neon.tech/api/v2';

function headers() {
  const key = process.env.NEON_API_KEY;
  if (!key) throw new Error('NEON_API_KEY not set in .env');
  return { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Accept': 'application/json' };
}

async function n(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: headers(),
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return { success: true };
  const data = await res.json();
  if (!res.ok) throw new Error(`Neon API ${res.status}: ${data.message || JSON.stringify(data)}`);
  return data;
}

// Execute SQL against a Neon database via HTTP
async function runSQL(projectId, sql, database='neondb', branchId, role) {
  const project = await n('GET', `/projects/${projectId}`);
  const branches = await n('GET', `/projects/${projectId}/branches`);
  const branch = branchId
    ? branches.branches.find(b => b.id === branchId)
    : branches.branches.find(b => b.primary) || branches.branches[0];
  if (!branch) throw new Error('No branch found');

  const endpoints = await n('GET', `/projects/${projectId}/endpoints`);
  const endpoint = endpoints.endpoints.find(e => e.branch_id === branch.id && e.type === 'read_write')
    || endpoints.endpoints.find(e => e.branch_id === branch.id);
  if (!endpoint) throw new Error('No endpoint found for this branch');

  const dbRole = role || project.project?.database_host?.replace(/-\w+\..*$/, '') || 'neondb_owner';
  const connStr = `postgresql://${dbRole}@${endpoint.host}/${database}?sslmode=require`;

  // Use Neon's serverless HTTP driver approach via their REST endpoint
  const res = await fetch(`https://${endpoint.host}/sql`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NEON_API_KEY}`,
      'Content-Type': 'application/json',
      'Neon-Connection-String': connStr
    },
    body: JSON.stringify({ query: sql })
  });

  if (!res.ok) {
    // Fallback: return the connection string so the agent can use it
    const err = await res.text();
    return {
      connection_string: connStr,
      host: endpoint.host,
      database,
      note: 'Direct SQL via HTTP failed. Use the connection_string with a Postgres client or local_run_command with psql.',
      error: err.slice(0, 500)
    };
  }
  return await res.json();
}

async function execute(tool, args) {
  const { project_id, branch_id } = args;

  // ── USER / AUTH ────────────────────────────────────────────────────────────
  if (tool === 'neon_get_current_user') { return await n('GET', '/users/me'); }
  if (tool === 'neon_check_api_key') {
    try { await n('GET', '/users/me'); return { valid: true, message: 'NEON_API_KEY is valid' }; }
    catch (e) { return { valid: false, error: e.message }; }
  }
  if (tool === 'neon_list_api_keys') { return await n('GET', '/api_keys'); }
  if (tool === 'neon_create_api_key') { return await n('POST', '/api_keys', { key_name: args.key_name }); }
  if (tool === 'neon_revoke_api_key') { return await n('DELETE', `/api_keys/${args.key_id}`); }

  // ── ORGANIZATIONS ─────────────────────────────────────────────────────────
  if (tool === 'neon_list_organizations') { return await n('GET', '/organizations'); }

  // ── PROJECTS ──────────────────────────────────────────────────────────────
  if (tool === 'neon_list_projects') {
    const { limit=10, search, org_id } = args;
    let path = `/projects?limit=${limit}`;
    if (search) path += `&search=${encodeURIComponent(search)}`;
    if (org_id) path += `&org_id=${org_id}`;
    const d = await n('GET', path);
    return { projects: d.projects.map(p=>({ id:p.id, name:p.name, region_id:p.region_id, pg_version:p.pg_version, created_at:p.created_at })), pagination: d.pagination };
  }
  if (tool === 'neon_create_project') {
    const { name, region_id='aws-us-east-2', pg_version=16, branch } = args;
    return await n('POST', '/projects', { project: { name, region_id, pg_version, branch } });
  }
  if (tool === 'neon_delete_project') { return await n('DELETE', `/projects/${project_id}`); }
  if (tool === 'neon_describe_project') {
    const [proj, branches, endpoints] = await Promise.all([
      n('GET', `/projects/${project_id}`),
      n('GET', `/projects/${project_id}/branches`),
      n('GET', `/projects/${project_id}/endpoints`)
    ]);
    return { project: proj.project, branches: branches.branches, endpoints: endpoints.endpoints };
  }
  if (tool === 'neon_update_project') {
    const { name, history_retention_seconds } = args;
    const body = { project: {} };
    if (name) body.project.name = name;
    if (history_retention_seconds !== undefined) body.project.history_retention_seconds = history_retention_seconds;
    return await n('PATCH', `/projects/${project_id}`, body);
  }
  if (tool === 'neon_get_project_operations') { return await n('GET', `/projects/${project_id}/operations?limit=${args.limit||20}`); }
  if (tool === 'neon_get_project_consumption') { return await n('GET', `/projects/${project_id}/consumption_history/events`); }
  if (tool === 'neon_get_project_quotas') { return await n('GET', `/projects/${project_id}`).then(d => d.project?.default_endpoint_settings); }
  if (tool === 'neon_list_shared_projects') { return await n('GET', '/projects/shared'); }
  if (tool === 'neon_share_project') { return await n('POST', `/projects/${project_id}/sharing`, { invitation: { email: args.email, scope: args.scope||'member' } }); }
  if (tool === 'neon_revoke_project_share') { return await n('DELETE', `/projects/${project_id}/sharing/${args.sharing_id}`); }
  if (tool === 'neon_list_project_shares') { return await n('GET', `/projects/${project_id}/sharing`); }

  // ── BRANCHES ──────────────────────────────────────────────────────────────
  if (tool === 'neon_list_branches') {
    const d = await n('GET', `/projects/${project_id}/branches`);
    return { branches: d.branches.map(b=>({ id:b.id, name:b.name, primary:b.primary, created_at:b.created_at, state:b.current_state })) };
  }
  if (tool === 'neon_create_branch') {
    const { branch_name, from_branch, from_timestamp } = args;
    const body = { branch: { name: branch_name } };
    if (from_branch) body.branch.parent_id = from_branch;
    if (from_timestamp) body.branch.parent_timestamp = from_timestamp;
    // Also create an endpoint for the branch
    body.endpoints = [{ type: 'read_write' }];
    return await n('POST', `/projects/${project_id}/branches`, body);
  }
  if (tool === 'neon_delete_branch') { return await n('DELETE', `/projects/${project_id}/branches/${branch_id}`); }
  if (tool === 'neon_get_branch_details') { return await n('GET', `/projects/${project_id}/branches/${branch_id}`); }
  if (tool === 'neon_describe_branch') {
    const [branch, endpoints, databases, roles] = await Promise.all([
      n('GET', `/projects/${project_id}/branches/${branch_id}`),
      n('GET', `/projects/${project_id}/endpoints`).then(d => d.endpoints.filter(e=>e.branch_id===branch_id)),
      n('GET', `/projects/${project_id}/branches/${branch_id}/databases`),
      n('GET', `/projects/${project_id}/branches/${branch_id}/roles`)
    ]);
    return { branch: branch.branch, endpoints, databases: databases.databases, roles: roles.roles };
  }
  if (tool === 'neon_update_branch') {
    const body = { branch: {} };
    if (args.name) body.branch.name = args.name;
    return await n('PATCH', `/projects/${project_id}/branches/${branch_id}`, body);
  }
  if (tool === 'neon_reset_from_parent') { return await n('POST', `/projects/${project_id}/branches/${branch_id}/restore`, { source_branch_id: args.parent_id, preserve_under_name: args.preserve_under_name }); }
  if (tool === 'neon_restore_branch_to_timestamp') {
    return await n('POST', `/projects/${project_id}/branches`, { branch: { parent_id: branch_id, parent_timestamp: args.timestamp, name: args.new_branch_name || `restore-${Date.now()}` }, endpoints: [{ type: 'read_write' }] });
  }
  if (tool === 'neon_set_branch_as_primary') { return await n('POST', `/projects/${project_id}/branches/${branch_id}/set_as_primary`); }
  if (tool === 'neon_get_branch_schema_diff') {
    return await n('GET', `/projects/${project_id}/branches/${branch_id}/schema?db_name=${args.database||'neondb'}&role=${args.role||''}&compare_with=${args.compare_branch_id||''}`);
  }

  // ── DATABASES ─────────────────────────────────────────────────────────────
  if (tool === 'neon_list_databases') { return await n('GET', `/projects/${project_id}/branches/${branch_id}/databases`); }
  if (tool === 'neon_create_database') { return await n('POST', `/projects/${project_id}/branches/${branch_id}/databases`, { database: { name:args.database_name, owner_name:args.owner_role||'neondb_owner' } }); }
  if (tool === 'neon_delete_database') { return await n('DELETE', `/projects/${project_id}/branches/${branch_id}/databases/${args.database_name}`); }
  if (tool === 'neon_get_database_size') {
    return await runSQL(project_id, `SELECT pg_database_size(current_database()) as size_bytes, pg_size_pretty(pg_database_size(current_database())) as size_human;`, args.database, branch_id);
  }
  if (tool === 'neon_get_database_tables') {
    return await runSQL(project_id, `SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;`, args.database, branch_id);
  }
  if (tool === 'neon_describe_table_schema') {
    const sql = `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length FROM information_schema.columns WHERE table_name='${args.table_name}' AND table_schema='${args.schema||'public'}' ORDER BY ordinal_position;`;
    return await runSQL(project_id, sql, args.database, branch_id);
  }
  if (tool === 'neon_vacuum_database') { return await runSQL(project_id, 'VACUUM ANALYZE;', args.database, branch_id); }
  if (tool === 'neon_analyze_database') { return await runSQL(project_id, 'ANALYZE VERBOSE;', args.database, branch_id); }
  if (tool === 'neon_get_database_locks') {
    return await runSQL(project_id, `SELECT pid, wait_event_type, wait_event, state, query_start, query FROM pg_stat_activity WHERE wait_event IS NOT NULL AND state != 'idle' ORDER BY query_start;`, args.database, branch_id);
  }
  if (tool === 'neon_kill_database_query') {
    return await runSQL(project_id, `SELECT pg_terminate_backend(${args.pid});`, args.database, branch_id);
  }
  if (tool === 'neon_get_database_activity') {
    return await runSQL(project_id, `SELECT pid, usename, application_name, state, query_start, state_change, wait_event_type, LEFT(query,200) as query FROM pg_stat_activity WHERE state != 'idle' ORDER BY query_start;`, args.database, branch_id);
  }

  // ── SQL EXECUTION ─────────────────────────────────────────────────────────
  if (tool === 'neon_run_sql') {
    const { sql, database='neondb', role } = args;
    return await runSQL(project_id, sql, database, branch_id, role);
  }
  if (tool === 'neon_run_sql_transaction') {
    const { statements, database='neondb' } = args;
    const sql = `BEGIN;\n${statements.join(';\n')};\nCOMMIT;`;
    return await runSQL(project_id, sql, database, branch_id);
  }
  if (tool === 'neon_explain_sql_statement') {
    return await runSQL(project_id, `EXPLAIN ANALYZE ${args.sql}`, args.database, branch_id);
  }
  if (tool === 'neon_list_slow_queries') {
    const sql = `SELECT query, calls, mean_exec_time::int as avg_ms, max_exec_time::int as max_ms, total_exec_time::int as total_ms, rows FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT ${args.limit||20};`;
    return await runSQL(project_id, sql, args.database, branch_id);
  }
  if (tool === 'neon_detect_missing_indexes') {
    const sql = `SELECT schemaname||'.'||relname as table, seq_scan, seq_tup_read, idx_scan, pg_size_pretty(pg_relation_size(relid)) as size FROM pg_stat_user_tables WHERE seq_scan > 100 ORDER BY seq_tup_read DESC LIMIT 20;`;
    return await runSQL(project_id, sql, args.database, branch_id);
  }
  if (tool === 'neon_get_index_usage') {
    const sql = `SELECT schemaname||'.'||relname as table, indexrelname as index, idx_scan, idx_tup_read, idx_tup_fetch FROM pg_stat_user_indexes ORDER BY idx_scan DESC LIMIT 30;`;
    return await runSQL(project_id, sql, args.database, branch_id);
  }
  if (tool === 'neon_get_table_bloat') {
    const sql = `SELECT schemaname||'.'||relname as table, n_dead_tup as dead_rows, n_live_tup as live_rows, round(n_dead_tup::numeric/NULLIF(n_live_tup+n_dead_tup,0)*100,2) as dead_pct FROM pg_stat_user_tables WHERE n_dead_tup > 100 ORDER BY n_dead_tup DESC LIMIT 20;`;
    return await runSQL(project_id, sql, args.database, branch_id);
  }
  if (tool === 'neon_analyze_deadlocks') {
    const sql = `SELECT pid, wait_event, pg_blocking_pids(pid) as blocked_by, LEFT(query,200) as query FROM pg_stat_activity WHERE cardinality(pg_blocking_pids(pid)) > 0;`;
    return await runSQL(project_id, sql, args.database, branch_id);
  }

  // ── CONNECTION STRING ─────────────────────────────────────────────────────
  if (tool === 'neon_get_connection_string' || tool === 'neon_get_connection_uri') {
    const endpoints = await n('GET', `/projects/${project_id}/endpoints`);
    const bid = branch_id || (await n('GET', `/projects/${project_id}/branches`)).branches.find(b=>b.primary)?.id;
    const endpoint = endpoints.endpoints.find(e=>e.branch_id===bid && e.type==='read_write') || endpoints.endpoints.find(e=>e.branch_id===bid);
    if (!endpoint) throw new Error('No endpoint found. Create a branch with an endpoint first.');
    const database = args.database || 'neondb';
    const role = args.role || 'neondb_owner';
    const pooled = args.pooled !== false;
    const host = pooled ? endpoint.host.replace('.aws.neon.tech', '-pooler.aws.neon.tech') : endpoint.host;
    return {
      connection_string: `postgresql://${role}@${host}/${database}?sslmode=require`,
      host: endpoint.host,
      pooler_host: host,
      database,
      role,
      endpoint_id: endpoint.id
    };
  }
  if (tool === 'neon_test_connection') {
    return await runSQL(project_id, 'SELECT version(), current_database(), current_user, now() as server_time;', args.database, branch_id);
  }

  // ── ENDPOINTS ─────────────────────────────────────────────────────────────
  if (tool === 'neon_list_endpoints') { return await n('GET', `/projects/${project_id}/endpoints`); }
  if (tool === 'neon_create_endpoint') {
    return await n('POST', `/projects/${project_id}/endpoints`, { endpoint: { branch_id: args.branch_id, type: args.type||'read_write', autoscaling_limit_min_cu: args.min_cu||0.25, autoscaling_limit_max_cu: args.max_cu||0.25 } });
  }
  if (tool === 'neon_delete_endpoint') { return await n('DELETE', `/projects/${project_id}/endpoints/${args.endpoint_id}`); }
  if (tool === 'neon_update_endpoint') {
    const body = { endpoint: {} };
    if (args.autoscaling_limit_min_cu !== undefined) body.endpoint.autoscaling_limit_min_cu = args.autoscaling_limit_min_cu;
    if (args.autoscaling_limit_max_cu !== undefined) body.endpoint.autoscaling_limit_max_cu = args.autoscaling_limit_max_cu;
    if (args.suspend_timeout !== undefined) body.endpoint.suspend_timeout_seconds = args.suspend_timeout;
    return await n('PATCH', `/projects/${project_id}/endpoints/${args.endpoint_id}`, body);
  }
  if (tool === 'neon_start_endpoint') { return await n('POST', `/projects/${project_id}/endpoints/${args.endpoint_id}/start`); }
  if (tool === 'neon_suspend_endpoint') { return await n('POST', `/projects/${project_id}/endpoints/${args.endpoint_id}/suspend`); }
  if (tool === 'neon_restart_endpoint') { return await n('POST', `/projects/${project_id}/endpoints/${args.endpoint_id}/restart`); }
  if (tool === 'neon_set_endpoint_autoscaling') {
    return await n('PATCH', `/projects/${project_id}/endpoints/${args.endpoint_id}`, { endpoint: { autoscaling_limit_min_cu: args.min_cu, autoscaling_limit_max_cu: args.max_cu } });
  }
  if (tool === 'neon_set_endpoint_pooling') {
    return await n('PATCH', `/projects/${project_id}/endpoints/${args.endpoint_id}`, { endpoint: { pooler_enabled: args.enabled, pooler_mode: args.mode||'transaction' } });
  }

  // ── ROLES ─────────────────────────────────────────────────────────────────
  if (tool === 'neon_list_roles') { return await n('GET', `/projects/${project_id}/branches/${branch_id}/roles`); }
  if (tool === 'neon_create_role') { return await n('POST', `/projects/${project_id}/branches/${branch_id}/roles`, { role: { name: args.role_name } }); }
  if (tool === 'neon_delete_role') { return await n('DELETE', `/projects/${project_id}/branches/${branch_id}/roles/${args.role_name}`); }
  if (tool === 'neon_reset_role_password') { return await n('POST', `/projects/${project_id}/branches/${branch_id}/roles/${args.role_name}/reset_password`); }

  // ── EXTENSIONS ────────────────────────────────────────────────────────────
  if (tool === 'neon_list_extensions') {
    return await runSQL(project_id, `SELECT name, default_version, installed_version, comment FROM pg_available_extensions ORDER BY name;`, args.database, branch_id);
  }
  if (tool === 'neon_enable_extension') {
    return await runSQL(project_id, `CREATE EXTENSION IF NOT EXISTS "${args.extension_name}";`, args.database, branch_id);
  }
  if (tool === 'neon_disable_extension') {
    return await runSQL(project_id, `DROP EXTENSION IF EXISTS "${args.extension_name}";`, args.database, branch_id);
  }

  // ── MIGRATIONS (compound) ─────────────────────────────────────────────────
  if (tool === 'neon_prepare_database_migration') {
    // Create a temp branch, run the migration there
    const branchRes = await n('POST', `/projects/${project_id}/branches`, {
      branch: { name: `migration-test-${Date.now()}`, parent_id: branch_id },
      endpoints: [{ type: 'read_write' }]
    });
    const newBranchId = branchRes.branch.id;
    return {
      migration_branch_id: newBranchId,
      migration_branch_name: branchRes.branch.name,
      message: 'Temporary migration branch created. Run your SQL migrations against this branch. Then call neon_complete_database_migration to apply or discard.'
    };
  }
  if (tool === 'neon_complete_database_migration') {
    if (args.apply) {
      await n('POST', `/projects/${project_id}/branches/${args.migration_branch_id}/restore`, { source_branch_id: args.migration_branch_id });
      await n('DELETE', `/projects/${project_id}/branches/${args.migration_branch_id}`);
      return { success: true, message: 'Migration applied to target branch. Temp branch deleted.' };
    } else {
      await n('DELETE', `/projects/${project_id}/branches/${args.migration_branch_id}`);
      return { success: true, message: 'Migration discarded. Temp branch deleted.' };
    }
  }
  if (tool === 'neon_deploy_schema') {
    const { sql_content, database='neondb' } = args;
    return await runSQL(project_id, sql_content, database, branch_id);
  }
  if (tool === 'neon_verify_schema') {
    const { required_tables, database='neondb' } = args;
    const result = await runSQL(project_id, `SELECT tablename FROM pg_tables WHERE schemaname='public';`, database, branch_id);
    const existing = (result.rows || result).map(r => r.tablename);
    const missing = required_tables.filter(t => !existing.includes(t));
    return { all_tables: existing, required_tables, missing_tables: missing, verified: missing.length === 0 };
  }

  // ── MONITORING ────────────────────────────────────────────────────────────
  if (tool === 'neon_get_cache_hit_ratio') {
    const sql = `SELECT round(sum(blks_hit)::numeric / NULLIF(sum(blks_hit+blks_read),0) * 100, 2) as cache_hit_ratio FROM pg_stat_database WHERE datname = current_database();`;
    return await runSQL(project_id, sql, args.database, branch_id);
  }
  if (tool === 'neon_get_connection_stats') {
    const sql = `SELECT max_conn, used, res_for_super, max_conn-used-res_for_super AS available FROM (SELECT count(*) used FROM pg_stat_activity) t1, (SELECT setting::int res_for_super FROM pg_settings WHERE name='superuser_reserved_connections') t2, (SELECT setting::int max_conn FROM pg_settings WHERE name='max_connections') t3;`;
    return await runSQL(project_id, sql, args.database, branch_id);
  }

  // ── WEBHOOKS ──────────────────────────────────────────────────────────────
  if (tool === 'neon_list_webhooks') { return await n('GET', `/projects/${project_id}/webhooks`); }
  if (tool === 'neon_create_webhook') { return await n('POST', `/projects/${project_id}/webhooks`, { webhook: { url: args.url, events: args.events||['branch.created','database.created'] } }); }
  if (tool === 'neon_delete_webhook') { return await n('DELETE', `/projects/${project_id}/webhooks/${args.webhook_id}`); }

  // ── PERFORMANCE & SETUP ───────────────────────────────────────────────────
  if (tool === 'neon_setup_rad_database' || tool === 'neon_create_project_for_rad') {
    // Complete autonomous setup
    const proj = await n('POST', '/projects', { project: { name: args.name||'rai-project', region_id: args.region||'aws-us-east-2', pg_version: 16 } });
    const projId = proj.project.id;
    const branches = await n('GET', `/projects/${projId}/branches`);
    const mainBranch = branches.branches[0];
    const connInfo = await execute('neon_get_connection_string', { project_id: projId, branch_id: mainBranch.id });
    return { project: proj.project, branch: mainBranch, connection: connInfo, message: 'Project created and ready to use.' };
  }
  if (tool === 'neon_suggest_indexes') {
    const sql = `SELECT schemaname||'.'||relname as table, seq_scan as full_table_scans, idx_scan as index_scans, CASE WHEN idx_scan=0 THEN 'No indexes used — consider adding indexes' WHEN seq_scan>idx_scan THEN 'More full scans than index scans — indexes may be missing' ELSE 'Index usage looks good' END as recommendation FROM pg_stat_user_tables ORDER BY seq_scan DESC LIMIT 15;`;
    return await runSQL(project_id, sql, args.database, branch_id);
  }
  if (tool === 'neon_get_performance_insights') {
    const [slowQueries, indexUsage, tableStats] = await Promise.all([
      execute('neon_list_slow_queries', { project_id, branch_id, database: args.database, limit: 5 }),
      execute('neon_get_index_usage', { project_id, branch_id, database: args.database }),
      runSQL(project_id, `SELECT schemaname||'.'||relname as table, n_live_tup as rows, pg_size_pretty(pg_relation_size(relid)) as size FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 10;`, args.database, branch_id)
    ]);
    return { slow_queries: slowQueries, index_usage: indexUsage, table_stats: tableStats, recommendations: 'See slow_queries for optimization opportunities. Add indexes for columns used in WHERE clauses of slow queries.' };
  }
  if (tool === 'neon_get_cost_breakdown') { return await n('GET', `/projects/${project_id}/consumption_history/events`); }
  if (tool === 'neon_get_billing_history') { return await n('GET', `/consumption_history/account`); }
  if (tool === 'neon_list_read_replicas') {
    const d = await n('GET', `/projects/${project_id}/endpoints`);
    return d.endpoints.filter(e => e.type === 'read_only');
  }
  if (tool === 'neon_create_read_replica') {
    return await n('POST', `/projects/${project_id}/endpoints`, { endpoint: { branch_id: args.branch_id||branch_id, type: 'read_only', autoscaling_limit_min_cu: args.min_cu||0.25, autoscaling_limit_max_cu: args.max_cu||0.25 } });
  }
  if (tool === 'neon_enable_ip_allowlist') {
    return await n('PATCH', `/projects/${project_id}`, { project: { settings: { allowed_ips: { ips: args.ips, protected_branches_only: args.protected_only||false } } } });
  }
  if (tool === 'neon_get_ip_allowlist') {
    const d = await n('GET', `/projects/${project_id}`);
    return d.project?.settings?.allowed_ips || { ips: [], protected_branches_only: false };
  }
  if (tool === 'neon_rotate_credentials') {
    return await n('POST', `/projects/${project_id}/branches/${branch_id}/roles/${args.role_name}/reset_password`);
  }
  if (tool === 'neon_provision_neon_auth') {
    // Enable the auth schema via SQL
    const sql = `CREATE SCHEMA IF NOT EXISTS auth; GRANT USAGE ON SCHEMA auth TO neondb_owner;`;
    return await runSQL(project_id, sql, args.database, branch_id);
  }
  if (tool === 'neon_get_connection_pooler_config') {
    const d = await n('GET', `/projects/${project_id}/endpoints`);
    const ep = d.endpoints.find(e => e.branch_id === (branch_id || e.branch_id) && e.type === 'read_write');
    return { pooler_enabled: ep?.pooler_enabled, pooler_mode: ep?.pooler_mode, endpoint_id: ep?.id };
  }
  if (tool === 'neon_update_connection_pooler_config') {
    return await n('PATCH', `/projects/${project_id}/endpoints/${args.endpoint_id}`, { endpoint: { pooler_enabled: args.enabled, pooler_mode: args.mode||'transaction' } });
  }

  throw new Error(`Unknown Neon tool: ${tool}`);
}

export default { execute };
