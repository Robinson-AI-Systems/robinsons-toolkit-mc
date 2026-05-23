# Quick Reference: Namespace Expansion Priorities

**For developers adding missing tools to the toolkit.**

---

## Phase 1: Add These First (Critical)

### 🔴 Stripe — Missing Payment/Billing Core
- Account management (bank account, payouts)
- Compliance (chargebacks, disputes)
- Billing (usage-based, invoices, taxes)
- Team permissions & audit logs
- Webhook filtering & retry policies

**Why**: Payment platforms need complete admin access.

---

### 🔴 PostgreSQL — Missing Database Admin
- User & permission management
- Database creation/deletion
- Backup/recovery automation
- Replication setup
- Performance tuning (EXPLAIN, index recommendations)
- Monitoring (locks, bloat, autovacuum)

**Why**: Postgres admin is complex but essential for production systems.

---

### 🔴 Google — Incomplete Service Coverage
- **Current**: Maps, Drive, Calendar, Gmail, Auth
- **Missing**: Which sub-services are underserving real users?
- **Audit needed**: Document which Google APIs matter most

**Why**: Google has 100+ APIs; focus on the ones you actually need.

---

## Phase 2: Add These Next (High Priority)

### 🟠 Vercel — Missing Team/Billing
- Teams (create/delete, invite members)
- Organization settings (billing, payment methods, invoices)
- Advanced deployments (rollback, canary, traffic splitting)
- Domain management & SSL
- Edge Config (global variables)
- Analytics (RUM, Core Web Vitals)

**Why**: DevOps automation requires full account control.

---

### 🟠 Cloudflare — Missing Account/Advanced
- Account management (billing, plan changes, member seats)
- Workers KV (namespace creation, versioning, expiration)
- WAF rule builder, Bot Management, API Shield
- Email Routing (rules, catch-all)
- Stream & Media (video management)

**Why**: Cloudflare is infrastructure; advanced features unlock more automation.

---

### 🟠 Supabase — Missing Auth/Functions/Backups
- Auth provider setup (OAuth, SAML, MFA)
- Edge Functions (deploy, manage Deno)
- Storage admin (policies, CORS, signed URLs)
- Logs & monitoring (real-time, error tracking)
- Backups & point-in-time recovery
- Vector search (pgvector indexing)

**Why**: Supabase is BaaS; auth + functions are essential.

---

### 🟠 Clerk — Missing Org Management
- Organizations (create, invite members, member roles)
- Sessions & tokens (invalidation, refresh policies)
- OAuth/SAML for enterprise SSO
- Security policies (password reqs, IP whitelisting)
- Webhooks & audit logs

**Why**: Enterprise SaaS needs org management.

---

### 🟠 Slack — Missing Workspace Admin
- User management (roles, permissions)
- App management (installation, permissions, scopes)
- Workflow creation (triggers, automation)
- Security (IP whitelisting, DLP, audit logs)
- Analytics (channel activity, retention)

**Why**: Slack is core infra; automation needs admin access.

---

### 🟠 Linear — Missing Team/Workflow
- Workspace/team management (roles, invitations)
- Workflow automation (triggers, status transitions, auto-assign)
- Templates (issues, workflows, custom fields)
- Webhooks & integrations
- Audit logs

**Why**: Linear adoption growing; automation features matter.

---

### 🟠 N8n — Missing Workflow CRUD
- Workflow creation/deletion/versioning
- Credential management (integrations, secrets)
- Execution monitoring (history, retries, debug)
- Team & permissions
- Webhooks & backups

**Why**: n8n is automation platform; needs full API.

---

## Phase 3: Add These Later — ✅ COMPLETE (2026-05-23)

### 🟡 OpenAI / Gemini
- Organization management (multi-tenancy, billing)
- Fine-tuning (model adaptation, training monitoring)
- Token usage & cost forecasting
- API key rotation & scoping
- Model deprecation handling

**Why**: LLMs increasingly need fine-tuning & org management.

