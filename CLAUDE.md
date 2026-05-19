# CLAUDE.md — Robinson's Toolkit MCP
## Master Session Reference & Progress Tracker

> **Read this at the start of every session.** This file is the single source of truth for project state, open issues, session history, and next steps. Update it at the end of every session before committing.

---

## Project Identity

| Field | Value |
|---|---|
| **Name** | Robinson's Toolkit MCP v2.0 |
| **WSL2 Path** | `/home/robinson_dev/projects/robinsons-toolkit/` |
| **Windows Path** | `C:\Users\chris\Google Drive\Robinson's Toolkit MCP\` |
| **GitHub** | `https://github.com/Robinson-AI-Systems/robinsons-toolkit-mc` |
| **Branch** | `main` |
| **Owner** | Chris Robinson — Robinson AI Systems LLC |
| **Node** | ESM, requires >=18, no build step |
| **Dependencies** | `@modelcontextprotocol/sdk`, `dotenv` only |

---

## Architecture Quick Reference

**Smart Discovery** — Agent sees 4 meta-tools + ~15 pinned tools always. Everything else hidden until `search_toolkit` finds it.

| Meta-Tool | Purpose |
|---|---|
| `search_toolkit` | Find any tool by plain-English description |
| `list_namespaces` | See which service namespaces are active (credentialed) |
| `get_tool_schema` | Get full parameter schema for a specific tool |
| `execute_tool` | Run any tool by name with arguments |

**Key files:**
- `index.js` — MCP server, Smart Discovery engine, namespace routing, banner
- `handlers/*.js` — 22 files, one per namespace, all actual API logic lives here
- `registry/*.json` — 22 files, tool definitions used by search_toolkit
- `.env` — all API credentials, controls which namespaces activate
- `WORKSPACE_ROOT` — set in `.env`, scopes all local file operations

**Routing pattern in `index.js`:** Tool name prefix → handler namespace. Special cases patched:
- `gmail_*`, `drive_*`, `calendar_*`, `sheets_*`, `docs_*` → `google` handler
- `cf_*` → `cloudflare` handler
- `brave_*`, `tavily_*` → `search` handler

**Credential gating:** `local` and `compound` are always on. All others require their key(s) in `.env`.

---

## Current State — As of Session 2

**Total registered tools: 1,084** across 22 namespaces  
**Active at boot (WSL2 dev env): ~736** (depends on which .env keys are set)

### Tool Count by Namespace

| Namespace | Registry | Handler | Sync | Target | Gap |
|---|---|---|---|---|---|
| `github` | 201 | 201 | ✅ | 250+ | ~50 |
| `vercel` | 150 | 150 | ✅ | 150 | **COMPLETE** |
| `upstash` | 149 | 149 | ✅ | 180+ | ~31 |
| `neon` | 87 | 89 | ⚠️ | 150+ | ~61 |
| `stripe` | 71 | 71 | ✅ | 130+ | ~59 |
| `google` | 60 | 60 | ✅ | 130+ | ~70 |
| `cloudflare` | 54 | 54 | ✅ | 120+ | ~66 |
| `openai` | 41 | 41 | ✅ | 100+ | ~59 |
| `fly` | 37 | 37 | ✅ | 100+ | ~63 |
| `supabase` | 36 | 36 | ✅ | 100+ | ~64 |
| `clerk` | 30 | 30 | ✅ | 80+ | ~50 |
| `resend` | 23 | 23 | ✅ | 70+ | ~47 |
| `twilio` | 22 | 22 | ✅ | 90+ | ~68 |
| `qdrant` | 17 | 17 | ✅ | 60+ | ~43 |
| `sentry` | 17 | 17 | ✅ | 60+ | ~43 |
| `anthropic` | 15 | 15 | ✅ | 60+ | ~45 |
| `mapbox` | 15 | 15 | ✅ | 60+ | ~45 |
| `local` | 13 | 14 | ⚠️ | 30+ | ~16 |
| `n8n` | 13 | 13 | ✅ | 50+ | ~37 |
| `postgres` | 12 | 12 | ✅ | 50+ | ~38 |
| `compound` | 11 | 11 | ✅ | 50+ | ~39 |
| `search` | 10 | 10 | ✅ | 30+ | ~20 |

---

## Known Sync Issues (Fix Before New Tool Work)

### ⚠️ `local` — Handler/Registry Mismatch
**Handler has 14 tools, registry has 13. 7 tools are in handler but NOT registry, 6 in registry but NOT handler.**

In handler, missing from registry:
```
local_read_multiple_files, local_copy_file, local_make_directory,
local_read_env_file, local_update_env_var, local_get_system_info,
local_find_files
```
In registry, missing from handler:
```
local_create_directory, local_run_script, local_git_log,
local_get_env, local_set_env, local_search_files
```
**Fix:** Reconcile — keep handler as truth, rewrite local.json to match, then expand both.

