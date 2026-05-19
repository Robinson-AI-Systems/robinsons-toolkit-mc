/**
 * Clerk Handler — 30 tools (NEW)
 * Users, organizations, sessions, JWT templates, and multi-tenant
 * auth management. Essential for YardSync and Cortiware SaaS auth.
 */

const BASE = 'https://api.clerk.com/v1';

function headers() {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) throw new Error('CLERK_SECRET_KEY not set in .env');
  return { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function clerk(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: headers(),
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return { success: true };
  const data = await res.json();
  if (!res.ok) throw new Error(`Clerk ${res.status}: ${data.errors?.[0]?.long_message || data.errors?.[0]?.message || JSON.stringify(data)}`);
  return data;
}

async function execute(tool, args) {

  // ── USERS ─────────────────────────────────────────────────────────────────
  if (tool === 'clerk_list_users') {
    const { limit = 20, offset = 0, email_address, username, order_by = '-created_at' } = args;
    let path = `/users?limit=${limit}&offset=${offset}&order_by=${order_by}`;
    if (email_address) path += `&email_address=${encodeURIComponent(email_address)}`;
    if (username) path += `&username=${encodeURIComponent(username)}`;
    return await clerk('GET', path);
  }
  if (tool === 'clerk_get_user') { return await clerk('GET', `/users/${args.user_id}`); }
  if (tool === 'clerk_create_user') {
    const { email_address, password, first_name, last_name, username, public_metadata, private_metadata, skip_password_checks } = args;
    const body = { email_address: Array.isArray(email_address) ? email_address : [email_address] };
    if (password) body.password = password;
    if (first_name) body.first_name = first_name; if (last_name) body.last_name = last_name;
    if (username) body.username = username;
    if (public_metadata) body.public_metadata = public_metadata;
    if (private_metadata) body.private_metadata = private_metadata;
    if (skip_password_checks) body.skip_password_checks = skip_password_checks;
    return await clerk('POST', '/users', body);
  }
  if (tool === 'clerk_update_user') {
    const { user_id, first_name, last_name, username, public_metadata, private_metadata, unsafe_metadata } = args;
    const body = {};
    if (first_name !== undefined) body.first_name = first_name;
    if (last_name !== undefined) body.last_name = last_name;
    if (username !== undefined) body.username = username;
    if (public_metadata !== undefined) body.public_metadata = public_metadata;
    if (private_metadata !== undefined) body.private_metadata = private_metadata;
    if (unsafe_metadata !== undefined) body.unsafe_metadata = unsafe_metadata;
    return await clerk('PATCH', `/users/${user_id}`, body);
  }
  if (tool === 'clerk_delete_user') { return await clerk('DELETE', `/users/${args.user_id}`); }
  if (tool === 'clerk_ban_user') { return await clerk('POST', `/users/${args.user_id}/ban`, {}); }
  if (tool === 'clerk_unban_user') { return await clerk('POST', `/users/${args.user_id}/unban`, {}); }
  if (tool === 'clerk_get_user_count') { return await clerk('GET', '/users/count'); }
  if (tool === 'clerk_list_user_sessions') {
    return await clerk('GET', `/users/${args.user_id}/sessions?limit=${args.limit || 10}`);
  }
  if (tool === 'clerk_revoke_user_sessions') { return await clerk('POST', `/users/${args.user_id}/sessions/revoke`, {}); }
  if (tool === 'clerk_set_user_password') {
    return await clerk('PATCH', `/users/${args.user_id}`, { password: args.password, skip_password_checks: args.skip_checks || false });
  }
  if (tool === 'clerk_get_user_oauth_access_tokens') {
    return await clerk('GET', `/users/${args.user_id}/oauth_access_tokens/${args.provider}`);
  }

  // ── ORGANIZATIONS ─────────────────────────────────────────────────────────
  if (tool === 'clerk_list_organizations') {
    return await clerk('GET', `/organizations?limit=${args.limit || 20}&offset=${args.offset || 0}&include_members_count=${args.include_members_count || false}`);
  }
  if (tool === 'clerk_get_organization') { return await clerk('GET', `/organizations/${args.organization_id}`); }
  if (tool === 'clerk_create_organization') {
    const { name, created_by, public_metadata, private_metadata, max_allowed_memberships, slug } = args;
    if (!name) throw new Error('name is required');
    const body = { name };
    if (created_by) body.created_by = created_by;
    if (public_metadata) body.public_metadata = public_metadata;
    if (private_metadata) body.private_metadata = private_metadata;
    if (max_allowed_memberships) body.max_allowed_memberships = max_allowed_memberships;
    if (slug) body.slug = slug;
    return await clerk('POST', '/organizations', body);
  }
  if (tool === 'clerk_update_organization') {
    const { organization_id, name, public_metadata, private_metadata, max_allowed_memberships } = args;
    const body = {};
    if (name) body.name = name;
    if (public_metadata !== undefined) body.public_metadata = public_metadata;
    if (private_metadata !== undefined) body.private_metadata = private_metadata;
    if (max_allowed_memberships !== undefined) body.max_allowed_memberships = max_allowed_memberships;
    return await clerk('PATCH', `/organizations/${organization_id}`, body);
  }
  if (tool === 'clerk_delete_organization') { return await clerk('DELETE', `/organizations/${args.organization_id}`); }
  if (tool === 'clerk_list_organization_memberships') {
    return await clerk('GET', `/organizations/${args.organization_id}/memberships?limit=${args.limit || 20}&offset=${args.offset || 0}`);
  }
  if (tool === 'clerk_add_organization_member') {
    return await clerk('POST', `/organizations/${args.organization_id}/memberships`, { user_id: args.user_id, role: args.role || 'org:member' });
  }
  if (tool === 'clerk_update_organization_member_role') {
    return await clerk('PATCH', `/organizations/${args.organization_id}/memberships/${args.user_id}`, { role: args.role });
  }
  if (tool === 'clerk_remove_organization_member') {
    return await clerk('DELETE', `/organizations/${args.organization_id}/memberships/${args.user_id}`);
  }
  if (tool === 'clerk_list_organization_invitations') {
    return await clerk('GET', `/organizations/${args.organization_id}/invitations?limit=${args.limit || 20}&status=${args.status || 'pending'}`);
  }
  if (tool === 'clerk_create_organization_invitation') {
    return await clerk('POST', `/organizations/${args.organization_id}/invitations`, { email_address: args.email, role: args.role || 'org:member', public_metadata: args.public_metadata, redirect_url: args.redirect_url });
  }
  if (tool === 'clerk_revoke_organization_invitation') {
    return await clerk('POST', `/organizations/${args.organization_id}/invitations/${args.invitation_id}/revoke`, { requesting_user_id: args.requesting_user_id });
  }

  // ── SESSIONS ──────────────────────────────────────────────────────────────
  if (tool === 'clerk_list_sessions') {
    return await clerk('GET', `/sessions?client_id=${args.client_id || ''}&user_id=${args.user_id || ''}&status=${args.status || 'active'}&limit=${args.limit || 20}`);
  }
  if (tool === 'clerk_get_session') { return await clerk('GET', `/sessions/${args.session_id}`); }
  if (tool === 'clerk_revoke_session') { return await clerk('POST', `/sessions/${args.session_id}/revoke`, {}); }

  // ── JWT TEMPLATES ─────────────────────────────────────────────────────────
  if (tool === 'clerk_list_jwt_templates') { return await clerk('GET', '/jwt_templates'); }
  if (tool === 'clerk_get_jwt_template') { return await clerk('GET', `/jwt_templates/${args.template_id}`); }

  // ── INSTANCE SETTINGS ─────────────────────────────────────────────────────
  if (tool === 'clerk_get_instance') { return await clerk('GET', '/instance'); }

  throw new Error(`Unknown Clerk tool: ${tool}`);
}

export default { execute };
