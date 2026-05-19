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

**Key files:** `index.js` · `handlers/*.js` · `registry/*.json` · `.env` · `audit.js`

**Routing special cases in `index.js`:**
- `gmail_*` `drive_*` `calendar_*` `sheets_*` `docs_*` `slides_*` `forms_*` `people_*` `contacts_*` → `google`
- `cf_*` → `cloudflare`
- `brave_*` `tavily_*` `search_*` → `search`

**Always-on namespaces (no API key):** `local`, `compound`, `ollama`

---

## Current State — Session 6

**Total registered tools: 1,949** across 23 namespaces  
**Validation: ✅ 23/23 namespaces perfectly synced** (run `node audit.js` to verify)

### Namespace Status

| Namespace | Tools | Sync | Status |
|---|---|---|---|
| `github` | 282 | ✅ | ✅ COMPLETE |
| `neon` | 187 | ✅ | ✅ COMPLETE |
| `vercel` | 150 | ✅ | ✅ COMPLETE |
| `upstash` | 149 | ✅ | ⚠️ needs Vector + Kafka sections |
| `cloudflare` | 148 | ✅ | ✅ COMPLETE |
| `stripe` | 143 | ✅ | ✅ COMPLETE |
| `google` | 158 | ✅ | ✅ COMPLETE |
| `supabase` | 98 | ✅ | ✅ COMPLETE |
| `twilio` | 94 | ✅ | ✅ COMPLETE |
| `openai` | 109 | ✅ | ✅ COMPLETE |
| `clerk` | 75 | ✅ | ✅ COMPLETE |
| `fly` | 76 | ✅ | ✅ COMPLETE |
| `anthropic` | 61 | ✅ | ✅ COMPLETE |
| `local` | 62 | ✅ | ✅ COMPLETE |
| `resend` | 46 | ✅ | ✅ COMPLETE |
| `ollama` | 16 | ✅ | ✅ COMPLETE |
| `sentry` | 17 | ✅ | 🔴 target 60+ |
| `qdrant` | 17 | ✅ | 🔴 target 60+ |
| `mapbox` | 15 | ✅ | 🟠 target 60+ |
| `n8n` | 13 | ✅ | 🟠 target 50+ |
| `postgres` | 12 | ✅ | 🟡 target 50+ |
| `compound` | 11 | ✅ | 🟡 target 50+ |
| `search` | 10 | ✅ | 🟡 target 30+ |
| `playwright` | 0 | — | ⬜ NEW — not yet built |

---

## Open Issues / Build Backlog

| # | Namespace | Current | Target | Notes |
|---|---|---|---|---|
| 1 | `sentry` | 17 | 60+ | Error tracking, releases, performance, alerts |
| 2 | `qdrant` | 17 | 60+ | Collections, snapshots, payload indexing, bulk ops |
| 3 | `upstash` | 149 | 180+ | Add Vector and Kafka namespaces |
| 4 | `mapbox` | 15 | 60+ | Routing, directions, isochrones, geocoding deeper |
| 5 | `n8n` | 13 | 50+ | Executions, credentials, deeper workflow ops |
| 6 | `postgres` | 12 | 50+ | Schema inspection, query analysis, direct DB ops |
| 7 | `compound` | 11 | 50+ | Cross-service Super Tools |
| 8 | `search` | 10 | 30+ | Brave + Tavily deeper coverage |
| 9 | `playwright` | 0 | 60+ | NEW namespace — browser automation |

---

## Session Log

### Session 1 (`6c0e07e`)
All 22 handler files, Smart Discovery, registry scaffolding, MCP boot.

### Session 2 (`c910410`)
Registry JSON files; routing fixes; vercel 88→150+Super Tools; README; .env.example. Total: ~1,084 registered.

### Session 3 (`4ca8bc3` `786943b`)
CLAUDE.md + ClaudeBuildPlan.md; repo renamed; PAT push; neon 89→187; org_id bug fixed. Total: 1,184.

### Session 4 (`54f691a`+)
github 201→282, anthropic 15→61, openai 41→109, cloudflare 54→148, google 60→158, twilio 22→94, local 14→62. Total: 1,692.

### Session 5 (`6659443` `bd01ab2`)
stripe 71→143, ollama (16 tools, new namespace). Docs synced. Total: 1,780.

### Session 6 (current)
- fly 37→76 (certs, Postgres, WireGuard, scaling, 4 Super Tools)
- supabase 36→98 (schema, RLS, data ops, webhooks, branches, 3 Super Tools)
- clerk 30→75 (roles, permissions, email/phone, RBAC, 3 Super Tools)
- resend 22→46 (broadcasts, webhooks, bulk ops, 6 email Super Tools)
- Full validation: 23/23 namespaces synced · `audit.js` added
- Total: 1,949 registered

---

## Quick Commands

```bash
# Full sync validation (use this, not the old one-liner)
cd /home/robinson_dev/projects/robinsons-toolkit && node audit.js

# Boot test (expect exit 124 = clean timeout)
timeout 4s node index.js 2>&1

# Total registered tool count
node -e "const fs=require('fs'); let t=0; fs.readdirSync('registry').filter(f=>f.endsWith('.json')).forEach(f=>{t+=JSON.parse(fs.readFileSync('registry/'+f,'utf-8')).length;}); console.log(t);"

# Push
git push origin main
```

---

## Environment Variables

```
WORKSPACE_ROOT=
GITHUB_TOKEN=                   # github namespace
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

*Last updated: Session 6 — 1,949 tools · 23/23 synced · audit.js added*  
*Next: sentry → qdrant → upstash Vector/Kafka → mapbox → n8n → postgres → compound → search → playwright*
