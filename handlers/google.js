/**
 * Google Workspace Handler — 134 tools
 * Gmail, Drive, Calendar, Sheets, Docs, Slides, Forms, Contacts.
 * Authentication: GOOGLE_ACCESS_TOKEN (OAuth) OR GOOGLE_SERVICE_ACCOUNT_KEY_PATH.
 * Service-account flow uses RS256 JWT signing via node:crypto and caches
 * the resulting access token for its TTL (3600s default).
 */

import crypto from 'crypto';
import { readFileSync } from 'fs';

const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/forms',
  'https://www.googleapis.com/auth/contacts'
].join(' ');

let _saTokenCache = null;

async function getServiceAccountToken(keyPath, scopes = DEFAULT_SCOPES, subject) {
  if (_saTokenCache && _saTokenCache.expires_at > Date.now() + 60_000 && _saTokenCache.scopes === scopes && _saTokenCache.subject === subject) {
    return _saTokenCache.token;
  }
  const key = JSON.parse(readFileSync(keyPath, 'utf-8'));
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: key.private_key_id })).toString('base64url');
  const claim = { iss: key.client_email, scope: scopes, aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now };
  if (subject) claim.sub = subject;
  const payload = Buffer.from(JSON.stringify(claim)).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(key.private_key).toString('base64url');
  const jwt = `${unsigned}.${signature}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Service account token exchange failed: ${data.error_description || data.error}`);
  _saTokenCache = { token: data.access_token, expires_at: Date.now() + (data.expires_in * 1000), scopes, subject };
  return data.access_token;
}

async function getToken(opts = {}) {
  const token = process.env.GOOGLE_ACCESS_TOKEN;
  if (token) return token;
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyPath) throw new Error('Set GOOGLE_ACCESS_TOKEN or GOOGLE_SERVICE_ACCOUNT_KEY_PATH in .env. See README for setup instructions.');
  return await getServiceAccountToken(keyPath, opts.scopes || DEFAULT_SCOPES, opts.subject || process.env.GOOGLE_SERVICE_ACCOUNT_SUBJECT);
}

