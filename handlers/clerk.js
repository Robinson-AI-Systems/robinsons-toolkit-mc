/**
 * Clerk Handler — 82 tools
 * Users, emails, phones, organizations, roles, permissions,
 * invitations, sessions, JWT templates, allowlist/blocklist,
 * instance settings, and Super Tools for multi-tenant SaaS auth.
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
    const { limit = 20, offset = 0, email_address, username, order_by = '-created_at', query } = args;
    let path = `/users?limit=${limit}&offset=${offset}&order_by=${order_by}`;
    if (email_address) path += `&email_address=${encodeURIComponent(email_address)}`;
    if (username) path += `&username=${encodeURIComponent(username)}`;
    if (query) path += `&query=${encodeURIComponent(query)}`;
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
    const { user_id, first_name, last_name, username, public_metadata, private_metadata, unsafe_metadata, profile_image_id, external_id, primary_email_address_id, primary_phone_number_id } = args;
    const body = {};
    if (first_name !== undefined) body.first_name = first_name;
    if (last_name !== undefined) body.last_name = last_name;
    if (username !== undefined) body.username = username;
    if (public_metadata !== undefined) body.public_metadata = public_metadata;
    if (private_metadata !== undefined) body.private_metadata = private_metadata;
    if (unsafe_metadata !== undefined) body.unsafe_metadata = unsafe_metadata;
    if (external_id !== undefined) body.external_id = external_id;
    if (primary_email_address_id !== undefined) body.primary_email_address_id = primary_email_address_id;
    if (primary_phone_number_id !== undefined) body.primary_phone_number_id = primary_phone_number_id;
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

  // Find user by email address
  if (tool === 'clerk_get_user_by_email') {
    const { email_address } = args;
    if (!email_address) throw new Error('email_address is required');
    const results = await clerk('GET', `/users?email_address=${encodeURIComponent(email_address)}&limit=1`);
    return Array.isArray(results) ? (results[0] || null) : results;
  }

  // Find user by external ID (your app's user ID)
  if (tool === 'clerk_get_user_by_external_id') {
    const results = await clerk('GET', `/users?external_id=${encodeURIComponent(args.external_id)}&limit=1`);
    return Array.isArray(results) ? (results[0] || null) : results;
  }

  // List all organizations a user belongs to
  if (tool === 'clerk_list_user_memberships') {
    return await clerk('GET', `/users/${args.user_id}/organization_memberships?limit=${args.limit || 20}&offset=${args.offset || 0}`);
  }

  // Update only user metadata (merges cleanly)
  if (tool === 'clerk_update_user_metadata') {
    const { user_id, public_metadata, private_metadata, unsafe_metadata } = args;
    const body = {};
    if (public_metadata !== undefined) body.public_metadata = public_metadata;
    if (private_metadata !== undefined) body.private_metadata = private_metadata;
    if (unsafe_metadata !== undefined) body.unsafe_metadata = unsafe_metadata;
    return await clerk('PATCH', `/users/${user_id}/metadata`, body);
  }

  // Lock/unlock a user account
  if (tool === 'clerk_lock_user') { return await clerk('POST', `/users/${args.user_id}/lock`, {}); }
  if (tool === 'clerk_unlock_user') { return await clerk('POST', `/users/${args.user_id}/unlock`, {}); }

  // ── EMAIL ADDRESSES ───────────────────────────────────────────────────────
  if (tool === 'clerk_create_email_address') {
    const { user_id, email_address, verified = true, primary = false } = args;
    if (!user_id || !email_address) throw new Error('user_id and email_address are required');
    return await clerk('POST', '/email_addresses', { user_id, email_address, verified, primary });
  }
  if (tool === 'clerk_get_email_address') {
    return await clerk('GET', `/email_addresses/${args.email_id}`);
  }
  if (tool === 'clerk_update_email_address') {
    return await clerk('PATCH', `/email_addresses/${args.email_id}`, { verified: args.verified, primary: args.primary });
  }
  if (tool === 'clerk_delete_email_address') {
    return await clerk('DELETE', `/email_addresses/${args.email_id}`);
  }

  // ── PHONE NUMBERS ─────────────────────────────────────────────────────────
  if (tool === 'clerk_create_phone_number') {
    const { user_id, phone_number, verified = true, primary = false } = args;
    if (!user_id || !phone_number) throw new Error('user_id and phone_number are required');
    return await clerk('POST', '/phone_numbers', { user_id, phone_number, verified, primary });
  }
  if (tool === 'clerk_get_phone_number') {
    return await clerk('GET', `/phone_numbers/${args.phone_id}`);
  }
  if (tool === 'clerk_delete_phone_number') {
    return await clerk('DELETE', `/phone_numbers/${args.phone_id}`);
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
    const { organization_id, name, public_metadata, private_metadata, max_allowed_memberships, slug } = args;
    const body = {};
    if (name) body.name = name;
    if (slug) body.slug = slug;
    if (public_metadata !== undefined) body.public_metadata = public_metadata;
    if (private_metadata !== undefined) body.private_metadata = private_metadata;
    if (max_allowed_memberships !== undefined) body.max_allowed_memberships = max_allowed_memberships;
    return await clerk('PATCH', `/organizations/${organization_id}`, body);
  }
  if (tool === 'clerk_delete_organization') { return await clerk('DELETE', `/organizations/${args.organization_id}`); }
  if (tool === 'clerk_update_organization_metadata') {
    const { organization_id, public_metadata, private_metadata } = args;
    const body = {};
    if (public_metadata !== undefined) body.public_metadata = public_metadata;
    if (private_metadata !== undefined) body.private_metadata = private_metadata;
    return await clerk('PATCH', `/organizations/${organization_id}/metadata`, body);
  }

  // Org Memberships
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

  // Org Invitations
  if (tool === 'clerk_list_organization_invitations') {
    return await clerk('GET', `/organizations/${args.organization_id}/invitations?limit=${args.limit || 20}&status=${args.status || 'pending'}`);
  }
  if (tool === 'clerk_create_organization_invitation') {
    return await clerk('POST', `/organizations/${args.organization_id}/invitations`, {
      email_address: args.email, role: args.role || 'org:member',
      public_metadata: args.public_metadata, redirect_url: args.redirect_url
    });
  }
  if (tool === 'clerk_revoke_organization_invitation') {
    return await clerk('POST', `/organizations/${args.organization_id}/invitations/${args.invitation_id}/revoke`, { requesting_user_id: args.requesting_user_id });
  }

  // Org Domains (allowlist email domains)
  if (tool === 'clerk_list_organization_domains') {
    return await clerk('GET', `/organizations/${args.organization_id}/domains?limit=${args.limit || 20}`);
  }
  if (tool === 'clerk_create_organization_domain') {
    return await clerk('POST', `/organizations/${args.organization_id}/domains`, { name: args.domain, enrollment_mode: args.enrollment_mode || 'automatic_invitation' });
  }
  if (tool === 'clerk_delete_organization_domain') {
    return await clerk('DELETE', `/organizations/${args.organization_id}/domains/${args.domain_id}`);
  }

  // ── SESSIONS ──────────────────────────────────────────────────────────────
  if (tool === 'clerk_list_sessions') {
    let path = `/sessions?status=${args.status || 'active'}&limit=${args.limit || 20}`;
    if (args.user_id) path += `&user_id=${args.user_id}`;
    if (args.client_id) path += `&client_id=${args.client_id}`;
    return await clerk('GET', path);
  }
  if (tool === 'clerk_get_session') { return await clerk('GET', `/sessions/${args.session_id}`); }
  if (tool === 'clerk_revoke_session') { return await clerk('POST', `/sessions/${args.session_id}/revoke`, {}); }
  if (tool === 'clerk_verify_session_token') {
    return await clerk('POST', `/sessions/${args.session_id}/verify`, { token: args.session_token });
  }

  // ── ROLES & PERMISSIONS ───────────────────────────────────────────────────
  if (tool === 'clerk_list_roles') {
    return await clerk('GET', `/roles?limit=${args.limit || 20}&offset=${args.offset || 0}`);
  }
  if (tool === 'clerk_create_role') {
    const { name, key, description, permissions } = args;
    if (!name || !key) throw new Error('name and key are required');
    const body = { name, key, description: description || '' };
    if (permissions) body.permissions = permissions;
    return await clerk('POST', '/roles', body);
  }
  if (tool === 'clerk_update_role') {
    const { role_id, name, description, permissions } = args;
    const body = {};
    if (name) body.name = name;
    if (description) body.description = description;
    if (permissions) body.permissions = permissions;
    return await clerk('PATCH', `/roles/${role_id}`, body);
  }
  if (tool === 'clerk_delete_role') { return await clerk('DELETE', `/roles/${args.role_id}`); }
  if (tool === 'clerk_list_permissions') {
    return await clerk('GET', `/permissions?limit=${args.limit || 50}&offset=${args.offset || 0}`);
  }
  if (tool === 'clerk_create_permission') {
    const { name, key, description } = args;
    if (!name || !key) throw new Error('name and key are required');
    return await clerk('POST', '/permissions', { name, key, description: description || '' });
  }
  if (tool === 'clerk_delete_permission') { return await clerk('DELETE', `/permissions/${args.permission_id}`); }

  // ── JWT TEMPLATES ─────────────────────────────────────────────────────────
  if (tool === 'clerk_list_jwt_templates') { return await clerk('GET', '/jwt_templates'); }
  if (tool === 'clerk_get_jwt_template') { return await clerk('GET', `/jwt_templates/${args.template_id}`); }
  if (tool === 'clerk_create_jwt_template') {
    const { name, claims, lifetime = 60, allowed_clock_skew = 5 } = args;
    if (!name || !claims) throw new Error('name and claims are required');
    return await clerk('POST', '/jwt_templates', { name, claims, lifetime, allowed_clock_skew });
  }
  if (tool === 'clerk_update_jwt_template') {
    const { template_id, name, claims, lifetime } = args;
    const body = {};
    if (name) body.name = name;
    if (claims) body.claims = claims;
    if (lifetime) body.lifetime = lifetime;
    return await clerk('PATCH', `/jwt_templates/${template_id}`, body);
  }
  if (tool === 'clerk_delete_jwt_template') { return await clerk('DELETE', `/jwt_templates/${args.template_id}`); }

  // ── ALLOWLIST / BLOCKLIST ─────────────────────────────────────────────────
  if (tool === 'clerk_list_allowlist') {
    return await clerk('GET', '/allowlist_identifiers');
  }
  if (tool === 'clerk_add_to_allowlist') {
    return await clerk('POST', '/allowlist_identifiers', { identifier: args.identifier, notify: args.notify || false });
  }
  if (tool === 'clerk_delete_from_allowlist') {
    return await clerk('DELETE', `/allowlist_identifiers/${args.identifier_id}`);
  }
  if (tool === 'clerk_list_blocklist') {
    return await clerk('GET', '/blocklist_identifiers');
  }
  if (tool === 'clerk_add_to_blocklist') {
    return await clerk('POST', '/blocklist_identifiers', { identifier: args.identifier });
  }
  if (tool === 'clerk_delete_from_blocklist') {
    return await clerk('DELETE', `/blocklist_identifiers/${args.identifier_id}`);
  }

  // ── INSTANCE / APPLICATION ────────────────────────────────────────────────
  if (tool === 'clerk_get_instance') { return await clerk('GET', '/instance'); }
  if (tool === 'clerk_update_instance') {
    const { support_email, clerk_js_version, development_origin, home_url, sign_in_url, sign_up_url } = args;
    const body = {};
    if (support_email) body.support_email = support_email;
    if (clerk_js_version) body.clerk_js_version = clerk_js_version;
    if (development_origin) body.development_origin = development_origin;
    if (home_url) body.home_url = home_url;
    if (sign_in_url) body.sign_in_url = sign_in_url;
    if (sign_up_url) body.sign_up_url = sign_up_url;
    return await clerk('PATCH', '/instance', body);
  }
  if (tool === 'clerk_get_instance_restrictions') {
    return await clerk('GET', '/instance/restrictions');
  }
  if (tool === 'clerk_update_instance_restrictions') {
    const { allowlist, blocklist, block_email_subaddresses, block_disposable_email_domains } = args;
    const body = {};
    if (allowlist !== undefined) body.allowlist = allowlist;
    if (blocklist !== undefined) body.blocklist = blocklist;
    if (block_email_subaddresses !== undefined) body.block_email_subaddresses = block_email_subaddresses;
    if (block_disposable_email_domains !== undefined) body.block_disposable_email_domains = block_disposable_email_domains;
    return await clerk('PATCH', '/instance/restrictions', body);
  }
  if (tool === 'clerk_get_instance_organization_settings') {
    return await clerk('GET', '/instance/organization_settings');
  }
  if (tool === 'clerk_update_instance_organization_settings') {
    const body = {};
    if (args.enabled !== undefined) body.enabled = args.enabled;
    if (args.max_allowed_memberships !== undefined) body.max_allowed_memberships = args.max_allowed_memberships;
    if (args.creator_role !== undefined) body.creator_role = args.creator_role;
    return await clerk('PATCH', '/instance/organization_settings', body);
  }

  // ── WEBHOOKS ──────────────────────────────────────────────────────────────
  if (tool === 'clerk_list_webhooks') {
    const data = await clerk('GET', '/instance');
    return { webhooks: data.webhooks || [] };
  }
  if (tool === 'clerk_create_webhook') {
    return await clerk('POST', '/webhooks', { url: args.url, event_types: args.event_types });
  }
  if (tool === 'clerk_delete_webhook') {
    return await clerk('DELETE', `/webhooks/${args.webhook_id}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SUPER TOOLS
  // ══════════════════════════════════════════════════════════════════════════

  // SUPER: Create an org and immediately add the creator as admin
  if (tool === 'clerk_provision_org_with_owner') {
    const { name, owner_user_id, slug, max_allowed_memberships, public_metadata } = args;
    if (!name || !owner_user_id) throw new Error('name and owner_user_id are required');
    const org = await clerk('POST', '/organizations', { name, created_by: owner_user_id, slug, max_allowed_memberships, public_metadata });
    const membership = await clerk('POST', `/organizations/${org.id}/memberships`, { user_id: owner_user_id, role: 'org:admin' });
    return { organization: org, owner_membership: membership, message: `Organization "${name}" created with ${owner_user_id} as admin` };
  }

  // SUPER: Fully offboard a user — ban + revoke sessions + remove org memberships
  if (tool === 'clerk_offboard_user') {
    const { user_id } = args;
    if (!user_id) throw new Error('user_id is required');
    const results = {};

    // Revoke all sessions
    await clerk('POST', `/users/${user_id}/sessions/revoke`, {}).catch(e => { results.session_revoke_error = e.message; });
    results.sessions_revoked = true;

    // Remove from all organizations
    const memberships = await clerk('GET', `/users/${user_id}/organization_memberships?limit=50`).catch(() => ({ data: [] }));
    results.orgs_removed = [];
    for (const m of (memberships.data || [])) {
      await clerk('DELETE', `/organizations/${m.organization.id}/memberships/${user_id}`).catch(() => {});
      results.orgs_removed.push(m.organization.name);
    }

    // Ban the user
    await clerk('POST', `/users/${user_id}/ban`, {}).catch(e => { results.ban_error = e.message; });
    results.banned = !results.ban_error;

    return { user_id, ...results, message: `User offboarded: sessions revoked, removed from ${results.orgs_removed.length} org(s), account banned` };
  }

  // SUPER: Get complete user profile — user object + email addresses + org memberships
  if (tool === 'clerk_get_user_profile') {
    const { user_id } = args;
    if (!user_id) throw new Error('user_id is required');
    const [user, memberships] = await Promise.all([
      clerk('GET', `/users/${user_id}`),
      clerk('GET', `/users/${user_id}/organization_memberships?limit=20`).catch(() => ({ data: [] }))
    ]);
    return {
      id: user.id,
      email_addresses: user.email_addresses?.map(e => ({ id: e.id, address: e.email_address, primary: e.id === user.primary_email_address_id })),
      phone_numbers: user.phone_numbers?.map(p => ({ id: p.id, number: p.phone_number, primary: p.id === user.primary_phone_number_id })),
      first_name: user.first_name, last_name: user.last_name, username: user.username,
      image_url: user.image_url, external_id: user.external_id,
      public_metadata: user.public_metadata, private_metadata: user.private_metadata,
      created_at: new Date(user.created_at).toISOString(),
      last_sign_in: user.last_sign_in_at ? new Date(user.last_sign_in_at).toISOString() : null,
      banned: user.banned, locked: user.locked,
      organizations: (memberships.data || []).map(m => ({ id: m.organization.id, name: m.organization.name, role: m.role, slug: m.organization.slug }))
    };
  }

  throw new Error(`Unknown Clerk tool: ${tool}`);

  // ── SAML CONNECTIONS ──────────────────────────────────────────────────────
  if (tool === 'clerk_list_saml_connections') {
    return await clerk('GET', '/saml_connections');
  }
  if (tool === 'clerk_get_saml_connection') {
    return await clerk('GET', `/saml_connections/${args.saml_connection_id}`);
  }
  if (tool === 'clerk_create_saml_connection') {
    const { name, provider, domain, idp_entity_id, idp_sso_url, idp_certificate, attribute_mapping } = args;
    if (!name || !provider || !domain) throw new Error('name, provider, and domain are required');
    const body = { name, provider, domain };
    if (idp_entity_id) body.idp_entity_id = idp_entity_id;
    if (idp_sso_url) body.idp_sso_url = idp_sso_url;
    if (idp_certificate) body.idp_certificate = idp_certificate;
    if (attribute_mapping) body.attribute_mapping = attribute_mapping;
    return await clerk('POST', '/saml_connections', body);
  }
  if (tool === 'clerk_update_saml_connection') {
    const { saml_connection_id, active, ...updates } = args;
    if (!saml_connection_id) throw new Error('saml_connection_id is required');
    return await clerk('PATCH', `/saml_connections/${saml_connection_id}`, updates);
  }
  if (tool === 'clerk_delete_saml_connection') {
    return await clerk('DELETE', `/saml_connections/${args.saml_connection_id}`);
  }

  // ── OAUTH APPLICATIONS ────────────────────────────────────────────────────
  if (tool === 'clerk_list_oauth_applications') {
    return await clerk('GET', '/oauth_applications');
  }
  if (tool === 'clerk_get_oauth_application') {
    return await clerk('GET', `/oauth_applications/${args.oauth_application_id}`);
  }
  if (tool === 'clerk_create_oauth_application') {
    const { name, callback_url, public: isPublic = false } = args;
    if (!name || !callback_url) throw new Error('name and callback_url are required');
    return await clerk('POST', '/oauth_applications', { name, callback_url, public: isPublic });
  }
  if (tool === 'clerk_update_oauth_application') {
    const { oauth_application_id, name, callback_url } = args;
    if (!oauth_application_id) throw new Error('oauth_application_id is required');
    const body = {};
    if (name) body.name = name;
    if (callback_url) body.callback_url = callback_url;
    return await clerk('PATCH', `/oauth_applications/${oauth_application_id}`, body);
  }
  if (tool === 'clerk_delete_oauth_application') {
    return await clerk('DELETE', `/oauth_applications/${args.oauth_application_id}`);
  }
  if (tool === 'clerk_rotate_oauth_application_secret') {
    return await clerk('POST', `/oauth_applications/${args.oauth_application_id}/rotate_secret`, {});
  }

  // ── INSTANCE DOMAINS ──────────────────────────────────────────────────────
  if (tool === 'clerk_list_domains') {
    return await clerk('GET', '/domains');
  }
  if (tool === 'clerk_add_domain') {
    const { name, is_satellite = false } = args;
    if (!name) throw new Error('name is required');
    return await clerk('POST', '/domains', { name, is_satellite });
  }
  if (tool === 'clerk_delete_domain') {
    return await clerk('DELETE', `/domains/${args.domain_id}`);
  }
  if (tool === 'clerk_update_domain') {
    const { domain_id, name } = args;
    if (!domain_id) throw new Error('domain_id is required');
    return await clerk('PATCH', `/domains/${domain_id}`, { name });
  }

  // ── SIGN-IN TOKENS ────────────────────────────────────────────────────────
  if (tool === 'clerk_create_sign_in_token') {
    const { user_id, expires_in_seconds = 3600 } = args;
    if (!user_id) throw new Error('user_id is required');
    return await clerk('POST', '/sign_in_tokens', { user_id, expires_in_seconds });
  }
  if (tool === 'clerk_revoke_sign_in_token') {
    return await clerk('POST', `/sign_in_tokens/${args.token_id}/revoke`, {});
  }

  // ── SIGN-UP ATTEMPTS ──────────────────────────────────────────────────────
  if (tool === 'clerk_list_sign_ups') {
    return await clerk('GET', `/sign_ups?limit=${args.limit || 20}&offset=${args.offset || 0}`);
  }
  if (tool === 'clerk_get_sign_up') {
    return await clerk('GET', `/sign_ups/${args.sign_up_id}`);
  }
  if (tool === 'clerk_update_sign_up') {
    const { sign_up_id, ...updates } = args;
    if (!sign_up_id) throw new Error('sign_up_id is required');
    return await clerk('PATCH', `/sign_ups/${sign_up_id}`, updates);
  }

  // ── ORGANIZATION MEMBERSHIP REQUESTS ─────────────────────────────────────
  if (tool === 'clerk_list_org_membership_requests') {
    return await clerk('GET', `/organizations/${args.organization_id}/membership_requests?limit=${args.limit || 20}`);
  }
  if (tool === 'clerk_accept_org_membership_request') {
    return await clerk('POST', `/organizations/${args.organization_id}/membership_requests/${args.request_id}/accept`, {});
  }
  if (tool === 'clerk_reject_org_membership_request') {
    return await clerk('POST', `/organizations/${args.organization_id}/membership_requests/${args.request_id}/reject`, {});
  }

  // ── PROXY CHECKS ──────────────────────────────────────────────────────────
  if (tool === 'clerk_verify_proxy_url') {
    return await clerk('POST', '/proxy_checks', { proxy_url: args.proxy_url, domain: args.domain });
  }

  // ── TESTING TOKENS ────────────────────────────────────────────────────────
  if (tool === 'clerk_create_testing_token') {
    return await clerk('POST', '/testing_tokens', {});
  }

  // ── SUPER TOOL: Instance security overview ────────────────────────────────
  if (tool === 'clerk_security_overview') {
    const [instance, restrictions, blocklist, allowlist, samlConnections, webhooks] = await Promise.all([
      clerk('GET', '/public/interstitial').catch(() => null),
      clerk('GET', '/instance/restrictions'),
      clerk('GET', '/blocklist_identifiers?limit=10'),
      clerk('GET', '/allowlist_identifiers?limit=10'),
      clerk('GET', '/saml_connections').catch(() => ({ data: [] })),
      clerk('GET', '/webhooks/svix').catch(() => ({ data: [] }))
    ]);
    return {
      restrictions: restrictions?.sign_up_mode === 'restricted' ? 'invite-only' : 'open',
      blocklist_count: blocklist?.data?.length || 0,
      allowlist_count: allowlist?.data?.length || 0,
      saml_connections: samlConnections?.data?.length || 0,
      webhooks: webhooks?.data?.length || 0,
      generated_at: new Date().toISOString()
    };
  }

  // ── SUPER TOOL: Org member audit ─────────────────────────────────────────
  if (tool === 'clerk_org_member_audit') {
    const { organization_id } = args;
    if (!organization_id) throw new Error('organization_id is required');
    const [org, members, invitations, roles] = await Promise.all([
      clerk('GET', `/organizations/${organization_id}`),
      clerk('GET', `/organizations/${organization_id}/memberships?limit=100`),
      clerk('GET', `/organizations/${organization_id}/invitations?limit=50`),
      clerk('GET', '/roles?limit=50')
    ]);
    return {
      organization: { id: org.id, name: org.name, slug: org.slug, members_count: org.members_count },
      members: (members.data || []).map(m => ({ user_id: m.public_user_data?.user_id, name: `${m.public_user_data?.first_name || ''} ${m.public_user_data?.last_name || ''}`.trim(), email: m.public_user_data?.identifier, role: m.role, joined_at: m.created_at })),
      pending_invitations: (invitations.data || []).filter(i => i.status === 'pending').length,
      available_roles: (roles.data || []).map(r => r.key),
      generated_at: new Date().toISOString()
    };
  }

  throw new Error(`Unknown Clerk tool: ${tool}`);
}

export default { execute };
