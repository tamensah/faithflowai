# FaithFlow AI — Platform Admin Manual

> This manual is for **platform-level staff** only (FaithFlow AI team, not church admins).
> It covers every page, tool, and workflow available in the platform admin section of the admin console.

---

## Who is a Platform Admin?

Platform admins are internal FaithFlow AI team members who manage all tenants (churches) on the SaaS platform. They are separate from church-level admins who manage a single church's data.

Platform access is role-gated. Roles are assigned from `/platform` and stored in the `PlatformUser` table. A Clerk user must be listed in `PLATFORM_ADMIN_EMAILS` (environment variable) or have an assigned role to access platform pages.

---

## Platform Roles

| Role | What they can do |
|------|----------------|
| `SUPER_ADMIN` | Full access to all platform operations |
| `PLATFORM_ADMIN` | Tenant management, billing, subscriptions, ops |
| `OPERATIONS_MANAGER` | Ops tools: health sweeps, domain automation, streaming sync |
| `BILLING_ADMIN` | Plan catalog, subscription assignments, dunning, billing automation |
| `SUPPORT_MANAGER` | Support ticket management and SLA oversight |
| `SUPPORT_AGENT` | Support ticket replies and knowledge base |
| `SECURITY_ADMIN` | Tenant security policies, MFA, SSO, IP allowlist |
| `COMPLIANCE_OFFICER` | Audit logs and compliance reporting |
| `ANALYTICS_ADMIN` | Read-only access to tenant analytics |

Roles are assigned from the **Platform overview** page (`/platform`) by a SUPER_ADMIN or PLATFORM_ADMIN.

---

## Pages

### 1. Platform Overview (`/platform`)

The command center. First page any platform admin lands on.

**Tenant stats bar**

Six cards show a live count of all tenants by subscription state:

| Card | What it means |
|------|--------------|
| Total tenants | All provisioned tenants regardless of status |
| Active | Tenants with a `ACTIVE` subscription (paying) |
| Trialing | Tenants in a free trial |
| Past due | Failed payment — at-risk count shows how many are dunning targets |
| No subscription | Tenants who completed onboarding but never subscribed |
| Suspended | Tenants with all API access blocked |

**Active plan catalog** — Lists all active plans with their per-cycle price and how many tenants are on each plan. Quick signal for which tiers are selling.

**Quick-action cards** — One-click links to Tenant management, Subscriptions & billing, and Platform ops.

**Platform team roles** — Add or remove role assignments for internal team members. Only operational roles visible here; church-level admin roles are managed per-tenant in `/platform/tenants`.

---

### 2. Tenant Management (`/platform/tenants`)

Search and manage all church tenants on the platform.

**Tenant list**
- Filter by name/slug/email (full-text search)
- Filter by status: ALL / ACTIVE / SUSPENDED
- Each tenant card shows: name, slug, subscription status + plan, creation date

**Tenant actions**
- **Suspend**: blocks all API calls from that tenant immediately. Clerks get a 403. Use for billing enforcement, ToS violations, or fraud.
- **Activate**: lifts the suspension.
- Always add a reason — it is written to the audit log and shown to the tenant as the suspension message.

**Tenant audit timeline**

Click any tenant to open its audit log. Filters available:
- Action contains (free text)
- Actor type: USER / SYSTEM / WEBHOOK
- Actor ID (Clerk user ID or service name)
- Target type / target ID
- Date range (from / to)

Audit entries cover: billing events, member writes, comms sends, admin actions, webhook processing, and platform operations.

**CSV export** — Downloads the filtered audit set as a CSV for compliance reporting or incident investigation.

---

### 3. Subscriptions & Plans (`/platform/subscriptions`)

Full billing operations workspace. Eight focused tabs.

#### Plan editor

Create or update subscription plans in the catalog.

