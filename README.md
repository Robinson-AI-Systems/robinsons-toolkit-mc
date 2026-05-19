# Robinson's Toolkit MCP v2.0

> **A personal AI developer toolkit** — a locally-running MCP server that gives your coding agent real, hands-on developer abilities across your entire stack. Not just API wrappers. The goal is to put a skilled developer's full range of actions within reach of your AI agent, one tool at a time.

---

## What It Does

Robinson's Toolkit connects Claude (via Claude Code or any MCP-compatible client) to the services that run your stack. When your agent needs to create a GitHub branch, check a Neon database, roll back a Vercel deployment, or send a dispatch SMS — it just does it, without you having to copy-paste API calls or switch context.

The toolkit currently houses **2,231 tools** across **25 service namespaces**, and is actively growing. Tools only activate when the matching API key is present in your `.env` file — so you always see exactly what your credentials unlock, nothing more.

---

## The Core Problem: The "Tools Tax"

Most MCP setups inject every available tool schema directly into the AI's context window on every message. With hundreds of tools, that can silently consume 10,000–60,000 tokens *before you've even asked a question* — destroying the agent's memory, degrading its reasoning, and inflating your API bill.

Robinson's Toolkit solves this with **Smart Discovery**.

### How Smart Discovery Works

Instead of flooding the context with 2,231 tool schemas, the agent only ever sees **4 meta-tools + ~15 pinned high-value tools** at any given time. Everything else stays hidden until asked for.

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

**2,231 tools · 25 namespaces · 25/25 synced**

| Namespace | Tools | Status |
|---|---|---|
| `github` | 282 | ✅ Complete |
| `neon` | 187 | ✅ Complete |
| `google` | 158 | ✅ Complete |
| `vercel` | 150 | ✅ Complete |
| `upstash` | 149 | ⚠️ Complete (Vector + Kafka sections pending) |
| `cloudflare` | 148 | ✅ Complete |
| `stripe` | 143 | ✅ Complete |
| `openai` | 109 | ✅ Complete |
| `supabase` | 98 | ✅ Complete |
| `twilio` | 94 | ✅ Complete |
| `fly` | 76 | ✅ Complete |
| `clerk` | 75 | ✅ Complete |
| `local` | 62 | ✅ Complete |
| `anthropic` | 61 | ✅ Complete |
| `sentry` | 59 | ✅ Complete |
| `qdrant` | 48 | ✅ Complete |
| `n8n` | 47 | ✅ Complete |
| `resend` | 46 | ✅ Complete |
| `mapbox` | 45 | ✅ Complete |
| `postgres` | 44 | ✅ Complete |
| `search` | 23 | ✅ Complete |
| `context7` | 39 | ✅ Complete (NEW) |
| `playwright` | 34 | ✅ Complete (NEW) |
| `search` | 23 | ✅ Complete |
| `compound` | 22 | ✅ Complete |
| `ollama` | 16 | ✅ Complete |

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
STRIPE_SECRET_KEY=sk_live_...

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
GOOGLE_ACCESS_TOKEN=ya29...
# or: GOOGLE_SERVICE_ACCOUNT_KEY_PATH=C:\path\to\service-account.json

# ── MAPBOX ─────────────────────────────────────────────────────────────────────
MAPBOX_ACCESS_TOKEN=pk.eyJ1...
MAPBOX_USERNAME=                  # required for datasets/tilesets/styles

# ── CLERK ──────────────────────────────────────────────────────────────────────
CLERK_SECRET_KEY=sk_live_...

# ── SENTRY ─────────────────────────────────────────────────────────────────────
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_ORG_SLUG=your-org

# ── WEB SEARCH (either or both) ────────────────────────────────────────────────
BRAVE_SEARCH_API_KEY=BSA...
TAVILY_API_KEY=tvly-...

# ── QDRANT ─────────────────────────────────────────────────────────────────────
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=                   # optional for cloud instances

# ── N8N ────────────────────────────────────────────────────────────────────────
N8N_BASE_URL=https://your-n8n-instance.com
N8N_API_KEY=...

# ── POSTGRES (Direct Connection) ───────────────────────────────────────────────
POSTGRES_CONNECTION_STRING=postgresql://user:pass@host:5432/dbname

# ── OLLAMA (Local LLM) ─────────────────────────────────────────────────────────
OLLAMA_BASE_URL=http://172.19.16.1:11434
OLLAMA_DEFAULT_MODEL=qwen2.5-coder:7b
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

### Step 3 — Restart Claude Code

Close and reopen Claude Code. The banner in the server log will confirm how many tools loaded:

```
╔══════════════════════════════════════════════════════╗
║  Robinson's Toolkit MCP v2.0 — Active               ║
║  1873 tools across 22 namespaces                    ║
║  Active: github, vercel, neon, fly...               ║
╚══════════════════════════════════════════════════════╝
```

The tool count reflects only namespaces where you've provided credentials.

---

## Using the Toolkit

