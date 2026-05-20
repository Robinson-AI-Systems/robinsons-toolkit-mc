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

**Key files:** `index.js` · `handlers/*.js` · `registry/*.json` · `.env` · `audit.js` · `ledger.js` · `inverses.js`

**Routing special cases in `index.js`:**
- `gmail_*` `drive_*` `calendar_*` `sheets_*` `docs_*` `slides_*` `forms_*` `people_*` `contacts_*` → `google`
- `cf_*` → `cloudflare`
- `brave_*` `tavily_*` `search_*` → `search`

**Always-on namespaces (no API key):** `local`, `compound`, `ollama`, `playwright`

**Observability Ledger:** every state-mutating tool call writes a reversal receipt to `.toolkit-ledger.jsonl`; `compound_rollback_transaction` replays inverses in reverse order.

---

## Current State — Session 12 (last updated)

**Total registered tools: 2,355** across 28 namespaces
**Validation: ✅ 28/28 namespaces perfectly synced** (run `node audit.js` to verify)

### Namespace Status — Sorted by tool count

| Namespace | Tools | Sync | Status |
|---|---|---|---|
| `github` | 282 | ✅ | ✅ COMPLETE |
| `neon` | 187 | ✅ | ✅ COMPLETE |
| `upstash` | 166 | ✅ | ✅ COMPLETE (Redis + Vector + Kafka) |
| `google` | 158 | ✅ | ✅ COMPLETE |
| `vercel` | 150 | ✅ | ✅ COMPLETE |
| `cloudflare` | 148 | ✅ | ✅ COMPLETE |
| `stripe` | 143 | ✅ | ✅ COMPLETE |
| `openai` | 109 | ✅ | ✅ COMPLETE |
| `fly` | 101 | ✅ | ✅ COMPLETE |
| `supabase` | 100 | ✅ | ✅ COMPLETE |
| `twilio` | 94 | ✅ | ✅ COMPLETE |
| `clerk` | 75 | ✅ | ✅ COMPLETE |
| `local` | 62 | ✅ | ✅ COMPLETE |
| `anthropic` | 61 | ✅ | ✅ COMPLETE |
| `sentry` | 59 | ✅ | ✅ COMPLETE |
| `context7` | 45 | ✅ | ✅ COMPLETE |
| `mapbox` | 45 | ✅ | ✅ COMPLETE |
| `qdrant` | 48 | ✅ | ✅ COMPLETE |
| `n8n` | 47 | ✅ | ✅ COMPLETE |
| `resend` | 46 | ✅ | ✅ COMPLETE |
| `postgres` | 43 | ✅ | ✅ COMPLETE |
| `linear` | 38 | ✅ | ✅ COMPLETE |
| `playwright` | 34 | ✅ | ✅ COMPLETE |
| `slack` | 37 | ✅ | ✅ COMPLETE |
| `search` | 23 | ✅ | ✅ COMPLETE |
| `compound` | 23 | ✅ | ✅ COMPLETE (+ rollback) |
| `gemini` | 15 | ✅ | ✅ COMPLETE |
| `ollama` | 16 | ✅ | ✅ COMPLETE |

---

## Open Build Gaps

These namespaces are functional but have meaningful headroom vs their API surface area:

| Namespace | Current | Headroom | Priority |
|---|---|---|---|
| `sentry` | 59 | monitors, alerting rules, dashboards deeper | 🟠 |
| `qdrant` | 48 | more payload filter types, named-vector ops | 🟡 |
| `n8n` | 47 | executions deeper, node types, templates | 🟡 |
| `postgres` | 43 | more schema ops, advisory locks, LISTEN/NOTIFY | 🟡 |
| `resend` | 46 | deeper broadcast scheduling, domain verification | 🟡 |
| `compound` | 23 | always room for cross-service Super Tools | 🟢 |
| `search` | 23 | deeper Brave/Tavily coverage | 🟢 |
| `mapbox` | 45 | traffic/incidents API | 🟢 |
| `gemini` | 15 | Thinking models, RAG with File API, deeper Imagen | 🟢 |

---

## Session Log

### Session 1 (`6c0e07e`) — Scaffold
All 22 handler files, Smart Discovery, registry scaffolding, MCP boot.

### Session 2 (`c910410`) — Registries
Registry JSON files; routing fixes; vercel 88→150; README; .env.example.

### Session 3 (`4ca8bc3` `786943b`) — DB + Push
CLAUDE.md + ClaudeBuildPlan.md; repo renamed; PAT push; neon 89→187.

### Session 4 (`54f691a`+) — Major Expansions
github 201→282, anthropic 15→61, openai 41→109, cloudflare 54→148, google 60→158, twilio 22→94, local 14→62.

### Session 5 (`6659443` `bd01ab2`) — Stripe + Ollama
stripe 71→143, ollama (16 tools). Total: 1,780.