### ⚠️ `neon` — Handler Has 2 Extra Tools
**Handler has 89 tools, registry has 87. 2 tools are in handler but NOT registry.**

Missing registry entries:
```
neon_get_connection_string, neon_setup_rad_database
```
**Fix:** Add these 2 entries to `registry/neon.json`.

---

## Issue Tracker

### ✅ Resolved

| Issue | Resolution | Commit |
|---|---|---|
| 8 registry JSON files missing | All 22 registry files written | `c910410` |
| Google sub-service routing broken | Fixed `parts[1]` → `parts[0]` in index.js | `c910410` |
| Cloudflare `cf_*` routing broken | Added `cf` → `cloudflare` mapping in index.js | `c910410` |
| Duplicate `fly(1).json` in registry | Deleted | `c910410` |
| `vercel.js` incomplete (88/150) | Expanded to 150 + 9 Super Tools | `c910410` |
| No README | Added `README.md` | `c910410` |
| No `.env.example` | Added `.env.example` with all 22 namespaces | `c910410` |

### 🔴 Open — High Priority

| # | Issue | File | Notes |
|---|---|---|---|
| 1 | `local.js` handler/registry out of sync | `handlers/local.js`, `registry/local.json` | 7 in handler not in registry, 6 in registry not in handler |
| 2 | `neon.js` 2 tools not in registry | `registry/neon.json` | Add `neon_get_connection_string`, `neon_setup_rad_database` |
| 3 | `neon.js` under-built (89/150 target) | `handlers/neon.js`, `registry/neon.json` | Core stack priority — do after sync fix |
| 4 | `github.js` needs audit | `handlers/github.js` | 201 tools but need to verify depth vs. official API capabilities |

### 🟡 Open — Medium Priority

| # | Issue | Notes |
|---|---|---|
| 5 | `stripe.js` under-built (71/130 target) | Billing lifecycle, advanced webhooks, Connect platform |
| 6 | `google.js` under-built (60/130 target) | Deeper Gmail, Drive, Sheets, Calendar, Docs coverage |
| 7 | `twilio.js` under-built (22/90 target) | Voice, WhatsApp, Verify, Studio, TaskRouter missing |
| 8 | `fly.js` under-built (37/100 target) | Postgres clusters, certificates, secrets, volumes deeper |
| 9 | `cloudflare.js` under-built (54/120 target) | D1, Workers AI, Analytics Engine, Queues, Durable Objects |
| 10 | `openai.js` under-built (41/100 target) | Realtime API, Evals, structured outputs, batch deeper |

### 🟢 Open — Low Priority (planned namespaces not yet built)

| # | Issue | Notes |
|---|---|---|
| 11 | `playwright` namespace missing | Handler + registry to create from scratch |
| 12 | Upstash Vector namespace | Within upstash.js handler, separate registry section |
| 13 | Upstash Kafka namespace | Within upstash.js handler, separate registry section |
| 14 | More `compound` Super Tools | See ClaudeBuildPlan.md for planned list |

---

## Session Log

### Session 1 — Initial Build (commit `6c0e07e`)
- Full project architecture established from scratch
- All 22 handler files written (baseline implementations)
- Smart Discovery system built in `index.js`
- Registry folder created with partial JSON files
- SETUP.bat, claude-code-config.json, package.json added
- Server boots and serves tools via MCP stdio

### Session 2 — Registry, Routing, Vercel Expansion (commit `c910410`)
- Read all Creation Docs to understand architecture context
- Completed all 8 missing registry JSON files (neon, upstash, openai, cloudflare, supabase, google, compound + vercel base)
- Fixed 3 routing bugs in `index.js` (Google sub-services, Cloudflare `cf_*` prefix)
- Expanded `vercel.js`: 88 → 150 tools (+62), added 9 Super Tools
- Wrote `README.md` (full setup guide, namespace reference, philosophy)
- Wrote `.env.example` (all 22 namespaces with key source links)
- Cleaned up: deleted `fly(1).json` duplicate, old `.docx` reference file
- Total toolkit: 333 → 736 active / 1,084 registered

---

## Naming Conventions — Critical

| Pattern | Example | Namespace |
|---|---|---|
| `{namespace}_{action}_{subject}` | `neon_create_branch` | standard |
| `cf_{action}_{subject}` | `cf_list_zones` | cloudflare only |
| `gmail_{action}` | `gmail_send_email` | google handler |
| `drive_{action}` | `drive_list_files` | google handler |
| `calendar_{action}` | `calendar_create_event` | google handler |
| `sheets_{action}` | `sheets_get_values` | google handler |
| `docs_{action}` | `docs_get_document` | google handler |
| `{namespace}_{operation}_and_{operation}` | `vercel_deploy_and_wait` | Super Tool pattern |

**Super Tool naming:** Should clearly indicate it's multi-step. Use `_and_` for combined ops, descriptive verb phrases for orchestrations (e.g. `vercel_emergency_rollback`, `neon_safe_migration`).

