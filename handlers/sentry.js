/**
 * Sentry Handler — 63 tools
 * Error monitoring, issue management, releases, performance,
 * teams, alerts, monitors, source maps, and Super Tools
 * for YardSync and Cortiware production apps.
 */

const BASE = 'https://sentry.io/api/0';

function headers() {
  const token = process.env.SENTRY_AUTH_TOKEN;
  if (!token) throw new Error('SENTRY_AUTH_TOKEN not set in .env');
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const ORG = () => {
  const s = process.env.SENTRY_ORG_SLUG;
  if (!s) throw new Error('SENTRY_ORG_SLUG not set in .env');
  return s;
};
const PROJ = (p) => p || process.env.SENTRY_PROJECT_SLUG;
const reqProj = (p) => { const s = PROJ(p); if (!s) throw new Error('project_slug is required or set SENTRY_PROJECT_SLUG in .env'); return s; };

async function sentry(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: headers(),
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return { success: true };
  const data = await res.json();
  if (!res.ok) throw new Error(`Sentry ${res.status}: ${data.detail || JSON.stringify(data)}`);
  return data;
}

async function execute(tool, args) {
  const { project_slug } = args;

  // ── ISSUES ────────────────────────────────────────────────────────────────
  if (tool === 'sentry_list_issues') {
    const { limit = 25, query = 'is:unresolved', sort = 'date', environment, cursor } = args;
    let path = `/organizations/${ORG()}/issues/?limit=${limit}&query=${encodeURIComponent(query)}&sort=${sort}`;
    if (PROJ(project_slug)) path += `&project=${PROJ(project_slug)}`;
    if (environment) path += `&environment=${environment}`;
    if (cursor) path += `&cursor=${cursor}`;
    const data = await sentry('GET', path);
    return (data.map ? data : []).map(i => ({
      id: i.id, title: i.title, culprit: i.culprit, status: i.status,
      count: i.count, userCount: i.userCount, firstSeen: i.firstSeen,
      lastSeen: i.lastSeen, level: i.level, project: i.project?.slug
    }));
  }
  if (tool === 'sentry_get_issue') {
    return await sentry('GET', `/organizations/${ORG()}/issues/${args.issue_id}/`);
  }
  if (tool === 'sentry_update_issue') {
    const { issue_id, status, assignedTo, hasSeen } = args;
    const body = {};
    if (status) body.status = status;
    if (assignedTo !== undefined) body.assignedTo = assignedTo;
    if (hasSeen !== undefined) body.hasSeen = hasSeen;
    return await sentry('PUT', `/organizations/${ORG()}/issues/${issue_id}/`, body);
  }
  if (tool === 'sentry_resolve_issue') {
    return await sentry('PUT', `/organizations/${ORG()}/issues/${args.issue_id}/`, { status: 'resolved' });
  }
  if (tool === 'sentry_ignore_issue') {
    return await sentry('PUT', `/organizations/${ORG()}/issues/${args.issue_id}/`, { status: 'ignored' });
  }
  if (tool === 'sentry_delete_issue') {
    return await sentry('DELETE', `/organizations/${ORG()}/issues/${args.issue_id}/`);
  }
  if (tool === 'sentry_list_issue_events') {
    return await sentry('GET', `/organizations/${ORG()}/issues/${args.issue_id}/events/?limit=${args.limit || 5}`);
  }
  if (tool === 'sentry_get_latest_event') {
    return await sentry('GET', `/organizations/${ORG()}/issues/${args.issue_id}/events/latest/`);
  }

  // Bulk update multiple issues at once
  if (tool === 'sentry_bulk_update_issues') {
    const { issue_ids, status, assignedTo } = args;
    if (!issue_ids?.length) throw new Error('issue_ids array is required');
    const body = {};
    if (status) body.status = status;
    if (assignedTo !== undefined) body.assignedTo = assignedTo;
    const query = issue_ids.map(id => `id=${id}`).join('&');
    return await sentry('PUT', `/organizations/${ORG()}/issues/?${query}`, body);
  }

  // Assign an issue to a team member
  if (tool === 'sentry_assign_issue') {
    return await sentry('PUT', `/organizations/${ORG()}/issues/${args.issue_id}/`, { assignedTo: args.username });
  }

  // List tags attached to an issue
  if (tool === 'sentry_list_issue_tags') {
    return await sentry('GET', `/organizations/${ORG()}/issues/${args.issue_id}/tags/`);
  }

  // Get values for a specific tag on an issue (e.g. all user emails affected)
  if (tool === 'sentry_get_issue_tag_values') {
    return await sentry('GET', `/organizations/${ORG()}/issues/${args.issue_id}/tags/${args.tag_key}/values/?limit=${args.limit || 20}`);
  }

  // Get event hashes (for deduplication)
  if (tool === 'sentry_get_issue_hashes') {
    return await sentry('GET', `/organizations/${ORG()}/issues/${args.issue_id}/hashes/?limit=${args.limit || 10}`);
  }

  // Merge multiple issues into one
  if (tool === 'sentry_merge_issues') {
    const { parent_issue_id, child_issue_ids } = args;
    if (!parent_issue_id || !child_issue_ids?.length) throw new Error('parent_issue_id and child_issue_ids are required');
    const ids = [parent_issue_id, ...child_issue_ids];
    const query = ids.map(id => `id=${id}`).join('&');
    return await sentry('PUT', `/organizations/${ORG()}/issues/?${query}`, { merge: 1 });
  }

  // ── EVENTS ────────────────────────────────────────────────────────────────
  if (tool === 'sentry_list_project_events') {
    const proj = reqProj(project_slug);
    return await sentry('GET', `/projects/${ORG()}/${proj}/events/?limit=${args.limit || 10}&query=${encodeURIComponent(args.query || '')}`);
  }
  if (tool === 'sentry_get_event') {
    const proj = reqProj(project_slug);
    return await sentry('GET', `/projects/${ORG()}/${proj}/events/${args.event_id}/`);
  }

  // ── PROJECTS ──────────────────────────────────────────────────────────────
  if (tool === 'sentry_list_projects') {
    return await sentry('GET', `/organizations/${ORG()}/projects/`);
  }
  if (tool === 'sentry_get_project') {
    return await sentry('GET', `/projects/${ORG()}/${reqProj(project_slug)}/`);
  }
  if (tool === 'sentry_create_project') {
    const { name, team_slug, platform } = args;
    if (!name || !team_slug) throw new Error('name and team_slug are required');
    return await sentry('POST', `/teams/${ORG()}/${team_slug}/projects/`, { name, platform: platform || 'other' });
  }
  if (tool === 'sentry_update_project') {
    const { name, platform, resolve_age, default_environment } = args;
    const body = {};
    if (name) body.name = name;
    if (platform) body.platform = platform;
    if (resolve_age !== undefined) body.resolveAge = resolve_age;
    if (default_environment) body.defaultEnvironment = default_environment;
    return await sentry('PUT', `/projects/${ORG()}/${reqProj(project_slug)}/`, body);
  }
  if (tool === 'sentry_delete_project') {
    return await sentry('DELETE', `/projects/${ORG()}/${reqProj(project_slug)}/`);
  }
  if (tool === 'sentry_get_project_stats') {
    const proj = reqProj(project_slug);
    const since = args.since || Math.floor(Date.now()/1000) - 86400;
    const until = args.until || Math.floor(Date.now()/1000);
    return await sentry('GET', `/projects/${ORG()}/${proj}/stats/?stat=${args.stat || 'received'}&since=${since}&until=${until}`);
  }
  if (tool === 'sentry_list_project_keys') {
    return await sentry('GET', `/projects/${ORG()}/${reqProj(project_slug)}/keys/`);
  }
  if (tool === 'sentry_create_project_key') {
    return await sentry('POST', `/projects/${ORG()}/${reqProj(project_slug)}/keys/`, { name: args.name || 'New Key' });
  }
  if (tool === 'sentry_delete_project_key') {
    return await sentry('DELETE', `/projects/${ORG()}/${reqProj(project_slug)}/keys/${args.key_id}/`);
  }

  // ── TEAMS ─────────────────────────────────────────────────────────────────
  if (tool === 'sentry_list_teams') {
    return await sentry('GET', `/organizations/${ORG()}/teams/`);
  }
  if (tool === 'sentry_get_team') {
    return await sentry('GET', `/teams/${ORG()}/${args.team_slug}/`);
  }
  if (tool === 'sentry_create_team') {
    if (!args.name) throw new Error('name is required');
    return await sentry('POST', `/organizations/${ORG()}/teams/`, { name: args.name, slug: args.slug });
  }
  if (tool === 'sentry_update_team') {
    const { team_slug, name } = args;
    return await sentry('PUT', `/teams/${ORG()}/${team_slug}/`, { name });
  }
  if (tool === 'sentry_delete_team') {
    return await sentry('DELETE', `/teams/${ORG()}/${args.team_slug}/`);
  }
  if (tool === 'sentry_list_team_members') {
    return await sentry('GET', `/teams/${ORG()}/${args.team_slug}/members/`);
  }

  // ── ORGANIZATION MEMBERS ──────────────────────────────────────────────────
  if (tool === 'sentry_list_members') {
    return await sentry('GET', `/organizations/${ORG()}/members/?limit=${args.limit || 50}`);
  }
  if (tool === 'sentry_get_member') {
    return await sentry('GET', `/organizations/${ORG()}/members/${args.member_id}/`);
  }

  // ── RELEASES ──────────────────────────────────────────────────────────────
  if (tool === 'sentry_list_releases') {
    let path = `/organizations/${ORG()}/releases/?limit=${args.limit || 10}`;
    if (PROJ(project_slug)) path += `&project=${PROJ(project_slug)}`;
    return await sentry('GET', path);
  }
  if (tool === 'sentry_get_release') {
    return await sentry('GET', `/organizations/${ORG()}/releases/${args.version}/`);
  }
  if (tool === 'sentry_create_release') {
    const { version, refs, projects, url, date_released } = args;
    if (!version) throw new Error('version is required');
    const body = { version, projects: projects || [reqProj(project_slug)] };
    if (refs) body.refs = refs;
    if (url) body.url = url;
    if (date_released) body.dateReleased = date_released;
    return await sentry('POST', `/organizations/${ORG()}/releases/`, body);
  }
  if (tool === 'sentry_finalize_release') {
    return await sentry('PUT', `/organizations/${ORG()}/releases/${args.version}/`, {
      projects: [reqProj(project_slug)], dateReleased: new Date().toISOString()
    });
  }
  if (tool === 'sentry_delete_release') {
    return await sentry('DELETE', `/organizations/${ORG()}/releases/${args.version}/`);
  }
  if (tool === 'sentry_list_release_commits') {
    return await sentry('GET', `/organizations/${ORG()}/releases/${args.version}/commitfiles/`);
  }
  if (tool === 'sentry_list_release_deploys') {
    return await sentry('GET', `/organizations/${ORG()}/releases/${args.version}/deploys/`);
  }
  if (tool === 'sentry_create_release_deploy') {
    const { version, environment, url, name, started_at, finished_at } = args;
    if (!version || !environment) throw new Error('version and environment are required');
    const body = { environment };
    if (url) body.url = url;
    if (name) body.name = name;
    if (started_at) body.dateStarted = started_at;
    if (finished_at) body.dateFinished = finished_at || new Date().toISOString();
    return await sentry('POST', `/organizations/${ORG()}/releases/${version}/deploys/`, body);
  }

  // ── ALERTS ────────────────────────────────────────────────────────────────
  if (tool === 'sentry_list_alert_rules') {
    return await sentry('GET', `/projects/${ORG()}/${reqProj(project_slug)}/alert-rules/`);
  }
  if (tool === 'sentry_get_alert_rule') {
    return await sentry('GET', `/projects/${ORG()}/${reqProj(project_slug)}/alert-rules/${args.alert_id}/`);
  }
  if (tool === 'sentry_delete_alert_rule') {
    return await sentry('DELETE', `/projects/${ORG()}/${reqProj(project_slug)}/alert-rules/${args.alert_id}/`);
  }
  if (tool === 'sentry_list_issue_alert_rules') {
    return await sentry('GET', `/projects/${ORG()}/${reqProj(project_slug)}/rules/`);
  }

  // ── MONITORS (cron job monitoring) ────────────────────────────────────────
  if (tool === 'sentry_list_monitors') {
    return await sentry('GET', `/organizations/${ORG()}/monitors/?limit=${args.limit || 25}`);
  }
  if (tool === 'sentry_get_monitor') {
    return await sentry('GET', `/organizations/${ORG()}/monitors/${args.monitor_slug}/`);
  }
  if (tool === 'sentry_create_monitor') {
    const { name, slug, schedule, timezone = 'UTC', checkin_margin = 5, max_runtime = 30 } = args;
    if (!name || !schedule) throw new Error('name and schedule are required (schedule: {type, value} e.g. {type: "crontab", value: "0 * * * *"})');
    return await sentry('POST', `/organizations/${ORG()}/monitors/`, {
      name, slug, type: 'cron_job',
      config: { schedule_type: schedule.type || 'crontab', schedule: schedule.value, timezone, checkin_margin, max_runtime }
    });
  }
  if (tool === 'sentry_update_monitor') {
    const { monitor_slug, name, schedule, is_muted } = args;
    const body = {};
    if (name) body.name = name;
    if (is_muted !== undefined) body.isMuted = is_muted;
    if (schedule) body.config = { schedule_type: schedule.type || 'crontab', schedule: schedule.value };
    return await sentry('PUT', `/organizations/${ORG()}/monitors/${monitor_slug}/`, body);
  }
  if (tool === 'sentry_delete_monitor') {
    return await sentry('DELETE', `/organizations/${ORG()}/monitors/${args.monitor_slug}/`);
  }
  if (tool === 'sentry_list_monitor_checkins') {
    return await sentry('GET', `/organizations/${ORG()}/monitors/${args.monitor_slug}/checkins/?limit=${args.limit || 10}`);
  }

  // ── STATS ─────────────────────────────────────────────────────────────────
  if (tool === 'sentry_get_org_stats') {
    const now = new Date();
    const start = args.start || new Date(Date.now() - 86400000).toISOString();
    const end = args.end || now.toISOString();
    return await sentry('GET', `/organizations/${ORG()}/stats_v2/?field=sum(quantity)&groupBy=outcome&category=${args.category || 'error'}&start=${start}&end=${end}`);
  }

  // ── DASHBOARDS ────────────────────────────────────────────────────────────
  if (tool === 'sentry_list_dashboards') {
    return await sentry('GET', `/organizations/${ORG()}/dashboards/?limit=${args.limit || 20}`);
  }
  if (tool === 'sentry_get_dashboard') {
    return await sentry('GET', `/organizations/${ORG()}/dashboards/${args.dashboard_id}/`);
  }

  // ── SOURCE MAPS & DEBUG FILES ─────────────────────────────────────────────
  if (tool === 'sentry_list_debug_files') {
    return await sentry('GET', `/projects/${ORG()}/${reqProj(project_slug)}/files/dsyms/?limit=${args.limit || 10}`);
  }
  if (tool === 'sentry_list_source_map_archives') {
    return await sentry('GET', `/projects/${ORG()}/${reqProj(project_slug)}/artifact-bundles/?limit=${args.limit || 10}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SUPER TOOLS
  // ══════════════════════════════════════════════════════════════════════════

  // SUPER: Triage — top unresolved errors with counts, users affected, last stack frame
  if (tool === 'sentry_triage_errors') {
    const { limit = 20, environment } = args;
    let path = `/organizations/${ORG()}/issues/?limit=${limit}&query=${encodeURIComponent('is:unresolved')}&sort=users`;
    if (PROJ(project_slug)) path += `&project=${PROJ(project_slug)}`;
    if (environment) path += `&environment=${environment}`;
    const issues = await sentry('GET', path);
    return {
      total: Array.isArray(issues) ? issues.length : 0,
      issues: (Array.isArray(issues) ? issues : []).map(i => ({
        id: i.id, title: i.title, level: i.level,
        count: i.count, users_affected: i.userCount,
        first_seen: i.firstSeen, last_seen: i.lastSeen,
        culprit: i.culprit, project: i.project?.slug
      })),
      summary: `${Array.isArray(issues) ? issues.reduce((s,i) => s+(i.userCount||0), 0) : 0} total users affected`
    };
  }

  // SUPER: Production health — error rate, recent issues, org stats
  if (tool === 'sentry_production_health') {
    const [projects, recentIssues, orgStats] = await Promise.all([
      sentry('GET', `/organizations/${ORG()}/projects/`).catch(() => []),
      sentry('GET', `/organizations/${ORG()}/issues/?limit=5&query=${encodeURIComponent('is:unresolved')}&sort=date`).catch(() => []),
      sentry('GET', `/organizations/${ORG()}/stats_v2/?field=sum(quantity)&groupBy=outcome&category=error&start=${new Date(Date.now()-3600000).toISOString()}&end=${new Date().toISOString()}`).catch(() => null)
    ]);
    return {
      projects: Array.isArray(projects) ? projects.length : 0,
      recent_unresolved_issues: (Array.isArray(recentIssues) ? recentIssues : []).map(i => ({ id: i.id, title: i.title, count: i.count, level: i.level, lastSeen: i.lastSeen })),
      error_stats_last_hour: orgStats,
      checked_at: new Date().toISOString()
    };
  }

  // SUPER: Create release + mark deployed in one call (typical CI/CD workflow)
  if (tool === 'sentry_deploy_release') {
    const { version, environment = 'production', refs, projects } = args;
    if (!version || !environment) throw new Error('version and environment are required');
    const proj = reqProj(project_slug);
    const release = await sentry('POST', `/organizations/${ORG()}/releases/`, {
      version, projects: projects || [proj],
      refs: refs || [], dateReleased: new Date().toISOString()
    }).catch(async (e) => {
      // Release may already exist — that's OK, just proceed to deploy
      if (e.message.includes('400')) return { version };
      throw e;
    });
    const deploy = await sentry('POST', `/organizations/${ORG()}/releases/${version}/deploys/`, {
      environment, dateStarted: new Date().toISOString(), dateFinished: new Date().toISOString()
    });
    return { version, environment, release_created: !!release?.id, deploy_id: deploy?.id, deployed_at: new Date().toISOString() };
  }

  throw new Error(`Unknown Sentry tool: ${tool}`);
}

export default { execute };
