/**
 * Linear Handler — 58 tools
 * Issue tracking, projects, cycles, teams, labels, comments,
 * workflow states, roadmaps, and Super Tools for Cortiware/YardSync dev workflow.
 *
 * Uses Linear's GraphQL API (https://api.linear.app/graphql)
 *
 * Requires: LINEAR_API_KEY (from linear.app → Settings → API → Personal API keys)
 */

const ENDPOINT = 'https://api.linear.app/graphql';

function apiKey() {
  const k = process.env.LINEAR_API_KEY;
  if (!k) throw new Error('LINEAR_API_KEY not set in .env (get from linear.app → Settings → API)');
  return k;
}

async function gql(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': apiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  const data = await res.json();
  if (data.errors?.length) throw new Error(`Linear API: ${data.errors.map(e => e.message).join('; ')}`);
  return data.data;
}

// ── Common fragments ─────────────────────────────────────────────────────────
const ISSUE_FIELDS = `
  id identifier title description priority priorityLabel
  state { id name color type }
  assignee { id name email }
  team { id name key }
  project { id name }
  labels { nodes { id name color } }
  cycle { id number name }
  createdAt updatedAt completedAt canceledAt dueDate
  estimate url
`;

const TEAM_FIELDS = `id name key description color`;

async function execute(tool, args) {

  // ── VIEWER / ME ───────────────────────────────────────────────────────────
  if (tool === 'linear_get_viewer') {
    const data = await gql(`{ viewer { id name email displayName organization { id name } } }`);
    return data.viewer;
  }

  // ── TEAMS ─────────────────────────────────────────────────────────────────
  if (tool === 'linear_list_teams') {
    const data = await gql(`{ teams { nodes { ${TEAM_FIELDS} memberCount } } }`);
    return data.teams.nodes;
  }

  if (tool === 'linear_get_team') {
    const { team_id } = args;
    if (!team_id) throw new Error('team_id is required');
    const data = await gql(`query($id:String!){ team(id:$id){ ${TEAM_FIELDS} memberCount } }`, { id: team_id });
    return data.team;
  }

  if (tool === 'linear_get_team_by_key') {
    // Resolve a team by its short key (e.g. "ENG", "WEB")
    const data = await gql(`{ teams { nodes { ${TEAM_FIELDS} } } }`);
    const team = data.teams.nodes.find(t => t.key.toUpperCase() === (args.key || '').toUpperCase());
    if (!team) throw new Error(`No team with key: ${args.key}`);
    return team;
  }

  // ── ISSUES ────────────────────────────────────────────────────────────────
  if (tool === 'linear_list_issues') {
    const { team_id, assignee_id, state_type, priority, label, first = 25, after } = args;
    const filters = [];
    if (team_id) filters.push(`team: { id: { eq: "${team_id}" } }`);
    if (assignee_id) filters.push(`assignee: { id: { eq: "${assignee_id}" } }`);
    if (state_type) filters.push(`state: { type: { eq: ${state_type.toUpperCase()} } }`);
    if (priority !== undefined) filters.push(`priority: { eq: ${priority} }`);
    if (label) filters.push(`labels: { name: { eq: "${label}" } }`);
    const filterStr = filters.length ? `filter: { ${filters.join(', ')} }` : '';
    const paginationStr = after ? `, after: "${after}"` : '';
    const data = await gql(`
      query { issues(${filterStr}, first: ${first}, orderBy: updatedAt ${paginationStr}) {
        nodes { ${ISSUE_FIELDS} }
        pageInfo { hasNextPage endCursor }
      } }
    `);
    return { issues: data.issues.nodes, pageInfo: data.issues.pageInfo };
  }

  if (tool === 'linear_get_issue') {
    const { issue_id } = args;
    if (!issue_id) throw new Error('issue_id is required');
    // issue_id can be UUID or identifier (e.g. "ENG-42")
    if (issue_id.includes('-') && !issue_id.match(/^[0-9a-f-]{36}$/)) {
      // It's an identifier like ENG-42
      const data = await gql(`query($id:String!){ issue(id:$id){ ${ISSUE_FIELDS} } }`, { id: issue_id });
      return data.issue;
    }
    const data = await gql(`query($id:String!){ issue(id:$id){ ${ISSUE_FIELDS} } }`, { id: issue_id });
    return data.issue;
  }

  if (tool === 'linear_search_issues') {
    const { query, team_id, first = 25 } = args;
    if (!query) throw new Error('query is required');
    const teamFilter = team_id ? `, filter: { team: { id: { eq: "${team_id}" } } }` : '';
    const data = await gql(`
      query($q:String!) { issueSearch(query: $q, first: ${first}${teamFilter}) {
        nodes { ${ISSUE_FIELDS} }
      } }
    `, { q: query });
    return data.issueSearch.nodes;
  }

  if (tool === 'linear_create_issue') {
    const { title, description, team_id, assignee_id, state_id, priority, label_ids, project_id, cycle_id, estimate, due_date } = args;
    if (!title || !team_id) throw new Error('title and team_id are required');
    const input = { title, teamId: team_id };
    if (description) input.description = description;
    if (assignee_id) input.assigneeId = assignee_id;
    if (state_id) input.stateId = state_id;
    if (priority !== undefined) input.priority = priority; // 0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low
    if (label_ids?.length) input.labelIds = label_ids;
    if (project_id) input.projectId = project_id;
    if (cycle_id) input.cycleId = cycle_id;
    if (estimate !== undefined) input.estimate = estimate;
    if (due_date) input.dueDate = due_date;
    const data = await gql(`
      mutation($input:IssueCreateInput!) {
        issueCreate(input:$input) { success issue { ${ISSUE_FIELDS} } }
      }
    `, { input });
    return data.issueCreate;
  }

  if (tool === 'linear_update_issue') {
    const { issue_id, title, description, state_id, assignee_id, priority, label_ids, project_id, cycle_id, estimate, due_date } = args;
    if (!issue_id) throw new Error('issue_id is required');
    const input = {};
    if (title) input.title = title;
    if (description !== undefined) input.description = description;
    if (state_id) input.stateId = state_id;
    if (assignee_id !== undefined) input.assigneeId = assignee_id;
    if (priority !== undefined) input.priority = priority;
    if (label_ids) input.labelIds = label_ids;
    if (project_id !== undefined) input.projectId = project_id;
    if (cycle_id !== undefined) input.cycleId = cycle_id;
    if (estimate !== undefined) input.estimate = estimate;
    if (due_date !== undefined) input.dueDate = due_date;
    const data = await gql(`
      mutation($id:String!,$input:IssueUpdateInput!) {
        issueUpdate(id:$id, input:$input) { success issue { ${ISSUE_FIELDS} } }
      }
    `, { id: issue_id, input });
    return data.issueUpdate;
  }

  if (tool === 'linear_delete_issue') {
    if (!args.issue_id) throw new Error('issue_id is required');
    const data = await gql(`mutation($id:String!){ issueDelete(id:$id){ success } }`, { id: args.issue_id });
    return data.issueDelete;
  }

  if (tool === 'linear_assign_issue') {
    const { issue_id, assignee_id } = args;
    if (!issue_id) throw new Error('issue_id is required');
    const data = await gql(`
      mutation($id:String!,$input:IssueUpdateInput!) {
        issueUpdate(id:$id, input:$input) { success issue { id identifier title assignee { name } } }
      }
    `, { id: issue_id, input: { assigneeId: assignee_id || null } });
    return data.issueUpdate;
  }

  if (tool === 'linear_move_issue_to_state') {
    const { issue_id, state_id } = args;
    if (!issue_id || !state_id) throw new Error('issue_id and state_id are required');
    const data = await gql(`
      mutation($id:String!,$input:IssueUpdateInput!) {
        issueUpdate(id:$id, input:$input) { success issue { id identifier title state { name } } }
      }
    `, { id: issue_id, input: { stateId: state_id } });
    return data.issueUpdate;
  }

  if (tool === 'linear_set_issue_priority') {
    const { issue_id, priority } = args;
    if (!issue_id || priority === undefined) throw new Error('issue_id and priority (0-4) are required');
    const data = await gql(`
      mutation($id:String!,$input:IssueUpdateInput!) {
        issueUpdate(id:$id, input:$input) { success issue { id identifier title priority priorityLabel } }
      }
    `, { id: issue_id, input: { priority } });
    return data.issueUpdate;
  }

  if (tool === 'linear_add_label_to_issue') {
    const { issue_id, label_id } = args;
    if (!issue_id || !label_id) throw new Error('issue_id and label_id are required');
    // Get current labels then append
    const current = await gql(`query($id:String!){ issue(id:$id){ labels { nodes { id } } } }`, { id: issue_id });
    const existingIds = current.issue.labels.nodes.map(l => l.id);
    if (!existingIds.includes(label_id)) existingIds.push(label_id);
    const data = await gql(`
      mutation($id:String!,$input:IssueUpdateInput!) {
        issueUpdate(id:$id, input:$input) { success issue { id identifier labels { nodes { name } } } }
      }
    `, { id: issue_id, input: { labelIds: existingIds } });
    return data.issueUpdate;
  }

  if (tool === 'linear_archive_issue') {
    if (!args.issue_id) throw new Error('issue_id is required');
    const data = await gql(`mutation($id:String!){ issueArchive(id:$id){ success } }`, { id: args.issue_id });
    return data.issueArchive;
  }

  // ── MY ISSUES ─────────────────────────────────────────────────────────────
  if (tool === 'linear_my_issues') {
    const { state_type = 'started', first = 25 } = args;
    const data = await gql(`
      { viewer { assignedIssues(
        filter: { state: { type: { in: [${state_type === 'all' ? 'triage, backlog, unstarted, started' : state_type.toUpperCase()}] } } }
        first: ${first}, orderBy: updatedAt
      ) { nodes { ${ISSUE_FIELDS} } } } }
    `);
    return data.viewer.assignedIssues.nodes;
  }

  // ── COMMENTS ──────────────────────────────────────────────────────────────
  if (tool === 'linear_list_comments') {
    const { issue_id } = args;
    if (!issue_id) throw new Error('issue_id is required');
    const data = await gql(`
      query($id:String!) { issue(id:$id) { comments { nodes { id body createdAt user { name } } } } }
    `, { id: issue_id });
    return data.issue.comments.nodes;
  }

  if (tool === 'linear_create_comment') {
    const { issue_id, body } = args;
    if (!issue_id || !body) throw new Error('issue_id and body are required');
    const data = await gql(`
      mutation($input:CommentCreateInput!) {
        commentCreate(input:$input) { success comment { id body createdAt user { name } } }
      }
    `, { input: { issueId: issue_id, body } });
    return data.commentCreate;
  }

  if (tool === 'linear_update_comment') {
    const { comment_id, body } = args;
    if (!comment_id || !body) throw new Error('comment_id and body are required');
    const data = await gql(`
      mutation($id:String!,$input:CommentUpdateInput!) {
        commentUpdate(id:$id, input:$input) { success comment { id body } }
      }
    `, { id: comment_id, input: { body } });
    return data.commentUpdate;
  }

  if (tool === 'linear_delete_comment') {
    if (!args.comment_id) throw new Error('comment_id is required');
    const data = await gql(`mutation($id:String!){ commentDelete(id:$id){ success } }`, { id: args.comment_id });
    return data.commentDelete;
  }

  // ── WORKFLOW STATES ───────────────────────────────────────────────────────
  if (tool === 'linear_list_workflow_states') {
    const { team_id } = args;
    const filter = team_id ? `, filter: { team: { id: { eq: "${team_id}" } } }` : '';
    const data = await gql(`{ workflowStates(${filter}) { nodes { id name type color position team { key } } } }`);
    return data.workflowStates.nodes.sort((a, b) => a.position - b.position);
  }

  // ── LABELS ────────────────────────────────────────────────────────────────
  if (tool === 'linear_list_labels') {
    const { team_id } = args;
    const filter = team_id ? `, filter: { team: { id: { eq: "${team_id}" } } }` : '';
    const data = await gql(`{ issueLabels(${filter}) { nodes { id name color } } }`);
    return data.issueLabels.nodes;
  }

  if (tool === 'linear_create_label') {
    const { name, color, team_id } = args;
    if (!name || !team_id) throw new Error('name and team_id are required');
    const data = await gql(`
      mutation($input:IssueLabelCreateInput!) {
        issueLabelCreate(input:$input) { success issueLabel { id name color } }
      }
    `, { input: { name, color: color || '#808080', teamId: team_id } });
    return data.issueLabelCreate;
  }

  // ── PROJECTS ──────────────────────────────────────────────────────────────
  if (tool === 'linear_list_projects') {
    const { team_id, state, first = 50 } = args;
    const filters = [];
    if (team_id) filters.push(`teams: { id: { eq: "${team_id}" } }`);
    if (state) filters.push(`state: { eq: ${state} }`);
    const filterStr = filters.length ? `filter: { ${filters.join(', ')} }` : '';
    const data = await gql(`{ projects(${filterStr}, first: ${first}) { nodes { id name description state slugId targetDate progress startDate completedIssueCountByState { id name count } } } }`);
    return data.projects.nodes;
  }

  if (tool === 'linear_get_project') {
    if (!args.project_id) throw new Error('project_id is required');
    const data = await gql(`query($id:String!){ project(id:$id){ id name description state slugId targetDate progress startDate } }`, { id: args.project_id });
    return data.project;
  }

  if (tool === 'linear_create_project') {
    const { name, description, team_ids, state, target_date, start_date } = args;
    if (!name || !team_ids?.length) throw new Error('name and team_ids are required');
    const input = { name, teamIds: team_ids };
    if (description) input.description = description;
    if (state) input.state = state;
    if (target_date) input.targetDate = target_date;
    if (start_date) input.startDate = start_date;
    const data = await gql(`
      mutation($input:ProjectCreateInput!) {
        projectCreate(input:$input) { success project { id name state } }
      }
    `, { input });
    return data.projectCreate;
  }

  if (tool === 'linear_update_project') {
    const { project_id, name, description, state, target_date, start_date } = args;
    if (!project_id) throw new Error('project_id is required');
    const input = {};
    if (name) input.name = name;
    if (description !== undefined) input.description = description;
    if (state) input.state = state;
    if (target_date !== undefined) input.targetDate = target_date;
    if (start_date !== undefined) input.startDate = start_date;
    const data = await gql(`
      mutation($id:String!,$input:ProjectUpdateInput!) {
        projectUpdate(id:$id, input:$input) { success project { id name state } }
      }
    `, { id: project_id, input });
    return data.projectUpdate;
  }

  // ── CYCLES (Sprints) ──────────────────────────────────────────────────────
  if (tool === 'linear_list_cycles') {
    const { team_id } = args;
    const filter = team_id ? `filter: { team: { id: { eq: "${team_id}" } } }` : '';
    const data = await gql(`{ cycles(${filter}, orderBy: createdAt) { nodes { id number name startsAt endsAt progress completedIssues { totalCount } issues { totalCount } } } }`);
    return data.cycles.nodes;
  }

  if (tool === 'linear_get_active_cycle') {
    const { team_id } = args;
    if (!team_id) throw new Error('team_id is required');
    const data = await gql(`query($id:String!){ team(id:$id){ activeCycle { id number name startsAt endsAt progress issues { totalCount } completedIssues { totalCount } } } }`, { id: team_id });
    return data.team.activeCycle;
  }

  if (tool === 'linear_create_cycle') {
    const { team_id, name, starts_at, ends_at } = args;
    if (!team_id || !starts_at || !ends_at) throw new Error('team_id, starts_at, and ends_at are required');
    const input = { teamId: team_id, startsAt: starts_at, endsAt: ends_at };
    if (name) input.name = name;
    const data = await gql(`
      mutation($input:CycleCreateInput!) {
        cycleCreate(input:$input) { success cycle { id number name startsAt endsAt } }
      }
    `, { input });
    return data.cycleCreate;
  }

  // ── MEMBERS ───────────────────────────────────────────────────────────────
  if (tool === 'linear_list_members') {
    const data = await gql(`{ users(filter: { active: { eq: true } }) { nodes { id name email displayName admin active } } }`);
    return data.users.nodes;
  }

  if (tool === 'linear_get_member') {
    const { user_id, email } = args;
    if (email) {
      const data = await gql(`{ users(filter: { email: { eq: "${email}" } }) { nodes { id name email displayName admin } } }`);
      return data.users.nodes[0] || null;
    }
    if (!user_id) throw new Error('user_id or email is required');
    const data = await gql(`query($id:String!){ user(id:$id){ id name email displayName admin active } }`, { id: user_id });
    return data.user;
  }

  // ── ROADMAP / MILESTONES ──────────────────────────────────────────────────
  if (tool === 'linear_list_roadmaps') {
    const data = await gql(`{ roadmaps { nodes { id name description slugId projects { nodes { id name state targetDate } } } } }`);
    return data.roadmaps.nodes;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SUPER TOOLS
  // ══════════════════════════════════════════════════════════════════════════

  // SUPER: My work today — assigned + in-progress issues across all teams
  if (tool === 'linear_my_work_today') {
    const data = await gql(`
      { viewer {
        name
        assignedIssues(filter: { state: { type: { in: [started, unstarted] } } }, first: 50, orderBy: updatedAt) {
          nodes { ${ISSUE_FIELDS} }
        }
      } }
    `);
    const issues = data.viewer.assignedIssues.nodes;
    const byState = {};
    for (const issue of issues) {
      const stateName = issue.state.name;
      if (!byState[stateName]) byState[stateName] = [];
      byState[stateName].push({ id: issue.id, identifier: issue.identifier, title: issue.title, priority: issue.priorityLabel, team: issue.team.key });
    }
    return { viewer: data.viewer.name, total: issues.length, by_state: byState };
  }

  // SUPER: Team sprint status — active cycle progress + blockers + completions
  if (tool === 'linear_sprint_status') {
    const { team_id } = args;
    if (!team_id) throw new Error('team_id is required');
    const data = await gql(`
      query($id:String!) { team(id:$id) {
        name key
        activeCycle {
          id number name startsAt endsAt progress
          issues(first: 100) { nodes { ${ISSUE_FIELDS} } }
        }
      } }
    `, { id: team_id });
    const cycle = data.team.activeCycle;
    if (!cycle) return { team: data.team.name, message: 'No active cycle' };
    const issues = cycle.issues.nodes;
    return {
      team: data.team.name,
      cycle: { number: cycle.number, name: cycle.name, starts: cycle.startsAt, ends: cycle.endsAt, progress: cycle.progress },
      total_issues: issues.length,
      by_state: issues.reduce((acc, i) => {
        const t = i.state.type;
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {}),
      in_progress: issues.filter(i => i.state.type === 'started').map(i => ({ identifier: i.identifier, title: i.title, assignee: i.assignee?.name })),
      unstarted: issues.filter(i => i.state.type === 'unstarted').map(i => ({ identifier: i.identifier, title: i.title, priority: i.priorityLabel, assignee: i.assignee?.name })),
      completed: issues.filter(i => i.state.type === 'completed').length,
      urgent_issues: issues.filter(i => i.priority === 1).map(i => ({ identifier: i.identifier, title: i.title, state: i.state.name }))
    };
  }

  // SUPER: Create issue and immediately link it to GitHub commit (via comment)
  if (tool === 'linear_create_issue_for_commit') {
    const { title, description, team_id, commit_sha, repo, priority = 3, label_ids } = args;
    if (!title || !team_id) throw new Error('title and team_id are required');
    const fullDescription = [description, commit_sha && repo ? `\n\n**Commit:** [${commit_sha.slice(0, 7)}](https://github.com/${repo}/commit/${commit_sha})` : ''].filter(Boolean).join('');
    const input = { title, teamId: team_id, description: fullDescription, priority };
    if (label_ids?.length) input.labelIds = label_ids;
    const data = await gql(`
      mutation($input:IssueCreateInput!) {
        issueCreate(input:$input) { success issue { id identifier title url } }
      }
    `, { input });
    return data.issueCreate;
  }

  // SUPER: Project health — progress, overdue issues, unassigned issues
  if (tool === 'linear_project_health') {
    const { project_id } = args;
    if (!project_id) throw new Error('project_id is required');
    const data = await gql(`
      query($id:String!) { project(id:$id) {
        id name state progress targetDate
        issues(first: 200) { nodes { ${ISSUE_FIELDS} } }
      } }
    `, { id: project_id });
    const issues = data.project.issues.nodes;
    const now = new Date();
    const overdue = issues.filter(i => i.dueDate && new Date(i.dueDate) < now && i.state.type !== 'completed' && i.state.type !== 'cancelled');
    const unassigned = issues.filter(i => !i.assignee && i.state.type !== 'completed' && i.state.type !== 'cancelled');
    return {
      project: data.project.name,
      state: data.project.state,
      progress: Math.round(data.project.progress * 100) + '%',
      target_date: data.project.targetDate,
      total_issues: issues.length,
      completed: issues.filter(i => i.state.type === 'completed').length,
      in_progress: issues.filter(i => i.state.type === 'started').length,
      overdue: overdue.map(i => ({ identifier: i.identifier, title: i.title, due: i.dueDate, assignee: i.assignee?.name })),
      unassigned: unassigned.map(i => ({ identifier: i.identifier, title: i.title, priority: i.priorityLabel })),
      urgent_open: issues.filter(i => i.priority === 1 && i.state.type !== 'completed').map(i => ({ identifier: i.identifier, title: i.title }))
    };
  }

  // SUPER: Triage — list all un-triaged/high-priority issues across all teams
  if (tool === 'linear_triage_queue') {
    const data = await gql(`
      { issues(filter: { state: { type: { in: [triage, unstarted] } } priority: { lte: 2 } }, first: 50, orderBy: priority) {
        nodes { ${ISSUE_FIELDS} }
      } }
    `);
    return {
      total: data.issues.nodes.length,
      issues: data.issues.nodes.map(i => ({
        identifier: i.identifier,
        title: i.title,
        priority: i.priorityLabel,
        team: i.team.key,
        state: i.state.name,
        created: i.createdAt
      }))
    };
  }

  throw new Error(`Unknown Linear tool: ${tool}`);

  // ── WEBHOOKS ──────────────────────────────────────────────────────────────
  if (tool === 'linear_list_webhooks') {
    const data = await gql(`{ webhooks { nodes { id url enabled label resourceTypes createdAt } } }`);
    return data.webhooks.nodes;
  }
  if (tool === 'linear_create_webhook') {
    const { url, resource_types, team_id, label, enabled = true } = args;
    if (!url || !resource_types) throw new Error('url and resource_types array are required');
    const data = await gql(`mutation CreateWebhook($input: WebhookCreateInput!) { webhookCreate(input: $input) { success webhook { id url enabled } } }`, {
      input: { url, resourceTypes: resource_types, teamId: team_id, label, enabled }
    });
    return data.webhookCreate.webhook;
  }
  if (tool === 'linear_update_webhook') {
    const { webhook_id, url, enabled, resource_types } = args;
    if (!webhook_id) throw new Error('webhook_id is required');
    const input = {};
    if (url !== undefined) input.url = url;
    if (enabled !== undefined) input.enabled = enabled;
    if (resource_types) input.resourceTypes = resource_types;
    const data = await gql(`mutation UpdateWebhook($id: String!, $input: WebhookUpdateInput!) { webhookUpdate(id: $id, input: $input) { success webhook { id url enabled } } }`, { id: webhook_id, input });
    return data.webhookUpdate.webhook;
  }
  if (tool === 'linear_delete_webhook') {
    const data = await gql(`mutation DeleteWebhook($id: String!) { webhookDelete(id: $id) { success } }`, { id: args.webhook_id });
    return data.webhookDelete;
  }

  // ── TEAM MANAGEMENT ───────────────────────────────────────────────────────
  if (tool === 'linear_create_team') {
    const { name, key, description, color, timezone } = args;
    if (!name || !key) throw new Error('name and key are required');
    const input = { name, key };
    if (description) input.description = description;
    if (color) input.color = color;
    if (timezone) input.timezone = timezone;
    const data = await gql(`mutation CreateTeam($input: TeamCreateInput!) { teamCreate(input: $input) { success team { id name key } } }`, { input });
    return data.teamCreate.team;
  }
  if (tool === 'linear_update_team') {
    const { team_id, name, description, color, timezone, issue_estimation_type } = args;
    if (!team_id) throw new Error('team_id is required');
    const input = {};
    if (name) input.name = name;
    if (description) input.description = description;
    if (color) input.color = color;
    if (timezone) input.timezone = timezone;
    if (issue_estimation_type) input.issueEstimationType = issue_estimation_type;
    const data = await gql(`mutation UpdateTeam($id: String!, $input: TeamUpdateInput!) { teamUpdate(id: $id, input: $input) { success team { id name } } }`, { id: team_id, input });
    return data.teamUpdate.team;
  }
  if (tool === 'linear_delete_team') {
    const data = await gql(`mutation DeleteTeam($id: String!) { teamDelete(id: $id) { success } }`, { id: args.team_id });
    return data.teamDelete;
  }
  if (tool === 'linear_list_team_memberships') {
    const { team_id } = args;
    if (!team_id) throw new Error('team_id is required');
    const data = await gql(`query TeamMemberships($id: String!) { team(id: $id) { members { nodes { id name email displayName } } } }`, { id: team_id });
    return data.team.members.nodes;
  }
  if (tool === 'linear_add_team_member') {
    const { team_id, user_id } = args;
    if (!team_id || !user_id) throw new Error('team_id and user_id are required');
    const data = await gql(`mutation AddMember($input: TeamMembershipCreateInput!) { teamMembershipCreate(input: $input) { success teamMembership { id } } }`, { input: { teamId: team_id, userId: user_id } });
    return data.teamMembershipCreate;
  }
  if (tool === 'linear_remove_team_member') {
    const data = await gql(`mutation RemoveMember($id: String!) { teamMembershipDelete(id: $id) { success } }`, { id: args.membership_id });
    return data.teamMembershipDelete;
  }

  // ── WORKFLOW STATES ───────────────────────────────────────────────────────
  if (tool === 'linear_create_workflow_state') {
    const { team_id, name, type, color, description } = args;
    if (!team_id || !name || !type) throw new Error('team_id, name, and type are required');
    const input = { teamId: team_id, name, type };
    if (color) input.color = color;
    if (description) input.description = description;
    const data = await gql(`mutation CreateState($input: WorkflowStateCreateInput!) { workflowStateCreate(input: $input) { success state { id name type } } }`, { input });
    return data.workflowStateCreate.state;
  }
  if (tool === 'linear_update_workflow_state') {
    const { state_id, name, color, description } = args;
    if (!state_id) throw new Error('state_id is required');
    const input = {};
    if (name) input.name = name;
    if (color) input.color = color;
    if (description) input.description = description;
    const data = await gql(`mutation UpdateState($id: String!, $input: WorkflowStateUpdateInput!) { workflowStateUpdate(id: $id, input: $input) { success state { id name } } }`, { id: state_id, input });
    return data.workflowStateUpdate.state;
  }

  // ── TEMPLATES ─────────────────────────────────────────────────────────────
  if (tool === 'linear_list_templates') {
    const { team_id } = args;
    const filter = team_id ? `(filter: { team: { id: { eq: "${team_id}" } } })` : '';
    const data = await gql(`{ templates${filter} { nodes { id name description type } } }`);
    return data.templates.nodes;
  }
  if (tool === 'linear_get_template') {
    const data = await gql(`query GetTemplate($id: String!) { template(id: $id) { id name description type templateData } }`, { id: args.template_id });
    return data.template;
  }

  // ── ROADMAPS ──────────────────────────────────────────────────────────────
  if (tool === 'linear_create_roadmap') {
    const { name, description, owner_id, color } = args;
    if (!name) throw new Error('name is required');
    const input = { name };
    if (description) input.description = description;
    if (owner_id) input.ownerId = owner_id;
    if (color) input.color = color;
    const data = await gql(`mutation CreateRoadmap($input: RoadmapCreateInput!) { roadmapCreate(input: $input) { success roadmap { id name } } }`, { input });
    return data.roadmapCreate.roadmap;
  }
  if (tool === 'linear_update_roadmap') {
    const { roadmap_id, name, description, color } = args;
    if (!roadmap_id) throw new Error('roadmap_id is required');
    const input = {};
    if (name) input.name = name;
    if (description) input.description = description;
    if (color) input.color = color;
    const data = await gql(`mutation UpdateRoadmap($id: String!, $input: RoadmapUpdateInput!) { roadmapUpdate(id: $id, input: $input) { success roadmap { id name } } }`, { id: roadmap_id, input });
    return data.roadmapUpdate.roadmap;
  }

  // ── INITIATIVES (formerly Roadmap items) ──────────────────────────────────
  if (tool === 'linear_list_initiatives') {
    const data = await gql(`{ initiatives { nodes { id name description color targetDate status } } }`);
    return data.initiatives.nodes;
  }
  if (tool === 'linear_create_initiative') {
    const { name, description, target_date, owner_id } = args;
    if (!name) throw new Error('name is required');
    const input = { name };
    if (description) input.description = description;
    if (target_date) input.targetDate = target_date;
    if (owner_id) input.ownerId = owner_id;
    const data = await gql(`mutation CreateInitiative($input: InitiativeCreateInput!) { initiativeCreate(input: $input) { success initiative { id name } } }`, { input });
    return data.initiativeCreate.initiative;
  }

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
  if (tool === 'linear_list_notifications') {
    const data = await gql(`{ notifications(first: ${args.limit || 20}) { nodes { id type read createdAt updatedAt } } }`);
    return data.notifications.nodes;
  }
  if (tool === 'linear_mark_notification_read') {
    const data = await gql(`mutation MarkRead($id: String!) { notificationMarkAsRead(input: { ids: [$id] }) { success } }`, { id: args.notification_id });
    return data.notificationMarkAsRead;
  }

  // ── AUDIT LOG ─────────────────────────────────────────────────────────────
  if (tool === 'linear_list_audit_entries') {
    const data = await gql(`{ auditEntries(first: ${args.limit || 50}) { nodes { id type actorName createdAt metadata } } }`);
    return data.auditEntries.nodes;
  }

  // ── ISSUE RELATIONS ───────────────────────────────────────────────────────
  if (tool === 'linear_create_issue_relation') {
    const { issue_id, related_issue_id, type = 'related' } = args;
    if (!issue_id || !related_issue_id) throw new Error('issue_id and related_issue_id are required');
    const data = await gql(`mutation CreateRelation($input: IssueRelationCreateInput!) { issueRelationCreate(input: $input) { success issueRelation { id type } } }`, { input: { issueId: issue_id, relatedIssueId: related_issue_id, type } });
    return data.issueRelationCreate.issueRelation;
  }
  if (tool === 'linear_delete_issue_relation') {
    const data = await gql(`mutation DeleteRelation($id: String!) { issueRelationDelete(id: $id) { success } }`, { id: args.relation_id });
    return data.issueRelationDelete;
  }

  // ── ATTACHMENTS ───────────────────────────────────────────────────────────
  if (tool === 'linear_create_attachment') {
    const { issue_id, title, url, subtitle, icon_url } = args;
    if (!issue_id || !title || !url) throw new Error('issue_id, title, and url are required');
    const input = { issueId: issue_id, title, url };
    if (subtitle) input.subtitle = subtitle;
    if (icon_url) input.iconUrl = icon_url;
    const data = await gql(`mutation CreateAttachment($input: AttachmentCreateInput!) { attachmentCreate(input: $input) { success attachment { id title url } } }`, { input });
    return data.attachmentCreate.attachment;
  }
  if (tool === 'linear_list_attachments') {
    const { issue_id } = args;
    if (!issue_id) throw new Error('issue_id is required');
    const data = await gql(`query IssueAttachments($id: String!) { issue(id: $id) { attachments { nodes { id title url subtitle } } } }`, { id: issue_id });
    return data.issue.attachments.nodes;
  }

  // ── SUPER TOOL: Team health dashboard ────────────────────────────────────
  if (tool === 'linear_team_health_dashboard') {
    const { team_id } = args;
    if (!team_id) throw new Error('team_id is required');
    const data = await gql(`query TeamHealth($id: String!) {
      team(id: $id) {
        name
        members { nodes { id name } }
        issues(filter: { state: { type: { nin: ["completed","canceled"] } } }, first: 100) {
          nodes { id identifier priority state { name type } assignee { name } dueDate }
        }
        cycles(filter: { isActive: { eq: true } }, first: 1) {
          nodes { id number name startsAt endsAt
            progress
            issues { nodes { id state { type } } }
          }
        }
      }
    }`, { id: team_id });
    const team = data.team;
    const issues = team.issues.nodes;
    const activeCycle = team.cycles.nodes[0] || null;
    return {
      team: team.name,
      member_count: team.members.nodes.length,
      open_issues: issues.length,
      by_priority: { urgent: issues.filter(i => i.priority === 1).length, high: issues.filter(i => i.priority === 2).length, medium: issues.filter(i => i.priority === 3).length, low: issues.filter(i => i.priority === 4).length },
      unassigned: issues.filter(i => !i.assignee).length,
      overdue: issues.filter(i => i.dueDate && new Date(i.dueDate) < new Date()).length,
      active_cycle: activeCycle ? { name: activeCycle.name, progress: activeCycle.progress, ends: activeCycle.endsAt } : null,
      generated_at: new Date().toISOString()
    };
  }

  throw new Error(`Unknown Linear tool: ${tool}`);
}

export default { execute };
