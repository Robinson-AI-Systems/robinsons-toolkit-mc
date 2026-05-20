// Force all standard logs to stderr so they don't corrupt the Claude pipe
console.log = console.error;
/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║         ROBINSON'S TOOLKIT MCP SERVER  v2.0                         ║
 * ║         1400+ tools · 28 categories · Smart discovery               ║
 * ║         GitHub · Vercel · Neon · Fly.io · Stripe · Twilio           ║
 * ║         Resend · Cloudflare · OpenAI · Anthropic · Supabase         ║
 * ║         Mapbox · Clerk · Sentry · Google Workspace · Qdrant         ║
 * ║         Local Machine · Web Search · n8n · Postgres · Docker        ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * ARCHITECTURE: Smart Discovery (Option 2)
 * The agent sees 4 core meta-tools plus ~15 pinned high-value tools.
 * Use search_toolkit to find any of the 1400+ available tools.
 * Use execute_tool to run any tool by name once you know it.
 */

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { appendReceipt } from './ledger.js';
import { inverses } from './inverses.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load all registry JSON files ──────────────────────────────────────────────
function loadRegistry() {
  const registryDir = join(__dirname, 'registry');
  const allTools = [];
  if (!existsSync(registryDir)) return allTools;
  const files = readdirSync(registryDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const content = JSON.parse(readFileSync(join(registryDir, file), 'utf-8'));
      if (Array.isArray(content)) allTools.push(...content);
    } catch (e) {
      console.error(`Registry load error in ${file}:`, e.message);
    }
  }
  return allTools;
}

// ── Load all handlers ──────────────────────────────────────────────────────────
async function loadHandlers() {
  const handlers = {};
  const handlersDir = join(__dirname, 'handlers');
  if (!existsSync(handlersDir)) return handlers;
  const files = readdirSync(handlersDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const mod = await import(join(handlersDir, file).replace(/\\/g, '/'));
      const namespace = file.replace('.js', '');
      if (mod.default && typeof mod.default.execute === 'function') {
        handlers[namespace] = mod.default;
      }
    } catch (e) {
      console.error(`Handler load error in ${file}:`, e.message);
    }
  }
  return handlers;
}

// ── Credential-gated namespace registry ───────────────────────────────────────
function getActiveNamespaces() {
  const namespaces = {};
  const checks = {
    github:     () => !!process.env.GITHUB_TOKEN,
    vercel:     () => !!process.env.VERCEL_TOKEN,
    neon:       () => !!process.env.NEON_API_KEY,
    upstash:    () => !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN,
    fly:        () => !!process.env.FLY_API_TOKEN,
    stripe:     () => !!process.env.STRIPE_SECRET_KEY,
    resend:     () => !!process.env.RESEND_API_KEY,
    twilio:     () => !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN,
    cloudflare: () => !!process.env.CLOUDFLARE_API_TOKEN,
    openai:     () => !!process.env.OPENAI_API_KEY,
    anthropic:  () => !!process.env.ANTHROPIC_API_KEY,
    supabase:   () => !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    mapbox:     () => !!process.env.MAPBOX_ACCESS_TOKEN,
    clerk:      () => !!process.env.CLERK_SECRET_KEY,
    sentry:     () => !!process.env.SENTRY_AUTH_TOKEN,
    brave:      () => !!process.env.BRAVE_SEARCH_API_KEY,
    tavily:     () => !!process.env.TAVILY_API_KEY,
    google:     () => !!process.env.GOOGLE_ACCESS_TOKEN || !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    qdrant:     () => !!process.env.QDRANT_URL,
    n8n:        () => !!process.env.N8N_BASE_URL && !!process.env.N8N_API_KEY,
    postgres:   () => !!process.env.POSTGRES_CONNECTION_STRING,
    context7:   () => !!process.env.CONTEXT7_API_KEY,
    playwright: () => true, // Always available — local browser automation (no API key needed)
    local:      () => true, // Always available — local machine access
    compound:   () => true, // Always available — compound tools use whatever is configured
    ollama:     () => true, // Always available — local Ollama LLM (no API key needed)
  };
  for (const [name, check] of Object.entries(checks)) {
    namespaces[name] = check();
  }
  return namespaces;
}

