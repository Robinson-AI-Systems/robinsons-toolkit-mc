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

## Current State — Session 7

**Total registered tools: 2,142** across 23 namespaces  
**Validation: ✅ 23/23 namespaces perfectly synced** (run `node audit.js` to verify)

### Namespace Status — Sorted by tool count

| Namespace | Tools | Sync | Status |
|---|---|---|---|
| `github` | 282 | ✅ | ✅ COMPLETE |
| `neon` | 187 | ✅ | ✅ COMPLETE |
| `google` | 158 | ✅ | ✅ COMPLETE |
| `vercel` | 150 | ✅ | ✅ COMPLETE |
| `upstash` | 149 | ✅ | ⚠️ needs Vector + Kafka sections |
| `cloudflare` | 148 | ✅ | ✅ COMPLETE |
| `stripe` | 143 | ✅ | ✅ COMPLETE |
| `openai` | 109 | ✅ | ✅ COMPLETE |
| `supabase` | 98 | ✅ | ✅ COMPLETE |
| `twilio` | 94 | ✅ | ✅ COMPLETE |
| `fly` | 76 | ✅ | ✅ COMPLETE |
| `clerk` | 75 | ✅ | ✅ COMPLETE |
| `local` | 62 | ✅ | ✅ COMPLETE |
| `anthropic` | 61 | ✅ | ✅ COMPLETE |
| `sentry` | 59 | ✅ | ✅ COMPLETE |
| `qdrant` | 48 | ✅ | ✅ COMPLETE |
| `n8n` | 47 | ✅ | ✅ COMPLETE |
| `resend` | 46 | ✅ | ✅ COMPLETE |
| `mapbox` | 45 | ✅ | ✅ COMPLETE |
| `postgres` | 44 | ✅ | ✅ COMPLETE |
| `search` | 23 | ✅ | ✅ COMPLETE |
| `compound` | 22 | ✅ | ✅ COMPLETE |
| `ollama` | 16 | ✅ | ✅ COMPLETE |

---

## Remaining Build Backlog

| # | Namespace | Current | Target | Notes |
|---|---|---|---|---|
| 1 | `upstash` | 149 | 180+ | Add Vector and Kafka namespace sections |
| 2 | `playwright` | 0 | 60+ | NEW — browser automation (new handler + registry) |

Only 2 items left. Once complete the build is DONE.

---

## Session Log

### Session 1 (`6c0e07e`)
All 22 handler files, Smart Discovery, registry scaffolding, MCP boot.

### Session 2 (`c910410`)
Registry JSON files; routing fixes; vercel 88→150; README; .env.example.

### Session 3 (`4ca8bc3` `786943b`)
CLAUDE.md + ClaudeBuildPlan.md; repo renamed; PAT push; neon 89→187.

### Session 4 (`54f691a`+)
github 201→282, anthropic 15→61, openai 41→109, cloudflare 54→148, google 60→158, twilio 22→94, local 14→62.

### Session 5 (`6659443` `bd01ab2`)
stripe 71→143, ollama (16 tools). Docs synced. Total: 1,780.

### Session 6 (`f64a152`+)
- fly 37→76, supabase 36→98, clerk 30→75, resend 22→46
- sentry 17→59, qdrant 17→48, mapbox 15→45
- n8n 13→47, postgres 12→43
- `audit.js` added — correctly handles cross-prefix namespaces
- compound 11→22 (11 new cross-service Super Tools added)
- search 10→23 (Brave video/suggest/summarizer + Tavily finance/extract + smart search tools)
- Total: 2,142

### Session 7 (current)
- Full validation pass: 23/23 ✅, all uncommitted changes resolved
- CLAUDE.md, README.md updated with accurate counts
- Committed all session 6+7 work
- Next: upstash Vector/Kafka → playwright

---

## Quick Commands

```bash
# Full sync validation
cd /home/robinson_dev/projects/robinsons-toolkit && node audit.js

# Boot test (expect exit 124 = clean timeout)
timeout 4s node index.js 2>&1

# Count registered tools
node -e "const fs=require('fs'); let t=0; fs.readdirSync('registry').filter(f=>f.endsWith('.json')).forEach(f=>{t+=JSON.parse(fs.readFileSync('registry/'+f,'utf-8')).length;}); console.log(t);"

# Push
git add -A && git commit -m "..." && git push origin main
```

---

## Environment Variables

```
WORKSPACE_ROOT=
GITHUB_TOKEN=
VERCEL_TOKEN=
NEON_API_KEY=
FLY_API_TOKEN=
STRIPE_SECRET_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
RESEND_API_KEY=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
GOOGLE_ACCESS_TOKEN=         # either/or
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=
MAPBOX_ACCESS_TOKEN=
MAPBOX_USERNAME=             # required for datasets/tilesets/styles/uploads
CLERK_SECRET_KEY=
SENTRY_AUTH_TOKEN=
SENTRY_ORG_SLUG=
BRAVE_SEARCH_API_KEY=        # either/or
TAVILY_API_KEY=
QDRANT_URL=
QDRANT_API_KEY=              # optional
N8N_BASE_URL=
N8N_API_KEY=
POSTGRES_CONNECTION_STRING=
OLLAMA_BASE_URL=             # default: http://172.19.16.1:11434
OLLAMA_DEFAULT_MODEL=        # default: qwen2.5-coder:7b
OLLAMA_TIMEOUT_MS=           # default: 300000
```

---

*Last updated: Session 7 — 2,142 tools · 23/23 synced · 2 items left in backlog*  
*Next: upstash Vector/Kafka → playwright (NEW namespace)*
