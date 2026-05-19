/**
 * Context7 Handler — 38 tools
 * Up-to-date library documentation injected directly into your workflow.
 * Eliminates hallucinated APIs and outdated code examples by fetching
 * version-specific docs from context7.com at query time.
 *
 * Requires: CONTEXT7_API_KEY (free at https://context7.com/dashboard)
 *
 * Tool categories:
 *   • Core (3)         — resolve, fetch docs, and the smart lookup super-tool
 *   • Topic filters (8) — any library + specific doc section (routing, API, examples, etc.)
 *   • Library shortcuts (20) — zero-resolve direct fetchers for the full dev stack
 *   • Multi-library (4)  — research stacks, compare libs, parallel fetches
 *   • Smart tools (3)   — how-to, debug error, best practices
 */

const BASE = 'https://context7.com/api/v2';

function apiKey() {
  const k = process.env.CONTEXT7_API_KEY;
  if (!k) throw new Error(
    'CONTEXT7_API_KEY not set in .env\n' +
    'Get your free API key at https://context7.com/dashboard\n' +
    'Then add: CONTEXT7_API_KEY=your-key-here'
  );
  return k;
}

async function c7get(endpoint, params) {
  const filtered = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null));
  const url = `${BASE}${endpoint}?${new URLSearchParams(filtered).toString()}`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey()}`, 'Content-Type': 'application/json' } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Context7 ${res.status}: ${text.slice(0, 200)}`);
  }
  return await res.json();
}

// Fetch docs by library ID + focused query, with clean response shaping
async function fetchDocs(libraryId, query, tokens = 5000) {
  const data = await c7get('/context', { query: query || libraryId.split('/').pop(), libraryId, tokens });
  return { libraryId, query, content: data.content || data.docs || data.text || data, token_count: data.tokenCount || tokens };
}

