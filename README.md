# Robinson's Toolkit MCP v2.0

> **A personal AI developer toolkit** — a locally-running MCP server that gives your coding agent real, hands-on developer abilities across your entire stack. Not just API wrappers. The goal is to put a skilled developer's full range of actions within reach of your AI agent, one tool at a time.

---

## What It Does

Robinson's Toolkit connects Claude (via Claude Code or any MCP-compatible client) to the services that run your stack. When your agent needs to create a GitHub branch, check a Neon database, roll back a Vercel deployment, or send a dispatch SMS — it just does it, without you having to copy-paste API calls or switch context.

The toolkit currently houses **1,780 tools** across **23 service namespaces**, and is actively growing. Tools only activate when the matching API key is present in your `.env` file — so you always see exactly what your credentials unlock, nothing more.

---

## The Core Problem: The "Tools Tax"

Most MCP setups inject every available tool schema directly into the AI's context window on every message. With hundreds of tools, that can silently consume 10,000–60,000 tokens *before you've even asked a question* — destroying the agent's memory, degrading its reasoning, and inflating your API bill.

Robinson's Toolkit solves this with **Smart Discovery**.

### How Smart Discovery Works

Instead of flooding the context with 1,780 tool schemas, the agent only ever sees **4 meta-tools + ~15 pinned high-value tools** at any given time. Everything else stays hidden until asked for.

| Meta-Tool | What It Does |
|---|---|
| `search_toolkit` | Find any tool using plain English — returns the top matches with descriptions |
| `list_namespaces` | See which service categories are active (based on your credentials) |
| `get_tool_schema` | Get the full parameter details for any specific tool by name |
| `execute_tool` | Run any tool by name, passing the required arguments |

**Example flow:**
```
You:    "Deploy the latest commit to production"
Agent:  search_toolkit("vercel deploy production")
        → finds vercel_create_deployment, vercel_promote_deployment
        get_tool_schema("vercel_promote_deployment")
        execute_tool("vercel_promote_deployment", { projectId: "...", deploymentId: "..." })
```

The agent discovers and uses tools on-demand. Your context window stays clean.

---

## Current Status

This toolkit is a **living, growing project**. The current priorities are the three services that need to be running before anything else matters:

| Priority | Namespace | Tools | Status |
|---|---|---|---|
| 🔴 Core | `github` | 201 | ✅ Deep coverage — expanding to 250+ |
| 🔴 Core | `vercel` | 150 | ✅ Complete — full DevOps coverage |
| 🔴 Core | `neon` | 187 | ✅ Complete — full DB + branching + pgvector coverage |
| 🟡 Active | `upstash` | 149 | ✅ Full Redis command set |
| 🟡 Active | `stripe` | 71 | ✅ Customers, subscriptions, products, invoices, refunds |
| 🟡 Active | `google` | 60 | ✅ Gmail, Drive, Calendar, Sheets, Docs |
| 🟡 Active | `cloudflare` | 54 | ✅ Workers, KV, R2, Pages, DNS, firewall |
| 🟡 Active | `openai` | 41 | ✅ Chat, embeddings, images, TTS, Whisper, Assistants |
| 🟡 Active | `fly` | 37 | ✅ Machines, apps, volumes, scaling, secrets |
| 🟡 Active | `supabase` | 36 | ✅ SQL, auth, storage, Edge Functions |
| 🟡 Active | `clerk` | 30 | ✅ Users, organizations, sessions, JWT templates |
| 🟡 Active | `resend` | 23 | ✅ Transactional email, domains, audiences |
| 🟡 Active | `twilio` | 22 | ✅ SMS, voice, phone numbers |
| 🟢 Available | `qdrant` | 17 | ✅ Vector search, collections |
| 🟢 Available | `sentry` | 17 | ✅ Issues, releases, alerts |
| 🟢 Available | `anthropic` | 15 | ✅ Claude completions, model management |
| 🟢 Available | `mapbox` | 15 | ✅ Geocoding, routing, isochrones |
| 🟢 Available | `n8n` | 13 | ✅ Workflows, executions |
| 🟢 Available | `postgres` | 12 | ✅ Direct SQL execution |
| 🟢 Available | `search` | 10 | ✅ Brave Search + Tavily |
| 🔵 Always On | `local` | 62 | ✅ Complete local machine bridge |
| 🔵 Always On | `compound` | 11 | ✅ Cross-service Super Tools |

