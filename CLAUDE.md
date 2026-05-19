# CLAUDE.md — Robinson's Toolkit MCP
## Master Session Reference & Progress Tracker

> **Read this at the start of every session.** This is the single source of truth for project state, open issues, session history, and next steps. Update before committing.

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

---

## Architecture Quick Reference

**Smart Discovery** — Agent sees 4 meta-tools + ~15 pinned tools. Everything else found via `search_toolkit`.

| Meta-Tool | Purpose |
|---|---|
| `search_toolkit` | Find any tool by plain English |
| `list_namespaces` | See active (credentialed) namespaces |
| `get_tool_schema` | Get full parameter schema for a tool |
| `execute_tool` | Run any tool by name |

**Key files:** `index.js` · `handlers/*.js` · `registry/*.json` · `.env`

**Routing special cases in `index.js`:**
- `gmail_*` `drive_*` `calendar_*` `sheets_*` `docs_*` `slides_*` `forms_*` `people_*` → `google`
- `cf_*` → `cloudflare`
- `brave_*` `tavily_*` → `search`

**Always-on namespaces (no API key):** `local`, `compound`, `ollama`

---

## Current State — Session 5

**Total registered tools: 1,780** across 23 namespaces
**Active at boot: ~1,360** (depends on .env credentials)

### Namespace Status

| Namespace | Tools | Sync | Status |
|---|---|---|---|
| `github` | 282 | ✅ | ✅ COMPLETE (target 250+) |
| `neon` | 187 | ✅ | ✅ COMPLETE (target 150+) |
| `vercel` | 150 | ✅ | ✅ COMPLETE (target 150) |
| `upstash` | 149 | ✅ | ⚠️ needs Vector + Kafka sections |
| `cloudflare` | 148 | ✅ | ✅ COMPLETE (target 120+) |
| `stripe` | 143 | ✅ | ✅ COMPLETE (target 130+) |
| `google` | 158 | ✅ | ✅ COMPLETE (target 130+) |
| `openai` | 109 | ✅ | ✅ COMPLETE (target 100+) |
| `twilio` | 94 | ✅ | ✅ COMPLETE (target 90+) |
| `anthropic` | 61 | ✅ | ✅ COMPLETE (target 60+) |
| `local` | 62 | ✅ | ✅ COMPLETE (target 30+) |
| `ollama` | 16 | ✅ | ✅ COMPLETE (new namespace) |
| `fly` | 37 | ✅ | 🔴 target 100+ |
| `supabase` | 36 | ✅ | 🔴 target 100+ |
| `clerk` | 30 | ✅ | 🔴 target 80+ |
| `resend` | 23 | ✅ | 🟠 target 70+ |
| `sentry` | 17 | ✅ | 🟠 target 60+ |
| `qdrant` | 17 | ✅ | 🟠 target 60+ |
| `mapbox` | 15 | ✅ | 🟡 target 60+ |
| `n8n` | 13 | ✅ | 🟡 target 50+ |
| `postgres` | 12 | ✅ | 🟡 target 50+ |
| `compound` | 11 | ✅ | 🟡 target 50+ |
| `search` | 10 | ✅ | 🟡 target 30+ |
| `playwright` | 0 | — | ⬜ NEW — not yet built |

---

## Open Issues

### 🔴 Build Backlog (priority order)

| # | Namespace | Current | Target | Priority Reason |
|---|---|---|---|---|
| 1 | `fly` | 37 | 100+ | Production hosting — Postgres, volumes, certs, machines |
| 2 | `supabase` | 36 | 100+ | Auth, realtime, edge functions, storage, RLS |
| 3 | `clerk` | 30 | 80+ | Multi-tenant auth for Cortiware |
| 4 | `resend` | 23 | 70+ | Transactional email, domains, contacts, broadcasts |
| 5 | `sentry` | 17 | 60+ | Error tracking, releases, performance |
| 6 | `qdrant` | 17 | 60+ | Vector search deeper — collections, snapshots, bulk |
| 7 | `upstash` | 149 | 180+ | Add Vector and Kafka namespaces |
| 8 | `mapbox` | 15 | 60+ | Routing, directions, isochrones, geocoding deeper |
| 9 | `n8n` | 13 | 50+ | Executions, credentials, deeper workflow ops |
| 10 | `postgres` | 12 | 50+ | Direct DB ops, schema inspection, query analysis |
| 11 | `compound` | 11 | 50+ | Cross-service Super Tools |
| 12 | `search` | 10 | 30+ | Brave + Tavily deeper coverage |
| 13 | `playwright` | 0 | 60+ | NEW namespace — browser automation |

---

## Session Log

### Session 1 — Initial Build (`6c0e07e`)
- All 22 handler files, Smart Discovery, registry scaffolding, MCP boot

### Session 2 — Registry, Routing, Vercel (`c910410`)
- All 22 registry JSON files completed; routing fixes; vercel 88→150+9 Super Tools; README.md; .env.example
- Total: 736 active / 1,084 registered

