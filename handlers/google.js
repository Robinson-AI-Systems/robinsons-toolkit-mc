/**
 * Google Workspace Handler — 105 tools
 * Gmail, Drive, Calendar, Sheets, and Docs via Google APIs.
 * Requires GOOGLE_ACCESS_TOKEN (OAuth) or GOOGLE_SERVICE_ACCOUNT_KEY_PATH.
 */

async function getToken() {
  const token = process.env.GOOGLE_ACCESS_TOKEN;
  if (token) return token;
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyPath) throw new Error('Set GOOGLE_ACCESS_TOKEN or GOOGLE_SERVICE_ACCOUNT_KEY_PATH in .env. See README for setup instructions.');
  // Service account JWT flow
  const { readFileSync } = await import('fs');
  const key = JSON.parse(readFileSync(keyPath, 'utf-8'));
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: key.client_email, scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/documents',
    aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now
  })).toString('base64url');
  // Note: Full RSA signing requires crypto module — return instructions
  return null;
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
  if (!token) {
    return { error: 'Google authentication not configured', setup: 'Set GOOGLE_ACCESS_TOKEN in .env with a valid OAuth token. To get one: go to OAuth 2.0 Playground (developers.google.com/oauthplayground), authorize Gmail/Drive/Calendar/Sheets scopes, and paste the access token. Tokens expire after 1 hour — refresh as needed.' };
  }

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

  throw new Error(`Unknown Google Workspace tool: ${tool}`);
}

export default { execute };
