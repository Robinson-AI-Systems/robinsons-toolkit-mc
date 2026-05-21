# Robinson's Toolkit — Namespace Expansion Roadmap

## Overview

This document identifies **functional gaps** in each namespace. Tools are organized by category to show which real-world capabilities are **missing** or **underdeveloped**.

**Legend**:
- ✅ **Fully covered** — comprehensive implementation
- ⚠️ **Partially covered** — some tools exist, major gaps remain
- ❌ **Not covered** — category completely absent
- 📊 **Current tools** — number of existing tools per namespace

---

## Major Platforms (100+ tools)

### GitHub (282 tools) — ✅ Mostly Complete
**Status**: Best-in-class coverage. Handles workflows, PRs, issues, repositories, users.

**Possible expansions**:
- ❌ **GitHub Apps & OAuth**: Installing/managing GitHub Apps, OAuth token refresh, token expiration handling
- ❌ **Advanced Permissions**: Organization-level access control, team synchronization, role granularity
- ❌ **Webhook Management**: Creating/listing/deleting webhooks, retry policies, payload filtering
- ❌ **Repository Templates**: Creating repos from templates, template customization
- ❌ **Branch Protection**: Advanced rules (require CODEOWNERS review, auto-dismiss stale reviews, require status checks)
- ❌ **Discussions API**: Create/list/moderate repository discussions
- ❌ **Code Scanning & Alerts**: SAST/DAST result management, alert suppression rules
- ❌ **Dependency Management**: Dependabot alerts, security advisories, version constraints

**Priority**: Medium (niche but valuable for DevSecOps workflows)

---

### Neon (187 tools) — ✅ Comprehensive
**Status**: Excellent coverage for database operations, branching, backups, scaling.

**Possible expansions**:
- ⚠️ **Connection Pooling**: Advanced PgBouncer config, transaction vs session modes, pool reset
- ⚠️ **Monitoring & Alerts**: Query performance thresholds, connection limit alerts, scale event webhooks
- ❌ **IP Whitelisting/VPC**: Network access controls, VPC peering configuration
- ❌ **Encryption Keys**: CMK (Customer Managed Key) rotation, key policy management
- ❌ **Compute Scheduler**: Auto-pause policies, scale-to-zero configuration, wake triggers
- ❌ **Read Replicas**: Cross-region read replica setup, failover configuration

