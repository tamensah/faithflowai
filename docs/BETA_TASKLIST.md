# FaithFlow AI Beta Tasklist

This is the prioritized beta execution list. Goal: reduce onboarding friction, make billing reliable, and ship operationally resilient defaults.

Status legend:
- [ ] Not started
- [x] Done
- [~] In progress

---

## 1) Subscriptions + Billing Hardening

- [~] Admin plan change UX: upgrade/downgrade between tiers
  - [x] Stripe: schedule next-cycle plan changes + immediate upgrades
  - [~] Paystack: start plan-change checkout + best-effort prevent double billing
- [x] Define proration rules (beta-safe default: next-cycle effective + optional immediate Stripe upgrade)
- [x] Add "effective next cycle" toggle + confirmation dialog (show impact)
- [x] Trial conversion flow:
  - [x] Trial ending reminders (email + in-app banner)
  - [x] Grace period policy (configurable) with clear lockout behavior (no tenant suspension)
  - [x] Post-trial enforcement (read-only mode: view/export allowed; writes blocked; billing accessible)
- [ ] Stripe:
  - [x] Customer Portal deep link in admin billing
  - [x] Subscription cancel/resume UX (in-app)
- [ ] Paystack:
  - [~] Manage subscription guidance + cancel flow (provider-specific)
  - [~] Ensure webhook sync covers status transitions reliably
- [~] Entitlements polish:
  - [~] "What's locked" UI across admin modules
  - [x] Upgrade CTA with deep-link to `/billing`

Deliverables:
- Admin: `/billing` supports plan changes and trial visibility end-to-end
- Platform: clear policy for trials, conversion, dunning, and entitlements

---

## 2) Operational Readiness (Reduce Support Load)

- [x] Admin health page: `/operations/health`
  - [x] DB connectivity + latency
  - [x] Webhook status (Stripe/Paystack/etc) + last event timestamps
  - [x] Email provider status (Resend) config check
  - [x] Storage provider config check
  - [x] Scheduler mode visibility (internal vs external)
  - [x] Payments config checks
  - [x] Migration state visibility
  - [x] Send test email
  - [x] Upload test
- [x] Tenant audit timeline improvements:
  - [x] Filter by actor/action/target
  - [x] CSV export
- [x] "Go-live checklist" UI:
  - [x] Reads current config health from API
  - [x] Shows exact next steps per missing provider config

Deliverables:
- One place to diagnose “why it’s not working” without engineering intervention.

---

## 3) Communications Foundations (Activation + Retention)

- [ ] Resend transactional templates:
  - [~] Welcome/onboarding
  - [~] Trial ending reminders
  - [ ] Receipt resend / tithing statement notice
  - [ ] Failed payment / past-due notices
- [ ] Messaging consent + compliance:
  - [x] Opt-in capture per channel (email/sms/whatsapp/push)
  - [x] Quiet hours per church + per member override
  - [~] Suppression list and unsubscribe flows
- [ ] Campaign scheduling UX:
  - [ ] Calendar view
  - [x] Draft -> review -> approve -> schedule workflow
  - [ ] Delivery analytics improvements

Deliverables:
- Churches can send compliant comms and automate reminders.

---

## 4) Data Import (Adoption Unlock)

- [ ] CSV imports with mapping UI:
  - [x] Members
  - [~] Households
  - [~] Donations
- [ ] Validation + preview:
  - [x] Field mapping + required checks (header aliases)
  - [x] Duplicate detection (email/phone)
  - [x] Dry-run mode with summary
- [x] Rollback strategy (batch id + revert updates)
- [x] Rollback strategy (batch id + delete created members)
- [ ] Migration assistant docs + templates:
  - [x] Example CSV templates
  - [~] Common ChMS export guidance

Deliverables:
- A church can migrate a real dataset safely.

---

## 5) AI Layer (Useful + Governed)

- [~] Admin “Ask FaithFlow” assistant:
  - [x] Tenant-scoped retrieval
  - [x] Citations (source records + timestamps)
  - [~] Role-based access and redaction
  - [x] Prompt + output logging (audit)
- [ ] AI summaries:
  - [ ] Attendance trends
  - [ ] Giving anomalies
  - [ ] Lapsed donor watchlist
  - [ ] Volunteer gap summaries
- [ ] Guardrails:
  - [ ] Human review UI (approve before sending comms)
  - [ ] Safety filters for sensitive content

Deliverables:
- AI reduces work and is auditable; no “black box” decisions.
