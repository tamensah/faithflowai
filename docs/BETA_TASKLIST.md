# FaithFlow AI Beta Tasklist

This is the prioritized beta execution list. Goal: reduce onboarding friction, make billing reliable, and ship operationally resilient defaults.

Status legend:
- [ ] Not started
- [x] Done
- [~] In progress

---

## 1) Subscriptions + Billing Hardening

- [~] Admin plan change UX: upgrade/downgrade between tiers
- [ ] Define proration rules (beta-safe default: next-cycle effective + optional immediate upgrade)
- [ ] Add "effective next cycle" toggle + confirmation dialog (show impact)
- [ ] Trial conversion flow:
  - [x] Trial ending reminders (email + in-app banner)
  - [ ] Grace period policy (e.g., 3-7 days) with clear lockout behavior
  - [ ] Post-trial enforcement (read-only mode vs. suspend) per feature key
- [ ] Stripe:
  - [x] Customer Portal deep link in admin billing
  - [ ] Subscription cancel/resume UX (if portal disabled)
- [ ] Paystack:
  - [ ] Manage subscription guidance + cancel flow (provider-specific)
  - [ ] Ensure webhook sync covers status transitions reliably
- [ ] Entitlements polish:
  - [~] "What's locked" UI across admin modules
  - [ ] Upgrade CTA with deep-link to `/billing`

Deliverables:
- Admin: `/billing` supports plan changes and trial visibility end-to-end
- Platform: clear policy for trials, conversion, dunning, and entitlements

---

## 2) Operational Readiness (Reduce Support Load)

- [~] Admin health page: `/operations/health`
  - [x] DB connectivity + latency
  - [x] Webhook status (Stripe/Paystack/etc) + last event timestamps
  - [x] Email provider status (Resend) config check
  - [x] Storage provider config check
  - [x] Scheduler mode visibility (internal vs external)
  - [x] Payments config checks
  - [ ] Migration state visibility
  - [ ] Send test email
  - [ ] Upload test
- [ ] Tenant audit timeline improvements:
  - [ ] Filter by actor/action/target
  - [ ] CSV export
- [ ] "Go-live checklist" UI:
  - [ ] Reads current config health from API
  - [ ] Shows exact next steps per missing provider config

Deliverables:
- One place to diagnose “why it’s not working” without engineering intervention.

---

## 3) Communications Foundations (Activation + Retention)

- [ ] Resend transactional templates:
  - [ ] Welcome/onboarding
  - [ ] Trial ending reminders
  - [ ] Receipt resend / tithing statement notice
  - [ ] Failed payment / past-due notices
- [ ] Messaging consent + compliance:
  - [x] Opt-in capture per channel (email/sms/whatsapp/push)
  - [~] Quiet hours per church + per member override
  - [ ] Suppression list and unsubscribe flows
- [ ] Campaign scheduling UX:
  - [ ] Calendar view
  - [ ] Draft -> review -> approve -> schedule workflow
  - [ ] Delivery analytics improvements

Deliverables:
- Churches can send compliant comms and automate reminders.

---

## 4) Data Import (Adoption Unlock)

- [ ] CSV imports with mapping UI:
  - [ ] Members
  - [ ] Households
  - [ ] Donations
- [ ] Validation + preview:
  - [ ] Field mapping + required checks
  - [ ] Duplicate detection
  - [ ] Dry-run mode with summary
- [ ] Rollback strategy (batch id + revert)
- [ ] Migration assistant docs + templates:
  - [ ] Example CSV templates
  - [ ] Common ChMS export guidance

Deliverables:
- A church can migrate a real dataset safely.

---

## 5) AI Layer (Useful + Governed)

- [ ] Admin “Ask FaithFlow” assistant:
  - [ ] Tenant-scoped retrieval
  - [ ] Citations (source records + timestamps)
  - [ ] Role-based access and redaction
  - [ ] Prompt + output logging (audit)
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
