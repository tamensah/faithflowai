# Payments Provider Status

This document separates the provider roadmap from code that exists today.

| Provider | Intended use | Code status | Release status |
| --- | --- | --- | --- |
| Polar | ChurchTrack SaaS plans and subscriptions | Adapter implemented: hosted checkout, customer portal, signed/idempotent lifecycle webhook, refresh, plan change, cancellation, and resume | Sandbox organization, Starter/Growth products, plan mappings, signed webhook, and least-privilege Neon credentials configured; authenticated lifecycle verification remains a release gate |
| Paystack | GHS giving and other local payments; possible later subscription option | Giving adapter exists; legacy subscription paths are disabled for new self-serve billing | QRVIBE account ownership/KYC, Ghana payment verification, and ChurchTrack fit remain; no ChurchTrack subscription plans should be sold through Paystack yet |
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

Starter and Growth self-serve subscriptions use Polar. Paystack and Stripe are hidden from new subscription choices. The API rejects new Paystack subscription checkout and checkout verification unless `PAYSTACK_BILLING_ENABLED=true`; it rejects new Stripe checkout unless `STRIPE_BILLING_ENABLED=true`. Both flags default to `false`. Do not enable Paystack merely because test keys or recurring plan codes exist: the existing plan-code checkout would charge immediately and cannot honor the advertised 14-day trial. Paystack donation/giving flows are separate from this subscription decision.

### Why ManuTrack's Paystack setup does not transfer directly

ManuTrack used fixed GHS recurring plan amounts in Paystack and treated USD marketing prices as reference values. Its checkout used GHS pesewas and card-only recurring payment; its application stored the plan codes and reconciled verified payments and signed webhooks. ChurchTrack has USD 49/month Starter and USD 149/month Growth products in Polar, but no approved fixed GHS prices or corresponding Paystack plans. Copying ManuTrack's prices or converting the ChurchTrack USD price at each checkout would create a different subscription price and renewal contract from the one currently shown to customers.

Paystack's subscription-plan checkout charges the plan amount immediately. Paystack has no native 14-day subscription trial; its documented workaround requires a disclosed small card-tokenization charge, transaction verification, and subscription creation after the trial. ChurchTrack has not implemented that sequence. The `paystackTrialPlanCode` and `trialDays` metadata in the older adapter do not defer a charge. The API therefore also refuses Paystack checkout when a plan has trial days, even if the billing flag is enabled.

If we later choose Paystack subscriptions, first agree on stable GHS prices and a pricing-review policy; implement and test the trial/tokenization or an explicitly disclosed pay-now flow; create and map GHS recurring plans for each offered billing cycle; restrict recurring checkout to cards; verify tenant, plan, amount, currency, and subscription identity before granting entitlements; then test signed webhooks, renewals, cancellation, refunds, and reconciliation. Creating a QRVIBE Paystack organization is discovery, not proof that it is approved to sell ChurchTrack or pay out. The ManuTrack `paystack-dashboard-manual-setup.md`, `paystack-integration.md`, `paystack-saas-subscriptions-playbook.md`, and `paystack-go-live-checklist.md` are historical setup references, not ChurchTrack pricing.

Provider references: [Paystack subscriptions](https://paystack.com/docs/payments/subscriptions/), [Paystack free-trial workaround](https://support.paystack.com/en/articles/2125186), [Paystack currency support](https://paystack.com/docs/api/), and [Polar supported countries](https://docs.polar.sh/documentation/polar-as-merchant-of-record/supported-countries). Polar lists Ghana for payouts and supports customer payments globally except sanctioned countries; activation and first-payout verification remain separate gates.

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
