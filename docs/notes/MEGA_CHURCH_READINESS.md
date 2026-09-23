# Multi-site Church Readiness

## Purpose

Use an internal enterprise church scenario as a demanding reference case while designing a global product that also works for a single congregation:
- Headquarters + headquarters branch operations
- Regional structures with many branches
- Campus ministries with separate governance
- Zone/cell structures with member-led executives
- Multi-role leadership assignments across units
- Platform-level and church-level admin separation

Passing this scenario would demonstrate one demanding configuration; it would not by itself prove that every church structure or market is supported.

Reference detail: `docs/notes/MULTISITE_CHURCH_ENTERPRISE_REFERENCE.md`

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

## Current Status (verified 2026-09-23)

- The canonical schema has `Tenant → Organization → Church → Campus`; members and staff belong to a Church.
- There is **no** `OrgUnit`, parent-child region, `OrgUnitAlias`, `OrgUnitRollup`, or scoped unit-role assignment in the canonical schema or API. Earlier statements that these were implemented were stale and must not be used as release evidence.
- Church admins can create Churches as siblings under one Organization. This does not provide HQ or regional oversight over descendant branches.
- Payment, communication, audit, and member features must each be verified against their current routes and live provider configuration before making readiness claims; this document does not certify them.
- See `docs/CHURCH_STRUCTURE_REVIEW_2026-09-23.md` for the present model, global scope, and next hierarchy slice.

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