### Session 3 — Docs, Repo Rename, Neon (`4ca8bc3` `786943b`)
- CLAUDE.md + ClaudeBuildPlan.md; repo renamed to `robinsons-toolkit-mcp`; PAT push configured
- neon 89→187 tools (SQL, schema, data ops, pgvector, FTS, RLS, monitoring, 8 Super Tools)
- Neon org_id auto-discovery bug fixed
- Total: 1,184 registered

### Session 4 — Six Major Expansions (`54f691a`+)
- github 201→282 (Actions, runners, codespaces, security, environments)
- anthropic 15→61 (vision, PDF, structured output, admin API)
- openai 41→109 (Responses API, Realtime, Batch, Evals, Vector Stores)
- cloudflare 54→148 (D1, Workers AI, Queues, Zero Trust, KV deeper)
- google 60→158 (Slides, Forms, Contacts, deeper Gmail/Drive/Calendar)
- twilio 22→94 (Voice, Verify, WhatsApp, Studio, Conversations)
- local 14→62 (git, npm, filesystem, processes, ports, 3 Super Tools)
- Total: 1,692 registered

### Session 5 — Stripe, Ollama, Docs (`6659443` `bd01ab2`)
- stripe 71→143 (charges, setup intents, payment links, subscription schedules, metered billing, tax rates, quotes, credit notes, Connect deeper, events, files, reporting, 6 Super Tools)
- ollama: new namespace from scratch — 16 tools, always-on, WSL2→Windows host bridge
  (model management, generate, chat, embed, health check, code complete, extract_json, agent_task)
- CLAUDE.md, README.md, ClaudeBuildPlan.md synced
- Total: 1,780 registered

---

## Quick Commands

```bash
# Boot test (expect exit 124 = clean timeout)
cd /home/robinson_dev/projects/robinsons-toolkit && timeout 4s node index.js 2>&1

# Full sync audit
node -e "const fs=require('fs'); const handlers=fs.readdirSync('handlers').filter(f=>f.endsWith('.js')); let total=0; for(const hf of handlers){ const ns=hf.replace('.js',''); const reg='registry/'+ns+'.json'; if(!fs.existsSync(reg)) continue; const h=fs.readFileSync('handlers/'+hf,'utf-8'); const r=JSON.parse(fs.readFileSync(reg,'utf-8')); const hT=new Set([...h.matchAll(new RegExp(\"tool === '(\"+ns+\"_[^']+)'\", 'g'))].map(m=>m[1])); const rT=new Set(r.map(t=>t.name)); const gaps=[...hT].filter(t=>!rT.has(t)).length+[...rT].filter(t=>!hT.has(t)).length; total+=rT.size; console.log(ns+':'+(gaps?'❌ '+gaps+' gap(s)':'✅ '+rT.size)); } console.log('Total:',total);"

# Total count
node -e "const fs=require('fs'); let t=0; fs.readdirSync('registry').filter(f=>f.endsWith('.json')).forEach(f=>{t+=JSON.parse(fs.readFileSync('registry/'+f,'utf-8')).length;}); console.log(t);"

# Push
git push origin main
```

---

## Environment Variables

```
WORKSPACE_ROOT=
GITHUB_TOKEN=                   # github namespace
GITHUB_PERSONAL_ACCESS_TOKEN=   # git push (embedded in remote URL)
VERCEL_TOKEN=                   # vercel namespace
NEON_API_KEY=                   # neon namespace
FLY_API_TOKEN=                  # fly namespace
STRIPE_SECRET_KEY=              # stripe namespace
TWILIO_ACCOUNT_SID=             # twilio namespace
TWILIO_AUTH_TOKEN=              # twilio namespace
RESEND_API_KEY=                 # resend namespace
CLOUDFLARE_API_TOKEN=           # cloudflare namespace
CLOUDFLARE_ACCOUNT_ID=          # cloudflare namespace
OPENAI_API_KEY=                 # openai namespace
ANTHROPIC_API_KEY=              # anthropic namespace
SUPABASE_URL=                   # supabase namespace
SUPABASE_SERVICE_ROLE_KEY=      # supabase namespace
UPSTASH_REDIS_REST_URL=         # upstash namespace
UPSTASH_REDIS_REST_TOKEN=       # upstash namespace
GOOGLE_ACCESS_TOKEN=            # google namespace (either/or)
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=# google namespace
MAPBOX_ACCESS_TOKEN=            # mapbox namespace
CLERK_SECRET_KEY=               # clerk namespace
SENTRY_AUTH_TOKEN=              # sentry namespace
BRAVE_SEARCH_API_KEY=           # search namespace (either/or)
TAVILY_API_KEY=                 # search namespace
QDRANT_URL=                     # qdrant namespace
N8N_BASE_URL=                   # n8n namespace
N8N_API_KEY=                    # n8n namespace
POSTGRES_CONNECTION_STRING=     # postgres namespace
OLLAMA_BASE_URL=                # ollama (default: http://172.19.16.1:11434)
OLLAMA_DEFAULT_MODEL=           # ollama (default: qwen2.5-coder:7b)
OLLAMA_TIMEOUT_MS=              # ollama generation timeout (default: 300000)
```

---

*Last updated: Session 5 — stripe complete, ollama namespace added, 1,780 registered tools.*
*Next: fly → supabase → clerk → resend → sentry → qdrant → upstash Vector/Kafka → playwright*
