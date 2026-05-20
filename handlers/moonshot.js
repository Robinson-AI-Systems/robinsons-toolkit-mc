/**
 * Moonshot AI (Kimi) Handler — 22 tools
 * Chat completions, long-context (128K), file upload/parse, vision,
 * function calling, embeddings, account balance, and Super Tools.
 * API base: https://api.moonshot.cn/v1 (OpenAI-compatible)
 */

const BASE = 'https://api.moonshot.cn/v1';

function headers() {
  const key = process.env.MOONSHOT_API_KEY;
  if (!key) throw new Error('MOONSHOT_API_KEY not set in .env');
  return { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function moon(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Moonshot API ${res.status}: ${err.error?.message || res.statusText}`);
  }
  return await res.json();
}

async function execute(tool, args) {

  // ── MODELS ────────────────────────────────────────────────────────────────
  if (tool === 'moonshot_list_models') {
    const data = await moon('GET', '/models');
    return (data.data || []).map(m => ({ id: m.id, owned_by: m.owned_by }));
  }

  // ── CHAT COMPLETIONS ─────────────────────────────────────────────────────
  if (tool === 'moonshot_chat') {
    const { messages, model = 'moonshot-v1-8k', temperature = 0.6, max_tokens = 2048, system } = args;
    if (!messages?.length) throw new Error('messages array is required');
    const msgs = system ? [{ role: 'system', content: system }, ...messages] : messages;
    const data = await moon('POST', '/chat/completions', { model, messages: msgs, temperature, max_tokens });
    const choice = data.choices?.[0];
    return {
      content: choice?.message?.content || '',
      finish_reason: choice?.finish_reason,
      model: data.model,
      usage: data.usage
    };
  }

  if (tool === 'moonshot_chat_json') {
    const { messages, model = 'moonshot-v1-8k', temperature = 0.3, max_tokens = 2048, system } = args;
    if (!messages?.length) throw new Error('messages array is required');
    const msgs = system ? [{ role: 'system', content: system }, ...messages] : messages;
    const data = await moon('POST', '/chat/completions', {
      model, messages: msgs, temperature, max_tokens,
      response_format: { type: 'json_object' }
    });
    const raw = data.choices?.[0]?.message?.content || '{}';
    try {
      return { parsed: JSON.parse(raw), raw, usage: data.usage };
    } catch {
      return { parsed: null, raw, parse_error: 'Response was not valid JSON', usage: data.usage };
    }
  }

  if (tool === 'moonshot_chat_long') {
    // Uses moonshot-v1-128k for massive document processing
    const { messages, system, temperature = 0.6, max_tokens = 4096 } = args;
    if (!messages?.length) throw new Error('messages array is required');
    const msgs = system ? [{ role: 'system', content: system }, ...messages] : messages;
    const data = await moon('POST', '/chat/completions', {
      model: 'moonshot-v1-128k', messages: msgs, temperature, max_tokens
    });
    const choice = data.choices?.[0];
    return {
      content: choice?.message?.content || '',
      finish_reason: choice?.finish_reason,
      usage: data.usage
    };
  }

  // ── VISION ────────────────────────────────────────────────────────────────
  if (tool === 'moonshot_vision_chat') {
    const { prompt, image_url, image_base64, image_media_type = 'image/jpeg', model = 'moonshot-v1-8k-vision-preview' } = args;
    if (!prompt) throw new Error('prompt is required');
    if (!image_url && !image_base64) throw new Error('image_url or image_base64 is required');
    const imageContent = image_url
      ? { type: 'image_url', image_url: { url: image_url } }
      : { type: 'image_url', image_url: { url: `data:${image_media_type};base64,${image_base64}` } };
    const data = await moon('POST', '/chat/completions', {
      model,
      messages: [{ role: 'user', content: [imageContent, { type: 'text', text: prompt }] }]
    });
    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage
    };
  }

  // ── FUNCTION CALLING ──────────────────────────────────────────────────────
  if (tool === 'moonshot_function_call') {
    const { messages, tools: toolDefs, model = 'moonshot-v1-8k', temperature = 0.3 } = args;
    if (!messages?.length) throw new Error('messages array is required');
    if (!toolDefs?.length) throw new Error('tools array is required');
    const data = await moon('POST', '/chat/completions', {
      model, messages, tools: toolDefs, tool_choice: 'auto', temperature
    });
    const choice = data.choices?.[0];
    return {
      content: choice?.message?.content || null,
      tool_calls: choice?.message?.tool_calls || [],
      finish_reason: choice?.finish_reason,
      usage: data.usage
    };
  }

  // ── EMBEDDINGS ────────────────────────────────────────────────────────────
  if (tool === 'moonshot_embed_text') {
    const { text, model = 'moonshot-v1-embedding' } = args;
    if (!text) throw new Error('text is required');
    const input = Array.isArray(text) ? text : [text];
    const data = await moon('POST', '/embeddings', { model, input });
    const embeddings = (data.data || []).map(e => e.embedding);
    return {
      embeddings: Array.isArray(text) ? embeddings : embeddings[0],
      model: data.model,
      usage: data.usage
    };
  }

  // ── FILES ─────────────────────────────────────────────────────────────────
  if (tool === 'moonshot_upload_file') {
    const { file_content, filename, purpose = 'file-extract' } = args;
    if (!file_content || !filename) throw new Error('file_content (base64 or text) and filename are required');
    // Moonshot files API accepts multipart
    const key = process.env.MOONSHOT_API_KEY;
    const blob = new Blob([file_content], { type: 'application/octet-stream' });
    const form = new FormData();
    form.append('file', blob, filename);
    form.append('purpose', purpose);
    const res = await fetch(`${BASE}/files`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}` },
      body: form
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Moonshot file upload ${res.status}: ${err.error?.message || res.statusText}`);
    }
    return await res.json();
  }

  if (tool === 'moonshot_list_files') {
    const data = await moon('GET', '/files');
    return data.data || [];
  }

  if (tool === 'moonshot_get_file') {
    const { file_id } = args;
    if (!file_id) throw new Error('file_id is required');
    return await moon('GET', `/files/${file_id}`);
  }

  if (tool === 'moonshot_delete_file') {
    const { file_id } = args;
    if (!file_id) throw new Error('file_id is required');
    return await moon('DELETE', `/files/${file_id}`);
  }

  if (tool === 'moonshot_get_file_content') {
    // Extract text from an uploaded file
    const { file_id } = args;
    if (!file_id) throw new Error('file_id is required');
    const data = await moon('GET', `/files/${file_id}/content`);
    // Returns array of content items
    return {
      file_id,
      content: Array.isArray(data) ? data.map(c => c.text || '').join('\n') : (data.content || JSON.stringify(data))
    };
  }

  // ── ACCOUNT ───────────────────────────────────────────────────────────────
  if (tool === 'moonshot_get_balance') {
    return await moon('GET', '/users/me/balance');
  }

  if (tool === 'moonshot_list_usage') {
    const { year, month } = args;
    let path = '/users/me/usage';
    if (year && month) path += `?year=${year}&month=${month}`;
    return await moon('GET', path);
  }

  // ── SUPER TOOLS ───────────────────────────────────────────────────────────

  if (tool === 'moonshot_parse_document') {
    // Upload a file and immediately extract its text content in one call
    const { file_content, filename } = args;
    if (!file_content || !filename) throw new Error('file_content and filename are required');
    // 1. Upload
    const key = process.env.MOONSHOT_API_KEY;
    const blob = new Blob([file_content], { type: 'application/octet-stream' });
    const form = new FormData();
    form.append('file', blob, filename);
    form.append('purpose', 'file-extract');
    const uploadRes = await fetch(`${BASE}/files`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}` },
      body: form
    });
    if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.statusText}`);
    const uploaded = await uploadRes.json();
    const file_id = uploaded.id;
    // 2. Extract content
    const contentData = await moon('GET', `/files/${file_id}/content`);
    const extracted = Array.isArray(contentData)
      ? contentData.map(c => c.text || '').join('\n')
      : (contentData.content || JSON.stringify(contentData));
    return { file_id, filename, extracted_text: extracted, char_count: extracted.length };
  }

  if (tool === 'moonshot_long_context_summarize') {
    // Summarize a large document using moonshot-v1-128k
    const { text, format = 'structured', language = 'English' } = args;
    if (!text) throw new Error('text is required');
    const prompt = format === 'structured'
      ? `Please provide a structured summary of the following document in ${language}. Include: 1) Main topic/purpose, 2) Key points (bullet list), 3) Important details, 4) Conclusions or action items.\n\nDocument:\n${text}`
      : `Please summarize the following document concisely in ${language}:\n\n${text}`;
    const data = await moon('POST', '/chat/completions', {
      model: 'moonshot-v1-128k',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4096
    });
    return {
      summary: data.choices?.[0]?.message?.content || '',
      model: 'moonshot-v1-128k',
      input_chars: text.length,
      usage: data.usage
    };
  }

  if (tool === 'moonshot_compare_documents') {
    // Compare two documents and return a structured comparison
    const { doc1, doc2, comparison_focus = 'key differences and similarities' } = args;
    if (!doc1 || !doc2) throw new Error('doc1 and doc2 are required');
    const prompt = `Compare the following two documents focusing on ${comparison_focus}. Provide a structured analysis:\n\n## Document 1\n${doc1}\n\n## Document 2\n${doc2}`;
    const data = await moon('POST', '/chat/completions', {
      model: 'moonshot-v1-128k',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4096
    });
    return {
      comparison: data.choices?.[0]?.message?.content || '',
      usage: data.usage
    };
  }

  throw new Error(`Unknown moonshot tool: ${tool}`);
}

export default { execute };
