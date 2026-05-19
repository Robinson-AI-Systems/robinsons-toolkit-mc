/**
 * Sentry Handler — 20 tools (NEW)
 * Error monitoring, issue management, releases, performance,
 * and alerts for YardSync and Cortiware production apps.
 */

const BASE = 'https://sentry.io/api/0';

function headers() {
  const token = process.env.SENTRY_AUTH_TOKEN;
  if (!token) throw new Error('SENTRY_AUTH_TOKEN not set in .env');
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const ORG = () => process.env.SENTRY_ORG_SLUG || (() => { throw new Error('SENTRY_ORG_SLUG not set in .env'); })();
const PROJ = (p) => p || process.env.SENTRY_PROJECT_SLUG;

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
    const { limit = 25, query = 'is:unresolved', sort = 'date', environment } = args;
    let path = `/organizations/${ORG()}/issues/?limit=${limit}&query=${encodeURIComponent(query)}&sort=${sort}`;
    if (PROJ(project_slug)) path += `&project=${PROJ(project_slug)}`;
    if (environment) path += `&environment=${environment}`;
    const data = await sentry('GET', path);
    return data.map ? data.map(i => ({ id: i.id, title: i.title, culprit: i.culprit, status: i.status, count: i.count, userCount: i.userCount, firstSeen: i.firstSeen, lastSeen: i.lastSeen, level: i.level })) : data;
  }
  if (tool === 'sentry_get_issue') { return await sentry('GET', `/organizations/${ORG()}/issues/${args.issue_id}/`); }
  if (tool === 'sentry_update_issue') {
    const { issue_id, status, assignedTo, hasSeen } = args;
    const body = {};
    if (status) body.status = status;
    if (assignedTo !== undefined) body.assignedTo = assignedTo;
    if (hasSeen !== undefined) body.hasSeen = hasSeen;
    return await sentry('PUT', `/organizations/${ORG()}/issues/${issue_id}/`, body);
  }
  if (tool === 'sentry_resolve_issue') { return await sentry('PUT', `/organizations/${ORG()}/issues/${args.issue_id}/`, { status: 'resolved' }); }
  if (tool === 'sentry_ignore_issue') { return await sentry('PUT', `/organizations/${ORG()}/issues/${args.issue_id}/`, { status: 'ignored' }); }
  if (tool === 'sentry_delete_issue') { return await sentry('DELETE', `/organizations/${ORG()}/issues/${args.issue_id}/`); }
  if (tool === 'sentry_list_issue_events') {
    return await sentry('GET', `/organizations/${ORG()}/issues/${args.issue_id}/events/?limit=${args.limit || 5}`);
  }
  if (tool === 'sentry_get_latest_event') { return await sentry('GET', `/organizations/${ORG()}/issues/${args.issue_id}/events/latest/`); }

  // ── EVENTS ────────────────────────────────────────────────────────────────
  if (tool === 'sentry_list_project_events') {
    const proj = PROJ(project_slug);
    if (!proj) throw new Error('project_slug is required or set SENTRY_PROJECT_SLUG in .env');
    return await sentry('GET', `/projects/${ORG()}/${proj}/events/?limit=${args.limit || 10}&query=${encodeURIComponent(args.query || '')}`);
  }

  // ── PROJECTS ──────────────────────────────────────────────────────────────
  if (tool === 'sentry_list_projects') { return await sentry('GET', `/organizations/${ORG()}/projects/`); }
  if (tool === 'sentry_get_project') { return await sentry('GET', `/projects/${ORG()}/${PROJ(project_slug)}/`); }
  if (tool === 'sentry_get_project_stats') {
    const proj = PROJ(project_slug);
    return await sentry('GET', `/projects/${ORG()}/${proj}/stats/?stat=${args.stat || 'received'}&since=${args.since || Math.floor(Date.now()/1000) - 86400}&until=${args.until || Math.floor(Date.now()/1000)}`);
  }

  // ── RELEASES ──────────────────────────────────────────────────────────────
  if (tool === 'sentry_list_releases') {
    return await sentry('GET', `/organizations/${ORG()}/releases/?limit=${args.limit || 10}&project=${PROJ(project_slug) || ''}`);
  }
  if (tool === 'sentry_create_release') {
    const { version, refs, projects, url, date_released } = args;
    if (!version) throw new Error('version is required (e.g. "1.0.0" or git SHA)');
    const body = { version, projects: projects || [PROJ(project_slug)] };
    if (refs) body.refs = refs; if (url) body.url = url; if (date_released) body.dateReleased = date_released;
    return await sentry('POST', `/organizations/${ORG()}/releases/`, body);
  }
  if (tool === 'sentry_finalize_release') {
    return await sentry('PUT', `/organizations/${ORG()}/releases/${args.version}/`, { projects: [PROJ(project_slug)] });
  }

  // ── ALERTS ────────────────────────────────────────────────────────────────
  if (tool === 'sentry_list_alert_rules') {
    return await sentry('GET', `/projects/${ORG()}/${PROJ(project_slug)}/alert-rules/`);
  }
  if (tool === 'sentry_get_org_stats') {
    return await sentry('GET', `/organizations/${ORG()}/stats_v2/?field=sum(quantity)&groupBy=outcome&category=${args.category || 'error'}&start=${args.start || new Date(Date.now()-86400000).toISOString()}&end=${args.end || new Date().toISOString()}`);
  }

  throw new Error(`Unknown Sentry tool: ${tool}`);
}

export default { execute };
