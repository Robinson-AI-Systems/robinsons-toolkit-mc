# ClaudeBuildPlan.md — Robinson's Toolkit MCP
## Systematic Build-Out Plan for All 22 Namespaces

> This is Claude's own plan for taking every namespace from its current state to a genuinely complete, production-grade developer toolset. The benchmark is `vercel.js` — 150 tools, 9 Super Tools, zero stubs, perfect sync. Every namespace gets that treatment.

---

## What "Complete" Means

A namespace is complete when:

1. **Tool count hits target** — every meaningful action a developer would take in the UI or API is represented
2. **Perfect sync** — handler and registry tool counts match exactly, zero gaps
3. **Zero stubs** — every tool has real logic, real API paths, real error handling
4. **Super Tools present** — at least 3–5 compound operations that save the agent meaningful work
5. **Registry quality** — every entry has a clear description (20+ words), relevant tags, accurate inputSchema with required fields marked
6. **Payload minimization** — responses strip noise and return only what matters, protecting context window
7. **Error messages are actionable** — when a required param is missing, the error tells you exactly what's needed

---

## The Methodology (The Vercel Process)

Every namespace build follows this exact sequence:

```
1. READ the handler — understand what's already there, what patterns are used
2. AUDIT sync — run the registry/handler diff to find any existing gaps
3. FIX gaps first — sync issues resolved before any new tools added
4. PLAN additions — group by API category, identify missing real capabilities
5. WRITE handler additions — real API paths, real error handling, real responses
6. WRITE registry entries — name, description, namespace, tags, inputSchema
7. VERIFY sync — confirm zero gaps with the audit script
8. ADD Super Tools — 3–9 compound operations as the last section of the handler
9. BOOT TEST — confirm clean start, correct tool count
10. COMMIT — conventional commit with full breakdown of what changed
```

---

## Priority Order

Ordered by: **Chris's explicit Session 5 directive** → **impact on active stack** → **size of gap**

**Completed namespaces (perfect sync, target hit):**
- ✅ `vercel` — 150/150 (Session 2)
- ✅ `neon` — 187/187 (Session 3)
- ✅ `local` — 62/62 (Session 4)

| Priority | Namespace | Current | Target | Why |
|---|---|---|---|---|
| 🔴 1 | `github` | 201 | 250+ | Audit depth — Actions, code scanning, Dependabot, environments, traffic |
| 🔴 2 | `anthropic` | 15 | 60+ | Claude API direct — batches, files, deeper messages, streaming |
| 🔴 3 | `openai` | 41 | 100+ | RAG pipelines, Realtime API, Batch, Evals, Vector Stores deeper |
| 🔴 4 | `cloudflare` | 54 | 120+ | D1, Workers AI, Queues, Durable Objects, Zero Trust |
| 🔴 5 | `google` | 60 | 130+ | Gmail/Drive/Calendar/Sheets/Docs deeper coverage |
| 🟠 6 | `stripe` | 71 | 130+ | Revenue critical, YardSync billing — Connect, Checkout, lifecycle |
| 🟠 7 | `twilio` | 22 | 90+ | YardSync dispatch SMS/voice, critical gap |
| 🟠 8 | `fly` | 37 | 100+ | Production hosting for backend services |
| 🟡 9 | `supabase` | 36 | 100+ | Auth, realtime, edge functions deeper |
| 🟡 10 | `clerk` | 30 | 80+ | Multi-tenant auth for Cortiware |
| 🟡 11 | `resend` | 23 | 70+ | Transactional email, React Email |
| 🟡 12 | `sentry` | 17 | 60+ | Error tracking, performance monitoring |
| 🟡 13 | `qdrant` | 17 | 60+ | Vector search, RAG infrastructure |
| 🟢 14 | `upstash` | 149 | 180+ | Add Vector + Kafka namespaces |
| 🟢 15 | `mapbox` | 15 | 60+ | Routing, geocoding, YardSync maps |
| 🟢 16 | `n8n` | 13 | 50+ | Workflow automation deeper |
| 🟢 17 | `postgres` | 12 | 50+ | Direct DB ops, query analysis |
| 🟢 18 | `compound` | 11 | 50+ | Cross-service Super Tools |
| 🟢 19 | `search` | 10 | 30+ | Brave + Tavily deeper |
| ⬜ 20 | `playwright` | 0 | 60+ | NEW namespace — browser automation |

