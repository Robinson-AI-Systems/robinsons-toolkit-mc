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
    local:      () => true, // Always available — local machine access
    compound:   () => true, // Always available — compound tools use whatever is configured
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

// ── Route a tool call to the right handler ─────────────────────────────────────
async function routeToolCall(toolName, args, handlers) {
  // Determine namespace from tool name prefix
  const parts = toolName.split('_');
  let namespace = parts[0];

  // Handle multi-word namespaces (e.g., google_gmail_send → google)
  if (['gmail','drive','calendar','sheets','docs','slides','tasks','people','admin','forms','chat'].includes(parts[1])) {
    namespace = 'google';
  }

  const handler = handlers[namespace];
  if (!handler) {
    throw new Error(`No handler found for namespace '${namespace}'. Tool: ${toolName}\nAvailable handlers: ${Object.keys(handlers).join(', ')}`);
  }

  return await handler.execute(toolName, args || {});
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
    description: 'Run a shell command on the local Windows PC. Use for npm, git, npx, node, and any terminal commands needed during development.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to run, e.g. "npm run build" or "git status" or "npx prisma db push"' },
        cwd: { type: 'string', description: 'Working directory path. Defaults to WORKSPACE_ROOT from .env' },
        timeout_ms: { type: 'number', description: 'Timeout in milliseconds (default 30000)', default: 30000 }
      },
      required: ['command']
    }
  },
  {
    name: 'local_read_file',
    description: 'Read a file from the local PC filesystem. Use to read source code, configs, .env files, logs, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Full path or path relative to WORKSPACE_ROOT. E.g. "my-app/src/app.ts" or "C:\\\\Users\\\\chris\\\\project\\\\file.js"' },
        encoding: { type: 'string', description: 'File encoding (default: utf-8)', default: 'utf-8' }
      },
      required: ['path']
    }
  },
  {
    name: 'local_write_file',
    description: 'Write or create a file on the local PC filesystem. Use to create source files, update configs, write generated code, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Full path or path relative to WORKSPACE_ROOT' },
        content: { type: 'string', description: 'Content to write to the file' },
        create_dirs: { type: 'boolean', description: 'Create parent directories if they don\'t exist (default: true)', default: true }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'local_list_directory',
    description: 'List files and folders in a directory on the local PC. Use to explore project structure.',
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
    description: 'Create a new branch in a GitHub repository.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (username or org)' },
        repo: { type: 'string', description: 'Repository name' },
        branch: { type: 'string', description: 'New branch name' },
        from_branch: { type: 'string', description: 'Branch to create from (default: main)', default: 'main' }
      },
      required: ['owner', 'repo', 'branch']
    }
  },
  {
    name: 'github_create_pull_request',
    description: 'Create a pull request in a GitHub repository.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        title: { type: 'string' },
        body: { type: 'string' },
        head: { type: 'string', description: 'Branch with your changes' },
        base: { type: 'string', description: 'Branch to merge into (default: main)', default: 'main' }
      },
      required: ['owner', 'repo', 'title', 'head']
    }
  },
  {
    name: 'neon_run_sql',
    description: 'Execute a SQL query on a Neon PostgreSQL database.',
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
    description: 'List recent deployments for a Vercel project.',
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
    description: 'POWER TOOL: Set up a complete feature branch environment in one step. Creates a Git branch, a Neon database branch for isolated testing, updates your local .env with the new DB connection string, and optionally runs database migrations. Returns a full status report.',
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