// Curated library ID map — the full Robinson stack
// IDs follow /org/repo pattern. Update if Context7 changes slugs.
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

  // Resolve a library name to its Context7 ID
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
      usage: 'Use the id field from the best match as libraryId in context7_get_docs'
    };
  }

  // Fetch documentation for a library by its Context7 ID
  if (tool === 'context7_get_docs') {
    const { library_id, query, topic, tokens = 5000 } = args;
    if (!library_id) throw new Error('library_id is required (e.g. /vercel/next.js)');
    const effectiveQuery = topic || query || library_id.split('/').pop();
    return await fetchDocs(library_id, effectiveQuery, tokens);
  }

  // SUPER TOOL: Resolve library name + fetch docs in a single call
  if (tool === 'context7_lookup') {
    const { library_name, query, topic, tokens = 5000 } = args;
    if (!library_name) throw new Error('library_name is required');
    // Check if it's already a full ID (/org/repo format)
    if (library_name.startsWith('/')) {
      return await fetchDocs(library_name, topic || query, tokens);
    }
    // Check curated map first (instant, no API call)
    const mapped = LIBRARY_IDS[library_name.toLowerCase().replace(/[-\s.]/g, '_')];
    if (mapped) return await fetchDocs(mapped, topic || query, tokens);
    // Fall back to resolving via API
    const search = await c7get('/libs/search', { query: query || library_name, libraryName: library_name });
    const libs = search.results || search.libraries || (Array.isArray(search) ? search : []);
    const best = libs[0];
    if (!best) throw new Error(`Could not resolve library: ${library_name}. Try a more specific name or provide the /org/repo ID directly.`);
    return await fetchDocs(best.id || best.libraryId, topic || query, tokens);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  TOPIC-FOCUSED DOC FETCHERS (any library + specific section)
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
  //  CURATED LIBRARY SHORTCUTS — zero-resolve, instant doc access
  // ══════════════════════════════════════════════════════════════════════════

  if (tool === 'context7_nextjs_docs') {
    const { query = 'Next.js', topic, tokens = 6000 } = args;
    return await fetchDocs(LIBRARY_IDS.nextjs, topic || query, tokens);
  }
  if (tool === 'context7_react_docs') {
    const { query = 'React', topic, tokens = 6000 } = args;
    return await fetchDocs(LIBRARY_IDS.react, topic || query, tokens);
  }
  if (tool === 'context7_typescript_docs') {
    const { query = 'TypeScript', topic, tokens = 6000 } = args;
    return await fetchDocs(LIBRARY_IDS.typescript, topic || query, tokens);
  }
  if (tool === 'context7_prisma_docs') {
    const { query = 'Prisma ORM', topic, tokens = 6000 } = args;
    return await fetchDocs(LIBRARY_IDS.prisma, topic || query, tokens);
  }
  if (tool === 'context7_supabase_docs') {
    const { query = 'Supabase', topic, tokens = 6000 } = args;
    return await fetchDocs(LIBRARY_IDS.supabase, topic || query, tokens);
  }
  if (tool === 'context7_drizzle_docs') {
    const { query = 'Drizzle ORM', topic, tokens = 6000 } = args;
    return await fetchDocs(LIBRARY_IDS.drizzle, topic || query, tokens);
  }
  if (tool === 'context7_clerk_docs') {
    const { query = 'Clerk auth', topic, tokens = 6000 } = args;
    return await fetchDocs(LIBRARY_IDS.clerk, topic || query, tokens);
  }
  if (tool === 'context7_stripe_docs') {
    const { query = 'Stripe payments', topic, tokens = 6000 } = args;
    return await fetchDocs(LIBRARY_IDS.stripe, topic || query, tokens);
  }
  if (tool === 'context7_resend_docs') {
    const { query = 'Resend email', topic, tokens = 5000 } = args;
    return await fetchDocs(LIBRARY_IDS.resend, topic || query, tokens);
  }
  if (tool === 'context7_tailwind_docs') {
    const { query = 'Tailwind CSS', topic, tokens = 5000 } = args;
    return await fetchDocs(LIBRARY_IDS.tailwind, topic || query, tokens);
  }
  if (tool === 'context7_shadcn_docs') {
    const { query = 'shadcn/ui components', topic, tokens = 5000 } = args;
    return await fetchDocs(LIBRARY_IDS.shadcn, topic || query, tokens);
  }
  if (tool === 'context7_trpc_docs') {
    const { query = 'tRPC type-safe API', topic, tokens = 5000 } = args;
    return await fetchDocs(LIBRARY_IDS.trpc, topic || query, tokens);
  }
  if (tool === 'context7_zod_docs') {
    const { query = 'Zod schema validation', topic, tokens = 5000 } = args;
    return await fetchDocs(LIBRARY_IDS.zod, topic || query, tokens);
  }
  if (tool === 'context7_tanstack_query_docs') {
    const { query = 'TanStack Query data fetching', topic, tokens = 5000 } = args;
    return await fetchDocs(LIBRARY_IDS.tanstack_query, topic || query, tokens);
  }
  if (tool === 'context7_vercel_docs') {
    const { query = 'Vercel deployment', topic, tokens = 5000 } = args;
    return await fetchDocs(LIBRARY_IDS.vercel, topic || query, tokens);
  }
  if (tool === 'context7_neon_docs') {
    const { query = 'Neon serverless Postgres', topic, tokens = 5000 } = args;
    return await fetchDocs(LIBRARY_IDS.neon, topic || query, tokens);
  }
  if (tool === 'context7_upstash_docs') {
    const { query = 'Upstash Redis', topic, tokens = 5000 } = args;
    return await fetchDocs(LIBRARY_IDS.upstash, topic || query, tokens);
  }
  if (tool === 'context7_cloudflare_workers_docs') {
    const { query = 'Cloudflare Workers', topic, tokens = 5000 } = args;
    return await fetchDocs(LIBRARY_IDS.cloudflare, topic || query, tokens);
  }
  if (tool === 'context7_hono_docs') {
    const { query = 'Hono web framework', topic, tokens = 5000 } = args;
    return await fetchDocs(LIBRARY_IDS.hono, topic || query, tokens);
  }
  if (tool === 'context7_react_hook_form_docs') {
    const { query = 'React Hook Form', topic, tokens = 5000 } = args;
    return await fetchDocs(LIBRARY_IDS.react_hook_form, topic || query, tokens);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MULTI-LIBRARY RESEARCH TOOLS
  // ══════════════════════════════════════════════════════════════════════════

  // Fetch docs for multiple libraries in parallel
  if (tool === 'context7_research_stack') {
    const { libraries, query, tokens_each = 3000 } = args;
    if (!libraries?.length) throw new Error('libraries array is required (e.g. ["nextjs", "/vercel/next.js"])');
    const results = await Promise.allSettled(
      libraries.map(async lib => {
        const id = lib.startsWith('/') ? lib : (LIBRARY_IDS[lib.toLowerCase().replace(/[-\s.]/g, '_')] || null);
        if (!id) return { library: lib, error: 'Unknown library. Use /org/repo format or a known shortcut name.' };
        return await fetchDocs(id, query || lib, tokens_each);
      })
    );
    return {
      libraries,
      query,
      docs: results.map((r, i) => ({
        library: libraries[i],
        success: r.status === 'fulfilled',
        ...(r.status === 'fulfilled' ? r.value : { error: r.reason?.message })
      }))
    };
  }

  // Compare two libraries side by side
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

  // Get integration docs for two libraries working together
  if (tool === 'context7_get_integration_docs') {
    const { primary_library, secondary_library, query, tokens = 5000 } = args;
    if (!primary_library) throw new Error('primary_library is required');
    const id = primary_library.startsWith('/') ? primary_library : LIBRARY_IDS[primary_library.toLowerCase().replace(/[-\s.]/g, '_')];
    if (!id) throw new Error(`Unknown library: ${primary_library}`);
    const integrationQuery = secondary_library
      ? `${secondary_library} integration ${query || ''} setup configuration`.trim()
      : (query || 'integrations third-party');
    return await fetchDocs(id, integrationQuery, tokens);
  }

  // SUPER TOOL: Get docs for the full Cortiware/YardSync stack at once
  if (tool === 'context7_cortiware_stack_docs') {
    const { query = 'getting started', tokens_each = 2000 } = args;
    const stack = ['nextjs', 'prisma', 'clerk', 'stripe', 'resend', 'tailwind', 'zod'];
    const results = await Promise.allSettled(
      stack.map(lib => fetchDocs(LIBRARY_IDS[lib], query, tokens_each))
    );
    return {
      stack,
      query,
      docs: results.map((r, i) => ({
        library: stack[i],
        id: LIBRARY_IDS[stack[i]],
        success: r.status === 'fulfilled',
        ...(r.status === 'fulfilled' ? r.value : { error: r.reason?.message })
      }))
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SMART DEVELOPER TOOLS
  // ══════════════════════════════════════════════════════════════════════════

  // "How do I X in library Y" — resolves and fetches in one natural-language call
  if (tool === 'context7_how_to') {
    const { question, library, tokens = 6000 } = args;
    if (!question) throw new Error('question is required (e.g. "set up middleware" or "handle file uploads")');
    // If library given, look it up; otherwise try to infer from question
    let libraryId = library
      ? (library.startsWith('/') ? library : LIBRARY_IDS[library.toLowerCase().replace(/[-\s.]/g, '_')])
      : null;
    if (!libraryId && library) {
      // Fall back to API search
      const search = await c7get('/libs/search', { query: question, libraryName: library });
      const libs = search.results || search.libraries || [];
      libraryId = libs[0]?.id || libs[0]?.libraryId;
    }
    if (!libraryId) throw new Error(`Could not resolve library: ${library}. Use a known shortcut or /org/repo ID.`);
    return await fetchDocs(libraryId, `how to ${question}`, tokens);
  }

  // Debug an error by fetching relevant docs from the responsible library
  if (tool === 'context7_debug_error') {
    const { error_message, library, tokens = 6000 } = args;
    if (!error_message) throw new Error('error_message is required');
    const libraryId = library
      ? (library.startsWith('/') ? library : LIBRARY_IDS[library.toLowerCase().replace(/[-\s.]/g, '_')])
      : null;
    if (!libraryId) throw new Error(`library is required for error debugging (e.g. "nextjs", "/vercel/next.js")`);
    // Extract key phrases from error for better doc matching
    const cleanError = error_message.replace(/\n.*/g, '').slice(0, 150);
    return await fetchDocs(libraryId, `error ${cleanError} troubleshooting fix`, tokens);
  }

  // Get best practices and patterns for a library
  if (tool === 'context7_get_best_practices') {
    const { library_id, topic, tokens = 6000 } = args;
    if (!library_id) throw new Error('library_id is required');
    const q = [topic, 'best practices patterns conventions performance security'].filter(Boolean).join(' ');
    return await fetchDocs(library_id, q, tokens);
  }

  throw new Error(`Unknown Context7 tool: ${tool}`);
}

export default { execute };
