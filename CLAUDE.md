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
- `brave_*` `tavily_*` `serp_*` `search_*` → `search`
- `moonshot_*` → `moonshot`
- `voyage_*` → `voyage`
- `sam_*` → `sam`

**Always-on namespaces (no API key):** `local`, `compound`, `ollama`, `playwright`

**Observability Ledger:** every state-mutating tool call writes a reversal receipt to `.toolkit-ledger.jsonl`; `compound_rollback_transaction` replays inverses in reverse order.

---

## Current State — Session 14 (in progress)

**Total registered tools: 2,399** across 28 namespaces (audited)
**Sync issues: ⚠️ 3 namespaces broken (cloudflare, google, search) — handlers not wired to registry**

### Namespace Status — Actual audit results

| Namespace | Registry | Handler Wired | Sync | Status |
|---|---|---|---|---|
| `github` | 282 | 282 | ✅ | ✅ COMPLETE |
| `neon` | 187 | 187 | ✅ | ✅ COMPLETE |
| `upstash` | 166 | 166 | ✅ | ✅ COMPLETE (Redis + Vector + Kafka) |
| `google` | 158 | 5 | ❌ | 🔴 BROKEN — handler empty stubs |
| `vercel` | 150 | 150 | ✅ | ✅ COMPLETE |
| `cloudflare` | 148 | 0 | ❌ | 🔴 BROKEN — handler empty stubs |
| `stripe` | 143 | 143 | ✅ | ✅ COMPLETE |
| `openai` | 109 | 109 | ✅ | ✅ COMPLETE |
| `fly` | 101 | 101 | ✅ | ✅ COMPLETE |
| `supabase` | 100 | 100 | ✅ | ✅ COMPLETE |
| `twilio` | 94 | 94 | ✅ | ✅ COMPLETE |
| `sentry` | 71 | 71 | ✅ | ✅ COMPLETE |
| `clerk` | 75 | 75 | ✅ | ✅ COMPLETE |
| `local` | 62 | 62 | ✅ | ✅ COMPLETE |
| `anthropic` | 61 | 61 | ✅ | ✅ COMPLETE |
| `postgres` | 59 | 59 | ✅ | ✅ COMPLETE |
| `n8n` | 57 | 57 | ✅ | ✅ COMPLETE |
| `resend` | 46 | 46 | ✅ | ✅ COMPLETE |
| `mapbox` | 45 | 45 | ✅ | ✅ COMPLETE |
| `context7` | 45 | 45 | ✅ | ✅ COMPLETE |
| `qdrant` | 48 | 48 | ✅ | ✅ COMPLETE |
| `linear` | 38 | 38 | ✅ | ✅ COMPLETE |
| `slack` | 37 | 37 | ✅ | ✅ COMPLETE |
| `playwright` | 34 | 34 | ✅ | ✅ COMPLETE |
| `compound` | 29 | 29 | ✅ | ✅ COMPLETE |
| `search` | 23 | 10 | ❌ | 🔴 BROKEN — 13 registry tools not in handler |
| `gemini` | 15 | 15 | ✅ | ✅ COMPLETE |
| `ollama` | 16 | 16 | ✅ | ✅ COMPLETE |

---

## Session 14 Build Plan

### Phase 1 — Fix broken sync (must do first)

**`cloudflare`** — Handler has 0 case statements. All 148 registry tools are dangling. Rewrite handler with real API calls.

**`google`** — Handler has 5 case statements. 153 registry tools are dangling. Rewrite handler with real Google API calls across Gmail, Drive, Calendar, Sheets, Docs, Slides, Forms, Contacts.

**`search`** — 13 tools in registry not in handler: `brave_image_search`, `brave_video_search`, `brave_suggest`, `brave_summarizer`, `brave_news_search` (check), `tavily_news_search`, `tavily_finance_search`, `tavily_extract_multiple`, and others. Wire all into handler.

### Phase 2 — New namespaces revealed by .env audit

**`moonshot`** — Moonshot AI (Kimi) — `MOONSHOT_API_KEY` is present. OpenAI-compatible API. Build: chat completions, streaming, long-context (128K), file upload/parse, vision, function calling, model listing. Target: 20+ tools.