---

## Prerequisites

- **Node.js v18 or higher** — [Download here](https://nodejs.org)
- **Windows** (native or WSL2)
- **Claude Code** (or any MCP-compatible client)
- API keys for the services you want to use

To check your Node version:
```bash
node --version
```

---

## Installation

### Option A — Run SETUP.bat (Windows)

Double-click `SETUP.bat` in the project folder. It will:
1. Verify Node.js is installed
2. Run `npm install`
3. Create a `.env` file from the template

### Option B — Manual Setup

```bash
# 1. Navigate to the project folder
cd "Robinson's Toolkit MCP"

# 2. Install dependencies (only 2 packages)
npm install

# 3. Create your .env file
copy .env.example .env
```

Then open `.env` and fill in your API keys.

---

## Configuration

### Step 1 — Fill In Your .env File

Open the `.env` file in the project root. You only need to fill in the services you actually use. Any namespace without credentials simply won't appear.

```env
# ── WORKSPACE ──────────────────────────────────────────────────────────────────
# The root directory Claude is allowed to read/write files in
WORKSPACE_ROOT=C:\Users\chris\Git Local

# ── GITHUB ─────────────────────────────────────────────────────────────────────
GITHUB_TOKEN=ghp_...

# ── VERCEL ─────────────────────────────────────────────────────────────────────
VERCEL_TOKEN=...

# ── NEON (PostgreSQL) ───────────────────────────────────────────────────────────
NEON_API_KEY=...

# ── FLY.IO ─────────────────────────────────────────────────────────────────────
FLY_API_TOKEN=...

# ── STRIPE ─────────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_... (or sk_test_... for development)

# ── TWILIO ─────────────────────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...

# ── RESEND ─────────────────────────────────────────────────────────────────────
RESEND_API_KEY=re_...

# ── CLOUDFLARE ─────────────────────────────────────────────────────────────────
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...

# ── OPENAI ─────────────────────────────────────────────────────────────────────
OPENAI_API_KEY=sk-...

# ── ANTHROPIC ──────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ── SUPABASE ───────────────────────────────────────────────────────────────────
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ── UPSTASH REDIS ──────────────────────────────────────────────────────────────
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# ── GOOGLE WORKSPACE ───────────────────────────────────────────────────────────
# Option A: Personal OAuth token
GOOGLE_ACCESS_TOKEN=ya29...
# Option B: Service account (for server-to-server)
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=C:\path\to\service-account.json

# ── MAPBOX ─────────────────────────────────────────────────────────────────────
MAPBOX_ACCESS_TOKEN=pk.eyJ1...

# ── CLERK ──────────────────────────────────────────────────────────────────────
CLERK_SECRET_KEY=sk_live_...

# ── SENTRY ─────────────────────────────────────────────────────────────────────
SENTRY_AUTH_TOKEN=sntrys_...

# ── WEB SEARCH (either or both) ────────────────────────────────────────────────
BRAVE_SEARCH_API_KEY=BSA...
TAVILY_API_KEY=tvly-...

# ── QDRANT (Vector Database) ───────────────────────────────────────────────────
QDRANT_URL=http://localhost:6333

# ── N8N (Workflow Automation) ──────────────────────────────────────────────────
N8N_BASE_URL=https://your-n8n-instance.com
N8N_API_KEY=...

# ── POSTGRES (Direct Connection) ───────────────────────────────────────────────
POSTGRES_CONNECTION_STRING=postgresql://user:pass@host:5432/dbname
```

### Step 2 — Connect to Claude Code

Open your Claude Code MCP config file. On Windows it's typically at:
```
C:\Users\chris\AppData\Roaming\Claude\claude_desktop_config.json
```

Add this block inside `"mcpServers"`:

```json
{
  "mcpServers": {
    "robinsons-toolkit": {
      "command": "node",
      "args": ["C:\\Users\\chris\\Google Drive\\Robinson's Toolkit MCP\\index.js"],
      "env": {
        "WORKSPACE_ROOT": "C:\\Users\\chris\\Git Local"
      }
    }
  }
}
```

> **Note:** The `.env` file in the project root handles all API keys. The `env` block above only needs `WORKSPACE_ROOT` — everything else loads automatically from `.env` when the server starts.

### Step 3 — Restart Claude Code

Close and reopen Claude Code. You should see Robinson's Toolkit appear in the tools panel. The banner in the server log will confirm how many tools loaded:

```
╔══════════════════════════════════════════════════════╗
║  Robinson's Toolkit MCP v2.0 — Active               ║
║  1233 tools across 22 namespaces                    ║
║  Active: github, vercel, neon, fly...               ║
╚══════════════════════════════════════════════════════╝
```

The tool count shown reflects only the namespaces where you've provided credentials.

---

## Testing the Server Manually

You can confirm the server boots cleanly at any time:

```bash
# In the project folder
node index.js
```

You should see the banner above and no error output. Press `Ctrl+C` to stop.

For development with auto-reload:
```bash
npm run dev
```

---

## Using the Toolkit

### The 4 Meta-Tools

These are always visible to your agent and are the entry point to everything else.

**`search_toolkit`** — Find tools by describing what you want to do
```
search_toolkit("create a database branch for a new feature")
search_toolkit("send an SMS notification")
search_toolkit("roll back a deployment")
```

**`list_namespaces`** — See which services are active
```
list_namespaces()
→ Returns: github ✅, vercel ✅, neon ✅, stripe ✅, twilio ❌ (no credentials), ...
```

**`get_tool_schema`** — Get full parameter docs for a specific tool
```
get_tool_schema("neon_create_branch")
→ Returns the full input schema with all required and optional fields
```

**`execute_tool`** — Run any tool directly by name
```
execute_tool("github_create_branch", {
  "repo": "owner/my-app",
  "branch": "feature/customer-portal",
  "from": "main"
})
```

### How Your Agent Uses It

In practice, you just describe what you need in natural language. The agent handles the discovery and execution automatically:

> *"Create a Neon branch for the new billing feature, then push a new GitHub branch to match, and add a `TODO.md` to the branch root."*

The agent will:
1. `search_toolkit("neon create branch")` → finds `neon_create_branch`
2. `execute_tool("neon_create_branch", { project_id: "...", name: "feature/billing" })`
3. `search_toolkit("github create branch")` → finds `github_create_branch`
4. `execute_tool("github_create_branch", { repo: "...", branch: "feature/billing" })`
5. `execute_tool("local_write_file", { path: "TODO.md", content: "..." })`

---

## Namespace Reference

Every namespace activates automatically when its credentials are present in `.env`.

### 🔴 Core Stack

| Namespace | Coverage | Required Credentials |
|---|---|---|
| **github** | Repos, branches, PRs, issues, commits, releases, Actions, code search, webhooks, team management | `GITHUB_TOKEN` |
| **vercel** | Deployments, projects, env vars, domains, DNS, teams, Edge Config, analytics, firewall, billing | `VERCEL_TOKEN` |
| **neon** | Projects, branches, databases, SQL execution, endpoints, roles, extensions, migrations, performance analysis | `NEON_API_KEY` |

### 🟡 Extended Stack

| Namespace | Coverage | Required Credentials |
|---|---|---|
| **fly** | Machines, apps, volumes, scaling, secrets, regions, logs, networking | `FLY_API_TOKEN` |
| **stripe** | Customers, subscriptions, products, prices, invoices, refunds, disputes, webhooks | `STRIPE_SECRET_KEY` |
| **twilio** | SMS, voice, phone numbers, messaging services, webhooks, logs | `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` |
| **resend** | Transactional email, domains, API keys, webhooks, audience management | `RESEND_API_KEY` |
| **cloudflare** | Zones, DNS, Workers, KV, R2, Pages, firewall rules, cache, analytics | `CLOUDFLARE_API_TOKEN` |
| **openai** | Chat completions, embeddings, images, TTS, Whisper, Assistants, Vector Stores, fine-tuning | `OPENAI_API_KEY` |
| **anthropic** | Claude completions, model management | `ANTHROPIC_API_KEY` |
| **supabase** | Projects, SQL, auth users, storage buckets, Edge Functions, API keys | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |
| **upstash** | Full Redis command set (strings, hashes, lists, sets, sorted sets, geo, streams, pub/sub, bitmaps, HyperLogLog, pipelines) + database management | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` |

### 🟢 Support Services

| Namespace | Coverage | Required Credentials |
|---|---|---|
| **google** | Gmail, Google Drive, Google Calendar, Google Sheets, Google Docs | `GOOGLE_ACCESS_TOKEN` or `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` |
| **mapbox** | Geocoding, routing, directions, isochrones, static maps | `MAPBOX_ACCESS_TOKEN` |
| **clerk** | Users, organizations, sessions, roles, webhooks, JWT templates | `CLERK_SECRET_KEY` |
| **sentry** | Projects, issues, events, releases, alerts, performance | `SENTRY_AUTH_TOKEN` |
| **qdrant** | Collections, vectors, upsert, search, filtering, snapshots | `QDRANT_URL` |
| **n8n** | Workflows, executions, credentials, webhooks | `N8N_BASE_URL` + `N8N_API_KEY` |
| **postgres** | Direct SQL execution against any Postgres connection string | `POSTGRES_CONNECTION_STRING` |
| **search** | Web search via Brave Search and/or Tavily | `BRAVE_SEARCH_API_KEY` and/or `TAVILY_API_KEY` |

### 🔵 Always-On (No Credentials Needed)

| Namespace | Coverage |
|---|---|
| **local** | Read/write files, run terminal commands, list directories — scoped to `WORKSPACE_ROOT` |
| **compound** | Multi-step "Super Tools" that orchestrate multiple services in a single command |

---

## Compound Tools ("Super Tools")

Compound tools are multi-step workflows wrapped into a single agent command. Instead of the agent spending dozens of reasoning steps chaining together individual API calls, a Super Tool handles the whole sequence internally — saving tokens, reducing errors, and making complex operations feel simple.

Current compound tools:

| Tool | What It Does |
|---|---|
| `compound_scaffold_feature` | Creates a GitHub branch + Neon DB branch + scaffolds API/UI files + opens a draft PR, all at once |
| `compound_safe_deploy` | Runs pre-flight checks, verifies env vars and migrations, deploys to Vercel, rolls back automatically on failure |
| `compound_onboard_saas_customer` | Creates Stripe customer + subscription, provisions DB tenant schema, sends welcome email via Resend |
| `compound_incident_response` | Checks Vercel/Fly health, queries Neon for errors, pulls Sentry issues, drafts a Slack alert, optionally rolls back |
| `compound_neon_safe_migration` | Runs a migration on a test branch first, validates it, then applies to main and cleans up |
| `compound_git_commit_push` | Stages files, writes a conventional commit message, pushes the branch, optionally opens a PR |
| `compound_project_health_check` | One-sweep health report across Vercel, Neon, Upstash, Fly, and Sentry |
| `compound_send_dispatch_notification` | Sends SMS + email + updates the DB record in one call (built for YardSync dispatch workflows) |
| `compound_generate_and_embed` | Generates OpenAI embeddings and upserts them into Qdrant — for RAG and semantic search pipelines |
| `compound_semantic_search` | Embeds a query with OpenAI and searches Qdrant for matching results in one step |
| `compound_analytics_snapshot` | Pulls a cross-platform daily briefing: Neon queries, Vercel traffic, Upstash ops, Stripe MRR, Resend stats |

More Super Tools will be added as real workflow patterns emerge from active use.

---

## Local Machine Tools

The `local` namespace is always active and gives your agent direct access to your filesystem, terminal, processes, ports, git, and npm — all scoped to `WORKSPACE_ROOT`. The namespace now houses **62 tools** covering everything a developer would do in a terminal.

| Category | Examples |
|---|---|
| Filesystem | `local_read_file`, `local_write_file`, `local_read_multiple_files`, `local_copy_file`, `local_move_file`, `local_delete_file`, `local_list_directory`, `local_make_directory`, `local_find_files`, `local_search_in_files`, `local_get_file_hash`, `local_diff_files`, `local_zip_directory`, `local_watch_file` |
| Processes & Ports | `local_run_command`, `local_get_process_list`, `local_kill_process`, `local_check_port`, `local_get_system_info` |
| Environment | `local_read_env_file`, `local_update_env_var` |
| Git | `local_git_status`, `local_git_diff`, `local_git_log`, `local_git_branch`, `local_git_commit`, `local_git_push`, `local_git_smart_commit` |
| npm/Node | `local_npm_install`, `local_npm_run`, `local_npm_outdated`, `local_npm_audit` |
| Super Tools | `local_scaffold_nextjs_component`, `local_setup_env_from_vercel` |

> **Security note:** All file operations are restricted to the `WORKSPACE_ROOT` path defined in your `.env`. Terminal commands run with standard user permissions. Do not point `WORKSPACE_ROOT` at a system directory.

---

## Project Structure

```
Robinson's Toolkit MCP/
│
├── index.js                  ← Main MCP server — Smart Discovery engine, router, banner
├── package.json              ← ESM project, 2 dependencies: @modelcontextprotocol/sdk + dotenv
├── .env                      ← Your API keys (not committed to git)
├── .env.example              ← Template for first-time setup
├── SETUP.bat                 ← Windows setup script
├── claude-code-config.json   ← Ready-to-paste Claude Code MCP config
│
├── handlers/                 ← 22 service handler files (one per namespace)
│   ├── github.js             ← All GitHub tool implementations
│   ├── vercel.js             ← All Vercel tool implementations
│   ├── neon.js               ← All Neon tool implementations
│   ├── compound.js           ← Super Tool implementations
│   ├── local.js              ← Local machine tool implementations
│   └── ... (18 more)
│
├── registry/                 ← 22 JSON files — tool definitions for Smart Discovery
│   ├── github.json           ← 201 GitHub tool definitions
│   ├── vercel.json           ← 150 Vercel tool definitions
│   ├── neon.json             ← 187 Neon tool definitions
│   ├── upstash.json          ← 149 Redis tool definitions
│   ├── local.json            ← 62 local machine tool definitions
│   └── ... (17 more)
│
└── Creation Docs/            ← Reference documents used during architecture planning
```

**How a tool request flows:**
1. Agent calls `search_toolkit("what I want to do")`
2. `index.js` scores all tools in `registry/*.json` against the query
3. Top matches are returned with names and descriptions
4. Agent calls `execute_tool("tool_name", { ...args })`
5. `index.js` routes the call to the correct `handlers/*.js` file
6. Handler makes the API call and returns a clean, minimal response

---

## Design Philosophy

Every tool is built with one question in mind: **"What would a skilled developer do here?"** Not "what does the API allow," but what a real person sitting at a keyboard would actually do to get the job done.

This means:
- **Real operations, not just reads** — tools create, update, delete, and deploy, not just list
- **Minimal responses** — handlers strip out noise and return only what matters, protecting context
- **Compound over multi-step** — common multi-tool workflows get wrapped into single Super Tools
- **Credential-gated clarity** — you only see tools for services you've actually configured
- **No build step** — plain JavaScript, starts instantly, no compilation required

---

## Roadmap

Planned additions (not yet implemented):

- **Playwright** — headless browser automation, screenshots, DOM extraction, form interaction, accessibility audits
- **Upstash Vector** — vector upsert, semantic search, index management
- **Upstash Kafka** — topic management, message production, consumer group monitoring
- **More Compound Tools** — as real workflow patterns emerge from building YardSync, Cortiware, and other active projects
- **Deeper GitHub coverage** — Actions workflow management, code scanning, Dependabot, package registry
- **Deeper Neon coverage** — pgvector operations, logical replication, Neon Auth provisioning
- **Semantic search upgrade** — replacing keyword scoring with local vector embeddings for smarter tool discovery

---

## Troubleshooting

**Server won't start**
- Run `node --version` — must be 18 or higher
- Run `npm install` to make sure dependencies are installed
- Check for syntax errors: `node index.js` will print the exact line if there's a problem

**Tools aren't appearing in Claude Code**
- Confirm your `.env` file has the correct API keys
- Restart Claude Code after any config change
- Test the server manually: `node index.js` — the banner shows which namespaces are active

**A tool is failing silently**
- Check that the required fields in the tool schema are being passed correctly
- Use `get_tool_schema("tool_name")` to see exactly what parameters are needed
- Check that your API key for that service has the necessary permissions

**Tool count is lower than expected**
- The banner count reflects only namespaces with valid credentials
- Fill in more `.env` keys to unlock more tool groups

---

## Version

**v2.0.0** — Smart Discovery architecture, 1,780 tools across 22 namespaces.

Built by Chris Robinson, Robinson AI Systems LLC.
