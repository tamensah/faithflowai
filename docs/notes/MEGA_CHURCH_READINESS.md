# Mega Church Readiness (Winners Chapel Ghana Perspective)

## Purpose

Use a real enterprise church model (Winners Chapel Ghana) as a hard reference to ensure FaithFlow can support:
- Headquarters + headquarters branch operations
- Regional structures with many branches
- Campus ministries with separate governance
- Zone/cell structures with member-led executives
- Multi-role leadership assignments across units
- Platform-level and church-level admin separation

If FaithFlow can run this model cleanly, the platform can handle small-to-mega churches globally.

Reference detail: `/Users/tamensah/aihub/faithlow/docs/notes/WINNERS_GHANA_ENTERPRISE_REFERENCE.md`

## Canonical Operating Model to Adopt

### 1) Organizational Unit Graph (not hardcoded labels)
- Introduce a canonical `OrgUnit` with `type`, `parentUnitId`, `orgId`, `status`, `metadata`.
- Supported unit types: `HEADQUARTERS`, `BRANCH`, `CAMPUS`, `REGION`, `DIASPORA`, `ZONE`, `DEPARTMENT`, `MINISTRY`.
- Allow tenant terminology aliasing (e.g., branch called "campus", zone called "cell").

### 2) Scoped Roles and Positions
- Keep a role template catalog, but assignments must be scoped per unit.
- A single person can hold multiple positions across different units.
- Store assignments as `(memberId, roleId, orgUnitId, startAt, endAt, status)`.

### 3) Dual Control Planes
- **Platform admin console**: tenant lifecycle, billing, support, entitlements, system-wide audit.
- **Church admin console**: unit setup, members, staff, finance, comms, events, care.

### 4) Member Experience Contract
- Member portal should expose actions allowed by plan + permissions.
- Onboarding checklist should be actionable and completion-aware.
- Progress must persist server-side, not just local state.

## Resilience Foundations Required

### Data and Consistency
- PostgreSQL as source of truth with strict tenant scoping on all records.
- Outbox pattern for async integrations/webhooks (payments, comms, external systems).
- Idempotency keys on payment and workflow mutations.
- Immutable audit log for permission changes, financial operations, and impersonation.

### Performance
- Read-optimized aggregate tables for top dashboards (GO/regional/branch views).
- Caching layer for hierarchy lookups and dashboard cards.
- Background jobs for heavy analytics and AI summarization.

### Security
- Least-privilege policy checks by `(actor, action, unitScope)`.
- Strong org isolation and signed server-side audit attribution.
- 2FA support for high-privilege roles.

### Operability
- SLOs for API, webhook processing, and background jobs.
- Alerting for failed jobs, delayed webhooks, and payment reconciliation drift.
- Backup/restore drills with tenant-level recovery testing.

## Product Modules to Prioritize for Mega Readiness

1. **Org Structure Engine**
   - Dynamic unit types, parent-child management, leader assignments.
2. **Permission Matrix Engine**
   - Policy-based access by scope, role templates, delegations.
3. **Executive Dashboards**
   - HQ/Region/Branch/Campus drill-down cards and trend views.
4. **Finance Reliability**
   - Multi-provider support, reconciliation, disputes/refunds workflow.
5. **Comms and Care**
   - Role-targeted messaging, prayer/care routing, SLA tracking.
6. **Add-on Framework**
   - Bible school and streaming as entitlement-driven modules.

## Current Status (already aligned)

- Member onboarding "next steps" are now actionable and completion-aware.
- Member setup progress is now persisted server-side via Clerk metadata sync.
- Overview readiness reflects completion state instead of static placeholders.
- Org structure now includes `DIASPORA` as a first-class unit type.
- Scoped role assignment model is in place (`member + role + orgUnit + status + timeline`).
- Policy checks now gate org-unit and role-assignment mutations by `(actor, action, organization scope)`.
- Audit events now capture unit hierarchy and role assignment changes (success/denied/failed).
- Actor identity is now resolved server-side from JWT context (NextAuth token with Clerk/JWT claim fallback), not passed in mutation payloads.
- Idempotency persistence now protects org mutation retries (`IdempotencyKey` table + request fingerprint checks).
- Outbox events now capture org/role side effects for async processing (`OutboxEvent` table).
- Hierarchy read-model rollups now back executive drill-down cards (`OrgUnitRollup` + refresh endpoint).
- Org terminology aliasing is now writable in admin UI and enforced server-side (`OrgUnitAlias` upsert + validation).
- End-to-end org smoke coverage now validates idempotency, rollups, aliasing, and audit flow (`scripts/org-e2e-smoke.ts`).
- Payment mutations are now idempotent and outbox-backed (`payment.create/updateStatus/refund` in API router).
- Comms mutations are now idempotent and outbox-backed (`comms.createRoom/sendMessage/dispatch` in API router).
- Payment + comms smoke coverage now validates retries, audit, and outbox publishing (`scripts/payment-comms-e2e-smoke.ts`).

## Implementation Sequence (Recommended)

### Phase A (P0)
- OrgUnit graph schema + unit aliasing.
- Scoped role assignment schema.
- Authorization policy checks per unit scope.

### Phase B (P1)
- Executive hierarchy dashboards with regional drill-down.
- Audit log expansion for all sensitive writes.
- Outbox and idempotency hardening for payment/comms workflows.

### Phase C (P2)
- Cross-unit reporting packs (HQ, region, campus).
- AI intelligence packs (attendance drop, giving risk, care signals).
- Add-on module framework (Bible School, Streaming).

## Acceptance Criteria for "Mega-Church Ready"

- Can model HQ + HQ branch + regions + branches + campuses + zones simultaneously.
- Can assign one member to multiple leadership positions in different units.
- General overseer can drill from national to regional to branch metrics in <3 clicks.
- Audit trail exists for every role assignment and financial state transition.
- Payment and comms workflows are idempotent and replay-safe.
- Tenant terminology can be customized without code changes.
