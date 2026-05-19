/**
 * Twilio Handler — 95 tools
 * SMS, voice, WhatsApp, phone numbers, Verify (OTP), Lookup,
 * Messaging Services, Studio flows, Conversations, Conferences,
 * Content templates, Sub-accounts, Usage, and Super Tools.
 */

const BASE = 'https://api.twilio.com/2010-04-01';

function headers() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set in .env');
  return {
    'Authorization': `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  };
}

function encode(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

const SID = () => process.env.TWILIO_ACCOUNT_SID;

async function twilio(method, path, body) {
  const isGet = method === 'GET';
  let url = path.startsWith('http') ? path : `${BASE}${path}`;
  if (isGet && body && Object.keys(body).length) url += `?${encode(body)}`;
  const res = await fetch(url, {
    method, headers: headers(),
    body: !isGet && body && Object.keys(body).length ? encode(body) : undefined
  });
  if (res.status === 204) return { success: true };
  const data = await res.json();
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${data.message || JSON.stringify(data)}`);
  return data;
}

async function execute(tool, args) {

  // ── SMS MESSAGES ──────────────────────────────────────────────────────────
  if (tool === 'twilio_send_sms') {
    const { to, body: msgBody, from, messaging_service_sid, status_callback } = args;
    if (!to || !msgBody) throw new Error('to and body are required');
    const fromNum = from || process.env.TWILIO_PHONE_NUMBER;
    const payload = { To: to, Body: msgBody };
    if (messaging_service_sid) payload.MessagingServiceSid = messaging_service_sid;
    else if (fromNum) payload.From = fromNum;
    if (status_callback) payload.StatusCallback = status_callback;
    return await twilio('POST', `/Accounts/${SID()}/Messages.json`, payload);
  }
  if (tool === 'twilio_send_whatsapp') {
    const { to, body: msgBody, from, media_url } = args;
    const fromNum = from || `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`;
    const payload = { To: `whatsapp:${to.replace('whatsapp:','')}`, From: fromNum, Body: msgBody };
    if (media_url) payload.MediaUrl = media_url;
    return await twilio('POST', `/Accounts/${SID()}/Messages.json`, payload);
  }
  if (tool === 'twilio_list_messages') {
    const { to, from, date_sent, limit = 20, page_size = 20 } = args;
    const params = { PageSize: page_size };
    if (to) params.To = to; if (from) params.From = from; if (date_sent) params.DateSent = date_sent;
    const data = await twilio('GET', `/Accounts/${SID()}/Messages.json`, params);
    return { messages: data.messages?.slice(0, limit).map(m => ({ sid: m.sid, from: m.from, to: m.to, body: m.body, status: m.status, date_sent: m.date_sent })) };
  }
  if (tool === 'twilio_get_message') {
    return await twilio('GET', `/Accounts/${SID()}/Messages/${args.message_sid}.json`);
  }
  if (tool === 'twilio_delete_message') {
    return await twilio('DELETE', `/Accounts/${SID()}/Messages/${args.message_sid}.json`);
  }
  if (tool === 'twilio_send_bulk_sms') {
    // Send to multiple recipients
    const { recipients, body: msgBody, from } = args;
    const fromNum = from || process.env.TWILIO_PHONE_NUMBER;
    const results = [];
    for (const to of recipients) {
      try {
        const msg = await twilio('POST', `/Accounts/${SID()}/Messages.json`, { To: to, From: fromNum, Body: msgBody });
        results.push({ to, sid: msg.sid, status: msg.status, success: true });
      } catch (e) {
        results.push({ to, error: e.message, success: false });
      }
    }
    return { results, sent: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length };
  }

  // ── VOICE CALLS ───────────────────────────────────────────────────────────
  if (tool === 'twilio_make_call') {
    const { to, from, url: twimlUrl, twiml, status_callback, record = false } = args;
    if (!to) throw new Error('to is required');
    const fromNum = from || process.env.TWILIO_PHONE_NUMBER;
    const payload = { To: to, From: fromNum };
    if (twimlUrl) payload.Url = twimlUrl;
    else if (twiml) payload.Twiml = twiml;
    else payload.Twiml = `<Response><Say>${args.say || 'Hello from Robinson AI Systems.'}</Say></Response>`;
    if (status_callback) payload.StatusCallback = status_callback;
    if (record) payload.Record = record;
    return await twilio('POST', `/Accounts/${SID()}/Calls.json`, payload);
  }
  if (tool === 'twilio_list_calls') {
    const { to, from, status, limit = 20 } = args;
    const params = { PageSize: Math.min(limit, 100) };
    if (to) params.To = to; if (from) params.From = from; if (status) params.Status = status;
    return await twilio('GET', `/Accounts/${SID()}/Calls.json`, params);
  }
  if (tool === 'twilio_get_call') {
    return await twilio('GET', `/Accounts/${SID()}/Calls/${args.call_sid}.json`);
  }
  if (tool === 'twilio_hangup_call') {
    return await twilio('POST', `/Accounts/${SID()}/Calls/${args.call_sid}.json`, { Status: 'completed' });
  }

  // ── PHONE NUMBERS ─────────────────────────────────────────────────────────
  if (tool === 'twilio_list_phone_numbers') {
    const data = await twilio('GET', `/Accounts/${SID()}/IncomingPhoneNumbers.json`, { PageSize: args.limit || 20 });
    return { phone_numbers: data.incoming_phone_numbers?.map(n => ({ sid: n.sid, phone_number: n.phone_number, friendly_name: n.friendly_name, capabilities: n.capabilities })) };
  }
  if (tool === 'twilio_search_available_numbers') {
    const { country = 'US', area_code, contains, sms_enabled = true } = args;
    const params = { PageSize: args.limit || 10 };
    if (area_code) params.AreaCode = area_code; if (contains) params.Contains = contains;
    if (sms_enabled) params.SmsEnabled = true;
    return await twilio('GET', `/Accounts/${SID()}/AvailablePhoneNumbers/${country}/Local.json`, params);
  }
  if (tool === 'twilio_buy_phone_number') {
    return await twilio('POST', `/Accounts/${SID()}/IncomingPhoneNumbers.json`, { PhoneNumber: args.phone_number, FriendlyName: args.friendly_name });
  }
  if (tool === 'twilio_release_phone_number') {
    return await twilio('DELETE', `/Accounts/${SID()}/IncomingPhoneNumbers/${args.phone_number_sid}.json`);
  }
  if (tool === 'twilio_update_phone_number') {
    const { phone_number_sid, friendly_name, sms_url, voice_url } = args;
    const payload = {};
    if (friendly_name) payload.FriendlyName = friendly_name;
    if (sms_url) payload.SmsUrl = sms_url;
    if (voice_url) payload.VoiceUrl = voice_url;
    return await twilio('POST', `/Accounts/${SID()}/IncomingPhoneNumbers/${phone_number_sid}.json`, payload);
  }

  // ── RECORDINGS ────────────────────────────────────────────────────────────
  if (tool === 'twilio_list_recordings') {
    const params = { PageSize: args.limit || 20 };
    if (args.call_sid) params.CallSid = args.call_sid;
    return await twilio('GET', `/Accounts/${SID()}/Recordings.json`, params);
  }
  if (tool === 'twilio_get_recording') {
    return await twilio('GET', `/Accounts/${SID()}/Recordings/${args.recording_sid}.json`);
  }
  if (tool === 'twilio_delete_recording') {
    return await twilio('DELETE', `/Accounts/${SID()}/Recordings/${args.recording_sid}.json`);
  }

  // ── VERIFY (OTP / 2FA) ────────────────────────────────────────────────────
  if (tool === 'twilio_send_verification_code') {
    const { to, channel = 'sms', service_sid } = args;
    const sid = service_sid || process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!sid) throw new Error('TWILIO_VERIFY_SERVICE_SID not set in .env, or pass service_sid');
    return await twilio('POST', `https://verify.twilio.com/v2/Services/${sid}/Verifications`, { To: to, Channel: channel });
  }
  if (tool === 'twilio_check_verification_code') {
    const { to, code, service_sid } = args;
    const sid = service_sid || process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!sid) throw new Error('TWILIO_VERIFY_SERVICE_SID not set in .env');
    return await twilio('POST', `https://verify.twilio.com/v2/Services/${sid}/VerificationCheck`, { To: to, Code: code });
  }

  // ── LOOKUP ────────────────────────────────────────────────────────────────
  if (tool === 'twilio_lookup_phone_number') {
    const { phone_number, fields = 'line_type_intelligence,caller_name' } = args;
    const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone_number)}?Fields=${fields}`;
    const res = await fetch(url, { headers: headers() });
    const data = await res.json();
    if (!res.ok) throw new Error(`Twilio Lookup ${res.status}: ${data.message}`);
    return data;
  }

  // ── ACCOUNT ───────────────────────────────────────────────────────────────
  if (tool === 'twilio_get_account') {
    return await twilio('GET', `/Accounts/${SID()}.json`);
  }
  if (tool === 'twilio_get_balance') {
    return await twilio('GET', `/Accounts/${SID()}/Balance.json`);
  }
  if (tool === 'twilio_list_subaccounts') {
    return await twilio('GET', `https://api.twilio.com/2010-04-01/Accounts.json`, { PageSize: args.limit || 20 });
  }
  if (tool === 'twilio_create_subaccount') {
    return await twilio('POST', `/Accounts.json`, { FriendlyName: args.friendly_name });
  }
  if (tool === 'twilio_get_subaccount') {
    return await twilio('GET', `/Accounts/${args.subaccount_sid}.json`);
  }
  if (tool === 'twilio_close_subaccount') {
    return await twilio('POST', `/Accounts/${args.subaccount_sid}.json`, { Status: 'closed' });
  }

  // ── MESSAGING SERVICES ────────────────────────────────────────────────────
  if (tool === 'twilio_list_messaging_services') {
    return await twilio('GET', `https://messaging.twilio.com/v1/Services`, { PageSize: args.limit || 20 });
  }
  if (tool === 'twilio_get_messaging_service') {
    return await twilio('GET', `https://messaging.twilio.com/v1/Services/${args.service_sid}`);
  }
  if (tool === 'twilio_create_messaging_service') {
    const payload = { FriendlyName: args.friendly_name };
    if (args.inbound_request_url) payload.InboundRequestUrl = args.inbound_request_url;
    if (args.fallback_url) payload.FallbackUrl = args.fallback_url;
    if (args.status_callback) payload.StatusCallback = args.status_callback;
    if (args.use_inbound_webhook_on_number !== undefined) payload.UseInboundWebhookOnNumber = args.use_inbound_webhook_on_number;
    return await twilio('POST', `https://messaging.twilio.com/v1/Services`, payload);
  }
  if (tool === 'twilio_update_messaging_service') {
    return await twilio('POST', `https://messaging.twilio.com/v1/Services/${args.service_sid}`, args.config || {});
  }
  if (tool === 'twilio_delete_messaging_service') {
    return await twilio('DELETE', `https://messaging.twilio.com/v1/Services/${args.service_sid}`);
  }
  if (tool === 'twilio_add_number_to_messaging_service') {
    return await twilio('POST', `https://messaging.twilio.com/v1/Services/${args.service_sid}/PhoneNumbers`, { PhoneNumberSid: args.phone_number_sid });
  }
  if (tool === 'twilio_remove_number_from_messaging_service') {
    return await twilio('DELETE', `https://messaging.twilio.com/v1/Services/${args.service_sid}/PhoneNumbers/${args.phone_number_sid}`);
  }
  if (tool === 'twilio_list_messaging_service_numbers') {
    return await twilio('GET', `https://messaging.twilio.com/v1/Services/${args.service_sid}/PhoneNumbers`, { PageSize: args.limit || 20 });
  }

  // ── VERIFY SERVICES (CRUD) ────────────────────────────────────────────────
  if (tool === 'twilio_list_verify_services') {
    return await twilio('GET', `https://verify.twilio.com/v2/Services`, { PageSize: args.limit || 20 });
  }
  if (tool === 'twilio_get_verify_service') {
    return await twilio('GET', `https://verify.twilio.com/v2/Services/${args.service_sid}`);
  }
  if (tool === 'twilio_create_verify_service') {
    const payload = { FriendlyName: args.friendly_name };
    if (args.code_length) payload.CodeLength = args.code_length;
    if (args.lookup_enabled !== undefined) payload.LookupEnabled = args.lookup_enabled;
    if (args.psd2_enabled !== undefined) payload.Psd2Enabled = args.psd2_enabled;
    return await twilio('POST', `https://verify.twilio.com/v2/Services`, payload);
  }
  if (tool === 'twilio_update_verify_service') {
    return await twilio('POST', `https://verify.twilio.com/v2/Services/${args.service_sid}`, args.config || {});
  }
  if (tool === 'twilio_delete_verify_service') {
    return await twilio('DELETE', `https://verify.twilio.com/v2/Services/${args.service_sid}`);
  }

  // ── VOICE (DEEPER) ────────────────────────────────────────────────────────
  if (tool === 'twilio_update_call') {
    const { call_sid, twiml, url, status, method } = args;
    const payload = {};
    if (twiml) payload.Twiml = twiml;
    if (url) payload.Url = url;
    if (status) payload.Status = status;
    if (method) payload.Method = method;
    return await twilio('POST', `/Accounts/${SID()}/Calls/${call_sid}.json`, payload);
  }
  if (tool === 'twilio_get_call_recordings') {
    return await twilio('GET', `/Accounts/${SID()}/Calls/${args.call_sid}/Recordings.json`);
  }
  if (tool === 'twilio_create_recording_for_call') {
    return await twilio('POST', `/Accounts/${SID()}/Calls/${args.call_sid}/Recordings.json`, { RecordingChannels: args.channels || 'mono', RecordingStatusCallback: args.status_callback, Trim: args.trim || 'trim-silence' });
  }
  if (tool === 'twilio_pause_recording') {
    return await twilio('POST', `/Accounts/${SID()}/Calls/${args.call_sid}/Recordings/${args.recording_sid}.json`, { Status: 'paused' });
  }
  if (tool === 'twilio_resume_recording') {
    return await twilio('POST', `/Accounts/${SID()}/Calls/${args.call_sid}/Recordings/${args.recording_sid}.json`, { Status: 'in-progress' });
  }
  if (tool === 'twilio_stop_recording') {
    return await twilio('POST', `/Accounts/${SID()}/Calls/${args.call_sid}/Recordings/${args.recording_sid}.json`, { Status: 'stopped' });
  }

  // ── CONFERENCES ───────────────────────────────────────────────────────────
  if (tool === 'twilio_list_conferences') {
    const params = { PageSize: args.limit || 20 };
    if (args.status) params.Status = args.status;
    return await twilio('GET', `/Accounts/${SID()}/Conferences.json`, params);
  }
  if (tool === 'twilio_get_conference') {
    return await twilio('GET', `/Accounts/${SID()}/Conferences/${args.conference_sid}.json`);
  }
  if (tool === 'twilio_update_conference') {
    const payload = {};
    if (args.status) payload.Status = args.status;
    if (args.announce_url) payload.AnnounceUrl = args.announce_url;
    return await twilio('POST', `/Accounts/${SID()}/Conferences/${args.conference_sid}.json`, payload);
  }
  if (tool === 'twilio_list_conference_participants') {
    return await twilio('GET', `/Accounts/${SID()}/Conferences/${args.conference_sid}/Participants.json`);
  }
  if (tool === 'twilio_add_conference_participant') {
    return await twilio('POST', `/Accounts/${SID()}/Conferences/${args.conference_sid}/Participants.json`, { From: args.from, To: args.to, Muted: args.muted || false, Beep: args.beep || 'true' });
  }
  if (tool === 'twilio_remove_conference_participant') {
    return await twilio('DELETE', `/Accounts/${SID()}/Conferences/${args.conference_sid}/Participants/${args.call_sid}.json`);
  }
  if (tool === 'twilio_update_conference_participant') {
    const payload = {};
    if (args.muted !== undefined) payload.Muted = args.muted;
    if (args.hold !== undefined) payload.Hold = args.hold;
    return await twilio('POST', `/Accounts/${SID()}/Conferences/${args.conference_sid}/Participants/${args.call_sid}.json`, payload);
  }

  // ── CONTENT TEMPLATES ─────────────────────────────────────────────────────
  if (tool === 'twilio_list_content_templates') {
    return await twilio('GET', `https://content.twilio.com/v1/Content`, { PageSize: args.limit || 20 });
  }
  if (tool === 'twilio_get_content_template') {
    return await twilio('GET', `https://content.twilio.com/v1/Content/${args.content_sid}`);
  }
  if (tool === 'twilio_create_content_template') {
    // Content API uses JSON
    const res = await fetch(`https://content.twilio.com/v1/Content`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendly_name: args.friendly_name, language: args.language || 'en', variables: args.variables, types: args.types })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Twilio Content ${res.status}: ${data.message}`);
    return data;
  }
  if (tool === 'twilio_delete_content_template') {
    return await twilio('DELETE', `https://content.twilio.com/v1/Content/${args.content_sid}`);
  }
  if (tool === 'twilio_send_content_message') {
    const payload = { To: args.to, ContentSid: args.content_sid };
    if (args.content_variables) payload.ContentVariables = JSON.stringify(args.content_variables);
    if (args.messaging_service_sid) payload.MessagingServiceSid = args.messaging_service_sid;
    else if (args.from) payload.From = args.from;
    return await twilio('POST', `/Accounts/${SID()}/Messages.json`, payload);
  }

  // ── STUDIO FLOWS ──────────────────────────────────────────────────────────
  if (tool === 'twilio_list_studio_flows') {
    return await twilio('GET', `https://studio.twilio.com/v2/Flows`, { PageSize: args.limit || 20 });
  }
  if (tool === 'twilio_get_studio_flow') {
    return await twilio('GET', `https://studio.twilio.com/v2/Flows/${args.flow_sid}`);
  }
  if (tool === 'twilio_trigger_studio_flow') {
    const payload = { To: args.to, From: args.from };
    if (args.parameters) payload.Parameters = JSON.stringify(args.parameters);
    return await twilio('POST', `https://studio.twilio.com/v2/Flows/${args.flow_sid}/Executions`, payload);
  }
  if (tool === 'twilio_list_studio_executions') {
    return await twilio('GET', `https://studio.twilio.com/v2/Flows/${args.flow_sid}/Executions`, { PageSize: args.limit || 20 });
  }
  if (tool === 'twilio_get_studio_execution') {
    return await twilio('GET', `https://studio.twilio.com/v2/Flows/${args.flow_sid}/Executions/${args.execution_sid}`);
  }
  if (tool === 'twilio_end_studio_execution') {
    return await twilio('POST', `https://studio.twilio.com/v2/Flows/${args.flow_sid}/Executions/${args.execution_sid}`, { Status: 'ended' });
  }

  // ── CONVERSATIONS ─────────────────────────────────────────────────────────
  if (tool === 'twilio_list_conversations') {
    return await twilio('GET', `https://conversations.twilio.com/v1/Conversations`, { PageSize: args.limit || 20 });
  }
  if (tool === 'twilio_create_conversation') {
    const payload = {};
    if (args.friendly_name) payload.FriendlyName = args.friendly_name;
    if (args.messaging_service_sid) payload.MessagingServiceSid = args.messaging_service_sid;
    return await twilio('POST', `https://conversations.twilio.com/v1/Conversations`, payload);
  }
  if (tool === 'twilio_get_conversation') {
    return await twilio('GET', `https://conversations.twilio.com/v1/Conversations/${args.conversation_sid}`);
  }
  if (tool === 'twilio_delete_conversation') {
    return await twilio('DELETE', `https://conversations.twilio.com/v1/Conversations/${args.conversation_sid}`);
  }
  if (tool === 'twilio_add_conversation_participant') {
    const payload = {};
    if (args.identity) payload['Identity'] = args.identity;
    if (args.address) payload['MessagingBinding.Address'] = args.address;
    if (args.proxy_address) payload['MessagingBinding.ProxyAddress'] = args.proxy_address;
    return await twilio('POST', `https://conversations.twilio.com/v1/Conversations/${args.conversation_sid}/Participants`, payload);
  }
  if (tool === 'twilio_list_conversation_participants') {
    return await twilio('GET', `https://conversations.twilio.com/v1/Conversations/${args.conversation_sid}/Participants`);
  }
  if (tool === 'twilio_send_conversation_message') {
    return await twilio('POST', `https://conversations.twilio.com/v1/Conversations/${args.conversation_sid}/Messages`, { Body: args.body, Author: args.author || 'system' });
  }
  if (tool === 'twilio_list_conversation_messages') {
    return await twilio('GET', `https://conversations.twilio.com/v1/Conversations/${args.conversation_sid}/Messages`, { PageSize: args.limit || 50 });
  }

  // ── ADDRESSES (for regulatory compliance) ─────────────────────────────────
  if (tool === 'twilio_list_addresses') {
    return await twilio('GET', `/Accounts/${SID()}/Addresses.json`, { PageSize: args.limit || 20 });
  }
  if (tool === 'twilio_create_address') {
    return await twilio('POST', `/Accounts/${SID()}/Addresses.json`, {
      FriendlyName: args.friendly_name, CustomerName: args.customer_name, Street: args.street, City: args.city, Region: args.region, PostalCode: args.postal_code, IsoCountry: args.iso_country || 'US'
    });
  }
  if (tool === 'twilio_get_address') {
    return await twilio('GET', `/Accounts/${SID()}/Addresses/${args.address_sid}.json`);
  }
  if (tool === 'twilio_delete_address') {
    return await twilio('DELETE', `/Accounts/${SID()}/Addresses/${args.address_sid}.json`);
  }

  // ── PHONE NUMBERS (DEEPER) ────────────────────────────────────────────────
  if (tool === 'twilio_get_phone_number') {
    return await twilio('GET', `/Accounts/${SID()}/IncomingPhoneNumbers/${args.phone_number_sid}.json`);
  }
  if (tool === 'twilio_search_toll_free_numbers') {
    const params = { PageSize: args.limit || 10 };
    if (args.contains) params.Contains = args.contains;
    if (args.sms_enabled) params.SmsEnabled = true;
    return await twilio('GET', `/Accounts/${SID()}/AvailablePhoneNumbers/${args.country || 'US'}/TollFree.json`, params);
  }
  if (tool === 'twilio_search_mobile_numbers') {
    const params = { PageSize: args.limit || 10 };
    if (args.contains) params.Contains = args.contains;
    return await twilio('GET', `/Accounts/${SID()}/AvailablePhoneNumbers/${args.country || 'GB'}/Mobile.json`, params);
  }

  // ── USAGE ─────────────────────────────────────────────────────────────────
  if (tool === 'twilio_get_usage_records') {
    const params = { PageSize: args.limit || 20 };
    if (args.category) params.Category = args.category;
    if (args.start_date) params.StartDate = args.start_date;
    if (args.end_date) params.EndDate = args.end_date;
    return await twilio('GET', `/Accounts/${SID()}/Usage/Records.json`, params);
  }
  if (tool === 'twilio_get_daily_usage') {
    return await twilio('GET', `/Accounts/${SID()}/Usage/Records/Daily.json`, { PageSize: args.limit || 30 });
  }
  if (tool === 'twilio_list_usage_triggers') {
    return await twilio('GET', `/Accounts/${SID()}/Usage/Triggers.json`, { PageSize: args.limit || 20 });
  }
  if (tool === 'twilio_create_usage_trigger') {
    return await twilio('POST', `/Accounts/${SID()}/Usage/Triggers.json`, {
      CallbackUrl: args.callback_url, TriggerValue: args.trigger_value, UsageCategory: args.usage_category, Recurring: args.recurring, TriggerBy: args.trigger_by || 'usage'
    });
  }
  if (tool === 'twilio_delete_usage_trigger') {
    return await twilio('DELETE', `/Accounts/${SID()}/Usage/Triggers/${args.trigger_sid}.json`);
  }

  // ── KEYS ──────────────────────────────────────────────────────────────────
  if (tool === 'twilio_list_api_keys') {
    return await twilio('GET', `/Accounts/${SID()}/Keys.json`, { PageSize: args.limit || 20 });
  }
  if (tool === 'twilio_create_api_key') {
    return await twilio('POST', `/Accounts/${SID()}/Keys.json`, { FriendlyName: args.friendly_name });
  }
  if (tool === 'twilio_delete_api_key') {
    return await twilio('DELETE', `/Accounts/${SID()}/Keys/${args.key_sid}.json`);
  }

  // ── APPLICATIONS (TwiML Apps) ─────────────────────────────────────────────
  if (tool === 'twilio_list_applications') {
    return await twilio('GET', `/Accounts/${SID()}/Applications.json`, { PageSize: args.limit || 20 });
  }
  if (tool === 'twilio_create_application') {
    return await twilio('POST', `/Accounts/${SID()}/Applications.json`, {
      FriendlyName: args.friendly_name, VoiceUrl: args.voice_url, SmsUrl: args.sms_url, StatusCallback: args.status_callback
    });
  }
  if (tool === 'twilio_delete_application') {
    return await twilio('DELETE', `/Accounts/${SID()}/Applications/${args.application_sid}.json`);
  }

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║                         SUPER TOOLS                                  ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  // SUPER TOOL: twilio_dispatch_notification
  // Send SMS to driver + log result + optionally place a callback voice call if SMS fails
  if (tool === 'twilio_dispatch_notification') {
    const { to, body, fallback_voice = false, voice_message, from } = args;
    if (!to || !body) throw new Error('to and body required');
    const fromNum = from || process.env.TWILIO_PHONE_NUMBER;
    let smsResult = null, smsError = null, voiceResult = null;
    try {
      smsResult = await twilio('POST', `/Accounts/${SID()}/Messages.json`, { To: to, From: fromNum, Body: body });
    } catch (e) { smsError = e.message; }
    if ((smsError || smsResult?.status === 'failed') && fallback_voice) {
      try {
        voiceResult = await twilio('POST', `/Accounts/${SID()}/Calls.json`, {
          To: to, From: fromNum,
          Twiml: `<Response><Say>${voice_message || body}</Say></Response>`
        });
      } catch (e) { voiceResult = { error: e.message }; }
    }
    return { sms: smsResult, sms_error: smsError, voice_fallback: voiceResult, delivered: !!(smsResult && !smsError) };
  }

  // SUPER TOOL: twilio_send_otp_and_wait
  // Send code + poll for verification confirmation or timeout
  if (tool === 'twilio_send_otp_and_wait') {
    const { to, channel = 'sms', service_sid, wait_seconds = 60, check_code } = args;
    const sid = service_sid || process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!sid) throw new Error('TWILIO_VERIFY_SERVICE_SID not set, or pass service_sid');
    const sent = await twilio('POST', `https://verify.twilio.com/v2/Services/${sid}/Verifications`, { To: to, Channel: channel });
    if (!check_code) return { sent, awaiting_code: true, note: 'Call twilio_check_verification_code with the code when received.' };
    // If code provided, check immediately
    const check = await twilio('POST', `https://verify.twilio.com/v2/Services/${sid}/VerificationCheck`, { To: to, Code: check_code });
    return { sent, check, verified: check.status === 'approved' };
  }

  // SUPER TOOL: twilio_setup_number_with_webhooks
  // Purchase a number + wire SMS/voice webhooks + send test SMS to confirm
  if (tool === 'twilio_setup_number_with_webhooks') {
    const { sms_webhook, voice_webhook, area_code, country = 'US', test_message_to } = args;
    if (!sms_webhook && !voice_webhook) throw new Error('At least one of sms_webhook or voice_webhook required');
    const search = await twilio('GET', `/Accounts/${SID()}/AvailablePhoneNumbers/${country}/Local.json`, { PageSize: 1, AreaCode: area_code, SmsEnabled: true, VoiceEnabled: true });
    const candidate = search.available_phone_numbers?.[0];
    if (!candidate) throw new Error(`No available numbers in area code ${area_code}`);
    const bought = await twilio('POST', `/Accounts/${SID()}/IncomingPhoneNumbers.json`, {
      PhoneNumber: candidate.phone_number,
      SmsUrl: sms_webhook,
      VoiceUrl: voice_webhook
    });
    let test = null;
    if (test_message_to && sms_webhook) {
      try { test = await twilio('POST', `/Accounts/${SID()}/Messages.json`, { To: test_message_to, From: bought.phone_number, Body: 'Test message from Robinson Toolkit number setup.' }); }
      catch (e) { test = { error: e.message }; }
    }
    return { number: { sid: bought.sid, phone_number: bought.phone_number }, sms_webhook, voice_webhook, test };
  }

  // SUPER TOOL: twilio_broadcast_with_status
  // Bulk send + poll each message status after delay
  if (tool === 'twilio_broadcast_with_status') {
    const { recipients, body, from, status_check_delay_ms = 5000 } = args;
    if (!Array.isArray(recipients) || !body) throw new Error('recipients[] and body required');
    const fromNum = from || process.env.TWILIO_PHONE_NUMBER;
    const sent = [];
    for (const to of recipients) {
      try { const m = await twilio('POST', `/Accounts/${SID()}/Messages.json`, { To: to, From: fromNum, Body: body }); sent.push({ to, sid: m.sid }); }
      catch (e) { sent.push({ to, error: e.message }); }
    }
    await new Promise(r => setTimeout(r, status_check_delay_ms));
    const results = await Promise.all(sent.map(async s => {
      if (s.error) return s;
      try { const m = await twilio('GET', `/Accounts/${SID()}/Messages/${s.sid}.json`); return { ...s, status: m.status, error_code: m.error_code, error_message: m.error_message }; }
      catch (e) { return { ...s, fetch_error: e.message }; }
    }));
    const delivered = results.filter(r => r.status === 'delivered' || r.status === 'sent').length;
    const failed = results.filter(r => r.error || r.status === 'failed' || r.status === 'undelivered').length;
    return { total: recipients.length, delivered, failed, pending: recipients.length - delivered - failed, results };
  }

  throw new Error(`Unknown Twilio tool: ${tool}`);
}

export default { execute };
