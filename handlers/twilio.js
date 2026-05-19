/**
 * Twilio Handler — 28 tools
 * SMS, voice calls, WhatsApp, phone number management, Verify OTP,
 * and Lookup. Critical for YardSync driver dispatch notifications.
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

  throw new Error(`Unknown Twilio tool: ${tool}`);
}

export default { execute };
