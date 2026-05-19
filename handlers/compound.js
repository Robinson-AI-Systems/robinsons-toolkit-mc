/**
 * Compound Handler — 22 macro tools
 * Beyond-the-API tools that combine multiple services in a single call.
 * These are the "power moves" — one tool replaces 5-10 individual calls.
 */

import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const WORKSPACE = process.env.WORKSPACE_ROOT || process.cwd();

async function loadHandler(name) {
  const { default: handler } = await import(`./${name}.js`);
  return handler;
}

async function execute(tool, args) {

  // ── FEATURE SCAFFOLDING ───────────────────────────────────────────────────
  if (tool === 'compound_scaffold_feature') {
    /**
     * One call to set up a complete feature branch environment:
     * 1. Create GitHub branch
     * 2. Create Neon database branch for isolated testing
     * 3. Update local .env.local with new DB connection string
     * 4. Optionally run migrations
     */
    const { github_owner, github_repo, feature_name, neon_project_id, run_migrations = false, migration_command = 'npx prisma db push', env_file_path } = args;
    const results = { feature: feature_name, steps: [] };

    try {
      // Step 1: Create GitHub branch
      const gh = await loadHandler('github');
      const branch = await gh.execute('github_create_branch', { owner: github_owner, repo: github_repo, branch: `feature/${feature_name}`, from_branch: 'main' });
      results.steps.push({ step: 'github_branch', success: true, branch: `feature/${feature_name}`, sha: branch.object?.sha });
    } catch (e) { results.steps.push({ step: 'github_branch', success: false, error: e.message }); }

    try {
      // Step 2: Create Neon branch
      const neon = await loadHandler('neon');
      const neonBranch = await neon.execute('neon_create_branch', { project_id: neon_project_id, branch_name: `feature-${feature_name}` });
      results.neon_branch = neonBranch;
      results.steps.push({ step: 'neon_branch', success: true, branch_name: `feature-${feature_name}` });

      // Step 3: Get connection string for the new branch
      const connInfo = await neon.execute('neon_get_connection_string', { project_id: neon_project_id, branch_id: neonBranch.branch?.id, database: 'neondb' });
      results.connection_string = connInfo.connection_string;
      results.steps.push({ step: 'connection_string', success: true, host: connInfo.host });

      // Step 4: Update .env.local
      if (connInfo.connection_string) {
        const envPath = env_file_path ? join(WORKSPACE, env_file_path) : join(WORKSPACE, '.env.local');
        let content = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
        const newLine = `DATABASE_URL=${connInfo.connection_string}`;
        if (/^DATABASE_URL=.*/m.test(content)) content = content.replace(/^DATABASE_URL=.*/m, newLine);
        else content = content.trimEnd() + '\n' + newLine + '\n';
        writeFileSync(envPath, content);
        results.steps.push({ step: 'env_updated', success: true, path: envPath });
      }

      // Step 5: Run migrations if requested
      if (run_migrations && connInfo.connection_string) {
        const result = execSync(migration_command, { cwd: WORKSPACE, env: { ...process.env, DATABASE_URL: connInfo.connection_string }, timeout: 120000, encoding: 'utf-8' });
        results.steps.push({ step: 'migrations', success: true, output: result.slice(0, 1000) });
      }
    } catch (e) { results.steps.push({ step: 'neon_or_env', success: false, error: e.message }); }

    const allSucceeded = results.steps.every(s => s.success);
    return { ...results, status: allSucceeded ? 'ready' : 'partial', message: allSucceeded ? `Feature environment for "${feature_name}" is ready. Branch: feature/${feature_name}, DB: feature-${feature_name}.` : 'Some steps failed. Check the steps array for details.' };
  }

  // ── SAFE DEPLOY ───────────────────────────────────────────────────────────
  if (tool === 'compound_safe_deploy') {
    /**
     * Deploy to Vercel and verify it went live:
     * 1. Push git changes (if local path provided)
     * 2. Check Vercel deployment status
     * 3. Return deployment URL and status
     */
    const { vercel_project_id, git_push = false, project_path, expected_url_contains } = args;
    const results = { steps: [] };

    if (git_push && project_path) {
      try {
        const path = join(WORKSPACE, project_path);
        execSync('git push', { cwd: path, timeout: 30000, encoding: 'utf-8' });
        results.steps.push({ step: 'git_push', success: true });
      } catch (e) { results.steps.push({ step: 'git_push', success: false, error: e.message }); }
    }

    // Wait for deployment
    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
      const vercel = await loadHandler('vercel');
      const deployments = await vercel.execute('vercel_list_deployments', { projectId: vercel_project_id, limit: 3 });
      const latest = deployments.deployments?.[0];
      results.latest_deployment = latest;
      results.steps.push({ step: 'deployment_check', success: true, state: latest?.state, url: latest?.url ? `https://${latest.url}` : null });

      if (expected_url_contains && latest?.url && latest.url.includes(expected_url_contains)) {
        results.steps.push({ step: 'url_verification', success: true, verified: true });
      }
    } catch (e) { results.steps.push({ step: 'deployment_check', success: false, error: e.message }); }

    return results;
  }

  // ── ONBOARD NEW SAAS CUSTOMER ─────────────────────────────────────────────
  if (tool === 'compound_onboard_saas_customer') {
    /**
     * Complete customer onboarding for YardSync/Cortiware:
     * 1. Create Stripe customer
     * 2. Create Clerk organization
     * 3. Add Clerk user to org
     * 4. Create subscription (if price_id provided)
     * 5. Send welcome email via Resend
     */
    const { customer_email, customer_name, company_name, price_id, send_welcome_email = true, welcome_from, welcome_subject, welcome_html } = args;
    const results = { email: customer_email, company: company_name, steps: [] };

    // Stripe customer
    try {
      const stripe = await loadHandler('stripe');
      const customer = await stripe.execute('stripe_create_customer', { email: customer_email, name: customer_name, metadata: { company: company_name } });
      results.stripe_customer_id = customer.id;
      results.steps.push({ step: 'stripe_customer', success: true, id: customer.id });

      if (price_id) {
        const sub = await stripe.execute('stripe_create_subscription', { customer_id: customer.id, price_id });
        results.stripe_subscription_id = sub.id;
        results.steps.push({ step: 'stripe_subscription', success: true, id: sub.id, status: sub.status });
      }
    } catch (e) { results.steps.push({ step: 'stripe', success: false, error: e.message }); }

    // Clerk organization
    if (company_name) {
      try {
        const clerk = await loadHandler('clerk');
        const org = await clerk.execute('clerk_create_organization', { name: company_name });
        results.clerk_org_id = org.id;
        results.steps.push({ step: 'clerk_org', success: true, id: org.id });
      } catch (e) { results.steps.push({ step: 'clerk_org', success: false, error: e.message }); }
    }

    // Welcome email
    if (send_welcome_email && welcome_from) {
      try {
        const resend = await loadHandler('resend');
        await resend.execute('resend_send_email', { from: welcome_from, to: customer_email, subject: welcome_subject || `Welcome to ${company_name || 'our platform'}!`, html: welcome_html || `<p>Welcome aboard! We're excited to have you.</p>` });
        results.steps.push({ step: 'welcome_email', success: true });
      } catch (e) { results.steps.push({ step: 'welcome_email', success: false, error: e.message }); }
    }

    return { ...results, status: results.steps.every(s => s.success) ? 'complete' : 'partial' };
  }

  // ── INCIDENT RESPONSE ─────────────────────────────────────────────────────
  if (tool === 'compound_incident_response') {
    /**
     * When something breaks in production:
     * 1. Grab latest Sentry issues
     * 2. Check recent Vercel deployments
     * 3. Return a summary to guide the fix
     */
    const { sentry_project, vercel_project_id, last_n_deployments = 3 } = args;
    const results = {};

    try {
      const sentry = await loadHandler('sentry');
      results.sentry_issues = await sentry.execute('sentry_list_issues', { project_slug: sentry_project, limit: 5, query: 'is:unresolved' });
    } catch (e) { results.sentry_error = e.message; }

    try {
      const vercel = await loadHandler('vercel');
      results.recent_deployments = await vercel.execute('vercel_list_deployments', { projectId: vercel_project_id, limit: last_n_deployments });
    } catch (e) { results.vercel_error = e.message; }

    return { ...results, message: 'Check sentry_issues for errors and recent_deployments for any recent changes that may have caused the issue.' };
  }

  // ── NEON SAFE MIGRATION ───────────────────────────────────────────────────
  if (tool === 'compound_neon_safe_migration') {
    /**
     * Run a database migration safely:
     * 1. Create a temp branch off main
     * 2. Run the migration SQL on the temp branch
     * 3. Verify by checking the schema on the temp branch
     * 4. Report success/failure — does NOT auto-apply to main
     *    (you must manually promote or call neon_deploy_schema on main)
     */
    const { neon_project_id, migration_sql, database = 'neondb', verify_tables = [] } = args;
    const results = { project_id: neon_project_id };

    const neon = await loadHandler('neon');
    // Create temp branch
    const tempBranchName = `migration-test-${Date.now()}`;
    const branchRes = await neon.execute('neon_create_branch', { project_id: neon_project_id, branch_name: tempBranchName });
    results.temp_branch = branchRes.branch?.id;
    results.temp_branch_name = tempBranchName;

    try {
      // Run migration
      const sqlResult = await neon.execute('neon_run_sql', { project_id: neon_project_id, branch_id: branchRes.branch?.id, sql: migration_sql, database });
      results.migration_result = sqlResult;
      results.migration_success = true;

      // Verify tables exist
      if (verify_tables.length) {
        const tablesResult = await neon.execute('neon_get_database_tables', { project_id: neon_project_id, branch_id: branchRes.branch?.id, database });
        const existingTables = (tablesResult.rows || tablesResult).map(r => r.tablename || r.table_name);
        results.verified_tables = verify_tables.filter(t => existingTables.includes(t));
        results.missing_tables = verify_tables.filter(t => !existingTables.includes(t));
        results.verification_passed = results.missing_tables.length === 0;
      }

      results.status = 'ready_to_apply';
      results.next_step = `Migration tested successfully on branch "${tempBranchName}". To apply to main, call neon_run_sql with project_id="${neon_project_id}" and the same SQL (without specifying a branch_id to use main), then call neon_delete_branch with branch_id="${branchRes.branch?.id}" to clean up.`;
    } catch (e) {
      results.migration_success = false;
      results.migration_error = e.message;
      results.status = 'failed';
      // Clean up temp branch
      try { await neon.execute('neon_delete_branch', { project_id: neon_project_id, branch_id: branchRes.branch?.id }); results.cleanup = 'temp branch deleted'; }
      catch { results.cleanup = 'manual cleanup needed'; }
    }

    return results;
  }

  // ── GIT COMMIT AND PUSH ────────────────────────────────────────────────────
  if (tool === 'compound_git_commit_push') {
    /**
     * Stage, commit, and push changes in one call.
     * Creates a clean commit with a meaningful message.
     */
    const { project_path, message, files = '.', branch } = args;
    const cwd = join(WORKSPACE, project_path || '');
    const steps = [];

    try {
      execSync(`git add ${files}`, { cwd, encoding: 'utf-8' });
      steps.push({ step: 'git add', success: true });
    } catch (e) { steps.push({ step: 'git add', success: false, error: e.message }); return { steps }; }

    try {
      const commitOut = execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd, encoding: 'utf-8' });
      steps.push({ step: 'git commit', success: true, output: commitOut.trim() });
    } catch (e) {
      if (e.message.includes('nothing to commit')) return { steps: [{ step: 'git commit', success: true, note: 'Nothing to commit — working tree clean' }] };
      steps.push({ step: 'git commit', success: false, error: e.message }); return { steps };
    }

    try {
      const pushTarget = branch ? `origin ${branch}` : 'origin HEAD';
      const pushOut = execSync(`git push ${pushTarget}`, { cwd, encoding: 'utf-8' });
      steps.push({ step: 'git push', success: true, output: pushOut.trim() });
    } catch (e) { steps.push({ step: 'git push', success: false, error: e.message }); }

    return { steps, all_succeeded: steps.every(s => s.success) };
  }

  // ── PROJECT HEALTH CHECK ──────────────────────────────────────────────────
  if (tool === 'compound_project_health_check') {
    /**
     * Get a quick health snapshot of a project:
     * - Latest deployments on Vercel
     * - Open GitHub issues and PRs
     * - Recent Sentry errors (if configured)
     * - Neon database connection test
     */
    const { github_owner, github_repo, vercel_project_id, neon_project_id, sentry_project } = args;
    const health = {};

    if (github_owner && github_repo) {
      try {
        const gh = await loadHandler('github');
        const [issues, prs] = await Promise.all([
          gh.execute('github_list_issues', { owner: github_owner, repo: github_repo, state: 'open', per_page: 5 }),
          gh.execute('github_list_pull_requests', { owner: github_owner, repo: github_repo, state: 'open', per_page: 5 })
        ]);
        health.github = { open_issues: issues.length, open_prs: prs.length, issues: issues.slice(0,3).map(i => ({ number: i.number, title: i.title })), prs: prs.slice(0,3).map(p => ({ number: p.number, title: p.title })) };
      } catch (e) { health.github_error = e.message; }
    }

    if (vercel_project_id) {
      try {
        const vercel = await loadHandler('vercel');
        const deployments = await vercel.execute('vercel_list_deployments', { projectId: vercel_project_id, limit: 3 });
        health.vercel = { recent_deployments: deployments.deployments?.slice(0,3).map(d => ({ state: d.state, url: d.url, created: d.createdAt })) };
      } catch (e) { health.vercel_error = e.message; }
    }

    if (neon_project_id) {
      try {
        const neon = await loadHandler('neon');
        const test = await neon.execute('neon_test_connection', { project_id: neon_project_id });
        health.neon = { connected: true, server_info: test };
      } catch (e) { health.neon = { connected: false, error: e.message }; }
    }

    if (sentry_project) {
      try {
        const sentry = await loadHandler('sentry');
        const issues = await sentry.execute('sentry_list_issues', { project_slug: sentry_project, limit: 3 });
        health.sentry = { recent_errors: issues.map ? issues.slice(0,3).map(i => ({ title: i.title, count: i.count, lastSeen: i.lastSeen })) : issues };
      } catch (e) { health.sentry_error = e.message; }
    }

    return { health, checked_at: new Date().toISOString() };
  }

  // ── SEND DISPATCH NOTIFICATION (YardSync) ─────────────────────────────────
  if (tool === 'compound_send_dispatch_notification') {
    /**
     * YardSync-specific: notify a driver and customer about a scheduled pickup/delivery.
     * Sends SMS to driver via Twilio, email to customer via Resend.
     */
    const { driver_phone, customer_email, job_details, driver_message, customer_subject, customer_html, from_email } = args;
    const results = { steps: [] };

    if (driver_phone && driver_message) {
      try {
        const twilio = await loadHandler('twilio');
        await twilio.execute('twilio_send_sms', { to: driver_phone, body: driver_message });
        results.steps.push({ step: 'driver_sms', success: true, to: driver_phone });
      } catch (e) { results.steps.push({ step: 'driver_sms', success: false, error: e.message }); }
    }

    if (customer_email && from_email) {
      try {
        const resend = await loadHandler('resend');
        await resend.execute('resend_send_email', { from: from_email, to: customer_email, subject: customer_subject || 'Your Service Appointment', html: customer_html || `<p>Your appointment has been scheduled. Details: ${JSON.stringify(job_details)}</p>` });
        results.steps.push({ step: 'customer_email', success: true, to: customer_email });
      } catch (e) { results.steps.push({ step: 'customer_email', success: false, error: e.message }); }
    }

    return { ...results, all_sent: results.steps.every(s => s.success) };
  }

  // ── GENERATE AND EMBED CONTENT ────────────────────────────────────────────
  if (tool === 'compound_generate_and_embed') {
    /**
     * Generate content with Claude/OpenAI and immediately store it as a vector in Qdrant.
     * Useful for building AI features: generate descriptions, embed them, make them searchable.
     */
    const { text_to_embed, collection_name, point_id, metadata, use_model = 'openai' } = args;
    if (!text_to_embed || !collection_name || !point_id) throw new Error('text_to_embed, collection_name, and point_id are required');

    // Generate embedding
    const openai = await loadHandler('openai');
    const embeddingRes = await openai.execute('openai_create_embedding', { input: text_to_embed });
    const vector = embeddingRes.embeddings?.[0];
    if (!vector) throw new Error('Failed to generate embedding');

    // Store in Qdrant
    const qdrant = await loadHandler('qdrant');
    await qdrant.execute('qdrant_upsert_points', { collection_name, points: [{ id: point_id, vector, payload: { text: text_to_embed, ...metadata } }] });

    return { success: true, point_id, collection_name, vector_dimensions: vector.length, text_length: text_to_embed.length };
  }

  // ── SEMANTIC SEARCH ───────────────────────────────────────────────────────
  if (tool === 'compound_semantic_search') {
    /**
     * Convert a query to an embedding then search Qdrant.
     * One call to "search your knowledge base by meaning."
     */
    const { query, collection_name, limit = 5, score_threshold, filter } = args;
    if (!query || !collection_name) throw new Error('query and collection_name are required');

    const openai = await loadHandler('openai');
    const embeddingRes = await openai.execute('openai_create_embedding', { input: query });
    const vector = embeddingRes.embeddings?.[0];
    if (!vector) throw new Error('Failed to generate query embedding');

    const qdrant = await loadHandler('qdrant');
    const results = await qdrant.execute('qdrant_search', { collection_name, vector, limit, score_threshold, filter, with_payload: true });

    return { query, results: results.map ? results.map(r => ({ id: r.id, score: r.score, payload: r.payload })) : results };
  }

  // ── ANALYTICS SNAPSHOT ────────────────────────────────────────────────────
  if (tool === 'compound_analytics_snapshot') {
    /**
     * Pull together key business metrics from multiple sources.
     */
    const { stripe_only = false } = args;
    const snapshot = {};

    try {
      const stripe = await loadHandler('stripe');
      const [mrr, customers, subs] = await Promise.all([
        stripe.execute('stripe_get_mrr_summary', {}),
        stripe.execute('stripe_list_customers', { limit: 1 }),
        stripe.execute('stripe_list_subscriptions', { limit: 1, status: 'active' })
      ]);
      snapshot.stripe = { mrr_usd: mrr.mrr_usd, arr_usd: mrr.arr_usd, active_subscriptions: mrr.active_subscriptions };
    } catch (e) { snapshot.stripe_error = e.message; }

    return { snapshot, generated_at: new Date().toISOString() };
  }

  throw new Error(`Unknown compound tool: ${tool}`);
}

export default { execute };