### The 4 Meta-Tools

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
```

**`execute_tool`** — Run any tool directly by name
```
execute_tool("github_create_branch", {
  "owner": "my-org",
  "repo": "my-app",
  "branch": "feature/customer-portal"
})
```

---

## Namespace Reference

### 🔴 Core Stack

| Namespace | Tools | Coverage | Credentials |
|---|---|---|---|
| `github` | 282 | Repos, branches, PRs, issues, commits, releases, Actions, code search, webhooks, teams | `GITHUB_TOKEN` |
| `neon` | 187 | Projects, branches, databases, SQL, endpoints, roles, extensions, migrations, pgvector | `NEON_API_KEY` |
| `vercel` | 150 | Deployments, projects, env vars, domains, DNS, Edge Config, analytics, firewall, billing | `VERCEL_TOKEN` |
| `upstash` | 149 | Full Redis command set: strings, hashes, lists, sets, sorted sets, geo, streams, pub/sub, HLL, pipelines | `UPSTASH_REDIS_REST_URL` + token |

### 🟡 Extended Stack

| Namespace | Tools | Coverage | Credentials |
|---|---|---|---|
| `cloudflare` | 148 | Workers, KV, R2, Pages, DNS, Zones, Tunnels, firewall, cache, analytics | `CLOUDFLARE_API_TOKEN` + `ACCOUNT_ID` |
| `stripe` | 143 | Customers, subscriptions, products, prices, invoices, refunds, disputes, Connect, metered billing | `STRIPE_SECRET_KEY` |
| `openai` | 109 | Chat, embeddings, images, TTS, Whisper, Assistants, Vector Stores, fine-tuning, batch, moderation | `OPENAI_API_KEY` |
| `supabase` | 98 | SQL, auth users, storage buckets, Edge Functions, RLS, schemas, branches, webhooks | `SUPABASE_URL` + `SERVICE_ROLE_KEY` |
| `twilio` | 94 | SMS, voice, phone numbers, messaging services, conversations, webhooks, logs | `TWILIO_ACCOUNT_SID` + `AUTH_TOKEN` |
| `fly` | 76 | Machines, apps, volumes, scaling, secrets, regions, certificates, WireGuard, Postgres | `FLY_API_TOKEN` |
| `clerk` | 75 | Users, orgs, sessions, roles, permissions, domains, JWT templates, webhooks, invitations | `CLERK_SECRET_KEY` |

### 🟢 Support Services

| Namespace | Tools | Coverage | Credentials |
|---|---|---|---|
| `local` | 62 | Files, terminal, processes, ports, env, git, npm — scoped to WORKSPACE_ROOT | *(none — always on)* |
| `anthropic` | 61 | Claude completions, streaming, token counting, model listing, admin | `ANTHROPIC_API_KEY` |
| `sentry` | 59 | Issues, events, releases, deployments, teams, members, monitors, alerts, dashboards | `SENTRY_AUTH_TOKEN` + `ORG_SLUG` |
| `qdrant` | 48 | Collections, aliases, indexes, points, vectors, search, discovery, recommendations, snapshots | `QDRANT_URL` |
| `n8n` | 47 | Workflows, executions, credentials, variables, tags, users, projects, source control | `N8N_BASE_URL` + `API_KEY` |
| `resend` | 46 | Transactional email, broadcasts, audiences, contacts, domains, webhooks, batch send | `RESEND_API_KEY` |
| `mapbox` | 45 | Geocoding, directions, routing optimization, matrix, isochrones, map matching, static maps, datasets | `MAPBOX_ACCESS_TOKEN` |
| `postgres` | 44 | Raw SQL, schema inspection, data ops (select/insert/update/upsert/delete), indexes, roles, vacuum | `POSTGRES_CONNECTION_STRING` |
| `search` | 23 | Brave Search (web/news/images/video/local/suggest) + Tavily (search/deep/extract/news/finance) | `BRAVE_SEARCH_API_KEY` and/or `TAVILY_API_KEY` |
| `google` | 158 | Gmail, Drive, Calendar, Sheets, Docs, Slides, Forms, Contacts, People | `GOOGLE_ACCESS_TOKEN` or service account |

### 🔵 Always-On

| Namespace | Tools | Coverage |
|---|---|---|
| `compound` | 22 | Cross-service Super Tools (see below) |
| `ollama` | 16 | Local LLM inference, embedding, chat, model management, streaming |

---

## Compound Super Tools

One call that replaces 5–10 individual API calls. These handle complete workflows internally.

| Tool | What It Does |
|---|---|
| `compound_scaffold_feature` | GitHub branch + Neon DB branch + .env.local update + optional migration |
| `compound_safe_deploy` | Git push + Vercel deploy check + status verification |
| `compound_onboard_saas_customer` | Stripe customer + subscription + Clerk org + welcome email |
| `compound_incident_response` | Latest Sentry errors + recent Vercel deployments for root cause analysis |
| `compound_neon_safe_migration` | Test migration on temp branch → verify → report safe/unsafe |
| `compound_git_commit_push` | git add + commit + push in one call |
| `compound_project_health_check` | GitHub issues/PRs + Vercel deployments + Neon connection + Sentry errors |
| `compound_send_dispatch_notification` | Twilio SMS to driver + Resend email to customer (YardSync) |
| `compound_generate_and_embed` | OpenAI embedding → Qdrant upsert |
| `compound_semantic_search` | OpenAI embedding → Qdrant search |
| `compound_analytics_snapshot` | Stripe MRR + ARR + active subscriptions |
| `compound_deploy_and_release` | Git push + Vercel deploy + Sentry release (full CI/CD) |
| `compound_customer_offboard` | Cancel Stripe subs + Clerk offboard + offboard email |
| `compound_payment_failed_flow` | Find past-due Stripe subs + send Resend dunning emails |
| `compound_customer_support_context` | Stripe billing + Clerk profile + Sentry errors for a user |
| `compound_local_llm_rag` | Ollama embed → Qdrant search → Ollama generate (zero API cost) |
| `compound_sync_users_to_audience` | Clerk users → Resend audience sync |
| `compound_geocode_and_store` | Mapbox geocode → store coordinates in Neon (YardSync) |
| `compound_revenue_summary` | Stripe MRR + past-due customers dashboard |
| `compound_validate_env_vars` | Check all required env vars are set for given services |
| `compound_full_health_dashboard` | Ping Ollama, Neon, Vercel, GitHub, Stripe, Sentry, Qdrant |
| `compound_batch_embed_documents` | Embed + store a batch of documents via OpenAI or Ollama |

---

## Local Machine Tools

The `local` namespace (62 tools) gives your agent a developer's full terminal access, scoped to `WORKSPACE_ROOT`.

| Category | Tools |
|---|---|
| Files | read, write, read_multiple, copy, move, delete, list_directory, make_directory, find_files, search_in_files, get_hash, diff_files, zip_directory, watch_file |
| Processes | run_command, get_process_list, kill_process, check_port, get_system_info |
| Environment | read_env_file, update_env_var |
| Git | git_status, git_diff, git_log, git_branch, git_commit, git_push, git_smart_commit |
| npm/Node | npm_install, npm_run, npm_outdated, npm_audit |
| Super Tools | scaffold_nextjs_component, setup_env_from_vercel |

---

## Project Structure

```
Robinson's Toolkit MCP/
│
├── index.js              ← MCP server — Smart Discovery engine, router, banner
├── audit.js              ← Sync validator — checks handler/registry parity
├── package.json          ← ESM project, 2 dependencies
├── .env                  ← API keys (not committed)
├── .env.example          ← Setup template
│
├── handlers/             ← 23 service handler files
│   ├── github.js         ← 282 tool implementations
│   ├── neon.js           ← 187 tool implementations
│   ├── compound.js       ← 22 Super Tool implementations
│   └── ... (20 more)
│
└── registry/             ← 23 JSON files — tool definitions for Smart Discovery
    ├── github.json       ← 282 tool definitions
    ├── neon.json         ← 187 tool definitions
    └── ... (21 more)
