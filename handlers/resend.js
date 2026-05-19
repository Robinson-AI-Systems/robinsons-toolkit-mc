/**
 * Resend Handler — 22 tools
 * Full Resend email API: send, domains, API keys, audiences, contacts, broadcasts.
 */

const BASE = 'https://api.resend.com';

function headers() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not set in .env');
  return { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function r(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: headers(),
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return { success: true };
  const data = await res.json();
  if (!res.ok) throw new Error(`Resend ${res.status}: ${data.message || data.name || JSON.stringify(data)}`);
  return data;
}

async function execute(tool, args) {

  // ── EMAILS ────────────────────────────────────────────────────────────────
  if (tool === 'resend_send_email') {
    const { from, to, subject, html, text, reply_to, cc, bcc, scheduled_at, tags, attachments } = args;
    if (!from || !to || !subject || (!html && !text)) throw new Error('from, to, subject, and html or text are required');
    const body = { from, to: Array.isArray(to) ? to : [to], subject };
    if (html) body.html = html; if (text) body.text = text;
    if (reply_to) body.reply_to = reply_to; if (cc) body.cc = cc; if (bcc) body.bcc = bcc;
    if (scheduled_at) body.scheduled_at = scheduled_at;
    if (tags) body.tags = tags; if (attachments) body.attachments = attachments;
    return await r('POST', '/emails', body);
  }
  if (tool === 'resend_get_email') { return await r('GET', `/emails/${args.email_id}`); }
  if (tool === 'resend_update_email') {
    // Used to reschedule a scheduled email
    return await r('PATCH', `/emails/${args.email_id}`, { scheduled_at: args.scheduled_at });
  }
  if (tool === 'resend_cancel_scheduled_email') { return await r('POST', `/emails/${args.email_id}/cancel`, {}); }
  if (tool === 'resend_send_batch_emails') {
    // emails: array of email objects with same fields as send_email
    return await r('POST', '/emails/batch', args.emails);
  }

  // ── DOMAINS ───────────────────────────────────────────────────────────────
  if (tool === 'resend_list_domains') { return await r('GET', '/domains'); }
  if (tool === 'resend_get_domain') { return await r('GET', `/domains/${args.domain_id}`); }
  if (tool === 'resend_create_domain') {
    return await r('POST', '/domains', { name: args.domain_name, region: args.region || 'us-east-1' });
  }
  if (tool === 'resend_verify_domain') { return await r('POST', `/domains/${args.domain_id}/verify`, {}); }
  if (tool === 'resend_update_domain') {
    return await r('PATCH', `/domains/${args.domain_id}`, { open_tracking: args.open_tracking, click_tracking: args.click_tracking, tls: args.tls });
  }
  if (tool === 'resend_delete_domain') { return await r('DELETE', `/domains/${args.domain_id}`); }

  // ── API KEYS ──────────────────────────────────────────────────────────────
  if (tool === 'resend_list_api_keys') { return await r('GET', '/api-keys'); }
  if (tool === 'resend_create_api_key') {
    return await r('POST', '/api-keys', { name: args.name, permission: args.permission || 'full_access', domain_id: args.domain_id });
  }
  if (tool === 'resend_delete_api_key') { return await r('DELETE', `/api-keys/${args.api_key_id}`); }

  // ── AUDIENCES ─────────────────────────────────────────────────────────────
  if (tool === 'resend_list_audiences') { return await r('GET', '/audiences'); }
  if (tool === 'resend_create_audience') { return await r('POST', '/audiences', { name: args.name }); }
  if (tool === 'resend_get_audience') { return await r('GET', `/audiences/${args.audience_id}`); }
  if (tool === 'resend_delete_audience') { return await r('DELETE', `/audiences/${args.audience_id}`); }

  // ── CONTACTS ──────────────────────────────────────────────────────────────
  if (tool === 'resend_list_contacts') { return await r('GET', `/audiences/${args.audience_id}/contacts`); }
  if (tool === 'resend_create_contact') {
    const { audience_id, email, first_name, last_name, unsubscribed } = args;
    return await r('POST', `/audiences/${audience_id}/contacts`, { email, first_name, last_name, unsubscribed: unsubscribed || false });
  }
  if (tool === 'resend_get_contact') { return await r('GET', `/audiences/${args.audience_id}/contacts/${args.contact_id}`); }
  if (tool === 'resend_update_contact') {
    const { audience_id, contact_id, ...updates } = args;
    return await r('PATCH', `/audiences/${audience_id}/contacts/${contact_id}`, updates);
  }
  if (tool === 'resend_delete_contact') {
    return await r('DELETE', `/audiences/${args.audience_id}/contacts/${args.contact_id}`);
  }

  throw new Error(`Unknown Resend tool: ${tool}`);
}

export default { execute };
