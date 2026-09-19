# Payments Provider Status

This document separates the provider roadmap from code that exists today.

| Provider | Intended use | Code status | Release status |
| --- | --- | --- | --- |
| Polar | FaithFlow SaaS plans and subscriptions | Planned adapter; not implemented in this baseline | Required before first production release |
| Paystack | Ghana/African checkout, giving, recurring payments, and settlement workflows | Implemented | First-production priority; provider onboarding and live end-to-end verification remain |
| Stripe | USD/international checkout, billing portal, giving, payouts, and disputes | Implemented | Retained; live activation deferred until US LLC and Stripe account setup are complete |
| Resend | Transactional and contact-form email | Implemented | Required; sending-domain verification and live delivery tests remain |

## Integration boundary

Provider-specific API calls and webhook parsing belong in adapters. The following behavior remains in FaithFlow's server-side domain layer:

- pricing and plan identifiers;
- subscription and entitlement state;
- tenant access decisions;
- signed and idempotent webhook processing;
- reconciliation and audit records;
- retry and failure handling.

A provider should be replaceable without rewriting church onboarding, permissions, or feature-access logic. Provider onboarding, KYC approval, live keys, and a successful sandbox test are separate release gates; their existence in documentation or code does not prove production readiness.
