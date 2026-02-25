# FaithFlow Third-Party Configuration

Last updated: 2026-02-24

This document is the source of truth for external provider setup and required environment variables for alpha/beta/prod readiness.

## 1) Deployment ownership

- `apps/admin` (Vercel): Clerk auth, Provider Ops, webhook ingestion, outbox processing, provider dispatch.
- `apps/web` (Vercel): public site + member portal.
- API runtime note: current provider dispatch runs through admin-hosted API routes that call shared routers.

## 2) Environment variables by provider

Use placeholders in code/docs, real secrets only in platform env settings.

### Core auth (Clerk)

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
CLERK_SECRET_KEY=YOUR_SECRET_KEY
```

### Stripe

```env
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Paystack

```env
PAYSTACK_SECRET_KEY=sk_live_xxx
PAYSTACK_SUPPORTED_CURRENCIES=NGN,GHS,ZAR,KES,USD
```

### Resend

```env
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=FaithFlow <no-reply@YOUR_DOMAIN>
RESEND_WEBHOOK_SECRET=whsec_xxx
```

### Twilio (SMS + WhatsApp)

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15551234567
TWILIO_WHATSAPP_NUMBER=whatsapp:+15551234567
```

### Outbox and webhook behavior

```env
FAITHFLOW_PROVIDER_STRICT_MODE=false
FAITHFLOW_OUTBOX_MAX_RETRIES=5
FAITHFLOW_OUTBOX_RETRY_DELAY_SECONDS=30
FAITHFLOW_OUTBOX_RETRY_BACKOFF_MULTIPLIER=2
FAITHFLOW_ALLOW_UNSIGNED_WEBHOOKS=false
FAITHFLOW_WEBHOOK_TOLERANCE_SECONDS=300
FAITHFLOW_HEALTHCHECK_TOKEN=YOUR_SHARED_HEALTHCHECK_TOKEN
FAITHFLOW_PROVIDER_OPS_STRICT_HEALTH=false
FAITHFLOW_PROVIDER_OPS_PROCESSABLE_THRESHOLD=500
FAITHFLOW_OUTBOX_STALE_SECONDS=900
FAITHFLOW_OUTBOX_ACTIVITY_GRACE_SECONDS=180
FAITHFLOW_RECONCILIATION_STALE_SECONDS=900
```

## 3) Provider-side webhook endpoints

Set these on your provider dashboards (production admin domain):

- `https://admin-gamma-beryl.vercel.app/api/webhooks/stripe`
- `https://admin-gamma-beryl.vercel.app/api/webhooks/paystack`
- `https://admin-gamma-beryl.vercel.app/api/webhooks/resend`
- `https://admin-gamma-beryl.vercel.app/api/webhooks/twilio`

### Stripe events to subscribe

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `charge.refunded`

Stripe metadata requirement for add-on auto-toggle:

- Include `addonCode` (or `addon_code`) on the payment object metadata (for example `STREAMING_SUITE`).
- When these events reconcile to `COMPLETED`, entitlement is enabled.
- When these events reconcile to `FAILED` or `REFUNDED`, entitlement is disabled.

### Paystack events to subscribe

- `charge.success`
- `charge.failed`
- `refund.processed` (and/or `refund.successful` if shown in dashboard)

Paystack metadata requirement for add-on auto-toggle:

- Include `addonCode` (or `addon_code`) in Paystack metadata/custom fields.
- `charge.success` enables entitlement; `charge.failed` and refund events disable entitlement.

### Resend events to subscribe

- Delivery/open/click events (success path)
- Bounce/complaint/failure events (failure path)

### Twilio callbacks

- Message status callbacks for `sent`, `delivered`, `read`, `failed`, `undelivered`

## 4) Runtime behavior expectations

- Signed-out requests to protected Provider Ops APIs return `401` by design.
- Webhook endpoints validate provider signatures.
- If provider secrets are missing, endpoints fail closed (5xx with explicit config error).
- Failed/undeliverable provider outcomes are moved to dead-letter state for controlled replay.

## 5) Go-live verification checklist

1. Add all required env vars in Vercel project settings (`admin` and `web` where applicable).
2. Configure webhook URLs/events on each provider dashboard.
3. Trigger provider test events and confirm visibility in `/dashboard/provider-ops`.
4. Run:
   - `pnpm test:payment-comms-e2e`
   - `pnpm test:provider-webhooks-e2e`
   - `pnpm outbox:process -- --domain=PAYMENT --maxEvents=25`
   - `pnpm outbox:process -- --domain=COMMS --maxEvents=25`
5. Confirm failed items can be replayed successfully from Provider Ops.

## 6) Current status snapshot

- Provider Ops page, queue processing, replay actions, and webhook handlers are implemented.
- Remaining blocker to full live provider verification is production env/provider dashboard setup.
- Monitoring endpoints are available for provider readiness and outbox worker readiness.

## 7) Monitoring endpoints (automation friendly)

Use a bearer token (`Authorization: Bearer $FAITHFLOW_HEALTHCHECK_TOKEN`) or `x-healthcheck-token`.

- `GET /api/health/provider-ops`
  - Returns provider configuration/readiness and queue pressure.
  - Returns `503` when strict config checks fail or processable backlog exceeds threshold.
- `GET /api/health/outbox-worker`
  - Returns per-domain worker readiness using stale backlog + activity lag thresholds.
  - Returns `503` when stale processable backlog indicates worker drift.
- `GET /api/health/api-core`
  - Returns API baseline health (DB connectivity + core auth env checks).
- `GET /api/health/reconciliation`
  - Returns reconciliation queue health for `payment.provider.reconciled` events.
  - Returns `503` when reconciliation backlog is stale beyond threshold.