// ── Tool search (semantic keyword matching) ────────────────────────────────────
function searchTools(registry, query, activeNamespaces, limit = 10) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results = [];

  for (const tool of registry) {
    // Skip tools whose namespace is not active (no credentials)
    const ns = tool.namespace || tool.name.split('_')[0];
    if (activeNamespaces[ns] === false) continue;

    // Score this tool
    const text = `${tool.name} ${tool.description || ''} ${tool.tags?.join(' ') || ''}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (tool.name.toLowerCase().includes(term)) score += 3;
      else if (text.includes(term)) score += 1;
    }
    if (score > 0) results.push({ ...tool, _score: score });
  }

  return results
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...tool }) => tool);
}

// ── Lightweight runtime arg validator (no deps) ────────────────────────────────
// Reads the tool's JSON-Schema-shaped inputSchema from the registry and checks:
//   1. all `required` keys are present
//   2. provided values match the declared type (when type is a primitive)
// Returns null if valid, or a single descriptive error message string.
function validateArgs(toolName, args, registryArr) {
  const tool = registryArr.find(t => t.name === toolName);
  if (!tool || !tool.inputSchema) return null;
  const schema = tool.inputSchema;
  args = args || {};

  // Check required
  if (Array.isArray(schema.required)) {
    for (const key of schema.required) {
      if (args[key] === undefined || args[key] === null) {
        return `Missing required argument "${key}" for ${toolName}. Use get_tool_schema for the full signature.`;
      }
    }
  }

  // Check primitive types
  const props = schema.properties || {};
  for (const [key, val] of Object.entries(args)) {
    const spec = props[key];
    if (!spec || !spec.type) continue;
    const t = spec.type;
    const actual = Array.isArray(val) ? 'array' : (val === null ? 'null' : typeof val);
    let ok;
    switch (t) {
      case 'string':  ok = actual === 'string'; break;
      case 'number':  ok = actual === 'number'; break;
      case 'boolean': ok = actual === 'boolean'; break;
      case 'array':   ok = actual === 'array'; break;
      case 'object':  ok = actual === 'object' && !Array.isArray(val) && val !== null; break;
      default:        ok = true; // unknown / open type
    }
    if (!ok) return `Argument "${key}" for ${toolName} expected ${t}, got ${actual}.`;
    // Enum check
    if (Array.isArray(spec.enum) && !spec.enum.includes(val)) {
      return `Argument "${key}" for ${toolName} must be one of: ${spec.enum.join(', ')}. Got: ${val}`;
    }
  }
  return null;
}

// ── Route a tool call to the right handler ─────────────────────────────────────
async function routeToolCall(toolName, args, handlers, opts = {}) {
  // Validate args against the registry schema BEFORE hitting the network
  const validationError = validateArgs(toolName, args, registry);
  if (validationError) throw new Error(validationError);

  // Determine namespace from tool name prefix
  const parts = toolName.split('_');
  let namespace = parts[0];

  // Map Google sub-service prefixes to the google handler
  if (['gmail','drive','calendar','sheets','docs','slides','tasks','people','admin','forms','chat'].includes(namespace)) {
    namespace = 'google';
  }

  // Map brave/tavily prefixes to the unified search handler
  if (namespace === 'brave' || namespace === 'tavily') namespace = 'search';

  // Map cf_ prefix to the cloudflare handler
  if (namespace === 'cf') namespace = 'cloudflare';

  const handler = handlers[namespace];
  if (!handler) {
    throw new Error(`No handler found for namespace '${namespace}'. Tool: ${toolName}\nAvailable handlers: ${Object.keys(handlers).join(', ')}`);
  }

  const result = await handler.execute(toolName, args || {});

  // ── Observability Ledger: record a reversal receipt for mutating tools ─────
  if (!opts.skipLedger && inverses[toolName]) {
    try {
      const receipt = inverses[toolName](args || {}, result);
      if (receipt) {
        appendReceipt({
          tool_name: toolName,
          args: args || {},
          result,
          inverse: receipt.tool ? { tool: receipt.tool, args: receipt.args } : null,
          reversible: receipt.reversible !== false && !!receipt.tool,
          notes: receipt.notes
        });
      }
    } catch (e) {
      console.error(`Ledger receipt failed for ${toolName}: ${e.message}`);
    }
  }

  return result;
}

// ── Pinned tools (always visible without searching) ────────────────────────────
const PINNED_TOOLS = [
  {
    name: 'search_toolkit',
    description: 'Search Robinson\'s Toolkit for the right tool. Describe what you want to do in plain English and get back the matching tools with their exact parameters. ALWAYS use this first when you need a tool you haven\'t used before.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What you want to do. E.g. "create a neon database branch", "send an SMS with twilio", "deploy to fly.io", "list vercel deployments"' },
        limit: { type: 'number', description: 'Max results to return (default 8, max 20)', default: 8 }
      },
      required: ['query']
    }
  },
  {
    name: 'list_namespaces',
    description: 'List all available tool categories (namespaces) and how many tools each has. Use this to understand what Robinson\'s Toolkit can do.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'get_tool_schema',
    description: 'Get the exact input schema and description for a specific tool by name. Use this when you know the tool name but need to see its parameters.',
    inputSchema: {
      type: 'object',
      properties: {
        tool_name: { type: 'string', description: 'Exact tool name, e.g. "neon_create_branch" or "vercel_list_deployments"' }
      },
      required: ['tool_name']
    }
  },
  {
    name: 'execute_tool',
    description: 'Execute any Robinson\'s Toolkit tool by name with arguments. Use search_toolkit first to find the right tool and its schema, then call this to run it.',
    inputSchema: {
      type: 'object',
      properties: {
        tool_name: { type: 'string', description: 'Exact tool name to execute' },
        args: { type: 'object', description: 'Arguments matching the tool\'s input schema' }
      },
      required: ['tool_name']
    }
  },
  // High-value pinned tools always visible (no need to search for these)
  {
    name: 'local_run_command',
    description: 'PREFERRED for running shell commands during development. Executes on the host machine (WSL2/Linux). USE THIS WHEN you need to run npm, pnpm, yarn, git, npx, node, python, docker, or any one-off terminal command. Scoped to WORKSPACE_ROOT by default; captures stdout, stderr, and exit code.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to run, e.g. "npm run build", "git status", "npx prisma db push"' },
        cwd: { type: 'string', description: 'Working directory path. Defaults to WORKSPACE_ROOT from .env' },
        timeout_ms: { type: 'number', description: 'Timeout in milliseconds (default 30000)', default: 30000 }
      },
      required: ['command']
    }
  },
  {
    name: 'local_read_file',
    description: 'PREFERRED for reading any local file the agent needs to reason about. USE THIS WHEN you need source code, configs, .env, package.json, logs, JSON, markdown, or any text file. Returns content plus size and modification time. Binary files return a metadata stub instead of garbage.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path or path relative to WORKSPACE_ROOT, e.g. "src/app.ts" or "/home/user/project/file.js"' },
        encoding: { type: 'string', description: 'File encoding (default: utf-8)', default: 'utf-8' }
      },
      required: ['path']
    }
  },
  {
    name: 'local_write_file',
    description: 'PREFERRED for creating or overwriting local files. USE THIS WHEN you need to create source files, update configs, write generated code, or persist any agent-produced text. Creates parent directories automatically. Honors ALLOWED_WRITE_PATHS if set.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path or path relative to WORKSPACE_ROOT' },
        content: { type: 'string', description: 'Content to write to the file (full replacement)' },
        create_dirs: { type: 'boolean', description: 'Create parent directories if they don\'t exist (default: true)', default: true }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'local_list_directory',
    description: 'PREFERRED for exploring project structure. USE THIS WHEN you need to discover files, find configs, or understand the layout of a repo before making changes. Returns names, sizes, and types (file/dir).',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path. Defaults to WORKSPACE_ROOT' },
        recursive: { type: 'boolean', description: 'List recursively (default: false)', default: false },
        include_hidden: { type: 'boolean', description: 'Include hidden files/folders (default: false)', default: false }
      }
    }
  },
  {
    name: 'github_create_branch',
    description: 'PREFERRED for creating a feature branch on a GitHub repo. USE THIS WHEN starting work on a new feature, bug fix, or experiment. Creates from `from_branch` (default: main). Recorded in the Observability Ledger — can be undone via compound_rollback_transaction.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (username or org)' },
        repo: { type: 'string', description: 'Repository name' },
        branch: { type: 'string', description: 'New branch name, e.g. "feature/user-auth"' },
        from_branch: { type: 'string', description: 'Branch to create from (default: main)', default: 'main' }
      },
      required: ['owner', 'repo', 'branch']
    }
  },
  {
    name: 'github_create_pull_request',
    description: 'PREFERRED for opening a PR after pushing a feature branch. USE THIS WHEN code is ready for review or to trigger CI on a deploy preview. Recorded in the Observability Ledger — can be auto-closed via compound_rollback_transaction.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        title: { type: 'string', description: 'PR title' },
        body: { type: 'string', description: 'PR description (Markdown supported)' },
        head: { type: 'string', description: 'Branch with your changes' },
        base: { type: 'string', description: 'Branch to merge into (default: main)', default: 'main' }
      },
      required: ['owner', 'repo', 'title', 'head']
    }
  },
  {
    name: 'neon_run_sql',
    description: 'PREFERRED for executing SQL against Neon Postgres. USE THIS WHEN you need to inspect schemas, query data, run DDL, or apply ad-hoc migrations. Targets the main branch by default; pass branch_id to query a specific branch (useful with compound_scaffold_feature).',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Neon project ID' },
        sql: { type: 'string', description: 'SQL query to execute' },
        database: { type: 'string', description: 'Database name (default: neondb)', default: 'neondb' },
        branch_id: { type: 'string', description: 'Branch ID (default: main branch)' }
      },
      required: ['project_id', 'sql']
    }
  },
  {
    name: 'vercel_list_deployments',
    description: 'PREFERRED for checking deployment status and history. USE THIS WHEN diagnosing a failed deploy, finding the URL of a preview, or identifying the last-known-good production deployment for rollback. Returns the N most recent deployments with state and URLs.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Vercel project ID or name' },
        limit: { type: 'number', default: 10 }
      },
      required: ['projectId']
    }
  },
  {
    name: 'compound_scaffold_feature',
    description: 'POWER TOOL: PREFERRED METHOD for starting a new feature. Creates a GitHub branch + an isolated Neon DB branch + writes the new DATABASE_URL into .env.local + optionally runs migrations — in one call. Replaces 4-5 manual steps. Each created resource is logged to the Observability Ledger so the whole setup can be undone via compound_rollback_transaction.',
    inputSchema: {
      type: 'object',
      properties: {
        github_owner: { type: 'string', description: 'GitHub repo owner' },
        github_repo: { type: 'string', description: 'GitHub repo name' },
        feature_name: { type: 'string', description: 'Feature/branch name, e.g. "user-auth" or "payment-flow"' },
        neon_project_id: { type: 'string', description: 'Neon project ID for database branching' },
        run_migrations: { type: 'boolean', description: 'Run prisma db push or drizzle-kit push after branching (default: false)', default: false },
        migration_command: { type: 'string', description: 'Migration command if run_migrations is true (default: "npx prisma db push")', default: 'npx prisma db push' },
        env_file_path: { type: 'string', description: 'Path to .env.local to update with new DB URL' }
      },
      required: ['github_owner', 'github_repo', 'feature_name', 'neon_project_id']
    }
  },
  {
    name: 'compound_rollback_transaction',
    description: 'POWER TOOL: SAFETY NET for agent mistakes. Reads the Observability Ledger and reverses recent state-mutating tool calls (GitHub branches, Neon DBs, Fly apps, Vercel projects, etc.) in reverse order. USE THIS WHEN a multi-step setup goes wrong, when an agent hallucinated a destructive action, or to clean up after a failed compound tool. Supports dry_run to preview the reversal plan without executing.',
    inputSchema: {
      type: 'object',
      properties: {
        last_n: { type: 'number', description: 'Roll back the most recent N reversible ledger entries' },
        since: { type: 'string', description: 'ISO timestamp — roll back everything after this time' },
        transaction_id: { type: 'string', description: 'Roll back a single ledger entry by ID' },
        dry_run: { type: 'boolean', description: 'Show what would be reversed without executing (default: false)', default: false }
      }
    }
  }
];

// ── Main server bootstrap ──────────────────────────────────────────────────────
const registry = loadRegistry();
const handlers = await loadHandlers();
const activeNamespaces = getActiveNamespaces();

// Count tools per active namespace
const namespaceCounts = {};
for (const tool of registry) {
  const ns = tool.namespace || tool.name.split('_')[0];
  if (activeNamespaces[ns] !== false) {
    namespaceCounts[ns] = (namespaceCounts[ns] || 0) + 1;
  }
}
const totalActiveTools = Object.values(namespaceCounts).reduce((a, b) => a + b, 0);
const activeNs = Object.entries(activeNamespaces).filter(([, v]) => v).map(([k]) => k);

const server = new Server(
  { name: 'robinsons-toolkit', version: '2.0.0' },
  { capabilities: { tools: {} } }
);

// ── Tool list (always returns pinned tools) ────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: PINNED_TOOLS };
});

// ── Tool execution router ──────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // ── Meta tools ──────────────────────────────────────────────────────────
    if (name === 'search_toolkit') {
      const { query, limit = 8 } = args;
      const results = searchTools(registry, query, activeNamespaces, Math.min(limit, 20));
      if (results.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No tools found matching "${query}".\n\nAvailable namespaces: ${activeNs.join(', ')}\n\nTry: list_namespaces to see all categories, or try different search terms.`
          }]
        };
      }
      return {
        content: [{
          type: 'text',
          text: `Found ${results.length} tools matching "${query}":\n\n` +
            results.map(t =>
              `**${t.name}**\n${t.description || 'No description'}\n` +
              (t.inputSchema?.properties ? `Parameters: ${Object.keys(t.inputSchema.properties).join(', ')}` : '')
            ).join('\n\n') +
            '\n\nTo use any tool: call execute_tool with the tool_name and args.\nTo see exact parameters: call get_tool_schema with the tool_name.'
        }]
      };
    }

    if (name === 'list_namespaces') {
      const active = Object.entries(activeNamespaces)
        .filter(([, v]) => v)
        .map(([ns]) => `✅ ${ns}: ${namespaceCounts[ns] || 0} tools`);
      const inactive = Object.entries(activeNamespaces)
        .filter(([, v]) => !v)
        .map(([ns]) => `⬜ ${ns}: add credentials to .env to unlock`);
      return {
        content: [{
          type: 'text',
          text: `Robinson's Toolkit — ${totalActiveTools} active tools across ${activeNs.length} namespaces\n\n` +
            `ACTIVE:\n${active.join('\n')}\n\n` +
            (inactive.length ? `LOCKED (missing credentials):\n${inactive.join('\n')}` : '')
        }]
      };
    }

    if (name === 'get_tool_schema') {
      const { tool_name } = args;
      const tool = registry.find(t => t.name === tool_name);
      if (!tool) {
        return {
          content: [{
            type: 'text',
            text: `Tool "${tool_name}" not found in registry.\nUse search_toolkit to find the right tool name.`
          }]
        };
      }
      return {
        content: [{
          type: 'text',
          text: `**${tool.name}**\n\n${tool.description || ''}\n\nSchema:\n${JSON.stringify(tool.inputSchema || {}, null, 2)}`
        }]
      };
    }

    if (name === 'execute_tool') {
      const { tool_name, args: toolArgs } = args;
      const result = await routeToolCall(tool_name, toolArgs, handlers);
      return {
        content: [{
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }]
      };
    }

    // ── Pinned tools (handled directly for speed) ────────────────────────────
    if (name.startsWith('local_') || name.startsWith('github_') || name.startsWith('neon_') ||
        name.startsWith('vercel_') || name.startsWith('compound_')) {
      const result = await routeToolCall(name, args, handlers);
      return {
        content: [{
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }]
      };
    }

    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}. Use search_toolkit to find available tools.` }]
    };

  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error executing ${name}: ${error.message}\n\n` +
          (error.stack ? `Stack: ${error.stack}` : '')
      }],
      isError: true
    };
  }
});

// ── Start server ───────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);

console.error(`
╔══════════════════════════════════════════════════════╗
║  Robinson's Toolkit MCP v2.0 — Active               ║
║  ${String(totalActiveTools).padEnd(4)} tools across ${String(activeNs.length).padEnd(2)} namespaces        ║
║  Active: ${activeNs.slice(0,4).join(', ')}${activeNs.length > 4 ? '...' : ''}
╚══════════════════════════════════════════════════════╝
`);