| Field | Notes |
|-------|-------|
| Plan code | Short identifier used in API calls (e.g. `starter`, `growth`) |
| Plan name | Display name shown to customers |
| Currency | ISO 4217 three-letter code (e.g. `USD`, `GHS`) |
| Interval | MONTHLY / YEARLY / CUSTOM |
| Amount (minor units) | Price in cents/kobo/pesewas — `4900` = $49.00 USD |
| Trial days | Set to `0` for no trial; default is `14` for Starter/Growth |
| Default plan | The plan assigned to new tenants with no subscription history |
| Active | Inactive plans are hidden from checkout but still shown here |
| Features | One feature per line: `key,enabled,limit` — e.g. `max_members,true,500` |

Feature limits set to `null` mean unlimited. Feature keys must match what the entitlement resolver checks (see `docs/SUBSCRIPTION_SYSTEM.md`).

#### Tenant assignment

Manually assign a plan to a tenant — used for custom enterprise deals, migrations, or comping a tenant.

- Select tenant + plan
- Set status (TRIALING / ACTIVE / PAST_DUE / PAUSED / CANCELED / EXPIRED)
- Provider: MANUAL for internal assignments; STRIPE/PAYSTACK for provider-backed
- Reason is written to the audit log

> **Note:** For Stripe/Paystack-backed subscriptions, use this only to correct state after a webhook failure. Normal billing goes through provider checkout.

#### Dunning

Queue billing reminder emails to past-due tenants.

- **Grace days**: only tenants past-due for more than this many days are targeted (default: 3)
- **Tenant limit**: caps the sweep size
- **Preview count**: shown in real-time before running — `N subscriptions · M tenants`
- **Run dunning now**: queues emails and marks tenants accordingly

The dunning dedup key is per-subscription per 24h, so running twice in a day does not double-send.

#### Billing automation

Runs the full subscription lifecycle sweep — expires tenants who are past-due beyond the configured threshold and moves them into inactive-subscription lockout.

- **Expire past-due after (days)**: tenants past-due longer than this are expired (default: 7)
- **Max tenants to process**: caps the sweep (default: 500)

This is the most destructive platform operation — it cuts off access. Only run after dunning tiers have fired and the grace period has genuinely elapsed. The result JSON shows which tenant IDs were processed and what state transitions occurred.

> The scheduled cron (`POST /tasks/subscriptions/metadata-backfill`) runs a lighter version automatically. Use this manual trigger only for immediate enforcement outside the cron window.

#### Provider metadata

Backfill Stripe/Paystack customer IDs and subscription references into the `TenantSubscription` table from provider-sourced data. Run when webhooks were missed or when migrating tenants between billing providers.

- **Preview backfill** (dry run): shows what would be updated without writing
- **Run backfill**: executes the normalization

Result shows: scanned / updated / skipped / failed counts.

#### Plan catalog

Read-only view of all plans (active and inactive) with full feature lists and assignment counts. Use to quickly verify what features a plan exposes before assigning it to a tenant.

#### Tenant snapshot

All tenants listed with their current subscription plan and status. Quick reference for support calls — "what plan is Grace Church on?"

#### Tenant inspector

Deep-dive into a single tenant.

1. Select the tenant from the dropdown
2. **Active subscription** panel: plan name/code, status badge, provider, billing period end, seat count
3. **Usage snapshot**: live usage metrics for the tenant (member count, campus count, etc.)
4. **Refresh** button forces a fresh data fetch

Use this when a tenant disputes their billing, reports missing features, or you need to verify their quota before a support action.

---

### 4. Platform Ops (`/platform/ops`)

Infrastructure and operational control plane.

#### Domain management

- List all tenant custom domains with verification status (PENDING / VERIFIED / FAILED / ACTIVE)
- Run domain automation sweep: triggers DNS verification + SSL lifecycle state updates for all pending domains
- **Dry-run** available to preview which domains would transition before committing

Domain states:
| State | Meaning |
|-------|---------|
| PENDING | Domain added, DNS not yet verified |
| VERIFIED | DNS verified, SSL provisioning in progress |
| ACTIVE | SSL live, domain serving traffic |
| FAILED | Verification or SSL provisioning failed — check runbook |

Failed domains auto-escalate to support tickets after `DOMAIN_PENDING_ESCALATION_HOURS` (default 24h). Incidents auto-close when the domain transitions to ACTIVE.

#### SSL automation