---

### 🟡 Sentry
- Organization & team management
- Advanced alerting (custom conditions, escalation)
- Data management (scrubbing, PII redaction, retention)
- Release tracking (deployments, commits)
- Performance monitoring (tracing, profiling)

**Why**: Monitoring is critical; advanced features matter for prod.

---

### 🟡 Twilio
- Account management (sub-accounts, billing)
- Voice advanced (IVR, call recording)
- Compliance (10DLC, short codes, number porting)
- Webhooks (filtering, retry, validation)
- Studio Flows (workflow integration)

**Why**: Twilio is common; advanced features support more use cases.

---

### 🟡 Fly.io
- Organization management (billing per org)
- Advanced scaling (autoscaling, traffic splitting, gradual rollouts)
- Networking (private networks, VPC peering, Wireguard)
- Volume management (snapshots, cross-region replication)
- Monitoring & logs

**Why**: Niche but complete feature set needed for power users.

---

### 🟡 Playwright
- Performance metrics (Core Web Vitals, network timing)
- Network interception (request mocking, HAR recording)
- Video recording & accessibility testing

**Why**: Browser automation increasingly needs metrics & recording.

---

## Phase 4: Low Priority (Already Good or Niche)

### ✅ GitHub (282 tools) — Comprehensive
- Already covers: repos, PRs, issues, workflows, users
- Could add: GitHub Apps, webhooks, branch protection, code scanning
- But: Most common use cases covered

---

### ✅ Neon (187 tools) — Comprehensive
- Already covers: branching, scaling, backups, pooling
- Could add: IP whitelisting, compute scheduler, read replicas
- But: Feature set well-served for most users

---

### ✅ Local (62 tools) — Comprehensive
- Already covers: file/command execution
- Could add: Docker, VMs, systemd management
- But: Already strong local automation support

---

### ❓ Upstash (166 tools)
- **Status**: Large count but gaps unknown
- **Action**: Audit actual API coverage; determine real gaps
- **Priority**: After Phase 1 & 2 items are complete

---

### ❓ Context7 (45 tools)
- **Status**: Proprietary; documentation sparse
- **Action**: Contact Context7 team for API roadmap
- **Priority**: Low until documentation improves

---

### 🔵 Niche Platforms (Low Priority)
- Mapbox (51 tools) → Tilesets, styles, routing
- Resend (52 tools) → Templates, domains, analytics
- Qdrant (53 tools) → Cluster management, snapshots
- Moonshot, Voyage, Ollama → Very niche; expand later

---

## How to Add Tools

1. **Create feature branch**:
   ```bash
   robinsons-toolkit:compound_scaffold_feature(
     feature_name: "stripe-account-management",
     github_owner: "YOUR_ORG",
     github_repo: "robinsons-toolkit",
     neon_project_id: "YOUR_PROJECT"
   )
   ```

2. **Read API docs**: Pull the target service's API reference.

3. **Generate tools**: Use your LLM to generate handler + registry JSON for new tools.

4. **Test**: Verify `audit.js` shows sync.

5. **Commit & PR**: Push feature branch, open PR.

6. **Fallback**: If something breaks:
   ```bash
   robinsons-toolkit:compound_rollback_transaction(
     last_n: 1
   )
   ```

---

## Tool Count Targets

| Namespace | Current | Target | Reason |
|-----------|---------|--------|--------|
| stripe | 143 | 170+ | Billing/compliance critical |
| postgres | 65 | 95+ | Admin/monitoring essential |
| vercel | 181 | ✅ Phase 2 complete | Done |
| cloudflare | 187 | ✅ Phase 2 complete | Done |
| supabase | 127 | ✅ Phase 2 complete | Done |
| slack | 69 | ✅ Phase 2 complete | Done |
| neon | 187 | 200+ | Monitoring/advanced |
| github | 282 | 310+ | Security/webhooks |

---

**Questions?** Check `EXPANSION_ROADMAP.md` for detailed analysis.

