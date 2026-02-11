# FaithFlow AI Operational Notes

This file is the running operations log for implementation details, runtime constraints, and production-readiness gaps.

## Usage

- Append new notes by date (`YYYY-MM-DD`) and feature area.
- Capture only operational facts, blockers, and actions.
- Keep this file current as systems evolve.

## Snapshot (2026-02-11)

### Deployment state (Render hybrid backend)

- Workspace: `tea-csuufv56l47c7382nnrg` (`My Workspace`)
- API service: `faithflow-api` (`srv-d66giolum26s738rsus0`)
- API URL: `https://faithflow-api.onrender.com`
- Postgres: `faithflow-postgres` (`dpg-d66gic14tr6s73alhg10-a`)
- Cron jobs:
  - `faithflow-support-sla-sweep` (`crn-d66giv24d50c738rcpv0`)
  - `faithflow-tenant-ops-automate` (`crn-d66givp4tr6s73alhuqg`)
  - `faithflow-subscription-metadata-backfill` (`crn-d66gj0ili9vc739t6mg0`)
- Latest deploy status check:
  - API deploy `dep-d66giotum26s738rsv6g`: `live` (`deploy_ended` -> `succeeded`)
  - Cron deploys: all `live`; manual trigger test runs completed `successful`
- Health and logs:
  - `GET /docs` on API URL returns `200`
  - Render error log query in first 30 minutes after deploy: `0` error logs

### Billing and subscriptions

- Tenant self-serve billing is implemented (`billing.*` router + `/billing` page).
- Stripe checkout + Stripe portal are supported for subscription self-serve.
- Paystack checkout is supported, but requires `paystackPlanCode` in `SubscriptionPlan.metadata`.
- Stripe billing portal requires a resolvable Stripe customer id from synced subscription metadata/webhook payloads.
- Dunning is implemented via:
  - `platform.dunningPreview`
  - `platform.runDunning`
  - `POST /tasks/subscriptions/dunning` (API key protected)
- Billing automation endpoint:
  - `POST /tasks/subscriptions/automate` (API key protected)
- Webhook idempotency persistence is implemented (`WebhookEvent` table + replay-safe handlers):
  - `/webhooks/stripe`
  - `/webhooks/paystack`
  - `/webhooks/stripe/platform`
  - `/webhooks/paystack/platform`
- Subscription metadata normalization/backfill is implemented:
  - `platform.subscriptionMetadataBackfill`
  - `POST /tasks/subscriptions/metadata-backfill` (API key protected)

### Platform ops

- Tenant domain records + status/SSL state are implemented.
- Automated DNS + SSL lifecycle checks are implemented:
  - `tenantOps.domainAutomationPreview`
  - `tenantOps.runDomainAutomation`
  - `POST /tasks/tenant-ops/automate` (API key protected)
- Health sweep is implemented and stores check history; current checks are synthetic/config-based plus DB ping.
- Tenant security policy is stored (`MFA`, `SSO`, session timeout, retention), but enforcement hooks are not fully wired into auth/session runtime.

### Streaming

- Live stream channels and sessions are implemented with status lifecycle and analytics.
- Current provider integration is metadata/config driven; external provider orchestration/sync jobs are not yet implemented.

### Support center

- Support tickets + threaded messaging are implemented for tenant and platform workflows.
- Assignment/status management exists for platform agents.
- SLA timers and analytics are implemented:
  - Ticket-level SLA fields (first response + resolution due/breach timestamps)
  - `support.slaAnalytics`, `support.slaBreaches`, `support.runSlaSweep`
  - `POST /tasks/support/sla` (API key protected)
- Knowledge base workflow is not yet implemented.

### Runtime jobs and env assumptions

- Scheduled tasks expected:
  - subscriptions automation
  - dunning
  - subscription metadata backfill
  - tenant domain/SSL automation
  - support SLA sweep
  - communications dispatch
  - disputes monitor
  - volunteer reminders
  - volunteer gap alerts
- All task endpoints requiring `INTEGRATION_API_KEY` should be invoked only by trusted scheduler/worker infrastructure.
- Optional internal scheduler is implemented in the API service (env gated via `ENABLE_INTERNAL_SCHEDULER`).
- Default internal cron expressions:
  - `CRON_SUPPORT_SLA_SWEEP=*/5 * * * *`
  - `CRON_TENANT_OPS_AUTOMATE=*/15 * * * *`
  - `CRON_SUBSCRIPTION_METADATA_BACKFILL=10 2 * * *`

### Verification coverage

- E2E tests added under `apps/api/test/e2e`:
  - `webhook-idempotency.test.ts`
  - `paystack-webhook-idempotency.test.ts`
  - `support-sla.test.ts`

## Outstanding Tasks (To Fully Sort Completed Feature Tracks)

### 1) Billing and revenue ops hardening

- [x] Add strict provider metadata normalization and backfill (`stripeCustomerId`, paystack customer reference fields).
- [ ] Complete plan change flows (upgrade/downgrade/interval change) with safe transition rules and audit trail.
- [ ] Add stronger invoice reconciliation mapping across providers and internal subscription state.
- [x] Add idempotency + replay-safe handling across billing webhooks and checkout finalization paths.

### 2) Billing communications and dunning depth

- [ ] Add multi-step retry policy (email, SMS/WhatsApp escalation) with suppression windows.
- [ ] Add tenant-level dunning preferences and quiet hours.
- [ ] Add dunning analytics dashboard (attempted, delivered, recovered, suspended).

### 3) Platform domain and SSL automation

- [x] Implement real DNS verification probes and scheduled re-checks.
- [x] Implement SSL lifecycle automation (provision, renew, expiry warnings, failover handling).
- [ ] Add domain runbook states and incident escalation hooks.

### 4) Security/compliance enforcement

- [ ] Enforce tenant security policy values in auth/session middleware and staff access gates.
- [ ] Add data retention jobs (soft-delete/archive/purge policies) tied to tenant policy.
- [ ] Add compliance audit views for policy drift and control violations.

### 5) Streaming depth

- [ ] Implement provider sync jobs (stream start/stop state sync, ingest health, recording ingestion).
- [ ] Add moderation controls and event-level moderation policy enforcement.
- [ ] Add post-stream analytics (watch-time, retention buckets, source attribution).

### 6) Support center depth

- [x] Add SLA timers, breach alerts, and queue health metrics.
- [x] Add support analytics (first response time, resolution time, reopen rate).
- [ ] Add KB linkage and ticket deflection workflow.

### 7) Cross-cutting quality and release readiness

- [ ] Add end-to-end tests for critical flows: billing checkout, webhook sync, dunning, tenant suspend/reactivate, ticket lifecycle.
- [ ] Add observability baselines: structured logs, error dashboards, latency/error SLOs per critical endpoint.
- [ ] Add release runbooks and rollback plans for billing, platform ops, streaming, and support modules.
