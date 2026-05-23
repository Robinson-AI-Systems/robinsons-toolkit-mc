/**
 * Playwright Handler — 52 tools
 * Headless browser automation: navigation, interaction, extraction,
 * screenshots, network, accessibility, PDF generation, and Super Tools.
 *
 * Requires: Node.js + playwright package installed locally
 * Install:  npx playwright install chromium
 *
 * Always-on namespace — no API key needed.
 * Uses the local Playwright installation via dynamic import.
 */

async function getBrowser(browser_type = 'chromium', headless = true) {
  const { chromium, firefox, webkit } = await import('playwright');
  const browsers = { chromium, firefox, webkit };
  const b = browsers[browser_type] || chromium;
  return await b.launch({ headless });
}

async function withPage(fn, options = {}) {
  const { browser_type = 'chromium', headless = true, timeout = 30000, viewport } = options;
  const browser = await getBrowser(browser_type, headless);
  const context = await browser.newContext({ viewport: viewport || { width: 1280, height: 720 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.setDefaultTimeout(timeout);
  try {
    return await fn(page, context);
  } finally {
    await browser.close();
  }
}

async function execute(tool, args) {

  // ── NAVIGATION ────────────────────────────────────────────────────────────
  if (tool === 'playwright_goto') {
    const { url, wait_until = 'networkidle', timeout = 30000 } = args;
    if (!url) throw new Error('url is required');
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: wait_until, timeout });
      return { url: page.url(), title: await page.title(), status: 'loaded' };
    }, args);
  }
  if (tool === 'playwright_get_page_info') {
    const { url } = args;
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'networkidle' });
      const title = await page.title();
      const currentUrl = page.url();
      const meta = await page.evaluate(() => {
        const metas = {};
        document.querySelectorAll('meta').forEach(m => {
          if (m.name) metas[m.name] = m.content;
          if (m.property) metas[m.property] = m.content;
        });
        return metas;
      });
      return { url: currentUrl, title, meta };
    }, args);
  }
  if (tool === 'playwright_navigate_and_wait') {
    const { url, selector, wait_for_text, timeout = 30000 } = args;
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      if (selector) await page.waitForSelector(selector, { timeout });
      if (wait_for_text) await page.waitForFunction((text) => document.body.innerText.includes(text), wait_for_text, { timeout });
      return { url: page.url(), title: await page.title(), ready: true };
    }, args);
  }

  // ── SCREENSHOT ────────────────────────────────────────────────────────────
  if (tool === 'playwright_screenshot') {
    const { url, path: outputPath, full_page = false, clip, selector } = args;
    if (!outputPath) throw new Error('path (output file path) is required');
    return await withPage(async (page) => {
      if (url) await page.goto(url, { waitUntil: 'networkidle' });
      const opts = { path: outputPath, fullPage: full_page };
      if (clip) opts.clip = clip;
      if (selector) {
        const el = await page.$(selector);
        if (el) { await el.screenshot({ path: outputPath }); return { path: outputPath, selector }; }
      }
      await page.screenshot(opts);
      return { path: outputPath, full_page, url: page.url() };
    }, args);
  }
  if (tool === 'playwright_screenshot_element') {
    const { url, selector, path: outputPath } = args;
    if (!selector || !outputPath) throw new Error('selector and path are required');
    return await withPage(async (page) => {
      if (url) await page.goto(url, { waitUntil: 'domcontentloaded' });
      const el = await page.waitForSelector(selector);
      await el.screenshot({ path: outputPath });
      return { path: outputPath, selector };
    }, args);
  }
  if (tool === 'playwright_generate_pdf') {
    const { url, path: outputPath, format = 'A4', print_background = true, margin } = args;
    if (!url || !outputPath) throw new Error('url and path are required');
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'networkidle' });
      const opts = { path: outputPath, format, printBackground: print_background };
      if (margin) opts.margin = margin;
      await page.pdf(opts);
      return { path: outputPath, url, format };
    }, { ...args, browser_type: 'chromium' });
  }

  // ── CONTENT EXTRACTION ────────────────────────────────────────────────────
  if (tool === 'playwright_get_text') {
    const { url, selector } = args;
    if (!url) throw new Error('url is required');
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'networkidle' });
      if (selector) {
        const el = await page.$(selector);
        return { text: el ? await el.innerText() : null, selector, url: page.url() };
      }
      const text = await page.evaluate(() => document.body.innerText);
      return { text, url: page.url(), length: text.length };
    }, args);
  }
  if (tool === 'playwright_get_html') {
    const { url, selector, outer = false } = args;
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      if (selector) {
        const el = await page.$(selector);
        if (!el) return { html: null, selector, found: false };
        const html = outer ? await el.evaluate(e => e.outerHTML) : await el.innerHTML();
        return { html, selector, found: true };
      }
      return { html: await page.content(), url: page.url() };
    }, args);
  }
  if (tool === 'playwright_extract_links') {
    const { url, base_url, filter_pattern } = args;
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'networkidle' });
      const links = await page.evaluate((base) => {
        return [...document.querySelectorAll('a[href]')].map(a => ({
          text: a.innerText.trim(),
          href: a.href,
          title: a.title || null
        })).filter(l => l.href && !l.href.startsWith('javascript:'));
      }, base_url || url);
      const filtered = filter_pattern ? links.filter(l => l.href.includes(filter_pattern)) : links;
      return { links: filtered, count: filtered.length, url: page.url() };
    }, args);
  }
  if (tool === 'playwright_extract_table') {
    const { url, selector = 'table', index = 0 } = args;
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'networkidle' });
      const data = await page.evaluate(({ sel, idx }) => {
        const tables = document.querySelectorAll(sel);
        const table = tables[idx];
        if (!table) return null;
        const headers = [...table.querySelectorAll('th')].map(th => th.innerText.trim());
        const rows = [...table.querySelectorAll('tr')].slice(headers.length ? 1 : 0).map(tr =>
          [...tr.querySelectorAll('td,th')].map(cell => cell.innerText.trim())
        ).filter(r => r.length);
        return { headers, rows, row_count: rows.length };
      }, { sel: selector, idx: index });
      return { table: data, selector, url: page.url() };
    }, args);
  }
  if (tool === 'playwright_evaluate') {
    const { url, script } = args;
    if (!script) throw new Error('script (JavaScript expression) is required');
    return await withPage(async (page) => {
      if (url) await page.goto(url, { waitUntil: 'domcontentloaded' });
      const result = await page.evaluate(new Function(`return (${script})()`));
      return { result };
    }, args);
  }

  // ── INTERACTION ───────────────────────────────────────────────────────────
  if (tool === 'playwright_click') {
    const { url, selector, text, timeout = 15000 } = args;
    if (!selector && !text) throw new Error('selector or text is required');
    return await withPage(async (page) => {
      if (url) await page.goto(url, { waitUntil: 'domcontentloaded' });
      if (text) {
        await page.getByText(text, { exact: false }).first().click({ timeout });
      } else {
        await page.click(selector, { timeout });
      }
      return { clicked: selector || text, url: page.url() };
    }, args);
  }
  if (tool === 'playwright_fill_form') {
    const { url, fields, submit_selector, wait_after_submit = 2000 } = args;
    if (!fields || typeof fields !== 'object') throw new Error('fields (object of selector→value) is required');
    return await withPage(async (page) => {
      if (url) await page.goto(url, { waitUntil: 'domcontentloaded' });
      for (const [selector, value] of Object.entries(fields)) {
        await page.fill(selector, String(value));
      }
      if (submit_selector) {
        await page.click(submit_selector);
        await page.waitForTimeout(wait_after_submit);
      }
      return { filled: Object.keys(fields).length, submitted: !!submit_selector, url: page.url() };
    }, args);
  }
  if (tool === 'playwright_type') {
    const { url, selector, text, delay = 50 } = args;
    return await withPage(async (page) => {
      if (url) await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.type(selector, text, { delay });
      return { typed: text.length, selector };
    }, args);
  }
  if (tool === 'playwright_select') {
    const { url, selector, value, label } = args;
    return await withPage(async (page) => {
      if (url) await page.goto(url, { waitUntil: 'domcontentloaded' });
      const selected = await page.selectOption(selector, value ? { value } : { label });
      return { selected, selector };
    }, args);
  }
  if (tool === 'playwright_hover') {
    const { url, selector } = args;
    return await withPage(async (page) => {
      if (url) await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.hover(selector);
      return { hovered: selector };
    }, args);
  }
  if (tool === 'playwright_press_key') {
    const { url, selector, key } = args;
    if (!key) throw new Error('key is required (e.g. Enter, Tab, Escape, ArrowDown)');
    return await withPage(async (page) => {
      if (url) await page.goto(url, { waitUntil: 'domcontentloaded' });
      if (selector) await page.focus(selector);
      await page.keyboard.press(key);
      return { pressed: key, selector };
    }, args);
  }
  if (tool === 'playwright_scroll') {
    const { url, direction = 'down', amount = 500 } = args;
    return await withPage(async (page) => {
      if (url) await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.evaluate(({ dir, amt }) => {
        window.scrollBy(dir === 'down' ? 0 : 0, dir === 'down' ? amt : -amt);
      }, { dir: direction, amt: amount });
      return { scrolled: direction, amount };
    }, args);
  }

  // ── WAITING ───────────────────────────────────────────────────────────────
  if (tool === 'playwright_wait_for_selector') {
    const { url, selector, state = 'visible', timeout = 15000 } = args;
    return await withPage(async (page) => {
      if (url) await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(selector, { state, timeout });
      return { selector, found: true, state };
    }, args);
  }
  if (tool === 'playwright_wait_for_navigation') {
    const { url, wait_until = 'networkidle', timeout = 30000 } = args;
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: wait_until, timeout });
      return { url: page.url(), title: await page.title() };
    }, args);
  }
  if (tool === 'playwright_wait_for_network_idle') {
    const { url, timeout = 30000 } = args;
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'networkidle', timeout });
      return { url: page.url(), title: await page.title(), network_idle: true };
    }, args);
  }

  // ── NETWORK & REQUESTS ────────────────────────────────────────────────────
  if (tool === 'playwright_intercept_requests') {
    const { url, filter_url_pattern } = args;
    return await withPage(async (page) => {
      const requests = [];
      page.on('request', req => {
        if (!filter_url_pattern || req.url().includes(filter_url_pattern)) {
          requests.push({ url: req.url(), method: req.method(), resource_type: req.resourceType() });
        }
      });
      await page.goto(url, { waitUntil: 'networkidle' });
      return { requests, count: requests.length };
    }, args);
  }
  if (tool === 'playwright_get_response_body') {
    const { url, target_url_pattern } = args;
    if (!target_url_pattern) throw new Error('target_url_pattern is required');
    return await withPage(async (page) => {
      let body = null;
      page.on('response', async res => {
        if (res.url().includes(target_url_pattern)) {
          try { body = await res.json(); } catch { body = await res.text().catch(() => null); }
        }
      });
      await page.goto(url, { waitUntil: 'networkidle' });
      return { body, matched_url: target_url_pattern };
    }, args);
  }
  if (tool === 'playwright_mock_route') {
    const { url, intercept_pattern, response_body, status = 200, content_type = 'application/json' } = args;
    return await withPage(async (page) => {
      await page.route(intercept_pattern, route => {
        route.fulfill({ status, contentType: content_type, body: typeof response_body === 'object' ? JSON.stringify(response_body) : String(response_body) });
      });
      await page.goto(url, { waitUntil: 'networkidle' });
      return { mocked: intercept_pattern, url: page.url() };
    }, args);
  }

  // ── COOKIES & STORAGE ─────────────────────────────────────────────────────
  if (tool === 'playwright_get_cookies') {
    const { url, filter_name } = args;
    return await withPage(async (page, context) => {
      if (url) await page.goto(url, { waitUntil: 'domcontentloaded' });
      const cookies = await context.cookies();
      const filtered = filter_name ? cookies.filter(c => c.name.includes(filter_name)) : cookies;
      return { cookies: filtered.map(c => ({ name: c.name, value: c.value, domain: c.domain, path: c.path })), count: filtered.length };
    }, args);
  }
  if (tool === 'playwright_get_local_storage') {
    const { url } = args;
    if (!url) throw new Error('url is required');
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const storage = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
      return { storage, keys: Object.keys(storage).length };
    }, args);
  }

  // ── ACCESSIBILITY ─────────────────────────────────────────────────────────
  if (tool === 'playwright_get_accessibility_snapshot') {
    const { url, selector } = args;
    return await withPage(async (page) => {
      if (url) await page.goto(url, { waitUntil: 'domcontentloaded' });
      const root = selector ? await page.$(selector) : undefined;
      const snapshot = await page.accessibility.snapshot({ root });
      return { snapshot };
    }, args);
  }
  if (tool === 'playwright_check_aria') {
    // Check ARIA roles and attributes on page
    const { url, selector = '[role]' } = args;
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const elements = await page.evaluate((sel) => {
        return [...document.querySelectorAll(sel)].slice(0, 50).map(el => ({
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role'),
          aria_label: el.getAttribute('aria-label'),
          aria_labelledby: el.getAttribute('aria-labelledby'),
          aria_describedby: el.getAttribute('aria-describedby'),
          tabindex: el.getAttribute('tabindex')
        }));
      }, selector);
      return { elements, count: elements.length };
    }, args);
  }

  // ── MULTI-STEP AUTOMATION ─────────────────────────────────────────────────
  if (tool === 'playwright_run_steps') {
    // Execute a sequence of actions on a page without closing between steps
    const { url, steps } = args;
    if (!url || !steps?.length) throw new Error('url and steps array are required');
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const results = [];
      for (const step of steps) {
        try {
          if (step.action === 'click') await page.click(step.selector);
          else if (step.action === 'fill') await page.fill(step.selector, step.value || '');
          else if (step.action === 'type') await page.type(step.selector, step.value || '');
          else if (step.action === 'wait') await page.waitForSelector(step.selector, { state: 'visible' });
          else if (step.action === 'goto') await page.goto(step.url, { waitUntil: 'domcontentloaded' });
          else if (step.action === 'press') await page.keyboard.press(step.key);
          else if (step.action === 'screenshot') await page.screenshot({ path: step.path, fullPage: step.full_page });
          results.push({ step: step.action, selector: step.selector, success: true });
        } catch (e) { results.push({ step: step.action, selector: step.selector, success: false, error: e.message }); if (step.abort_on_error) break; }
      }
      return { url: page.url(), title: await page.title(), steps: results, success_count: results.filter(r => r.success).length };
    }, args);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SUPER TOOLS
  // ══════════════════════════════════════════════════════════════════════════

  // SUPER: Full page scrape — text, links, title, meta in one call
  if (tool === 'playwright_scrape_page') {
    const { url, include_links = true, include_meta = true } = args;
    if (!url) throw new Error('url is required');
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'networkidle' });
      const [text, links, meta, title, currentUrl] = await Promise.all([
        page.evaluate(() => document.body.innerText),
        include_links ? page.evaluate(() => [...document.querySelectorAll('a[href]')].slice(0, 100).map(a => ({ text: a.innerText.trim().slice(0, 100), href: a.href })).filter(l => l.href)) : Promise.resolve([]),
        include_meta ? page.evaluate(() => { const m = {}; document.querySelectorAll('meta').forEach(el => { if (el.name) m[el.name] = el.content; }); return m; }) : Promise.resolve({}),
        page.title(),
        Promise.resolve(page.url())
      ]);
      return { url: currentUrl, title, text: text.slice(0, 10000), text_length: text.length, links: links.slice(0, 50), meta };
    }, args);
  }

  // SUPER: Take a screenshot + extract text + get links — visual + content in one call
  if (tool === 'playwright_capture_and_extract') {
    const { url, screenshot_path } = args;
    if (!url) throw new Error('url is required');
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'networkidle' });
      const result = { url: page.url(), title: await page.title() };
      if (screenshot_path) {
        await page.screenshot({ path: screenshot_path, fullPage: false });
        result.screenshot = screenshot_path;
      }
      result.text = (await page.evaluate(() => document.body.innerText)).slice(0, 5000);
      result.h1 = await page.$eval('h1', el => el.innerText).catch(() => null);
      result.h2s = await page.$$eval('h2', els => els.slice(0, 5).map(e => e.innerText)).catch(() => []);
      return result;
    }, args);
  }

  // SUPER: Test a form — navigate, fill, submit, capture result
  if (tool === 'playwright_test_form') {
    const { url, fields, submit_selector, success_selector, screenshot_path } = args;
    if (!url || !fields) throw new Error('url and fields are required');
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      for (const [selector, value] of Object.entries(fields)) {
        await page.fill(selector, String(value)).catch(() => page.type(selector, String(value)));
      }
      if (submit_selector) await page.click(submit_selector);
      await page.waitForTimeout(2000);
      const result = { url: page.url(), title: await page.title(), fields_filled: Object.keys(fields).length };
      if (success_selector) result.success = await page.$(success_selector).then(el => !!el).catch(() => false);
      if (screenshot_path) await page.screenshot({ path: screenshot_path });
      return result;
    }, args);
  }

  // SUPER: Monitor page changes — check if a selector appears/disappears within a timeout
  if (tool === 'playwright_monitor_element') {
    const { url, selector, expect_state = 'visible', timeout = 30000 } = args;
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      try {
        await page.waitForSelector(selector, { state: expect_state, timeout });
        return { selector, state: expect_state, found: true, url: page.url() };
      } catch {
        return { selector, state: expect_state, found: false, url: page.url(), timed_out: true };
      }
    }, { ...args, timeout: timeout + 5000 });
  }

  // SUPER: Check page for broken links
  if (tool === 'playwright_check_broken_links') {
    const { url, timeout_per_link = 8000 } = args;
    if (!url) throw new Error('url is required');
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'networkidle' });
      const links = await page.evaluate(() =>
        [...new Set([...document.querySelectorAll('a[href]')].map(a => a.href).filter(h => h.startsWith('http')))]
      );
      const results = await Promise.allSettled(
        links.slice(0, 50).map(async href => {
          try {
            const res = await fetch(href, { method: 'HEAD', signal: AbortSignal.timeout(timeout_per_link) });
            return { href, status: res.status, ok: res.ok };
          } catch (e) { return { href, error: e.message, ok: false }; }
        })
      );
      const checked = results.map(r => r.value || r.reason);
      return { url, total: checked.length, broken: checked.filter(r => !r.ok), ok: checked.filter(r => r.ok).length };
    }, args);
  }

  throw new Error(`Unknown Playwright tool: ${tool}`);

  // ── PERFORMANCE METRICS (Core Web Vitals) ─────────────────────────────────
  if (tool === 'playwright_get_performance_metrics') {
    const { url, timeout = 30000 } = args;
    if (!url) throw new Error('url is required');
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'networkidle', timeout });
      // Collect Performance API metrics
      const metrics = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const paint = Object.fromEntries(performance.getEntriesByType('paint').map(e => [e.name, Math.round(e.startTime)]));
        const lcp = performance.getEntriesByType('largest-contentful-paint');
        const cls = performance.getEntriesByType('layout-shift');
        return {
          ttfb: Math.round(nav?.responseStart - nav?.requestStart),
          fcp: paint['first-contentful-paint'],
          lcp: lcp.length ? Math.round(lcp[lcp.length - 1].startTime) : null,
          cls: cls.reduce((sum, e) => sum + (e.hadRecentInput ? 0 : e.value), 0).toFixed(4),
          dom_interactive: Math.round(nav?.domInteractive),
          dom_complete: Math.round(nav?.domComplete),
          load_event_end: Math.round(nav?.loadEventEnd),
          transfer_size_bytes: nav?.transferSize,
          decoded_body_size: nav?.decodedBodySize
        };
      });
      const vitals = {
        lcp_rating: metrics.lcp < 2500 ? 'good' : metrics.lcp < 4000 ? 'needs improvement' : 'poor',
        fcp_rating: metrics.fcp < 1800 ? 'good' : metrics.fcp < 3000 ? 'needs improvement' : 'poor',
        cls_rating: parseFloat(metrics.cls) < 0.1 ? 'good' : parseFloat(metrics.cls) < 0.25 ? 'needs improvement' : 'poor',
        ttfb_rating: metrics.ttfb < 800 ? 'good' : metrics.ttfb < 1800 ? 'needs improvement' : 'poor'
      };
      return { url, metrics, ratings: vitals };
    }, { timeout });
  }

  if (tool === 'playwright_get_resource_timing') {
    const { url, timeout = 30000, resource_type } = args;
    if (!url) throw new Error('url is required');
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'networkidle', timeout });
      const resources = await page.evaluate((filterType) => {
        return performance.getEntriesByType('resource')
          .filter(r => !filterType || r.initiatorType === filterType)
          .map(r => ({
            name: r.name,
            type: r.initiatorType,
            duration_ms: Math.round(r.duration),
            size_bytes: r.transferSize,
            start_time_ms: Math.round(r.startTime)
          }))
          .sort((a, b) => b.duration_ms - a.duration_ms)
          .slice(0, 20);
      }, resource_type || null);
      return { url, resource_count: resources.length, slowest_resources: resources };
    }, { timeout });
  }

  // ── VIDEO RECORDING ────────────────────────────────────────────────────────
  if (tool === 'playwright_record_video') {
    const { url, output_path, duration_ms = 5000, viewport_width = 1280, viewport_height = 720, timeout = 30000 } = args;
    if (!url || !output_path) throw new Error('url and output_path are required');
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: viewport_width, height: viewport_height },
      recordVideo: { dir: output_path.replace(/\/[^/]+$/, '') || '/tmp', size: { width: viewport_width, height: viewport_height } }
    });
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout });
      await page.waitForTimeout(duration_ms);
      const videoPath = await page.video()?.path();
      await context.close();
      await browser.close();
      return { success: true, url, video_path: videoPath, duration_ms };
    } catch (err) {
      await browser.close();
      throw err;
    }
  }

  // ── HAR CAPTURE ───────────────────────────────────────────────────────────
  if (tool === 'playwright_capture_har') {
    const { url, output_path, timeout = 30000 } = args;
    if (!url || !output_path) throw new Error('url and output_path are required');
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ recordHar: { path: output_path } });
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout });
      await context.close();
      await browser.close();
      return { success: true, url, har_path: output_path };
    } catch (err) {
      await browser.close();
      throw err;
    }
  }

  // ── LOCATOR-BASED INTERACTIONS ────────────────────────────────────────────
  if (tool === 'playwright_click_by_text') {
    const { url, text, exact = false, timeout = 30000 } = args;
    if (!url || !text) throw new Error('url and text are required');
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      await page.getByText(text, { exact }).first().click({ timeout });
      return { success: true, url, clicked_text: text };
    }, { timeout });
  }
  if (tool === 'playwright_click_by_role') {
    const { url, role, name, timeout = 30000 } = args;
    if (!url || !role) throw new Error('url and role are required');
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      await page.getByRole(role, name ? { name } : {}).first().click({ timeout });
      return { success: true, url, role, name };
    }, { timeout });
  }
  if (tool === 'playwright_fill_by_label') {
    const { url, label, value, timeout = 30000 } = args;
    if (!url || !label || value === undefined) throw new Error('url, label, and value are required');
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      await page.getByLabel(label).fill(String(value), { timeout });
      return { success: true, url, label, value };
    }, { timeout });
  }
  if (tool === 'playwright_get_by_test_id') {
    const { url, test_id, timeout = 30000 } = args;
    if (!url || !test_id) throw new Error('url and test_id are required');
    return await withPage(async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      const el = page.getByTestId(test_id).first();
      await el.waitFor({ timeout });
      const text = await el.textContent();
      const isVisible = await el.isVisible();
      return { success: true, test_id, text: text?.trim(), is_visible: isVisible };
    }, { timeout });
  }

  // ── MULTI-PAGE / TABS ─────────────────────────────────────────────────────
  if (tool === 'playwright_open_multiple_tabs') {
    const { urls, timeout = 30000 } = args;
    if (!urls?.length) throw new Error('urls array is required');
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const results = [];
    try {
      for (const url of urls) {
        const page = await context.newPage();
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
          const title = await page.title();
          results.push({ url, title, status: 'ok' });
        } catch (e) {
          results.push({ url, status: 'error', error: e.message });
        }
      }
    } finally {
      await browser.close();
    }
    return { tabs_opened: results.length, results };
  }

  // ── NETWORK INTERCEPTION ADVANCED ─────────────────────────────────────────
  if (tool === 'playwright_block_resources') {
    const { url, block_types = ['image', 'stylesheet', 'font'], timeout = 30000 } = args;
    if (!url) throw new Error('url is required');
    return await withPage(async (page) => {
      await page.route('**/*', route => {
        if (block_types.includes(route.request().resourceType())) {
          route.abort();
        } else {
          route.continue();
        }
      });
      const startTime = Date.now();
      await page.goto(url, { waitUntil: 'networkidle', timeout });
      const loadTime = Date.now() - startTime;
      const title = await page.title();
      return { url, title, load_time_ms: loadTime, blocked_types: block_types };
    }, { timeout });
  }
  if (tool === 'playwright_capture_network_requests') {
    const { url, timeout = 30000, filter_url_pattern } = args;
    if (!url) throw new Error('url is required');
    return await withPage(async (page, context) => {
      const requests = [];
      page.on('request', req => {
        if (!filter_url_pattern || req.url().includes(filter_url_pattern)) {
          requests.push({ url: req.url(), method: req.method(), type: req.resourceType() });
        }
      });
      const responses = [];
      page.on('response', res => {
        if (!filter_url_pattern || res.url().includes(filter_url_pattern)) {
          responses.push({ url: res.url(), status: res.status(), ok: res.ok() });
        }
      });
      await page.goto(url, { waitUntil: 'networkidle', timeout });
      return { url, request_count: requests.length, requests: requests.slice(0, 50), failed_responses: responses.filter(r => !r.ok) };
    }, { timeout });
  }

  // ── SUPER TOOL: Full page audit ────────────────────────────────────────────
  if (tool === 'playwright_page_audit') {
    const { url, timeout = 45000 } = args;
    if (!url) throw new Error('url is required');
    return await withPage(async (page) => {
      const consoleLogs = [];
      const networkErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleLogs.push(msg.text()); });
      page.on('response', res => { if (!res.ok() && res.status() !== 304) networkErrors.push({ url: res.url(), status: res.status() }); });
      await page.goto(url, { waitUntil: 'networkidle', timeout });
      const [title, metrics, links, accessibility] = await Promise.all([
        page.title(),
        page.evaluate(() => {
          const nav = performance.getEntriesByType('navigation')[0];
          const paint = Object.fromEntries(performance.getEntriesByType('paint').map(e => [e.name, Math.round(e.startTime)]));
          return { fcp: paint['first-contentful-paint'], load_ms: Math.round(nav?.loadEventEnd), ttfb: Math.round(nav?.responseStart - nav?.requestStart) };
        }),
        page.evaluate(() => {
          const hrefs = Array.from(document.querySelectorAll('a[href]')).map(a => a.href);
          return { total: hrefs.length, internal: hrefs.filter(h => h.includes(window.location.hostname)).length, external: hrefs.filter(h => !h.includes(window.location.hostname)).length };
        }),
        page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll('img'));
          return { images_missing_alt: imgs.filter(i => !i.alt).length, total_images: imgs.length, has_h1: !!document.querySelector('h1'), has_meta_description: !!document.querySelector('meta[name="description"]') };
        })
      ]);
      return {
        url, title,
        performance: metrics,
        links,
        seo: accessibility,
        issues: { console_errors: consoleLogs.slice(0, 10), network_errors: networkErrors.slice(0, 10) },
        generated_at: new Date().toISOString()
      };
    }, { timeout });
  }

  // ── SUPER TOOL: Visual regression screenshot comparison ────────────────────
  if (tool === 'playwright_compare_pages') {
    const { url_a, url_b, timeout = 30000 } = args;
    if (!url_a || !url_b) throw new Error('url_a and url_b are required');
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const results = {};
    try {
      for (const [key, url] of [['a', url_a], ['b', url_b]]) {
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'networkidle', timeout });
        const title = await page.title();
        const metrics = await page.evaluate(() => {
          const nav = performance.getEntriesByType('navigation')[0];
          return { load_ms: Math.round(nav?.loadEventEnd), elements: document.querySelectorAll('*').length };
        });
        results[key] = { url, title, ...metrics };
        await page.close();
      }
    } finally {
      await browser.close();
    }
    return {
      page_a: results.a,
      page_b: results.b,
      diff: {
        load_ms_diff: results.b?.load_ms - results.a?.load_ms,
        element_count_diff: results.b?.elements - results.a?.elements,
        title_changed: results.a?.title !== results.b?.title
      }
    };
  }

  throw new Error(`Unknown Playwright tool: ${tool}`);
}

export default { execute };
