# Payments Provider Status

This document separates the provider roadmap from code that exists today.

| Provider | Intended use | Code status | Release status |
| --- | --- | --- | --- |
| Polar | ChurchTrack SaaS plans and subscriptions | Adapter implemented: hosted checkout, customer portal, signed/idempotent lifecycle webhook, refresh, plan change, cancellation, and resume | Sandbox organization `churchtrack` created and OAuth authorized; recurring products, webhook, deployed secrets, and end-to-end checkout remain release gates |
| Paystack | Ghana/African checkout, giving, recurring payments, and settlement workflows | Implemented | First-production priority; provider onboarding and live end-to-end verification remain |
| Stripe | USD/international checkout, billing portal, giving, payouts, and disputes | Implemented | Retained; live activation deferred until US LLC and Stripe account setup are complete |
| Resend | Transactional and contact-form email | Implemented | Required; sending-domain verification and live delivery tests remain |

## Integration boundary

Provider-specific API calls and webhook parsing belong in adapters. The following behavior remains in ChurchTrack's server-side domain layer:

- pricing and plan identifiers;
- subscription and entitlement state;
- tenant access decisions;
- signed and idempotent webhook processing;
- reconciliation and audit records;
- retry and failure handling.

A provider should be replaceable without rewriting church onboarding, permissions, or feature-access logic. Provider onboarding, KYC approval, live keys, and a successful sandbox test are separate release gates; their existence in documentation or code does not prove production readiness.

## Polar configuration contract

- `POLAR_ACCESS_TOKEN`: sandbox organization token during staging.
- `POLAR_WEBHOOK_SECRET`: signing secret for `POST /webhooks/polar/platform`.
- `POLAR_SERVER`: `sandbox` for staging and `production` only after production approval.
- Each active `SubscriptionPlan.metadata` record must include its matching `polarProductId`.
- Subscribe the webhook to `subscription.created`, `subscription.updated`, `subscription.active`, `subscription.canceled`, `subscription.uncanceled`, `subscription.revoked`, and `subscription.past_due`.

ChurchTrack stores the tenant ID as Polar's immutable external customer ID and copies `tenantId`, `clerkOrgId`, and `planCode` into checkout metadata. The webhook rejects conflicting tenant identifiers and grants access only through the local `TenantSubscription` and entitlement records.