---

## Per-Namespace Build Plans

---

### `local` — Local Machine Bridge ✅ COMPLETE (Session 4)
**Final: 62 handler / 62 registry — perfect sync, target exceeded**

Rebuilt in commit `df7dfd9` with full filesystem, processes, ports, env files, hashing, zipping, diff, git, npm, and Super Tools.

---

### `neon` — PostgreSQL Serverless Database
**Current: 89 handler / 87 registry (SYNC + GROWTH)**  
**Target: 150+ tools**

Fix 2 missing registry entries first, then add:

**SQL & Query Tools:**
- `neon_run_sql_batch` — run multiple SQL statements with a single connection
- `neon_get_table_row_counts` — row counts for all tables in a database
- `neon_search_schema` — full-text search across all column names/types
- `neon_generate_crud_sql` — auto-generate INSERT/SELECT/UPDATE/DELETE for a table
- `neon_get_foreign_keys` — list all foreign key relationships
- `neon_get_sequences` — list PostgreSQL sequences and their current values
- `neon_explain_and_optimize` — EXPLAIN ANALYZE + AI-powered optimization suggestions
- `neon_compare_query_plans` — compare two queries' execution plans side by side

**Schema & Migrations:**
- `neon_list_enums` — list all custom enum types
- `neon_create_enum` — create a PostgreSQL enum type
- `neon_list_functions` — list stored procedures and functions
- `neon_list_triggers` — list all triggers across tables
- `neon_list_views` — list views and materialized views
- `neon_get_table_dependencies` — show which tables reference which (dependency graph)
- `neon_dump_schema` — export full schema as CREATE TABLE DDL
- `neon_apply_schema_from_file` — apply a SQL schema file

**Branching & PITR:**
- `neon_list_branch_history` — full timeline of operations on a branch
- `neon_get_branch_diff_full` — full column-level schema diff between branches
- `neon_merge_branch_to_parent` — apply branch schema changes back to parent
- `neon_clone_branch_with_data` — create branch with selected table data copied

**Performance & Health:**
- `neon_get_table_stats` — detailed per-table statistics
- `neon_get_long_running_queries` — queries running over N seconds
- `neon_get_index_bloat` — identify bloated indexes
- `neon_get_vacuum_stats` — when each table was last vacuumed
- `neon_get_autovacuum_status` — check if autovacuum is running correctly
- `neon_get_replication_lag` — check replication delay on read replicas

**pgvector / AI:**
- `neon_enable_pgvector` — enable pgvector extension shortcut
- `neon_create_vector_table` — create a table with a vector column
- `neon_similarity_search` — run cosine/L2 similarity search against a vector column
- `neon_upsert_embeddings` — batch upsert text embeddings into a vector table

**Super Tools:**
- `neon_safe_migration` — test branch → apply → validate → promote (already exists as compound, bring into neon namespace)
- `neon_full_database_health_report` — vacuum stats + slow queries + bloat + connection stats in one call
- `neon_clone_project_for_feature` — create project branch + endpoint + connection string in one call
- `neon_backup_and_rotate` — create a snapshot branch, verify it, clean up old backup branches
- `neon_setup_rag_schema` — create vector table + indexes + enable pgvector for RAG pipeline
- `neon_generate_typescript_types` — query schema and output TypeScript interface definitions

---

### `github` — Version Control & CI/CD
**Current: 201 / 201 ✅**  
**Target: 250+ tools**

Most likely already comprehensive. Full audit needed to identify gaps:

