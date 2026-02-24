# FaithFlow Unified Execution Board

Last updated: 2026-02-23

This board consolidates the active backlog into one ordered sequence so implementation can run without context switching.

## Priority Order

### 1) Enterprise auth guardrails (P0, in progress)
**Goal:** Enforce admin-grade security checks in runtime auth (MFA, verified email, session age, domain allowlist) before privileged actions execute.

**Why first:** Everything else (payments, org ops, support tooling) depends on trusted actor context.

**Deliverables**
- Security policy evaluator in admin auth context.
- Privileged-role gating for policy checks.
- Clear failure reasons for policy violations.
- Settings visibility for active guardrails.

**Current implementation (this batch)**
- Added runtime guardrail enforcement in admin actor resolution.
- Added env-driven policy controls for MFA, verified email, session age, and domain allowlist.
- Added settings-page visibility for active policy values.
- Added organization-persisted security policy storage and update path.
- Enforced policy override from organization settings during actor resolution.

**Done when**
- Privileged users without required controls are blocked with actionable error messages.
- Guardrails are configurable via organization settings with env defaults as baseline.

---

### 2) Org operating model completion (P0)
**Goal:** Finish enterprise org flows for HQ/region/branch/campus/diaspora execution at scale.

**Deliverables**
- Org builder UX hardening (validation, pagination, clearer empty states).
- Cross-unit role assignment management with timeline editing.
- Audit viewer filtering and export.

**Current implementation (this batch)**
- Added role assignment timeline/status update mutation and API route support.
- Added assignment search/status/limit controls for higher-volume orgs.
- Added audit result filtering controls and CSV export action from admin UI.
- Moved assignment and audit list handling to server-driven pagination with cursor-based "Load more" UX.
- Expanded org smoke tests to validate assignment pagination/query, timeline updates, security policy persistence, and filtered audit reads.

**Done when**
- Winners-style hierarchy and leadership assignments can be managed end-to-end from admin UI.

---

### 3) Payment and comms production adapters (P0)
**Goal:** Move from framework-ready mutations to provider-backed production paths.

**Deliverables**
- Stripe/Paystack adapter wiring behind existing idempotent mutations.
- Comms dispatch provider routing (email/SMS/WhatsApp) with outbox processing.
- Retry and dead-letter visibility in admin ops screens.

**Current implementation (this batch)**
- Added a scoped outbox router with domain-level policy checks for payment/comms queues.
- Added admin outbox API (`/api/outbox`) with list/filter, retry, and dead-letter actions.
- Added shared queue UI panel to both Payments and Comms consoles for live retry/dead-letter operations.
- Added provider dispatch processor for Stripe/Paystack verification-refund paths and Resend/Twilio delivery paths.
- Added on-demand queue processing mutation (`outbox.process`) and admin trigger (`Process now`) for direct dashboard exercise.
- Added one-shot worker script for cron/job execution (`pnpm outbox:process`).
- Added provider webhook ingestion handlers (Stripe, Paystack, Resend, Twilio) with signature validation and reconciliation updates.
- Added a dedicated Provider Ops admin surface with webhook health, last delivery outcomes, and replay actions.
- Expanded payment/comms smoke script to validate dead-letter and retry behavior end-to-end.

**Done when**
- Real provider calls run through replay-safe mutation paths with observable delivery state.

---

### 4) Executive rollups and drill-down dashboards (P1)
**Goal:** Make HQ/regional leaders operational in <=3 clicks.

**Deliverables**
- Rollup cards by org unit scope.
- Trend surfaces for attendance/giving/leaders.
- Fast filters and server-side pagination.

**Current implementation (this batch)**
- Added executive overview rollups on `/dashboard` for members, giving trend, events, leadership, and readiness.
- Added drill-down quick actions from overview to members/events/payments/org surfaces.
- Added readiness checklist with direct action links for setup completion.
- Added org-unit scope filter (selected unit vs descendants) to executive rollups.
- Added scoped role-assignment filtering (org unit + descendants) with server-side pagination in Organization Builder.
- Added server-filtered Members and Events pages with org-unit scope controls and URL-driven pagination.

---

### 5) Lock-state parity and entitlement UX (P1)
**Goal:** Standardize locked-feature behavior across all modules.

**Deliverables**
- Action-level lock messaging.
- Next-step CTA links to plan/enablement flows.
- Empty-state guidance tied to permissions and plan.

---

### 6) Operability hardening (P1)
**Goal:** Increase deployment confidence and incident response speed.

**Deliverables**
- Health checks for API, outbox workers, and reconciliation jobs.
- Runbooks for failed webhooks, reconciliation drift, and support escalation.
- Smoke scripts expanded for auth + org + payment + comms.

**Current implementation (this batch)**
- Added third-party provider setup matrix and env checklist (`docs/THIRDPARTY_CONFIG.md`).
- Added operational incident runbook for webhook failures, reconciliation drift, and comms recovery (`docs/OPERATIONS_RUNBOOK.md`).
- Added explicit monitoring endpoints for provider readiness and outbox worker readiness:
  - `/api/health/provider-ops`
  - `/api/health/outbox-worker`

---

### 7) AI intelligence packs (P2)
**Goal:** Add high-value decision support after operational core is stable.

**Deliverables**
- Attendance-drop and giving-risk signals.
- Care-routing suggestions with audit-safe attribution.
- Explainable insight cards in admin.

---

### 8) Add-on framework (P2)
**Goal:** Launch entitlement-driven expansion modules (streaming, bible school, facilities).

**Deliverables**
- Add-on catalog and tenant entitlement binding.
- Module-level route and action gating.
- Billing linkage for add-ons.
