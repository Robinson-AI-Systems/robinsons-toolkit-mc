/**
 * GitHub Handler — 256 tools
 * Full GitHub REST API coverage: repos, branches, commits, PRs, issues,
 * actions, runners, releases, security, teams, orgs, gists, codespaces,
 * reactions, stars, forks, and Super Tools.
 */

const BASE = 'https://api.github.com';
const MAX_BYTES = 100 * 1024;

function headers() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not set in .env');
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };
}

async function gh(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return { success: true };
  const data = await res.json();
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${data.message || JSON.stringify(data)}`);
  const str = JSON.stringify(data);
  if (str.length > MAX_BYTES) throw new Error(`Response too large: ${(str.length/1024).toFixed(1)}KB. Add filters or pagination.`);
  return data;
}

// Minimal mappers to reduce response size
const minRepo = r => ({ id:r.id, name:r.name, full_name:r.full_name, private:r.private,
  description:r.description, html_url:r.html_url, default_branch:r.default_branch,
  language:r.language, created_at:r.created_at, updated_at:r.updated_at,
  stargazers_count:r.stargazers_count, forks_count:r.forks_count, topics:r.topics });
const minIssue = i => ({ id:i.id, number:i.number, title:i.title, state:i.state,
  html_url:i.html_url, created_at:i.created_at, updated_at:i.updated_at,
  user:i.user?{login:i.user.login}:null, labels:i.labels?.map(l=>l.name), assignees:i.assignees?.map(a=>a.login) });
const minPR = pr => ({ id:pr.id, number:pr.number, title:pr.title, state:pr.state,
  html_url:pr.html_url, created_at:pr.created_at, merged:pr.merged,
  head:{ref:pr.head?.ref,sha:pr.head?.sha}, base:{ref:pr.base?.ref},
  user:pr.user?{login:pr.user.login}:null, draft:pr.draft });
const minCommit = c => ({ sha:c.sha, message:c.commit?.message,
  author:c.commit?.author?.name, date:c.commit?.author?.date, html_url:c.html_url });
const minBranch = b => ({ name:b.name, sha:b.commit?.sha, protected:b.protected });

async function execute(tool, args) {
  const { owner, repo, org } = args;

  // ── REPOSITORIES ──────────────────────────────────────────────────────────
  if (tool === 'github_list_repos') {
    const { type='owner', sort='updated', per_page=10, page=1 } = args;
    const url = org
      ? `/orgs/${org}/repos?type=${type}&sort=${sort}&per_page=${per_page}&page=${page}`
      : `/user/repos?type=${type}&sort=${sort}&per_page=${per_page}&page=${page}`;
    const data = await gh('GET', url);
    return data.map(minRepo);
  }
  if (tool === 'github_get_repo') { return minRepo(await gh('GET', `/repos/${owner}/${repo}`)); }
  if (tool === 'github_create_repo') {
    const { name, description, private:priv=false, auto_init=true, gitignore_template } = args;
    const body = { name, description, private: priv, auto_init };
    if (gitignore_template) body.gitignore_template = gitignore_template;
    return minRepo(await gh('POST', org ? `/orgs/${org}/repos` : '/user/repos', body));
  }
  if (tool === 'github_update_repo') {
    const { name, description, private:priv, default_branch, has_issues, has_wiki, archived } = args;
    const body = {};
    if (name !== undefined) body.name = name;
    if (description !== undefined) body.description = description;
    if (priv !== undefined) body.private = priv;
    if (default_branch !== undefined) body.default_branch = default_branch;
    if (has_issues !== undefined) body.has_issues = has_issues;
    if (has_wiki !== undefined) body.has_wiki = has_wiki;
    if (archived !== undefined) body.archived = archived;
    return minRepo(await gh('PATCH', `/repos/${owner}/${repo}`, body));
  }
  if (tool === 'github_delete_repo') { return await gh('DELETE', `/repos/${owner}/${repo}`); }
  if (tool === 'github_list_repo_topics') { return await gh('GET', `/repos/${owner}/${repo}/topics`); }
  if (tool === 'github_replace_repo_topics') { return await gh('PUT', `/repos/${owner}/${repo}/topics`, { names: args.names }); }
  if (tool === 'github_list_repo_languages') { return await gh('GET', `/repos/${owner}/${repo}/languages`); }
  if (tool === 'github_list_repo_tags') { return (await gh('GET', `/repos/${owner}/${repo}/tags?per_page=${args.per_page||10}`)).map(t=>({name:t.name,sha:t.commit?.sha})); }
  if (tool === 'github_get_repo_readme') { const d=await gh('GET',`/repos/${owner}/${repo}/readme`); return {...d,content:Buffer.from(d.content||'','base64').toString('utf-8').slice(0,5000)}; }
  if (tool === 'github_get_repo_license') { return await gh('GET', `/repos/${owner}/${repo}/license`); }
  if (tool === 'github_transfer_repo') { return await gh('POST', `/repos/${owner}/${repo}/transfer`, { new_owner: args.new_owner }); }
  if (tool === 'github_enable_vulnerability_alerts') { return await gh('PUT', `/repos/${owner}/${repo}/vulnerability-alerts`); }
  if (tool === 'github_disable_vulnerability_alerts') { return await gh('DELETE', `/repos/${owner}/${repo}/vulnerability-alerts`); }
  if (tool === 'github_enable_automated_security_fixes') { return await gh('PUT', `/repos/${owner}/${repo}/automated-security-fixes`); }
  if (tool === 'github_disable_automated_security_fixes') { return await gh('DELETE', `/repos/${owner}/${repo}/automated-security-fixes`); }
  if (tool === 'github_get_repo_community_profile') { return await gh('GET', `/repos/${owner}/${repo}/community/profile`); }
  if (tool === 'github_get_repo_stats_contributors') { return await gh('GET', `/repos/${owner}/${repo}/stats/contributors`); }
  if (tool === 'github_get_repo_clones') { return await gh('GET', `/repos/${owner}/${repo}/traffic/clones?per=${args.per||'week'}`); }
  if (tool === 'github_get_repo_views') { return await gh('GET', `/repos/${owner}/${repo}/traffic/views?per=${args.per||'week'}`); }
  if (tool === 'github_get_repo_top_referrers') { return await gh('GET', `/repos/${owner}/${repo}/traffic/popular/referrers`); }
  if (tool === 'github_generate_repo_from_template') { return minRepo(await gh('POST', `/repos/${args.template_owner}/${args.template_repo}/generate`, { owner: args.new_owner, name: args.name, description: args.description, private: args.private||false })); }

  // ── BRANCHES ──────────────────────────────────────────────────────────────
  if (tool === 'github_list_branches') {
    const data = await gh('GET', `/repos/${owner}/${repo}/branches?per_page=${args.per_page||30}&page=${args.page||1}&protected=${args.protected_only||''}`);
    return data.map(minBranch);
  }
  if (tool === 'github_get_branch') { return await gh('GET', `/repos/${owner}/${repo}/branches/${args.branch}`); }
  if (tool === 'github_create_branch') {
    const { branch, from_branch = 'main' } = args;
    // Get SHA of source branch
    const ref = await gh('GET', `/repos/${owner}/${repo}/git/ref/heads/${from_branch}`);
    return await gh('POST', `/repos/${owner}/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha: ref.object.sha });
  }
  if (tool === 'github_delete_branch') { return await gh('DELETE', `/repos/${owner}/${repo}/git/refs/heads/${args.branch}`); }
  if (tool === 'github_rename_branch') { return await gh('POST', `/repos/${owner}/${repo}/branches/${args.branch}/rename`, { new_name: args.new_name }); }
  if (tool === 'github_merge_branch') { return await gh('POST', `/repos/${owner}/${repo}/merges`, { base: args.base, head: args.head, commit_message: args.commit_message }); }
  if (tool === 'github_get_branch_protection') { return await gh('GET', `/repos/${owner}/${repo}/branches/${args.branch}/protection`); }
  if (tool === 'github_update_branch_protection') {
    const { branch, required_status_checks, enforce_admins, required_pull_request_reviews, restrictions } = args;
    return await gh('PUT', `/repos/${owner}/${repo}/branches/${branch}/protection`, { required_status_checks: required_status_checks||null, enforce_admins: enforce_admins||false, required_pull_request_reviews: required_pull_request_reviews||null, restrictions: restrictions||null });
  }
  if (tool === 'github_delete_branch_protection') { return await gh('DELETE', `/repos/${owner}/${repo}/branches/${args.branch}/protection`); }

  // ── COMMITS ───────────────────────────────────────────────────────────────
  if (tool === 'github_list_commits') {
    const { sha, path:fpath, since, until, per_page=10, page=1 } = args;
    let url = `/repos/${owner}/${repo}/commits?per_page=${per_page}&page=${page}`;
    if (sha) url += `&sha=${sha}`;
    if (fpath) url += `&path=${fpath}`;
    if (since) url += `&since=${since}`;
    if (until) url += `&until=${until}`;
    return (await gh('GET', url)).map(minCommit);
  }
  if (tool === 'github_get_commit') { const d=await gh('GET',`/repos/${owner}/${repo}/commits/${args.sha}`); return minCommit(d); }
  if (tool === 'github_compare_commits') { return await gh('GET', `/repos/${owner}/${repo}/compare/${args.base}...${args.head}`); }
  if (tool === 'github_get_commit_status') { return await gh('GET', `/repos/${owner}/${repo}/commits/${args.sha}/status`); }
  if (tool === 'github_create_commit_status') { return await gh('POST', `/repos/${owner}/${repo}/statuses/${args.sha}`, { state: args.state, target_url: args.target_url, description: args.description, context: args.context||'default' }); }
  if (tool === 'github_list_commit_comments') { return await gh('GET', `/repos/${owner}/${repo}/commits/${args.sha}/comments`); }
  if (tool === 'github_create_commit_comment') { return await gh('POST', `/repos/${owner}/${repo}/commits/${args.sha}/comments`, { body: args.body, path: args.path, position: args.position }); }

  // ── ISSUES ────────────────────────────────────────────────────────────────
  if (tool === 'github_list_issues') {
    const { state='open', labels, assignee, sort='created', direction='desc', per_page=10, page=1 } = args;
    let url = `/repos/${owner}/${repo}/issues?state=${state}&sort=${sort}&direction=${direction}&per_page=${per_page}&page=${page}`;
    if (labels) url += `&labels=${labels}`;
    if (assignee) url += `&assignee=${assignee}`;
    return (await gh('GET', url)).filter(i => !i.pull_request).map(minIssue);
  }
  if (tool === 'github_get_issue') { return minIssue(await gh('GET', `/repos/${owner}/${repo}/issues/${args.issue_number}`)); }
  if (tool === 'github_create_issue') { return minIssue(await gh('POST', `/repos/${owner}/${repo}/issues`, { title:args.title, body:args.body, labels:args.labels, assignees:args.assignees, milestone:args.milestone })); }
  if (tool === 'github_update_issue') {
    const { issue_number, title, body, state, labels, assignees } = args;
    const b = {};
    if (title) b.title=title; if (body) b.body=body; if (state) b.state=state;
    if (labels) b.labels=labels; if (assignees) b.assignees=assignees;
    return minIssue(await gh('PATCH', `/repos/${owner}/${repo}/issues/${issue_number}`, b));
  }
  if (tool === 'github_close_issue') { return minIssue(await gh('PATCH', `/repos/${owner}/${repo}/issues/${args.issue_number}`, { state:'closed' })); }
  if (tool === 'github_lock_issue') { return await gh('PUT', `/repos/${owner}/${repo}/issues/${args.issue_number}/lock`, { lock_reason: args.reason }); }
  if (tool === 'github_unlock_issue') { return await gh('DELETE', `/repos/${owner}/${repo}/issues/${args.issue_number}/lock`); }
  if (tool === 'github_list_issue_comments') { return await gh('GET', `/repos/${owner}/${repo}/issues/${args.issue_number}/comments?per_page=${args.per_page||10}`); }
  if (tool === 'github_create_issue_comment') { return await gh('POST', `/repos/${owner}/${repo}/issues/${args.issue_number}/comments`, { body: args.body }); }
  if (tool === 'github_update_issue_comment') { return await gh('PATCH', `/repos/${owner}/${repo}/issues/comments/${args.comment_id}`, { body: args.body }); }
  if (tool === 'github_delete_issue_comment') { return await gh('DELETE', `/repos/${owner}/${repo}/issues/comments/${args.comment_id}`); }
  if (tool === 'github_add_labels') { return await gh('POST', `/repos/${owner}/${repo}/issues/${args.issue_number}/labels`, { labels: args.labels }); }
  if (tool === 'github_remove_label') { return await gh('DELETE', `/repos/${owner}/${repo}/issues/${args.issue_number}/labels/${args.label}`); }
  if (tool === 'github_replace_labels') { return await gh('PUT', `/repos/${owner}/${repo}/issues/${args.issue_number}/labels`, { labels: args.labels }); }
  if (tool === 'github_add_assignees') { return await gh('POST', `/repos/${owner}/${repo}/issues/${args.issue_number}/assignees`, { assignees: args.assignees }); }
  if (tool === 'github_remove_assignees') { return await gh('DELETE', `/repos/${owner}/${repo}/issues/${args.issue_number}/assignees`, { assignees: args.assignees }); }
  if (tool === 'github_list_issue_events') { return await gh('GET', `/repos/${owner}/${repo}/issues/${args.issue_number}/events`); }

  // ── LABELS ────────────────────────────────────────────────────────────────
  if (tool === 'github_list_labels') { return await gh('GET', `/repos/${owner}/${repo}/labels?per_page=${args.per_page||30}`); }
  if (tool === 'github_create_label') { return await gh('POST', `/repos/${owner}/${repo}/labels`, { name:args.name, color:args.color, description:args.description }); }
  if (tool === 'github_update_label') { return await gh('PATCH', `/repos/${owner}/${repo}/labels/${args.name}`, { new_name:args.new_name, color:args.color, description:args.description }); }
  if (tool === 'github_delete_label') { return await gh('DELETE', `/repos/${owner}/${repo}/labels/${args.name}`); }

  // ── PULL REQUESTS ─────────────────────────────────────────────────────────
  if (tool === 'github_list_pull_requests') {
    const { state='open', sort='created', direction='desc', per_page=10, page=1, base, head } = args;
    let url = `/repos/${owner}/${repo}/pulls?state=${state}&sort=${sort}&direction=${direction}&per_page=${per_page}&page=${page}`;
    if (base) url += `&base=${base}`; if (head) url += `&head=${head}`;
    return (await gh('GET', url)).map(minPR);
  }
  if (tool === 'github_get_pull_request') { return minPR(await gh('GET', `/repos/${owner}/${repo}/pulls/${args.pull_number}`)); }
  if (tool === 'github_create_pull_request') {
    return minPR(await gh('POST', `/repos/${owner}/${repo}/pulls`, { title:args.title, body:args.body||'', head:args.head, base:args.base||'main', draft:args.draft||false, maintainer_can_modify:args.maintainer_can_modify||true }));
  }
  if (tool === 'github_update_pull_request') {
    const { pull_number, title, body, state, base } = args;
    const b = {}; if (title) b.title=title; if (body) b.body=body; if (state) b.state=state; if (base) b.base=base;
    return minPR(await gh('PATCH', `/repos/${owner}/${repo}/pulls/${pull_number}`, b));
  }
  if (tool === 'github_merge_pull_request') {
    return await gh('PUT', `/repos/${owner}/${repo}/pulls/${args.pull_number}/merge`, { commit_title:args.commit_title, commit_message:args.commit_message, merge_method:args.merge_method||'merge' });
  }
  if (tool === 'github_close_pull_request') { return minPR(await gh('PATCH', `/repos/${owner}/${repo}/pulls/${args.pull_number}`, { state:'closed' })); }
  if (tool === 'github_list_pull_request_commits') { return (await gh('GET', `/repos/${owner}/${repo}/pulls/${args.pull_number}/commits`)).map(minCommit); }
  if (tool === 'github_list_pull_request_files') { return await gh('GET', `/repos/${owner}/${repo}/pulls/${args.pull_number}/files`); }
  if (tool === 'github_list_pull_request_reviews') { return await gh('GET', `/repos/${owner}/${repo}/pulls/${args.pull_number}/reviews`); }
  if (tool === 'github_create_pull_request_review') {
    return await gh('POST', `/repos/${owner}/${repo}/pulls/${args.pull_number}/reviews`, { body:args.body, event:args.event||'COMMENT', comments:args.comments||[] });
  }
  if (tool === 'github_submit_pull_request_review') {
    return await gh('POST', `/repos/${owner}/${repo}/pulls/${args.pull_number}/reviews/${args.review_id}/events`, { body:args.body, event:args.event });
  }
  if (tool === 'github_dismiss_pull_request_review') {
    return await gh('PUT', `/repos/${owner}/${repo}/pulls/${args.pull_number}/reviews/${args.review_id}/dismissals`, { message:args.message });
  }
  if (tool === 'github_request_pull_request_reviewers') {
    return await gh('POST', `/repos/${owner}/${repo}/pulls/${args.pull_number}/requested_reviewers`, { reviewers:args.reviewers||[], team_reviewers:args.team_reviewers||[] });
  }
  if (tool === 'github_remove_pull_request_reviewers') {
    return await gh('DELETE', `/repos/${owner}/${repo}/pulls/${args.pull_number}/requested_reviewers`, { reviewers:args.reviewers||[], team_reviewers:args.team_reviewers||[] });
  }
  if (tool === 'github_list_pull_request_review_comments') { return await gh('GET', `/repos/${owner}/${repo}/pulls/${args.pull_number}/comments`); }
  if (tool === 'github_create_pull_request_review_comment') {
    return await gh('POST', `/repos/${owner}/${repo}/pulls/${args.pull_number}/comments`, { body:args.body, commit_id:args.commit_id, path:args.path, position:args.position, line:args.line, side:args.side });
  }
  if (tool === 'github_get_pull_request_diff') {
    const res = await fetch(`${BASE}/repos/${owner}/${repo}/pulls/${args.pull_number}`, { headers: {...headers(), Accept:'application/vnd.github.diff'} });
    const diff = await res.text();
    return { diff: diff.slice(0, MAX_BYTES) };
  }
  if (tool === 'github_update_pull_request_branch') { return await gh('PUT', `/repos/${owner}/${repo}/pulls/${args.pull_number}/update-branch`); }

  // ── GITHUB ACTIONS / WORKFLOWS ────────────────────────────────────────────
  if (tool === 'github_list_workflows') { return await gh('GET', `/repos/${owner}/${repo}/actions/workflows`); }
  if (tool === 'github_get_workflow') { return await gh('GET', `/repos/${owner}/${repo}/actions/workflows/${args.workflow_id}`); }
  if (tool === 'github_enable_workflow') { return await gh('PUT', `/repos/${owner}/${repo}/actions/workflows/${args.workflow_id}/enable`); }
  if (tool === 'github_disable_workflow') { return await gh('PUT', `/repos/${owner}/${repo}/actions/workflows/${args.workflow_id}/disable`); }
  if (tool === 'github_create_workflow_dispatch') {
    return await gh('POST', `/repos/${owner}/${repo}/actions/workflows/${args.workflow_id}/dispatches`, { ref: args.ref||'main', inputs: args.inputs||{} });
  }
  if (tool === 'github_list_workflow_runs') {
    const { workflow_id, status, per_page=10, page=1, branch } = args;
    let url = workflow_id ? `/repos/${owner}/${repo}/actions/workflows/${workflow_id}/runs` : `/repos/${owner}/${repo}/actions/runs`;
    url += `?per_page=${per_page}&page=${page}`;
    if (status) url += `&status=${status}`; if (branch) url += `&branch=${branch}`;
    const d = await gh('GET', url);
    return { total_count: d.total_count, runs: (d.workflow_runs||[]).slice(0,per_page).map(r=>({ id:r.id, name:r.name, status:r.status, conclusion:r.conclusion, created_at:r.created_at, html_url:r.html_url })) };
  }
  if (tool === 'github_get_workflow_run') { return await gh('GET', `/repos/${owner}/${repo}/actions/runs/${args.run_id}`); }
  if (tool === 'github_cancel_workflow_run') { return await gh('POST', `/repos/${owner}/${repo}/actions/runs/${args.run_id}/cancel`); }
  if (tool === 'github_rerun_workflow') { return await gh('POST', `/repos/${owner}/${repo}/actions/runs/${args.run_id}/rerun`); }
  if (tool === 'github_rerun_failed_jobs') { return await gh('POST', `/repos/${owner}/${repo}/actions/runs/${args.run_id}/rerun-failed-jobs`); }
  if (tool === 'github_delete_workflow_run') { return await gh('DELETE', `/repos/${owner}/${repo}/actions/runs/${args.run_id}`); }
  if (tool === 'github_list_workflow_run_jobs') { return await gh('GET', `/repos/${owner}/${repo}/actions/runs/${args.run_id}/jobs`); }
  if (tool === 'github_get_workflow_run_job') { return await gh('GET', `/repos/${owner}/${repo}/actions/jobs/${args.job_id}`); }
  if (tool === 'github_list_workflow_run_artifacts') { return await gh('GET', `/repos/${owner}/${repo}/actions/runs/${args.run_id}/artifacts`); }
  if (tool === 'github_list_repo_secrets') { return await gh('GET', `/repos/${owner}/${repo}/actions/secrets`); }
  if (tool === 'github_delete_repo_secret') { return await gh('DELETE', `/repos/${owner}/${repo}/actions/secrets/${args.secret_name}`); }
  if (tool === 'github_list_repo_variables') { return await gh('GET', `/repos/${owner}/${repo}/actions/variables`); }
  if (tool === 'github_create_repo_variable') { return await gh('POST', `/repos/${owner}/${repo}/actions/variables`, { name:args.name, value:args.value }); }

  // ── FILE CONTENTS ─────────────────────────────────────────────────────────
  if (tool === 'github_get_content') {
    const { path:fpath, ref } = args;
    let url = `/repos/${owner}/${repo}/contents/${fpath}`;
    if (ref) url += `?ref=${ref}`;
    const d = await gh('GET', url);
    if (Array.isArray(d)) return d.map(f => ({ name:f.name, path:f.path, type:f.type, size:f.size, sha:f.sha }));
    return { name:d.name, path:d.path, sha:d.sha, size:d.size, content: Buffer.from(d.content||'','base64').toString('utf-8').slice(0,50000), encoding:'utf-8' };
  }
  if (tool === 'github_create_or_update_file') {
    const { path:fpath, message, content, sha, branch } = args;
    const encoded = Buffer.from(content).toString('base64');
    const body = { message, content: encoded };
    if (sha) body.sha = sha;
    if (branch) body.branch = branch;
    return await gh('PUT', `/repos/${owner}/${repo}/contents/${fpath}`, body);
  }
  if (tool === 'github_delete_file') {
    return await gh('DELETE', `/repos/${owner}/${repo}/contents/${args.path}`, { message:args.message, sha:args.sha, branch:args.branch });
  }

  // ── GIT DATA ──────────────────────────────────────────────────────────────
  if (tool === 'github_get_ref') { return await gh('GET', `/repos/${owner}/${repo}/git/ref/${args.ref}`); }
  if (tool === 'github_update_ref') { return await gh('PATCH', `/repos/${owner}/${repo}/git/refs/${args.ref}`, { sha:args.sha, force:args.force||false }); }
  if (tool === 'github_create_ref') { return await gh('POST', `/repos/${owner}/${repo}/git/refs`, { ref:args.ref, sha:args.sha }); }
  if (tool === 'github_delete_ref') { return await gh('DELETE', `/repos/${owner}/${repo}/git/refs/${args.ref}`); }
  if (tool === 'github_get_blob') { return await gh('GET', `/repos/${owner}/${repo}/git/blobs/${args.file_sha}`); }
  if (tool === 'github_create_blob') {
    const encoded = Buffer.from(args.content).toString('base64');
    return await gh('POST', `/repos/${owner}/${repo}/git/blobs`, { content: encoded, encoding: 'base64' });
  }
  if (tool === 'github_get_tree') { return await gh('GET', `/repos/${owner}/${repo}/git/trees/${args.tree_sha}?recursive=${args.recursive?1:0}`); }
  if (tool === 'github_create_tree') { return await gh('POST', `/repos/${owner}/${repo}/git/trees`, { tree:args.tree, base_tree:args.base_tree }); }
  if (tool === 'github_create_commit') { return await gh('POST', `/repos/${owner}/${repo}/git/commits`, { message:args.message, tree:args.tree, parents:args.parents||[] }); }
  if (tool === 'github_get_commit_object') { return await gh('GET', `/repos/${owner}/${repo}/git/commits/${args.commit_sha}`); }

  // ── RELEASES ──────────────────────────────────────────────────────────────
  if (tool === 'github_list_releases') { return (await gh('GET', `/repos/${owner}/${repo}/releases?per_page=${args.per_page||10}`)).map(r=>({ id:r.id, tag_name:r.tag_name, name:r.name, draft:r.draft, prerelease:r.prerelease, published_at:r.published_at, html_url:r.html_url })); }
  if (tool === 'github_get_release') { return await gh('GET', `/repos/${owner}/${repo}/releases/${args.release_id}`); }
  if (tool === 'github_get_latest_release') { return await gh('GET', `/repos/${owner}/${repo}/releases/latest`); }
  if (tool === 'github_get_release_by_tag') { return await gh('GET', `/repos/${owner}/${repo}/releases/tags/${args.tag}`); }
  if (tool === 'github_create_release') {
    return await gh('POST', `/repos/${owner}/${repo}/releases`, { tag_name:args.tag_name, name:args.name, body:args.body||'', draft:args.draft||false, prerelease:args.prerelease||false, generate_release_notes:args.generate_release_notes||false, target_commitish:args.target_commitish||'main' });
  }
  if (tool === 'github_update_release') {
    const { release_id, tag_name, name, body, draft, prerelease } = args;
    const b = {}; if (tag_name) b.tag_name=tag_name; if (name) b.name=name; if (body) b.body=body;
    if (draft!==undefined) b.draft=draft; if (prerelease!==undefined) b.prerelease=prerelease;
    return await gh('PATCH', `/repos/${owner}/${repo}/releases/${release_id}`, b);
  }
  if (tool === 'github_delete_release') { return await gh('DELETE', `/repos/${owner}/${repo}/releases/${args.release_id}`); }
  if (tool === 'github_generate_release_notes') { return await gh('POST', `/repos/${owner}/${repo}/releases/generate-notes`, { tag_name:args.tag_name, previous_tag_name:args.previous_tag_name, target_commitish:args.target_commitish||'main' }); }
  if (tool === 'github_list_release_assets') { return await gh('GET', `/repos/${owner}/${repo}/releases/${args.release_id}/assets`); }

  // ── MILESTONES ────────────────────────────────────────────────────────────
  if (tool === 'github_list_milestones') { return await gh('GET', `/repos/${owner}/${repo}/milestones?state=${args.state||'open'}&per_page=${args.per_page||10}`); }
  if (tool === 'github_get_milestone') { return await gh('GET', `/repos/${owner}/${repo}/milestones/${args.milestone_number}`); }
  if (tool === 'github_create_milestone') { return await gh('POST', `/repos/${owner}/${repo}/milestones`, { title:args.title, state:args.state||'open', description:args.description, due_on:args.due_on }); }
  if (tool === 'github_update_milestone') { return await gh('PATCH', `/repos/${owner}/${repo}/milestones/${args.milestone_number}`, { title:args.title, state:args.state, description:args.description, due_on:args.due_on }); }
  if (tool === 'github_delete_milestone') { return await gh('DELETE', `/repos/${owner}/${repo}/milestones/${args.milestone_number}`); }

  // ── COLLABORATORS & TEAMS ─────────────────────────────────────────────────
  if (tool === 'github_list_collaborators') { return (await gh('GET', `/repos/${owner}/${repo}/collaborators?per_page=${args.per_page||30}`)).map(u=>({login:u.login,role_name:u.role_name})); }
  if (tool === 'github_add_collaborator') { return await gh('PUT', `/repos/${owner}/${repo}/collaborators/${args.username}`, { permission:args.permission||'push' }); }
  if (tool === 'github_remove_collaborator') { return await gh('DELETE', `/repos/${owner}/${repo}/collaborators/${args.username}`); }
  if (tool === 'github_check_collaborator') { try { await gh('GET', `/repos/${owner}/${repo}/collaborators/${args.username}`); return { is_collaborator: true }; } catch { return { is_collaborator: false }; } }
  if (tool === 'github_get_collaborator_permission') { return await gh('GET', `/repos/${owner}/${repo}/collaborators/${args.username}/permission`); }
  if (tool === 'github_list_invitations') { return await gh('GET', `/repos/${owner}/${repo}/invitations`); }
  if (tool === 'github_delete_invitation') { return await gh('DELETE', `/repos/${owner}/${repo}/invitations/${args.invitation_id}`); }

  // ── WEBHOOKS ──────────────────────────────────────────────────────────────
  if (tool === 'github_list_webhooks') { return await gh('GET', `/repos/${owner}/${repo}/hooks`); }
  if (tool === 'github_get_webhook') { return await gh('GET', `/repos/${owner}/${repo}/hooks/${args.hook_id}`); }
  if (tool === 'github_create_webhook') {
    return await gh('POST', `/repos/${owner}/${repo}/hooks`, { name:'web', config:{ url:args.url, content_type:args.content_type||'json', secret:args.secret }, events:args.events||['push'], active:args.active!==false });
  }
  if (tool === 'github_update_webhook') { return await gh('PATCH', `/repos/${owner}/${repo}/hooks/${args.hook_id}`, { config:args.config, events:args.events, active:args.active }); }
  if (tool === 'github_delete_webhook') { return await gh('DELETE', `/repos/${owner}/${repo}/hooks/${args.hook_id}`); }
  if (tool === 'github_ping_webhook') { return await gh('POST', `/repos/${owner}/${repo}/hooks/${args.hook_id}/pings`); }

  // ── DEPLOY KEYS ───────────────────────────────────────────────────────────
  if (tool === 'github_list_deploy_keys') { return await gh('GET', `/repos/${owner}/${repo}/keys`); }
  if (tool === 'github_create_deploy_key') { return await gh('POST', `/repos/${owner}/${repo}/keys`, { title:args.title, key:args.key, read_only:args.read_only!==false }); }
  if (tool === 'github_delete_deploy_key') { return await gh('DELETE', `/repos/${owner}/${repo}/keys/${args.key_id}`); }

  // ── DEPLOYMENTS ───────────────────────────────────────────────────────────
  if (tool === 'github_list_deployments') { return await gh('GET', `/repos/${owner}/${repo}/deployments?per_page=${args.per_page||10}&environment=${args.environment||''}`); }
  if (tool === 'github_create_deployment') { return await gh('POST', `/repos/${owner}/${repo}/deployments`, { ref:args.ref, environment:args.environment||'production', description:args.description, auto_merge:args.auto_merge||false }); }
  if (tool === 'github_list_deployment_statuses') { return await gh('GET', `/repos/${owner}/${repo}/deployments/${args.deployment_id}/statuses`); }
  if (tool === 'github_create_deployment_status') { return await gh('POST', `/repos/${owner}/${repo}/deployments/${args.deployment_id}/statuses`, { state:args.state, log_url:args.log_url, description:args.description, environment_url:args.environment_url }); }

  // ── ENVIRONMENTS ──────────────────────────────────────────────────────────
  if (tool === 'github_list_environments') { return await gh('GET', `/repos/${owner}/${repo}/environments`); }
  if (tool === 'github_get_environment') { return await gh('GET', `/repos/${owner}/${repo}/environments/${args.environment_name}`); }
  if (tool === 'github_create_or_update_environment') { return await gh('PUT', `/repos/${owner}/${repo}/environments/${args.environment_name}`, { wait_timer:args.wait_timer, reviewers:args.reviewers }); }
  if (tool === 'github_delete_environment') { return await gh('DELETE', `/repos/${owner}/${repo}/environments/${args.environment_name}`); }

  // ── ORGS ──────────────────────────────────────────────────────────────────
  if (tool === 'github_get_org') { return await gh('GET', `/orgs/${org||owner}`); }
  if (tool === 'github_list_org_members') { return (await gh('GET', `/orgs/${org||owner}/members?per_page=${args.per_page||30}`)).map(u=>({login:u.login,id:u.id})); }
  if (tool === 'github_list_org_repos') { return (await gh('GET', `/orgs/${org||owner}/repos?type=${args.type||'all'}&per_page=${args.per_page||10}`)).map(minRepo); }
  if (tool === 'github_list_org_teams') { return await gh('GET', `/orgs/${org||owner}/teams?per_page=${args.per_page||30}`); }
  if (tool === 'github_get_team') { return await gh('GET', `/orgs/${org||owner}/teams/${args.team_slug}`); }
  if (tool === 'github_create_team') { return await gh('POST', `/orgs/${org||owner}/teams`, { name:args.name, description:args.description, privacy:args.privacy||'closed', permission:args.permission||'push' }); }
  if (tool === 'github_delete_team') { return await gh('DELETE', `/orgs/${org||owner}/teams/${args.team_slug}`); }
  if (tool === 'github_list_team_members') { return (await gh('GET', `/orgs/${org||owner}/teams/${args.team_slug}/members?per_page=${args.per_page||30}`)).map(u=>({login:u.login})); }
  if (tool === 'github_add_team_member') { return await gh('PUT', `/orgs/${org||owner}/teams/${args.team_slug}/memberships/${args.username}`, { role:args.role||'member' }); }
  if (tool === 'github_remove_team_member') { return await gh('DELETE', `/orgs/${org||owner}/teams/${args.team_slug}/memberships/${args.username}`); }
  if (tool === 'github_add_team_repo') { return await gh('PUT', `/orgs/${org||owner}/teams/${args.team_slug}/repos/${owner}/${repo}`, { permission:args.permission||'push' }); }

  // ── USERS ─────────────────────────────────────────────────────────────────
  if (tool === 'github_get_authenticated_user') { return await gh('GET', '/user'); }
  if (tool === 'github_get_user') { return await gh('GET', `/users/${args.username}`); }
  if (tool === 'github_list_user_repos') { return (await gh('GET', `/users/${args.username}/repos?type=${args.type||'owner'}&sort=updated&per_page=${args.per_page||10}`)).map(minRepo); }
  if (tool === 'github_list_user_followers') { return (await gh('GET', `/users/${args.username}/followers?per_page=${args.per_page||30}`)).map(u=>u.login); }
  if (tool === 'github_list_user_following') { return (await gh('GET', `/users/${args.username}/following?per_page=${args.per_page||30}`)).map(u=>u.login); }

  // ── GISTS ─────────────────────────────────────────────────────────────────
  if (tool === 'github_list_gists') { return await gh('GET', `/gists?per_page=${args.per_page||10}`); }
  if (tool === 'github_get_gist') { return await gh('GET', `/gists/${args.gist_id}`); }
  if (tool === 'github_create_gist') {
    const files = {}; for (const [k,v] of Object.entries(args.files||{})) files[k]={content:v};
    return await gh('POST', '/gists', { description:args.description||'', public:args.public||false, files });
  }
  if (tool === 'github_update_gist') {
    const files = {}; for (const [k,v] of Object.entries(args.files||{})) files[k]={content:v};
    return await gh('PATCH', `/gists/${args.gist_id}`, { description:args.description, files });
  }
  if (tool === 'github_delete_gist') { return await gh('DELETE', `/gists/${args.gist_id}`); }
  if (tool === 'github_star_gist') { return await gh('PUT', `/gists/${args.gist_id}/star`); }
  if (tool === 'github_unstar_gist') { return await gh('DELETE', `/gists/${args.gist_id}/star`); }
  if (tool === 'github_fork_gist') { return await gh('POST', `/gists/${args.gist_id}/forks`); }

  // ── SEARCH ────────────────────────────────────────────────────────────────
  if (tool === 'github_search_repositories') {
    const d = await gh('GET', `/search/repositories?q=${encodeURIComponent(args.q)}&sort=${args.sort||'stars'}&per_page=${args.per_page||10}`);
    return { total_count:d.total_count, items:d.items.map(minRepo) };
  }
  if (tool === 'github_search_code') {
    const d = await gh('GET', `/search/code?q=${encodeURIComponent(args.q)}&per_page=${args.per_page||10}`);
    return { total_count:d.total_count, items:d.items.map(i=>({name:i.name,path:i.path,sha:i.sha,repository:i.repository?.full_name,html_url:i.html_url})) };
  }
  if (tool === 'github_search_issues') {
    const d = await gh('GET', `/search/issues?q=${encodeURIComponent(args.q)}&sort=${args.sort||'created'}&per_page=${args.per_page||10}`);
    return { total_count:d.total_count, items:d.items.map(minIssue) };
  }
  if (tool === 'github_search_commits') {
    const d = await gh('GET', `/search/commits?q=${encodeURIComponent(args.q)}&per_page=${args.per_page||10}`, undefined);
    return { total_count:d.total_count, items:d.items?.slice(0,10) };
  }
  if (tool === 'github_search_users') {
    const d = await gh('GET', `/search/users?q=${encodeURIComponent(args.q)}&per_page=${args.per_page||10}`);
    return { total_count:d.total_count, items:d.items.map(u=>({login:u.login,id:u.id,html_url:u.html_url})) };
  }
  if (tool === 'github_search_topics') {
    const d = await gh('GET', `/search/topics?q=${encodeURIComponent(args.q)}&per_page=${args.per_page||10}`);
    return { total_count:d.total_count, items:d.items };
  }

  // ── CODE SCANNING & SECURITY ──────────────────────────────────────────────
  if (tool === 'github_list_code_scanning_alerts') { return await gh('GET', `/repos/${owner}/${repo}/code-scanning/alerts?state=${args.state||'open'}&per_page=${args.per_page||10}`); }
  if (tool === 'github_get_code_scanning_alert') { return await gh('GET', `/repos/${owner}/${repo}/code-scanning/alerts/${args.alert_number}`); }
  if (tool === 'github_update_code_scanning_alert') { return await gh('PATCH', `/repos/${owner}/${repo}/code-scanning/alerts/${args.alert_number}`, { state:args.state, dismissed_reason:args.dismissed_reason }); }
  if (tool === 'github_list_secret_scanning_alerts') { return await gh('GET', `/repos/${owner}/${repo}/secret-scanning/alerts?state=${args.state||'open'}&per_page=${args.per_page||10}`); }
  if (tool === 'github_update_secret_scanning_alert') { return await gh('PATCH', `/repos/${owner}/${repo}/secret-scanning/alerts/${args.alert_number}`, { state:args.state, resolution:args.resolution }); }
  if (tool === 'github_list_dependabot_alerts') { return await gh('GET', `/repos/${owner}/${repo}/dependabot/alerts?state=${args.state||'open'}&per_page=${args.per_page||10}`); }

  // ── PACKAGES ──────────────────────────────────────────────────────────────
  if (tool === 'github_list_packages') { return await gh('GET', `/orgs/${org||owner}/packages?package_type=${args.package_type||'npm'}&per_page=${args.per_page||10}`); }
  if (tool === 'github_get_package') { return await gh('GET', `/orgs/${org||owner}/packages/${args.package_type}/${args.package_name}`); }
  if (tool === 'github_delete_package') { return await gh('DELETE', `/orgs/${org||owner}/packages/${args.package_type}/${args.package_name}`); }
  if (tool === 'github_list_package_versions') { return await gh('GET', `/orgs/${org||owner}/packages/${args.package_type}/${args.package_name}/versions`); }
  if (tool === 'github_delete_package_version') { return await gh('DELETE', `/orgs/${org||owner}/packages/${args.package_type}/${args.package_name}/versions/${args.package_version_id}`); }

  // ── PAGES ─────────────────────────────────────────────────────────────────
  if (tool === 'github_get_pages') { return await gh('GET', `/repos/${owner}/${repo}/pages`); }
  if (tool === 'github_create_pages_site') { return await gh('POST', `/repos/${owner}/${repo}/pages`, { source:{ branch:args.branch||'gh-pages', path:args.path||'/'} }); }
  if (tool === 'github_delete_pages_site') { return await gh('DELETE', `/repos/${owner}/${repo}/pages`); }
  if (tool === 'github_request_pages_build') { return await gh('POST', `/repos/${owner}/${repo}/pages/builds`); }
  if (tool === 'github_get_latest_pages_build') { return await gh('GET', `/repos/${owner}/${repo}/pages/builds/latest`); }

  // ── RULESETS ──────────────────────────────────────────────────────────────
  if (tool === 'github_list_repo_rulesets') { return await gh('GET', `/repos/${owner}/${repo}/rulesets`); }
  if (tool === 'github_get_repo_ruleset') { return await gh('GET', `/repos/${owner}/${repo}/rulesets/${args.ruleset_id}`); }

  // ── CHECK RUNS ────────────────────────────────────────────────────────────
  if (tool === 'github_list_check_runs_for_commit') { return await gh('GET', `/repos/${owner}/${repo}/commits/${args.ref}/check-runs?per_page=${args.per_page||10}`); }
  if (tool === 'github_create_check_run') {
    return await gh('POST', `/repos/${owner}/${repo}/check-runs`, { name:args.name, head_sha:args.head_sha, status:args.status||'in_progress', conclusion:args.conclusion, output:args.output });
  }
  if (tool === 'github_update_check_run') {
    return await gh('PATCH', `/repos/${owner}/${repo}/check-runs/${args.check_run_id}`, { status:args.status, conclusion:args.conclusion, output:args.output, completed_at:args.completed_at });
  }

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
  if (tool === 'github_list_notifications') { return await gh('GET', `/notifications?all=${args.all||false}&per_page=${args.per_page||10}`); }
  if (tool === 'github_mark_notifications_read') { return await gh('PUT', '/notifications', { last_read_at: new Date().toISOString() }); }
  if (tool === 'github_mark_thread_read') { return await gh('PATCH', `/notifications/threads/${args.thread_id}`); }

  // ── RATE LIMIT ────────────────────────────────────────────────────────────
  if (tool === 'github_get_rate_limit') { return await gh('GET', '/rate_limit'); }

  // ── ACTIONS — LOGS & ARTIFACTS (deep) ─────────────────────────────────────
  if (tool === 'github_download_workflow_run_logs') {
    const res = await fetch(`${BASE}/repos/${owner}/${repo}/actions/runs/${args.run_id}/logs`, { headers: headers(), redirect: 'follow' });
    if (!res.ok) throw new Error(`GitHub API ${res.status}: failed to fetch workflow run logs`);
    const buf = await res.arrayBuffer();
    return { run_id: args.run_id, size_bytes: buf.byteLength, content_base64: Buffer.from(buf).toString('base64').slice(0, MAX_BYTES) };
  }
  if (tool === 'github_download_workflow_job_logs') {
    const res = await fetch(`${BASE}/repos/${owner}/${repo}/actions/jobs/${args.job_id}/logs`, { headers: headers(), redirect: 'follow' });
    if (!res.ok) throw new Error(`GitHub API ${res.status}: failed to fetch job logs`);
    const text = await res.text();
    return { job_id: args.job_id, size_bytes: text.length, log: text.slice(0, MAX_BYTES) };
  }
  if (tool === 'github_get_artifact') { return await gh('GET', `/repos/${owner}/${repo}/actions/artifacts/${args.artifact_id}`); }
  if (tool === 'github_delete_artifact') { return await gh('DELETE', `/repos/${owner}/${repo}/actions/artifacts/${args.artifact_id}`); }
  if (tool === 'github_download_artifact') {
    const fmt = args.archive_format || 'zip';
    const res = await fetch(`${BASE}/repos/${owner}/${repo}/actions/artifacts/${args.artifact_id}/${fmt}`, { headers: headers(), redirect: 'follow' });
    if (!res.ok) throw new Error(`GitHub API ${res.status}: failed to download artifact`);
    const buf = await res.arrayBuffer();
    return { artifact_id: args.artifact_id, format: fmt, size_bytes: buf.byteLength, content_base64: Buffer.from(buf).toString('base64').slice(0, MAX_BYTES) };
  }
  if (tool === 'github_get_workflow_run_attempt') { return await gh('GET', `/repos/${owner}/${repo}/actions/runs/${args.run_id}/attempts/${args.attempt_number}`); }
  if (tool === 'github_get_workflow_run_usage') { return await gh('GET', `/repos/${owner}/${repo}/actions/runs/${args.run_id}/timing`); }
  if (tool === 'github_get_workflow_usage') { return await gh('GET', `/repos/${owner}/${repo}/actions/workflows/${args.workflow_id}/timing`); }

  // ── ACTIONS — ORG SECRETS & VARIABLES ─────────────────────────────────────
  if (tool === 'github_list_org_secrets') { return await gh('GET', `/orgs/${org||owner}/actions/secrets?per_page=${args.per_page||30}`); }
  if (tool === 'github_get_org_secret') { return await gh('GET', `/orgs/${org||owner}/actions/secrets/${args.secret_name}`); }
  if (tool === 'github_delete_org_secret') { return await gh('DELETE', `/orgs/${org||owner}/actions/secrets/${args.secret_name}`); }
  if (tool === 'github_list_org_variables') { return await gh('GET', `/orgs/${org||owner}/actions/variables?per_page=${args.per_page||30}`); }
  if (tool === 'github_get_org_variable') { return await gh('GET', `/orgs/${org||owner}/actions/variables/${args.name}`); }
  if (tool === 'github_create_org_variable') { return await gh('POST', `/orgs/${org||owner}/actions/variables`, { name: args.name, value: args.value, visibility: args.visibility || 'all', selected_repository_ids: args.selected_repository_ids }); }
  if (tool === 'github_delete_org_variable') { return await gh('DELETE', `/orgs/${org||owner}/actions/variables/${args.name}`); }

  // ── ACTIONS — ENVIRONMENT SECRETS & VARIABLES ─────────────────────────────
  if (tool === 'github_list_environment_secrets') { return await gh('GET', `/repos/${owner}/${repo}/environments/${args.environment_name}/secrets`); }
  if (tool === 'github_delete_environment_secret') { return await gh('DELETE', `/repos/${owner}/${repo}/environments/${args.environment_name}/secrets/${args.secret_name}`); }
  if (tool === 'github_list_environment_variables') { return await gh('GET', `/repos/${owner}/${repo}/environments/${args.environment_name}/variables?per_page=${args.per_page||30}`); }
  if (tool === 'github_get_environment_variable') { return await gh('GET', `/repos/${owner}/${repo}/environments/${args.environment_name}/variables/${args.name}`); }
  if (tool === 'github_create_environment_variable') { return await gh('POST', `/repos/${owner}/${repo}/environments/${args.environment_name}/variables`, { name: args.name, value: args.value }); }
  if (tool === 'github_update_environment_variable') { return await gh('PATCH', `/repos/${owner}/${repo}/environments/${args.environment_name}/variables/${args.name}`, { name: args.new_name || args.name, value: args.value }); }
  if (tool === 'github_delete_environment_variable') { return await gh('DELETE', `/repos/${owner}/${repo}/environments/${args.environment_name}/variables/${args.name}`); }

  // ── SELF-HOSTED RUNNERS ───────────────────────────────────────────────────
  if (tool === 'github_list_self_hosted_runners') { return await gh('GET', `/repos/${owner}/${repo}/actions/runners?per_page=${args.per_page||30}`); }
  if (tool === 'github_get_self_hosted_runner') { return await gh('GET', `/repos/${owner}/${repo}/actions/runners/${args.runner_id}`); }
  if (tool === 'github_delete_self_hosted_runner') { return await gh('DELETE', `/repos/${owner}/${repo}/actions/runners/${args.runner_id}`); }
  if (tool === 'github_list_runner_applications') { return await gh('GET', `/repos/${owner}/${repo}/actions/runners/downloads`); }
  if (tool === 'github_create_runner_registration_token') { return await gh('POST', `/repos/${owner}/${repo}/actions/runners/registration-token`); }
  if (tool === 'github_list_org_self_hosted_runners') { return await gh('GET', `/orgs/${org||owner}/actions/runners?per_page=${args.per_page||30}`); }

  // ── STARS & WATCHERS ──────────────────────────────────────────────────────
  if (tool === 'github_list_stargazers') { return (await gh('GET', `/repos/${owner}/${repo}/stargazers?per_page=${args.per_page||30}&page=${args.page||1}`)).map(u=>({login:u.login, id:u.id})); }
  if (tool === 'github_list_watchers') { return (await gh('GET', `/repos/${owner}/${repo}/subscribers?per_page=${args.per_page||30}&page=${args.page||1}`)).map(u=>({login:u.login, id:u.id})); }
  if (tool === 'github_star_repo') { return await gh('PUT', `/user/starred/${owner}/${repo}`); }
  if (tool === 'github_unstar_repo') { return await gh('DELETE', `/user/starred/${owner}/${repo}`); }
  if (tool === 'github_check_starred') {
    try { const res = await fetch(`${BASE}/user/starred/${owner}/${repo}`, { headers: headers() }); return { is_starred: res.status === 204 }; }
    catch { return { is_starred: false }; }
  }
  if (tool === 'github_list_user_starred') { return (await gh('GET', `/users/${args.username}/starred?per_page=${args.per_page||10}`)).map(minRepo); }
  if (tool === 'github_get_repo_subscription') {
    try { return await gh('GET', `/repos/${owner}/${repo}/subscription`); }
    catch { return { subscribed: false }; }
  }
  if (tool === 'github_set_repo_subscription') { return await gh('PUT', `/repos/${owner}/${repo}/subscription`, { subscribed: args.subscribed !== false, ignored: args.ignored || false }); }
  if (tool === 'github_unsubscribe_repo') { return await gh('DELETE', `/repos/${owner}/${repo}/subscription`); }

  // ── FORKS ─────────────────────────────────────────────────────────────────
  if (tool === 'github_list_forks') { return (await gh('GET', `/repos/${owner}/${repo}/forks?sort=${args.sort||'newest'}&per_page=${args.per_page||10}`)).map(minRepo); }
  if (tool === 'github_create_fork') {
    const body = {};
    if (args.organization) body.organization = args.organization;
    if (args.name) body.name = args.name;
    if (args.default_branch_only) body.default_branch_only = args.default_branch_only;
    return minRepo(await gh('POST', `/repos/${owner}/${repo}/forks`, body));
  }
  if (tool === 'github_sync_fork') {
    return await gh('POST', `/repos/${owner}/${repo}/merge-upstream`, { branch: args.branch || 'main' });
  }

  // ── REACTIONS ─────────────────────────────────────────────────────────────
  if (tool === 'github_list_issue_reactions') { return await gh('GET', `/repos/${owner}/${repo}/issues/${args.issue_number}/reactions?per_page=${args.per_page||30}`); }
  if (tool === 'github_create_issue_reaction') { return await gh('POST', `/repos/${owner}/${repo}/issues/${args.issue_number}/reactions`, { content: args.content }); }
  if (tool === 'github_delete_issue_reaction') { return await gh('DELETE', `/repos/${owner}/${repo}/issues/${args.issue_number}/reactions/${args.reaction_id}`); }
  if (tool === 'github_list_issue_comment_reactions') { return await gh('GET', `/repos/${owner}/${repo}/issues/comments/${args.comment_id}/reactions?per_page=${args.per_page||30}`); }
  if (tool === 'github_create_issue_comment_reaction') { return await gh('POST', `/repos/${owner}/${repo}/issues/comments/${args.comment_id}/reactions`, { content: args.content }); }
  if (tool === 'github_list_pr_review_comment_reactions') { return await gh('GET', `/repos/${owner}/${repo}/pulls/comments/${args.comment_id}/reactions?per_page=${args.per_page||30}`); }
  if (tool === 'github_create_pr_review_comment_reaction') { return await gh('POST', `/repos/${owner}/${repo}/pulls/comments/${args.comment_id}/reactions`, { content: args.content }); }
  if (tool === 'github_create_commit_reaction') { return await gh('POST', `/repos/${owner}/${repo}/commits/${args.sha}/comments/${args.comment_id}/reactions`, { content: args.content }); }

  // ── BRANCH PROTECTION (DEEPER) ────────────────────────────────────────────
  if (tool === 'github_get_required_status_checks') { return await gh('GET', `/repos/${owner}/${repo}/branches/${args.branch}/protection/required_status_checks`); }
  if (tool === 'github_set_admin_branch_protection') { return await gh('POST', `/repos/${owner}/${repo}/branches/${args.branch}/protection/enforce_admins`); }
  if (tool === 'github_remove_admin_branch_protection') { return await gh('DELETE', `/repos/${owner}/${repo}/branches/${args.branch}/protection/enforce_admins`); }
  if (tool === 'github_get_pr_review_protection') { return await gh('GET', `/repos/${owner}/${repo}/branches/${args.branch}/protection/required_pull_request_reviews`); }
  if (tool === 'github_get_branch_signature_protection') { return await gh('GET', `/repos/${owner}/${repo}/branches/${args.branch}/protection/required_signatures`); }
  if (tool === 'github_set_branch_signature_protection') { return await gh('POST', `/repos/${owner}/${repo}/branches/${args.branch}/protection/required_signatures`); }

  // ── CODESPACES ────────────────────────────────────────────────────────────
  if (tool === 'github_list_codespaces') { return await gh('GET', `/user/codespaces?per_page=${args.per_page||30}`); }
  if (tool === 'github_list_repo_codespaces') { return await gh('GET', `/repos/${owner}/${repo}/codespaces?per_page=${args.per_page||30}`); }
  if (tool === 'github_get_codespace') { return await gh('GET', `/user/codespaces/${args.codespace_name}`); }
  if (tool === 'github_create_codespace') {
    return await gh('POST', `/repos/${owner}/${repo}/codespaces`, { ref: args.ref, location: args.location, machine: args.machine, devcontainer_path: args.devcontainer_path });
  }
  if (tool === 'github_delete_codespace') { return await gh('DELETE', `/user/codespaces/${args.codespace_name}`); }
  if (tool === 'github_start_codespace') { return await gh('POST', `/user/codespaces/${args.codespace_name}/start`); }
  if (tool === 'github_stop_codespace') { return await gh('POST', `/user/codespaces/${args.codespace_name}/stop`); }
  if (tool === 'github_list_codespace_machines') { return await gh('GET', `/repos/${owner}/${repo}/codespaces/machines`); }

  // ── RELEASE ASSETS ────────────────────────────────────────────────────────
  if (tool === 'github_get_release_asset') { return await gh('GET', `/repos/${owner}/${repo}/releases/assets/${args.asset_id}`); }
  if (tool === 'github_update_release_asset') { return await gh('PATCH', `/repos/${owner}/${repo}/releases/assets/${args.asset_id}`, { name: args.name, label: args.label }); }
  if (tool === 'github_delete_release_asset') { return await gh('DELETE', `/repos/${owner}/${repo}/releases/assets/${args.asset_id}`); }
  if (tool === 'github_upload_release_asset') {
    const url = `https://uploads.github.com/repos/${owner}/${repo}/releases/${args.release_id}/assets?name=${encodeURIComponent(args.name)}${args.label?`&label=${encodeURIComponent(args.label)}`:''}`;
    const res = await fetch(url, { method: 'POST', headers: { ...headers(), 'Content-Type': args.content_type || 'application/octet-stream' }, body: Buffer.from(args.content_base64, 'base64') });
    const data = await res.json();
    if (!res.ok) throw new Error(`GitHub upload ${res.status}: ${data.message}`);
    return data;
  }

  // ── REPO CONTRIBUTORS & ADDITIONAL DATA ───────────────────────────────────
  if (tool === 'github_list_repo_contributors') { return (await gh('GET', `/repos/${owner}/${repo}/contributors?per_page=${args.per_page||30}`)).map(c=>({login:c.login, id:c.id, contributions:c.contributions})); }
  if (tool === 'github_get_codeowners_errors') { return await gh('GET', `/repos/${owner}/${repo}/codeowners/errors`); }
  if (tool === 'github_list_repo_activity') { return await gh('GET', `/repos/${owner}/${repo}/activity?per_page=${args.per_page||30}&activity_type=${args.activity_type||''}`); }

  // ── DEPENDABOT (DEEPER) ───────────────────────────────────────────────────
  if (tool === 'github_get_dependabot_alert') { return await gh('GET', `/repos/${owner}/${repo}/dependabot/alerts/${args.alert_number}`); }
  if (tool === 'github_update_dependabot_alert') { return await gh('PATCH', `/repos/${owner}/${repo}/dependabot/alerts/${args.alert_number}`, { state: args.state, dismissed_reason: args.dismissed_reason, dismissed_comment: args.dismissed_comment }); }
  if (tool === 'github_list_dependabot_secrets') { return await gh('GET', `/repos/${owner}/${repo}/dependabot/secrets?per_page=${args.per_page||30}`); }
  if (tool === 'github_delete_dependabot_secret') { return await gh('DELETE', `/repos/${owner}/${repo}/dependabot/secrets/${args.secret_name}`); }

  // ── ISSUE TIMELINE & SUB-ISSUES ───────────────────────────────────────────
  if (tool === 'github_list_issue_timeline') { return await gh('GET', `/repos/${owner}/${repo}/issues/${args.issue_number}/timeline?per_page=${args.per_page||30}`); }
  if (tool === 'github_list_pr_associated_with_commit') { return (await gh('GET', `/repos/${owner}/${repo}/commits/${args.sha}/pulls?per_page=${args.per_page||10}`)).map(minPR); }

  // ── COMMIT PULL REQUESTS ──────────────────────────────────────────────────
  if (tool === 'github_get_combined_status') { return await gh('GET', `/repos/${owner}/${repo}/commits/${args.ref}/status`); }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║                         SUPER TOOLS                                  ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  // SUPER TOOL: github_full_pr_review
  // Fetches PR details + diff + commits + files + reviews + comments + checks in one call
  if (tool === 'github_full_pr_review') {
    const { pull_number } = args;
    const [pr, commits, files, reviews, comments, review_comments] = await Promise.all([
      gh('GET', `/repos/${owner}/${repo}/pulls/${pull_number}`),
      gh('GET', `/repos/${owner}/${repo}/pulls/${pull_number}/commits`),
      gh('GET', `/repos/${owner}/${repo}/pulls/${pull_number}/files`),
      gh('GET', `/repos/${owner}/${repo}/pulls/${pull_number}/reviews`),
      gh('GET', `/repos/${owner}/${repo}/issues/${pull_number}/comments`),
      gh('GET', `/repos/${owner}/${repo}/pulls/${pull_number}/comments`)
    ]);
    let checks = null;
    try { checks = await gh('GET', `/repos/${owner}/${repo}/commits/${pr.head.sha}/check-runs`); } catch { /* ignore */ }
    let diff = null;
    if (args.include_diff !== false) {
      const res = await fetch(`${BASE}/repos/${owner}/${repo}/pulls/${pull_number}`, { headers: { ...headers(), Accept: 'application/vnd.github.diff' } });
      diff = (await res.text()).slice(0, MAX_BYTES);
    }
    return {
      pr: minPR(pr),
      mergeable: pr.mergeable,
      mergeable_state: pr.mergeable_state,
      additions: pr.additions, deletions: pr.deletions, changed_files: pr.changed_files,
      commits: commits.map(minCommit),
      files: files.map(f=>({filename:f.filename, status:f.status, additions:f.additions, deletions:f.deletions, changes:f.changes})),
      reviews: reviews.map(r=>({user:r.user?.login, state:r.state, submitted_at:r.submitted_at, body_excerpt:(r.body||'').slice(0,300)})),
      comments_count: comments.length,
      review_comments_count: review_comments.length,
      check_runs: checks ? checks.check_runs?.map(c=>({name:c.name, status:c.status, conclusion:c.conclusion, html_url:c.html_url})) : null,
      diff
    };
  }

  // SUPER TOOL: github_setup_branch_protection
  // Apply a sensible-defaults branch protection ruleset
  if (tool === 'github_setup_branch_protection') {
    const { branch = 'main', required_checks = [], required_reviewers = 1, require_codeowners = false, dismiss_stale = true, enforce_admins = false } = args;
    const body = {
      required_status_checks: required_checks.length ? { strict: true, contexts: required_checks } : null,
      enforce_admins,
      required_pull_request_reviews: { dismiss_stale_reviews: dismiss_stale, require_code_owner_reviews: require_codeowners, required_approving_review_count: required_reviewers },
      restrictions: null,
      allow_force_pushes: false,
      allow_deletions: false,
      required_linear_history: args.required_linear_history || false,
      required_conversation_resolution: args.required_conversation_resolution || true
    };
    return await gh('PUT', `/repos/${owner}/${repo}/branches/${branch}/protection`, body);
  }

  // SUPER TOOL: github_release_from_tag
  // Create a release from a tag + auto-generated notes
  if (tool === 'github_release_from_tag') {
    const { tag_name, name, target_commitish = 'main', previous_tag_name, draft = false, prerelease = false, generate_notes = true } = args;
    let body_text = args.body || '';
    if (generate_notes) {
      try {
        const notes = await gh('POST', `/repos/${owner}/${repo}/releases/generate-notes`, { tag_name, previous_tag_name, target_commitish });
        body_text = body_text + (body_text ? '\n\n' : '') + notes.body;
      } catch { /* fall back to manual body */ }
    }
    return await gh('POST', `/repos/${owner}/${repo}/releases`, { tag_name, name: name || tag_name, body: body_text, draft, prerelease, target_commitish });
  }

  // SUPER TOOL: github_repo_health_audit
  // Health snapshot: protection rules + secrets count + open PRs + recent runs + community profile
  if (tool === 'github_repo_health_audit') {
    const r = await gh('GET', `/repos/${owner}/${repo}`);
    const [protection, secrets, prs, runs, community, vulnAlerts] = await Promise.allSettled([
      gh('GET', `/repos/${owner}/${repo}/branches/${r.default_branch}/protection`),
      gh('GET', `/repos/${owner}/${repo}/actions/secrets`),
      gh('GET', `/repos/${owner}/${repo}/pulls?state=open&per_page=100`),
      gh('GET', `/repos/${owner}/${repo}/actions/runs?per_page=10`),
      gh('GET', `/repos/${owner}/${repo}/community/profile`),
      fetch(`${BASE}/repos/${owner}/${repo}/vulnerability-alerts`, { headers: headers() }).then(res => ({ enabled: res.status === 204 }))
    ]);
    const recent_runs = runs.status === 'fulfilled' ? runs.value.workflow_runs || [] : [];
    const failed_runs = recent_runs.filter(r => r.conclusion === 'failure').length;
    return {
      repo: minRepo(r),
      branch_protection: {
        protected: protection.status === 'fulfilled',
        enforce_admins: protection.status === 'fulfilled' ? protection.value.enforce_admins?.enabled : null,
        required_approving_review_count: protection.status === 'fulfilled' ? protection.value.required_pull_request_reviews?.required_approving_review_count : null
      },
      secrets_count: secrets.status === 'fulfilled' ? secrets.value.total_count : null,
      open_prs_count: prs.status === 'fulfilled' ? prs.value.length : null,
      stale_prs: prs.status === 'fulfilled' ? prs.value.filter(p => (Date.now() - new Date(p.updated_at).getTime()) > 30 * 86400 * 1000).length : null,
      recent_workflow_runs: recent_runs.length,
      failed_workflow_runs: failed_runs,
      vulnerability_alerts_enabled: vulnAlerts.status === 'fulfilled' ? vulnAlerts.value.enabled : null,
      community_health_score: community.status === 'fulfilled' ? community.value.health_percentage : null,
      has_readme: community.status === 'fulfilled' ? !!community.value.files?.readme : null,
      has_license: community.status === 'fulfilled' ? !!community.value.files?.license : null,
      has_code_of_conduct: community.status === 'fulfilled' ? !!community.value.files?.code_of_conduct : null
    };
  }

  // SUPER TOOL: github_safe_delete_merged_branches
  // List merged branches and optionally delete (excluding protected branches and a deny-list)
  if (tool === 'github_safe_delete_merged_branches') {
    const { default_branch = 'main', dry_run = true, exclude = [] } = args;
    const branches = await gh('GET', `/repos/${owner}/${repo}/branches?per_page=100`);
    const guard = new Set([default_branch, 'main', 'master', 'develop', 'dev', 'staging', 'production', ...exclude]);
    const candidates = [];
    for (const b of branches) {
      if (guard.has(b.name) || b.protected) continue;
      try {
        const cmp = await gh('GET', `/repos/${owner}/${repo}/compare/${default_branch}...${b.name}`);
        if (cmp.behind_by > 0 && cmp.ahead_by === 0) candidates.push(b.name);
      } catch { /* skip */ }
    }
    if (dry_run) return { dry_run: true, mergeable_count: candidates.length, would_delete: candidates };
    const results = [];
    for (const name of candidates) {
      try { await gh('DELETE', `/repos/${owner}/${repo}/git/refs/heads/${name}`); results.push({ branch: name, deleted: true }); }
      catch (e) { results.push({ branch: name, deleted: false, error: e.message }); }
    }
    return { dry_run: false, deleted_count: results.filter(r => r.deleted).length, results };
  }

  throw new Error(`Unknown GitHub tool: ${tool}`);
}

export default { execute };