**Likely missing:**
- `github_list_workflow_runs` — GitHub Actions run history
- `github_get_workflow_run` — specific run details
- `github_cancel_workflow_run` — cancel a running workflow
- `github_rerun_workflow` — re-trigger a failed run
- `github_list_workflow_jobs` — jobs within a run
- `github_get_workflow_job_logs` — download job logs
- `github_list_artifacts` — list build artifacts from a run
- `github_download_artifact` — download artifact content
- `github_list_secrets` — repo/org secrets (names only)
- `github_set_secret` — create or update a repo secret
- `github_delete_secret` — delete a secret
- `github_list_environments` — deployment environments
- `github_get_environment` — environment details and protection rules
- `github_create_environment` — create a deployment environment
- `github_list_deployments` — deployment history
- `github_create_deployment` — create a GitHub deployment record
- `github_list_code_scanning_alerts` — security alerts from code scanning
- `github_list_dependabot_alerts` — dependency vulnerability alerts
- `github_dismiss_dependabot_alert` — dismiss a Dependabot alert
- `github_list_packages` — GitHub Packages in a repo
- `github_list_code_owners` — parse CODEOWNERS file
- `github_get_community_profile` — community health score
- `github_list_stargazers` — who starred the repo
- `github_list_traffic_views` — repo traffic stats
- `github_list_traffic_clones` — repo clone stats
- `github_list_popular_paths` — most visited files
- `github_list_referring_sites` — traffic referrers
- `github_list_repo_topics` — list topics/tags on a repo
- `github_replace_repo_topics` — set topics for a repo
- `github_create_from_template` — create a repo from a template
- `github_compare_commits` — compare two refs

**Super Tools:**
- `github_full_pr_review` — get PR diff + comments + checks + reviews in one call
- `github_setup_branch_protection` — configure branch protection rules with sensible defaults
- `github_release_from_tag` — create tag + release + changelog from commits
- `github_repo_health_audit` — check protection rules, secrets count, Actions usage, open PRs
- `github_sync_fork` — sync a fork with upstream main branch

---

### `stripe` — Payments & Billing
**Current: 71 / 71 ✅**  
**Target: 130+ tools**

**Missing categories:**

*Connect (Platform / Marketplace):*
- `stripe_list_connected_accounts`
- `stripe_get_connected_account`
- `stripe_create_account_link` — onboarding link for sellers
- `stripe_create_login_link` — dashboard access for connected accounts
- `stripe_create_transfer` — move money to connected account
- `stripe_list_transfers`
- `stripe_reverse_transfer`
- `stripe_list_payouts` — payout history for an account

*Checkout & Payment Links:*
- `stripe_create_checkout_session`
- `stripe_get_checkout_session`
- `stripe_expire_checkout_session`
- `stripe_create_payment_link`
- `stripe_update_payment_link`
- `stripe_deactivate_payment_link`

*Advanced Billing:*
- `stripe_get_upcoming_invoice` — preview next invoice for a subscription
- `stripe_create_usage_record` — report metered usage
- `stripe_list_usage_records`
- `stripe_create_coupon`
- `stripe_delete_coupon`
- `stripe_create_promotion_code` — discount codes
- `stripe_list_promotion_codes`
- `stripe_create_portal_session` — customer self-service portal

*Testing & Webhooks:*
- `stripe_list_webhook_endpoints`
- `stripe_create_webhook_endpoint`
- `stripe_delete_webhook_endpoint`
- `stripe_trigger_test_event` — trigger a test webhook event
- `stripe_list_events` — recent Stripe event log

*Reporting:*
- `stripe_get_balance` — current account balance
- `stripe_list_balance_transactions`
- `stripe_get_account` — account details and settings

**Super Tools:**
- `stripe_onboard_customer` — create customer + attach payment method + create subscription
- `stripe_upgrade_subscription` — switch plan + calculate proration + apply immediately
- `stripe_issue_refund_and_cancel` — full refund + subscription cancellation + confirmation email hook
- `stripe_revenue_summary` — MRR, ARR, churn rate from Stripe data
- `stripe_dunning_check` — find all past-due subscriptions with customer details

---

### `twilio` — Communications
**Current: 22 / 22 ✅**  
**Target: 90+ tools**

**Currently very shallow — major build needed:**

*Voice:*
- `twilio_make_call` — initiate an outbound voice call
- `twilio_list_calls` — call history
- `twilio_get_call` — call status and details
- `twilio_cancel_call` — cancel a queued/ringing call
- `twilio_create_twiml_bin` — create a TwiML response document
- `twilio_update_call` — modify a live call (redirect, hangup)

