/**
 * Resend Handler — 57 tools
 * Email sending, domains, API keys, audiences, contacts,
 * broadcasts, webhooks, and Super Tools for transactional
 * and marketing email workflows.
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
    const { from, to, subject, html, text, reply_to, cc, bcc, scheduled_at, tags, attachments, headers: emailHeaders } = args;
    if (!from || !to || !subject || (!html && !text)) throw new Error('from, to, subject, and html or text are required');
    const body = { from, to: Array.isArray(to) ? to : [to], subject };
    if (html) body.html = html;
    if (text) body.text = text;
    if (reply_to) body.reply_to = reply_to;
    if (cc) body.cc = cc;
    if (bcc) body.bcc = bcc;
    if (scheduled_at) body.scheduled_at = scheduled_at;
    if (tags) body.tags = tags;
    if (attachments) body.attachments = attachments;
    if (emailHeaders) body.headers = emailHeaders;
    return await r('POST', '/emails', body);
  }
  if (tool === 'resend_get_email') { return await r('GET', `/emails/${args.email_id}`); }
  if (tool === 'resend_update_email') {
    return await r('PATCH', `/emails/${args.email_id}`, { scheduled_at: args.scheduled_at });
  }
  if (tool === 'resend_cancel_scheduled_email') {
    return await r('POST', `/emails/${args.email_id}/cancel`, {});
  }
  if (tool === 'resend_send_batch_emails') {
    if (!Array.isArray(args.emails)) throw new Error('emails must be an array of email objects');
    return await r('POST', '/emails/batch', args.emails);
  }

  // ── DOMAINS ───────────────────────────────────────────────────────────────
  if (tool === 'resend_list_domains') { return await r('GET', '/domains'); }
  if (tool === 'resend_get_domain') { return await r('GET', `/domains/${args.domain_id}`); }
  if (tool === 'resend_create_domain') {
    return await r('POST', '/domains', { name: args.domain_name, region: args.region || 'us-east-1' });
  }
  if (tool === 'resend_verify_domain') {
    return await r('POST', `/domains/${args.domain_id}/verify`, {});
  }
  if (tool === 'resend_update_domain') {
    const { domain_id, open_tracking, click_tracking, tls } = args;
    const body = {};
    if (open_tracking !== undefined) body.open_tracking = open_tracking;
    if (click_tracking !== undefined) body.click_tracking = click_tracking;
    if (tls !== undefined) body.tls = tls;
    return await r('PATCH', `/domains/${domain_id}`, body);
  }
  if (tool === 'resend_delete_domain') { return await r('DELETE', `/domains/${args.domain_id}`); }
  if (tool === 'resend_get_domain_records') {
    // Returns the domain with DNS records needed for verification
    const domain = await r('GET', `/domains/${args.domain_id}`);
    return {
      name: domain.name, status: domain.status,
      records: domain.records || [],
      spf_record: domain.records?.find(rec => rec.type === 'TXT' && rec.name?.includes('spf')),
      dkim_records: domain.records?.filter(rec => rec.type === 'TXT' && rec.name?.includes('dkim')),
      mx_record: domain.records?.find(rec => rec.type === 'MX'),
      note: 'Add these DNS records to your domain registrar to verify the domain'
    };
  }

  // ── API KEYS ──────────────────────────────────────────────────────────────
  if (tool === 'resend_list_api_keys') { return await r('GET', '/api-keys'); }
  if (tool === 'resend_create_api_key') {
    return await r('POST', '/api-keys', { name: args.name, permission: args.permission || 'full_access', domain_id: args.domain_id });
  }
  if (tool === 'resend_delete_api_key') { return await r('DELETE', `/api-keys/${args.api_key_id}`); }

  // ── AUDIENCES ─────────────────────────────────────────────────────────────
  if (tool === 'resend_list_audiences') { return await r('GET', '/audiences'); }
  if (tool === 'resend_get_audience') { return await r('GET', `/audiences/${args.audience_id}`); }
  if (tool === 'resend_create_audience') {
    if (!args.name) throw new Error('name is required');
    return await r('POST', '/audiences', { name: args.name });
  }
  if (tool === 'resend_delete_audience') { return await r('DELETE', `/audiences/${args.audience_id}`); }

  // Find an audience by name (searches all audiences)
  if (tool === 'resend_find_audience_by_name') {
    const { data: audiences } = await r('GET', '/audiences');
    const match = (audiences || []).find(a => a.name.toLowerCase() === args.name.toLowerCase());
    return match || { not_found: true, name: args.name };
  }

  // ── CONTACTS ──────────────────────────────────────────────────────────────
  if (tool === 'resend_list_contacts') {
    return await r('GET', `/audiences/${args.audience_id}/contacts`);
  }
  if (tool === 'resend_get_contact') {
    return await r('GET', `/audiences/${args.audience_id}/contacts/${args.contact_id}`);
  }
  if (tool === 'resend_create_contact') {
    const { audience_id, email, first_name, last_name, unsubscribed } = args;
    if (!audience_id || !email) throw new Error('audience_id and email are required');
    return await r('POST', `/audiences/${audience_id}/contacts`, { email, first_name, last_name, unsubscribed: unsubscribed || false });
  }
  if (tool === 'resend_update_contact') {
    const { audience_id, contact_id, first_name, last_name, unsubscribed } = args;
    const body = {};
    if (first_name !== undefined) body.first_name = first_name;
    if (last_name !== undefined) body.last_name = last_name;
    if (unsubscribed !== undefined) body.unsubscribed = unsubscribed;
    return await r('PATCH', `/audiences/${audience_id}/contacts/${contact_id}`, body);
  }
  if (tool === 'resend_delete_contact') {
    return await r('DELETE', `/audiences/${args.audience_id}/contacts/${args.contact_id}`);
  }
  if (tool === 'resend_unsubscribe_contact') {
    return await r('PATCH', `/audiences/${args.audience_id}/contacts/${args.contact_id}`, { unsubscribed: true });
  }
  if (tool === 'resend_resubscribe_contact') {
    return await r('PATCH', `/audiences/${args.audience_id}/contacts/${args.contact_id}`, { unsubscribed: false });
  }
  if (tool === 'resend_bulk_create_contacts') {
    const { audience_id, contacts } = args;
    if (!audience_id || !contacts?.length) throw new Error('audience_id and contacts array are required');
    const results = [];
    for (const contact of contacts) {
      const result = await r('POST', `/audiences/${audience_id}/contacts`, {
        email: contact.email, first_name: contact.first_name, last_name: contact.last_name, unsubscribed: contact.unsubscribed || false
      }).catch(e => ({ error: e.message, email: contact.email }));
      results.push(result);
    }
    return { created: results.filter(r => !r.error).length, failed: results.filter(r => r.error).length, results };
  }

  // ── BROADCASTS ────────────────────────────────────────────────────────────
  if (tool === 'resend_list_broadcasts') { return await r('GET', '/broadcasts'); }
  if (tool === 'resend_get_broadcast') { return await r('GET', `/broadcasts/${args.broadcast_id}`); }
  if (tool === 'resend_create_broadcast') {
    const { audience_id, from, subject, html, text, name, reply_to } = args;
    if (!audience_id || !from || !subject || (!html && !text)) throw new Error('audience_id, from, subject, and html or text are required');
    const body = { audience_id, from, subject };
    if (html) body.html = html;
    if (text) body.text = text;
    if (name) body.name = name;
    if (reply_to) body.reply_to = reply_to;
    return await r('POST', '/broadcasts', body);
  }
  if (tool === 'resend_update_broadcast') {
    const { broadcast_id, subject, html, text, from, name } = args;
    const body = {};
    if (subject) body.subject = subject;
    if (html) body.html = html;
    if (text) body.text = text;
    if (from) body.from = from;
    if (name) body.name = name;
    return await r('PATCH', `/broadcasts/${broadcast_id}`, body);
  }
  if (tool === 'resend_send_broadcast') {
    const { broadcast_id, scheduled_at } = args;
    if (!broadcast_id) throw new Error('broadcast_id is required');
    const body = {};
    if (scheduled_at) body.scheduled_at = scheduled_at;
    return await r('POST', `/broadcasts/${broadcast_id}/send`, body);
  }
  if (tool === 'resend_delete_broadcast') {
    return await r('DELETE', `/broadcasts/${args.broadcast_id}`);
  }

  // ── WEBHOOKS ──────────────────────────────────────────────────────────────
  if (tool === 'resend_list_webhooks') { return await r('GET', '/webhooks'); }
  if (tool === 'resend_get_webhook') { return await r('GET', `/webhooks/${args.webhook_id}`); }
  if (tool === 'resend_create_webhook') {
    const { url, events } = args;
    if (!url) throw new Error('url is required');
    const body = { url };
    if (events) body.events = events;
    return await r('POST', '/webhooks', body);
  }
  if (tool === 'resend_delete_webhook') { return await r('DELETE', `/webhooks/${args.webhook_id}`); }

  // ── ACCOUNT ───────────────────────────────────────────────────────────────
  if (tool === 'resend_get_account') { return await r('GET', '/me'); }

  // ══════════════════════════════════════════════════════════════════════════
  //  SUPER TOOLS
  // ══════════════════════════════════════════════════════════════════════════

  // SUPER: Send a transactional email using a simple variable-substitution template
  if (tool === 'resend_send_template_email') {
    const { from, to, subject, template, variables = {} } = args;
    if (!from || !to || !subject || !template) throw new Error('from, to, subject, and template are required');
    let html = template;
    for (const [key, value] of Object.entries(variables)) {
      html = html.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value);
    }
    return await r('POST', '/emails', { from, to: Array.isArray(to) ? to : [to], subject, html });
  }

  // SUPER: Add a subscriber — find/create audience by name, then add contact
  if (tool === 'resend_add_subscriber') {
    const { audience_name, email, first_name, last_name } = args;
    if (!audience_name || !email) throw new Error('audience_name and email are required');
    const { data: audiences } = await r('GET', '/audiences');
    let audience = (audiences || []).find(a => a.name.toLowerCase() === audience_name.toLowerCase());
    if (!audience) {
      audience = await r('POST', '/audiences', { name: audience_name });
    }
    const contact = await r('POST', `/audiences/${audience.id}/contacts`, { email, first_name, last_name, unsubscribed: false });
    return { audience_id: audience.id, audience_name: audience.name, contact_id: contact.id, email, subscribed: true };
  }

  // SUPER: Send a welcome email using a built-in responsive HTML template
  if (tool === 'resend_send_welcome_email') {
    const { from, to, user_name, app_name, cta_url, cta_text = 'Get Started', support_email } = args;
    if (!from || !to || !app_name) throw new Error('from, to, and app_name are required');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f4f5;margin:0;padding:20px}.container{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}.logo{font-size:24px;font-weight:700;color:#111;margin-bottom:32px}.heading{font-size:28px;font-weight:700;color:#111;margin-bottom:16px}.text{font-size:16px;color:#374151;line-height:1.6;margin-bottom:24px}.btn{display:inline-block;background:#111;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px}.footer{margin-top:32px;font-size:13px;color:#9ca3af}</style></head><body><div class="container"><div class="logo">${app_name}</div><h1 class="heading">Welcome${user_name ? `, ${user_name}` : ''}!</h1><p class="text">Thanks for signing up for ${app_name}. We're excited to have you on board.</p>${cta_url ? `<a href="${cta_url}" class="btn">${cta_text}</a>` : ''}<div class="footer">${support_email ? `Questions? Reply to this email or contact <a href="mailto:${support_email}">${support_email}</a>.` : ''}</div></div></body></html>`;
    return await r('POST', '/emails', { from, to: Array.isArray(to) ? to : [to], subject: `Welcome to ${app_name}!`, html });
  }

  // SUPER: Send a password reset email
  if (tool === 'resend_send_password_reset_email') {
    const { from, to, reset_url, user_name, app_name, expires_in_hours = 24 } = args;
    if (!from || !to || !reset_url || !app_name) throw new Error('from, to, reset_url, and app_name are required');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f4f5;margin:0;padding:20px}.container{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:40px}.logo{font-size:22px;font-weight:700;color:#111;margin-bottom:32px}.heading{font-size:26px;font-weight:700;color:#111;margin-bottom:16px}.text{font-size:15px;color:#374151;line-height:1.6;margin-bottom:24px}.btn{display:inline-block;background:#dc2626;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600}.note{font-size:13px;color:#6b7280;margin-top:24px}</style></head><body><div class="container"><div class="logo">${app_name}</div><h1 class="heading">Reset your password</h1><p class="text">Hi${user_name ? ` ${user_name}` : ''}, we received a request to reset your ${app_name} password.</p><a href="${reset_url}" class="btn">Reset Password</a><p class="note">This link expires in ${expires_in_hours} hours. If you didn't request this, you can safely ignore this email.</p></div></body></html>`;
    return await r('POST', '/emails', { from, to: Array.isArray(to) ? to : [to], subject: `Reset your ${app_name} password`, html });
  }

  // SUPER: Send an invoice/receipt email
  if (tool === 'resend_send_invoice_email') {
    const { from, to, customer_name, invoice_number, amount, currency = 'USD', items = [], due_date, app_name, support_email } = args;
    if (!from || !to || !invoice_number || !amount || !app_name) throw new Error('from, to, invoice_number, amount, and app_name are required');
    const itemRows = items.map(item => `<tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6">${item.description}</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right">${item.amount}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f4f5;margin:0;padding:20px}.container{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:40px}.logo{font-size:22px;font-weight:700;color:#111;margin-bottom:32px}.meta{font-size:14px;color:#6b7280;margin-bottom:8px}table{width:100%;border-collapse:collapse;margin:24px 0}.total{font-size:18px;font-weight:700;text-align:right;color:#111;margin-top:16px}</style></head><body><div class="container"><div class="logo">${app_name}</div><p class="meta">Invoice #${invoice_number}${due_date ? ` · Due ${due_date}` : ''}</p><p>Hi ${customer_name || 'there'},</p><p>Here is your invoice from ${app_name}.</p><table>${itemRows}</table><div class="total">Total: ${amount} ${currency}</div>${support_email ? `<p style="font-size:13px;color:#6b7280;margin-top:32px">Questions? <a href="mailto:${support_email}">${support_email}</a></p>` : ''}</div></body></html>`;
    return await r('POST', '/emails', { from, to: Array.isArray(to) ? to : [to], subject: `Invoice #${invoice_number} from ${app_name}`, html });
  }

  // SUPER: Create broadcast and send to audience in one call
  if (tool === 'resend_create_and_send_broadcast') {
    const { audience_id, from, subject, html, text, name, scheduled_at } = args;
    if (!audience_id || !from || !subject || (!html && !text)) throw new Error('audience_id, from, subject, and html or text are required');
    const broadcast = await r('POST', '/broadcasts', { audience_id, from, subject, html, text, name });
    const sendBody = {};
    if (scheduled_at) sendBody.scheduled_at = scheduled_at;
    const result = await r('POST', `/broadcasts/${broadcast.id}/send`, sendBody);
    return { broadcast_id: broadcast.id, broadcast_name: broadcast.name, ...result };
  }

  // SUPER: Get full account summary — domains, audiences, API keys
  if (tool === 'resend_account_summary') {
    const [account, domains, audiences, apiKeys] = await Promise.all([
      r('GET', '/me').catch(() => ({})),
      r('GET', '/domains').catch(() => ({ data: [] })),
      r('GET', '/audiences').catch(() => ({ data: [] })),
      r('GET', '/api-keys').catch(() => ({ data: [] }))
    ]);
    return {
      email: account.email,
      domains: {
        count: (domains.data || []).length,
        verified: (domains.data || []).filter(d => d.status === 'verified').length,
        list: (domains.data || []).map(d => ({ name: d.name, status: d.status, region: d.region }))
      },
      audiences: { count: (audiences.data || []).length, names: (audiences.data || []).map(a => a.name) },
      api_keys: { count: (apiKeys.data || []).length }
    };
  }


  // ── SCHEDULED EMAILS ──────────────────────────────────────────────────────
  if (tool === 'resend_schedule_email') {
    // Send an email at a future time using Resend's scheduled delivery
    const { from: from_addr, to, subject, html, text, scheduled_at, reply_to, cc, bcc } = args;
    if (!from_addr || !to || !subject || !scheduled_at) throw new Error('from, to, subject, and scheduled_at are required');
    const body = { from: from_addr, to, subject, scheduled_at };
    if (html) body.html = html;
    if (text) body.text = text;
    if (reply_to) body.reply_to = reply_to;
    if (cc) body.cc = cc;
    if (bcc) body.bcc = bcc;
    const data = await resend('POST', '/emails', body);
    return { id: data.id, scheduled_at, status: 'scheduled' };
  }

  if (tool === 'resend_list_scheduled_emails') {
    // List emails scheduled for future delivery (status: scheduled)
    const data = await resend('GET', '/emails?status=scheduled');
    return { emails: data.data || data, count: (data.data || data)?.length || 0 };
  }

  // ── EMAIL SUPPRESSIONS ────────────────────────────────────────────────────
  if (tool === 'resend_add_suppression') {
    // Add an email address to the suppression list (opt-out / bounce management)
    const { email } = args;
    if (!email) throw new Error('email is required');
    return await resend('POST', '/contacts/suppressions', { email });
  }

  if (tool === 'resend_remove_suppression') {
    // Remove an email address from the suppression list
    const { email } = args;
    if (!email) throw new Error('email is required');
    return await resend('DELETE', `/contacts/suppressions/${encodeURIComponent(email)}`);
  }

  if (tool === 'resend_list_suppressions') {
    // List all suppressed email addresses (bounces, unsubscribes, spam complaints)
    const { limit = 50, page = 1 } = args;
    const data = await resend('GET', `/contacts/suppressions?limit=${limit}&page=${page}`);
    return {
      suppressions: (data.data || data || []).map(s => ({
        email: s.email,
        reason: s.reason,
        created_at: s.created_at
      })),
      count: (data.data || data)?.length || 0
    };
  }

  // ── BROADCAST ANALYTICS ────────────────────────────────────────────────────
  if (tool === 'resend_get_broadcast_analytics') {
    // Get delivery stats for a broadcast: sent, delivered, opened, clicked, bounced
    const { broadcast_id } = args;
    if (!broadcast_id) throw new Error('broadcast_id is required');
    const [broadcast, events] = await Promise.all([
      resend('GET', `/broadcasts/${broadcast_id}`),
      resend('GET', `/broadcasts/${broadcast_id}/stats`).catch(() => null)
    ]);
    return {
      id: broadcast.id,
      name: broadcast.name,
      subject: broadcast.subject,
      status: broadcast.status,
      sent_at: broadcast.sent_at,
      audience_id: broadcast.audience_id,
      stats: events || {
        sent: broadcast.sent,
        delivered: broadcast.delivered,
        opened: broadcast.opened,
        clicked: broadcast.clicked,
        bounced: broadcast.bounced,
        unsubscribed: broadcast.unsubscribed
      }
    };
  }


    throw new Error(`Unknown Resend tool: ${tool}`);
}

export default { execute };