function headers(token) {
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function g(method, url, body, token) {
  const res = await fetch(url, {
    method, headers: headers(token),
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return { success: true };
  const data = await res.json();
  if (!res.ok) throw new Error(`Google API ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
  return data;
}

async function execute(tool, args) {
  const token = await getToken();

  // ── GMAIL ─────────────────────────────────────────────────────────────────
  const BASE_GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';

  if (tool === 'gmail_send_email') {
    const { to, subject, body: emailBody, html, cc, bcc } = args;
    if (!to || !subject) throw new Error('to and subject are required');
    const lines = [
      `To: ${Array.isArray(to) ? to.join(', ') : to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      html ? `Content-Type: text/html; charset=UTF-8` : `Content-Type: text/plain; charset=UTF-8`,
      cc ? `Cc: ${Array.isArray(cc) ? cc.join(', ') : cc}` : '',
      bcc ? `Bcc: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}` : '',
      '', html || emailBody || ''
    ].filter(l => l !== null);
    const raw = Buffer.from(lines.join('\r\n')).toString('base64url');
    return await g('POST', `${BASE_GMAIL}/messages/send`, { raw }, token);
  }
  if (tool === 'gmail_list_messages') {
    const { query = '', max_results = 10, label_ids, page_token } = args;
    let url = `${BASE_GMAIL}/messages?maxResults=${max_results}&q=${encodeURIComponent(query)}`;
    if (label_ids) url += `&labelIds=${label_ids.join('&labelIds=')}`;
    if (page_token) url += `&pageToken=${page_token}`;
    return await g('GET', url, null, token);
  }
  if (tool === 'gmail_get_message') {
    return await g('GET', `${BASE_GMAIL}/messages/${args.message_id}?format=${args.format || 'full'}`, null, token);
  }
  if (tool === 'gmail_get_message_body') {
    const msg = await g('GET', `${BASE_GMAIL}/messages/${args.message_id}?format=full`, null, token);
    const getText = (parts) => {
      if (!parts) return '';
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) return Buffer.from(part.body.data, 'base64').toString();
        if (part.mimeType === 'text/html' && part.body?.data) return Buffer.from(part.body.data, 'base64').toString();
        if (part.parts) { const r = getText(part.parts); if (r) return r; }
      }
      return msg.body?.data ? Buffer.from(msg.body.data, 'base64').toString() : '';
    };
    const headers_map = {};
    for (const h of (msg.payload?.headers || [])) headers_map[h.name] = h.value;
    return { from: headers_map['From'], to: headers_map['To'], subject: headers_map['Subject'], date: headers_map['Date'], body: getText(msg.payload?.parts)?.slice(0, 10000) };
  }
  if (tool === 'gmail_delete_message') { return await g('DELETE', `${BASE_GMAIL}/messages/${args.message_id}`, null, token); }
  if (tool === 'gmail_trash_message') { return await g('POST', `${BASE_GMAIL}/messages/${args.message_id}/trash`, {}, token); }
  if (tool === 'gmail_modify_message') {
    return await g('POST', `${BASE_GMAIL}/messages/${args.message_id}/modify`, { addLabelIds: args.add_labels || [], removeLabelIds: args.remove_labels || [] }, token);
  }
  if (tool === 'gmail_mark_read') { return await g('POST', `${BASE_GMAIL}/messages/${args.message_id}/modify`, { removeLabelIds: ['UNREAD'] }, token); }
  if (tool === 'gmail_mark_unread') { return await g('POST', `${BASE_GMAIL}/messages/${args.message_id}/modify`, { addLabelIds: ['UNREAD'] }, token); }
  if (tool === 'gmail_list_labels') { return await g('GET', `${BASE_GMAIL}/labels`, null, token); }
  if (tool === 'gmail_get_label') { return await g('GET', `${BASE_GMAIL}/labels/${args.label_id}`, null, token); }
  if (tool === 'gmail_create_label') { return await g('POST', `${BASE_GMAIL}/labels`, { name: args.name, labelListVisibility: args.visibility || 'labelShow', messageListVisibility: 'show' }, token); }
  if (tool === 'gmail_delete_label') { return await g('DELETE', `${BASE_GMAIL}/labels/${args.label_id}`, null, token); }
  if (tool === 'gmail_list_threads') {
    return await g('GET', `${BASE_GMAIL}/threads?maxResults=${args.max_results || 10}&q=${encodeURIComponent(args.query || '')}`, null, token);
  }
  if (tool === 'gmail_get_thread') { return await g('GET', `${BASE_GMAIL}/threads/${args.thread_id}?format=${args.format || 'minimal'}`, null, token); }
  if (tool === 'gmail_trash_thread') { return await g('POST', `${BASE_GMAIL}/threads/${args.thread_id}/trash`, {}, token); }
  if (tool === 'gmail_get_profile') { return await g('GET', `${BASE_GMAIL}/profile`, null, token); }
  if (tool === 'gmail_create_draft') {
    const { to, subject, body: emailBody } = args;
    const raw = Buffer.from(`To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain\r\n\r\n${emailBody}`).toString('base64url');
    return await g('POST', `${BASE_GMAIL}/drafts`, { message: { raw } }, token);
  }
  if (tool === 'gmail_list_drafts') { return await g('GET', `${BASE_GMAIL}/drafts?maxResults=${args.max_results || 10}`, null, token); }
  if (tool === 'gmail_send_draft') { return await g('POST', `${BASE_GMAIL}/drafts/send`, { id: args.draft_id }, token); }
  if (tool === 'gmail_search') {
    const { query, max_results = 10 } = args;
    const msgs = await g('GET', `${BASE_GMAIL}/messages?maxResults=${max_results}&q=${encodeURIComponent(query)}`, null, token);
    return msgs;
  }
  if (tool === 'gmail_batch_delete') {
    return await g('POST', `${BASE_GMAIL}/messages/batchDelete`, { ids: args.message_ids }, token);
  }

  // ── GOOGLE DRIVE ──────────────────────────────────────────────────────────
  const BASE_DRIVE = 'https://www.googleapis.com/drive/v3';

  if (tool === 'drive_list_files') {
    const { query = '', page_size = 20, page_token, order_by = 'modifiedTime desc' } = args;
    let url = `${BASE_DRIVE}/files?pageSize=${page_size}&fields=files(id,name,mimeType,size,modifiedTime,parents)&orderBy=${encodeURIComponent(order_by)}&q=${encodeURIComponent(query)}`;
    if (page_token) url += `&pageToken=${page_token}`;
    return await g('GET', url, null, token);
  }
  if (tool === 'drive_get_file') {
    return await g('GET', `${BASE_DRIVE}/files/${args.file_id}?fields=id,name,mimeType,size,modifiedTime,parents,webViewLink,webContentLink`, null, token);
  }
  if (tool === 'drive_create_folder') {
    return await g('POST', `${BASE_DRIVE}/files`, { name: args.name, mimeType: 'application/vnd.google-apps.folder', parents: args.parent_id ? [args.parent_id] : [] }, token);
  }
  if (tool === 'drive_delete_file') { return await g('DELETE', `${BASE_DRIVE}/files/${args.file_id}`, null, token); }
  if (tool === 'drive_move_file') {
    return await g('PATCH', `${BASE_DRIVE}/files/${args.file_id}?addParents=${args.new_parent_id}&removeParents=${args.old_parent_id}&fields=id,parents`, null, token);
  }
  if (tool === 'drive_rename_file') {
    return await g('PATCH', `${BASE_DRIVE}/files/${args.file_id}?fields=id,name`, { name: args.new_name }, token);
  }
  if (tool === 'drive_copy_file') {
    return await g('POST', `${BASE_DRIVE}/files/${args.file_id}/copy`, { name: args.new_name, parents: args.parent_id ? [args.parent_id] : [] }, token);
  }
  if (tool === 'drive_share_file') {
    return await g('POST', `${BASE_DRIVE}/files/${args.file_id}/permissions`, { type: args.type || 'user', role: args.role || 'reader', emailAddress: args.email }, token);
  }
  if (tool === 'drive_list_permissions') { return await g('GET', `${BASE_DRIVE}/files/${args.file_id}/permissions?fields=permissions(id,type,role,emailAddress)`, null, token); }
  if (tool === 'drive_remove_permission') { return await g('DELETE', `${BASE_DRIVE}/files/${args.file_id}/permissions/${args.permission_id}`, null, token); }
  if (tool === 'drive_search_files') {
    return await g('GET', `${BASE_DRIVE}/files?q=${encodeURIComponent(args.query)}&pageSize=${args.limit || 10}&fields=files(id,name,mimeType,modifiedTime)`, null, token);
  }

  // ── GOOGLE CALENDAR ───────────────────────────────────────────────────────
  const BASE_CAL = 'https://www.googleapis.com/calendar/v3';

  if (tool === 'calendar_list_calendars') { return await g('GET', `${BASE_CAL}/users/me/calendarList`, null, token); }
  if (tool === 'calendar_list_events') {
    const { calendar_id = 'primary', time_min, time_max, max_results = 20, query, order_by = 'startTime', single_events = true } = args;
    let url = `${BASE_CAL}/calendars/${encodeURIComponent(calendar_id)}/events?maxResults=${max_results}&singleEvents=${single_events}&orderBy=${order_by}`;
    if (time_min) url += `&timeMin=${encodeURIComponent(time_min)}`;
    if (time_max) url += `&timeMax=${encodeURIComponent(time_max)}`;
    if (query) url += `&q=${encodeURIComponent(query)}`;
    const data = await g('GET', url, null, token);
    return { events: data.items?.map(e => ({ id: e.id, summary: e.summary, start: e.start, end: e.end, location: e.location, description: e.description, status: e.status })) };
  }
  if (tool === 'calendar_get_event') {
    return await g('GET', `${BASE_CAL}/calendars/${encodeURIComponent(args.calendar_id || 'primary')}/events/${args.event_id}`, null, token);
  }
  if (tool === 'calendar_create_event') {
    const { calendar_id = 'primary', summary, description, location, start, end, attendees, time_zone = 'America/Chicago', all_day } = args;
    if (!summary || !start || !end) throw new Error('summary, start, and end are required');
    const body = { summary, description, location };
    if (all_day) { body.start = { date: start }; body.end = { date: end }; }
    else { body.start = { dateTime: start, timeZone: time_zone }; body.end = { dateTime: end, timeZone: time_zone }; }
    if (attendees) body.attendees = attendees.map(e => ({ email: e }));
    return await g('POST', `${BASE_CAL}/calendars/${encodeURIComponent(calendar_id)}/events`, body, token);
  }
  if (tool === 'calendar_update_event') {
    const { calendar_id = 'primary', event_id, ...updates } = args;
    return await g('PATCH', `${BASE_CAL}/calendars/${encodeURIComponent(calendar_id)}/events/${event_id}`, updates, token);
  }
  if (tool === 'calendar_delete_event') {
    return await g('DELETE', `${BASE_CAL}/calendars/${encodeURIComponent(args.calendar_id || 'primary')}/events/${args.event_id}`, null, token);
  }
  if (tool === 'calendar_get_freebusy') {
    const { time_min, time_max, calendars = ['primary'] } = args;
    return await g('POST', `${BASE_CAL}/freeBusy`, { timeMin: time_min, timeMax: time_max, items: calendars.map(id => ({ id })) }, token);
  }
  if (tool === 'calendar_create_calendar') {
    return await g('POST', `${BASE_CAL}/calendars`, { summary: args.name, description: args.description, timeZone: args.time_zone || 'America/Chicago' }, token);
  }
  if (tool === 'calendar_delete_calendar') { return await g('DELETE', `${BASE_CAL}/calendars/${encodeURIComponent(args.calendar_id)}`, null, token); }
  if (tool === 'calendar_move_event') {
    return await g('POST', `${BASE_CAL}/calendars/${encodeURIComponent(args.source_calendar_id)}/events/${args.event_id}/move?destination=${encodeURIComponent(args.destination_calendar_id)}`, {}, token);
  }

  // ── GOOGLE SHEETS ─────────────────────────────────────────────────────────
  const BASE_SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';

  if (tool === 'sheets_get_spreadsheet') { return await g('GET', `${BASE_SHEETS}/${args.spreadsheet_id}`, null, token); }
  if (tool === 'sheets_create_spreadsheet') {
    return await g('POST', BASE_SHEETS, { properties: { title: args.title }, sheets: args.sheets?.map(s => ({ properties: { title: s } })) || [] }, token);
  }
  if (tool === 'sheets_get_values') {
    const { spreadsheet_id, range, major_dimension = 'ROWS' } = args;
    return await g('GET', `${BASE_SHEETS}/${spreadsheet_id}/values/${encodeURIComponent(range)}?majorDimension=${major_dimension}`, null, token);
  }
  if (tool === 'sheets_update_values') {
    const { spreadsheet_id, range, values, value_input_option = 'USER_ENTERED' } = args;
    return await g('PUT', `${BASE_SHEETS}/${spreadsheet_id}/values/${encodeURIComponent(range)}?valueInputOption=${value_input_option}`, { values }, token);
  }
  if (tool === 'sheets_append_values') {
    const { spreadsheet_id, range, values, value_input_option = 'USER_ENTERED' } = args;
    return await g('POST', `${BASE_SHEETS}/${spreadsheet_id}/values/${encodeURIComponent(range)}:append?valueInputOption=${value_input_option}&insertDataOption=INSERT_ROWS`, { values }, token);
  }
  if (tool === 'sheets_clear_values') {
    return await g('POST', `${BASE_SHEETS}/${args.spreadsheet_id}/values/${encodeURIComponent(args.range)}:clear`, {}, token);
  }
  if (tool === 'sheets_batch_get') {
    const ranges = args.ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
    return await g('GET', `${BASE_SHEETS}/${args.spreadsheet_id}/values:batchGet?${ranges}`, null, token);
  }
  if (tool === 'sheets_add_sheet') {
    return await g('POST', `${BASE_SHEETS}/${args.spreadsheet_id}:batchUpdate`, { requests: [{ addSheet: { properties: { title: args.sheet_title } } }] }, token);
  }
  if (tool === 'sheets_delete_sheet') {
    return await g('POST', `${BASE_SHEETS}/${args.spreadsheet_id}:batchUpdate`, { requests: [{ deleteSheet: { sheetId: args.sheet_id } }] }, token);
  }
  if (tool === 'sheets_format_cells') {
    return await g('POST', `${BASE_SHEETS}/${args.spreadsheet_id}:batchUpdate`, { requests: args.requests }, token);
  }
  if (tool === 'sheets_get_sheet_as_csv') {
    const data = await g('GET', `${BASE_SHEETS}/${args.spreadsheet_id}/values/${encodeURIComponent(args.range || 'A1:Z1000')}`, null, token);
    const csv = (data.values || []).map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    return { csv, rows: (data.values || []).length, note: 'CSV string. Use local_write_file to save to disk.' };
  }

  // ── GOOGLE DOCS ───────────────────────────────────────────────────────────
  const BASE_DOCS = 'https://docs.googleapis.com/v1/documents';

  if (tool === 'docs_get_document') { return await g('GET', `${BASE_DOCS}/${args.document_id}`, null, token); }
  if (tool === 'docs_get_text') {
    const doc = await g('GET', `${BASE_DOCS}/${args.document_id}`, null, token);
    const getText = (content) => (content || []).map(el => {
      if (el.paragraph) return el.paragraph.elements?.map(e => e.textRun?.content || '').join('');
      if (el.table) return el.table.tableRows?.map(r => r.tableCells?.map(c => getText(c.content)).join('\t')).join('\n');
      return '';
    }).join('');
    return { document_id: args.document_id, title: doc.title, text: getText(doc.body?.content)?.slice(0, 50000) };
  }
  if (tool === 'docs_create_document') {
    return await g('POST', BASE_DOCS, { title: args.title }, token);
  }
  if (tool === 'docs_insert_text') {
    return await g('POST', `${BASE_DOCS}/${args.document_id}:batchUpdate`, {
      requests: [{ insertText: { location: { index: args.index || 1 }, text: args.text } }]
    }, token);
  }
  if (tool === 'docs_replace_text') {
    return await g('POST', `${BASE_DOCS}/${args.document_id}:batchUpdate`, {
      requests: [{ replaceAllText: { containsText: { text: args.find_text, matchCase: args.match_case || false }, replaceText: args.replace_text } }]
    }, token);
  }
  if (tool === 'docs_batch_update') {
    return await g('POST', `${BASE_DOCS}/${args.document_id}:batchUpdate`, { requests: args.requests }, token);
  }

  // ── GMAIL DEEPER ──────────────────────────────────────────────────────────
  if (tool === 'gmail_get_attachment') {
    const data = await g('GET', `${BASE_GMAIL}/messages/${args.message_id}/attachments/${args.attachment_id}`, null, token);
    return { attachment_id: args.attachment_id, size: data.size, data_base64: data.data };
  }
  if (tool === 'gmail_list_filters') { return await g('GET', `${BASE_GMAIL}/settings/filters`, null, token); }
  if (tool === 'gmail_create_filter') {
    return await g('POST', `${BASE_GMAIL}/settings/filters`, { criteria: args.criteria, action: args.action }, token);
  }
  if (tool === 'gmail_delete_filter') { return await g('DELETE', `${BASE_GMAIL}/settings/filters/${args.filter_id}`, null, token); }
  if (tool === 'gmail_get_filter') { return await g('GET', `${BASE_GMAIL}/settings/filters/${args.filter_id}`, null, token); }
  if (tool === 'gmail_modify_thread') {
    return await g('POST', `${BASE_GMAIL}/threads/${args.thread_id}/modify`, { addLabelIds: args.add_labels || [], removeLabelIds: args.remove_labels || [] }, token);
  }
  if (tool === 'gmail_untrash_message') { return await g('POST', `${BASE_GMAIL}/messages/${args.message_id}/untrash`, {}, token); }
  if (tool === 'gmail_untrash_thread') { return await g('POST', `${BASE_GMAIL}/threads/${args.thread_id}/untrash`, {}, token); }
  if (tool === 'gmail_delete_thread') { return await g('DELETE', `${BASE_GMAIL}/threads/${args.thread_id}`, null, token); }
  if (tool === 'gmail_reply_to_thread') {
    const { thread_id, to, subject, body } = args;
    const raw = Buffer.from(`To: ${to}\nSubject: ${subject || ''}\nIn-Reply-To: ${thread_id}\n\n${body}`).toString('base64url');
    return await g('POST', `${BASE_GMAIL}/messages/send`, { raw, threadId: thread_id }, token);
  }
  if (tool === 'gmail_forward_message') {
    const msg = await g('GET', `${BASE_GMAIL}/messages/${args.message_id}?format=full`, null, token);
    const subject = (msg.payload?.headers || []).find(h => h.name === 'Subject')?.value || '';
    const getBody = (parts) => {
      for (const p of parts || []) {
        if (p.body?.data) return Buffer.from(p.body.data, 'base64url').toString('utf-8');
        if (p.parts) { const r = getBody(p.parts); if (r) return r; }
      }
      return '';
    };
    const body = msg.payload?.body?.data ? Buffer.from(msg.payload.body.data, 'base64url').toString('utf-8') : getBody(msg.payload?.parts);
    const raw = Buffer.from(`To: ${args.to}\nSubject: Fwd: ${subject}\n\n${args.intro || ''}\n\n---------- Forwarded ----------\n${body}`).toString('base64url');
    return await g('POST', `${BASE_GMAIL}/messages/send`, { raw }, token);
  }
  if (tool === 'gmail_send_html') {
    const { to, subject, html, cc, bcc, from } = args;
    if (!to || !html) throw new Error('to and html required');
    const boundary = '----=_RobinsonsToolkit_' + Date.now();
    const headers_arr = [];
    if (from) headers_arr.push(`From: ${from}`);
    headers_arr.push(`To: ${to}`);
    if (cc) headers_arr.push(`Cc: ${cc}`);
    if (bcc) headers_arr.push(`Bcc: ${bcc}`);
    headers_arr.push(`Subject: ${subject || '(no subject)'}`, 'MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="${boundary}"`);
    const body = headers_arr.join('\r\n') + `\r\n\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${html}\r\n--${boundary}--`;
    return await g('POST', `${BASE_GMAIL}/messages/send`, { raw: Buffer.from(body).toString('base64url') }, token);
  }
  if (tool === 'gmail_send_with_attachment') {
    const { to, subject, body, attachment_filename, attachment_base64, attachment_mime = 'application/octet-stream' } = args;
    if (!to || !attachment_filename || !attachment_base64) throw new Error('to, attachment_filename, attachment_base64 required');
    const boundary = '----=_RT_' + Date.now();
    const lines = [`To: ${to}`, `Subject: ${subject || ''}`, 'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${boundary}"`, '', `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', '', body || '', `--${boundary}`, `Content-Type: ${attachment_mime}; name="${attachment_filename}"`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${attachment_filename}"`, '', attachment_base64.replace(/(.{76})/g, '$1\n'), `--${boundary}--`];
    return await g('POST', `${BASE_GMAIL}/messages/send`, { raw: Buffer.from(lines.join('\r\n')).toString('base64url') }, token);
  }
  if (tool === 'gmail_update_draft') {
    const raw = Buffer.from(`To: ${args.to}\nSubject: ${args.subject || ''}\n\n${args.body || ''}`).toString('base64url');
    return await g('PUT', `${BASE_GMAIL}/drafts/${args.draft_id}`, { message: { raw } }, token);
  }
  if (tool === 'gmail_delete_draft') { return await g('DELETE', `${BASE_GMAIL}/drafts/${args.draft_id}`, null, token); }
  if (tool === 'gmail_get_draft') { return await g('GET', `${BASE_GMAIL}/drafts/${args.draft_id}?format=full`, null, token); }
  if (tool === 'gmail_list_history') {
    return await g('GET', `${BASE_GMAIL}/history?startHistoryId=${args.start_history_id}&maxResults=${args.max_results||100}`, null, token);
  }
  if (tool === 'gmail_get_vacation_settings') { return await g('GET', `${BASE_GMAIL}/settings/vacation`, null, token); }
  if (tool === 'gmail_update_vacation_settings') {
    return await g('PUT', `${BASE_GMAIL}/settings/vacation`, { enableAutoReply: args.enabled, responseSubject: args.subject, responseBodyPlainText: args.body, restrictToContacts: args.restrict_to_contacts, restrictToDomain: args.restrict_to_domain, startTime: args.start_time, endTime: args.end_time }, token);
  }
  if (tool === 'gmail_update_label') {
    return await g('PATCH', `${BASE_GMAIL}/labels/${args.label_id}`, { name: args.name, labelListVisibility: args.visibility }, token);
  }

  // ── DRIVE DEEPER ──────────────────────────────────────────────────────────
  if (tool === 'drive_create_doc') {
    const docs = await g('POST', BASE_DOCS, { title: args.title }, token);
    if (args.content) {
      await g('POST', `${BASE_DOCS}/${docs.documentId}:batchUpdate`, { requests: [{ insertText: { location: { index: 1 }, text: args.content } }] }, token);
    }
    return { document_id: docs.documentId, title: docs.title, url: `https://docs.google.com/document/d/${docs.documentId}/edit` };
  }
  if (tool === 'drive_create_spreadsheet') {
    const sheet = await g('POST', BASE_SHEETS, { properties: { title: args.title } }, token);
    return { spreadsheet_id: sheet.spreadsheetId, title: sheet.properties?.title, url: `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}/edit` };
  }
  if (tool === 'drive_upload_file') {
    const { filename, content_base64, mime_type = 'application/octet-stream', folder_id } = args;
    if (!filename || !content_base64) throw new Error('filename and content_base64 required');
    const metadata = { name: filename };
    if (folder_id) metadata.parents = [folder_id];
    const boundary = '-------rt' + Date.now();
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mime_type}\r\nContent-Transfer-Encoding: base64\r\n\r\n${content_base64}\r\n--${boundary}--`;
    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': `multipart/related; boundary="${boundary}"` }, body
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Drive upload ${res.status}: ${data.error?.message}`);
    return data;
  }
  if (tool === 'drive_download_file') {
    const res = await fetch(`${BASE_DRIVE}/files/${args.file_id}?alt=media`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) { const e = await res.json(); throw new Error(`Drive download ${res.status}: ${e.error?.message}`); }
    const buf = await res.arrayBuffer();
    return { file_id: args.file_id, size_bytes: buf.byteLength, content_base64: Buffer.from(buf).toString('base64') };
  }
  if (tool === 'drive_export_file') {
    const res = await fetch(`${BASE_DRIVE}/files/${args.file_id}/export?mimeType=${encodeURIComponent(args.mime_type)}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) { const e = await res.json(); throw new Error(`Drive export ${res.status}: ${e.error?.message}`); }
    const buf = await res.arrayBuffer();
    return { file_id: args.file_id, mime_type: args.mime_type, size_bytes: buf.byteLength, content_base64: Buffer.from(buf).toString('base64') };
  }
  if (tool === 'drive_export_as_pdf') {
    const res = await fetch(`${BASE_DRIVE}/files/${args.file_id}/export?mimeType=application/pdf`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) { const e = await res.json(); throw new Error(`PDF export ${res.status}: ${e.error?.message}`); }
    const buf = await res.arrayBuffer();
    return { file_id: args.file_id, size_bytes: buf.byteLength, pdf_base64: Buffer.from(buf).toString('base64') };
  }
  if (tool === 'drive_list_shared_with_me') {
    return await g('GET', `${BASE_DRIVE}/files?q=sharedWithMe&pageSize=${args.page_size||20}&fields=files(id,name,mimeType,owners,sharedWithMeTime)`, null, token);
  }
  if (tool === 'drive_list_recent_files') {
    return await g('GET', `${BASE_DRIVE}/files?orderBy=viewedByMeTime%20desc&pageSize=${args.page_size||20}&fields=files(id,name,mimeType,viewedByMeTime,modifiedTime)`, null, token);
  }
  if (tool === 'drive_list_starred') {
    return await g('GET', `${BASE_DRIVE}/files?q=starred%3Dtrue&pageSize=${args.page_size||20}&fields=files(id,name,mimeType)`, null, token);
  }
  if (tool === 'drive_star_file') { return await g('PATCH', `${BASE_DRIVE}/files/${args.file_id}`, { starred: true }, token); }
  if (tool === 'drive_unstar_file') { return await g('PATCH', `${BASE_DRIVE}/files/${args.file_id}`, { starred: false }, token); }
  if (tool === 'drive_create_shortcut') {
    return await g('POST', `${BASE_DRIVE}/files`, { name: args.name, mimeType: 'application/vnd.google-apps.shortcut', shortcutDetails: { targetId: args.target_id }, parents: args.parent_id ? [args.parent_id] : undefined }, token);
  }
  if (tool === 'drive_list_revisions') { return await g('GET', `${BASE_DRIVE}/files/${args.file_id}/revisions?fields=revisions(id,modifiedTime,size,lastModifyingUser)`, null, token); }
  if (tool === 'drive_get_revision') { return await g('GET', `${BASE_DRIVE}/files/${args.file_id}/revisions/${args.revision_id}`, null, token); }
  if (tool === 'drive_delete_revision') { return await g('DELETE', `${BASE_DRIVE}/files/${args.file_id}/revisions/${args.revision_id}`, null, token); }
  if (tool === 'drive_get_storage_quota') {
    return await g('GET', `${BASE_DRIVE}/about?fields=storageQuota,user`, null, token);
  }
  if (tool === 'drive_empty_trash') { return await g('DELETE', `${BASE_DRIVE}/files/trash`, null, token); }
  if (tool === 'drive_list_trash') { return await g('GET', `${BASE_DRIVE}/files?q=trashed%3Dtrue&pageSize=${args.page_size||20}`, null, token); }
  if (tool === 'drive_restore_from_trash') { return await g('PATCH', `${BASE_DRIVE}/files/${args.file_id}`, { trashed: false }, token); }
  if (tool === 'drive_watch_file') {
    return await g('POST', `${BASE_DRIVE}/files/${args.file_id}/watch`, { id: args.channel_id, type: 'web_hook', address: args.webhook_url }, token);
  }

  // ── CALENDAR DEEPER ───────────────────────────────────────────────────────
  if (tool === 'calendar_create_recurring_event') {
    return await g('POST', `${BASE_CAL}/calendars/${encodeURIComponent(args.calendar_id || 'primary')}/events`, {
      summary: args.summary, description: args.description, location: args.location,
      start: { dateTime: args.start, timeZone: args.time_zone || 'UTC' },
      end: { dateTime: args.end, timeZone: args.time_zone || 'UTC' },
      recurrence: Array.isArray(args.recurrence) ? args.recurrence : [args.recurrence || 'RRULE:FREQ=WEEKLY;COUNT=10']
    }, token);
  }
  if (tool === 'calendar_list_event_instances') {
    return await g('GET', `${BASE_CAL}/calendars/${encodeURIComponent(args.calendar_id || 'primary')}/events/${args.event_id}/instances?maxResults=${args.max_results||10}`, null, token);
  }
  if (tool === 'calendar_create_video_meeting') {
    return await g('POST', `${BASE_CAL}/calendars/${encodeURIComponent(args.calendar_id || 'primary')}/events?conferenceDataVersion=1`, {
      summary: args.summary, description: args.description,
      start: { dateTime: args.start, timeZone: args.time_zone || 'UTC' },
      end: { dateTime: args.end, timeZone: args.time_zone || 'UTC' },
      attendees: (args.attendees || []).map(email => ({ email })),
      conferenceData: { createRequest: { requestId: `rt-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } }
    }, token);
  }
  if (tool === 'calendar_quick_add') {
    return await g('POST', `${BASE_CAL}/calendars/${encodeURIComponent(args.calendar_id || 'primary')}/events/quickAdd?text=${encodeURIComponent(args.text)}`, null, token);
  }
  if (tool === 'calendar_add_attendee') {
    const event = await g('GET', `${BASE_CAL}/calendars/${encodeURIComponent(args.calendar_id || 'primary')}/events/${args.event_id}`, null, token);
    const attendees = event.attendees || [];
    if (!attendees.find(a => a.email === args.email)) attendees.push({ email: args.email, optional: args.optional || false });
    return await g('PATCH', `${BASE_CAL}/calendars/${encodeURIComponent(args.calendar_id || 'primary')}/events/${args.event_id}`, { attendees }, token);
  }
  if (tool === 'calendar_set_event_color') {
    return await g('PATCH', `${BASE_CAL}/calendars/${encodeURIComponent(args.calendar_id || 'primary')}/events/${args.event_id}`, { colorId: String(args.color_id) }, token);
  }
  if (tool === 'calendar_list_acl') { return await g('GET', `${BASE_CAL}/calendars/${encodeURIComponent(args.calendar_id || 'primary')}/acl`, null, token); }
  if (tool === 'calendar_share_calendar') {
    return await g('POST', `${BASE_CAL}/calendars/${encodeURIComponent(args.calendar_id || 'primary')}/acl`, { role: args.role || 'reader', scope: { type: args.scope_type || 'user', value: args.email } }, token);
  }
  if (tool === 'calendar_unshare_calendar') {
    return await g('DELETE', `${BASE_CAL}/calendars/${encodeURIComponent(args.calendar_id || 'primary')}/acl/${args.rule_id}`, null, token);
  }
  if (tool === 'calendar_list_event_colors') { return await g('GET', `${BASE_CAL}/colors`, null, token); }
  if (tool === 'calendar_get_settings') { return await g('GET', `${BASE_CAL}/users/me/settings`, null, token); }

  // ── SHEETS DEEPER ─────────────────────────────────────────────────────────
  if (tool === 'sheets_duplicate_sheet') {
    return await g('POST', `${BASE_SHEETS}/${args.spreadsheet_id}:batchUpdate`, {
      requests: [{ duplicateSheet: { sourceSheetId: args.source_sheet_id, insertSheetIndex: args.insert_index, newSheetName: args.new_name } }]
    }, token);
  }
  if (tool === 'sheets_copy_to_spreadsheet') {
    return await g('POST', `${BASE_SHEETS}/${args.spreadsheet_id}/sheets/${args.sheet_id}:copyTo`, { destinationSpreadsheetId: args.destination_spreadsheet_id }, token);
  }
  if (tool === 'sheets_find_replace') {
    return await g('POST', `${BASE_SHEETS}/${args.spreadsheet_id}:batchUpdate`, {
      requests: [{ findReplace: { find: args.find, replacement: args.replacement, allSheets: args.all_sheets !== false, matchCase: args.match_case || false, matchEntireCell: args.match_entire_cell || false } }]
    }, token);
  }
  if (tool === 'sheets_sort_range') {
    return await g('POST', `${BASE_SHEETS}/${args.spreadsheet_id}:batchUpdate`, {
      requests: [{ sortRange: { range: args.range, sortSpecs: [{ dimensionIndex: args.column_index || 0, sortOrder: args.order || 'ASCENDING' }] } }]
    }, token);
  }
  if (tool === 'sheets_merge_cells') {
    return await g('POST', `${BASE_SHEETS}/${args.spreadsheet_id}:batchUpdate`, {
      requests: [{ mergeCells: { range: args.range, mergeType: args.merge_type || 'MERGE_ALL' } }]
    }, token);
  }
  if (tool === 'sheets_unmerge_cells') {
    return await g('POST', `${BASE_SHEETS}/${args.spreadsheet_id}:batchUpdate`, { requests: [{ unmergeCells: { range: args.range } }] }, token);
  }
  if (tool === 'sheets_autoresize_columns') {
    return await g('POST', `${BASE_SHEETS}/${args.spreadsheet_id}:batchUpdate`, {
      requests: [{ autoResizeDimensions: { dimensions: { sheetId: args.sheet_id, dimension: 'COLUMNS', startIndex: args.start_index || 0, endIndex: args.end_index || 26 } } }]
    }, token);
  }
  if (tool === 'sheets_freeze_rows') {
    return await g('POST', `${BASE_SHEETS}/${args.spreadsheet_id}:batchUpdate`, {
      requests: [{ updateSheetProperties: { properties: { sheetId: args.sheet_id, gridProperties: { frozenRowCount: args.row_count || 1 } }, fields: 'gridProperties.frozenRowCount' } }]
    }, token);
  }
  if (tool === 'sheets_protect_range') {
    return await g('POST', `${BASE_SHEETS}/${args.spreadsheet_id}:batchUpdate`, {
      requests: [{ addProtectedRange: { protectedRange: { range: args.range, description: args.description, warningOnly: args.warning_only || false, editors: args.editors } } }]
    }, token);
  }
  if (tool === 'sheets_add_conditional_formatting') {
    return await g('POST', `${BASE_SHEETS}/${args.spreadsheet_id}:batchUpdate`, {
      requests: [{ addConditionalFormatRule: { rule: { ranges: [args.range], booleanRule: { condition: args.condition, format: args.format } }, index: args.index || 0 } }]
    }, token);
  }
  if (tool === 'sheets_batch_update_values') {
    return await g('POST', `${BASE_SHEETS}/${args.spreadsheet_id}/values:batchUpdate`, { valueInputOption: args.value_input_option || 'USER_ENTERED', data: args.data }, token);
  }
  if (tool === 'sheets_get_metadata') { return await g('GET', `${BASE_SHEETS}/${args.spreadsheet_id}?fields=sheets.properties,namedRanges,developerMetadata`, null, token); }

  // ── DOCS DEEPER ───────────────────────────────────────────────────────────
  if (tool === 'docs_append_paragraph') {
    const doc = await g('GET', `${BASE_DOCS}/${args.document_id}`, null, token);
    const endIndex = doc.body?.content?.[doc.body.content.length - 1]?.endIndex || 1;
    return await g('POST', `${BASE_DOCS}/${args.document_id}:batchUpdate`, {
      requests: [{ insertText: { location: { index: endIndex - 1 }, text: '\n' + args.text } }]
    }, token);
  }
  if (tool === 'docs_list_headings') {
    const doc = await g('GET', `${BASE_DOCS}/${args.document_id}`, null, token);
    const headings = [];
    for (const el of doc.body?.content || []) {
      if (el.paragraph?.paragraphStyle?.namedStyleType?.startsWith('HEADING_')) {
        const text = (el.paragraph.elements || []).map(e => e.textRun?.content || '').join('').trim();
        headings.push({ level: parseInt(el.paragraph.paragraphStyle.namedStyleType.split('_')[1]), text, start_index: el.startIndex });
      }
    }
    return { document_id: args.document_id, headings };
  }
  if (tool === 'docs_insert_image') {
    return await g('POST', `${BASE_DOCS}/${args.document_id}:batchUpdate`, {
      requests: [{ insertInlineImage: { location: { index: args.index || 1 }, uri: args.image_url, objectSize: args.size } }]
    }, token);
  }
  if (tool === 'docs_insert_table') {
    return await g('POST', `${BASE_DOCS}/${args.document_id}:batchUpdate`, {
      requests: [{ insertTable: { location: { index: args.index || 1 }, rows: args.rows, columns: args.columns } }]
    }, token);
  }
  if (tool === 'docs_create_named_range') {
    return await g('POST', `${BASE_DOCS}/${args.document_id}:batchUpdate`, {
      requests: [{ createNamedRange: { name: args.name, range: { startIndex: args.start_index, endIndex: args.end_index } } }]
    }, token);
  }
  if (tool === 'docs_delete_content') {
    return await g('POST', `${BASE_DOCS}/${args.document_id}:batchUpdate`, {
      requests: [{ deleteContentRange: { range: { startIndex: args.start_index, endIndex: args.end_index } } }]
    }, token);
  }
  if (tool === 'docs_export_as_pdf') {
    const res = await fetch(`${BASE_DRIVE}/files/${args.document_id}/export?mimeType=application/pdf`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) { const e = await res.json(); throw new Error(`PDF export ${res.status}: ${e.error?.message}`); }
    const buf = await res.arrayBuffer();
    return { document_id: args.document_id, size_bytes: buf.byteLength, pdf_base64: Buffer.from(buf).toString('base64') };
  }
  if (tool === 'docs_export_as_docx') {
    const res = await fetch(`${BASE_DRIVE}/files/${args.document_id}/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) { const e = await res.json(); throw new Error(`Docx export ${res.status}: ${e.error?.message}`); }
    const buf = await res.arrayBuffer();
    return { document_id: args.document_id, size_bytes: buf.byteLength, docx_base64: Buffer.from(buf).toString('base64') };
  }
  if (tool === 'docs_export_as_html') {
    const res = await fetch(`${BASE_DRIVE}/files/${args.document_id}/export?mimeType=text/html`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) { const e = await res.json(); throw new Error(`HTML export ${res.status}: ${e.error?.message}`); }
    return { document_id: args.document_id, html: await res.text() };
  }

  // ── GOOGLE SLIDES ─────────────────────────────────────────────────────────
  const BASE_SLIDES = 'https://slides.googleapis.com/v1/presentations';

  if (tool === 'slides_get_presentation') { return await g('GET', `${BASE_SLIDES}/${args.presentation_id}`, null, token); }
  if (tool === 'slides_create_presentation') { return await g('POST', BASE_SLIDES, { title: args.title }, token); }
  if (tool === 'slides_get_slide') { return await g('GET', `${BASE_SLIDES}/${args.presentation_id}/pages/${args.slide_id}`, null, token); }
  if (tool === 'slides_create_slide') {
    return await g('POST', `${BASE_SLIDES}/${args.presentation_id}:batchUpdate`, {
      requests: [{ createSlide: { insertionIndex: args.index, slideLayoutReference: { predefinedLayout: args.layout || 'TITLE_AND_BODY' } } }]
    }, token);
  }
  if (tool === 'slides_delete_slide') {
    return await g('POST', `${BASE_SLIDES}/${args.presentation_id}:batchUpdate`, { requests: [{ deleteObject: { objectId: args.slide_id } }] }, token);
  }
  if (tool === 'slides_replace_all_text') {
    return await g('POST', `${BASE_SLIDES}/${args.presentation_id}:batchUpdate`, {
      requests: [{ replaceAllText: { containsText: { text: args.find, matchCase: args.match_case || false }, replaceText: args.replace } }]
    }, token);
  }
  if (tool === 'slides_batch_update') {
    return await g('POST', `${BASE_SLIDES}/${args.presentation_id}:batchUpdate`, { requests: args.requests }, token);
  }
  if (tool === 'slides_export_as_pdf') {
    const res = await fetch(`${BASE_DRIVE}/files/${args.presentation_id}/export?mimeType=application/pdf`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) { const e = await res.json(); throw new Error(`Slides PDF export ${res.status}: ${e.error?.message}`); }
    const buf = await res.arrayBuffer();
    return { presentation_id: args.presentation_id, size_bytes: buf.byteLength, pdf_base64: Buffer.from(buf).toString('base64') };
  }
  if (tool === 'slides_get_thumbnail') {
    return await g('GET', `${BASE_SLIDES}/${args.presentation_id}/pages/${args.slide_id}/thumbnail?thumbnailProperties.thumbnailSize=${args.size || 'MEDIUM'}`, null, token);
  }

  // ── GOOGLE FORMS ──────────────────────────────────────────────────────────
  const BASE_FORMS = 'https://forms.googleapis.com/v1/forms';

  if (tool === 'forms_get') { return await g('GET', `${BASE_FORMS}/${args.form_id}`, null, token); }
  if (tool === 'forms_create') { return await g('POST', BASE_FORMS, { info: { title: args.title, documentTitle: args.title } }, token); }
  if (tool === 'forms_list_responses') { return await g('GET', `${BASE_FORMS}/${args.form_id}/responses?pageSize=${args.page_size||50}`, null, token); }
  if (tool === 'forms_get_response') { return await g('GET', `${BASE_FORMS}/${args.form_id}/responses/${args.response_id}`, null, token); }
  if (tool === 'forms_batch_update') { return await g('POST', `${BASE_FORMS}/${args.form_id}:batchUpdate`, { requests: args.requests }, token); }

  // ── GOOGLE PEOPLE (Contacts) ──────────────────────────────────────────────
  const BASE_PEOPLE = 'https://people.googleapis.com/v1';

  if (tool === 'contacts_list') {
    return await g('GET', `${BASE_PEOPLE}/people/me/connections?pageSize=${args.page_size||100}&personFields=names,emailAddresses,phoneNumbers,organizations`, null, token);
  }
  if (tool === 'contacts_get') { return await g('GET', `${BASE_PEOPLE}/${args.resource_name}?personFields=names,emailAddresses,phoneNumbers,organizations,addresses,birthdays`, null, token); }
  if (tool === 'contacts_create') {
    return await g('POST', `${BASE_PEOPLE}/people:createContact`, {
      names: args.name ? [{ givenName: args.given_name, familyName: args.family_name, displayName: args.name }] : undefined,
      emailAddresses: args.email ? [{ value: args.email }] : undefined,
      phoneNumbers: args.phone ? [{ value: args.phone }] : undefined,
      organizations: args.company ? [{ name: args.company, title: args.title }] : undefined
    }, token);
  }
  if (tool === 'contacts_update') {
    return await g('PATCH', `${BASE_PEOPLE}/${args.resource_name}:updateContact?updatePersonFields=${args.update_fields || 'names,emailAddresses,phoneNumbers'}`, args.body, token);
  }
  if (tool === 'contacts_delete') { return await g('DELETE', `${BASE_PEOPLE}/${args.resource_name}:deleteContact`, null, token); }
  if (tool === 'contacts_search') {
    return await g('GET', `${BASE_PEOPLE}/people:searchContacts?query=${encodeURIComponent(args.query)}&readMask=names,emailAddresses,phoneNumbers`, null, token);
  }
  if (tool === 'contacts_list_groups') { return await g('GET', `${BASE_PEOPLE}/contactGroups?pageSize=${args.page_size||50}`, null, token); }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║                         SUPER TOOLS                                  ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  // SUPER TOOL: google_create_project_workspace
  // Create Drive folder + linked Sheet tracker + linked Doc brief in one call
  if (tool === 'google_create_project_workspace') {
    const { project_name, parent_folder_id } = args;
    if (!project_name) throw new Error('project_name required');
    const folder = await g('POST', `${BASE_DRIVE}/files`, { name: project_name, mimeType: 'application/vnd.google-apps.folder', parents: parent_folder_id ? [parent_folder_id] : undefined }, token);
    const sheet = await g('POST', BASE_SHEETS, { properties: { title: `${project_name} - Tracker` } }, token);
    await g('PATCH', `${BASE_DRIVE}/files/${sheet.spreadsheetId}?addParents=${folder.id}&removeParents=root`, {}, token).catch(() => null);
    const doc = await g('POST', BASE_DOCS, { title: `${project_name} - Brief` }, token);
    await g('PATCH', `${BASE_DRIVE}/files/${doc.documentId}?addParents=${folder.id}&removeParents=root`, {}, token).catch(() => null);
    return {
      folder: { id: folder.id, name: folder.name, url: `https://drive.google.com/drive/folders/${folder.id}` },
      tracker: { id: sheet.spreadsheetId, title: sheet.properties?.title, url: `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}/edit` },
      brief: { id: doc.documentId, title: doc.title, url: `https://docs.google.com/document/d/${doc.documentId}/edit` }
    };
  }

  // SUPER TOOL: google_email_with_drive_attachment
  // Send Gmail with a Drive file attached (downloads then attaches)
  if (tool === 'google_email_with_drive_attachment') {
    const { to, subject, body, drive_file_id } = args;
    if (!to || !drive_file_id) throw new Error('to and drive_file_id required');
    const meta = await g('GET', `${BASE_DRIVE}/files/${drive_file_id}?fields=name,mimeType`, null, token);
    const dl = await fetch(`${BASE_DRIVE}/files/${drive_file_id}?alt=media`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!dl.ok) {
      // Maybe a Google Doc — try exporting as PDF
      const exp = await fetch(`${BASE_DRIVE}/files/${drive_file_id}/export?mimeType=application/pdf`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!exp.ok) throw new Error(`Cannot download or export file ${drive_file_id}`);
      const buf = Buffer.from(await exp.arrayBuffer());
      const boundary = '----=_RT_' + Date.now();
      const lines = [`To: ${to}`, `Subject: ${subject || meta.name}`, 'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${boundary}"`, '', `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', '', body || '', `--${boundary}`, `Content-Type: application/pdf; name="${meta.name}.pdf"`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${meta.name}.pdf"`, '', buf.toString('base64').replace(/(.{76})/g, '$1\n'), `--${boundary}--`];
      return await g('POST', `${BASE_GMAIL}/messages/send`, { raw: Buffer.from(lines.join('\r\n')).toString('base64url') }, token);
    }
    const buf = Buffer.from(await dl.arrayBuffer());
    const boundary = '----=_RT_' + Date.now();
    const lines = [`To: ${to}`, `Subject: ${subject || meta.name}`, 'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${boundary}"`, '', `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', '', body || '', `--${boundary}`, `Content-Type: ${meta.mimeType}; name="${meta.name}"`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${meta.name}"`, '', buf.toString('base64').replace(/(.{76})/g, '$1\n'), `--${boundary}--`];
    return await g('POST', `${BASE_GMAIL}/messages/send`, { raw: Buffer.from(lines.join('\r\n')).toString('base64url') }, token);
  }

  // SUPER TOOL: google_schedule_meeting_with_invites
  // Create Calendar event + Meet link + send Gmail invites
  if (tool === 'google_schedule_meeting_with_invites') {
    const { summary, start, end, attendees, description, send_email = true } = args;
    if (!summary || !start || !end || !Array.isArray(attendees)) throw new Error('summary, start, end, attendees[] required');
    const event = await g('POST', `${BASE_CAL}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=${send_email ? 'all' : 'none'}`, {
      summary, description,
      start: { dateTime: start, timeZone: 'UTC' },
      end: { dateTime: end, timeZone: 'UTC' },
      attendees: attendees.map(email => ({ email })),
      conferenceData: { createRequest: { requestId: `rt-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } }
    }, token);
    return {
      event_id: event.id,
      meet_link: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri,
      html_link: event.htmlLink,
      attendees: event.attendees?.map(a => a.email),
      invites_sent: send_email
    };
  }

  // SUPER TOOL: google_spreadsheet_report
  // Create a Sheet with formatted header + rows + auto-resize columns
  if (tool === 'google_spreadsheet_report') {
    const { title, headers: hdrs, rows, freeze_header = true } = args;
    if (!title || !Array.isArray(hdrs) || !Array.isArray(rows)) throw new Error('title, headers[], rows[][] required');
    const sheet = await g('POST', BASE_SHEETS, { properties: { title }, sheets: [{ properties: { title: 'Report', gridProperties: { frozenRowCount: freeze_header ? 1 : 0 } } }] }, token);
    const sid = sheet.sheets[0].properties.sheetId;
    await g('POST', `${BASE_SHEETS}/${sheet.spreadsheetId}/values/Report!A1:append?valueInputOption=USER_ENTERED`, { values: [hdrs, ...rows] }, token);
    await g('POST', `${BASE_SHEETS}/${sheet.spreadsheetId}:batchUpdate`, {
      requests: [
        { repeatCell: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.2, green: 0.4, blue: 0.7 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true } } }, fields: 'userEnteredFormat(backgroundColor,textFormat)' } },
        { autoResizeDimensions: { dimensions: { sheetId: sid, dimension: 'COLUMNS', startIndex: 0, endIndex: hdrs.length } } }
      ]
    }, token);
    return { spreadsheet_id: sheet.spreadsheetId, title: sheet.properties.title, url: `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}/edit`, rows_written: rows.length };
  }

  // SUPER TOOL: google_search_all_workspace
  // Search across Drive + Gmail in parallel
  if (tool === 'google_search_all_workspace') {
    const { query } = args;
    if (!query) throw new Error('query required');
    const [files, messages] = await Promise.allSettled([
      g('GET', `${BASE_DRIVE}/files?q=fullText%20contains%20%27${encodeURIComponent(query)}%27&pageSize=10&fields=files(id,name,mimeType,webViewLink)`, null, token),
      g('GET', `${BASE_GMAIL}/messages?q=${encodeURIComponent(query)}&maxResults=10`, null, token)
    ]);
    return {
      query,
      drive_files: files.status === 'fulfilled' ? files.value.files || [] : [],
      gmail_messages: messages.status === 'fulfilled' ? messages.value.messages || [] : [],
      drive_error: files.status === 'rejected' ? files.reason.message : null,
      gmail_error: messages.status === 'rejected' ? messages.reason.message : null
    };
  }

  throw new Error(`Unknown Google Workspace tool: ${tool}`);
}

export default { execute };
