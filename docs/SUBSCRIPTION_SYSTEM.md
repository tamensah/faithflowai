# FaithFlow Subscription System

This document defines the SaaS subscription control plane for FaithFlow AI: plan catalog, tenant subscriptions, and feature entitlements.

## Goals

- Support pricing tiers from small churches to multi-campus/diaspora organizations.
- Keep enforcement server-side and auditable.
- Allow manual platform assignment first, then provider-synced lifecycle (Stripe/Paystack) without schema redesign.

## Data Model

Primary models in Prisma:

- `SubscriptionPlan`
  - Unique `code` (for example `starter`, `growth`, `enterprise`)
  - Commercial fields: `currency`, `interval`, `amountMinor`, `isActive`, `isDefault`
  - Product metadata: `description`, `metadata`
- `SubscriptionPlanFeature`
  - Per-plan feature key/value gates (`key`, `enabled`, `limit`)
  - Example keys: `max_members`, `max_campuses`, `ai_insights`
- `TenantSubscription`
  - Tenant assignment history with lifecycle state
  - Billing/provider fields: `provider`, `providerRef`
  - Cycle fields: `startsAt`, `currentPeriodStart`, `currentPeriodEnd`, `trialEndsAt`
  - Operational fields: `seatCount`, `cancelAtPeriodEnd`, `metadata`

Enums:

- `BillingInterval`: `MONTHLY`, `YEARLY`, `CUSTOM`
- `TenantSubscriptionStatus`: `TRIALING`, `ACTIVE`, `PAST_DUE`, `PAUSED`, `CANCELED`, `EXPIRED`
- `SubscriptionProvider`: `MANUAL`, `STRIPE`, `PAYSTACK`

## Platform API Surface

Implemented under `platform` router:

- `platform.listPlans({ includeInactive? })`
- `platform.upsertPlan(input)`
- `platform.assignTenantPlan(input)`
- `platform.tenantSubscription({ tenantId })`
- `platform.tenantEntitlements({ tenantId })`
- `platform.listTenants(...)` now includes `currentSubscription` summary

Access roles:

- Plan and assignment mutations require one of:
  - `SUPER_ADMIN`
  - `PLATFORM_ADMIN`
  - `BILLING_ADMIN`
  - `OPERATIONS_MANAGER` (assignment only)

## Admin UI

Implemented page:

- `/platform/subscriptions`
  - Plan create/update
  - Feature matrix input
  - Tenant plan assignment
  - Plan catalog overview
  - Tenant subscription snapshot

Related pages:

- `/platform/tenants` now shows active subscription summary
- `/platform` links to both tenants and subscriptions
- `/billing` provides tenant self-serve checkout/portal/invoice access

## Entitlement Strategy

Current source of truth:

1. Latest active/trialing/past_due/paused `TenantSubscription`
2. Fallback to active default `SubscriptionPlan`

`platform.tenantEntitlements` returns resolved entitlements map:

- `enabled` boolean
- `limit` optional numeric cap
- source plan code

Implemented enforcement pattern for protected feature routes:

1. Resolve tenant id from auth context.
2. Load entitlements for tenant.
3. Reject or cap operations based on feature key.
4. Record audit events for denied writes.

Applied modules:

- Membership (`membership_enabled`, `max_members`)
- Events (`events_enabled`, `max_events_monthly`)
- Finance (`finance_enabled`, `max_expenses_monthly`)
- Campus/facility (`multi_campus_enabled`, `facility_management_enabled`)
- Care/content (`pastoral_care_enabled`, `content_library_enabled`)

## Provider Sync (Stripe + Paystack)

Schema already supports provider linkage through:

- `TenantSubscription.provider`
- `TenantSubscription.providerRef`

Recommended sync events:

- Stripe:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
  - `invoice.paid`
- Paystack:
  - `subscription.create`
  - `subscription.disable`
  - `charge.success` (for period renewal tracking)

Implemented webhook handlers now upsert/update `TenantSubscription` status and period dates:

- `handlePlatformStripeWebhook(...)`
- `handlePlatformPaystackWebhook(...)`

Mapped API endpoints:

- `POST /webhooks/stripe/platform`
- `POST /webhooks/paystack/platform`

Required env placeholders:

- `PLATFORM_STRIPE_WEBHOOK_SECRET`
- `PLATFORM_PAYSTACK_WEBHOOK_SECRET`

## Usage Metering + Automation

Implemented service:

- `runSubscriptionAutomation(...)`

Current automation behavior:

- Quota checks for `max_members`, `max_campuses`, `max_events_monthly`, `max_expenses_monthly`
- Audit log creation for overages
- Auto-suspend tenant after configured past-due grace period

Mapped endpoint:

- `POST /tasks/subscriptions/automate`
- `POST /tasks/subscriptions/dunning`

## Self-Serve Billing Endpoints

Implemented tenant routes:

- `billing.plans`
- `billing.currentSubscription`
- `billing.startCheckout`
- `billing.createPortalSession` (Stripe)
- `billing.invoices` (Stripe/Paystack customer history)

Platform billing ops routes:

- `platform.dunningPreview`
- `platform.runDunning`

## Seeded Defaults

Seed creates plans and starter assignment for demo tenant:

- `starter` (default)
- `growth`
- `enterprise`

Default feature keys seeded:

- `max_members`
- `max_campuses`
- `ai_insights`

## Alpha Readiness Checklist

- [x] Plan catalog and feature definitions
- [x] Tenant assignment workflow (manual)
- [x] Subscription visibility in platform tenants/admin
- [x] Entitlement resolution API
- [x] Route-level entitlement enforcement in product modules
- [x] Stripe/Paystack subscription lifecycle sync
- [x] Usage metering + quota alerts + suspension automation
- [ ] Billing portal/self-serve plan change UX