### Session 6 (`f64a152`+) — Complete Middle Tier
fly 37→76, supabase 36→98, clerk 30→75, resend 22→46, sentry 17→59, qdrant 17→48, mapbox 15→45, n8n 13→47, postgres 12→43. audit.js added. Total: 2,142.

### Session 7 — Validation + Compound + Search
Validated all namespaces; compound 11→22, search 10→23. Total: 2,141.

### Session 8 — Three new namespaces
context7: 0→39, playwright: 0→34, upstash: 149→166 (Vector + Kafka). Total: 2,231 across 25 namespaces.

### Session 9 (`c86cea9`) — context7 v2 sync
context7: 39→45 (+6 hardened tools: smart_query, upgrade_impact, secure_fetch, fallback_index, cache_status, verified_examples). audit.js rewritten with correct cross-prefix handling. Total: 2,237.

### Session 10 (`ee21b28`) — Observability Ledger + Phase 6 polish
Phase 3.1: `ledger.js`, `inverses.js`, `compound_rollback_transaction` (pinned). Phase 6: rewrote all pinned tool descriptions. compound: 22→23. Total: 2,238.

### Session 11 (`cf2a6e3`) — Linear + Slack
linear: 0→38 (issues, projects, cycles, sprints, Super Tools). slack: 0→37 (messages, channels, users, reactions, files, Super Tools). Total: 2,313 across 27 namespaces.

### Session 12 (`1ca42c7` `1bf77f9` `3f47041`) — Gemini + fly/supabase expansion
gemini: 0→15 (text, JSON schema, code execution, grounding, multimodal, Imagen, TTS, embeddings, caching, batch). fly: 76→101 (+25). supabase: 98→100 (+2 backup/restore tools). .env.example refreshed with all optional vars. Total: 2,355 across 28 namespaces.

### Session 13 (current) — Gap audit + doc repair
- Identified and fixed doc inconsistencies: fly 76→101, supabase 98→100, total 2,328→2,355
- Fixed broken session log structure (sessions 11/12/13 were below env section)
- Updated BUILD COMPLETE counts, removed stale "potential next additions"
- Added "Open Build Gaps" table replacing the completed Session 13 plan
- Closing actual build gaps: sentry, qdrant, n8n, postgres, resend, compound

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

# Source control & deployment
GITHUB_TOKEN=
VERCEL_TOKEN=
VERCEL_TEAM_ID=                  # optional — required for team-scoped endpoints
FLY_API_TOKEN=

# Databases
NEON_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
POSTGRES_CONNECTION_STRING=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
UPSTASH_VECTOR_REST_URL=
UPSTASH_VECTOR_REST_TOKEN=
UPSTASH_KAFKA_REST_URL=
UPSTASH_KAFKA_REST_TOKEN=

# AI providers
OPENAI_API_KEY=
OPENAI_ADMIN_KEY=                # optional — org admin operations
ANTHROPIC_API_KEY=
ANTHROPIC_ADMIN_KEY=             # optional — org admin operations
GEMINI_API_KEY=                  # https://aistudio.google.com/app/apikey
OLLAMA_BASE_URL=                 # default: http://172.19.16.1:11434
OLLAMA_DEFAULT_MODEL=            # default: qwen2.5-coder:7b
OLLAMA_TIMEOUT_MS=               # default: 300000

# Auth & payments
CLERK_SECRET_KEY=
STRIPE_SECRET_KEY=

# Communications
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=             # optional — default outbound number
TWILIO_VERIFY_SERVICE_SID=       # optional — for Verify API
RESEND_API_KEY=
SLACK_BOT_TOKEN=                 # xoxb-... from Slack app → OAuth & Permissions
SLACK_DEFAULT_CHANNEL=           # optional default channel ID

# Cloud infrastructure
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=

# Google Workspace
GOOGLE_ACCESS_TOKEN=             # either/or with service account
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=
GOOGLE_SERVICE_ACCOUNT_SUBJECT=  # optional — for domain-wide delegation

# Mapping & search
MAPBOX_ACCESS_TOKEN=
MAPBOX_USERNAME=                 # required for datasets/tilesets/styles/uploads
BRAVE_SEARCH_API_KEY=            # either/or
TAVILY_API_KEY=

# Monitoring & observability
SENTRY_AUTH_TOKEN=
SENTRY_ORG_SLUG=
SENTRY_PROJECT_SLUG=             # optional — default project for quick lookups

# Vector database & automation
QDRANT_URL=
QDRANT_API_KEY=                  # optional for cloud instances
N8N_BASE_URL=
N8N_API_KEY=

# Issue tracking & documentation
LINEAR_API_KEY=                  # linear.app → Settings → API → Personal API keys

# Documentation
CONTEXT7_API_KEY=                # free at https://context7.com/dashboard
```

---

*Last updated: Session 13 — 2,355 tools · 28/28 synced · gap audit complete*
