# Winners Chapel Ghana Enterprise Reference Model

## Why this matters

Winners Chapel Ghana is a strong stress test for FaithFlow because it combines:
- National HQ + HQ branch overlap
- Multi-region / multi-branch structure
- Campus ministries with distinct governance
- Zone/cell layer with member-led executives
- Members holding multiple roles across different units

If FaithFlow can model this cleanly, we can reliably serve small churches through mega multi-campus ministries.

## Product decisions to adopt now

1. **Org unit graph as the core abstraction**
   - Use one `org_units` model with `type`, `parent_unit_id`, `tenant_id`, `metadata`.
   - Support unit types: `HEADQUARTERS`, `REGION`, `BRANCH`, `CAMPUS`, `ZONE`, `DEPARTMENT`, `MINISTRY`.
   - Add tenant-level aliases (example: branch displayed as campus).

2. **Scoped role assignments (not global user roles)**
   - Store role assignments as `(member_id, role_id, org_unit_id, start_at, end_at, status)`.
   - Allow concurrent multi-role assignments across different units.

3. **Two explicit admin control planes**
   - Platform admin: tenant lifecycle, billing, support, audit.
   - Church admin: structure setup, members, operations, finance, comms, events.

4. **Executive drill-down dashboards**
   - GO/HQ view -> region -> branch/campus in <= 3 clicks.
   - Key cards: attendance trends, giving trends, active leaders, risk flags.

5. **AI as operations intelligence**
   - Attendance drop alerts
   - Giving shortfall prediction
   - Volunteer load risk
   - Prayer/care signal classification

## Resilience requirements for mega-church scale

- Strict tenant scoping on every read/write path.
- Immutable audit logs for finance, permissions, impersonation, plan changes.
- Idempotency keys for payment and webhook mutations.
- Outbox/event processor for all external side effects.
- Read models for large hierarchy dashboards.
- Background jobs for analytics and AI enrichment.

## Gaps to close in implementation order

### Phase 1 (Foundation hardening)
- Ship `org_units` hierarchy with aliasing and parent-child validation.
- Ship scoped role assignment tables and policy checks.
- Add audit events for every privileged state change.

### Phase 2 (Operational scale)
- Add hierarchy read models/materialized aggregates.
- Add GO/HQ/Region dashboards with drill-down.
- Add high-volume pagination, server-side filters, and index tuning.

### Phase 3 (Intelligence + expansion)
- Add AI ops signals for attendance/giving/care.
- Add add-on entitlement framework (Bible school, streaming, facilities).
- Add regional benchmark and multi-campus comparison insights.

## Acceptance checklist (enterprise ready)

- Can represent HQ + HQ branch + regions + branches + campuses + zones simultaneously.
- A member can hold multiple live leadership assignments in different units.
- Leader can drill from national to unit-level metrics in <= 3 clicks.
- Audit trail exists for all sensitive writes.
- Payment/comms flows are replay-safe and idempotent.
- Tenant terminology customization works without code changes.

## Immediate backlog candidates

1. Add `org_units` + `role_assignments` migrations and seed examples for Winners-style hierarchy.
2. Add policy engine checks by `(actor, action, unit_scope)`.
3. Add GO dashboard endpoint returning hierarchy rollups.
4. Add alias configuration UI in church settings.
5. Add cross-unit assignment UI for coordinators and executives.
