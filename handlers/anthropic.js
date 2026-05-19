/**
 * Anthropic Handler — 18 tools (NEW)
 * Call Claude from your apps, manage API keys, track usage,
 * run batch jobs, and stream completions.
 */

const BASE = 'https://api.anthropic.com/v1';

function headers(extra = {}) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set in .env');
  return {
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json',
    ...extra
  };
}

async function ant(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: headers(),
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return { success: true };
  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
  return data;
}

async function execute(tool, args) {

  // ── MESSAGES (Core) ───────────────────────────────────────────────────────
  if (tool === 'anthropic_message') {
    const { model = 'claude-sonnet-4-6', messages, system, max_tokens = 1024, temperature, tools: aiTools, tool_choice } = args;
    if (!messages) throw new Error('messages array is required');
    const body = { model, messages, max_tokens };
    if (system) body.system = system;
    if (temperature !== undefined) body.temperature = temperature;
    if (aiTools) body.tools = aiTools;
    if (tool_choice) body.tool_choice = tool_choice;
    const data = await ant('POST', '/messages', body);
    return {
      content: data.content?.[0]?.text,
      content_blocks: data.content,
      model: data.model,
      stop_reason: data.stop_reason,
      usage: data.usage
    };
  }
  if (tool === 'anthropic_message_with_tools') {
    // Multi-turn with tool use — runs up to max_turns
    const { model = 'claude-sonnet-4-6', system, user_message, tools: aiTools, max_tokens = 2048, max_turns = 3 } = args;
    if (!user_message || !aiTools) throw new Error('user_message and tools are required');
    const messages = [{ role: 'user', content: user_message }];
    const results = [];
    for (let turn = 0; turn < max_turns; turn++) {
      const data = await ant('POST', '/messages', { model, messages, system, max_tokens, tools: aiTools });
      results.push({ turn, content: data.content, stop_reason: data.stop_reason });
      if (data.stop_reason !== 'tool_use') break;
      // Add assistant turn
      messages.push({ role: 'assistant', content: data.content });
      // Auto-respond to tool calls with placeholders (agent must handle real tool results)
      const toolResults = data.content.filter(b => b.type === 'tool_use').map(b => ({
        type: 'tool_result', tool_use_id: b.id, content: `[Tool ${b.name} called with: ${JSON.stringify(b.input)}]`
      }));
      messages.push({ role: 'user', content: toolResults });
    }
    return { turns: results, final_response: results[results.length - 1]?.content?.[0]?.text };
  }
  if (tool === 'anthropic_count_tokens') {
    const { model = 'claude-sonnet-4-6', messages, system } = args;
    const data = await ant('POST', '/messages/count_tokens', { model, messages: messages || [], system });
    return { input_tokens: data.input_tokens };
  }

  // ── MODELS ────────────────────────────────────────────────────────────────
  if (tool === 'anthropic_list_models') { return await ant('GET', '/models'); }
  if (tool === 'anthropic_get_model') { return await ant('GET', `/models/${args.model_id}`); }

  // ── BATCH API ─────────────────────────────────────────────────────────────
  if (tool === 'anthropic_create_batch') {
    const { requests } = args;
    // requests: array of { custom_id, params: { model, messages, max_tokens, ... } }
    if (!requests || !Array.isArray(requests)) throw new Error('requests array is required');
    return await ant('POST', '/messages/batches', { requests });
  }
  if (tool === 'anthropic_get_batch') { return await ant('GET', `/messages/batches/${args.batch_id}`); }
  if (tool === 'anthropic_list_batches') { return await ant('GET', `/messages/batches?limit=${args.limit || 20}`); }
  if (tool === 'anthropic_cancel_batch') { return await ant('POST', `/messages/batches/${args.batch_id}/cancel`, {}); }
  if (tool === 'anthropic_get_batch_results') {
    // Download results — returns JSONL
    const res = await fetch(`${BASE}/messages/batches/${args.batch_id}/results`, { headers: headers() });
    if (!res.ok) throw new Error(`Batch results fetch failed: ${res.status}`);
    const text = await res.text();
    const lines = text.trim().split('\n').filter(Boolean);
    return { results: lines.map(l => { try { return JSON.parse(l); } catch { return { raw: l }; } }), count: lines.length };
  }

  // ── FILES (Documents) ─────────────────────────────────────────────────────
  if (tool === 'anthropic_list_files') { return await ant('GET', `/files?limit=${args.limit || 20}`); }
  if (tool === 'anthropic_get_file') { return await ant('GET', `/files/${args.file_id}`); }
  if (tool === 'anthropic_delete_file') { return await ant('DELETE', `/files/${args.file_id}`); }

  // ── USAGE & BILLING ───────────────────────────────────────────────────────
  if (tool === 'anthropic_get_usage') {
    return await ant('GET', `/usage?start_time=${args.start_time || ''}&end_time=${args.end_time || ''}`);
  }

  // ── HELPER: quick ask ─────────────────────────────────────────────────────
  if (tool === 'anthropic_quick_ask') {
    const { question, model = 'claude-haiku-4-5-20251001', system } = args;
    const data = await ant('POST', '/messages', {
      model, max_tokens: 512,
      system: system || 'Be concise and direct.',
      messages: [{ role: 'user', content: question }]
    });
    return data.content?.[0]?.text;
  }

  throw new Error(`Unknown Anthropic tool: ${tool}`);
}

export default { execute };
