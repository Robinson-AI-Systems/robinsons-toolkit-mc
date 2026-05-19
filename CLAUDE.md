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
| **GitHub** | `https://github.com/Robinson-AI-Systems/robinsons-toolkit-mcp` |
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

## Current State — As of Session 4

**Total registered tools: 1,233** across 22 namespaces
**Active at boot (WSL2 dev env): ~885** (depends on which .env keys are set)

### Tool Count by Namespace

| Namespace | Registry | Handler | Sync | Target | Gap |
|---|---|---|---|---|---|
| `github` | 201 | 201 | ✅ | 250+ | ~50 |
| `neon` | 187 | 187 | ✅ | 187 | **COMPLETE** |
| `vercel` | 150 | 150 | ✅ | 150 | **COMPLETE** |
| `upstash` | 149 | 149 | ✅ | 180+ | ~31 |
| `stripe` | 71 | 71 | ✅ | 130+ | ~59 |
| `local` | 62 | 62 | ✅ | 30+ | **COMPLETE** |
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
| `n8n` | 13 | 13 | ✅ | 50+ | ~37 |
| `postgres` | 12 | 12 | ✅ | 50+ | ~38 |
| `compound` | 11 | 11 | ✅ | 50+ | ~39 |
| `search` | 10 | 10 | ✅ | 30+ | ~20 |

> **Audit script note:** The sync audit in Quick Commands below uses a regex `tool === '{namespace}_...'`. For namespaces with aliased prefixes (`google`→`gmail_*`/`drive_*`/`calendar_*`/`sheets_*`/`docs_*`, `cloudflare`→`cf_*`, `search`→`brave_*`/`tavily_*`), the script under-reports handler tool counts. These are NOT real sync issues — the actual routing in `index.js` handles the aliases correctly. The counts above reflect the true state.

---

## Known Sync Issues

**None outstanding.** All 22 namespaces in perfect sync.

---

## Issue Tracker

### ✅ Resolved

| Issue | Resolution | Commit |
|---|---|---|
| 8 registry JSON files missing | All 22 registry files written | `c910410` |
| Google sub-service routing broken | Fixed `parts[1]` → `parts[0]` in index.js | `c910410` |
| Cloudflare `cf_*` routing broken | Added `cf` → `cloudflare` mapping | `c910410` |
| Duplicate `fly(1).json` | Deleted | `c910410` |
| `vercel.js` incomplete (88/150) | Expanded to 150 + 9 Super Tools | `c910410` |
| No README | Added `README.md` | `c910410` |
| No `.env.example` | Added with all 22 namespaces | `c910410` |
| CLAUDE.md + ClaudeBuildPlan.md missing | Created both | `4ca8bc3` |
| GitHub repo named `robinsons-toolkit-mc` | Renamed to `robinsons-toolkit-mcp` via API | `4ca8bc3` |
| Git push not working (no PAT) | `GITHUB_PERSONAL_ACCESS_TOKEN` embedded in remote URL | `4ca8bc3` |
| `neon.js` at 89 tools (87 registry, 2 gaps) | Expanded to 187 tools, 187 registry, perfect sync | `786943b` |
| `local.js` handler/registry out of sync (14/13) | Rebuilt to 62/62, complete local machine bridge | `df7dfd9` |

### 🟠 Open — Medium Priority

| # | Issue | Notes |
|---|---|---|
| 1 | `github.js` under-built (201/250 target) | Actions, Dependabot, code scanning, environments, traffic, secrets |
| 2 | `anthropic.js` under-built (15/60 target) | Batches, files, deeper messages, models, streaming utilities |
| 3 | `cloudflare.js` under-built (54/120 target) | D1, Workers AI, Queues, Durable Objects, Zero Trust |
| 4 | `openai.js` under-built (41/100 target) | Realtime API, Batch, Evals, Vector Stores |
| 5 | `google.js` under-built (60/130 target) | Deeper Gmail, Drive, Sheets, Calendar, Docs |
| 6 | `stripe.js` under-built (71/130 target) | Connect platform, Checkout, billing lifecycle |
| 7 | `twilio.js` under-built (22/90 target) | Voice, WhatsApp, Verify, Studio missing |
| 8 | `fly.js` under-built (37/100 target) | Postgres clusters, volumes, certificates |

### 🟢 Open — Low Priority

| # | Issue | Notes |
|---|---|---|
| 9 | `playwright` namespace missing | New handler + registry, 60 tools from scratch |
| 10 | Upstash Vector + Kafka | Within upstash.js namespace |
| 11 | More `compound` Super Tools | Cross-service orchestrations |

---

## Session Log

### Session 1 — Initial Build (commit `6c0e07e`)
- Full project architecture established from scratch
- All 22 handler files written (baseline implementations)
- Smart Discovery system built in `index.js`
- Registry folder created with partial JSON files
- Server boots and serves tools via MCP stdio

### Session 2 — Registry, Routing, Vercel Expansion (commit `c910410`)
- All 8 missing registry JSON files completed (22/22 namespaces)
- Fixed 3 routing bugs (Google sub-services, Cloudflare `cf_*`)
- `vercel.js`: 88 → 150 tools + 9 Super Tools
- Added `README.md` and `.env.example`
- Cleaned up duplicate files
- Total: 333 → 736 active / 1,084 registered

