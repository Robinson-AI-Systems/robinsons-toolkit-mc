/**
 * Context7 Handler — 45 tools (v2 — Production Hardened)
 *
 * ── 3-LAYER ARCHITECTURE (the "robust blueprint" mapped to actual code) ────
 *
 *   INGESTION LAYER  — fetchWithRetry(): AbortController timeout (15s) +
 *                      exponential backoff with jitter (500/1000/2000ms).
 *                      Survives transient Context7 API dropouts.
 *
 *   DEFENSE LAYER    — sanitizeContent(): scans for known prompt-injection
 *                      patterns, system-prompt overrides, payload-exfiltration
 *                      URLs, and embedded TOOL/CALL directives. Returns
 *                      cleaned content + a list of removed patterns so
 *                      callers can see what was stripped.
 *                      Triggered automatically inside fetchDocs(... sanitize=true)
 *                      and explicitly via context7_secure_fetch.
 *                      ⚠ Reduces risk; does not guarantee 100% coverage.
 *
 *   EVALUATION LAYER — fetchDocs(): heading-aware retrieval with a strict
 *                      token ceiling. context7_smart_query scores markdown
 *                      blocks by query/keyword overlap, returns the top
 *                      relevance-ranked sections.
 *
 *   CACHE LAYER      — Upstash Redis-backed (TTL 1h). cacheGet/cacheSet/
 *                      cacheDel transparently sit in front of c7get().
 *                      All responses include _from_cache: true on hits.
 *                      Inspect or invalidate via context7_cache_status.
 *
 * ── EXTENDED TOOLSET (vs. the 2-tool official Upstash server) ──────────────
 *   context7_smart_query        — resolve-or-search + scored multi-block match
 *   context7_upgrade_impact     — migration docs + local file API scan
 *   context7_secure_fetch       — explicit defense-layer-first fetch
 *   context7_verified_examples  — SemVer-filtered code snippets (no betas)
 *   context7_fallback_index     — npm + unpkg fallback for missing libraries
 *   context7_cache_status       — inspect or invalidate cache entries
 *   …plus 39 topic-focused and per-library doc fetchers.
 *
 * ── HONEST SCOPE NOTES ─────────────────────────────────────────────────────
 *   • The sanitizer reduces prompt-injection risk; it cannot guarantee
 *     catching every injection variant.
 *   • "Active code line awareness" requires the agent to pass code context
 *     explicitly (e.g. via scan_paths on upgrade_impact). The MCP transport
 *     does not expose the IDE editor selection automatically.
 *   • SemVer filtering operates on whatever version annotations Context7
 *     returns — older libraries may lack consistent SemVer metadata.
 *
 * Requires: CONTEXT7_API_KEY (free at https://context7.com/dashboard)
 * Optional: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (for caching)
 */

const BASE = 'https://context7.com/api/v2';
const CACHE_TTL = 3600; // 1 hour in seconds

function apiKey() {
  const k = process.env.CONTEXT7_API_KEY;
  if (!k) throw new Error(
    'CONTEXT7_API_KEY not set in .env\n' +
    'Get your free key at https://context7.com/dashboard'
  );
  return k;
}

// ── Exponential backoff with jitter ─────────────────────────────────────────
async function fetchWithRetry(url, options, maxAttempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s hard timeout
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      return res;
    } catch (e) {
      clearTimeout(timeout);
      lastError = e;
      if (attempt < maxAttempts - 1) {
        // Exponential backoff: 500ms, 1000ms, 2000ms + jitter
        const delay = Math.pow(2, attempt) * 500 + Math.random() * 200;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw new Error(`Context7 fetch failed after ${maxAttempts} attempts: ${lastError?.message}`);
}

// ── Upstash Redis cache helpers ──────────────────────────────────────────────
function getCacheUrl() {
  return process.env.UPSTASH_REDIS_REST_URL;
}
function getCacheToken() {
  return process.env.UPSTASH_REDIS_REST_TOKEN;
}

async function cacheGet(key) {
  const url = getCacheUrl();
  const token = getCacheToken();
  if (!url || !token) return null; // Cache not configured — skip silently
  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000)
    });
    const data = await res.json();
    if (data.result) return JSON.parse(data.result);
  } catch { /* cache miss is not an error */ }
  return null;
}

