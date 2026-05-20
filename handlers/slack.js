/**
 * Slack Handler — 44 tools
 * Messaging, channels, users, files, reactions, workflows,
 * and Super Tools for team communication.
 *
 * Uses Slack Web API (https://slack.com/api/)
 *
 * Requires: SLACK_BOT_TOKEN — Bot token (xoxb-...) from Slack app settings
 * Optional: SLACK_DEFAULT_CHANNEL — Default channel ID or name for quick sends
 */

const BASE = 'https://slack.com/api';

function token() {
  const t = process.env.SLACK_BOT_TOKEN;
  if (!t) throw new Error('SLACK_BOT_TOKEN not set in .env (xoxb-... from Slack app → OAuth & Permissions)');
  return t;
}

async function slack(method, params = {}, postBody = null) {
  const url = `${BASE}/${method}`;
  let res;
  if (postBody) {
    // POST with JSON body (for complex payloads)
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(postBody)
    });
  } else if (Object.keys(params).length) {
    // POST with form params (Slack convention for most methods)
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]))).toString()
    });
  } else {
    res = await fetch(url, { headers: { 'Authorization': `Bearer ${token()}` } });
  }
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack API ${method}: ${data.error || JSON.stringify(data)}`);
  return data;
}

function defaultChannel() {
  const c = process.env.SLACK_DEFAULT_CHANNEL;
  if (!c) throw new Error('No channel provided and SLACK_DEFAULT_CHANNEL not set in .env');
  return c;
}

async function execute(tool, args) {

  // ── MESSAGES ──────────────────────────────────────────────────────────────
  if (tool === 'slack_send_message') {
    const { channel, text, thread_ts, blocks, unfurl_links = false, unfurl_media = false } = args;
    const ch = channel || defaultChannel();
    if (!text && !blocks) throw new Error('text or blocks is required');
    const params = { channel: ch, unfurl_links, unfurl_media };
    if (text) params.text = text;
    if (thread_ts) params.thread_ts = thread_ts;
    const data = blocks
      ? await slack('chat.postMessage', {}, { channel: ch, text: text || '', blocks, unfurl_links, unfurl_media, ...(thread_ts ? { thread_ts } : {}) })
      : await slack('chat.postMessage', params);
    return { ts: data.ts, channel: data.channel, message: data.message?.text };
  }

  if (tool === 'slack_send_dm') {
    const { user_id, text, blocks } = args;
    if (!user_id) throw new Error('user_id is required');
    if (!text && !blocks) throw new Error('text or blocks is required');
    // Open DM channel
    const im = await slack('conversations.open', { users: user_id });
    const channelId = im.channel.id;
    const params = { channel: channelId };
    if (text) params.text = text;
    const data = blocks
      ? await slack('chat.postMessage', {}, { channel: channelId, text: text || '', blocks })
      : await slack('chat.postMessage', params);
    return { ts: data.ts, channel: data.channel };
  }

  if (tool === 'slack_update_message') {
    const { channel, ts, text, blocks } = args;
    if (!channel || !ts) throw new Error('channel and ts are required');
    const params = { channel, ts };
    if (text) params.text = text;
    const data = blocks
      ? await slack('chat.update', {}, { channel, ts, text: text || '', blocks })
      : await slack('chat.update', params);
    return { ts: data.ts, channel: data.channel };
  }

  if (tool === 'slack_delete_message') {
    const { channel, ts } = args;
    if (!channel || !ts) throw new Error('channel and ts (message timestamp) are required');
    return await slack('chat.delete', { channel, ts });
  }

  if (tool === 'slack_get_message') {
    const { channel, ts } = args;
    if (!channel || !ts) throw new Error('channel and ts are required');
    const data = await slack('conversations.history', { channel, latest: ts, inclusive: true, limit: 1 });
    return data.messages?.[0] || null;
  }

  if (tool === 'slack_get_thread') {
    const { channel, thread_ts, limit = 50 } = args;
    if (!channel || !thread_ts) throw new Error('channel and thread_ts are required');
    const data = await slack('conversations.replies', { channel, ts: thread_ts, limit });
    return { messages: data.messages, count: data.messages?.length };
  }

  if (tool === 'slack_reply_to_thread') {
    const { channel, thread_ts, text, blocks } = args;
    if (!channel || !thread_ts) throw new Error('channel and thread_ts are required');
    return await execute('slack_send_message', { channel, text, blocks, thread_ts });
  }

  if (tool === 'slack_get_permalink') {
    const { channel, ts } = args;
    if (!channel || !ts) throw new Error('channel and ts are required');
    const data = await slack('chat.getPermalink', { channel, message_ts: ts });
    return { permalink: data.permalink };
  }

  // ── CHANNELS ──────────────────────────────────────────────────────────────
  if (tool === 'slack_list_channels') {
    const { exclude_archived = true, types = 'public_channel,private_channel', limit = 200, name_filter } = args;
    const data = await slack('conversations.list', { exclude_archived, types, limit });
    const channels = data.channels || [];
    return (name_filter ? channels.filter(c => c.name.includes(name_filter)) : channels)
      .map(c => ({ id: c.id, name: c.name, is_private: c.is_private, member_count: c.num_members, topic: c.topic?.value, purpose: c.purpose?.value }));
  }

  if (tool === 'slack_get_channel') {
    const { channel } = args;
    if (!channel) throw new Error('channel (ID or name) is required');
    const data = await slack('conversations.info', { channel });
    return data.channel;
  }

  if (tool === 'slack_create_channel') {
    const { name, is_private = false } = args;
    if (!name) throw new Error('name is required');
    const data = await slack('conversations.create', { name: name.toLowerCase().replace(/\s+/g, '-'), is_private });
    return { id: data.channel.id, name: data.channel.name, is_private: data.channel.is_private };
  }

  if (tool === 'slack_archive_channel') {
    if (!args.channel) throw new Error('channel is required');
    return await slack('conversations.archive', { channel: args.channel });
  }

  if (tool === 'slack_invite_to_channel') {
    const { channel, user_ids } = args;
    if (!channel || !user_ids?.length) throw new Error('channel and user_ids are required');
    const data = await slack('conversations.invite', { channel, users: user_ids.join(',') });
    return { channel: data.channel.id, added: user_ids.length };
  }

  if (tool === 'slack_join_channel') {
    if (!args.channel) throw new Error('channel is required');
    const data = await slack('conversations.join', { channel: args.channel });
    return { channel: data.channel.id, name: data.channel.name };
  }

  if (tool === 'slack_leave_channel') {
    if (!args.channel) throw new Error('channel is required');
    return await slack('conversations.leave', { channel: args.channel });
  }

  if (tool === 'slack_get_channel_history') {
    const { channel, limit = 25, oldest, latest } = args;
    if (!channel) throw new Error('channel is required');
    const params = { channel, limit };
    if (oldest) params.oldest = oldest;
    if (latest) params.latest = latest;
    const data = await slack('conversations.history', params);
    return { messages: (data.messages || []).map(m => ({ ts: m.ts, text: m.text, user: m.user, bot_id: m.bot_id, thread_ts: m.thread_ts, reply_count: m.reply_count })), has_more: data.has_more };
  }

  if (tool === 'slack_set_channel_topic') {
    const { channel, topic } = args;
    if (!channel || !topic) throw new Error('channel and topic are required');
    return await slack('conversations.setTopic', { channel, topic });
  }

  if (tool === 'slack_set_channel_purpose') {
    const { channel, purpose } = args;
    if (!channel || !purpose) throw new Error('channel and purpose are required');
    return await slack('conversations.setPurpose', { channel, purpose });
  }

  // ── USERS ─────────────────────────────────────────────────────────────────
  if (tool === 'slack_list_users') {
    const { limit = 200 } = args;
    const data = await slack('users.list', { limit });
    return (data.members || [])
      .filter(u => !u.deleted && !u.is_bot)
      .map(u => ({ id: u.id, name: u.name, real_name: u.real_name, email: u.profile?.email, display_name: u.profile?.display_name, is_admin: u.is_admin }));
  }

  if (tool === 'slack_get_user') {
    const { user_id } = args;
    if (!user_id) throw new Error('user_id is required');
    const data = await slack('users.info', { user: user_id });
    return { id: data.user.id, name: data.user.name, real_name: data.user.real_name, email: data.user.profile?.email, display_name: data.user.profile?.display_name, is_admin: data.user.is_admin, timezone: data.user.tz };
  }

  if (tool === 'slack_lookup_user_by_email') {
    const { email } = args;
    if (!email) throw new Error('email is required');
    const data = await slack('users.lookupByEmail', { email });
    return { id: data.user.id, name: data.user.name, real_name: data.user.real_name };
  }

  if (tool === 'slack_get_user_presence') {
    const { user_id } = args;
    if (!user_id) throw new Error('user_id is required');
    const data = await slack('users.getPresence', { user: user_id });
    return { presence: data.presence, online: data.online, auto_away: data.auto_away };
  }

  // ── REACTIONS ─────────────────────────────────────────────────────────────
  if (tool === 'slack_add_reaction') {
    const { channel, ts, emoji } = args;
    if (!channel || !ts || !emoji) throw new Error('channel, ts, and emoji are required');
    return await slack('reactions.add', { channel, timestamp: ts, name: emoji.replace(/:/g, '') });
  }

  if (tool === 'slack_remove_reaction') {
    const { channel, ts, emoji } = args;
    if (!channel || !ts || !emoji) throw new Error('channel, ts, and emoji are required');
    return await slack('reactions.remove', { channel, timestamp: ts, name: emoji.replace(/:/g, '') });
  }

  if (tool === 'slack_get_reactions') {
    const { channel, ts } = args;
    if (!channel || !ts) throw new Error('channel and ts are required');
    const data = await slack('reactions.get', { channel, timestamp: ts });
    return data.message?.reactions || [];
  }

  // ── FILES ─────────────────────────────────────────────────────────────────
  if (tool === 'slack_list_files') {
    const { channel, user, types = 'all', count = 20 } = args;
    const params = { count, types };
    if (channel) params.channel = channel;
    if (user) params.user = user;
    const data = await slack('files.list', params);
    return (data.files || []).map(f => ({ id: f.id, name: f.name, title: f.title, filetype: f.filetype, size: f.size, created: f.created, url: f.permalink }));
  }

  if (tool === 'slack_delete_file') {
    if (!args.file_id) throw new Error('file_id is required');
    return await slack('files.delete', { file: args.file_id });
  }

  // ── SEARCH ────────────────────────────────────────────────────────────────
  if (tool === 'slack_search_messages') {
    const { query, count = 20, sort = 'timestamp', highlight = false } = args;
    if (!query) throw new Error('query is required');
    const data = await slack('search.messages', { query, count, sort, highlight });
    return {
      total: data.messages?.total,
      messages: (data.messages?.matches || []).map(m => ({
        text: m.text, channel: m.channel?.name, ts: m.ts,
        user: m.username, permalink: m.permalink
      }))
    };
  }

  if (tool === 'slack_search_files') {
    const { query, count = 20 } = args;
    if (!query) throw new Error('query is required');
    const data = await slack('search.files', { query, count });
    return { total: data.files?.total, files: data.files?.matches?.map(f => ({ name: f.name, url: f.permalink, filetype: f.filetype })) };
  }

  // ── REMINDERS ─────────────────────────────────────────────────────────────
  if (tool === 'slack_add_reminder') {
    const { text, time, user } = args;
    if (!text || !time) throw new Error('text and time are required');
    // time can be timestamp or English string like "in 10 minutes"
    const data = await slack('reminders.add', { text, time, ...(user ? { user } : {}) });
    return data.reminder;
  }

  if (tool === 'slack_list_reminders') {
    const data = await slack('reminders.list');
    return data.reminders || [];
  }

  // ── WORKSPACE ─────────────────────────────────────────────────────────────
  if (tool === 'slack_get_workspace_info') {
    const data = await slack('team.info');
    return { id: data.team?.id, name: data.team?.name, domain: data.team?.domain, icon: data.team?.icon?.image_132 };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SUPER TOOLS
  // ══════════════════════════════════════════════════════════════════════════

  // SUPER: Notify a channel with a structured deployment/release announcement
  if (tool === 'slack_announce_deployment') {
    const { channel, app_name, version, environment = 'production', deployed_by, changes, status = 'success', url } = args;
    if (!app_name || !version) throw new Error('app_name and version are required');
    const ch = channel || defaultChannel();
    const emoji = status === 'success' ? '🚀' : status === 'failed' ? '🚨' : '⚠️';
    const color = status === 'success' ? '#36a64f' : status === 'failed' ? '#ff0000' : '#ffa500';
    const blocks = [
      { type: 'header', text: { type: 'plain_text', text: `${emoji} ${app_name} ${version} deployed to ${environment}` } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*Status:* ${status}` },
        { type: 'mrkdwn', text: `*Environment:* ${environment}` },
        ...(deployed_by ? [{ type: 'mrkdwn', text: `*Deployed by:* ${deployed_by}` }] : []),
        ...(url ? [{ type: 'mrkdwn', text: `*URL:* <${url}|${url}>` }] : [])
      ]},
      ...(changes ? [{ type: 'section', text: { type: 'mrkdwn', text: `*Changes:*\n${changes}` } }] : [])
    ];
    const data = await slack('chat.postMessage', {}, { channel: ch, text: `${emoji} ${app_name} ${version} → ${environment}`, blocks });
    return { ts: data.ts, channel: data.channel };
  }

  // SUPER: Broadcast a message to multiple channels at once
  if (tool === 'slack_broadcast') {
    const { channels, text, blocks } = args;
    if (!channels?.length || (!text && !blocks)) throw new Error('channels array and text or blocks are required');
    const results = await Promise.allSettled(
      channels.map(ch => execute('slack_send_message', { channel: ch, text, blocks }))
    );
    return {
      sent: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
      results: results.map((r, i) => ({ channel: channels[i], success: r.status === 'fulfilled', ts: r.value?.ts, error: r.reason?.message }))
    };
  }

  // SUPER: Send a structured alert with severity level and action button
  if (tool === 'slack_send_alert') {
    const { channel, title, message, severity = 'warning', action_url, action_text } = args;
    if (!title || !message) throw new Error('title and message are required');
    const ch = channel || defaultChannel();
    const icons = { critical: '🔴', error: '🔴', warning: '🟡', info: '🟢' };
    const icon = icons[severity] || '⚠️';
    const blocks = [
      { type: 'section', text: { type: 'mrkdwn', text: `${icon} *${title}*\n${message}` } },
      ...(action_url ? [{
        type: 'actions',
        elements: [{ type: 'button', text: { type: 'plain_text', text: action_text || 'View Details' }, url: action_url, style: severity === 'critical' || severity === 'error' ? 'danger' : 'primary' }]
      }] : [])
    ];
    const data = await slack('chat.postMessage', {}, { channel: ch, text: `${icon} ${title}: ${message}`, blocks });
    return { ts: data.ts, channel: data.channel };
  }

  // SUPER: Find a user by name or email and send them a DM
  if (tool === 'slack_dm_user_by_email') {
    const { email, text, blocks } = args;
    if (!email) throw new Error('email is required');
    const userData = await slack('users.lookupByEmail', { email });
    const userId = userData.user.id;
    return await execute('slack_send_dm', { user_id: userId, text, blocks });
  }

  // SUPER: Get recent activity summary for a channel
  if (tool === 'slack_channel_summary') {
    const { channel, message_count = 25 } = args;
    if (!channel) throw new Error('channel is required');
    const [info, history] = await Promise.all([
      slack('conversations.info', { channel }),
      slack('conversations.history', { channel, limit: message_count })
    ]);
    const messages = history.messages || [];
    const users = [...new Set(messages.map(m => m.user).filter(Boolean))];
    return {
      channel: { id: info.channel.id, name: info.channel.name, topic: info.channel.topic?.value, member_count: info.channel.num_members },
      recent_messages: message_count,
      unique_senders: users.length,
      has_threads: messages.filter(m => m.reply_count > 0).length,
      latest_message: messages[0]?.text?.slice(0, 200),
      checked_at: new Date().toISOString()
    };
  }

  throw new Error(`Unknown Slack tool: ${tool}`);
}

export default { execute };