**`voyage`** — Voyage AI embeddings — `VOYAGE_API_KEY` is present. Specialized embedding API (better than OpenAI for RAG). Build: embed text, embed documents, embed code, list models, rerank results. Target: 10+ tools.

**`sam`** — SAM.gov federal contracts API — `INTAKE_SAM_TOKEN` / `SAM_API_KEY` present. Critical for YardSync government contracts features. Build: search opportunities, get opportunity details, search awards, entity search (contractor lookup), exclusions check, wage determinations. Target: 15+ tools.

### Phase 3 — Missing features in existing namespaces (from .env audit)

**`openai`** — `OPENAI_ADMIN_KEY` present but unused. Add: `openai_list_org_users`, `openai_invite_user`, `openai_remove_user`, `openai_list_projects`, `openai_get_usage`, `openai_get_costs`, `openai_list_api_keys`, `openai_create_api_key`, `openai_delete_api_key`. All require admin key. (+9 tools)

**`anthropic`** — `ANTHROPIC_ADMIN_KEY` present but unused. Add: `anthropic_list_workspaces`, `anthropic_get_workspace_usage`, `anthropic_list_workspace_members`, `anthropic_invite_workspace_member`, `anthropic_list_api_keys`, `anthropic_create_api_key`, `anthropic_disable_api_key`, `anthropic_get_usage`. All require admin key. (+8 tools)

**`twilio`** — `TWILIO_VERIFY_SERVICE_SID` is set but verify tools may be missing from handler. Confirm `twilio_send_verification` and `twilio_check_verification` are wired in handler (registry shows them, handler audit showed 94/94 sync — verify these are real implementations not stubs).

**`search`** — `SERPAPI_KEY` present but no serp namespace or tools exist. Add: `serp_google_search`, `serp_google_news`, `serp_google_images`, `serp_google_maps`, `serp_google_shopping`, `serp_google_jobs`, `serp_youtube_search`. (+7 tools)

**`google`** — Additional env vars in .env: `GOOGLE_CREDENTIALS_JSON`, `GOOGLE_USER_EMAIL`, `GOOGLE_IMPERSONATE_EMAIL` — support these auth paths in the handler alongside the existing `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`.

### Phase 4 — Depth expansion (open build gaps)

| Namespace | Current | Additions Planned |
|---|---|---|
| `compound` | 29 | +15 new Super Tools (see ClaudeBuildPlan.md) |
| `sentry` | 71 | monitors, alerting rules, dashboards, performance |
| `gemini` | 15 | Thinking models, Gemini 2.0 Flash, video understanding |
| `n8n` | 57 | execution history deeper, node type catalog, template import |
| `postgres` | 59 | advisory locks, LISTEN/NOTIFY, logical replication ops |
| `qdrant` | 48 | named vectors, sparse vectors, multi-vector search |
| `mapbox` | 45 | traffic/incidents API, isochrone analysis |
| `resend` | 46 | broadcast scheduling, domain verification deeper |
| `search` | 23 | deeper Brave/Tavily + new SerpApi tools |

---

## Open Build Gaps (carry-forward)

| Namespace | Current | Headroom | Priority |
|---|---|---|---|
| `cloudflare` | 148 reg / 0 wired | Fix handler | 🔴 BROKEN |
| `google` | 158 reg / 5 wired | Fix handler | 🔴 BROKEN |
| `search` | 23 reg / 10 wired | Fix handler + add SerpApi | 🔴 BROKEN |
| `moonshot` | 0 | New namespace (MOONSHOT_API_KEY present) | 🔴 NEW |
| `voyage` | 0 | New namespace (VOYAGE_API_KEY present) | 🔴 NEW |
| `sam` | 0 | New namespace (SAM_API_KEY present) | 🔴 NEW |
| `openai` | 109 | +9 admin tools (OPENAI_ADMIN_KEY present) | 🟠 |
| `anthropic` | 61 | +8 admin tools (ANTHROPIC_ADMIN_KEY present) | 🟠 |
| `sentry` | 71 | monitors, alerting rules, dashboards deeper | 🟠 |
| `compound` | 29 | +15 new Super Tools | 🟡 |
| `gemini` | 15 | Thinking models, 2.0 Flash, video | 🟡 |
| `qdrant` | 48 | named/sparse vectors, multi-vector | 🟡 |
| `n8n` | 57 | execution history, node catalog, templates | 🟡 |
| `postgres` | 59 | advisory locks, LISTEN/NOTIFY | 🟡 |
| `mapbox` | 45 | traffic/incidents, isochrone | 🟢 |
| `resend` | 46 | broadcast scheduling, domain verification | 🟢 |
| `search` | 23 | SerpApi additions | 🟢 |

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
context7: 39→45 (+6 hardened tools). audit.js rewritten. Total: 2,237.

