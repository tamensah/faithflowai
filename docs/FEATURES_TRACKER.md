# FaithFlow AI Feature Tracker

This is the live checklist for product scope, implementation status, and next steps.

## Done
- Multi‑tenant schema (tenant/org/church/campus)
- Clerk JWT auth + tenant resolution
- Auto‑create default Organization + Church on first tenant request
- Clerk org webhook provisioning (organization.created)
- Fastify API service + tRPC
- Admin app with:
  - Organization + Church setup
  - Members create/list/delete
  - Events create/list/delete
  - Realtime feed with attendance + donation events
- SSE realtime (tenant‑filtered)
- Initial Prisma migration + seed data
- Brand guide v1
- Giving foundation (funds + campaigns + donations)
- Stripe + Paystack checkout + webhook processing
- Finance ops foundation (pledges, recurring, budgets, expenses, receipts)
- Finance dashboards (reconciliation, donor insights, tithing statements)
- Shareable giving links + QR generator (admin)
- Stripe + Paystack recurring checkout
- Receipt HTML rendering + email send (Resend)
- Fundraiser (peer-to-peer) pages + public giving URLs
- Audit log foundations (finance + giving actions)
- Text-to-give inbound flow (Twilio)
- Payout reconciliation (Stripe + Paystack)
- Finance CSV exports
- Communications: outbound email/SMS/WhatsApp (templates + logs)
- Communications: audience targeting + delivery analytics
- Refunds + disputes (Stripe + Paystack + manual)
- OpenAPI external integration routes (API key secured)
- Dispute evidence workflows + admin upload
- Comms scheduling + drip campaigns
- AI donor insights (first wave)
- Refund analytics dashboard
- Dispute resolution playbook
- Payments: dispute monitoring automation
- Donation trends + forecasting
- Donor segmentation (new/active/lapsed/recurring)
- Membership foundation (profiles, households, groups, tags, milestones, volunteer roles)
- Onboarding workflows + directory privacy
- Group events scheduling + engagement metrics
- Membership engagement dashboard
- Member self-service portal
- Volunteer shift scheduling + reminders
- Surveys + feedback
- Membership UI polish (portal + admin)
- Volunteer scheduling dashboard
- Survey analytics dashboard
- Directory preview + privacy badges (admin)
- Staffing gaps dashboard + alerts
- Survey exports + AI summaries
- Member relationship graphs
- Event check-in flow (admin)
- Volunteer availability + scheduling inputs
- Member CSV import utilities
- In-app messaging + notifications
- Push notifications (FCM-ready)
- Event RSVP + recurring series
- Online membership registration + verification
- Check-in QR + kiosk mode
- Event ticketing + paid checkout
- Mobile check-in flow (camera + manual)
- Member analytics + segmentation
- File storage (S3/GCS) for attachments
- Event registrations + waitlist
- Event assignments (speakers/volunteers)
- Event media library (post-event sharing)
- Public event pages + calendar (iCal)
- Event badges + credentialing
- Event communications playbook
- Calendar add links (Google/Outlook)
- Platform tenant administration: list/search, suspend/activate, tenant audit timeline
- Tenant suspension enforcement across protected tenant APIs
- Subscription system foundation:
  - Plan catalog (starter/growth/enterprise)
  - Tenant subscription assignments + history
  - Entitlements resolution:
    - Active subscription -> plan features
    - No subscription history -> default plan fallback
    - Subscription history but no active subscription -> `inactive_subscription` (read-only lockout; no fallback)
  - Platform admin subscriptions UI
- Subscription system manual (`docs/SUBSCRIPTION_SYSTEM.md`)
- Subscription hardening + monetization ops:
  - Route-level entitlement enforcement across membership/events/finance/campus/facility/care/content
  - Stripe + Paystack subscription lifecycle webhook sync into `TenantSubscription`
  - Usage metering + quota/suspension automation task
  - Tenant self-serve billing routes (plan checkout, Stripe portal, invoices)
  - Dunning preview + run workflows (platform + scheduled endpoint)
  - Webhook idempotency + replay-safe event persistence (`WebhookEvent`)
  - Subscription metadata normalization backfill (platform + scheduled task)
- Billing lapse enforcement (Policy A):
  - Server-side: global mutation block in inactive-subscription mode (except `billing.*`)
  - Entitlements: read vs write gates (`ensureFeatureReadAccess` / `ensureFeatureWriteAccess`)
  - Admin UX: read-only banner + write actions disabled across modules
- Onboarding and catalog UX hardening:
  - Church onboarding flow (org selection, admin claim, plan checkout, admin landing)
  - Trial-aware tier UX (Starter/Growth 14-day, Enterprise 0-day default)
  - Baseline plan catalog auto-bootstrap in API when environments start without seeded plans
  - Onboarding plan preselect + checkout provider (Stripe/Paystack) continuity
- Multi-campus operations depth:
  - Campus CRUD with feature and quota enforcement
  - Headquarters and campus performance analytics APIs
  - Facility inventory, booking conflict checks, utilization analytics
  - Admin pages: `/operations`, `/facilities`
- Platform operations hardening:
  - Tenant domain management + verification/activation
  - Tenant health sweep + health history logging
  - Tenant security policy controls (MFA/SSO/session/retention)
  - Domain/SSL automation sweeps (DNS verification + SSL lifecycle state updates)
  - Admin page: `/platform/ops`
- Ministry + content systems:
  - Pastoral care requests, assignment, notes, status workflow, dashboard
  - Sermon and content resource library APIs + analytics
  - Admin pages: `/care`, `/content`
- Streaming + support center foundations:
  - Live stream channels/sessions lifecycle + analytics APIs
  - Support tickets + threaded messaging + platform assignment/status workflows
  - Support SLA timers + breach sweeps + queue analytics
  - Admin pages: `/streaming`, `/support`
- E2E reliability checks:
  - Webhook idempotency replay tests (platform Stripe + Paystack webhook paths)
  - Support SLA breach + transition tests (automation + route transitions)

## In Progress
- None

## Next Up (High Priority)
1. Revenue operations hardening
   - Complete plan upgrade/downgrade/interval transitions with guardrails and proration rules
   - Automated retries + escalation policies (email/SMS/WhatsApp) with suppression windows
2. Platform operations automation
   - Domain runbook states + incident escalation hooks
   - Security policy enforcement hooks (MFA/SSO/session controls in auth layer)
3. Streaming and support depth
   - Stream moderation controls + external provider sync jobs
   - Knowledge base integration and ticket deflection

## Backlog
- Prayer request lifecycle + privacy controls
- Gamification/engagement loops
- Live streaming + social media distribution workflows
- Church website/landing page builder + template marketplace
- Support center (ticketing, KB, SLA lanes)
- Native mobile apps (member + staff)
- Competitor data migration tooling

## Manuals (Reference)
- Finance: `docs/FINANCE_MANUAL.md`
- Membership: `docs/MEMBERSHIP_MANUAL.md`
- Events: `docs/EVENTS_MANUAL.md`
- Subscription system: `docs/SUBSCRIPTION_SYSTEM.md`
- Disputes: `docs/DISPUTE_PLAYBOOK.md`

## Notes
- All features must enforce tenant isolation and RBAC by default.
- AI outputs must be traceable with source attribution.
- Operational notes log: `docs/OPERATIONAL_NOTES.md`.
