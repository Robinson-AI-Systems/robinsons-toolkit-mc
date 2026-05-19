/**
 * Compound Handler — 36 macro tools
 * Cross-service Super Tools that orchestrate multiple APIs in a single call.
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
    const { github_owner, github_repo, feature_name, neon_project_id, run_migrations = false, migration_command = 'npx prisma db push', env_file_path } = args;
    const results = { feature: feature_name, steps: [] };
    try {
      const gh = await loadHandler('github');
      const branch = await gh.execute('github_create_branch', { owner: github_owner, repo: github_repo, branch: `feature/${feature_name}`, from_branch: 'main' });
      results.steps.push({ step: 'github_branch', success: true, branch: `feature/${feature_name}`, sha: branch.object?.sha });
    } catch (e) { results.steps.push({ step: 'github_branch', success: false, error: e.message }); }
    try {
      const neon = await loadHandler('neon');
      const neonBranch = await neon.execute('neon_create_branch', { project_id: neon_project_id, branch_name: `feature-${feature_name}` });
      results.neon_branch = neonBranch;
      results.steps.push({ step: 'neon_branch', success: true, branch_name: `feature-${feature_name}` });
      const connInfo = await neon.execute('neon_get_connection_string', { project_id: neon_project_id, branch_id: neonBranch.branch?.id, database: 'neondb' });
      results.connection_string = connInfo.connection_string;
      results.steps.push({ step: 'connection_string', success: true, host: connInfo.host });
      if (connInfo.connection_string) {
        const envPath = env_file_path ? join(WORKSPACE, env_file_path) : join(WORKSPACE, '.env.local');
        let content = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
        const newLine = `DATABASE_URL=${connInfo.connection_string}`;
        if (/^DATABASE_URL=.*/m.test(content)) content = content.replace(/^DATABASE_URL=.*/m, newLine);
        else content = content.trimEnd() + '\n' + newLine + '\n';
        writeFileSync(envPath, content);
        results.steps.push({ step: 'env_updated', success: true, path: envPath });
      }
      if (run_migrations && connInfo.connection_string) {
        const result = execSync(migration_command, { cwd: WORKSPACE, env: { ...process.env, DATABASE_URL: connInfo.connection_string }, timeout: 120000, encoding: 'utf-8' });
        results.steps.push({ step: 'migrations', success: true, output: result.slice(0, 1000) });
      }
    } catch (e) { results.steps.push({ step: 'neon_or_env', success: false, error: e.message }); }
    const allSucceeded = results.steps.every(s => s.success);
    return { ...results, status: allSucceeded ? 'ready' : 'partial', message: allSucceeded ? `Feature environment for "${feature_name}" is ready.` : 'Some steps failed.' };
  }

  // ── SAFE DEPLOY ───────────────────────────────────────────────────────────
  if (tool === 'compound_safe_deploy') {
    const { vercel_project_id, git_push = false, project_path } = args;
    const results = { steps: [] };
    if (git_push && project_path) {
      try { execSync('git push', { cwd: join(WORKSPACE, project_path), timeout: 30000, encoding: 'utf-8' }); results.steps.push({ step: 'git_push', success: true }); }
      catch (e) { results.steps.push({ step: 'git_push', success: false, error: e.message }); }
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
    try {
      const vercel = await loadHandler('vercel');
      const deployments = await vercel.execute('vercel_list_deployments', { projectId: vercel_project_id, limit: 3 });
      const latest = deployments.deployments?.[0];
      results.latest_deployment = latest;
      results.steps.push({ step: 'deployment_check', success: true, state: latest?.state, url: latest?.url ? `https://${latest.url}` : null });
    } catch (e) { results.steps.push({ step: 'deployment_check', success: false, error: e.message }); }
    return results;
  }

  // ── ONBOARD NEW SAAS CUSTOMER ─────────────────────────────────────────────
  if (tool === 'compound_onboard_saas_customer') {
    const { customer_email, customer_name, company_name, price_id, send_welcome_email = true, welcome_from, welcome_subject, welcome_html } = args;
    const results = { email: customer_email, company: company_name, steps: [] };
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
    if (company_name) {
      try {
        const clerk = await loadHandler('clerk');
        const org = await clerk.execute('clerk_create_organization', { name: company_name });
        results.clerk_org_id = org.id;
        results.steps.push({ step: 'clerk_org', success: true, id: org.id });
      } catch (e) { results.steps.push({ step: 'clerk_org', success: false, error: e.message }); }
    }
    if (send_welcome_email && welcome_from) {
      try {
        const resend = await loadHandler('resend');
        await resend.execute('resend_send_email', { from: welcome_from, to: customer_email, subject: welcome_subject || 'Welcome!', html: welcome_html || '<p>Welcome aboard!</p>' });
        results.steps.push({ step: 'welcome_email', success: true });
      } catch (e) { results.steps.push({ step: 'welcome_email', success: false, error: e.message }); }
    }
    return { ...results, status: results.steps.every(s => s.success) ? 'complete' : 'partial' };
  }

  // ── INCIDENT RESPONSE ─────────────────────────────────────────────────────
  if (tool === 'compound_incident_response') {
    const { sentry_project, vercel_project_id, last_n_deployments = 3 } = args;
    const results = {};
    try { const sentry = await loadHandler('sentry'); results.sentry_issues = await sentry.execute('sentry_list_issues', { project_slug: sentry_project, limit: 5, query: 'is:unresolved' }); } catch (e) { results.sentry_error = e.message; }
    try { const vercel = await loadHandler('vercel'); results.recent_deployments = await vercel.execute('vercel_list_deployments', { projectId: vercel_project_id, limit: last_n_deployments }); } catch (e) { results.vercel_error = e.message; }
    return { ...results, message: 'Check sentry_issues for errors and recent_deployments for recent changes.' };
  }

  // ── NEON SAFE MIGRATION ───────────────────────────────────────────────────
  if (tool === 'compound_neon_safe_migration') {
    const { neon_project_id, migration_sql, database = 'neondb', verify_tables = [] } = args;
    const results = { project_id: neon_project_id };
    const neon = await loadHandler('neon');
    const tempBranchName = `migration-test-${Date.now()}`;
    const branchRes = await neon.execute('neon_create_branch', { project_id: neon_project_id, branch_name: tempBranchName });
    results.temp_branch = branchRes.branch?.id;
    results.temp_branch_name = tempBranchName;
    try {
      const sqlResult = await neon.execute('neon_run_sql', { project_id: neon_project_id, branch_id: branchRes.branch?.id, sql: migration_sql, database });
      results.migration_result = sqlResult;
      results.migration_success = true;
      if (verify_tables.length) {
        const tablesResult = await neon.execute('neon_get_database_tables', { project_id: neon_project_id, branch_id: branchRes.branch?.id, database });
        const existingTables = (tablesResult.rows || tablesResult).map(r => r.tablename || r.table_name);
        results.verified_tables = verify_tables.filter(t => existingTables.includes(t));
        results.missing_tables = verify_tables.filter(t => !existingTables.includes(t));
      }
      results.status = 'ready_to_apply';
    } catch (e) {
      results.migration_success = false; results.migration_error = e.message; results.status = 'failed';
      try { await neon.execute('neon_delete_branch', { project_id: neon_project_id, branch_id: branchRes.branch?.id }); } catch {}
    }
    return results;
  }

  // ── GIT COMMIT AND PUSH ────────────────────────────────────────────────────
  if (tool === 'compound_git_commit_push') {
    const { project_path, message, files = '.', branch } = args;
    const cwd = join(WORKSPACE, project_path || '');
    const steps = [];
    try { execSync(`git add ${files}`, { cwd, encoding: 'utf-8' }); steps.push({ step: 'git add', success: true }); } catch (e) { steps.push({ step: 'git add', success: false, error: e.message }); return { steps }; }
    try { const out = execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd, encoding: 'utf-8' }); steps.push({ step: 'git commit', success: true, output: out.trim() }); }
    catch (e) {
      if (e.message.includes('nothing to commit')) return { steps: [{ step: 'git commit', success: true, note: 'Nothing to commit' }] };
      steps.push({ step: 'git commit', success: false, error: e.message }); return { steps };
    }
    try { const out = execSync(`git push ${branch ? `origin ${branch}` : 'origin HEAD'}`, { cwd, encoding: 'utf-8' }); steps.push({ step: 'git push', success: true, output: out.trim() }); } catch (e) { steps.push({ step: 'git push', success: false, error: e.message }); }
    return { steps, all_succeeded: steps.every(s => s.success) };
  }

  // ── PROJECT HEALTH CHECK ──────────────────────────────────────────────────
  if (tool === 'compound_project_health_check') {
    const { github_owner, github_repo, vercel_project_id, neon_project_id, sentry_project } = args;
    const health = {};
    if (github_owner && github_repo) {
      try {
        const gh = await loadHandler('github');
        const [issues, prs] = await Promise.all([gh.execute('github_list_issues', { owner: github_owner, repo: github_repo, state: 'open', per_page: 5 }), gh.execute('github_list_pull_requests', { owner: github_owner, repo: github_repo, state: 'open', per_page: 5 })]);
        health.github = { open_issues: issues.length, open_prs: prs.length };
      } catch (e) { health.github_error = e.message; }
    }
    if (vercel_project_id) {
      try { const vercel = await loadHandler('vercel'); const d = await vercel.execute('vercel_list_deployments', { projectId: vercel_project_id, limit: 3 }); health.vercel = { recent: d.deployments?.slice(0,3).map(x => ({ state: x.state, url: x.url })) }; } catch (e) { health.vercel_error = e.message; }
    }
    if (neon_project_id) {
      try { const neon = await loadHandler('neon'); const test = await neon.execute('neon_test_connection', { project_id: neon_project_id }); health.neon = { connected: true }; } catch (e) { health.neon = { connected: false, error: e.message }; }
    }
    if (sentry_project) {
      try { const sentry = await loadHandler('sentry'); const issues = await sentry.execute('sentry_list_issues', { project_slug: sentry_project, limit: 3 }); health.sentry = { recent_errors: issues.length || 0 }; } catch (e) { health.sentry_error = e.message; }
    }
    return { health, checked_at: new Date().toISOString() };
  }

  // ── SEND DISPATCH NOTIFICATION ────────────────────────────────────────────
  if (tool === 'compound_send_dispatch_notification') {
    const { driver_phone, customer_email, job_details, driver_message, customer_subject, customer_html, from_email } = args;
    const results = { steps: [] };
    if (driver_phone && driver_message) {
      try { const twilio = await loadHandler('twilio'); await twilio.execute('twilio_send_sms', { to: driver_phone, body: driver_message }); results.steps.push({ step: 'driver_sms', success: true }); } catch (e) { results.steps.push({ step: 'driver_sms', success: false, error: e.message }); }
    }
    if (customer_email && from_email) {
      try { const resend = await loadHandler('resend'); await resend.execute('resend_send_email', { from: from_email, to: customer_email, subject: customer_subject || 'Your Service Appointment', html: customer_html || '<p>Your appointment is scheduled.</p>' }); results.steps.push({ step: 'customer_email', success: true }); } catch (e) { results.steps.push({ step: 'customer_email', success: false, error: e.message }); }
    }
    return { ...results, all_sent: results.steps.every(s => s.success) };
  }

  // ── GENERATE AND EMBED ────────────────────────────────────────────────────
  if (tool === 'compound_generate_and_embed') {
    const { text_to_embed, collection_name, point_id, metadata } = args;
    if (!text_to_embed || !collection_name || !point_id) throw new Error('text_to_embed, collection_name, and point_id are required');
    const openai = await loadHandler('openai');
    const embeddingRes = await openai.execute('openai_create_embedding', { input: text_to_embed });
    const vector = embeddingRes.embeddings?.[0];
    if (!vector) throw new Error('Failed to generate embedding');
    const qdrant = await loadHandler('qdrant');
    await qdrant.execute('qdrant_upsert_points', { collection_name, points: [{ id: point_id, vector, payload: { text: text_to_embed, ...metadata } }] });
    return { success: true, point_id, collection_name, vector_dimensions: vector.length };
  }

  // ── SEMANTIC SEARCH ───────────────────────────────────────────────────────
  if (tool === 'compound_semantic_search') {
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
    const snapshot = {};
    try {
      const stripe = await loadHandler('stripe');
      const mrr = await stripe.execute('stripe_get_mrr_summary', {});
      snapshot.stripe = { mrr_usd: mrr.mrr_usd, arr_usd: mrr.arr_usd, active_subscriptions: mrr.active_subscriptions };
    } catch (e) { snapshot.stripe_error = e.message; }
    return { snapshot, generated_at: new Date().toISOString() };
  }

  // ── DEPLOY AND RELEASE ────────────────────────────────────────────────────
  // Deploy to Vercel + create Sentry release + log deployment
  if (tool === 'compound_deploy_and_release') {
    const { version, project_path, vercel_project_id, sentry_project, environment = 'production', git_push = true } = args;
    if (!version) throw new Error('version is required (e.g. "1.2.0" or git SHA)');
    const results = { version, steps: [] };

    if (git_push && project_path) {
      try { execSync('git push', { cwd: join(WORKSPACE, project_path), timeout: 30000, encoding: 'utf-8' }); results.steps.push({ step: 'git_push', success: true }); }
      catch (e) { results.steps.push({ step: 'git_push', success: false, error: e.message }); }
    }

    if (sentry_project) {
      try {
        const sentry = await loadHandler('sentry');
        await sentry.execute('sentry_deploy_release', { version, environment, project_slug: sentry_project });
        results.steps.push({ step: 'sentry_release', success: true, version, environment });
      } catch (e) { results.steps.push({ step: 'sentry_release', success: false, error: e.message }); }
    }

    if (vercel_project_id) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const vercel = await loadHandler('vercel');
        const d = await vercel.execute('vercel_list_deployments', { projectId: vercel_project_id, limit: 1 });
        const latest = d.deployments?.[0];
        results.deployment = { state: latest?.state, url: latest?.url ? `https://${latest.url}` : null };
        results.steps.push({ step: 'vercel_deploy', success: true, state: latest?.state });
      } catch (e) { results.steps.push({ step: 'vercel_deploy', success: false, error: e.message }); }
    }

    return { ...results, all_succeeded: results.steps.every(s => s.success) };
  }

  // ── CUSTOMER OFFBOARDING ──────────────────────────────────────────────────
  // Cancel Stripe sub + ban Clerk user + add to Sentry breadcrumb
  if (tool === 'compound_customer_offboard') {
    const { stripe_customer_id, clerk_user_id, reason = 'cancellation', notify_email, from_email, app_name = 'our service' } = args;
    const results = { steps: [] };

    if (stripe_customer_id) {
      try {
        const stripe = await loadHandler('stripe');
        const subs = await stripe.execute('stripe_list_subscriptions', { customer_id: stripe_customer_id, status: 'active', limit: 5 });
        for (const sub of subs.data || []) {
          await stripe.execute('stripe_cancel_subscription', { subscription_id: sub.id, at_period_end: false });
          results.steps.push({ step: 'cancel_subscription', success: true, sub_id: sub.id });
        }
      } catch (e) { results.steps.push({ step: 'cancel_subscription', success: false, error: e.message }); }
    }

    if (clerk_user_id) {
      try {
        const clerk = await loadHandler('clerk');
        await clerk.execute('clerk_offboard_user', { user_id: clerk_user_id });
        results.steps.push({ step: 'clerk_offboard', success: true });
      } catch (e) { results.steps.push({ step: 'clerk_offboard', success: false, error: e.message }); }
    }

    if (notify_email && from_email) {
      try {
        const resend = await loadHandler('resend');
        await resend.execute('resend_send_email', { from: from_email, to: notify_email, subject: `Account deactivated — ${app_name}`, html: `<p>Your account has been deactivated. Reason: ${reason}. Contact support if this was an error.</p>` });
        results.steps.push({ step: 'offboard_email', success: true });
      } catch (e) { results.steps.push({ step: 'offboard_email', success: false, error: e.message }); }
    }

    return { ...results, offboarded: results.steps.filter(s => s.success).length > 0 };
  }

  // ── PAYMENT FAILED DUNNING ────────────────────────────────────────────────
  // Find past-due Stripe subscriptions and send reminder emails
  if (tool === 'compound_payment_failed_flow') {
    const { from_email, subject, app_name = 'our service', update_url } = args;
    if (!from_email) throw new Error('from_email is required');

    const stripe = await loadHandler('stripe');
    const pastDue = await stripe.execute('stripe_dunning_check', {});
    const results = { past_due_count: pastDue.past_due_count, emails_sent: 0, failed: [] };

    const resend = await loadHandler('resend');
    for (const sub of pastDue.subscriptions || []) {
      if (!sub.customer_email) continue;
      try {
        await resend.execute('resend_send_email', {
          from: from_email, to: sub.customer_email,
          subject: subject || `Action required: Update your payment for ${app_name}`,
          html: `<p>Hi ${sub.customer_name || 'there'},</p><p>Your payment for ${app_name} failed. Please ${update_url ? `<a href="${update_url}">update your payment method</a>` : 'update your payment method'} to avoid service interruption.</p><p>Amount due: $${sub.amount}</p>`
        });
        results.emails_sent++;
      } catch (e) { results.failed.push({ email: sub.customer_email, error: e.message }); }
    }
    return results;
  }

  // ── CUSTOMER SUPPORT CONTEXT ──────────────────────────────────────────────
  // Pull together everything about a customer for a support agent
  if (tool === 'compound_customer_support_context') {
    const { email, stripe_customer_id, clerk_user_id, sentry_project } = args;
    const context = { email };

    if (stripe_customer_id) {
      try {
        const stripe = await loadHandler('stripe');
        context.billing = await stripe.execute('stripe_customer_billing_summary', { customer_id: stripe_customer_id });
      } catch (e) { context.billing_error = e.message; }
    }

    if (clerk_user_id) {
      try {
        const clerk = await loadHandler('clerk');
        context.auth = await clerk.execute('clerk_get_user_profile', { user_id: clerk_user_id });
      } catch (e) { context.auth_error = e.message; }
    }

    if (sentry_project && email) {
      try {
        const sentry = await loadHandler('sentry');
        context.recent_errors = await sentry.execute('sentry_list_issues', { project_slug: sentry_project, limit: 5, query: `is:unresolved user.email:${email}` });
      } catch (e) { context.errors_error = e.message; }
    }

    return { ...context, generated_at: new Date().toISOString() };
  }

  // ── LOCAL LLM RAG ─────────────────────────────────────────────────────────
  // Embed query locally (Ollama) → search Qdrant → generate answer with context (Ollama)
  if (tool === 'compound_local_llm_rag') {
    const { query, collection_name, ollama_model, system_instruction, limit = 3, score_threshold = 0.6 } = args;
    if (!query || !collection_name) throw new Error('query and collection_name are required');

    const ollama = await loadHandler('ollama');
    const embedRes = await ollama.execute('ollama_embed', { input: query });
    const vector = Array.isArray(embedRes.embeddings) ? embedRes.embeddings : embedRes.embeddings?.[0];
    if (!vector) throw new Error('Ollama embedding failed');

    const qdrant = await loadHandler('qdrant');
    const searchResults = await qdrant.execute('qdrant_search', { collection_name, vector, limit, score_threshold, with_payload: true });
    const contexts = (Array.isArray(searchResults) ? searchResults : []).map(r => r.payload?.text || JSON.stringify(r.payload)).filter(Boolean);

    if (!contexts.length) return { query, answer: 'No relevant context found.', sources: [] };

    const contextText = contexts.map((c, i) => `[${i+1}] ${c}`).join('\n\n');
    const prompt = `Based on the following context, answer the question.\n\nContext:\n${contextText}\n\nQuestion: ${query}`;
    const genRes = await ollama.execute('ollama_generate', { model: ollama_model, prompt, system_instruction: system_instruction || 'Answer based only on the provided context. Be concise.' });

    return { query, answer: genRes.text, sources: searchResults.map ? searchResults.slice(0, limit).map(r => ({ id: r.id, score: r.score })) : [], model: genRes.model };
  }

  // ── SYNC USERS TO RESEND AUDIENCE ─────────────────────────────────────────
  // Get users from Clerk (or Neon) and sync them to a Resend audience
  if (tool === 'compound_sync_users_to_audience') {
    const { audience_name, source = 'clerk', neon_project_id, neon_sql, limit = 100 } = args;
    if (!audience_name) throw new Error('audience_name is required');

    let users = [];
    if (source === 'clerk') {
      const clerk = await loadHandler('clerk');
      const result = await clerk.execute('clerk_list_users', { limit });
      users = (result || []).map(u => ({ email: u.email_addresses?.[0]?.email_address, first_name: u.first_name, last_name: u.last_name })).filter(u => u.email);
    } else if (source === 'neon' && neon_project_id && neon_sql) {
      const neon = await loadHandler('neon');
      const result = await neon.execute('neon_run_sql', { project_id: neon_project_id, sql: neon_sql });
      users = (result.rows || result).map(r => ({ email: r.email, first_name: r.first_name, last_name: r.last_name })).filter(u => u.email);
    }

    const resend = await loadHandler('resend');
    const subscribeResult = await resend.execute('resend_add_subscriber', { audience_name, email: users[0]?.email, first_name: users[0]?.first_name }).catch(() => null);
    // Find or create audience
    const audienceSearch = await resend.execute('resend_find_audience_by_name', { name: audience_name }).catch(() => null);
    const audienceId = audienceSearch?.id;

    let synced = 0, failed = 0;
    if (audienceId) {
      const bulkResult = await resend.execute('resend_bulk_create_contacts', { audience_id: audienceId, contacts: users });
      synced = bulkResult.created || 0;
      failed = bulkResult.failed || 0;
    }

    return { audience_name, users_found: users.length, synced, failed };
  }

  // ── GEOCODE AND STORE (YardSync) ──────────────────────────────────────────
  // Geocode an address and store coordinates in a Neon/Postgres table
  if (tool === 'compound_geocode_and_store') {
    const { address, neon_project_id, table_name = 'locations', record_id, schema = 'public', lat_col = 'latitude', lng_col = 'longitude', address_col = 'normalized_address' } = args;
    if (!address) throw new Error('address is required');

    const mapbox = await loadHandler('mapbox');
    const geo = await mapbox.execute('mapbox_address_to_coordinates', { address });
    if (!geo.found) return { success: false, address, reason: 'Address not found' };

    if (neon_project_id && record_id) {
      const neon = await loadHandler('neon');
      await neon.execute('neon_run_sql', {
        project_id: neon_project_id,
        sql: `UPDATE ${schema}.${table_name} SET ${lat_col} = ${geo.latitude}, ${lng_col} = ${geo.longitude}, ${address_col} = '${geo.place_name.replace(/'/g, "''")}' WHERE id = ${record_id}`
      });
      return { success: true, record_id, latitude: geo.latitude, longitude: geo.longitude, normalized_address: geo.place_name };
    }

    return { success: true, latitude: geo.latitude, longitude: geo.longitude, normalized_address: geo.place_name };
  }

  // ── REVENUE SUMMARY ───────────────────────────────────────────────────────
  // Stripe MRR + recent signups + failed payments in one shot
  if (tool === 'compound_revenue_summary') {
    const results = {};
    try {
      const stripe = await loadHandler('stripe');
      const [revenue, pastDue] = await Promise.all([
        stripe.execute('stripe_revenue_summary', {}),
        stripe.execute('stripe_dunning_check', {})
      ]);
      results.revenue = revenue;
      results.past_due = { count: pastDue.past_due_count, customers: pastDue.subscriptions?.slice(0, 5).map(s => ({ email: s.customer_email, amount: s.amount })) };
    } catch (e) { results.stripe_error = e.message; }
    results.generated_at = new Date().toISOString();
    return results;
  }

  // ── VALIDATE ENV VARS ─────────────────────────────────────────────────────
  // Check that all required env vars are set for a given set of services
  if (tool === 'compound_validate_env_vars') {
    const { services = [] } = args;
    const envMap = {
      stripe: ['STRIPE_SECRET_KEY'],
      clerk: ['CLERK_SECRET_KEY'],
      resend: ['RESEND_API_KEY'],
      neon: ['NEON_API_KEY'],
      vercel: ['VERCEL_TOKEN'],
      fly: ['FLY_API_TOKEN'],
      github: ['GITHUB_TOKEN'],
      sentry: ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG_SLUG'],
      openai: ['OPENAI_API_KEY'],
      anthropic: ['ANTHROPIC_API_KEY'],
      supabase: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
      mapbox: ['MAPBOX_ACCESS_TOKEN'],
      twilio: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
      ollama: ['OLLAMA_BASE_URL'],
      qdrant: ['QDRANT_URL'],
      cloudflare: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
      postgres: ['POSTGRES_CONNECTION_STRING'],
      upstash: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    };
    const toCheck = services.length ? services : Object.keys(envMap);
    const results = {};
    for (const svc of toCheck) {
      const vars = envMap[svc] || [];
      results[svc] = { required: vars, missing: vars.filter(v => !process.env[v]), configured: vars.every(v => !!process.env[v]) };
    }
    return { results, all_configured: Object.values(results).every(r => r.configured), services_checked: toCheck.length };
  }

  // ── FULL HEALTH DASHBOARD ─────────────────────────────────────────────────
  // Ping every configured service and report status
  if (tool === 'compound_full_health_dashboard') {
    const checks = {};

    const tryCheck = async (name, fn) => {
      try { checks[name] = { healthy: true, ...(await fn()) }; }
      catch (e) { checks[name] = { healthy: false, error: e.message }; }
    };

    await Promise.all([
      tryCheck('ollama', async () => { const h = await loadHandler('ollama'); return await h.execute('ollama_check_health', {}); }),
      tryCheck('neon', async () => { const h = await loadHandler('neon'); const p = await h.execute('neon_list_projects', {}); return { projects: p?.length || 0 }; }),
      tryCheck('vercel', async () => { const h = await loadHandler('vercel'); const p = await h.execute('vercel_list_projects', {}); return { projects: p?.projects?.length || 0 }; }),
      tryCheck('github', async () => { const h = await loadHandler('github'); const u = await h.execute('github_get_authenticated_user', {}); return { user: u.login }; }),
      tryCheck('stripe', async () => { const h = await loadHandler('stripe'); const b = await h.execute('stripe_get_balance', {}); return { available: b.available?.[0]?.amount / 100 }; }),
      tryCheck('sentry', async () => { const h = await loadHandler('sentry'); const p = await h.execute('sentry_list_projects', {}); return { projects: p?.length || 0 }; }),
      tryCheck('qdrant', async () => { const h = await loadHandler('qdrant'); return await h.execute('qdrant_health_check', {}); }),
    ]);

    const healthy = Object.values(checks).filter(c => c.healthy).length;
    const total = Object.keys(checks).length;
    return { checks, summary: `${healthy}/${total} services healthy`, checked_at: new Date().toISOString() };
  }

  // ── BATCH EMBED DOCUMENTS ─────────────────────────────────────────────────
  // Embed and store multiple documents in Qdrant in one call
  if (tool === 'compound_batch_embed_documents') {
    const { documents, collection_name, use_ollama = false, ollama_model } = args;
    if (!documents?.length || !collection_name) throw new Error('documents array and collection_name are required');
    // documents: [{id, text, ...payload}]
    const embedder = use_ollama ? await loadHandler('ollama') : await loadHandler('openai');
    const points = [];
    for (const doc of documents) {
      const text = doc.text || doc.content || doc.body || JSON.stringify(doc);
      const embedRes = use_ollama
        ? await embedder.execute('ollama_embed', { input: text, model: ollama_model })
        : await embedder.execute('openai_create_embedding', { input: text });
      const vector = use_ollama ? (Array.isArray(embedRes.embeddings) ? embedRes.embeddings[0] : embedRes.embeddings) : embedRes.embeddings?.[0];
      if (vector) points.push({ id: doc.id, vector, payload: { text, ...Object.fromEntries(Object.entries(doc).filter(([k]) => !['text','content','body'].includes(k))) } });
    }
    const qdrant = await loadHandler('qdrant');
    const result = await qdrant.execute('qdrant_upsert_points', { collection_name, points });
    return { stored: points.length, failed: documents.length - points.length, collection_name, result };
  }

  throw new Error(`Unknown compound tool: ${tool}`);
}

export default { execute };
