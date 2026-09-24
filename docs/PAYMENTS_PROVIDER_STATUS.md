# Payments Provider Status

This document separates the provider roadmap from code that exists today.

| Provider | Intended use | Code status | Release status |
| --- | --- | --- | --- |
| Polar | ChurchTrack SaaS plans and subscriptions | Adapter implemented: hosted checkout, customer portal, signed/idempotent lifecycle webhook, refresh, plan change, cancellation, and resume | Sandbox organization, Starter/Growth products, plan mappings, signed webhook, and least-privilege Neon credentials configured; authenticated lifecycle verification remains a release gate |
| Paystack | Ghana/African checkout, giving, recurring payments, and settlement workflows | Implemented | First-production priority; provider onboarding and live end-to-end verification remain |
| Stripe | Future USD/international checkout, billing portal, giving, payouts, and disputes | Adapter retained; new self-serve subscription checkout defaults off | Activation deferred until US LLC and Stripe account setup are complete |
| Resend | Transactional and contact-form email | Implemented | `susubiribi.com` verified and ChurchTrack staging sender deployed; live template delivery tests remain |

## Integration boundary

Provider-specific API calls and webhook parsing belong in adapters. The following behavior remains in ChurchTrack's server-side domain layer:

- pricing and plan identifiers;
- subscription and entitlement state;
- tenant access decisions;
- signed and idempotent webhook processing;
- reconciliation and audit records;
- retry and failure handling.

A provider should be replaceable without rewriting church onboarding, permissions, or feature-access logic. Provider onboarding, KYC approval, live keys, and a successful sandbox test are separate release gates; their existence in documentation or code does not prove production readiness.

Starter and Growth onboarding currently offers Polar and Paystack. Stripe is hidden from new subscription choices and the API rejects new Stripe subscription checkout unless `STRIPE_BILLING_ENABLED=true` is explicitly set after setup and verification. Existing Stripe subscription management code remains for future activation.

## Polar configuration contract

- `POLAR_ACCESS_TOKEN`: sandbox organization token during staging.
- `POLAR_WEBHOOK_SECRET`: signing secret for `POST /webhooks/polar/platform`.
- `POLAR_SERVER`: `sandbox` for staging and `production` only after production approval.
- Each active `SubscriptionPlan.metadata` record must include its matching `polarProductId`.
- Subscribe the webhook to `subscription.created`, `subscription.updated`, `subscription.active`, `subscription.canceled`, `subscription.uncanceled`, `subscription.revoked`, and `subscription.past_due`.

### Current sandbox resources

| Resource | Polar ID | Configuration |
| --- | --- | --- |
| Organization `churchtrack` | `5f70fd30-2aa3-4c9c-9994-c6abf4727668` | Active sandbox organization |
| ChurchTrack Starter | `46305a55-da31-495f-98b0-e763a0ccc926` | USD 49/month, 14-day trial, private |
| ChurchTrack Growth | `9db3247e-2ecb-4deb-b6ee-d9887e790b47` | USD 149/month, 14-day trial, private |
| ChurchTrack Staging Subscriptions webhook | `41e4ae0e-91c6-472f-86f1-e80b7e8fef34` | Enabled; raw signed payloads to the Neon staging API |

The provider secret and organization token must remain in Neon environment storage. Do not copy them into this repository or provider-status documents.

Staging deployment 12 retains the token expiring on 2026-10-21 with only `checkouts:write`, `customer_sessions:write`, `subscriptions:read`, and `subscriptions:write`. An unused duplicate expiring on 2026-12-20 is awaiting approved revocation.

ChurchTrack stores the tenant ID as Polar's immutable external customer ID and copies `tenantId`, `clerkOrgId`, and `planCode` into checkout metadata. The webhook rejects conflicting tenant identifiers and grants access only through the local `TenantSubscription` and entitlement records.
