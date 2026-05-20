/**
 * Gemini Handler — 15 tools
 * Native Google Gemini API client built on fetch (no SDK dependency).
 * Covers: text generation, structured JSON output, code execution, grounded
 * search, multimodal file analysis, image generation, spatial reasoning,
 * text-to-speech, embeddings, context caching, batching, long-running
 * deep-research operations, and model discovery.
 */

import { readFileSync, writeFileSync } from 'fs';

const BASE = 'https://generativelanguage.googleapis.com';
const DEFAULT_MODEL = 'gemini-2.5-flash';

function apiKey() {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error('GEMINI_API_KEY not set in .env');
  return k;
}

function explain(status, data) {
  const raw = data?.error?.message || (typeof data === 'string' ? data : JSON.stringify(data || {}).slice(0, 400));
  if (status === 401 || status === 403) {
    return `Gemini ${status}: ${raw} — verify GEMINI_API_KEY is valid, the Generative Language API is enabled, and (for cachedContents/batches) billing is activated on your Google Cloud project.`;
  }
  if (status === 429) {
    return `Gemini 429: ${raw} — rate or quota limit hit. Back off and retry, or check your project's quota in AI Studio.`;
  }
  if (status === 404) {
    return `Gemini 404: ${raw} — model name or resource path not found (use gemini_list_models to enumerate available models).`;
  }
  if (status >= 500) {
    return `Gemini ${status}: upstream server error — ${raw}. Safe to retry with backoff.`;
  }
  return `Gemini ${status}: ${raw}`;
}

async function gem(method, path, body, opts = {}) {
  const url = `${BASE}${path}`;
  const headers = { 'x-goog-api-key': apiKey(), ...(opts.headers || {}) };
  if (body != null && !opts.raw) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body == null ? undefined : (opts.raw ? body : JSON.stringify(body))
    });
  } catch (e) {
    throw new Error(`Gemini network error (${method} ${path}): ${e.message}`);
  }
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(explain(res.status, data));
  return data;
}