**Priority**: Low-Medium (Neon's feature set is already well-served)

---

### Vercel (150 tools) — ⚠️ Needs Admin/Account Tools
**Status**: Good deployment coverage. Missing account/project management.

**Possible expansions**:
- ❌ **Team Management**: Create/list/delete teams, add/remove team members, team invitations
- ❌ **Organization Settings**: Billing info, payment methods, invoices, subscription management
- ❌ **Advanced Deployments**: Rollback to specific SHA, canary deployments, traffic splitting
- ❌ **Domain Management**: SSL certificate renewal, nameserver configuration, DynaDNS
- ❌ **Edge Config**: Create/update/delete edge configuration, global variable management
- ❌ **Analytics & Monitoring**: Real user monitoring (RUM) data, Core Web Vitals, error tracking
- ❌ **API Token Management**: Create/revoke/rotate API tokens, token scope controls

**Priority**: High (needed for full DevOps automation)

---

### Stripe (202 tools) — ✅ Phase 1 Complete
**Status**: Comprehensive coverage. Added tax/VAT, compliance, Radar fraud rules, Identity/KYC, billing alerts, meters, payouts, topups, bank account verification, forwarding requests, and super tools for compliance snapshot and payout health.

**Possible expansions**:
- ❌ **Account Management**: Bank account verification, payout scheduling, account restrictions
- ❌ **Compliance & Disputes**: Chargeback management, dispute evidence upload, underwriting status
- ❌ **Tax & Reporting**: Tax settings, automated reporting exports, VAT compliance
- ❌ **Team & Permissions**: User invitations, role-based access, activity audit logs
- ❌ **Advanced Billing**: Usage-based metering, billing cycle customization, invoice customization
- ❌ **Webhook Management**: Webhook event filtering, retry policies, signature verification
- ❌ **Financial Reports**: P&L data, revenue recognition reports, tax documents

**Priority**: Very High (critical for production payment platforms)

---

### Cloudflare (148 tools) — ⚠️ Missing Account & Advanced Features
**Status**: Zone/DNS coverage adequate. Missing account-level and advanced features.

**Possible expansions**:
- ❌ **Account Management**: Billing, plan upgrades/downgrades, seat management, member invitations
- ❌ **Advanced Security**: WAF rule builder, Bot Management config, API Shield configuration
- ❌ **Zero Trust**: Tunnel management (already have some), Access group sync, device management
- ❌ **Stream & Media**: Video upload/management, live stream configuration, adaptive bitrate settings
- ❌ **Workers KV**: Key-value store management, namespace versioning, key expiration
- ❌ **Email Routing**: Email rule management, catch-all configuration, integration testing
- ❌ **Firewall Rules**: Advanced rule conditions, challenge actions, block responses
- ❌ **Page Rules**: Legacy page rule migration, rule priority management

**Priority**: High (Cloudflare is critical infrastructure for modern web)

---

### OpenAI (115 tools) — ⚠️ Missing Organization & Fine-Tuning
**Status**: Basic API coverage. Missing org management and advanced training.

**Possible expansions**:
- ❌ **Organization Management**: Create/delete orgs, member management, billing per organization
- ❌ **Fine-Tuning (Full)**: Upload JSONL, monitor training progress, cancel in-flight training
- ❌ **Model Management**: Create custom models, version control, model deprecation handling
- ❌ **Usage & Billing**: Token usage analytics, cost forecasting, quota management
- ❌ **API Key Rotation**: Time-limited keys, key scopes, automatic rotation policies
- ❌ **Moderation API**: Content classification, policy violation detection, threshold tuning

**Priority**: Medium-High (fine-tuning is increasingly important)

---

### Supabase (100 tools) — ⚠️ Needs Auth & Admin Features
**Status**: Database-focused. Missing auth, functions, and admin tools.

**Possible expansions**:
- ❌ **Auth Provider Setup**: OAuth/SAML configuration, MFA policies, session management
- ❌ **Edge Functions**: Deploy/manage Deno functions, environment variables, secrets
- ❌ **Storage Admin**: Bucket policies, CORS configuration, signed URLs, access control
- ❌ **Logs & Monitoring**: Real-time logs, error tracking, performance metrics, alert setup
- ❌ **Backups & Recovery**: Backup scheduling, point-in-time restore, export/import
- ❌ **Vector Search**: pgvector index management, similarity search config, embedding storage
- ❌ **Replication**: Read replicas, failover, cross-region setup

**Priority**: High (full Supabase platform is much bigger than current coverage)

---

### Twilio (94 tools) — ⚠️ Missing Account & Advanced Features
**Status**: Messaging basics covered. Missing account, calling advanced features, compliance.

**Possible expansions**:
- ❌ **Account Management**: Sub-accounts, billing, API key rotation, usage alerts
- ❌ **Voice Advanced**: IVR configuration, call recording setup, voice quality metrics
- ❌ **Compliance & Numbers**: 10DLC enrollment, short code applications, number porting
- ❌ **Messaging Advanced**: Messaging slots, A2P registration, carrier compliance
- ❌ **Sync & Chat**: Real-time synchronization config, chat channel management
- ❌ **Webhooks**: Event filtering, retry policies, authentication, signature validation
- ❌ **Studio Flows**: Workflow builder integration, execution monitoring, performance analytics

**Priority**: Medium (most common Twilio use cases covered)

---

### Clerk (75 tools) — ⚠️ Missing Admin & Enterprise Features
**Status**: Basic user management. Missing org management and advanced auth.

**Possible expansions**:
- ❌ **Organization Management**: Create/manage organizations, invite members, member roles
- ❌ **Sessions & Tokens**: Session invalidation, token refresh policies, multi-device management
- ❌ **OAuth/SAML**: Enterprise single sign-on setup, IdP configuration
- ❌ **Security Policies**: Password requirements, login attempt limits, IP whitelisting
- ❌ **Webhooks & Events**: Event subscription, retry policies, webhook testing
- ❌ **Audit Logs**: Activity tracking, compliance reporting, data export

**Priority**: High (needed for enterprise SaaS)

---

### Sentry (82 tools) — ⚠️ Missing Management & Compliance
**Status**: Basic error tracking. Missing org management and advanced features.

**Possible expansions**:
- ❌ **Organization & Team Management**: Org settings, team creation, member roles, invitations
- ❌ **Advanced Alerting**: Custom alert conditions, escalation policies, on-call management
- ❌ **Data Management**: Scrubbing rules, PII redaction, data retention, GDPR compliance
- ❌ **Release Tracking**: Deployment tracking, commit tracking, release deployments
- ❌ **Performance Monitoring**: Transaction tracing, profiling, frontend monitoring
- ❌ **Webhooks**: Integration webhooks, event filtering, retry policies

**Priority**: Medium-High (monitoring is critical for prod)

---

## Specialized/Niche Platforms (50-100 tools)

### Fly.io (101 tools) — ⚠️ Missing Account & Admin
**Status**: App deployment/scaling covered. Missing org and account features.

**Possible expansions**:
- ❌ **Organization Management**: Org creation, member management, billing per org
- ❌ **Advanced Scaling**: Autoscaling policies, traffic splitting, gradual rollouts
- ❌ **Networking**: Private networks, VPC peering, Wireguard tunnel management
- ❌ **Volumes**: Volume snapshots, backup scheduling, cross-region replication
- ❌ **Certificates**: Custom SSL management, auto-renewal, certificate validation
- ❌ **Monitoring & Logs**: Real-time metrics, log aggregation, performance insights
- ❌ **API Tokens**: Token creation/rotation, scope management, audit logs

**Priority**: Medium (niche but important for Fly users)

---

### Postgres (111 tools) — ✅ Phase 1 Complete
**Status**: Comprehensive coverage. Added database management, advanced role/privilege management, schema dump/backup, advanced performance analysis, extensions management, table/column/constraint DDL, view management, function management, and super tools for permissions audit and performance report.

**Possible expansions**:
- ❌ **User Management**: Create/drop users, privilege grants, password rotation
- ❌ **Database Admin**: Create/drop databases, character set management, locale configuration
- ❌ **Backup/Recovery**: pg_dump/pg_restore automation, point-in-time recovery, WAL archiving
- ❌ **Replication**: Streaming replication setup, standby management, failover
- ❌ **Extensions**: Install/uninstall extensions, extension dependency resolution
- ❌ **Performance**: EXPLAIN ANALYZE, query plan analysis, index recommendations
- ❌ **Monitoring**: Connection monitoring, lock monitoring, bloat detection, autovacuum tuning

**Priority**: Very High (Postgres admin is complex and valuable)

---

### Qdrant (53 tools) — ⚠️ Nascent Vector DB Coverage
**Status**: Basic vector operations. Missing cluster, admin, and advanced features.

**Possible expansions**:
- ❌ **Cluster Management**: Node management, shard replication, failover configuration
- ❌ **Collection Admin**: Advanced index configuration, optimizer settings, batch optimization
- ❌ **Monitoring & Observability**: Metrics export, health checks, performance profiling
- ❌ **Snapshots**: Collection snapshots, recovery, version management
- ❌ **Access Control**: User management, API key scoping, rate limiting
- ❌ **Payload Indexing**: Complex payload schema management, nested field indexing

**Priority**: Medium (vector DBs are emerging; coverage will grow)

---

### Mapbox (51 tools) — ⚠️ Missing Admin & Tileset Management
**Status**: Basic maps API. Missing account, tileset, and advanced features.

**Possible expansions**:
- ❌ **Account Management**: Billing, API key management, team members, usage monitoring
- ❌ **Tileset Management**: Upload vector tilesets, manage raster tilesets, source management
- ❌ **Styles**: Create/edit map styles, style publishing, sharing styles
- ❌ **Data**: Datasets API, feature editing, spatial queries
- ❌ **Routing Advanced**: Matrix API, isochrone generation, route optimization
- ❌ **Analytics**: Map analytics, heatmaps, user interaction tracking

**Priority**: Medium (maps are niche but powerful)

---

### N8n (63 tools) — ⚠️ Missing Workflow Management
**Status**: Basic workflow execution. Missing workflow CRUD and admin.

**Possible expansions**:
- ⚠️ **Workflow Management**: Create/list/update/delete workflows, version control, branching
- ❌ **Credential Management**: Manage integrations, credential rotation, secret management
- ❌ **Execution Monitoring**: View execution history, retry failed executions, debug mode
- ❌ **Team & Users**: User management, team collaboration, permission models
- ❌ **Webhooks**: Webhook management, event filtering, signature validation
- ❌ **Backups**: Workflow export/import, version history

**Priority**: High (n8n is increasingly popular for automation)

---

### Linear (38 tools) — ⚠️ Missing Admin & Automation
**Status**: Basic issue management. Missing team, workflow, and admin features.

**Possible expansions**:
- ❌ **Team Management**: Workspace creation, member roles, invitations, billing
- ❌ **Workflow Automation**: Workflow triggers, status transitions, auto-assignment rules
- ❌ **Templates**: Issue templates, workflow templates, custom field templates
- ❌ **Integrations**: Webhook management, OAuth app registration, integration settings
- ❌ **Notification Rules**: Custom notifications, alert thresholds, escalation
- ❌ **Audit Logs**: Activity tracking, compliance reporting, data export

**Priority**: Medium-High (Linear adoption is growing)

---

### Slack (37 tools) — ⚠️ Missing Admin & Workspace Management
**Status**: Basic messaging. Missing workspace admin, advanced features, app management.

**Possible expansions**:
- ❌ **Workspace Admin**: User management, permission policies, org chart, identity sync
- ❌ **App Management**: Marketplace installation, app permissions, token scoping, app directory
- ❌ **Advanced Messaging**: Scheduled messages, message updates, bulk operations
- ❌ **Workflows**: Create/manage Slack workflows, workflow triggers, automation
- ❌ **Security**: IP whitelisting, DLP policies, audit logs, encryption
- ❌ **Analytics**: Channel analytics, user activity, retention metrics

**Priority**: High (Slack is core infrastructure for many orgs)

---

### Context7 (45 tools) — ⚠️ Unknown Expansion Needs
**Status**: Proprietary platform with limited documentation available.

**Note**: Context7 is less standardized. Recommend:
1. Contact Context7 team for API roadmap
2. Audit actual API for gaps
3. Focus on most-used endpoints first

**Priority**: Low (niche platform)

---

### Resend (52 tools) — ⚠️ Missing Admin & Template Management
**Status**: Basic email sending. Missing account, template, and admin features.

**Possible expansions**:
- ❌ **Account Management**: Billing, API key management, usage monitoring
- ❌ **Template Management**: Create/list/manage email templates, template versioning
- ❌ **Domain Management**: Domain verification, DKIM/SPF setup, custom tracking domain
- ❌ **Analytics**: Email delivery metrics, open rates, click rates, bounce handling
- ❌ **Webhooks**: Delivery events, bounce handling, complaint handling
- ❌ **Compliance**: GDPR data export, suppression list management, unsubscribe handling

**Priority**: Medium (email is foundational but Resend is newer)

---

## Emerging/AI Platforms (10-50 tools)

### Anthropic (64 tools) — ⚠️ Missing Organization & Billing
**Status**: Basic API coverage. Missing org management and advanced features.

**Possible expansions**:
- ❌ **Organization Management**: Create orgs, member management, billing per org
- ❌ **API Key Management**: Token creation/rotation, scope management, audit logs
- ❌ **Usage & Billing**: Detailed usage metrics, cost breakdown, quota management
- ❌ **Model Management**: Custom model fine-tuning, model versioning, deprecation handling
- ❌ **Rate Limiting**: Custom rate limit policies, burst handling

**Priority**: Medium (newer platform, APIs still evolving)

---

### Gemini (31 tools) — ⚠️ Missing Organization & Fine-Tuning
**Status**: Basic API. Missing org, fine-tuning, and advanced features.

**Possible expansions**:
- ❌ **Organization Management**: Multi-tenancy, billing, team members
- ❌ **Fine-Tuning**: Model adaptation, custom model creation, training monitoring
- ❌ **Safety & Filtering**: Content filtering policies, custom blocklists, safety settings
- ❌ **Caching**: Prompt caching configuration, cost optimization
- ❌ **API Key Management**: Token creation, scope control, rotation policies

**Priority**: Medium (Google AI is still maturing)

---

### Moonshot (17 tools) — ❌ Extremely Limited
**Status**: Minimal coverage. Recommend comprehensive API audit and expansion.

**Possible expansions**: All categories (API is new, need to build out)

**Priority**: Low (very niche)

---

### Voyage (11 tools) — ❌ Extremely Limited
**Status**: Minimal coverage. Recommend comprehensive API audit and expansion.

**Possible expansions**: All categories (new embedding service)

**Priority**: Low (very niche)

---

### Ollama (16 tools) — ⚠️ Limited to Local Models
**Status**: Local LLM execution. Missing model management and admin.

**Possible expansions**:
- ❌ **Model Management**: Download/delete models, version management, auto-updates
- ❌ **Performance Tuning**: GPU memory optimization, quantization options, batch processing
- ❌ **Integration**: HTTP API configuration, port management, multi-instance setups

**Priority**: Low (Ollama is local-only; less relevant for remote infrastructure)

---

### Search (30 tools) — ⚠️ Basic Search Coverage
**Status**: Multiple search engines. Missing advanced features.

**Possible expansions**:
- ❌ **Custom Search Engines**: Create/manage custom search configurations
- ❌ **Index Management**: Index creation, update frequency, source management
- ❌ **Analytics**: Search analytics, click-through rates, user behavior
- ❌ **Webhooks**: Index change events, crawl status

**Priority**: Low (search is fairly mature)

---

### SAM.gov (21 tools) — ❌ Niche Government API
**Status**: Basic API coverage for government contracting.

**Possible expansions**:
- ❌ **Contract Search**: Advanced filtering, saved searches, alerts
- ❌ **Reporting**: Contract analytics, vendor analytics
- ❌ **DUNS & Entity**: Entity registration, verification status

**Priority**: Very Low (highly niche)

---

## Lightweight/Local Platforms (10-70 tools)

### Local (62 tools) — ✅ Good Coverage
**Status**: Local machine access. Comprehensive file/command execution.

**Possible expansions**:
- ⚠️ **Process Management**: Process creation, monitoring, resource constraints, cgroup management
- ⚠️ **System Admin**: User management, permission modification, systemd service management
- ⚠️ **Networking**: Network interface config, DNS resolution, port scanning
- ❌ **Docker Integration**: Container lifecycle, image management, compose orchestration
- ❌ **Virtualization**: VM creation/management, snapshots, templates

**Priority**: Low (local tools are already comprehensive)

---

### Playwright (34 tools) — ⚠️ Basic Browser Automation
**Status**: Basic browser control. Missing advanced features.

**Possible expansions**:
- ⚠️ **Performance Metrics**: Core Web Vitals, network timing, rendering metrics
- ⚠️ **Network Interception**: Request modification, response mocking, HAR recording
- ❌ **Video Recording**: Screen recording, video encoding, storage management
- ❌ **Accessibility Testing**: WCAG compliance checking, accessibility tree inspection
- ❌ **Multi-browser**: Safari testing, coordinated browser control

**Priority**: Medium (automation is increasingly important)

---

### Compound (46 tools) — ✅ Meta-Tool Category
**Status**: Bundles other tools. Coverage depends on underlying integrations.

**Possible expansions**: Meta-tools should be added as underlying tools expand.

**Priority**: Reactive (follows other tools)

---

## Summary Table: Coverage by Category

| Namespace | Tools | Gaps | Priority |
|-----------|-------|------|----------|
| github | 282 | Apps/webhooks/security | Medium |
| neon | 187 | Monitoring/encryption | Low |
| upstash | 166 | ? (audit needed) | ? |
| google | 158 | (varies by service) | High |
| vercel | 150 | Team/billing/advanced | High |
| cloudflare | 148 | Account/KV/advanced | High |
| stripe | 202 | ✅ Phase 1 complete | Done |
| openai | 115 | Org/fine-tuning/billing | Medium-High |
| fly | 101 | Org/scaling/volumes | Medium |
| supabase | 100 | Auth/functions/backups | High |
| twilio | 94 | Account/compliance/advanced | Medium |
| sentry | 82 | Org/alerting/monitoring | Medium-High |
| clerk | 75 | Org/OAuth/policies | High |
| postgres | 111 | ✅ Phase 1 complete | Done |
| anthropic | 64 | Org/billing/management | Medium |
| n8n | 63 | Workflow CRUD/automation | High |
| local | 62 | Docker/VM management | Low |
| qdrant | 53 | Cluster/admin/monitoring | Medium |
| resend | 52 | Billing/templates/domains | Medium |
| mapbox | 51 | Tilesets/admin/analytics | Medium |
| context7 | 45 | (audit needed) | Low |
| compound | 46 | (meta-tool) | Reactive |
| linear | 38 | Team/workflow/automation | Medium-High |
| slack | 37 | Workspace admin/apps | High |
| playwright | 34 | Performance/recording | Medium |
| gemini | 31 | Org/fine-tuning | Medium |
| search | 30 | Advanced/analytics | Low |
| sam | 21 | Advanced search/alerts | Very Low |
| moonshot | 17 | Full API coverage | Low |
| ollama | 16 | Model management | Low |
| voyage | 11 | Full API coverage | Low |

---

## Recommended Expansion Priority

### Phase 1: Critical Missing Features — ✅ COMPLETE (2026-05-21)
1. ~~**Stripe**: Billing, account, compliance~~ — ✅ Done (202 tools)
2. ~~**Postgres**: Admin, backup, replication~~ — ✅ Done (111 tools)
3. **Google**: Complete each sub-service (Workspace, Cloud, etc.)

### Phase 2: High-Value Gaps (High Priority)
1. **Vercel**: Team, billing, advanced features
2. **Cloudflare**: Account, KV, advanced security
3. **Supabase**: Auth, functions, backups
4. **Clerk**: Organization management, OAuth/SAML
5. **Slack**: Workspace admin, apps, workflows
6. **Linear**: Team, workflow, automation
7. **N8n**: Workflow CRUD, automation rules

### Phase 3: Medium Priority (Niche but Valuable)
1. **OpenAI/Gemini**: Org management, fine-tuning, billing
2. **Sentry**: Org management, advanced alerting, monitoring
3. **Twilio**: Account, compliance, advanced features
4. **Fly.io**: Org, scaling, networking
5. **Playwright**: Performance metrics, network interception, recording

### Phase 4: Low Priority (Mature APIs or Niche Platforms)
- GitHub (already comprehensive)
- Neon (already comprehensive)
- Local (already comprehensive)
- Moonshot, Voyage, SAM (niche or emerging)

---

## Next Steps

1. **Audit underspecified namespaces**: Upstash, Google (which subservices?), Context7
2. **Prioritize Phase 1 expansions**: Start with Stripe, Postgres, Google
3. **Build expansion PRs**: One namespace at a time
4. **Community feedback**: Which gaps matter most to users?