### Session 10 (`ee21b28`) — Observability Ledger + Phase 6 polish
ledger.js, inverses.js, compound_rollback_transaction (pinned). compound: 22→23. Total: 2,238.

### Session 11 (`cf2a6e3`) — Linear + Slack
linear: 0→38, slack: 0→37. Total: 2,313 across 27 namespaces.

### Session 12 (`1ca42c7` `1bf77f9` `3f47041`) — Gemini + fly/supabase expansion
gemini: 0→15, fly: 76→101, supabase: 98→100. Total: 2,355 across 28 namespaces.

### Session 13 — Gap audit + doc repair
Fixed doc inconsistencies; updated BUILD COMPLETE counts; added Open Build Gaps table.

### Session 14 (current) — Full .env audit + broken sync fixes + new namespaces
- Full .env audit revealed: 3 broken handlers (cloudflare 0/148, google 5/158, search 10/23)
- New namespaces to build: moonshot, voyage, sam
- Missing admin API coverage in openai and anthropic
- Missing SerpApi coverage in search
- Plan documented. Beginning implementation.

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
QDRANT_URL=
QDRANT_API_KEY=                  # optional for cloud instances

# AI providers
OPENAI_API_KEY=
OPENAI_ADMIN_KEY=                # org admin: users, projects, usage, API keys
ANTHROPIC_API_KEY=
ANTHROPIC_ADMIN_KEY=             # workspace admin: members, usage, API keys
GEMINI_API_KEY=
MOONSHOT_API_KEY=               # Moonshot AI (Kimi) — moonshot namespace
VOYAGE_API_KEY=                  # Voyage AI embeddings — voyage namespace
OLLAMA_BASE_URL=                 # default: http://172.19.16.1:11434
OLLAMA_DEFAULT_MODEL=
OLLAMA_TIMEOUT_MS=

# Auth & payments
CLERK_SECRET_KEY=
STRIPE_SECRET_KEY=

# Communications
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_VERIFY_SERVICE_SID=       # required for Verify/OTP tools
RESEND_API_KEY=
SLACK_BOT_TOKEN=
SLACK_DEFAULT_CHANNEL=

# Cloud infrastructure
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=

# Google Workspace
GOOGLE_ACCESS_TOKEN=             # either/or with service account
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=
GOOGLE_CREDENTIALS_JSON=         # service account JSON inline
GOOGLE_USER_EMAIL=               # for OAuth flows
GOOGLE_IMPERSONATE_EMAIL=        # for domain-wide delegation
GOOGLE_SERVICE_ACCOUNT_SUBJECT=

# Mapping & search
MAPBOX_ACCESS_TOKEN=
MAPBOX_USERNAME=
BRAVE_SEARCH_API_KEY=
TAVILY_API_KEY=
SERPAPI_KEY=                     # SerpApi Google/YouTube/Maps scraping

# Government data
SAM_API_KEY=                     # SAM.gov federal contracts & awards — sam namespace
INTAKE_SAM_TOKEN=                # SAM.gov intake token

# Monitoring & observability
SENTRY_AUTH_TOKEN=
SENTRY_ORG_SLUG=
SENTRY_PROJECT_SLUG=

# Automation & documentation
N8N_BASE_URL=
N8N_API_KEY=
LINEAR_API_KEY=
CONTEXT7_API_KEY=
```

---

*Last updated: Session 14 — 2,399 tools · 25/28 synced · 3 handlers broken · 3 new namespaces planned*