*Phone Numbers:*
- `twilio_list_phone_numbers` — numbers owned by account
- `twilio_search_phone_numbers` — search available numbers by area code
- `twilio_buy_phone_number` — purchase a number
- `twilio_release_phone_number` — return a number
- `twilio_update_phone_number` — change routing (voice/SMS webhook URLs)

*Messaging Services:*
- `twilio_list_messaging_services` — messaging service configurations
- `twilio_create_messaging_service`
- `twilio_add_number_to_service` — assign a phone number to a service
- `twilio_send_whatsapp` — send WhatsApp message
- `twilio_list_message_services` — list templates and approved content

*Verify (2FA / OTP):*
- `twilio_create_verify_service` — create a Verify service
- `twilio_send_verification` — send OTP via SMS/call/email
- `twilio_check_verification` — confirm OTP code
- `twilio_list_verify_services`

*Lookup:*
- `twilio_lookup_phone_number` — carrier info, line type, CNAM

*Studio / Flow:*
- `twilio_list_flows` — list Studio flows (automated messaging workflows)
- `twilio_trigger_flow_execution` — start a Studio flow for a contact

*Conversations:*
- `twilio_create_conversation` — multi-party messaging thread
- `twilio_add_conversation_participant`
- `twilio_send_conversation_message`
- `twilio_list_conversations`

*Account:*
- `twilio_get_account` — account info and balance
- `twilio_list_recordings` — call recordings
- `twilio_delete_recording`

**Super Tools:**
- `twilio_dispatch_notification` — send SMS + log to DB in one call (YardSync dispatch)
- `twilio_send_otp_and_verify` — send OTP + wait for check + return result
- `twilio_setup_number_for_sms` — buy number + configure webhook URL + test
- `twilio_broadcast_sms` — send same message to a list of numbers with results summary

---

### `google` — Google Workspace
**Current: 60 / 60 ✅**  
**Target: 130+ tools**

*Deeper Gmail:*
- `gmail_get_attachment` — download email attachment content
- `gmail_list_filters` — get auto-filter rules
- `gmail_create_filter` — create an email filter rule
- `gmail_delete_filter`
- `gmail_forward_message` — forward an email to another address
- `gmail_reply_to_thread` — reply to an existing thread
- `gmail_snooze_message` — schedule message to reappear later
- `gmail_search_advanced` — multi-field search with date ranges, size filters
- `gmail_export_thread_as_text` — full thread as clean text

*Deeper Drive:*
- `drive_create_doc` — create Google Doc with initial content
- `drive_create_spreadsheet` — create Google Sheet with data
- `drive_upload_file` — upload any file to Drive
- `drive_download_file` — download file content
- `drive_get_file_content` — read file content as text
- `drive_watch_file` — set up change notifications
- `drive_create_shortcut` — create a Drive shortcut
- `drive_export_as_pdf` — export a Google Doc/Sheet as PDF
- `drive_list_shared_with_me` — files shared by others
- `drive_list_recent_files` — recently accessed files
- `drive_restore_version` — restore a file to a previous revision

*Deeper Calendar:*
- `calendar_create_recurring_event` — create event with recurrence rule
- `calendar_list_event_instances` — get instances of a recurring event
- `calendar_add_attendee` — add a participant to an existing event
- `calendar_create_video_meeting` — create event with Google Meet link
- `calendar_import_ical` — import iCal file of events

*Deeper Sheets:*
- `sheets_create_chart` — add a chart to a spreadsheet
- `sheets_protect_range` — lock a range from editing
- `sheets_add_conditional_formatting`
- `sheets_sort_range` — sort a range by column
- `sheets_find_replace` — find and replace in a sheet
- `sheets_duplicate_sheet` — copy a tab within the same spreadsheet

*Deeper Docs:*
- `docs_list_headings` — extract all heading structure
- `docs_get_table_data` — extract tables from a document
- `docs_add_comment` — add a comment to a document
- `docs_export_as_pdf` — export document as PDF
- `docs_append_paragraph` — add content at end of doc