// Two-phase resumable upload to the Files API
async function uploadFile(buffer, mimeType, displayName = 'upload') {
  const startRes = await fetch(`${BASE}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey(),
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(buffer.length),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ file: { display_name: displayName } })
  });
  if (!startRes.ok) {
    const t = await startRes.text();
    throw new Error(explain(startRes.status, t));
  }
  const uploadUrl = startRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('Gemini Files API did not return an upload URL');
  const finishRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(buffer.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize'
    },
    body: buffer
  });
  const finalText = await finishRes.text();
  let final;
  try { final = JSON.parse(finalText); } catch { final = finalText; }
  if (!finishRes.ok) throw new Error(explain(finishRes.status, final));
  return final.file || final;
}

function bufferFromArgs(args) {
  if (args.file_base64) return Buffer.from(args.file_base64, 'base64');
  if (args.file_path) return readFileSync(args.file_path);
  throw new Error('Provide either file_base64 (base64 string) or file_path (local path)');
}

async function execute(tool, args) {

  // ── 1. STANDARD QUERY ─────────────────────────────────────────────────────
  if (tool === 'gemini_standard_query') {
    const { prompt, model = DEFAULT_MODEL, system_instruction, temperature, max_tokens } = args;
    if (!prompt) throw new Error('prompt is required');
    const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
    if (system_instruction) body.systemInstruction = { parts: [{ text: system_instruction }] };
    const gc = {};
    if (temperature !== undefined) gc.temperature = temperature;
    if (max_tokens !== undefined) gc.maxOutputTokens = max_tokens;
    if (Object.keys(gc).length) body.generationConfig = gc;
    const data = await gem('POST', `/v1beta/models/${model}:generateContent`, body);
    return {
      text: data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n'),
      finish_reason: data.candidates?.[0]?.finishReason,
      usage: data.usageMetadata,
      model
    };
  }

  // ── 2. STRUCTURED EXTRACTOR (JSON-schema constrained) ─────────────────────
  if (tool === 'gemini_structured_extractor') {
    const { prompt, json_schema, model = DEFAULT_MODEL, system_instruction } = args;
    if (!prompt || !json_schema) throw new Error('prompt and json_schema are required');
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: json_schema
      }
    };
    if (system_instruction) body.systemInstruction = { parts: [{ text: system_instruction }] };
    const data = await gem('POST', `/v1beta/models/${model}:generateContent`, body);
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { /* leave raw for caller */ }
    return { json: parsed, raw, usage: data.usageMetadata, model };
  }

  // ── 3. CODE EXECUTION ENGINE ──────────────────────────────────────────────
  if (tool === 'gemini_code_execution_engine') {
    const { prompt, model = DEFAULT_MODEL } = args;
    if (!prompt) throw new Error('prompt is required');
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ codeExecution: {} }]
    };
    const data = await gem('POST', `/v1beta/models/${model}:generateContent`, body);
    const parts = data.candidates?.[0]?.content?.parts || [];
    return {
      text: parts.map(p => p.text).filter(Boolean).join('\n'),
      executable_code: parts.filter(p => p.executableCode).map(p => p.executableCode),
      execution_result: parts.filter(p => p.codeExecutionResult).map(p => p.codeExecutionResult),
      usage: data.usageMetadata,
      model
    };
  }


  // ── 4. GROUNDED QUERY (Google Search retrieval) ───────────────────────────
  if (tool === 'gemini_grounded_query') {
    const { prompt, model = DEFAULT_MODEL } = args;
    if (!prompt) throw new Error('prompt is required');
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }]
    };
    const data = await gem('POST', `/v1beta/models/${model}:generateContent`, body);
    const cand = data.candidates?.[0];
    return {
      text: cand?.content?.parts?.map(p => p.text).filter(Boolean).join('\n'),
      grounding_metadata: cand?.groundingMetadata,
      citations: (cand?.groundingMetadata?.groundingChunks || []).map(c => c.web).filter(Boolean),
      usage: data.usageMetadata,
      model
    };
  }

  // ── 5. ANALYZE MEDIA (multimodal via Files API) ───────────────────────────
  if (tool === 'gemini_analyze_media') {
    const { prompt, mime_type, model = DEFAULT_MODEL, display_name } = args;
    if (!prompt || !mime_type) throw new Error('prompt and mime_type are required');
    const buf = bufferFromArgs(args);
    const file = await uploadFile(buf, mime_type, display_name || 'media');
    const body = {
      contents: [{ role: 'user', parts: [
        { fileData: { fileUri: file.uri, mimeType: mime_type } },
        { text: prompt }
      ]}]
    };
    const data = await gem('POST', `/v1beta/models/${model}:generateContent`, body);
    return {
      text: data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n'),
      file_uri: file.uri,
      file_name: file.name,
      usage: data.usageMetadata,
      model
    };
  }

  // ── 6. GENERATE IMAGE (Imagen / Gemini image models) ──────────────────────
  if (tool === 'gemini_generate_image') {
    const { prompt, output_path, model = 'imagen-3.0-generate-002', number_of_images = 1, aspect_ratio = '1:1' } = args;
    if (!prompt || !output_path) throw new Error('prompt and output_path are required');
    const body = {
      instances: [{ prompt }],
      parameters: { sampleCount: number_of_images, aspectRatio: aspect_ratio }
    };
    const data = await gem('POST', `/v1beta/models/${model}:predict`, body);
    const preds = data.predictions || [];
    const saved = [];
    preds.forEach((p, i) => {
      const b64 = p.bytesBase64Encoded || p.image?.bytesBase64Encoded;
      if (!b64) return;
      const path = preds.length === 1 ? output_path : output_path.replace(/(\.[^.]+)?$/, `_${i + 1}$1`);
      writeFileSync(path, Buffer.from(b64, 'base64'));
      saved.push(path);
    });
    return { saved, count: saved.length, model };
  }

  // ── 7. SPATIAL ANALYSIS (bounding boxes 0-1000 normalized) ────────────────
  if (tool === 'gemini_spatial_analysis') {
    const { prompt, mime_type = 'image/png', model = 'gemini-2.5-pro', target_objects } = args;
    const buf = bufferFromArgs(args);
    const ask = prompt || `Detect ${target_objects || 'all prominent objects'} and return a JSON array of {label, box_2d:[ymin,xmin,ymax,xmax]} where box_2d coordinates are normalized to the 0-1000 range.`;
    const body = {
      contents: [{ role: 'user', parts: [
        { inlineData: { mimeType: mime_type, data: buf.toString('base64') } },
        { text: ask }
      ]}],
      generationConfig: { responseMimeType: 'application/json' }
    };
    const data = await gem('POST', `/v1beta/models/${model}:generateContent`, body);
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    let detections = null;
    try { detections = JSON.parse(raw); } catch { /* leave raw for caller */ }
    return { detections, raw, usage: data.usageMetadata, model };
  }

  // ── 8. TEXT TO SPEECH (native Gemini TTS) ─────────────────────────────────
  if (tool === 'gemini_text_to_speech') {
    const { text, output_path, voice = 'Kore', model = 'gemini-2.5-flash-preview-tts' } = args;
    if (!text || !output_path) throw new Error('text and output_path are required');
    const body = {
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
      }
    };
    const data = await gem('POST', `/v1beta/models/${model}:generateContent`, body);
    const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!part) throw new Error('No audio data returned by TTS endpoint');
    writeFileSync(output_path, Buffer.from(part.inlineData.data, 'base64'));
    return { saved: output_path, mime_type: part.inlineData.mimeType, voice, model };
  }

  // ── 9. EMBEDDINGS ─────────────────────────────────────────────────────────
  if (tool === 'gemini_generate_embeddings') {
    const { text, model = 'text-embedding-004', task_type } = args;
    if (text === undefined || text === null) throw new Error('text is required (string or array of strings)');
    if (Array.isArray(text)) {
      const requests = text.map(t => ({
        model: `models/${model}`,
        content: { parts: [{ text: t }] },
        ...(task_type ? { taskType: task_type } : {})
      }));
      const data = await gem('POST', `/v1beta/models/${model}:batchEmbedContents`, { requests });
      return { embeddings: (data.embeddings || []).map(e => e.values), count: data.embeddings?.length || 0, model };
    }
    const body = { content: { parts: [{ text }] } };
    if (task_type) body.taskType = task_type;
    const data = await gem('POST', `/v1beta/models/${model}:embedContent`, body);
    return { embedding: data.embedding?.values, dimensions: data.embedding?.values?.length, model };
  }


  // ── 10. CACHE DOCUMENT (Context Caching) ──────────────────────────────────
  if (tool === 'gemini_cache_document') {
    const { contents, model = 'gemini-2.5-flash', system_instruction, ttl_seconds = 3600, display_name } = args;
    if (!contents) throw new Error('contents is required');
    const body = {
      model: `models/${model}`,
      contents,
      ttl: `${ttl_seconds}s`
    };
    if (system_instruction) body.systemInstruction = { parts: [{ text: system_instruction }] };
    if (display_name) body.displayName = display_name;
    try {
      const data = await gem('POST', '/v1beta/cachedContents', body);
      return { cache_name: data.name, model: data.model, expire_time: data.expireTime, usage: data.usageMetadata };
    } catch (e) {
      if (/\b403\b/.test(e.message)) {
        return {
          ok: false,
          error: 'cached_contents_requires_billing',
          detail: e.message,
          hint: 'The cachedContents endpoint requires a paid-tier Google Cloud project. Enable billing and retry.'
        };
      }
      throw e;
    }
  }

  // ── 11. BATCH PROCESSOR (client-side fan-out with concurrency) ────────────
  if (tool === 'gemini_batch_processor') {
    const { prompts, model = DEFAULT_MODEL, concurrency = 4, system_instruction } = args;
    if (!Array.isArray(prompts) || !prompts.length) throw new Error('prompts must be a non-empty array');
    const results = new Array(prompts.length);
    let next = 0;
    async function worker() {
      while (true) {
        const i = next++;
        if (i >= prompts.length) return;
        const body = { contents: [{ role: 'user', parts: [{ text: prompts[i] }] }] };
        if (system_instruction) body.systemInstruction = { parts: [{ text: system_instruction }] };
        try {
          const d = await gem('POST', `/v1beta/models/${model}:generateContent`, body);
          results[i] = {
            ok: true,
            text: d.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n'),
            usage: d.usageMetadata
          };
        } catch (e) {
          results[i] = { ok: false, error: e.message };
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, prompts.length) }, worker));
    return {
      results,
      total: results.length,
      succeeded: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length
    };
  }

  // ── 12. DEEP RESEARCH START (long-running batchGenerateContent) ───────────
  if (tool === 'gemini_deep_research_start') {
    const { requests, model = DEFAULT_MODEL, display_name } = args;
    if (!Array.isArray(requests) || !requests.length) throw new Error('requests array is required');
    const body = {
      batch: {
        displayName: display_name || `batch_${Date.now()}`,
        inputConfig: {
          requests: {
            requests: requests.map((r, i) => ({
              metadata: { key: String(i) },
              request: r.request || {
                contents: r.contents || [{ role: 'user', parts: [{ text: r.prompt }] }]
              }
            }))
          }
        }
      }
    };
    const data = await gem('POST', `/v1beta/models/${model}:batchGenerateContent`, body);
    return { operation_name: data.name, metadata: data.metadata, done: data.done || false };
  }

  // ── 13. DEEP RESEARCH STATUS (poll long-running operation) ────────────────
  if (tool === 'gemini_deep_research_status') {
    const { operation_name } = args;
    if (!operation_name) throw new Error('operation_name is required');
    const stem = operation_name.replace(/^\/?v1beta\//, '');
    const data = await gem('GET', `/v1beta/${stem}`);
    return {
      operation_name: data.name,
      done: !!data.done,
      metadata: data.metadata,
      response: data.response,
      error: data.error
    };
  }

  // ── 14. CANCEL BATCH JOB (cancel-or-delete long-running operation) ────────
  if (tool === 'gemini_cancel_batch_job') {
    const { operation_name } = args;
    if (!operation_name) throw new Error('operation_name is required');
    const stem = operation_name.replace(/^\/?v1beta\//, '');
    try {
      const data = await gem('POST', `/v1beta/${stem}:cancel`, {});
      return { cancelled: true, operation_name, response: data };
    } catch (cancelErr) {
      try {
        const data = await gem('DELETE', `/v1beta/${stem}`);
        return { deleted: true, operation_name, response: data };
      } catch (deleteErr) {
        return {
          ok: false,
          error: `Cancel failed: ${cancelErr.message}. Delete also failed: ${deleteErr.message}`
        };
      }
    }
  }

  // ── 15. LIST MODELS (enumerate available models + context limits) ─────────
  if (tool === 'gemini_list_models') {
    const { page_size = 50, page_token } = args;
    const qs = new URLSearchParams({ pageSize: String(page_size) });
    if (page_token) qs.set('pageToken', page_token);
    const data = await gem('GET', `/v1beta/models?${qs.toString()}`);
    return {
      models: (data.models || []).map(m => ({
        name: m.name,
        display_name: m.displayName,
        version: m.version,
        input_token_limit: m.inputTokenLimit,
        output_token_limit: m.outputTokenLimit,
        supported_methods: m.supportedGenerationMethods
      })),
      count: data.models?.length || 0,
      next_page_token: data.nextPageToken
    };
  }

  throw new Error(`Unknown gemini tool: ${tool}`);
}

export default { execute };
