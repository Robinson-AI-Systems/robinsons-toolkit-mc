/**
 * Ollama Handler — 17 tools
 * Local LLM orchestration via the Ollama REST API.
 * Bridges WSL2 → Windows host via OLLAMA_BASE_URL or the default
 * WSL2 host gateway IP (172.19.16.1:11434).
 *
 * No API key required — always active when Ollama is running.
 * Default model: OLLAMA_DEFAULT_MODEL env var, or qwen2.5-coder:7b.
 *
 * Tools: models, generation, chat, embeddings, management, Super Tools.
 */

const BASE_URL = process.env.OLLAMA_BASE_URL || 'http://172.19.16.1:11434';
const DEFAULT_MODEL = process.env.OLLAMA_DEFAULT_MODEL || 'qwen2.5-coder:7b';
const DEFAULT_TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS || '300000'); // 5 min

// ── HTTP helpers ───────────────────────────────────────────────────────────────

async function ollamaGet(path, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${path}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Ollama ${res.status} at ${path}: ${body.slice(0, 200)}`);
    }
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error(`Ollama GET ${path} timed out after ${timeoutMs}ms`);
    if (e.code === 'ECONNREFUSED' || e.message.includes('fetch failed') || e.message.includes('ECONNREFUSED')) {
      throw new Error(`Cannot reach Ollama at ${BASE_URL}. Is Ollama running on your Windows host? Set OLLAMA_BASE_URL in .env if the host IP differs.`);
    }
    throw e;
  }
}

async function ollamaPost(path, body, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      if (errBody.includes('model') && errBody.includes('not found')) {
        throw new Error(`Model not found: "${body.model}". Run ollama_pull_model to download it, or use ollama_list_models to see what's available.`);
      }
      throw new Error(`Ollama ${res.status} at ${path}: ${errBody.slice(0, 300)}`);
    }
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error(`Ollama POST ${path} timed out after ${timeoutMs / 1000}s. The model may need more time — increase OLLAMA_TIMEOUT_MS.`);
    if (e.code === 'ECONNREFUSED' || e.message.includes('fetch failed') || e.message.includes('ECONNREFUSED')) {
      throw new Error(`Cannot reach Ollama at ${BASE_URL}. Is Ollama running on your Windows host? Set OLLAMA_BASE_URL in .env if the host IP differs.`);
    }
    throw e;
  }
}

