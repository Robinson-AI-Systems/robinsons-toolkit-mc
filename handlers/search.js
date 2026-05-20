/**
 * Search Handler — 28 tools
 * Brave Search and Tavily for web, news, images, video, local,
 * technical docs, research, and compound search workflows.
 */

const BRAVE_BASE = 'https://api.search.brave.com/res/v1';
const TAVILY_BASE = 'https://api.tavily.com';

function braveKey() {
  const k = process.env.BRAVE_SEARCH_API_KEY;
  if (!k) throw new Error('BRAVE_SEARCH_API_KEY not set in .env');
  return k;
}
function tavilyKey() {
  const k = process.env.TAVILY_API_KEY;
  if (!k) throw new Error('TAVILY_API_KEY not set in .env');
  return k;
}

async function brave(path) {
  const res = await fetch(`${BRAVE_BASE}${path}`, { headers: { 'Accept': 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': braveKey() } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Brave Search ${res.status}: ${data.message || JSON.stringify(data)}`);
  return data;
}

async function tavily(body) {
  const res = await fetch(`${TAVILY_BASE}/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, api_key: tavilyKey() }) });
  const data = await res.json();
  if (!res.ok) throw new Error(`Tavily ${res.status}: ${data.detail || JSON.stringify(data)}`);
  return data;
}

async function execute(tool, args) {

  // ── BRAVE SEARCH ──────────────────────────────────────────────────────────
  if (tool === 'brave_web_search') {
    const { query, count = 10, country = 'us', search_lang = 'en', freshness, result_filter = 'web' } = args;
    if (!query) throw new Error('query is required');
    let url = `/web/search?q=${encodeURIComponent(query)}&count=${count}&country=${country}&search_lang=${search_lang}&result_filter=${result_filter}`;
    if (freshness) url += `&freshness=${freshness}`;
    const data = await brave(url);
    return {
      query: data.query?.original,
      results: data.web?.results?.map(r => ({ title: r.title, url: r.url, description: r.description, age: r.age })) || [],
      news: data.news?.results?.map(r => ({ title: r.title, url: r.url, description: r.description, age: r.age })) || []
    };
  }
  if (tool === 'brave_news_search') {
    const { query, count = 10, country = 'us', freshness = 'pd' } = args;
    const data = await brave(`/news/search?q=${encodeURIComponent(query)}&count=${count}&country=${country}&freshness=${freshness}`);
    return { results: data.results?.map(r => ({ title: r.title, url: r.url, description: r.description, age: r.age })) || [] };
  }
  if (tool === 'brave_local_search') {
    const { query, country = 'us', count = 5 } = args;
    const data = await brave(`/local/pois?q=${encodeURIComponent(query)}&count=${count}&country=${country}`);
    return { results: data.results || [] };
  }
  if (tool === 'brave_image_search') {
    const { query, count = 5, safe_search = 'strict' } = args;
    const data = await brave(`/images/search?q=${encodeURIComponent(query)}&count=${count}&safesearch=${safe_search}`);
    return { results: data.results?.map(r => ({ title: r.title, url: r.url, thumbnail: r.thumbnail?.src })) || [] };
  }
  if (tool === 'brave_video_search') {
    const { query, count = 5, freshness } = args;
    let url = `/videos/search?q=${encodeURIComponent(query)}&count=${count}`;
    if (freshness) url += `&freshness=${freshness}`;
    const data = await brave(url);
    return { results: data.results?.map(r => ({ title: r.title, url: r.url, description: r.description, duration: r.video?.duration, thumbnail: r.thumbnail?.src })) || [] };
  }
  if (tool === 'brave_suggest') {
    // Auto-complete query suggestions
    const { query, count = 5, country = 'us' } = args;
    const data = await brave(`/suggest/search?q=${encodeURIComponent(query)}&count=${count}&country=${country}`);
    return { suggestions: data.results?.map(r => r.query || r) || [] };
  }
  if (tool === 'brave_summarizer') {
    // Get Brave AI summarizer answer for a query
    const { query, country = 'us' } = args;
    const data = await brave(`/web/search?q=${encodeURIComponent(query)}&summary=1&country=${country}`);
    return { summary: data.summarizer?.key ? 'Summary available — Brave Pro required' : null, results: data.web?.results?.slice(0, 5).map(r => ({ title: r.title, url: r.url, description: r.description })) || [] };
  }

  // ── TAVILY SEARCH ─────────────────────────────────────────────────────────
  if (tool === 'tavily_search') {
    const { query, search_depth = 'basic', max_results = 5, include_answer = true, include_raw_content = false, include_domains, exclude_domains, topic = 'general' } = args;
    if (!query) throw new Error('query is required');
    const body = { query, search_depth, max_results, include_answer, include_raw_content, topic };
    if (include_domains) body.include_domains = include_domains;
    if (exclude_domains) body.exclude_domains = exclude_domains;
    const data = await tavily(body);
    return { answer: data.answer, results: data.results?.map(r => ({ title: r.title, url: r.url, content: r.content, score: r.score })) || [], query: data.query };
  }
  if (tool === 'tavily_search_deep') {
    const { query, max_results = 10, include_domains, topic = 'general' } = args;
    const body = { query, search_depth: 'advanced', max_results, include_answer: true, include_raw_content: true, topic };
    if (include_domains) body.include_domains = include_domains;
    const data = await tavily(body);
    return { answer: data.answer, results: data.results?.map(r => ({ title: r.title, url: r.url, content: r.content?.slice(0, 2000), score: r.score })) || [] };
  }
  if (tool === 'tavily_get_page_content') {
    const { url } = args;
    if (!url) throw new Error('url is required');
    const data = await tavily({ query: url, include_domains: [new URL(url).hostname], max_results: 1, include_raw_content: true });
    const result = data.results?.[0];
    return { url, title: result?.title, content: result?.raw_content || result?.content, found: !!result };
  }
  if (tool === 'tavily_news_search') {
    const { query, max_results = 5 } = args;
    const data = await tavily({ query, search_depth: 'basic', max_results, include_answer: true, topic: 'news' });
    return { answer: data.answer, results: data.results?.map(r => ({ title: r.title, url: r.url, content: r.content, score: r.score })) || [] };
  }
  if (tool === 'tavily_finance_search') {
    const { query, max_results = 5 } = args;
    const data = await tavily({ query, search_depth: 'basic', max_results, include_answer: true, topic: 'finance' });
    return { answer: data.answer, results: data.results?.map(r => ({ title: r.title, url: r.url, content: r.content })) || [] };
  }
  if (tool === 'tavily_extract_multiple') {
    // Extract content from multiple URLs in one call
    const { urls } = args;
    if (!urls?.length) throw new Error('urls array is required');
    const results = await Promise.all(urls.map(async url => {
      try {
        const data = await tavily({ query: url, include_domains: [new URL(url).hostname], max_results: 1, include_raw_content: true });
        const r = data.results?.[0];
        return { url, title: r?.title, content: r?.raw_content || r?.content, found: !!r };
      } catch (e) { return { url, error: e.message, found: false }; }
    }));
    return { results, found: results.filter(r => r.found).length };
  }

  // ── COMBINED / SMART SEARCH ───────────────────────────────────────────────
  // Use best available API (Tavily preferred, Brave fallback)
  if (tool === 'search_web') {
    if (process.env.TAVILY_API_KEY) return await execute('tavily_search', args);
    if (process.env.BRAVE_SEARCH_API_KEY) return await execute('brave_web_search', args);
    throw new Error('No search API configured. Set TAVILY_API_KEY or BRAVE_SEARCH_API_KEY in .env');
  }
  if (tool === 'search_and_summarize') {
    const results = await execute('search_web', args);
    return {
      answer: results.answer || 'See top results below',
      top_sources: results.results?.slice(0, 3).map(r => ({ title: r.title, url: r.url, snippet: (r.content || r.description || '').slice(0, 200) })),
      query: args.query
    };
  }
  if (tool === 'search_news') {
    if (process.env.TAVILY_API_KEY) return await execute('tavily_news_search', args);
    if (process.env.BRAVE_SEARCH_API_KEY) return await execute('brave_news_search', { ...args, freshness: args.freshness || 'pd' });
    throw new Error('No search API configured');
  }
  if (tool === 'search_recent') {
    // Search for news in the last 24h
    const query = args.query;
    if (process.env.TAVILY_API_KEY) return await tavily({ query, search_depth: 'basic', max_results: args.max_results || 5, include_answer: true, topic: 'news' }).then(d => ({ answer: d.answer, results: d.results?.map(r => ({ title: r.title, url: r.url, content: r.content })) || [] }));
    if (process.env.BRAVE_SEARCH_API_KEY) return await execute('brave_news_search', { ...args, freshness: 'pd' });
    throw new Error('No search API configured');
  }
  if (tool === 'search_technical_docs') {
    // Search for technical documentation (MDN, GitHub, npm, etc.)
    const { query, max_results = 5 } = args;
    const techDomains = ['developer.mozilla.org','docs.github.com','nodejs.org','npmjs.com','pkg.go.dev','docs.python.org','docs.rs','developer.apple.com','learn.microsoft.com'];
    if (process.env.TAVILY_API_KEY) {
      const data = await tavily({ query, search_depth: 'advanced', max_results, include_answer: true, include_domains: techDomains });
      return { answer: data.answer, results: data.results?.map(r => ({ title: r.title, url: r.url, content: r.content?.slice(0, 1000) })) || [] };
    }
    return await execute('brave_web_search', { query: query + ' documentation', count: max_results });
  }
  if (tool === 'search_multiple_queries') {
    // Run multiple queries in parallel and merge results
    const { queries, max_results_each = 3 } = args;
    if (!queries?.length) throw new Error('queries array is required');
    const allResults = await Promise.all(queries.map(q => execute('search_web', { query: q, max_results: max_results_each, count: max_results_each }).catch(e => ({ error: e.message, query: q }))));
    return { queries, results: allResults };
  }
  if (tool === 'search_fact_check') {
    // Search to verify a claim
    const { claim, max_results = 5 } = args;
    if (!claim) throw new Error('claim is required');
    const query = `fact check: "${claim}"`;
    if (process.env.TAVILY_API_KEY) {
      const data = await tavily({ query, search_depth: 'advanced', max_results, include_answer: true });
      return { claim, verdict: data.answer, sources: data.results?.slice(0, 3).map(r => ({ title: r.title, url: r.url, snippet: r.content?.slice(0, 300) })) || [] };
    }
    return await execute('brave_web_search', { query, count: max_results });
  }
  if (tool === 'search_compare') {
    // Compare two things using search
    const { item_a, item_b, aspect, max_results = 5 } = args;
    if (!item_a || !item_b) throw new Error('item_a and item_b are required');
    const query = `${item_a} vs ${item_b}${aspect ? ` ${aspect}` : ''} comparison`;
    if (process.env.TAVILY_API_KEY) {
      const data = await tavily({ query, search_depth: 'advanced', max_results, include_answer: true });
      return { comparison: `${item_a} vs ${item_b}`, summary: data.answer, sources: data.results?.slice(0, 3).map(r => ({ title: r.title, url: r.url })) || [] };
    }
    return await execute('brave_web_search', { query, count: max_results });
  }
  if (tool === 'search_competitor_analysis') {
    // Research competitors in an industry or for a product
    const { company_or_product, industry, max_results = 8 } = args;
    if (!company_or_product) throw new Error('company_or_product is required');
    const query = `${company_or_product} competitors alternatives${industry ? ` ${industry}` : ''} comparison`;
    if (process.env.TAVILY_API_KEY) {
      const data = await tavily({ query, search_depth: 'advanced', max_results, include_answer: true });
      return { subject: company_or_product, summary: data.answer, results: data.results?.map(r => ({ title: r.title, url: r.url, content: r.content?.slice(0, 500) })) || [] };
    }
    return await execute('brave_web_search', { query, count: max_results });
  }
  if (tool === 'search_github_repos') {
    // Search for GitHub repositories
    const { query, language, max_results = 5 } = args;
    const searchQuery = `site:github.com ${query}${language ? ` language:${language}` : ''}`;
    if (process.env.TAVILY_API_KEY) {
      const data = await tavily({ query: searchQuery, max_results, include_answer: false, include_domains: ['github.com'] });
      return { results: data.results?.map(r => ({ title: r.title, url: r.url, description: r.content?.slice(0, 200) })) || [] };
    }
    return await execute('brave_web_search', { query: searchQuery, count: max_results, result_filter: 'web' });
  }

  // ── SERPAPI (Google/YouTube/Maps scraping) ────────────────────────────────────
  async function serp(engine, params) {
    const key = process.env.SERPAPI_KEY;
    if (!key) throw new Error('SERPAPI_KEY not set in .env');
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('api_key', key);
    url.searchParams.set('engine', engine);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
    const res = await fetch(url.toString());
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`SerpApi ${res.status}: ${err.error || res.statusText}`);
    }
    return await res.json();
  }

  if (tool === 'serp_google_search') {
    const { query, num = 10, location, hl = 'en', gl = 'us' } = args;
    if (!query) throw new Error('query is required');
    const data = await serp('google', { q: query, num, location, hl, gl });
    return {
      organic: (data.organic_results || []).map(r => ({ title: r.title, link: r.link, snippet: r.snippet, position: r.position })),
      answer_box: data.answer_box || null,
      knowledge_graph: data.knowledge_graph ? { title: data.knowledge_graph.title, description: data.knowledge_graph.description } : null,
      related: (data.related_searches || []).slice(0, 5).map(r => r.query)
    };
  }

  if (tool === 'serp_google_news') {
    const { query, num = 10, hl = 'en' } = args;
    if (!query) throw new Error('query is required');
    const data = await serp('google', { q: query, num, hl, tbm: 'nws' });
    return (data.news_results || []).map(r => ({ title: r.title, link: r.link, source: r.source?.name, date: r.date, snippet: r.snippet }));
  }

  if (tool === 'serp_google_images') {
    const { query, num = 10 } = args;
    if (!query) throw new Error('query is required');
    const data = await serp('google_images', { q: query, num });
    return (data.images_results || []).slice(0, num).map(r => ({ title: r.title, original: r.original, thumbnail: r.thumbnail, source: r.source, link: r.link }));
  }

  if (tool === 'serp_google_maps') {
    const { query, location, ll, type = 'search' } = args;
    if (!query) throw new Error('query is required');
    const data = await serp('google_maps', { q: query, ll, type });
    return (data.local_results || []).map(r => ({ title: r.title, address: r.address, phone: r.phone, rating: r.rating, reviews: r.reviews, type: r.type, hours: r.hours?.schedule }));
  }

  if (tool === 'serp_google_shopping') {
    const { query, num = 10, min_price, max_price } = args;
    if (!query) throw new Error('query is required');
    const params = { q: query, num, tbm: 'shop' };
    if (min_price) params.tbs = `price:1,ppr_min:${min_price}${max_price ? `,ppr_max:${max_price}` : ''}`;
    const data = await serp('google', params);
    return (data.shopping_results || []).slice(0, num).map(r => ({ title: r.title, price: r.price, source: r.source, link: r.link, rating: r.rating, thumbnail: r.thumbnail }));
  }

  if (tool === 'serp_google_jobs') {
    const { query, location, chips } = args;
    if (!query) throw new Error('query is required');
    const data = await serp('google_jobs', { q: query, location, chips });
    return (data.jobs_results || []).map(r => ({
      title: r.title, company: r.company_name, location: r.location,
      posted: r.detected_extensions?.posted_at, via: r.via,
      description: (r.description || '').slice(0, 300)
    }));
  }

  if (tool === 'serp_youtube_search') {
    const { query, num = 10 } = args;
    if (!query) throw new Error('query is required');
    const data = await serp('youtube', { search_query: query });
    return (data.video_results || []).slice(0, num).map(r => ({ title: r.title, link: r.link, channel: r.channel?.name, views: r.views, length: r.length, published_date: r.published_date, description: (r.description || '').slice(0, 200) }));
  }

  throw new Error(`Unknown search tool: ${tool}`);
}

export default { execute };
