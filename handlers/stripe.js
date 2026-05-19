/**
 * Stripe Handler — 132 tools
 * Full Stripe API: customers, charges, products, prices, subscriptions,
 * invoices, payment intents, setup intents, payment links, subscription
 * schedules, metered billing, tax rates, quotes, credit notes, Connect,
 * events, files, reporting, coupons, webhooks, and Super Tools.
 * Critical for YardSync and Cortiware billing infrastructure.
 */

const BASE = 'https://api.stripe.com/v1';

function headers(connectedAccountId) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not set in .env');
  const h = { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' };
  if (connectedAccountId) h['Stripe-Account'] = connectedAccountId;
  return h;
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

async function stripe(method, path, body, connectedAccountId) {
  const isGet = method === 'GET' || method === 'DELETE';
  let url = `${BASE}${path}`;
  if (isGet && body && Object.keys(body).length) url += `?${encode(body)}`;
  const res = await fetch(url, {
    method,
    headers: headers(connectedAccountId),
    body: !isGet && body && Object.keys(body).length ? encode(body) : undefined
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

  // Customer balance transactions
  if (tool === 'stripe_list_customer_balance_transactions') {
    return await stripe('GET', `/customers/${args.customer_id}/balance_transactions`, { limit: args.limit || 10 });
  }
  if (tool === 'stripe_create_customer_balance_transaction') {
    const { customer_id, amount, currency = 'usd', description } = args;
    if (!customer_id || !amount) throw new Error('customer_id and amount are required');
    const body = { amount, currency };
    if (description) body.description = description;
    return await stripe('POST', `/customers/${customer_id}/balance_transactions`, body);
  }

  // ── CHARGES ───────────────────────────────────────────────────────────────
  if (tool === 'stripe_list_charges') {
    return await stripe('GET', '/charges', { limit: args.limit || 10, customer: args.customer_id, payment_intent: args.payment_intent_id });
  }
  if (tool === 'stripe_get_charge') { return await stripe('GET', `/charges/${args.charge_id}`); }
  if (tool === 'stripe_update_charge') {
    const { charge_id, description, metadata, receipt_email } = args;
    const body = {};
    if (description) body.description = description;
    if (metadata) body.metadata = metadata;
    if (receipt_email) body.receipt_email = receipt_email;
    return await stripe('POST', `/charges/${charge_id}`, body);
  }
  if (tool === 'stripe_capture_charge') {
    return await stripe('POST', `/charges/${args.charge_id}/capture`, { amount: args.amount });
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
    if (recurring) body.recurring = recurring;
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
  if (tool === 'stripe_update_subscription_item') {
    const { subscription_item_id, price_id, quantity, metadata } = args;
    const body = {};
    if (price_id) body.price = price_id;
    if (quantity !== undefined) body.quantity = quantity;
    if (metadata) body.metadata = metadata;
    return await stripe('POST', `/subscription_items/${subscription_item_id}`, body);
  }

  // ── SUBSCRIPTION SCHEDULES ────────────────────────────────────────────────
  if (tool === 'stripe_create_subscription_schedule') {
    const { customer_id, start_date, end_behavior = 'release', phases } = args;
    if (!customer_id) throw new Error('customer_id is required');
    const body = { customer: customer_id, end_behavior };
    if (start_date) body.start_date = start_date;
    if (phases) body.phases = phases;
    return await stripe('POST', '/subscription_schedules', body);
  }
  if (tool === 'stripe_get_subscription_schedule') {
    return await stripe('GET', `/subscription_schedules/${args.schedule_id}`);
  }
  if (tool === 'stripe_update_subscription_schedule') {
    const { schedule_id, phases, end_behavior, proration_behavior } = args;
    const body = {};
    if (phases) body.phases = phases;
    if (end_behavior) body.end_behavior = end_behavior;
    if (proration_behavior) body.proration_behavior = proration_behavior;
    return await stripe('POST', `/subscription_schedules/${schedule_id}`, body);
  }
  if (tool === 'stripe_release_subscription_schedule') {
    return await stripe('POST', `/subscription_schedules/${args.schedule_id}/release`, {});
  }
  if (tool === 'stripe_cancel_subscription_schedule') {
    return await stripe('POST', `/subscription_schedules/${args.schedule_id}/cancel`, {
      invoice_now: args.invoice_now || false,
      prorate: args.prorate !== false
    });
  }
  if (tool === 'stripe_list_subscription_schedules') {
    return await stripe('GET', '/subscription_schedules', { limit: args.limit || 10, customer: args.customer_id });
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

  // ── CREDIT NOTES ──────────────────────────────────────────────────────────
  if (tool === 'stripe_list_credit_notes') {
    return await stripe('GET', '/credit_notes', { limit: args.limit || 10, invoice: args.invoice_id });
  }
  if (tool === 'stripe_get_credit_note') { return await stripe('GET', `/credit_notes/${args.credit_note_id}`); }
  if (tool === 'stripe_create_credit_note') {
    const { invoice_id, amount, reason, lines, memo } = args;
    if (!invoice_id) throw new Error('invoice_id is required');
    const body = { invoice: invoice_id };
    if (amount) body.amount = amount;
    if (reason) body.reason = reason;
    if (memo) body.memo = memo;
    if (lines) body.lines = lines;
    return await stripe('POST', '/credit_notes', body);
  }
  if (tool === 'stripe_void_credit_note') {
    return await stripe('POST', `/credit_notes/${args.credit_note_id}/void`, {});
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

  // ── SETUP INTENTS ─────────────────────────────────────────────────────────
  if (tool === 'stripe_create_setup_intent') {
    const { customer_id, payment_method_types, usage = 'off_session', metadata } = args;
    const body = { usage };
    if (customer_id) body.customer = customer_id;
    if (payment_method_types) payment_method_types.forEach((t, i) => body[`payment_method_types[${i}]`] = t);
    if (metadata) body.metadata = metadata;
    return await stripe('POST', '/setup_intents', body);
  }
  if (tool === 'stripe_get_setup_intent') { return await stripe('GET', `/setup_intents/${args.setup_intent_id}`); }
  if (tool === 'stripe_confirm_setup_intent') {
    return await stripe('POST', `/setup_intents/${args.setup_intent_id}/confirm`, { payment_method: args.payment_method });
  }
  if (tool === 'stripe_cancel_setup_intent') {
    return await stripe('POST', `/setup_intents/${args.setup_intent_id}/cancel`, {});
  }
  if (tool === 'stripe_list_setup_intents') {
    return await stripe('GET', '/setup_intents', { limit: args.limit || 10, customer: args.customer_id });
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

  // ── CHECKOUT SESSIONS ─────────────────────────────────────────────────────
  if (tool === 'stripe_create_checkout_session') {
    const { price_id, mode = 'subscription', success_url, cancel_url, customer_id, customer_email, quantity = 1, metadata, allow_promotion_codes, billing_address_collection } = args;
    if (!success_url || !cancel_url) throw new Error('success_url and cancel_url are required');
    const body = { mode, success_url, cancel_url, 'line_items[0][price]': price_id, 'line_items[0][quantity]': quantity };
    if (customer_id) body.customer = customer_id;
    if (customer_email) body.customer_email = customer_email;
    if (metadata) body.metadata = metadata;
    if (allow_promotion_codes) body.allow_promotion_codes = allow_promotion_codes;
    if (billing_address_collection) body.billing_address_collection = billing_address_collection;
    return await stripe('POST', '/checkout/sessions', body);
  }
  if (tool === 'stripe_get_checkout_session') { return await stripe('GET', `/checkout/sessions/${args.session_id}`); }
  if (tool === 'stripe_list_checkout_sessions') {
    return await stripe('GET', '/checkout/sessions', { limit: args.limit || 10, customer: args.customer_id, payment_intent: args.payment_intent_id });
  }
  if (tool === 'stripe_expire_checkout_session') {
    return await stripe('POST', `/checkout/sessions/${args.session_id}/expire`, {});
  }

  // ── PAYMENT LINKS ─────────────────────────────────────────────────────────
  if (tool === 'stripe_create_payment_link') {
    const { price_id, quantity = 1, after_completion, allow_promotion_codes, metadata } = args;
    if (!price_id) throw new Error('price_id is required');
    const body = { 'line_items[0][price]': price_id, 'line_items[0][quantity]': quantity };
    if (allow_promotion_codes) body.allow_promotion_codes = allow_promotion_codes;
    if (metadata) body.metadata = metadata;
    if (after_completion) body.after_completion = after_completion;
    return await stripe('POST', '/payment_links', body);
  }
  if (tool === 'stripe_get_payment_link') { return await stripe('GET', `/payment_links/${args.payment_link_id}`); }
  if (tool === 'stripe_update_payment_link') {
    const { payment_link_id, active, metadata } = args;
    const body = {};
    if (active !== undefined) body.active = active;
    if (metadata) body.metadata = metadata;
    return await stripe('POST', `/payment_links/${payment_link_id}`, body);
  }
  if (tool === 'stripe_list_payment_links') {
    return await stripe('GET', '/payment_links', { limit: args.limit || 10, active: args.active });
  }
  if (tool === 'stripe_deactivate_payment_link') {
    return await stripe('POST', `/payment_links/${args.payment_link_id}`, { active: false });
  }

  // ── BILLING PORTAL ────────────────────────────────────────────────────────
  if (tool === 'stripe_create_billing_portal_session') {
    if (!args.customer_id || !args.return_url) throw new Error('customer_id and return_url are required');
    return await stripe('POST', '/billing_portal/sessions', { customer: args.customer_id, return_url: args.return_url });
  }
  if (tool === 'stripe_get_billing_portal_configuration') {
    return await stripe('GET', '/billing_portal/configurations', { limit: 1 });
  }

  // ── USAGE RECORDS (metered billing) ───────────────────────────────────────
  if (tool === 'stripe_create_usage_record') {
    const { subscription_item_id, quantity, timestamp, action = 'increment' } = args;
    if (!subscription_item_id || quantity === undefined) throw new Error('subscription_item_id and quantity are required');
    const body = { quantity, action };
    if (timestamp) body.timestamp = timestamp;
    return await stripe('POST', `/subscription_items/${subscription_item_id}/usage_records`, body);
  }
  if (tool === 'stripe_list_usage_record_summaries') {
    return await stripe('GET', `/subscription_items/${args.subscription_item_id}/usage_record_summaries`, { limit: args.limit || 10 });
  }

  // ── TAX RATES ─────────────────────────────────────────────────────────────
  if (tool === 'stripe_list_tax_rates') {
    return await stripe('GET', '/tax_rates', { limit: args.limit || 10, active: args.active, inclusive: args.inclusive });
  }
  if (tool === 'stripe_get_tax_rate') { return await stripe('GET', `/tax_rates/${args.tax_rate_id}`); }
  if (tool === 'stripe_create_tax_rate') {
    const { display_name, percentage, inclusive = false, country, state, description } = args;
    if (!display_name || percentage === undefined) throw new Error('display_name and percentage are required');
    const body = { display_name, percentage, inclusive };
    if (country) body.country = country;
    if (state) body.state = state;
    if (description) body.description = description;
    return await stripe('POST', '/tax_rates', body);
  }
  if (tool === 'stripe_update_tax_rate') {
    const { tax_rate_id, active, description, display_name } = args;
    const body = {};
    if (active !== undefined) body.active = active;
    if (description) body.description = description;
    if (display_name) body.display_name = display_name;
    return await stripe('POST', `/tax_rates/${tax_rate_id}`, body);
  }

  // ── QUOTES ────────────────────────────────────────────────────────────────
  if (tool === 'stripe_create_quote') {
    const { customer_id, line_items, expires_at, description, metadata } = args;
    const body = {};
    if (customer_id) body.customer = customer_id;
    if (expires_at) body.expires_at = expires_at;
    if (description) body.description = description;
    if (metadata) body.metadata = metadata;
    if (line_items) {
      line_items.forEach((item, i) => {
        if (item.price) body[`line_items[${i}][price]`] = item.price;
        if (item.quantity) body[`line_items[${i}][quantity]`] = item.quantity;
      });
    }
    return await stripe('POST', '/quotes', body);
  }
  if (tool === 'stripe_get_quote') { return await stripe('GET', `/quotes/${args.quote_id}`); }
  if (tool === 'stripe_update_quote') {
    const { quote_id, ...updates } = args;
    return await stripe('POST', `/quotes/${quote_id}`, updates);
  }
  if (tool === 'stripe_finalize_quote') {
    return await stripe('POST', `/quotes/${args.quote_id}/finalize`, {});
  }
  if (tool === 'stripe_accept_quote') {
    return await stripe('POST', `/quotes/${args.quote_id}/accept`, {});
  }
  if (tool === 'stripe_cancel_quote') {
    return await stripe('POST', `/quotes/${args.quote_id}/cancel`, {});
  }
  if (tool === 'stripe_list_quotes') {
    return await stripe('GET', '/quotes', { limit: args.limit || 10, customer: args.customer_id, status: args.status });
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
  if (tool === 'stripe_list_promotion_codes') {
    return await stripe('GET', '/promotion_codes', { limit: args.limit || 10, coupon: args.coupon_id, active: args.active });
  }
  if (tool === 'stripe_get_promotion_code') { return await stripe('GET', `/promotion_codes/${args.promotion_code_id}`); }
  if (tool === 'stripe_create_promotion_code') {
    return await stripe('POST', '/promotion_codes', { coupon: args.coupon_id, code: args.code, max_redemptions: args.max_redemptions, expires_at: args.expires_at });
  }
  if (tool === 'stripe_update_promotion_code') {
    const { promotion_code_id, active, metadata } = args;
    const body = {};
    if (active !== undefined) body.active = active;
    if (metadata) body.metadata = metadata;
    return await stripe('POST', `/promotion_codes/${promotion_code_id}`, body);
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

  // ── EVENTS ────────────────────────────────────────────────────────────────
  if (tool === 'stripe_list_events') {
    return await stripe('GET', '/events', { limit: args.limit || 20, type: args.type, created: args.created_after ? { gte: args.created_after } : undefined });
  }
  if (tool === 'stripe_get_event') { return await stripe('GET', `/events/${args.event_id}`); }

  // ── FILES ─────────────────────────────────────────────────────────────────
  if (tool === 'stripe_list_files') {
    return await stripe('GET', '/files', { limit: args.limit || 10, purpose: args.purpose });
  }
  if (tool === 'stripe_get_file') { return await stripe('GET', `/files/${args.file_id}`); }
  if (tool === 'stripe_create_file_link') {
    return await stripe('POST', '/file_links', { file: args.file_id, expires_at: args.expires_at });
  }

  // ── DISPUTES ──────────────────────────────────────────────────────────────
  if (tool === 'stripe_list_disputes') { return await stripe('GET', '/disputes', { limit: args.limit || 10 }); }
  if (tool === 'stripe_get_dispute') { return await stripe('GET', `/disputes/${args.dispute_id}`); }
  if (tool === 'stripe_update_dispute') {
    const { dispute_id, evidence, submit } = args;
    const body = {};
    if (evidence) body.evidence = evidence;
    if (submit !== undefined) body.submit = submit;
    return await stripe('POST', `/disputes/${dispute_id}`, body);
  }
  if (tool === 'stripe_close_dispute') {
    return await stripe('POST', `/disputes/${args.dispute_id}/close`, {});
  }

  // ── BALANCE & PAYOUTS ─────────────────────────────────────────────────────
  if (tool === 'stripe_get_balance') { return await stripe('GET', '/balance', {}); }
  if (tool === 'stripe_list_balance_transactions') {
    return await stripe('GET', '/balance_transactions', { limit: args.limit || 10, type: args.type, currency: args.currency });
  }
  if (tool === 'stripe_list_payouts') { return await stripe('GET', '/payouts', { limit: args.limit || 10, status: args.status }); }
  if (tool === 'stripe_get_payout') { return await stripe('GET', `/payouts/${args.payout_id}`); }

  // ── ACCOUNT ───────────────────────────────────────────────────────────────
  if (tool === 'stripe_get_account') {
    // Retrieve your own Stripe account details
    return await stripe('GET', '/account', {});
  }
  if (tool === 'stripe_update_account') {
    const { business_type, business_profile, settings } = args;
    const body = {};
    if (business_type) body.business_type = business_type;
    if (business_profile) body.business_profile = business_profile;
    if (settings) body.settings = settings;
    return await stripe('POST', '/account', body);
  }

  // ── CONNECT (multi-tenant SaaS) ───────────────────────────────────────────
  if (tool === 'stripe_create_connect_account') {
    const { type = 'express', email, country = 'US', capabilities } = args;
    const body = { type, country };
    if (email) body.email = email;
    if (capabilities) body.capabilities = capabilities;
    return await stripe('POST', '/accounts', body);
  }
  if (tool === 'stripe_get_connect_account') { return await stripe('GET', `/accounts/${args.account_id}`); }
  if (tool === 'stripe_update_connect_account') {
    const { account_id, ...updates } = args;
    return await stripe('POST', `/accounts/${account_id}`, updates);
  }
  if (tool === 'stripe_list_connect_accounts') { return await stripe('GET', '/accounts', { limit: args.limit || 10 }); }
  if (tool === 'stripe_delete_connect_account') { return await stripe('DELETE', `/accounts/${args.account_id}`); }
  if (tool === 'stripe_create_account_link') {
    const { account_id, return_url, refresh_url, type = 'account_onboarding' } = args;
    if (!account_id || !return_url || !refresh_url) throw new Error('account_id, return_url, and refresh_url are required');
    return await stripe('POST', '/account_links', { account: account_id, return_url, refresh_url, type });
  }
  if (tool === 'stripe_create_login_link') {
    // Generate a temporary login link for a connected account's Stripe dashboard
    return await stripe('POST', `/accounts/${args.account_id}/login_links`, {});
  }
  if (tool === 'stripe_list_account_capabilities') {
    return await stripe('GET', `/accounts/${args.account_id}/capabilities`, {});
  }
  if (tool === 'stripe_update_account_capability') {
    return await stripe('POST', `/accounts/${args.account_id}/capabilities/${args.capability_id}`, { requested: args.requested });
  }
  if (tool === 'stripe_create_transfer') {
    const { amount, currency = 'usd', destination_account_id, description, transfer_group } = args;
    const body = { amount, currency, destination: destination_account_id };
    if (description) body.description = description;
    if (transfer_group) body.transfer_group = transfer_group;
    return await stripe('POST', '/transfers', body);
  }
  if (tool === 'stripe_list_transfers') { return await stripe('GET', '/transfers', { limit: args.limit || 10, destination: args.account_id }); }
  if (tool === 'stripe_get_transfer') { return await stripe('GET', `/transfers/${args.transfer_id}`); }
  if (tool === 'stripe_reverse_transfer') {
    return await stripe('POST', `/transfers/${args.transfer_id}/reversals`, { amount: args.amount });
  }

  // ── REPORTING ─────────────────────────────────────────────────────────────
  if (tool === 'stripe_list_report_types') {
    return await stripe('GET', '/reporting/report_types', {});
  }
  if (tool === 'stripe_create_report_run') {
    const { report_type, interval_start, interval_end } = args;
    if (!report_type || !interval_start || !interval_end) throw new Error('report_type, interval_start, and interval_end are required');
    return await stripe('POST', '/reporting/report_runs', {
      report_type,
      'parameters[interval_start]': interval_start,
      'parameters[interval_end]': interval_end
    });
  }
  if (tool === 'stripe_get_report_run') { return await stripe('GET', `/reporting/report_runs/${args.report_run_id}`); }
  if (tool === 'stripe_list_report_runs') {
    return await stripe('GET', '/reporting/report_runs', { limit: args.limit || 10 });
  }

  // ── MRR / REVENUE HELPERS ─────────────────────────────────────────────────
  if (tool === 'stripe_get_mrr_summary') {
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

  // ══════════════════════════════════════════════════════════════════════════
  //  SUPER TOOLS
  // ══════════════════════════════════════════════════════════════════════════

  // SUPER: Full revenue dashboard — MRR, ARR, recent charges, past-due subs
  if (tool === 'stripe_revenue_summary') {
    const [subs, recentCharges, pastDue, balance] = await Promise.all([
      stripe('GET', '/subscriptions', { limit: 100, status: 'active' }),
      stripe('GET', '/charges', { limit: 10, created: { gte: Math.floor(Date.now() / 1000) - 2592000 } }),
      stripe('GET', '/subscriptions', { limit: 10, status: 'past_due' }),
      stripe('GET', '/balance', {})
    ]);
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
    const recentRevenue = recentCharges.data.filter(c => c.status === 'succeeded').reduce((sum, c) => sum + c.amount / 100, 0);
    return {
      mrr_usd: Math.round(mrr * 100) / 100,
      arr_usd: Math.round(mrr * 12 * 100) / 100,
      active_subscriptions: subs.data.length,
      past_due_subscriptions: pastDue.data.length,
      revenue_last_30d: Math.round(recentRevenue * 100) / 100,
      balance_available: balance.available?.reduce((s, b) => s + b.amount / 100, 0),
      balance_pending: balance.pending?.reduce((s, b) => s + b.amount / 100, 0),
      generated_at: new Date().toISOString()
    };
  }

  // SUPER: Find all past-due subscriptions with customer details for dunning
  if (tool === 'stripe_dunning_check') {
    const pastDue = await stripe('GET', '/subscriptions', { limit: 50, status: 'past_due', expand: 'data.customer' });
    return {
      past_due_count: pastDue.data.length,
      subscriptions: pastDue.data.map(sub => ({
        subscription_id: sub.id,
        customer_id: sub.customer?.id || sub.customer,
        customer_email: sub.customer?.email,
        customer_name: sub.customer?.name,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        amount: sub.items?.data?.[0]?.price?.unit_amount / 100,
        currency: sub.items?.data?.[0]?.price?.currency,
        latest_invoice: sub.latest_invoice
      }))
    };
  }

  // SUPER: Onboard a new customer — create + attach payment intent + subscription
  if (tool === 'stripe_onboard_customer') {
    const { email, name, price_id, trial_days } = args;
    if (!email || !price_id) throw new Error('email and price_id are required');
    const customer = await stripe('POST', '/customers', { email, name: name || email });
    const setupIntent = await stripe('POST', '/setup_intents', {
      customer: customer.id,
      'payment_method_types[0]': 'card',
      usage: 'off_session'
    });
    return {
      customer_id: customer.id,
      customer_email: customer.email,
      setup_intent_id: setupIntent.id,
      setup_intent_client_secret: setupIntent.client_secret,
      next_step: `Collect payment method using the client_secret, then call stripe_create_subscription with customer_id: ${customer.id} and price_id: ${price_id}`,
      trial_days
    };
  }

  // SUPER: Upgrade or downgrade a subscription plan with proration preview
  if (tool === 'stripe_upgrade_subscription') {
    const { subscription_id, new_price_id, proration_behavior = 'always_invoice', preview_only = false } = args;
    if (!subscription_id || !new_price_id) throw new Error('subscription_id and new_price_id are required');
    const sub = await stripe('GET', `/subscriptions/${subscription_id}`);
    const itemId = sub.items?.data?.[0]?.id;
    if (!itemId) throw new Error('No subscription item found to update');
    if (preview_only) {
      const preview = await stripe('GET', '/invoices/upcoming', {
        customer: sub.customer,
        subscription: subscription_id,
        [`subscription_items[0][id]`]: itemId,
        [`subscription_items[0][price]`]: new_price_id,
        subscription_proration_behavior: proration_behavior
      });
      return { preview: true, proration_amount: preview.amount_due / 100, currency: preview.currency, new_period_end: new Date(preview.period_end * 1000).toISOString() };
    }
    const updated = await stripe('POST', `/subscriptions/${subscription_id}`, {
      [`items[0][id]`]: itemId,
      [`items[0][price]`]: new_price_id,
      proration_behavior
    });
    return { upgraded: true, subscription_id, new_price_id, status: updated.status, current_period_end: new Date(updated.current_period_end * 1000).toISOString() };
  }

  // SUPER: Fully cancel a customer — refund last payment + cancel subscription
  if (tool === 'stripe_cancel_and_refund_customer') {
    const { customer_id, subscription_id, refund_amount, cancel_at_period_end = false } = args;
    if (!customer_id) throw new Error('customer_id is required');
    const results = {};
    if (subscription_id) {
      results.subscription = await stripe('DELETE', `/subscriptions/${subscription_id}`, { cancel_at_period_end });
    } else {
      const subs = await stripe('GET', '/subscriptions', { customer: customer_id, status: 'active', limit: 1 });
      if (subs.data.length) {
        results.subscription = await stripe('DELETE', `/subscriptions/${subs.data[0].id}`, { cancel_at_period_end });
      }
    }
    if (refund_amount !== false) {
      const charges = await stripe('GET', '/charges', { customer: customer_id, limit: 1 });
      if (charges.data.length) {
        const latestCharge = charges.data[0];
        if (latestCharge.status === 'succeeded' && !latestCharge.refunded) {
          results.refund = await stripe('POST', '/refunds', {
            charge: latestCharge.id,
            amount: refund_amount || latestCharge.amount
          });
        }
      }
    }
    return { customer_id, ...results };
  }

  // SUPER: Get full customer billing history — subscriptions, invoices, charges
  if (tool === 'stripe_customer_billing_summary') {
    const { customer_id } = args;
    if (!customer_id) throw new Error('customer_id is required');
    const [customer, subs, invoices, charges, paymentMethods] = await Promise.all([
      stripe('GET', `/customers/${customer_id}`),
      stripe('GET', '/subscriptions', { customer: customer_id, limit: 10, status: 'all' }),
      stripe('GET', '/invoices', { customer: customer_id, limit: 10 }),
      stripe('GET', '/charges', { customer: customer_id, limit: 10 }),
      stripe('GET', `/customers/${customer_id}/payment_methods`, { type: 'card', limit: 5 })
    ]);
    const totalSpend = charges.data.filter(c => c.status === 'succeeded').reduce((s, c) => s + c.amount / 100, 0);
    return {
      customer: { id: customer.id, email: customer.email, name: customer.name, created: new Date(customer.created * 1000).toISOString() },
      subscriptions: subs.data.map(s => ({ id: s.id, status: s.status, current_period_end: new Date(s.current_period_end * 1000).toISOString() })),
      recent_invoices: invoices.data.map(i => ({ id: i.id, amount: i.amount_due / 100, status: i.status, date: new Date(i.created * 1000).toISOString() })),
      payment_methods: paymentMethods.data.map(pm => ({ id: pm.id, brand: pm.card?.brand, last4: pm.card?.last4, expires: `${pm.card?.exp_month}/${pm.card?.exp_year}` })),
      total_spend_usd: Math.round(totalSpend * 100) / 100
    };
  }

  throw new Error(`Unknown Stripe tool: ${tool}`);
}

export default { execute };