---

## Development Workflow — Adding Tools Correctly

```
1. Read the handler file first to understand existing patterns
2. Check the registry file to see what's already defined
3. Add new tool implementation to handler/{namespace}.js
4. Add matching registry entry to registry/{namespace}.json
   - name, description, namespace, tags[], inputSchema
5. Run sync audit:
   node -e "const fs=require('fs'); const h=fs.readFileSync('handlers/{ns}.js','utf-8');
   const r=JSON.parse(fs.readFileSync('registry/{ns}.json','utf-8'));
   const hT=new Set([...h.matchAll(/tool==='({ns}_[^']+)'/g)].map(m=>m[1]));
   const rT=new Set(r.map(t=>t.name));
   console.log('Missing registry:',[...hT].filter(t=>!rT.has(t)));
   console.log('Missing handler:',[...rT].filter(t=>!hT.has(t)));"
6. Boot test: timeout 4s node index.js 2>&1
7. Commit with clear conventional message
```

**Registry entry schema:**
```json
{
  "name": "namespace_tool_name",
  "description": "Clear description of what this tool does",
  "namespace": "namespace",
  "tags": ["namespace", "action", "subject", "relevant-keywords"],
  "inputSchema": {
    "type": "object",
    "properties": { "param": { "type": "string", "description": "..." } },
    "required": ["param"]
  }
}
```

---

## Environment Variables Reference

```
WORKSPACE_ROOT=        # Local directory Claude can read/write (always required)
GITHUB_TOKEN=          # github namespace
VERCEL_TOKEN=          # vercel namespace
VERCEL_TEAM_ID=        # optional — auto-appended to Vercel API calls
NEON_API_KEY=          # neon namespace
FLY_API_TOKEN=         # fly namespace
STRIPE_SECRET_KEY=     # stripe namespace
TWILIO_ACCOUNT_SID=    # twilio namespace (both required)
TWILIO_AUTH_TOKEN=     # twilio namespace
RESEND_API_KEY=        # resend namespace
CLOUDFLARE_API_TOKEN=  # cloudflare namespace (both required)
CLOUDFLARE_ACCOUNT_ID= # cloudflare namespace
OPENAI_API_KEY=        # openai namespace
ANTHROPIC_API_KEY=     # anthropic namespace
SUPABASE_URL=          # supabase namespace (both required)
SUPABASE_SERVICE_ROLE_KEY= # supabase namespace
UPSTASH_REDIS_REST_URL=    # upstash namespace (both required)
UPSTASH_REDIS_REST_TOKEN=  # upstash namespace
GOOGLE_ACCESS_TOKEN=       # google namespace (either/or)
GOOGLE_SERVICE_ACCOUNT_KEY_PATH= # google namespace
MAPBOX_ACCESS_TOKEN=   # mapbox namespace
CLERK_SECRET_KEY=      # clerk namespace
SENTRY_AUTH_TOKEN=     # sentry namespace
BRAVE_SEARCH_API_KEY=  # search namespace (either/or)
TAVILY_API_KEY=        # search namespace
QDRANT_URL=            # qdrant namespace
N8N_BASE_URL=          # n8n namespace (both required)
N8N_API_KEY=           # n8n namespace
POSTGRES_CONNECTION_STRING= # postgres namespace
```

---

## Quick Commands

```bash
# Boot test
cd /home/robinson_dev/projects/robinsons-toolkit && timeout 4s node index.js 2>&1

# Full sync audit across all namespaces
node -e "const fs=require('fs'); const handlers=fs.readdirSync('handlers').filter(f=>f.endsWith('.js')); for(const hf of handlers){ const ns=hf.replace('.js',''); const reg='registry/'+ns+'.json'; if(!fs.existsSync(reg)) continue; const h=fs.readFileSync('handlers/'+hf,'utf-8'); const r=JSON.parse(fs.readFileSync(reg,'utf-8')); const hT=new Set([...h.matchAll(/tool === '("+ns+"_[^']+)'/g)].map(m=>m[1])); const rT=new Set(r.map(t=>t.name)); const gaps=[...hT].filter(t=>!rT.has(t)).length+[...rT].filter(t=>!hT.has(t)).length; console.log(ns+':'+(gaps?'❌ '+gaps+' gap(s)':'✅')); }"

# Count all tools
node -e "const fs=require('fs'); let t=0; fs.readdirSync('registry').filter(f=>f.endsWith('.json')).forEach(f=>{const r=JSON.parse(fs.readFileSync('registry/'+f,'utf-8'));t+=r.length;}); console.log('Total tools:',t);"

# Git status
git status && git log --oneline -5
```

---

*Last updated: Session 2 — vercel.js completed to 150 tools, all registries written, routing fixed.*
*Next session should start with: Fix local.js sync, fix neon.js registry gap, then build neon.js to 150+ tools.*