**Super Tools:**
- `google_create_project_workspace` — create Drive folder + linked Sheet tracker + Doc brief in one call
- `google_email_with_attachment` — send Gmail with Drive file attached
- `google_schedule_with_invites` — create Calendar event + send Gmail invites + add to Drive agenda doc
- `google_spreadsheet_report` — create Sheet from data array with formatting and chart

---

### `fly` — Global Compute
**Current: 37 / 37 ✅**  
**Target: 100+ tools**

*Machines (deeper):*
- `fly_list_machines` — list all machines for an app
- `fly_get_machine` — get machine details
- `fly_start_machine` — start a stopped machine
- `fly_stop_machine` — stop a running machine
- `fly_restart_machine` — restart a machine
- `fly_destroy_machine` — permanently delete a machine
- `fly_update_machine` — update machine config (CPU/RAM)
- `fly_cordon_machine` — remove from load balancer
- `fly_uncordon_machine` — add back to load balancer
- `fly_exec_command` — execute a command on a machine
- `fly_get_machine_events` — machine lifecycle events log

*Volumes:*
- `fly_list_volumes` — list persistent volumes
- `fly_create_volume` — create a new volume
- `fly_delete_volume`
- `fly_extend_volume` — increase volume size
- `fly_list_volume_snapshots`
- `fly_restore_volume_snapshot`

*Networking:*
- `fly_list_ips` — list allocated IP addresses
- `fly_allocate_ip` — allocate a new IP (IPv4/IPv6)
- `fly_release_ip`
- `fly_list_certificates` — TLS certificates
- `fly_add_certificate` — add a custom domain certificate
- `fly_delete_certificate`
- `fly_get_certificate_status`

*Postgres:*
- `fly_list_postgres_clusters` — list Fly Postgres apps
- `fly_create_postgres` — create a Postgres cluster
- `fly_attach_postgres` — attach Postgres to an app
- `fly_postgres_connect_string` — get connection URI
- `fly_failover_postgres` — trigger Postgres leader election

*Secrets & Config:*
- `fly_list_secrets` — list secret keys (not values)
- `fly_set_secrets` — set one or more secrets
- `fly_unset_secrets`
- `fly_list_env` — list environment variables
- `fly_set_env` — set env var

*Deployments:*
- `fly_get_current_release` — active deployment info
- `fly_list_releases` — deployment history
- `fly_get_release_logs` — logs for a specific release
- `fly_restart_app` — rolling restart of all machines

**Super Tools:**
- `fly_deploy_and_wait` — deploy + poll until healthy + return URL
- `fly_rollback_release` — find previous release + promote + verify health
- `fly_scale_app` — scale count + CPU + RAM + regions in one call
- `fly_full_app_health` — machines status + Postgres health + recent errors
- `fly_provision_postgres_and_attach` — create Postgres cluster + attach to app + get connection string

---

### `cloudflare` — Edge Network
**Current: 54 / 54 ✅**  
**Target: 120+ tools**

**Major missing categories:**