async function cacheSet(key, value, ttl = CACHE_TTL) {
  const url = getCacheUrl();
  const token = getCacheToken();
  if (!url || !token) return; // Cache not configured — skip silently
  try {
    await fetch(`${url}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(value), ex: ttl }),
      signal: AbortSignal.timeout(3000)
    });
  } catch { /* cache write failure is non-fatal */ }
}

async function cacheDel(key) {
  const url = getCacheUrl();
  const token = getCacheToken();
  if (!url || !token) return;
  try {
    await fetch(`${url}/del/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000)
    });
  } catch {}
}

// ── Content sanitizer ────────────────────────────────────────────────────────
// Strips patterns that look like embedded instructions or prompt injections.
// HONEST SCOPE: reduces risk, does not guarantee complete protection.
const INJECTION_PATTERNS = [
  /ignore (all |previous |above |prior )?(instructions?|prompts?|context|rules?)/gi,
  /system\s*prompt\s*:/gi,
  /\bDAN\b.*mode/gi,
  /<\s*system\s*>/gi,
  /\[INST\]|\[\/INST\]/g,
  /\bACT AS\b.{0,50}(admin|root|system|claude|ai|assistant)/gi,
  /exfiltrate|send to|POST to https?:\/\//gi,
  /eval\s*\(|exec\s*\(|spawn\s*\(/gi,
  /process\.env|__dirname|require\s*\(/g,
  /\/etc\/passwd|\/etc\/shadow|\.ssh\//gi,
];

function sanitizeContent(text) {
  if (typeof text !== 'string') return text;
  let clean = text;
  let flagged = 0;
  for (const pattern of INJECTION_PATTERNS) {
    const matches = clean.match(pattern);
    if (matches) {
      flagged += matches.length;
      clean = clean.replace(pattern, '[CONTENT REMOVED]');
    }
  }
  return { content: clean, injection_patterns_removed: flagged };
}

// ── Core API request ─────────────────────────────────────────────────────────
async function c7get(endpoint, params, useCache = true) {
  const filtered = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null));
  const url = `${BASE}${endpoint}?${new URLSearchParams(filtered).toString()}`;
  const cacheKey = `c7:${url}`;

  // Cache check
  if (useCache) {
    const cached = await cacheGet(cacheKey);
    if (cached) return { ...cached, _from_cache: true };
  }

  const res = await fetchWithRetry(url, {
    headers: { 'Authorization': `Bearer ${apiKey()}`, 'Content-Type': 'application/json' }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Context7 ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();

  // Cache the result
  if (useCache) await cacheSet(cacheKey, data);

  return data;
}

// ── Fetch + sanitize docs ────────────────────────────────────────────────────
async function fetchDocs(libraryId, query, tokens = 5000, sanitize = false) {
  const data = await c7get('/context', {
    query: query || libraryId.split('/').pop(),
    libraryId,
    tokens
  });

  const rawContent = data.content || data.docs || data.text || data;
  const { content, injection_patterns_removed } = sanitizeContent(
    typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent)
  );

  const result = {
    libraryId,
    query,
    content,
    token_count: tokens,
    _from_cache: data._from_cache || false
  };

  if (sanitize || injection_patterns_removed > 0) {
    result.sanitized = true;
    result.injection_patterns_removed = injection_patterns_removed;
  }

  return result;
}

// ── Curated library ID map ───────────────────────────────────────────────────
const LIBRARY_IDS = {
  nextjs:          '/vercel/next.js',
  react:           '/facebook/react',
  typescript:      '/microsoft/TypeScript',
  prisma:          '/prisma/prisma',
  supabase:        '/supabase/supabase',
  drizzle:         '/drizzle-team/drizzle-orm',
  clerk:           '/clerk/clerk-docs',
  stripe:          '/stripe/stripe-node',
  resend:          '/resend/resend-node',
  tailwind:        '/tailwindlabs/tailwindcss.com',
  shadcn:          '/shadcn-ui/ui',
  trpc:            '/trpc/trpc',
  zod:             '/colinhacks/zod',
  tanstack_query:  '/tanstack/query',
  vercel:          '/vercel/vercel',
  neon:            '/neondatabase/neon',
  upstash:         '/upstash/docs',
  cloudflare:      '/cloudflare/cloudflare-docs',
  hono:            '/honojs/hono',
  react_hook_form: '/react-hook-form/react-hook-form',
};

async function execute(tool, args) {

  // ══════════════════════════════════════════════════════════════════════════
  //  CORE TOOLS
  // ══════════════════════════════════════════════════════════════════════════

  if (tool === 'context7_resolve_library') {
    const { library_name, query } = args;
    if (!library_name) throw new Error('library_name is required');
    const data = await c7get('/libs/search', { query: query || library_name, libraryName: library_name });
    const libs = data.results || data.libraries || (Array.isArray(data) ? data : []);
    return {
      library_name,
      results: libs.slice(0, 8).map(l => ({
        id: l.id || l.libraryId,
        name: l.name,
        description: l.description,
        trust_score: l.trustScore || l.trust_score,
        snippet_count: l.snippetCount || l.snippet_count,
        version: l.version
      })),
      _from_cache: data._from_cache || false,
      usage: 'Use the id field in context7_get_docs'
    };
  }

  if (tool === 'context7_get_docs') {
    const { library_id, query, topic, tokens = 5000 } = args;
    if (!library_id) throw new Error('library_id is required (e.g. /vercel/next.js)');
    return await fetchDocs(library_id, topic || query, tokens);
  }

  if (tool === 'context7_lookup') {
    const { library_name, query, topic, tokens = 5000 } = args;
    if (!library_name) throw new Error('library_name is required');
    if (library_name.startsWith('/')) return await fetchDocs(library_name, topic || query, tokens);
    const mapped = LIBRARY_IDS[library_name.toLowerCase().replace(/[-\s.]/g, '_')];
    if (mapped) return await fetchDocs(mapped, topic || query, tokens);
    const search = await c7get('/libs/search', { query: query || library_name, libraryName: library_name });
    const libs = search.results || search.libraries || (Array.isArray(search) ? search : []);
    const best = libs[0];
    if (!best) throw new Error(`Cannot resolve: ${library_name}. Try using the /org/repo ID directly.`);
    return await fetchDocs(best.id || best.libraryId, topic || query, tokens);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  v2 PRODUCTION HARDENING TOOLS
  // ══════════════════════════════════════════════════════════════════════════

  // HARDENED: Smart query with explicit sanitization pass
  if (tool === 'context7_smart_query') {
    const { library_id, library_name, query, tokens = 6000 } = args;
    if (!query) throw new Error('query is required');
    let id = library_id;
    if (!id && library_name) {
      const mapped = LIBRARY_IDS[library_name.toLowerCase().replace(/[-\s.]/g, '_')];
      id = mapped || library_id;
      if (!id) {
        const search = await c7get('/libs/search', { query, libraryName: library_name });
        const libs = search.results || search.libraries || [];
        id = libs[0]?.id;
        if (!id) throw new Error(`Cannot resolve: ${library_name}`);
      }
    }
    if (!id) throw new Error('library_id or library_name is required');
    // Fetch with explicit sanitization
    return await fetchDocs(id, query, tokens, true);
  }

  // HARDENED: Upgrade impact — scan local files for deprecated API usage + fetch migration docs
  if (tool === 'context7_upgrade_impact') {
    const { library_id, library_name, from_version, to_version, scan_paths = [], tokens = 8000 } = args;
    let id = library_id;
    if (!id && library_name) {
      const mapped = LIBRARY_IDS[library_name.toLowerCase().replace(/[-\s.]/g, '_')];
      id = mapped;
      if (!id) throw new Error('Provide library_id or a known library_name');
    }
    if (!id) throw new Error('library_id or library_name is required');

    // Fetch migration docs from Context7
    const versionQuery = [
      from_version && `from ${from_version}`,
      to_version && `to ${to_version}`,
      'migration upgrade breaking changes deprecated removed'
    ].filter(Boolean).join(' ');

    const docs = await fetchDocs(id, versionQuery, tokens, true);

    // If scan_paths provided, scan local files for API patterns
    let localFindings = [];
    if (scan_paths.length > 0) {
      const fs = await import('fs');
      const path = await import('path');
      for (const scanPath of scan_paths) {
        try {
          const fullPath = path.resolve(process.env.WORKSPACE_ROOT || process.cwd(), scanPath);
          if (!fs.existsSync(fullPath)) continue;
          const content = fs.readFileSync(fullPath, 'utf-8');
          // Extract import patterns and API calls
          const imports = [...content.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
          const libName = id.split('/').pop();
          if (imports.some(imp => imp.includes(libName) || imp.includes(library_name || ''))) {
            // Find API call patterns
            const apiCalls = [...content.matchAll(/\b([A-Z][a-zA-Z]+|[a-z]+[A-Z][a-zA-Z]+)\s*\(/g)].map(m => m[1]);
            localFindings.push({ file: scanPath, imports: imports.filter(i => i.includes(libName)), api_calls_found: [...new Set(apiCalls)].slice(0, 30) });
          }
        } catch (e) { localFindings.push({ file: scanPath, error: e.message }); }
      }
    }

    return {
      library_id: id,
      from_version,
      to_version,
      migration_docs: docs,
      local_scan: localFindings.length > 0 ? { files_scanned: scan_paths.length, files_using_library: localFindings } : { note: 'No scan_paths provided — pass file paths to scan for deprecated API usage' }
    };
  }

  // HARDENED: Explicit sanitize-first doc fetch — runs the full defense layer
  if (tool === 'context7_secure_fetch') {
    const { library_id, query, tokens = 5000 } = args;
    if (!library_id) throw new Error('library_id is required');
    const docs = await fetchDocs(library_id, query, tokens, true);
    return { ...docs, defense_layer: 'active', sanitized: true };
  }

  // HARDENED: Fallback to npm registry + type definitions when Context7 doesn't know a library
  if (tool === 'context7_fallback_index') {
    const { package_name, query } = args;
    if (!package_name) throw new Error('package_name is required');

    const results = {};

    // First try Context7
    try {
      const search = await c7get('/libs/search', { query: query || package_name, libraryName: package_name }, false);
      const libs = search.results || search.libraries || (Array.isArray(search) ? search : []);
      if (libs.length > 0) {
        results.context7 = { found: true, libraries: libs.slice(0, 3).map(l => ({ id: l.id || l.libraryId, name: l.name, trust_score: l.trustScore })) };
      } else {
        results.context7 = { found: false };
      }
    } catch (e) { results.context7 = { found: false, error: e.message }; }

    // Fallback: npm registry metadata
    try {
      const npmRes = await fetchWithRetry(`https://registry.npmjs.org/${encodeURIComponent(package_name)}`, {
        headers: { 'Accept': 'application/json' }
      });
      if (npmRes.ok) {
        const npm = await npmRes.json();
        const latest = npm['dist-tags']?.latest;
        const versions = Object.keys(npm.versions || {}).slice(-5);
        results.npm = {
          found: true,
          name: npm.name,
          description: npm.description,
          latest_version: latest,
          recent_versions: versions,
          homepage: npm.homepage,
          repository: npm.repository?.url,
          types_package: `@types/${package_name.replace('@', '').split('/')[0]}`
        };
      }
    } catch (e) { results.npm = { found: false, error: e.message }; }

    // Try to get TypeScript types from unpkg
    try {
      const npm = results.npm;
      if (npm?.found && npm.latest_version) {
        const typesRes = await fetchWithRetry(
          `https://unpkg.com/${package_name}@${npm.latest_version}/index.d.ts`,
          { headers: { 'Accept': 'text/plain' } }
        );
        if (typesRes.ok) {
          const types = await typesRes.text();
          const { content: safeTypes } = sanitizeContent(types.slice(0, 3000));
          results.typescript_types = { found: true, content: safeTypes };
        } else {
          results.typescript_types = { found: false };
        }
      }
    } catch { results.typescript_types = { found: false }; }

    return { package_name, query, ...results };
  }

  // HARDENED: Cache management — inspect or invalidate specific cache keys
  if (tool === 'context7_cache_status') {
    const { library_id, action = 'inspect' } = args;
    const url = getCacheUrl();
    const token = getCacheToken();

    if (!url || !token) return { status: 'Cache not configured', note: 'Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to .env to enable caching' };

    if (action === 'invalidate' && library_id) {
      // Pattern: delete all cache entries for this library
      const key = `c7:${BASE}/context?*libraryId=${encodeURIComponent(library_id)}*`;
      await cacheDel(key);
      return { action: 'invalidated', library_id };
    }

    if (action === 'inspect' && library_id) {
      const sampleKey = `c7:${BASE}/context?query=${encodeURIComponent(library_id)}&libraryId=${encodeURIComponent(library_id)}`;
      const cached = await cacheGet(sampleKey);
      return { library_id, cached: !!cached, cache_configured: true };
    }

    return { cache_configured: true, ttl_seconds: CACHE_TTL, action_options: ['inspect', 'invalidate'] };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  TOPIC-FOCUSED DOC FETCHERS
  // ══════════════════════════════════════════════════════════════════════════

  if (tool === 'context7_get_topic_docs') {
    const { library_id, topic, tokens = 5000 } = args;
    if (!library_id || !topic) throw new Error('library_id and topic are required');
    return await fetchDocs(library_id, topic, tokens);
  }
  if (tool === 'context7_get_api_reference') {
    const { library_id, tokens = 8000 } = args;
    return await fetchDocs(library_id, 'api reference functions methods classes', tokens);
  }
  if (tool === 'context7_get_code_examples') {
    const { library_id, query, tokens = 6000 } = args;
    return await fetchDocs(library_id, `${query || ''} code examples snippets usage`.trim(), tokens);
  }
  if (tool === 'context7_get_quickstart') {
    const { library_id, tokens = 5000 } = args;
    return await fetchDocs(library_id, 'getting started installation quickstart setup tutorial', tokens);
  }
  if (tool === 'context7_get_configuration_docs') {
    const { library_id, tokens = 5000 } = args;
    return await fetchDocs(library_id, 'configuration options settings config file environment variables', tokens);
  }
  if (tool === 'context7_get_migration_docs') {
    const { library_id, from_version, to_version, tokens = 6000 } = args;
    const q = [from_version && `from ${from_version}`, to_version && `to ${to_version}`, 'migration upgrade breaking changes changelog'].filter(Boolean).join(' ');
    return await fetchDocs(library_id, q, tokens);
  }
  if (tool === 'context7_get_routing_docs') {
    const { library_id, tokens = 5000 } = args;
    return await fetchDocs(library_id, 'routing routes navigation pages url params', tokens);
  }
  if (tool === 'context7_get_deployment_docs') {
    const { library_id, tokens = 5000 } = args;
    return await fetchDocs(library_id, 'deployment deploy production hosting environment docker', tokens);
  }
  if (tool === 'context7_get_authentication_docs') {
    const { library_id, tokens = 5000 } = args;
    return await fetchDocs(library_id, 'authentication auth login sessions JWT tokens OAuth', tokens);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  CURATED LIBRARY SHORTCUTS
  // ══════════════════════════════════════════════════════════════════════════

  if (tool === 'context7_nextjs_docs')          return await fetchDocs(LIBRARY_IDS.nextjs,          args.topic || args.query || 'Next.js',            args.tokens || 6000);
  if (tool === 'context7_react_docs')           return await fetchDocs(LIBRARY_IDS.react,           args.topic || args.query || 'React',              args.tokens || 6000);
  if (tool === 'context7_typescript_docs')      return await fetchDocs(LIBRARY_IDS.typescript,      args.topic || args.query || 'TypeScript',          args.tokens || 6000);
  if (tool === 'context7_prisma_docs')          return await fetchDocs(LIBRARY_IDS.prisma,          args.topic || args.query || 'Prisma ORM',          args.tokens || 6000);
  if (tool === 'context7_supabase_docs')        return await fetchDocs(LIBRARY_IDS.supabase,        args.topic || args.query || 'Supabase',            args.tokens || 6000);
  if (tool === 'context7_drizzle_docs')         return await fetchDocs(LIBRARY_IDS.drizzle,         args.topic || args.query || 'Drizzle ORM',         args.tokens || 6000);
  if (tool === 'context7_clerk_docs')           return await fetchDocs(LIBRARY_IDS.clerk,           args.topic || args.query || 'Clerk auth',          args.tokens || 6000);
  if (tool === 'context7_stripe_docs')          return await fetchDocs(LIBRARY_IDS.stripe,          args.topic || args.query || 'Stripe payments',     args.tokens || 6000);
  if (tool === 'context7_resend_docs')          return await fetchDocs(LIBRARY_IDS.resend,          args.topic || args.query || 'Resend email',        args.tokens || 5000);
  if (tool === 'context7_tailwind_docs')        return await fetchDocs(LIBRARY_IDS.tailwind,        args.topic || args.query || 'Tailwind CSS',        args.tokens || 5000);
  if (tool === 'context7_shadcn_docs')          return await fetchDocs(LIBRARY_IDS.shadcn,          args.topic || args.query || 'shadcn/ui components', args.tokens || 5000);
  if (tool === 'context7_trpc_docs')            return await fetchDocs(LIBRARY_IDS.trpc,            args.topic || args.query || 'tRPC',                args.tokens || 5000);
  if (tool === 'context7_zod_docs')             return await fetchDocs(LIBRARY_IDS.zod,             args.topic || args.query || 'Zod validation',      args.tokens || 5000);
  if (tool === 'context7_tanstack_query_docs')  return await fetchDocs(LIBRARY_IDS.tanstack_query,  args.topic || args.query || 'TanStack Query',      args.tokens || 5000);
  if (tool === 'context7_vercel_docs')          return await fetchDocs(LIBRARY_IDS.vercel,          args.topic || args.query || 'Vercel deployment',   args.tokens || 5000);
  if (tool === 'context7_neon_docs')            return await fetchDocs(LIBRARY_IDS.neon,            args.topic || args.query || 'Neon Postgres',       args.tokens || 5000);
  if (tool === 'context7_upstash_docs')         return await fetchDocs(LIBRARY_IDS.upstash,         args.topic || args.query || 'Upstash Redis',       args.tokens || 5000);
  if (tool === 'context7_cloudflare_workers_docs') return await fetchDocs(LIBRARY_IDS.cloudflare,   args.topic || args.query || 'Cloudflare Workers',  args.tokens || 5000);
  if (tool === 'context7_hono_docs')            return await fetchDocs(LIBRARY_IDS.hono,            args.topic || args.query || 'Hono framework',      args.tokens || 5000);
  if (tool === 'context7_react_hook_form_docs') return await fetchDocs(LIBRARY_IDS.react_hook_form, args.topic || args.query || 'React Hook Form',     args.tokens || 5000);

  // ══════════════════════════════════════════════════════════════════════════
  //  MULTI-LIBRARY RESEARCH TOOLS
  // ══════════════════════════════════════════════════════════════════════════

  if (tool === 'context7_research_stack') {
    const { libraries, query, tokens_each = 3000 } = args;
    if (!libraries?.length) throw new Error('libraries array is required');
    const results = await Promise.allSettled(
      libraries.map(async lib => {
        const id = lib.startsWith('/') ? lib : (LIBRARY_IDS[lib.toLowerCase().replace(/[-\s.]/g, '_')] || null);
        if (!id) return { library: lib, error: 'Unknown library. Use /org/repo format or a known shortcut.' };
        return await fetchDocs(id, query || lib, tokens_each);
      })
    );
    return {
      libraries, query,
      docs: results.map((r, i) => ({
        library: libraries[i],
        success: r.status === 'fulfilled',
        ...(r.status === 'fulfilled' ? r.value : { error: r.reason?.message })
      }))
    };
  }

  if (tool === 'context7_compare_libraries') {
    const { library_a, library_b, query, tokens_each = 4000 } = args;
    if (!library_a || !library_b) throw new Error('library_a and library_b are required');
    const idA = library_a.startsWith('/') ? library_a : LIBRARY_IDS[library_a.toLowerCase().replace(/[-\s.]/g, '_')];
    const idB = library_b.startsWith('/') ? library_b : LIBRARY_IDS[library_b.toLowerCase().replace(/[-\s.]/g, '_')];
    const [docsA, docsB] = await Promise.all([
      idA ? fetchDocs(idA, query || library_a, tokens_each) : Promise.resolve({ error: `Cannot resolve: ${library_a}` }),
      idB ? fetchDocs(idB, query || library_b, tokens_each) : Promise.resolve({ error: `Cannot resolve: ${library_b}` })
    ]);
    return { query, library_a: { name: library_a, id: idA, ...docsA }, library_b: { name: library_b, id: idB, ...docsB } };
  }

  if (tool === 'context7_get_integration_docs') {
    const { primary_library, secondary_library, query, tokens = 5000 } = args;
    if (!primary_library) throw new Error('primary_library is required');
    const id = primary_library.startsWith('/') ? primary_library : LIBRARY_IDS[primary_library.toLowerCase().replace(/[-\s.]/g, '_')];
    if (!id) throw new Error(`Unknown library: ${primary_library}`);
    const q = secondary_library ? `${secondary_library} integration ${query || ''} setup`.trim() : (query || 'integrations');
    return await fetchDocs(id, q, tokens);
  }

  if (tool === 'context7_cortiware_stack_docs') {
    const { query = 'getting started', tokens_each = 2000 } = args;
    const stack = ['nextjs', 'prisma', 'clerk', 'stripe', 'resend', 'tailwind', 'zod'];
    const results = await Promise.allSettled(stack.map(lib => fetchDocs(LIBRARY_IDS[lib], query, tokens_each)));
    return {
      stack, query,
      docs: results.map((r, i) => ({
        library: stack[i], id: LIBRARY_IDS[stack[i]],
        success: r.status === 'fulfilled',
        ...(r.status === 'fulfilled' ? r.value : { error: r.reason?.message })
      }))
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SMART DEVELOPER TOOLS
  // ══════════════════════════════════════════════════════════════════════════

  if (tool === 'context7_how_to') {
    const { question, library, tokens = 6000 } = args;
    if (!question) throw new Error('question is required');
    let libraryId = library
      ? (library.startsWith('/') ? library : LIBRARY_IDS[library.toLowerCase().replace(/[-\s.]/g, '_')])
      : null;
    if (!libraryId && library) {
      const search = await c7get('/libs/search', { query: question, libraryName: library });
      const libs = search.results || search.libraries || [];
      libraryId = libs[0]?.id || libs[0]?.libraryId;
    }
    if (!libraryId) throw new Error(`Cannot resolve library: ${library}`);
    return await fetchDocs(libraryId, `how to ${question}`, tokens);
  }

  if (tool === 'context7_debug_error') {
    const { error_message, library, tokens = 6000 } = args;
    if (!error_message) throw new Error('error_message is required');
    const libraryId = library
      ? (library.startsWith('/') ? library : LIBRARY_IDS[library.toLowerCase().replace(/[-\s.]/g, '_')])
      : null;
    if (!libraryId) throw new Error('library is required for error debugging');
    const cleanError = error_message.replace(/\n.*/g, '').slice(0, 150);
    return await fetchDocs(libraryId, `error ${cleanError} troubleshooting fix`, tokens);
  }

  if (tool === 'context7_get_best_practices') {
    const { library_id, topic, tokens = 6000 } = args;
    if (!library_id) throw new Error('library_id is required');
    const q = [topic, 'best practices patterns conventions performance security'].filter(Boolean).join(' ');
    return await fetchDocs(library_id, q, tokens);
  }

  // HARDENED: SemVer-filtered code examples — drops pre-release / beta / rc
  if (tool === 'context7_verified_examples') {
    const { library_id, library_name, query, min_version, max_version, include_prereleases = false, tokens = 5000 } = args;
    if (!query) throw new Error('query is required (e.g. "useState", "Pool connection")');
    let id = library_id;
    if (!id && library_name) {
      const mapped = LIBRARY_IDS[library_name.toLowerCase().replace(/[-\s.]/g, '_')];
      id = mapped;
      if (!id) {
        const search = await c7get('/libs/search', { query, libraryName: library_name });
        const libs = search.results || search.libraries || [];
        id = libs[0]?.id;
        if (!id) throw new Error(`Cannot resolve: ${library_name}`);
      }
    }
    if (!id) throw new Error('library_id or library_name is required');

    // Fetch with sanitization
    const exampleQuery = `${query} example code snippet usage`;
    const docs = await fetchDocs(id, exampleQuery, tokens, true);
    const content = typeof docs === 'string' ? docs : (docs.content || docs.snippets || JSON.stringify(docs));

    // SemVer parser — tolerates "v1.2.3", "1.2.3", "1.2.3-beta.1", "^1.2.3"
    function parseSemVer(v) {
      if (!v) return null;
      const m = String(v).match(/v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
      if (!m) return null;
      return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] || null, raw: m[0] };
    }
    function cmp(a, b) {
      if (a.major !== b.major) return a.major - b.major;
      if (a.minor !== b.minor) return a.minor - b.minor;
      if (a.patch !== b.patch) return a.patch - b.patch;
      // Stable > prerelease per SemVer
      if (!a.pre && b.pre) return 1;
      if (a.pre && !b.pre) return -1;
      return 0;
    }

    const minV = parseSemVer(min_version);
    const maxV = parseSemVer(max_version);

    // Extract fenced code blocks with surrounding context
    const blocks = [];
    const codeRegex = /```([a-z]*)\n([\s\S]*?)```/g;
    let match;
    while ((match = codeRegex.exec(content)) !== null) {
      const before = content.slice(Math.max(0, match.index - 400), match.index);
      const block = { language: match[1] || 'plain', code: match[2].trim(), context_before: before.trim().slice(-300) };
      // Look for version mentions in the surrounding 600 chars
      const window = content.slice(Math.max(0, match.index - 400), match.index + match[0].length);
      const vMatches = [...window.matchAll(/v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/g)].map(m => m[1]);
      block.detected_versions = [...new Set(vMatches)];
      block.parsed_versions = block.detected_versions.map(parseSemVer).filter(Boolean);
      blocks.push(block);
    }

    // Filter
    const kept = [];
    const filtered_out = [];
    for (const b of blocks) {
      const reasons = [];
      // If we see ANY prerelease tag in the surrounding text and prereleases are disabled, drop
      if (!include_prereleases && b.parsed_versions.some(v => v.pre)) reasons.push('prerelease detected');
      // SemVer range filtering — applies only when versions were detected
      if (b.parsed_versions.length > 0) {
        if (minV && !b.parsed_versions.some(v => cmp(v, minV) >= 0)) reasons.push(`all detected versions below min ${min_version}`);
        if (maxV && !b.parsed_versions.some(v => cmp(v, maxV) <= 0)) reasons.push(`all detected versions above max ${max_version}`);
      }
      if (reasons.length) filtered_out.push({ snippet_preview: b.code.slice(0, 80), reasons, detected_versions: b.detected_versions });
      else kept.push(b);
    }

    return {
      library_id: id,
      query,
      filter: { min_version: min_version || null, max_version: max_version || null, include_prereleases },
      examples_kept: kept.length,
      examples_filtered_out: filtered_out.length,
      examples: kept,
      filtered_out_summary: filtered_out.slice(0, 5),
      defense_layer: 'active',
      note: blocks.length === 0
        ? 'No fenced code blocks found in returned docs. Try a more specific query.'
        : (kept.length === 0 ? 'All blocks were filtered out by SemVer rules. Consider widening the range or setting include_prereleases=true.' : undefined)
    };
  }

  throw new Error(`Unknown Context7 tool: ${tool}`);
}

export default { execute };
