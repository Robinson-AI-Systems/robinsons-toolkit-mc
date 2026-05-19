/**
 * Search Handler — 12 tools (NEW)
 * Brave Search and Tavily for web research, news, and fact-checking.
 * Lets the agent research things without leaving the workflow.
 */

async function execute(tool, args) {

  // ── BRAVE SEARCH ──────────────────────────────────────────────────────────
  if (tool === 'brave_web_search') {
    const key = process.env.BRAVE_SEARCH_API_KEY;
    if (!key) throw new Error('BRAVE_SEARCH_API_KEY not set in .env');
    const { query, count = 10, country = 'us', search_lang = 'en', freshness, result_filter = 'web' } = args;
    if (!query) throw new Error('query is required');
    let url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}&country=${country}&search_lang=${search_lang}&result_filter=${result_filter}`;
    if (freshness) url += `&freshness=${freshness}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': key } });
    const data = await res.json();
    if (!res.ok) throw new Error(`Brave Search ${res.status}: ${data.message || JSON.stringify(data)}`);
    return {
      query: data.query?.original,
      results: data.web?.results?.map(r => ({ title: r.title, url: r.url, description: r.description, age: r.age })) || [],
      news: data.news?.results?.map(r => ({ title: r.title, url: r.url, description: r.description, age: r.age })) || []
    };
  }
  if (tool === 'brave_news_search') {
    const key = process.env.BRAVE_SEARCH_API_KEY;
    if (!key) throw new Error('BRAVE_SEARCH_API_KEY not set in .env');
    const { query, count = 10, country = 'us', freshness = 'pd' } = args;
    const url = `https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(query)}&count=${count}&country=${country}&freshness=${freshness}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json', 'X-Subscription-Token': key } });
    const data = await res.json();
    if (!res.ok) throw new Error(`Brave News ${res.status}: ${data.message || JSON.stringify(data)}`);
    return { results: data.results?.map(r => ({ title: r.title, url: r.url, description: r.description, age: r.age, source: r.extra_snippets })) || [] };
  }
  if (tool === 'brave_local_search') {
    // Search for local businesses/places
    const key = process.env.BRAVE_SEARCH_API_KEY;
    if (!key) throw new Error('BRAVE_SEARCH_API_KEY not set in .env');
    const { query, country = 'us', count = 5 } = args;
    const url = `https://api.search.brave.com/res/v1/local/pois?q=${encodeURIComponent(query)}&count=${count}&country=${country}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json', 'X-Subscription-Token': key } });
    const data = await res.json();
    if (!res.ok) throw new Error(`Brave Local ${res.status}`);
    return { results: data.results || [] };
  }
  if (tool === 'brave_image_search') {
    const key = process.env.BRAVE_SEARCH_API_KEY;
    if (!key) throw new Error('BRAVE_SEARCH_API_KEY not set in .env');
    const { query, count = 5, safe_search = 'strict' } = args;
    const url = `https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(query)}&count=${count}&safesearch=${safe_search}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json', 'X-Subscription-Token': key } });
    const data = await res.json();
    if (!res.ok) throw new Error(`Brave Image ${res.status}`);
    return { results: data.results?.map(r => ({ title: r.title, url: r.url, thumbnail: r.thumbnail?.src })) || [] };
  }

  // ── TAVILY ────────────────────────────────────────────────────────────────
  if (tool === 'tavily_search') {
    const key = process.env.TAVILY_API_KEY;
    if (!key) throw new Error('TAVILY_API_KEY not set in .env');
    const { query, search_depth = 'basic', max_results = 5, include_answer = true, include_raw_content = false, include_domains, exclude_domains, topic = 'general' } = args;
    if (!query) throw new Error('query is required');
    const body = { query, search_depth, max_results, include_answer, include_raw_content, topic, api_key: key };
    if (include_domains) body.include_domains = include_domains;
    if (exclude_domains) body.exclude_domains = exclude_domains;
    const res = await fetch('https://api.tavily.com/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(`Tavily ${res.status}: ${data.detail || JSON.stringify(data)}`);
    return { answer: data.answer, results: data.results?.map(r => ({ title: r.title, url: r.url, content: r.content, score: r.score })) || [], query: data.query };
  }
  if (tool === 'tavily_search_deep') {
    const key = process.env.TAVILY_API_KEY;
    if (!key) throw new Error('TAVILY_API_KEY not set in .env');
    const { query, max_results = 10, include_domains, topic = 'general' } = args;
    const body = { query, search_depth: 'advanced', max_results, include_answer: true, include_raw_content: true, topic, api_key: key };
    if (include_domains) body.include_domains = include_domains;
    const res = await fetch('https://api.tavily.com/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(`Tavily Deep ${res.status}: ${data.detail}`);
    return { answer: data.answer, results: data.results?.map(r => ({ title: r.title, url: r.url, content: r.content?.slice(0, 2000), score: r.score })) || [] };
  }
  if (tool === 'tavily_get_page_content') {
    // Extract clean content from a specific URL
    const key = process.env.TAVILY_API_KEY;
    if (!key) throw new Error('TAVILY_API_KEY not set in .env');
    const { url } = args;
    if (!url) throw new Error('url is required');
    const body = { query: url, include_domains: [new URL(url).hostname], max_results: 1, include_raw_content: true, api_key: key };
    const res = await fetch('https://api.tavily.com/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(`Tavily Extract ${res.status}`);
    const result = data.results?.[0];
    return { url, title: result?.title, content: result?.raw_content || result?.content, found: !!result };
  }
  if (tool === 'tavily_news_search') {
    const key = process.env.TAVILY_API_KEY;
    if (!key) throw new Error('TAVILY_API_KEY not set in .env');
    const { query, max_results = 5 } = args;
    const body = { query, search_depth: 'basic', max_results, include_answer: true, topic: 'news', api_key: key };
    const res = await fetch('https://api.tavily.com/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(`Tavily News ${res.status}`);
    return { answer: data.answer, results: data.results?.map(r => ({ title: r.title, url: r.url, content: r.content, score: r.score })) || [] };
  }

  // ── COMBINED SEARCH ───────────────────────────────────────────────────────
  if (tool === 'search_web') {
    // Uses Tavily if available, falls back to Brave
    if (process.env.TAVILY_API_KEY) {
      return await execute('tavily_search', args);
    } else if (process.env.BRAVE_SEARCH_API_KEY) {
      return await execute('brave_web_search', args);
    }
    throw new Error('No search API configured. Set TAVILY_API_KEY or BRAVE_SEARCH_API_KEY in .env');
  }
  if (tool === 'search_and_summarize') {
    // Search and return a concise answer + top sources
    const results = await execute('search_web', args);
    return {
      answer: results.answer || 'See top results below',
      top_sources: results.results?.slice(0, 3).map(r => ({ title: r.title, url: r.url, snippet: (r.content || r.description || '').slice(0, 200) })),
      query: args.query
    };
  }

  throw new Error(`Unknown search tool: ${tool}`);
}

export default { execute };
