# FaithFlow AI - Next 5 Workstreams (Beta)

This is the “move in order” execution list for beta readiness. Each workstream has clear acceptance criteria so we can ship without ambiguous gaps.

Legend:
- [ ] Not started
- [~] In progress
- [x] Done

---

## 1) Subscriptions + Billing Hardening

- [~] Stripe plan change (admin self-serve)
- [~] Paystack tier change (checkout + best-effort old subscription disable)
- [~] Trial -> grace -> lockout policy (server-side)
- [~] Cancel/resume flows (Stripe + Paystack cancel)
- [ ] “What’s locked” UX everywhere (pages + actions + empty states)

Acceptance criteria:
- Admin can upgrade/downgrade tiers with “effective next cycle” default and optional immediate Stripe upgrade.
- Paystack tier change starts checkout from admin and avoids double-billing (best-effort auto-disable).
- Trials: reminders send; after grace days, entitlements lock (without suspending tenant access to billing).
- Billing page shows current status, cancel/resume, invoices, and actionable next step when locked.

---

## 2) Operational Readiness (Reduce Support Load)

- [~] `/operations/health` checks (DB, migrations, providers, recent webhooks, subscription, job signals)
- [ ] Storage upload test (S3/GCS) + permissions diagnostics
- [ ] Tenant audit timeline filters + export
- [ ] Go-live checklist UI (clear next steps per provider)

Acceptance criteria:
- A staff/admin can diagnose “why isn’t X working” from a single page without engineering support.
- Health page can run real provider “smoke tests” (email + storage upload) and show results.

---

## 3) Communications Foundations (Activation + Retention)

- [~] Consent + quiet hours enforcement (server-side)
- [ ] Suppression list + unsubscribe flows (per channel)
- [ ] Transactional templates (welcome, trial ending, failed payment, receipts)
- [ ] Scheduling UX upgrades (draft/review/approve + analytics)

Acceptance criteria:
- No outbound SMS/WhatsApp/email is sent if the member opted out.
- Quiet hours are respected per tenant timezone, with a clear override story.
- Unsubscribes are durable and auditable.

---

## 4) Data Import (Adoption Unlock)

- [~] Members CSV import with batch tracking + rollback
- [ ] Households CSV import (mapping + preview + rollback)
- [ ] Donations CSV import (mapping + preview + rollback)
- [ ] Migration assistant docs + templates

Acceptance criteria:
- A church can migrate a real dataset safely and undo mistakes via batch rollback.

---

## 5) AI Layer (Useful + Governed)

- [ ] “Ask FaithFlow” admin assistant (tenant-scoped)
- [ ] Citations + prompt/output logging (audit)
- [ ] RBAC + redaction for sensitive fields
- [ ] Opinionated starter insights (giving/attendance/volunteers)

Acceptance criteria:
- AI outputs are tenant-scoped, attributable, and safe to use in staff workflows.