*D1 Database (Cloudflare's SQLite at the edge):*
- `cf_list_d1_databases`
- `cf_create_d1_database`
- `cf_delete_d1_database`
- `cf_query_d1` — run SQL against D1
- `cf_list_d1_tables` — list tables in a D1 database
- `cf_export_d1_database` — export as SQL dump
- `cf_import_d1_database` — import SQL into D1

*Workers AI:*
- `cf_run_ai_model` — run inference via Workers AI
- `cf_list_ai_models` — list available AI models
- `cf_text_generation` — shortcut for text generation
- `cf_image_classification` — classify an image
- `cf_text_embedding` — generate embeddings via Workers AI
- `cf_speech_to_text` — transcribe audio via Workers AI

*Queues:*
- `cf_list_queues` — list Cloudflare Queues
- `cf_create_queue`
- `cf_delete_queue`
- `cf_send_message` — send a message to a queue
- `cf_get_queue_stats` — queue depth and consumer info

*Workers Observability:*
- `cf_get_worker_logs` — recent execution logs for a Worker
- `cf_get_worker_analytics` — requests, errors, CPU time for a Worker
- `cf_get_worker_limits` — Worker plan limits and usage

*Durable Objects:*
- `cf_list_durable_object_namespaces`
- `cf_get_durable_object_stats`

*Analytics Engine:*
- `cf_write_analytics_event` — write a custom analytics event
- `cf_query_analytics` — query analytics data with SQL

*Zero Trust / Access:*
- `cf_list_access_applications`
- `cf_create_access_application`
- `cf_list_access_policies`
- `cf_create_access_policy`

**Super Tools:**
- `cf_deploy_full_worker` — upload Worker + set routes + configure KV bindings
- `cf_setup_d1_schema` — create D1 database + run migration SQL
- `cf_edge_cache_purge_and_verify` — purge cache for URLs + verify content is fresh
- `cf_worker_canary_deploy` — deploy Worker to staging route + test + promote to production

---

### `openai` — AI & Models
**Current: 41 / 41 ✅**  
**Target: 100+ tools**

*Realtime API:*
- `openai_create_realtime_session` — create ephemeral API key for Realtime API
- `openai_list_realtime_sessions`

*Structured Outputs:*
- `openai_chat_completion_structured` — chat completion with JSON Schema enforcement
- `openai_function_call` — chat with tool/function definitions

*Batch API:*
- `openai_create_batch` — submit a batch of requests
- `openai_get_batch` — batch status and progress
- `openai_cancel_batch`
- `openai_list_batches`

*Files (deeper):*
- `openai_upload_file` — upload a file for fine-tuning or assistants
- `openai_get_file_content` — read the content of an uploaded file

*Vector Stores (deeper):*
- `openai_add_file_to_vector_store` — add a file to a vector store
- `openai_list_vector_store_files` — files in a vector store
- `openai_delete_vector_store_file`

*Models:*
- `openai_list_fine_tuning_checkpoints` — checkpoints during a fine-tuning run
- `openai_list_fine_tuning_events` — event log for a fine-tuning job

*Evals:*
- `openai_create_eval` — create a model evaluation
- `openai_run_eval` — run an evaluation against a model
- `openai_list_evals`
- `openai_get_eval_results`

*Images (deeper):*
- `openai_generate_image_base64` — generate image and return as base64
- `openai_edit_image_from_url` — edit an image from a URL

**Super Tools:**
- `openai_rag_query` — embed query + search vector store + generate answer with context
- `openai_batch_embed_and_store` — batch embed texts + upload to vector store
- `openai_assistant_thread_complete` — create thread + add message + run + poll + return response
- `openai_structured_extraction` — extract structured data from text using JSON Schema
- `openai_fine_tune_pipeline` — upload training data + create fine-tuning job + poll until complete

---

### `compound` — Cross-Service Super Tools
**Current: 11 / 11 ✅**  
**Target: 50+ tools**

These orchestrate multiple namespaces together. Planned additions:

*Development Lifecycle:*
- `compound_full_feature_deploy` — GitHub PR merge + Neon migration + Vercel production deploy
- `compound_feature_teardown` — close PR + delete Neon branch + delete preview deployment
- `compound_hotfix_deploy` — git commit + push + Vercel deploy + notify Slack
- `compound_staging_refresh` — reset staging Neon branch + redeploy + smoke test

*Infrastructure Provisioning:*
- `compound_provision_new_project` — GitHub repo + Vercel project + Neon database + env vars wired
- `compound_provision_fly_app` — Fly.io app + Postgres + secrets + first deployment
- `compound_setup_monitoring` — Sentry project + Vercel log drain + Upstash error queue

*Customer/Tenant Operations:*
- `compound_provision_tenant` — Stripe customer + DB tenant schema + Clerk org + welcome email
- `compound_offboard_tenant` — cancel Stripe + archive DB tenant + revoke Clerk org + confirmation email
- `compound_upgrade_tenant` — Stripe plan upgrade + adjust DB quotas + send upgrade confirmation

*Incident Response:*
- `compound_production_incident` — check Vercel/Fly health + query errors + pull Sentry issues + draft alert
- `compound_auto_rollback_on_error` — monitor deployment + auto-rollback if error rate spikes

*Reporting & Analytics:*
- `compound_weekly_engineering_report` — GitHub commits + Vercel deploys + Neon query stats + Stripe MRR
- `compound_cost_audit` — Neon + Vercel + Fly + Upstash + OpenAI costs in one report

*YardSync Specific:*
- `compound_dispatch_job` — create DB job record + send SMS via Twilio + send email via Resend + confirm
- `compound_complete_job` — update DB + notify customer + generate invoice via Stripe
- `compound_driver_onboard` — create Clerk account + invite SMS + seed route data in Neon

---

### `playwright` — Browser Automation (NEW NAMESPACE)
**Current: 0 — Needs to be built from scratch**  
**Target: 60+ tools**

*Core Navigation:*
- `playwright_open_page` — open URL in headless browser
- `playwright_screenshot` — capture full-page screenshot
- `playwright_get_dom` — extract full DOM as HTML
- `playwright_get_text` — extract visible text content
- `playwright_get_title` — page title and meta description
- `playwright_wait_for_element` — wait for a CSS selector to appear

*Interaction:*
- `playwright_click` — click an element by selector
- `playwright_type` — type text into an input
- `playwright_select` — select a dropdown option
- `playwright_check` — check/uncheck a checkbox
- `playwright_scroll` — scroll to position or element
- `playwright_hover` — hover over an element
- `playwright_submit_form` — fill and submit a form

*Extraction:*
- `playwright_get_links` — extract all links from a page
- `playwright_get_table` — extract a table as JSON
- `playwright_get_attribute` — get an attribute value from an element
- `playwright_get_element_text` — text content of a specific element
- `playwright_extract_structured_data` — extract structured data from page

*Network:*
- `playwright_intercept_requests` — capture XHR/fetch requests
- `playwright_mock_response` — mock an API response for testing
- `playwright_get_cookies` — get browser cookies
- `playwright_set_cookie` — set a cookie

*Testing:*
- `playwright_run_accessibility_audit` — a11y audit via axe-core
- `playwright_assert_element_visible` — assert element presence for tests
- `playwright_assert_text_present` — assert text exists on page
- `playwright_take_diff_screenshot` — compare screenshot to baseline

*PDF:*
- `playwright_generate_pdf` — render a URL as PDF
- `playwright_generate_pdf_from_html` — render HTML string as PDF

---

## Verification Checklist

Before marking a namespace as complete, confirm all of the following:

```
□ Handler/registry tool count matches exactly (zero gaps)
□ All tools have return statements — no empty handlers
□ No TODO, FIXME, or placeholder comments in handler
□ Zero duplicate tool names
□ All registry entries have descriptions ≥20 words
□ All required params throw helpful error messages
□ At least 3 Super Tools added as last section in handler
□ Super Tool descriptions marked "SUPER TOOL:" in registry
□ Boot test passes clean (exit 124, zero stderr)
□ Commit message documents every tool group added
```

---

## Running the Full Audit

```bash
# Run this at the start of any session to get current state
node -e "
const fs = require('fs');
const handlers = fs.readdirSync('handlers').filter(f => f.endsWith('.js'));
let total = 0;
for (const hf of handlers) {
  const ns = hf.replace('.js','');
  const reg = 'registry/' + ns + '.json';
  if (!fs.existsSync(reg)) { console.log('NO REGISTRY:', ns); continue; }
  const h = fs.readFileSync('handlers/' + hf, 'utf-8');
  const r = JSON.parse(fs.readFileSync(reg, 'utf-8'));
  const hT = new Set([...h.matchAll(new RegExp(\"tool === '(\" + ns + \"_[^']+)'\", 'g'))].map(m => m[1]));
  const rT = new Set(r.map(t => t.name));
  const inHnotR = [...hT].filter(t => !rT.has(t));
  const inRnotH = [...rT].filter(t => !hT.has(t));
  total += rT.size;
  if (inHnotR.length || inRnotH.length) {
    console.log('⚠️  ' + ns + ': H=' + hT.size + ' R=' + rT.size + ' | missing from R:' + inHnotR + ' | missing from H:' + inRnotH);
  } else {
    console.log('✅ ' + ns + ': ' + rT.size + ' tools');
  }
}
console.log('\nTotal registered tools:', total);
"
```

---

*ClaudeBuildPlan.md — created Session 2. Last updated Session 5 with Chris's directive: github → anthropic → openai → cloudflare → google priority order.*