Sweeps all VERIFIED domains and provisions/renews SSL certificates. Runs every 15 minutes via cron. Manual trigger available for immediate action.

#### Streaming sync

Triggers the provider sync cron manually — syncs YouTube/Facebook/Vimeo live session status, viewer counts, and auto-transitions (SCHEDULED→LIVE, LIVE→ENDED). Normally runs every 10 minutes automatically.

#### Tenant health checks

Runs health sweep across all tenants checking:
- DB connectivity
- Webhook delivery recency (Stripe/Paystack)
- Email provider config (Resend)
- Storage config
- Payments config
- Migration state

Results written to tenant health history log. Failures surface in the tenant's go-live checklist.

#### Security policy controls

Per-tenant security policy overrides:
- **MFA enforcement**: require MFA for all users in a tenant
- **SSO strict mode**: block non-SSO tokens when tenant policy enforces SSO
- **Session freshness**: require re-auth after a configurable idle period
- **IP allowlist**: CIDR ranges — only traffic from listed IPs is allowed
- **Data retention**: configure how long audit logs and activity data are kept

Policy violations trigger guardrail audit events logged to the tenant's audit timeline.

---

## Operational Runbooks

### A church says their features are locked / they can't do anything

1. Open **Tenant inspector** (`/platform/subscriptions` → Tenant inspector tab)
2. Check subscription status — likely `PAST_DUE`, `CANCELED`, or `EXPIRED`
3. If it should be active: use **Tenant assignment** to manually set `ACTIVE` with reason "Support-corrected billing state"
4. If legitimately expired: direct them to `/billing` to re-subscribe

### A webhook failed and subscription state is wrong

1. Check `tenantAudit` (Tenants page → select tenant → audit log, filter action = `webhook`)
2. Use **Provider metadata** backfill to re-sync from Stripe/Paystack
3. If still wrong after backfill, use **Tenant assignment** to manually correct

### Dunning is not firing

1. Check that `INTEGRATION_API_KEY` is set and cron is registered (`POST /tasks/subscriptions/metadata-backfill`)
2. Manually trigger **Dunning** from the subscriptions page to verify the pipeline works
3. Check `CommunicationSchedule` table — dunning emails are queued there before delivery

### A tenant domain is stuck on PENDING

1. Ops page → Domain automation sweep (dry-run first to see what would happen)
2. If FAILED: check DNS records on the church's registrar match what FaithFlow expects
3. If escalated to a support ticket: resolve it from `/support` once DNS is correct and domain transitions to ACTIVE

### Tenant needs to be suspended immediately (ToS / fraud)

1. Go to `/platform/tenants`
2. Find the tenant, click **Suspend**
3. Enter a clear reason (written to audit log and shown to the tenant)
4. Notify the tenant via email through `/communications` with a template explaining next steps

---

## Environment Variables Relevant to Platform Ops

| Variable | Effect |
|----------|--------|
| `PLATFORM_ADMIN_EMAILS` | Comma-separated emails that automatically get platform-admin access |
| `INTEGRATION_API_KEY` | Required for all cron task endpoints |
| `DOMAIN_PENDING_ESCALATION_HOURS` | How long before a stuck domain auto-creates a support ticket (default: 24) |
| `DOMAIN_INCIDENT_AUTO_CLOSE` | Set `false` to require manual incident closure instead of auto-close |
| `AUTH_POLICY_ENFORCE_SSO_STRICT` | Hard-block non-SSO tokens when tenant SSO policy is active |

---

## Related Documentation

- Subscription system deep-dive: `docs/SUBSCRIPTION_SYSTEM.md`
- Third-party provider setup: `docs/THIRDPARTY_CONFIG.md`
- Beta go-live env checklist: `docs/ENV_CHECKLIST.md`
- Finance ops: `docs/FINANCE_MANUAL.md`
- Dispute playbook: `docs/DISPUTE_PLAYBOOK.md`
- Streaming provider config: `docs/STREAMING_MANUAL.md`
- Operational notes log: `docs/OPERATIONAL_NOTES.md`

---

*FaithFlow AI — Platform Admin Manual · Last updated March 2026*
*This document is internal. Do not share with church admins or the public.*