async function ollamaDelete(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Ollama DELETE ${path} failed: ${errBody.slice(0, 200)}`);
  }
  // DELETE returns 200 with empty body
  const text = await res.text();
  return text ? JSON.parse(text) : { success: true };
}

// ── Execute ────────────────────────────────────────────────────────────────────

async function execute(tool, args) {

  // ── MODEL MANAGEMENT ──────────────────────────────────────────────────────

  // List all locally installed models
  if (tool === 'ollama_list_models') {
    const data = await ollamaGet('/api/tags');
    const models = (data.models || []).map(m => ({
      name: m.name,
      size_gb: m.size ? (m.size / 1073741824).toFixed(2) + ' GB' : 'unknown',
      modified: m.modified_at,
      family: m.details?.family,
      parameter_size: m.details?.parameter_size,
      quantization: m.details?.quantization_level
    }));
    return { models, count: models.length, base_url: BASE_URL };
  }

  // Pull / download a model from the Ollama registry
  if (tool === 'ollama_pull_model') {
    const { model } = args;
    if (!model) throw new Error('model is required (e.g. "llama3.2:3b", "qwen2.5-coder:7b")');
    const data = await ollamaPost('/api/pull', { model, stream: false }, 600000); // 10 min for large downloads
    return { success: true, model, status: data.status || 'downloaded', base_url: BASE_URL };
  }

  // Push a model to the Ollama registry (requires authentication)
  if (tool === 'ollama_push_model') {
    const { model } = args;
    if (!model) throw new Error('model is required');
    const data = await ollamaPost('/api/push', { model, stream: false }, 600000);
    return { success: true, model, status: data.status };
  }

  // Delete a locally installed model
  if (tool === 'ollama_delete_model') {
    const { model } = args;
    if (!model) throw new Error('model is required');
    await ollamaDelete('/api/delete', { model });
    return { success: true, deleted: model };
  }

  // Copy a model to a new name / alias
  if (tool === 'ollama_copy_model') {
    const { source, destination } = args;
    if (!source || !destination) throw new Error('source and destination model names are required');
    await ollamaPost('/api/copy', { source, destination }, 30000);
    return { success: true, source, destination };
  }

  // Show model details — Modelfile, parameters, template, context size
  if (tool === 'ollama_show_model') {
    const { model } = args;
    if (!model) throw new Error('model is required');
    const data = await ollamaPost('/api/show', { model }, 10000);
    return {
      model,
      modelfile: data.modelfile,
      parameters: data.parameters,
      template: data.template,
      details: data.details,
      model_info: data.model_info
    };
  }

  // Create a new model from a Modelfile string
  if (tool === 'ollama_create_model') {
    const { name, modelfile, path: modelfilePath } = args;
    if (!name) throw new Error('name is required for the new model');
    if (!modelfile && !modelfilePath) throw new Error('modelfile (Modelfile content string) or path is required');
    const body = { name };
    if (modelfile) body.modelfile = modelfile;
    if (modelfilePath) body.path = modelfilePath;
    const data = await ollamaPost('/api/create', { ...body, stream: false }, 600000);
    return { success: true, name, status: data.status };
  }

  // List models currently loaded in VRAM (actively running)
  if (tool === 'ollama_list_running') {
    const data = await ollamaGet('/api/ps');
    const models = (data.models || []).map(m => ({
      name: m.name,
      size_vram: m.size_vram ? (m.size_vram / 1073741824).toFixed(2) + ' GB' : 'unknown',
      expires_at: m.expires_at,
      processor: m.details?.families
    }));
    return { running: models, count: models.length };
  }

  // Ollama version and health check
  if (tool === 'ollama_get_version') {
    const data = await ollamaGet('/api/version');
    return { version: data.version, base_url: BASE_URL };
  }

  // Full health check — version, model count, running models
  if (tool === 'ollama_check_health') {
    const [versionData, tagsData, psData] = await Promise.all([
      ollamaGet('/api/version').catch(e => ({ error: e.message })),
      ollamaGet('/api/tags').catch(e => ({ error: e.message })),
      ollamaGet('/api/ps').catch(() => ({ models: [] }))
    ]);
    const healthy = !versionData.error && !tagsData.error;
    return {
      healthy,
      base_url: BASE_URL,
      version: versionData.version || null,
      connection_error: versionData.error || tagsData.error || null,
      installed_models: (tagsData.models || []).length,
      running_models: (psData.models || []).length,
      default_model: DEFAULT_MODEL,
      timeout_ms: DEFAULT_TIMEOUT_MS
    };
  }

  // ── GENERATION ────────────────────────────────────────────────────────────

  // Single-turn text generation (completion)
  if (tool === 'ollama_generate') {
    const {
      model = DEFAULT_MODEL, prompt, system_instruction,
      temperature, top_p, top_k, num_predict, repeat_penalty,
      timeout_ms = DEFAULT_TIMEOUT_MS
    } = args;
    if (!prompt) throw new Error('prompt is required');

    const body = { model, prompt, stream: false };
    if (system_instruction) body.system = system_instruction;
    if (temperature !== undefined || top_p !== undefined || top_k !== undefined || num_predict !== undefined || repeat_penalty !== undefined) {
      body.options = {};
      if (temperature !== undefined) body.options.temperature = temperature;
      if (top_p !== undefined) body.options.top_p = top_p;
      if (top_k !== undefined) body.options.top_k = top_k;
      if (num_predict !== undefined) body.options.num_predict = num_predict;
      if (repeat_penalty !== undefined) body.options.repeat_penalty = repeat_penalty;
    }

    const data = await ollamaPost('/api/generate', body, timeout_ms);
    return {
      text: data.response,
      model: data.model,
      done: data.done,
      tokens_generated: data.eval_count,
      tokens_prompt: data.prompt_eval_count,
      duration_s: data.eval_duration ? (data.eval_duration / 1e9).toFixed(2) : null
    };
  }

  // Multi-turn chat completion (supports full message history)
  if (tool === 'ollama_chat') {
    const {
      model = DEFAULT_MODEL, messages, system_instruction,
      temperature, num_predict, timeout_ms = DEFAULT_TIMEOUT_MS
    } = args;
    if (!messages?.length) throw new Error('messages array is required — each item: {role: "user"|"assistant"|"system", content: "..."}');

    const fullMessages = [...messages];
    if (system_instruction && !fullMessages.find(m => m.role === 'system')) {
      fullMessages.unshift({ role: 'system', content: system_instruction });
    }

    const body = { model, messages: fullMessages, stream: false };
    if (temperature !== undefined || num_predict !== undefined) {
      body.options = {};
      if (temperature !== undefined) body.options.temperature = temperature;
      if (num_predict !== undefined) body.options.num_predict = num_predict;
    }

    const data = await ollamaPost('/api/chat', body, timeout_ms);
    return {
      text: data.message?.content,
      role: data.message?.role,
      model: data.model,
      done: data.done,
      tokens_generated: data.eval_count,
      tokens_prompt: data.prompt_eval_count,
      duration_s: data.eval_duration ? (data.eval_duration / 1e9).toFixed(2) : null
    };
  }

  // Generate embeddings (use with pgvector for local RAG — zero API costs)
  if (tool === 'ollama_embed') {
    const { model = DEFAULT_MODEL, input, prompt, timeout_ms = 30000 } = args;
    const text = input || prompt;
    if (!text) throw new Error('input (or prompt) is required — a string or array of strings');

    // /api/embed is the newer endpoint, /api/embeddings is the legacy one
    const isArray = Array.isArray(text);
    let data;
    try {
      data = await ollamaPost('/api/embed', { model, input: text }, timeout_ms);
      const embeddings = data.embeddings || [];
      return {
        model: data.model,
        embeddings: isArray ? embeddings : embeddings[0],
        dimensions: embeddings[0]?.length,
        count: embeddings.length
      };
    } catch (e) {
      // Fall back to legacy /api/embeddings endpoint for older Ollama versions
      const legacyData = await ollamaPost('/api/embeddings', { model, prompt: isArray ? text[0] : text }, timeout_ms);
      return {
        model,
        embeddings: legacyData.embedding,
        dimensions: legacyData.embedding?.length,
        count: 1,
        note: 'Used legacy /api/embeddings endpoint — upgrade Ollama for batch embeddings'
      };
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SUPER TOOLS — High-level orchestration utilities
  // ══════════════════════════════════════════════════════════════════════════

  // SUPER: Code completion — tuned defaults for qwen2.5-coder
  if (tool === 'ollama_code_complete') {
    const { model = DEFAULT_MODEL, code, instruction, language, timeout_ms = DEFAULT_TIMEOUT_MS } = args;
    if (!code && !instruction) throw new Error('code or instruction is required');
    const langHint = language ? `Language: ${language}\n` : '';
    const system = `You are an expert software engineer. Write clean, production-quality code. Return ONLY code, no explanations unless asked.`;
    const prompt = code
      ? `${langHint}Complete or improve the following code:\n\`\`\`\n${code}\n\`\`\`\n${instruction || ''}`
      : `${langHint}${instruction}`;
    const data = await ollamaPost('/api/generate', { model, prompt, system, stream: false }, timeout_ms);
    return { code: data.response, model: data.model, tokens: data.eval_count, duration_s: data.eval_duration ? (data.eval_duration / 1e9).toFixed(2) : null };
  }

  // SUPER: Generate and automatically parse structured JSON output
  if (tool === 'ollama_extract_json') {
    const { model = DEFAULT_MODEL, prompt, schema_hint, timeout_ms = DEFAULT_TIMEOUT_MS, max_retries = 2 } = args;
    if (!prompt) throw new Error('prompt is required');
    const system = `You are a data extraction assistant. Always respond with valid JSON and nothing else — no markdown, no code fences, no explanation. Just the raw JSON object or array.`;
    const fullPrompt = schema_hint ? `${prompt}\n\nExpected JSON structure: ${schema_hint}` : prompt;

    for (let attempt = 0; attempt <= max_retries; attempt++) {
      const data = await ollamaPost('/api/generate', { model, prompt: fullPrompt, system, stream: false, format: 'json' }, timeout_ms);
      try {
        const parsed = JSON.parse(data.response.trim());
        return { data: parsed, model: data.model, raw: data.response, attempts: attempt + 1 };
      } catch (parseError) {
        if (attempt === max_retries) {
          return { data: null, error: 'Could not parse JSON after retries', raw: data.response, model: data.model, parse_error: parseError.message };
        }
        // Retry with more explicit instructions
      }
    }
  }

  // SUPER: Agent task — structured prompt with role + task + context for orchestration pipelines
  if (tool === 'ollama_agent_task') {
    const { model = DEFAULT_MODEL, role, task, context, output_format, timeout_ms = DEFAULT_TIMEOUT_MS } = args;
    if (!task) throw new Error('task is required');

    const system = role
      ? `You are ${role}. Be precise, thorough, and directly useful. ${output_format ? `Output format: ${output_format}` : ''}`
      : `You are a helpful AI assistant. Be precise and directly useful. ${output_format ? `Output format: ${output_format}` : ''}`;

    const promptParts = [];
    if (context) promptParts.push(`Context:\n${context}`);
    promptParts.push(`Task:\n${task}`);
    if (output_format) promptParts.push(`Output your response as: ${output_format}`);
    const prompt = promptParts.join('\n\n');

    const data = await ollamaPost('/api/generate', { model, prompt, system, stream: false }, timeout_ms);
    return {
      result: data.response,
      model: data.model,
      role: role || 'assistant',
      tokens: data.eval_count,
      duration_s: data.eval_duration ? (data.eval_duration / 1e9).toFixed(2) : null
    };
  }

  throw new Error(`Unknown Ollama tool: ${tool}. Available tools: ollama_list_models, ollama_generate, ollama_chat, ollama_embed, ollama_pull_model, ollama_show_model, ollama_check_health, and more.`);
}

export default { execute };
