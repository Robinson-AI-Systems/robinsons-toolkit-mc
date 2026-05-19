/**
 * Stripe Handler — 62 tools
 * Full Stripe API: customers, products, prices, subscriptions,
 * invoices, payments, refunds, webhooks, Connect, and billing portal.
 * Critical for YardSync and Cortiware billing infrastructure.
 */

const BASE = 'https://api.stripe.com/v1';

function headers() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not set in .env');
  return {
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  };
}

function encode(obj, prefix = '') {
  const pairs = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object' && !Array.isArray(v)) {
      pairs.push(...encode(v, key).split('&').filter(Boolean));
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => pairs.push(`${key}[${i}]=${encodeURIComponent(item)}`));
    } else {
      pairs.push(`${key}=${encodeURIComponent(v)}`);
    }
  }
  return pairs.join('&');
}

async function stripe(method, path, body) {
  const isGet = method === 'GET' || method === 'DELETE';
  let url = `${BASE}${path}`;
  if (isGet && body && Object.keys(body).length) url += `?${encode(body)}`;
  const res = await fetch(url, {
    method,
    headers: headers(),
    body: !isGet && body ? encode(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${data.error?.message || JSON.stringify(data.error)}`);
  return data;
}

async function execute(tool, args) {

  // ── CUSTOMERS ─────────────────────────────────────────────────────────────
  if (tool === 'stripe_list_customers') {
    return await stripe('GET', '/customers', { limit: args.limit || 10, email: args.email, starting_after: args.starting_after });
  }
  if (tool === 'stripe_get_customer') { return await stripe('GET', `/customers/${args.customer_id}`); }
  if (tool === 'stripe_create_customer') {
    const { email, name, phone, description, metadata, address } = args;
    const body = {};
    if (email) body.email = email; if (name) body.name = name; if (phone) body.phone = phone;
    if (description) body.description = description; if (metadata) body.metadata = metadata;
    if (address) body.address = address;
    return await stripe('POST', '/customers', body);
  }
  if (tool === 'stripe_update_customer') {
    const { customer_id, ...updates } = args;
    return await stripe('POST', `/customers/${customer_id}`, updates);
  }
  if (tool === 'stripe_delete_customer') { return await stripe('DELETE', `/customers/${args.customer_id}`); }
  if (tool === 'stripe_search_customers') {
    return await stripe('GET', '/customers/search', { query: args.query, limit: args.limit || 10 });
  }
  if (tool === 'stripe_list_customer_payment_methods') {
    return await stripe('GET', `/customers/${args.customer_id}/payment_methods`, { type: args.type || 'card', limit: args.limit || 10 });
  }

  // ── PRODUCTS ──────────────────────────────────────────────────────────────
  if (tool === 'stripe_list_products') {
    return await stripe('GET', '/products', { limit: args.limit || 10, active: args.active });
  }
  if (tool === 'stripe_get_product') { return await stripe('GET', `/products/${args.product_id}`); }
  if (tool === 'stripe_create_product') {
    const { name, description, metadata, images, unit_label } = args;
    const body = { name };
    if (description) body.description = description; if (metadata) body.metadata = metadata;
    if (unit_label) body.unit_label = unit_label; if (images) body.images = images;
    return await stripe('POST', '/products', body);
  }
  if (tool === 'stripe_update_product') {
    const { product_id, ...updates } = args;
    return await stripe('POST', `/products/${product_id}`, updates);
  }
  if (tool === 'stripe_archive_product') {
    return await stripe('POST', `/products/${args.product_id}`, { active: false });
  }

  // ── PRICES ────────────────────────────────────────────────────────────────
  if (tool === 'stripe_list_prices') {
    return await stripe('GET', '/prices', { limit: args.limit || 10, product: args.product_id, active: args.active });
  }
  if (tool === 'stripe_get_price') { return await stripe('GET', `/prices/${args.price_id}`); }
  if (tool === 'stripe_create_price') {
    const { product_id, unit_amount, currency = 'usd', recurring, nickname, metadata } = args;
    const body = { product: product_id, unit_amount, currency };
    if (recurring) body.recurring = recurring; // { interval: 'month', interval_count: 1 }
    if (nickname) body.nickname = nickname; if (metadata) body.metadata = metadata;
    return await stripe('POST', '/prices', body);
  }
  if (tool === 'stripe_update_price') {
    const { price_id, nickname, active, metadata } = args;
    const body = {};
    if (nickname !== undefined) body.nickname = nickname; if (active !== undefined) body.active = active;
    if (metadata) body.metadata = metadata;
    return await stripe('POST', `/prices/${price_id}`, body);
  }

  // ── SUBSCRIPTIONS ─────────────────────────────────────────────────────────
  if (tool === 'stripe_list_subscriptions') {
    return await stripe('GET', '/subscriptions', { limit: args.limit || 10, customer: args.customer_id, status: args.status || 'all', price: args.price_id });
  }
  if (tool === 'stripe_get_subscription') { return await stripe('GET', `/subscriptions/${args.subscription_id}`); }
  if (tool === 'stripe_create_subscription') {
    const { customer_id, price_id, items, trial_period_days, cancel_at_period_end, metadata, payment_behavior, coupon } = args;
    const body = { customer: customer_id };
    if (items) body.items = items;
    else if (price_id) body['items[0][price]'] = price_id;
    if (trial_period_days) body.trial_period_days = trial_period_days;
    if (cancel_at_period_end !== undefined) body.cancel_at_period_end = cancel_at_period_end;
    if (metadata) body.metadata = metadata;
    if (payment_behavior) body.payment_behavior = payment_behavior;
    if (coupon) body.coupon = coupon;
    return await stripe('POST', '/subscriptions', body);
  }
  if (tool === 'stripe_update_subscription') {
    const { subscription_id, ...updates } = args;
    return await stripe('POST', `/subscriptions/${subscription_id}`, updates);
  }
  if (tool === 'stripe_cancel_subscription') {
    return await stripe('DELETE', `/subscriptions/${args.subscription_id}`, { cancel_at_period_end: args.at_period_end || false });
  }
  if (tool === 'stripe_pause_subscription') {
    return await stripe('POST', `/subscriptions/${args.subscription_id}`, { pause_collection: { behavior: args.behavior || 'mark_uncollectible' } });
  }
  if (tool === 'stripe_resume_subscription') {
    return await stripe('POST', `/subscriptions/${args.subscription_id}`, { pause_collection: '' });
  }
  if (tool === 'stripe_list_subscription_items') {
    return await stripe('GET', '/subscription_items', { subscription: args.subscription_id });
  }

  // ── INVOICES ──────────────────────────────────────────────────────────────
  if (tool === 'stripe_list_invoices') {
    return await stripe('GET', '/invoices', { limit: args.limit || 10, customer: args.customer_id, subscription: args.subscription_id, status: args.status });
  }
  if (tool === 'stripe_get_invoice') { return await stripe('GET', `/invoices/${args.invoice_id}`); }
  if (tool === 'stripe_create_invoice') {
    const { customer_id, subscription_id, description, metadata, days_until_due, auto_advance } = args;
    const body = { customer: customer_id };
    if (subscription_id) body.subscription = subscription_id;
    if (description) body.description = description; if (metadata) body.metadata = metadata;
    if (days_until_due !== undefined) body.days_until_due = days_until_due;
    if (auto_advance !== undefined) body.auto_advance = auto_advance;
    return await stripe('POST', '/invoices', body);
  }
  if (tool === 'stripe_finalize_invoice') { return await stripe('POST', `/invoices/${args.invoice_id}/finalize`, {}); }
  if (tool === 'stripe_pay_invoice') { return await stripe('POST', `/invoices/${args.invoice_id}/pay`, {}); }
  if (tool === 'stripe_void_invoice') { return await stripe('POST', `/invoices/${args.invoice_id}/void`, {}); }
  if (tool === 'stripe_send_invoice') { return await stripe('POST', `/invoices/${args.invoice_id}/send`, {}); }
  if (tool === 'stripe_create_invoice_item') {
    const { customer_id, amount, currency = 'usd', description, invoice_id, price_id } = args;
    const body = { customer: customer_id, currency };
    if (amount) body.amount = amount; if (description) body.description = description;
    if (invoice_id) body.invoice = invoice_id; if (price_id) body.price = price_id;
    return await stripe('POST', '/invoiceitems', body);
  }
  if (tool === 'stripe_get_upcoming_invoice') {
    return await stripe('GET', '/invoices/upcoming', { customer: args.customer_id, subscription: args.subscription_id });
  }

  // ── PAYMENT INTENTS ───────────────────────────────────────────────────────
  if (tool === 'stripe_list_payment_intents') {
    return await stripe('GET', '/payment_intents', { limit: args.limit || 10, customer: args.customer_id });
  }
  if (tool === 'stripe_get_payment_intent') { return await stripe('GET', `/payment_intents/${args.payment_intent_id}`); }
  if (tool === 'stripe_create_payment_intent') {
    const { amount, currency = 'usd', customer_id, payment_method_types, description, metadata, confirm, payment_method } = args;
    const body = { amount, currency };
    if (customer_id) body.customer = customer_id;
    if (payment_method_types) body['payment_method_types[0]'] = payment_method_types[0] || 'card';
    if (description) body.description = description; if (metadata) body.metadata = metadata;
    if (confirm) body.confirm = confirm; if (payment_method) body.payment_method = payment_method;
    return await stripe('POST', '/payment_intents', body);
  }
  if (tool === 'stripe_confirm_payment_intent') {
    return await stripe('POST', `/payment_intents/${args.payment_intent_id}/confirm`, { payment_method: args.payment_method });
  }
  if (tool === 'stripe_capture_payment_intent') {
    return await stripe('POST', `/payment_intents/${args.payment_intent_id}/capture`, { amount_to_capture: args.amount });
  }
  if (tool === 'stripe_cancel_payment_intent') {
    return await stripe('POST', `/payment_intents/${args.payment_intent_id}/cancel`, {});
  }

  // ── REFUNDS ───────────────────────────────────────────────────────────────
  if (tool === 'stripe_create_refund') {
    const body = {};
    if (args.payment_intent_id) body.payment_intent = args.payment_intent_id;
    if (args.charge_id) body.charge = args.charge_id;
    if (args.amount) body.amount = args.amount;
    if (args.reason) body.reason = args.reason;
    return await stripe('POST', '/refunds', body);
  }
  if (tool === 'stripe_list_refunds') {
    return await stripe('GET', '/refunds', { limit: args.limit || 10, payment_intent: args.payment_intent_id, charge: args.charge_id });
  }
  if (tool === 'stripe_get_refund') { return await stripe('GET', `/refunds/${args.refund_id}`); }

  // ── PAYMENT METHODS ───────────────────────────────────────────────────────
  if (tool === 'stripe_get_payment_method') { return await stripe('GET', `/payment_methods/${args.payment_method_id}`); }
  if (tool === 'stripe_attach_payment_method') {
    return await stripe('POST', `/payment_methods/${args.payment_method_id}/attach`, { customer: args.customer_id });
  }
  if (tool === 'stripe_detach_payment_method') {
    return await stripe('POST', `/payment_methods/${args.payment_method_id}/detach`, {});
  }

  // ── COUPONS & PROMOTIONS ──────────────────────────────────────────────────
  if (tool === 'stripe_list_coupons') { return await stripe('GET', '/coupons', { limit: args.limit || 10 }); }
  if (tool === 'stripe_get_coupon') { return await stripe('GET', `/coupons/${args.coupon_id}`); }
  if (tool === 'stripe_create_coupon') {
    const { id, name, percent_off, amount_off, currency, duration = 'once', duration_in_months, max_redemptions } = args;
    const body = { duration };
    if (id) body.id = id; if (name) body.name = name;
    if (percent_off) body.percent_off = percent_off;
    if (amount_off) { body.amount_off = amount_off; body.currency = currency || 'usd'; }
    if (duration_in_months) body.duration_in_months = duration_in_months;
    if (max_redemptions) body.max_redemptions = max_redemptions;
    return await stripe('POST', '/coupons', body);
  }
  if (tool === 'stripe_delete_coupon') { return await stripe('DELETE', `/coupons/${args.coupon_id}`); }
  if (tool === 'stripe_create_promotion_code') {
    return await stripe('POST', '/promotion_codes', { coupon: args.coupon_id, code: args.code, max_redemptions: args.max_redemptions });
  }

  // ── WEBHOOKS ──────────────────────────────────────────────────────────────
  if (tool === 'stripe_list_webhooks') { return await stripe('GET', '/webhook_endpoints', { limit: args.limit || 10 }); }
  if (tool === 'stripe_get_webhook') { return await stripe('GET', `/webhook_endpoints/${args.webhook_id}`); }
  if (tool === 'stripe_create_webhook') {
    const { url, events, description } = args;
    if (!url || !events) throw new Error('url and events array are required');
    const body = { url };
    events.forEach((e, i) => body[`enabled_events[${i}]`] = e);
    if (description) body.description = description;
    return await stripe('POST', '/webhook_endpoints', body);
  }
  if (tool === 'stripe_update_webhook') {
    const { webhook_id, url, events } = args;
    const body = {};
    if (url) body.url = url;
    if (events) events.forEach((e, i) => body[`enabled_events[${i}]`] = e);
    return await stripe('POST', `/webhook_endpoints/${webhook_id}`, body);
  }
  if (tool === 'stripe_delete_webhook') { return await stripe('DELETE', `/webhook_endpoints/${args.webhook_id}`); }

  // ── CHECKOUT ──────────────────────────────────────────────────────────────
  if (tool === 'stripe_create_checkout_session') {
    const { price_id, mode = 'subscription', success_url, cancel_url, customer_id, customer_email, quantity = 1, metadata } = args;
    if (!success_url || !cancel_url) throw new Error('success_url and cancel_url are required');
    const body = { mode, success_url, cancel_url, 'line_items[0][price]': price_id, 'line_items[0][quantity]': quantity };
    if (customer_id) body.customer = customer_id;
    if (customer_email) body.customer_email = customer_email;
    if (metadata) body.metadata = metadata;
    return await stripe('POST', '/checkout/sessions', body);
  }
  if (tool === 'stripe_get_checkout_session') { return await stripe('GET', `/checkout/sessions/${args.session_id}`); }

  // ── BILLING PORTAL ────────────────────────────────────────────────────────
  if (tool === 'stripe_create_billing_portal_session') {
    if (!args.customer_id || !args.return_url) throw new Error('customer_id and return_url are required');
    return await stripe('POST', '/billing_portal/sessions', { customer: args.customer_id, return_url: args.return_url });
  }

  // ── BALANCE & PAYOUTS ─────────────────────────────────────────────────────
  if (tool === 'stripe_get_balance') { return await stripe('GET', '/balance', {}); }
  if (tool === 'stripe_list_balance_transactions') {
    return await stripe('GET', '/balance_transactions', { limit: args.limit || 10, type: args.type });
  }
  if (tool === 'stripe_list_payouts') { return await stripe('GET', '/payouts', { limit: args.limit || 10, status: args.status }); }

  // ── CONNECT (multi-tenant SaaS — critical for YardSync/Cortiware) ─────────
  if (tool === 'stripe_create_connect_account') {
    const { type = 'express', email, country = 'US', capabilities } = args;
    const body = { type, country };
    if (email) body.email = email;
    if (capabilities) body.capabilities = capabilities;
    return await stripe('POST', '/accounts', body);
  }
  if (tool === 'stripe_get_connect_account') { return await stripe('GET', `/accounts/${args.account_id}`); }
  if (tool === 'stripe_list_connect_accounts') { return await stripe('GET', '/accounts', { limit: args.limit || 10 }); }
  if (tool === 'stripe_delete_connect_account') { return await stripe('DELETE', `/accounts/${args.account_id}`); }
  if (tool === 'stripe_create_account_link') {
    const { account_id, return_url, refresh_url, type = 'account_onboarding' } = args;
    if (!account_id || !return_url || !refresh_url) throw new Error('account_id, return_url, and refresh_url are required');
    return await stripe('POST', '/account_links', { account: account_id, return_url, refresh_url, type });
  }
  if (tool === 'stripe_create_transfer') {
    const { amount, currency = 'usd', destination_account_id, description } = args;
    const body = { amount, currency, destination: destination_account_id };
    if (description) body.description = description;
    return await stripe('POST', '/transfers', body);
  }
  if (tool === 'stripe_list_transfers') { return await stripe('GET', '/transfers', { limit: args.limit || 10, destination: args.account_id }); }

  // ── DISPUTES ──────────────────────────────────────────────────────────────
  if (tool === 'stripe_list_disputes') { return await stripe('GET', '/disputes', { limit: args.limit || 10 }); }
  if (tool === 'stripe_get_dispute') { return await stripe('GET', `/disputes/${args.dispute_id}`); }

  // ── REPORTING ─────────────────────────────────────────────────────────────
  if (tool === 'stripe_get_mrr_summary') {
    // Derive MRR from active subscriptions — approximate
    const subs = await stripe('GET', '/subscriptions', { limit: 100, status: 'active', expand: 'data.items' });
    let mrr = 0;
    for (const sub of subs.data) {
      for (const item of (sub.items?.data || [])) {
        const price = item.price;
        if (!price?.unit_amount) continue;
        const amount = price.unit_amount / 100;
        const interval = price.recurring?.interval;
        if (interval === 'month') mrr += amount;
        else if (interval === 'year') mrr += amount / 12;
        else if (interval === 'week') mrr += amount * 4.33;
      }
    }
    return { mrr_usd: Math.round(mrr * 100) / 100, arr_usd: Math.round(mrr * 12 * 100) / 100, active_subscriptions: subs.data.length };
  }

  throw new Error(`Unknown Stripe tool: ${tool}`);
}

export default { execute };
