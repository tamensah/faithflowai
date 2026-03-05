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
  - [x] In-app cancel now updates local state immediately after successful disable
  - [x] Add manual provider-state refresh action in billing UI
  - [x] Add checkout reference verification fallback to activate subscription when webhook delivery is delayed
  - [x] Ensure webhook sync covers status transitions reliably
- [~] Entitlements polish:
  - [~] "What's locked" UI across admin modules
  - [x] Upgrade CTA with deep-link to `/billing`

Deliverables:
- Admin: `/billing` supports plan changes and trial visibility end-to-end
- Platform: clear policy for trials, conversion, dunning, and entitlements

---

## UX Guardrails for Remaining Work

- [~] Keep global navigation focused by active domain (single expanded group)
- [x] Keep contextual section sidebar sticky on long pages
- [~] Split new large surfaces into contextual sub-pages/tabs instead of single long forms
  - [x] Platform subscriptions page segmented into focused workspace tabs (plan editor, tenant assignment, dunning, metadata, catalog, snapshot)
  - [x] Billing page segmented into overview, plan-change, and invoices workspaces
  - [x] Communications page segmented into overview, compose, automation, and activity workspaces
  - [x] Finance page segmented into operations, giving ops, accounting, and settlements workspaces
- [ ] Require empty/loading/error states and consistent required/validation messaging on all new forms

Acceptance criteria:
- New feature pages must ship with contextual section navigation and focused, non-overloaded information architecture.
- Feature additions should follow the current admin layout system (hero summary, section cards, sticky context nav).

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
  - [x] Receipt resend / tithing statement notice
  - [x] Failed payment / past-due notices
- [ ] Messaging consent + compliance:
  - [x] Opt-in capture per channel (email/sms/whatsapp/push)
  - [x] Quiet hours per church + per member override
  - [x] Suppression list and unsubscribe flows
    - [x] Admin suppression summary (by channel/reason + recent user unsubscribes)
    - [x] STOP keyword unsubscribe for inbound Twilio SMS/WhatsApp webhooks
- [x] Campaign scheduling UX:
  - [x] Calendar view
  - [x] Draft -> review -> approve -> schedule workflow
  - [x] Delivery analytics improvements

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
  - [x] Human review UI (approve before sending comms)
  - [~] Safety filters for sensitive content

Deliverables:
- AI reduces work and is auditable; no “black box” decisions.