### Session 3 — Docs, Repo Rename, Neon Expansion (commits `4ca8bc3`, `786943b`)
- Created `CLAUDE.md` master session tracker
- Created `ClaudeBuildPlan.md` systematic build roadmap
- Renamed GitHub repo: `robinsons-toolkit-mc` → `robinsons-toolkit-mcp` via API
- Fixed git push with `GITHUB_PERSONAL_ACCESS_TOKEN` embedded in remote URL
- Tested Vercel toolkit against live projects (confirmed working)
- Expanded `neon.js`: 89 → 187 tools (+98), registry 87 → 187, perfect sync
  - 11 categories: SQL utilities, schema inspection, schema modification,
    data operations, pgvector/AI, full-text search, permissions/RLS,
    advanced monitoring, branching, billing, 8 Super Tools
- Total: 1,084 → 1,184 registered / 836 active

### Session 4 — Local Bridge Rebuild (commit `df7dfd9`)
- Rebuilt `local.js`: 14 → 62 tools, registry 13 → 62, perfect sync
- Resolved the longstanding handler/registry mismatch
- Complete local machine bridge: filesystem, processes, ports, git, npm, env files, hashing, zipping, diff
- Total: 1,184 → 1,233 registered / ~885 active

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

**Super Tool naming:** Descriptive verb phrases. Use `_and_` for combined ops (e.g. `vercel_deploy_and_wait`), plain descriptive names for orchestrations (e.g. `neon_safe_migration`, `neon_full_health_report`). Always prefix registry description with `SUPER TOOL:`.

---

## Development Workflow — Adding Tools Correctly

```
1. Read the handler file to understand existing patterns
2. Check the registry for what's already defined
3. Add tool implementation to handler/{namespace}.js
4. Add matching entry to registry/{namespace}.json
   - name, description, namespace, tags[], inputSchema
5. Run sync audit (see Quick Commands below)
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

## Quick Commands

```bash
# Boot test
cd /home/robinson_dev/projects/robinsons-toolkit && timeout 4s node index.js 2>&1

# Full sync audit (all namespaces)
node -e "
const fs=require('fs');
const handlers=fs.readdirSync('handlers').filter(f=>f.endsWith('.js'));
let total=0;
for(const hf of handlers){
  const ns=hf.replace('.js','');
  const reg='registry/'+ns+'.json';
  if(!fs.existsSync(reg)) continue;
  const h=fs.readFileSync('handlers/'+hf,'utf-8');
  const r=JSON.parse(fs.readFileSync(reg,'utf-8'));
  const hT=new Set([...h.matchAll(new RegExp(\"tool === '(\"+ns+\"_[^']+)'\", 'g'))].map(m=>m[1]));
  const rT=new Set(r.map(t=>t.name));
  const inHnotR=[...hT].filter(t=>!rT.has(t));
  const inRnotH=[...rT].filter(t=>!hT.has(t));
  total+=rT.size;
  if(inHnotR.length||inRnotH.length){
    console.log('⚠️  '+ns+': H='+hT.size+' R='+rT.size);
    if(inHnotR.length) console.log('   In H not R:',inHnotR);
    if(inRnotH.length) console.log('   In R not H:',inRnotH);
  } else {
    console.log('✅ '+ns+': '+rT.size);
  }
}
console.log('Total:',total);
"

# Total tool count
node -e "const fs=require('fs'); let t=0; fs.readdirSync('registry').filter(f=>f.endsWith('.json')).forEach(f=>{const r=JSON.parse(fs.readFileSync('registry/'+f,'utf-8'));t+=r.length;}); console.log('Total:',t);"

# Git push
git push origin main
```

---

## Environment Variables Reference

```
WORKSPACE_ROOT=             # Local directory root (always required)
GITHUB_TOKEN=               # github namespace
GITHUB_PERSONAL_ACCESS_TOKEN=  # git push auth (embedded in remote URL)
VERCEL_TOKEN=               # vercel namespace
VERCEL_TEAM_ID=             # optional
NEON_API_KEY=               # neon namespace
FLY_API_TOKEN=              # fly namespace
STRIPE_SECRET_KEY=          # stripe namespace
TWILIO_ACCOUNT_SID=         # twilio namespace
TWILIO_AUTH_TOKEN=          # twilio namespace
RESEND_API_KEY=             # resend namespace
CLOUDFLARE_API_TOKEN=       # cloudflare namespace
CLOUDFLARE_ACCOUNT_ID=      # cloudflare namespace
OPENAI_API_KEY=             # openai namespace
ANTHROPIC_API_KEY=          # anthropic namespace
SUPABASE_URL=               # supabase namespace
SUPABASE_SERVICE_ROLE_KEY=  # supabase namespace
UPSTASH_REDIS_REST_URL=     # upstash namespace
UPSTASH_REDIS_REST_TOKEN=   # upstash namespace
GOOGLE_ACCESS_TOKEN=        # google namespace (either/or)
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=  # google namespace
MAPBOX_ACCESS_TOKEN=        # mapbox namespace
CLERK_SECRET_KEY=           # clerk namespace
SENTRY_AUTH_TOKEN=          # sentry namespace
BRAVE_SEARCH_API_KEY=       # search namespace (either/or)
TAVILY_API_KEY=             # search namespace
QDRANT_URL=                 # qdrant namespace
N8N_BASE_URL=               # n8n namespace
N8N_API_KEY=                # n8n namespace
POSTGRES_CONNECTION_STRING= # postgres namespace
```

---

*Last updated: Session 4 — local.js rebuilt to 62 tools (complete), all sync issues resolved.*
*Session 5 priority order (per Chris): github → anthropic → openai → cloudflare → google.*
