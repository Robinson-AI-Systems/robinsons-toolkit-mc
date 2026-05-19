/**
 * OpenAI Handler — 50 tools
 * Chat completions, embeddings, images, audio, assistants, files,
 * fine-tuning, moderation, and vector stores.
 */

const BASE = 'https://api.openai.com/v1';

function headers(contentType = 'application/json') {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set in .env');
  const h = { 'Authorization': `Bearer ${key}` };
  if (contentType) h['Content-Type'] = contentType;
  return h;
}

async function oai(method, path, body, isMultipart = false) {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: isMultipart ? { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } : headers(),
    body: isMultipart ? body : (body ? JSON.stringify(body) : undefined)
  });
  if (res.status === 204) return { success: true };
  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
  return data;
}

async function execute(tool, args) {

  // ── CHAT COMPLETIONS ──────────────────────────────────────────────────────
  if (tool === 'openai_chat_completion') {
    const { model = 'gpt-4o', messages, temperature, max_tokens, system, response_format, tools: aiTools, tool_choice } = args;
    if (!messages && !system) throw new Error('messages array or system prompt is required');
    const msgs = messages || [];
    if (system && !msgs.find(m => m.role === 'system')) msgs.unshift({ role: 'system', content: system });
    const body = { model, messages: msgs };
    if (temperature !== undefined) body.temperature = temperature;
    if (max_tokens) body.max_tokens = max_tokens;
    if (response_format) body.response_format = response_format;
    if (aiTools) body.tools = aiTools; if (tool_choice) body.tool_choice = tool_choice;
    const data = await oai('POST', '/chat/completions', body);
    return { content: data.choices?.[0]?.message?.content, finish_reason: data.choices?.[0]?.finish_reason, usage: data.usage, model: data.model };
  }
  if (tool === 'openai_chat_completion_json') {
    const { model = 'gpt-4o', messages, system, temperature } = args;
    const msgs = messages || [];
    if (system) msgs.unshift({ role: 'system', content: system + '\n\nRespond with valid JSON only.' });
    const body = { model, messages: msgs, response_format: { type: 'json_object' } };
    if (temperature !== undefined) body.temperature = temperature;
    const data = await oai('POST', '/chat/completions', body);
    const content = data.choices?.[0]?.message?.content;
    try { return JSON.parse(content); } catch { return { raw: content }; }
  }
  if (tool === 'openai_list_models') { return await oai('GET', '/models'); }
  if (tool === 'openai_get_model') { return await oai('GET', `/models/${args.model_id}`); }
  if (tool === 'openai_delete_model') { return await oai('DELETE', `/models/${args.model_id}`); }

  // ── EMBEDDINGS ────────────────────────────────────────────────────────────
  if (tool === 'openai_create_embedding') {
    const { input, model = 'text-embedding-3-small', dimensions } = args;
    if (!input) throw new Error('input is required');
    const body = { input: Array.isArray(input) ? input : [input], model };
    if (dimensions) body.dimensions = dimensions;
    const data = await oai('POST', '/embeddings', body);
    return { embeddings: data.data?.map(d => d.embedding), model: data.model, usage: data.usage };
  }
  if (tool === 'openai_create_embeddings_batch') {
    const { texts, model = 'text-embedding-3-small' } = args;
    if (!texts || !Array.isArray(texts)) throw new Error('texts array is required');
    const data = await oai('POST', '/embeddings', { input: texts, model });
    return { embeddings: data.data?.map(d => d.embedding), count: data.data?.length, usage: data.usage };
  }

  // ── IMAGES ────────────────────────────────────────────────────────────────
  if (tool === 'openai_generate_image') {
    const { prompt, model = 'dall-e-3', size = '1024x1024', quality = 'standard', n = 1, style = 'vivid', response_format = 'url' } = args;
    if (!prompt) throw new Error('prompt is required');
    const data = await oai('POST', '/images/generations', { prompt, model, size, quality, n, style, response_format });
    return { images: data.data?.map(img => ({ url: img.url, revised_prompt: img.revised_prompt })) };
  }
  if (tool === 'openai_edit_image') {
    // Requires base64-encoded image — return note
    return { note: 'Image editing requires uploading image files. Use the OpenAI SDK or pass base64 image data. See: https://platform.openai.com/docs/api-reference/images/createEdit' };
  }
  if (tool === 'openai_list_image_variations') {
    return { note: 'Image variations requires uploading an image file. See: https://platform.openai.com/docs/api-reference/images/createVariation' };
  }

  // ── AUDIO ─────────────────────────────────────────────────────────────────
  if (tool === 'openai_text_to_speech') {
    const { input, voice = 'alloy', model = 'tts-1', speed = 1, output_file } = args;
    if (!input) throw new Error('input text is required');
    const res = await fetch(`${BASE}/audio/speech`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ model, input, voice, speed })
    });
    if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return { audio_base64: base64, format: 'mp3', size_bytes: buffer.byteLength, note: output_file ? `Save the audio_base64 to ${output_file} using local_write_file with base64 decoding` : 'Audio returned as base64. Use local_write_file to save.' };
  }
  if (tool === 'openai_transcribe_audio') {
    return { note: 'Audio transcription requires an uploaded audio file. This is best done via the OpenAI SDK. Provide a file path and use local_run_command with: node -e "require(\'openai\').transcriptions..."' };
  }

  // ── ASSISTANTS ────────────────────────────────────────────────────────────
  if (tool === 'openai_list_assistants') {
    return await oai('GET', `/assistants?limit=${args.limit || 20}`, null);
  }
  if (tool === 'openai_create_assistant') {
    const { name, instructions, model = 'gpt-4o', tools: aiTools, file_ids } = args;
    const body = { name, instructions, model };
    if (aiTools) body.tools = aiTools; if (file_ids) body.file_ids = file_ids;
    return await oai('POST', '/assistants', body);
  }
  if (tool === 'openai_get_assistant') { return await oai('GET', `/assistants/${args.assistant_id}`); }
  if (tool === 'openai_update_assistant') {
    const { assistant_id, ...updates } = args;
    return await oai('POST', `/assistants/${assistant_id}`, updates);
  }
  if (tool === 'openai_delete_assistant') { return await oai('DELETE', `/assistants/${args.assistant_id}`); }

  // ── THREADS ───────────────────────────────────────────────────────────────
  if (tool === 'openai_create_thread') { return await oai('POST', '/threads', {}); }
  if (tool === 'openai_get_thread') { return await oai('GET', `/threads/${args.thread_id}`); }
  if (tool === 'openai_delete_thread') { return await oai('DELETE', `/threads/${args.thread_id}`); }
  if (tool === 'openai_add_message_to_thread') {
    return await oai('POST', `/threads/${args.thread_id}/messages`, { role: args.role || 'user', content: args.content });
  }
  if (tool === 'openai_list_thread_messages') {
    return await oai('GET', `/threads/${args.thread_id}/messages?limit=${args.limit || 20}`);
  }
  if (tool === 'openai_create_run') {
    const { thread_id, assistant_id, instructions, model, tools: aiTools } = args;
    const body = { assistant_id };
    if (instructions) body.additional_instructions = instructions;
    if (model) body.model = model; if (aiTools) body.tools = aiTools;
    return await oai('POST', `/threads/${thread_id}/runs`, body);
  }
  if (tool === 'openai_get_run') { return await oai('GET', `/threads/${args.thread_id}/runs/${args.run_id}`); }
  if (tool === 'openai_list_runs') { return await oai('GET', `/threads/${args.thread_id}/runs?limit=${args.limit || 20}`); }
  if (tool === 'openai_cancel_run') { return await oai('POST', `/threads/${args.thread_id}/runs/${args.run_id}/cancel`, {}); }
  if (tool === 'openai_create_thread_and_run') {
    const { assistant_id, messages, instructions } = args;
    return await oai('POST', '/threads/runs', { assistant_id, thread: { messages: messages || [] }, additional_instructions: instructions });
  }

  // ── FILES ─────────────────────────────────────────────────────────────────
  if (tool === 'openai_list_files') {
    return await oai('GET', `/files?purpose=${args.purpose || ''}`, null);
  }
  if (tool === 'openai_get_file') { return await oai('GET', `/files/${args.file_id}`); }
  if (tool === 'openai_delete_file') { return await oai('DELETE', `/files/${args.file_id}`); }

  // ── VECTOR STORES ─────────────────────────────────────────────────────────
  if (tool === 'openai_list_vector_stores') {
    return await oai('GET', `/vector_stores?limit=${args.limit || 20}`);
  }
  if (tool === 'openai_create_vector_store') {
    return await oai('POST', '/vector_stores', { name: args.name, file_ids: args.file_ids || [], expires_after: args.expires_after });
  }
  if (tool === 'openai_get_vector_store') { return await oai('GET', `/vector_stores/${args.vector_store_id}`); }
  if (tool === 'openai_delete_vector_store') { return await oai('DELETE', `/vector_stores/${args.vector_store_id}`); }
  if (tool === 'openai_search_vector_store') {
    return await oai('POST', `/vector_stores/${args.vector_store_id}/search`, { query: args.query, max_num_results: args.max_results || 10 });
  }

  // ── FINE-TUNING ───────────────────────────────────────────────────────────
  if (tool === 'openai_list_fine_tuning_jobs') { return await oai('GET', `/fine_tuning/jobs?limit=${args.limit || 20}`); }
  if (tool === 'openai_get_fine_tuning_job') { return await oai('GET', `/fine_tuning/jobs/${args.job_id}`); }
  if (tool === 'openai_create_fine_tuning_job') {
    return await oai('POST', '/fine_tuning/jobs', { training_file: args.training_file_id, model: args.model || 'gpt-4o-mini', hyperparameters: args.hyperparameters });
  }
  if (tool === 'openai_cancel_fine_tuning_job') { return await oai('POST', `/fine_tuning/jobs/${args.job_id}/cancel`, {}); }

  // ── MODERATION ────────────────────────────────────────────────────────────
  if (tool === 'openai_moderate_content') {
    const data = await oai('POST', '/moderations', { input: args.input, model: args.model || 'omni-moderation-latest' });
    return { flagged: data.results?.[0]?.flagged, categories: data.results?.[0]?.categories, scores: data.results?.[0]?.category_scores };
  }

  // ── USAGE ─────────────────────────────────────────────────────────────────
  if (tool === 'openai_get_usage') {
    return await oai('GET', `/usage?date=${args.date || new Date().toISOString().split('T')[0]}`);
  }

  throw new Error(`Unknown OpenAI tool: ${tool}`);
}

export default { execute };