```

**Tool request flow:**
1. Agent calls `search_toolkit("what I need")`
2. `index.js` scores all tools in `registry/*.json` against the query
3. Top matches returned with names + descriptions
4. Agent calls `execute_tool("tool_name", { ...args })`
5. `index.js` routes to the correct `handlers/*.js`
6. Handler makes the API call and returns a clean response

---

## Validation

```bash
# Check all 23 namespaces are in sync
node audit.js

# Boot test (clean exit 124 = working)
timeout 4s node index.js
```

---

## Roadmap

- **Upstash Vector** — vector upsert, semantic search, index management
- **Upstash Kafka** — topic management, message production, consumer group monitoring  
- **Playwright** — headless browser automation, screenshots, DOM extraction, form interaction *(new namespace)*
- **More Compound Tools** — as real workflow patterns emerge from YardSync and Cortiware

---

## Design Philosophy

Every tool is built with one question: **"What would a skilled developer do here?"** Not "what does the API allow," but what a real person at a keyboard would actually do to get the job done.

- **Real operations, not just reads** — tools create, update, delete, and deploy
- **Minimal responses** — handlers strip noise and return only what matters
- **Compound over multi-step** — common multi-tool workflows become single Super Tools
- **Credential-gated clarity** — you only see tools for services you've configured
- **No build step** — plain ESM JavaScript, starts instantly

---

## Troubleshooting

**Server won't start** — Run `node --version` (needs 18+), then `npm install`

**Tools aren't in Claude Code** — Restart after any config change; run `node index.js` to verify the banner shows

**A tool is failing** — Use `get_tool_schema("tool_name")` to check required params; verify your API key has the right permissions

**Tool count lower than expected** — Fill in more `.env` keys; each namespace needs its own credentials

---

## Version

**v2.0.0** — Smart Discovery architecture, 2,231 tools across 25 namespaces.

Built by Chris Robinson, Robinson AI Systems LLC.
