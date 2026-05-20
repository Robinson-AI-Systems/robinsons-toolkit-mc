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

**Always-on namespaces (no API key):** `local`, `compound`, `ollama`, `playwright`

---

## Current State — Session 12

**Total registered tools: 2,328** across 28 namespaces
**Validation: ✅ 28/28 namespaces perfectly synced** (run `node audit.js` to verify)
**Observability Ledger:** every state-mutating tool call records a reversal receipt to `.toolkit-ledger.jsonl`; `compound_rollback_transaction` undoes recent agent actions.

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
| `postgres` | 43 | ✅ | ✅ COMPLETE |
| `context7` | 45 | ✅ | ✅ COMPLETE |
| `playwright` | 34 | ✅ | ✅ COMPLETE (NEW) |
| `search` | 23 | ✅ | ✅ COMPLETE |
| `compound` | 23 | ✅ | ✅ COMPLETE (+ rollback) |
| `linear` | 38 | ✅ | ✅ COMPLETE |
| `slack` | 37 | ✅ | ✅ COMPLETE |
| `ollama` | 16 | ✅ | ✅ COMPLETE |
| `gemini` | 15 | ✅ | ✅ COMPLETE (NEW) |

---

## 🎉 BUILD COMPLETE

The backlog is empty. All planned namespaces are built and synced.

### What's been built:
- **27 namespaces**, **2,313 registered tools**
- Every namespace tested with `node audit.js` (27/27 ✅)
- Boot test: clean (exit 124)
- Observability Ledger + `compound_rollback_transaction` (Phase 3.1)
- Phase 6 description polish on all pinned tools
- All code committed and pushed to GitHub

### If continuing development, potential next additions:
- More compound Super Tools as real workflow patterns emerge
- Deeper coverage in any namespace that needs it
- New namespaces as new services are adopted (e.g. Linear, Notion, Slack)

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

### Session 8 — BUILD COMPLETE
- context7: 0→39 (NEW — profoundly robust docs namespace)
- playwright: 0→34 (NEW — browser automation namespace)
- upstash: 149→166 (+17 — Vector + Kafka sections)
- index.js: added context7 + playwright to namespace registry
- CLAUDE.md + README.md updated with final counts
- Total: 2,231 across 25 namespaces

### Session 9 (`c86cea9`) — context7 sync + verified examples
- context7: 39→45 (+6 — added `context7_verified_examples` and registry entries for 5 previously orphaned handler tools: `smart_query`, `upgrade_impact`, `secure_fetch`, `fallback_index`, `cache_status`)
- Added runtime arg validator + layer docs
- Audit now reports 25/25 synced (was 24/25 with 5 H-not-R gaps in context7)
- Total: 2,237 across 25 namespaces

### Session 10 (`ee21b28`) — Observability Ledger + Phase 6 polish
- **Phase 3.1 — Observability Ledger:** `ledger.js` (append/read/markRolledBack of `.toolkit-ledger.jsonl`), `inverses.js` (reversal map for ~20 mutation tools across GitHub/Neon/Vercel/Fly), `routeToolCall` records receipts after successful mutations.
- **`compound_rollback_transaction`** (NEW pinned tool): replays inverses in reverse order. Filters by `last_n` / `since` / `transaction_id`; supports `dry_run` to preview the plan.
- **Phase 6 — Description polish:** rewrote all 13 pinned tool descriptions with intent-leading "PREFERRED / POWER TOOL / USE THIS WHEN" language. Fixed factual drift (local_* tools now correctly say WSL2/Linux, not Windows).
- `.gitignore`: added `.toolkit-ledger.jsonl` (runtime state).
- compound: 22→23 (+1). Total: 2,238 across 25 namespaces.

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
LINEAR_API_KEY=                  # linear.app → Settings → API → Personal API keys
SLACK_BOT_TOKEN=                 # xoxb-... from Slack app → OAuth & Permissions
SLACK_DEFAULT_CHANNEL=           # optional default channel ID for quick sends

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
UPSTASH_VECTOR_REST_URL=         # Upstash Vector
UPSTASH_VECTOR_REST_TOKEN=       # Upstash Vector
UPSTASH_KAFKA_REST_URL=          # Upstash Kafka
UPSTASH_KAFKA_REST_TOKEN=        # Upstash Kafka
GOOGLE_ACCESS_TOKEN=             # either/or
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=
MAPBOX_ACCESS_TOKEN=
MAPBOX_USERNAME=                 # required for datasets/tilesets/styles
CLERK_SECRET_KEY=
SENTRY_AUTH_TOKEN=
SENTRY_ORG_SLUG=
CONTEXT7_API_KEY=                # Free at https://context7.com/dashboard
GEMINI_API_KEY=                  # https://aistudio.google.com/app/apikey
BRAVE_SEARCH_API_KEY=            # either/or
TAVILY_API_KEY=
QDRANT_URL=
QDRANT_API_KEY=                  # optional for cloud instances
N8N_BASE_URL=
N8N_API_KEY=
POSTGRES_CONNECTION_STRING=
OLLAMA_BASE_URL=                 # default: http://172.19.16.1:11434
OLLAMA_DEFAULT_MODEL=            # default: qwen2.5-coder:7b
OLLAMA_TIMEOUT_MS=               # default: 300000
```

---

### Session 11 — Linear + Slack namespaces
- linear: 0→38 (NEW — issues, projects, cycles, teams, sprints, Super Tools)
- slack: 0→37 (NEW — messages, channels, users, reactions, files, Super Tools)
- Removed incorrectly added posthog handler (PostHog is a Claude Desktop connector)
- index.js: added linear + slack to namespace credential checks
- Total: 2,313 across 27 namespaces

### Session 12 (current) — Gemini orchestration handler
- gemini: 0→15 (NEW — native Google Gemini API client, no SDK dependency)
- Tools: `gemini_standard_query`, `gemini_structured_extractor`, `gemini_code_execution_engine`, `gemini_grounded_query`, `gemini_analyze_media`, `gemini_generate_image`, `gemini_spatial_analysis`, `gemini_text_to_speech`, `gemini_generate_embeddings`, `gemini_cache_document`, `gemini_batch_processor`, `gemini_deep_research_start`, `gemini_deep_research_status`, `gemini_cancel_batch_job`, `gemini_list_models`
- Built on native `fetch` against `generativelanguage.googleapis.com/v1beta` — covers text, JSON schema, code execution, Google Search grounding, multimodal (image/audio/video/PDF via Files API), Imagen image generation, spatial bounding boxes (0-1000 grid), native TTS, embeddings (single + batchEmbedContents), context caching, parallel client-side batching, long-running batchGenerateContent operations, and model discovery
- Graceful error explainer for 401/403/404/429/5xx (auth, billing, quota, model-not-found)
- 403 on `cachedContents` is caught and returned as `{ok:false, error:'cached_contents_requires_billing'}` so the agent sees a structured signal instead of a thrown error
- index.js: added `gemini: () => !!process.env.GEMINI_API_KEY` to `getActiveNamespaces`
- .env.example + CLAUDE.md env table: added `GEMINI_API_KEY`
- Total: 2,328 across 28 namespaces

---

*Last updated: Session 12 — 2,328 tools · 28/28 synced · BUILD COMPLETE · Observability Ledger live*
