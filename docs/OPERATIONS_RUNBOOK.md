# FaithFlow Operations Runbook

Last updated: 2026-02-24

## Scope

Operational response for provider integrations (Stripe, Paystack, Resend, Twilio), outbox processing, and reconciliation workflows.

## 1) Webhook delivery failures

### Symptoms

- Provider Ops shows rising failed/dead-letter counts.
- Delivery outcome rows with `FAILED` status and provider errors.
- Provider dashboard shows retries/non-2xx responses.

### Triage flow

1. Open Provider Ops: `/dashboard/provider-ops`.
2. Identify failing provider and copy representative error from latest outcomes.
3. Check environment variables in `docs/THIRDPARTY_CONFIG.md`.
4. Validate provider webhook endpoint configuration (URL + subscribed events).
5. Use replay action on one failed event after fix.
6. If replay succeeds, run domain queue process (`Process now`) to drain backlog.

### Escalation threshold

- Escalate immediately if:
  - any payment provider webhook fails continuously for >15 minutes, or
  - dead-letter count grows for two consecutive checks.

## 2) Reconciliation drift (payments)

### Symptoms

- Provider marks successful charge, local payment remains pending/failed.
- Provider Ops shows processed webhook but payment state mismatch persists.

### Recovery steps

1. Verify webhook event reached `/api/webhooks/stripe` or `/api/webhooks/paystack`.
2. Confirm payment has provider reference (`reference` or metadata providerReference).
3. Re-run outbox process for payment domain:
   - `pnpm outbox:process -- --domain=PAYMENT --maxEvents=25`
4. Replay specific failed payment outbox event from Provider Ops.
5. Re-check payment record and audit trail.

## 3) Comms delivery issues

### Symptoms

- Message accepted by app but no provider message id.
- Twilio/Resend callbacks not reflected in delivery state.

### Recovery steps

1. Confirm provider credentials and webhook secrets.
2. Validate callback endpoint path:
   - `/api/webhooks/resend`
   - `/api/webhooks/twilio`
3. Replay failed comms outbox item from Provider Ops.
4. Confirm `_delivery` state updates in latest outcomes.

## 4) Standard verification commands

```bash
pnpm test:payment-comms-e2e
pnpm test:provider-webhooks-e2e
pnpm test:admin-health
pnpm test:platform-smoke
pnpm outbox:process -- --domain=PAYMENT --maxEvents=25
pnpm outbox:process -- --domain=COMMS --maxEvents=25
curl -sS -H "Authorization: Bearer $FAITHFLOW_HEALTHCHECK_TOKEN" https://admin-gamma-beryl.vercel.app/api/health/provider-ops
curl -sS -H "Authorization: Bearer $FAITHFLOW_HEALTHCHECK_TOKEN" https://admin-gamma-beryl.vercel.app/api/health/outbox-worker
curl -sS -H "Authorization: Bearer $FAITHFLOW_HEALTHCHECK_TOKEN" https://admin-gamma-beryl.vercel.app/api/health/api-core
curl -sS -H "Authorization: Bearer $FAITHFLOW_HEALTHCHECK_TOKEN" https://admin-gamma-beryl.vercel.app/api/health/reconciliation
```

### Health-check response interpretation

- `provider-ops`:
  - `status=ok`: provider ops baseline healthy.
  - `status=degraded`: missing strict provider config and/or backlog threshold breach.
- `outbox-worker`:
  - `status=ready`: worker backlog/activity within thresholds.
  - `status=degraded`: stale processable queue without fresh worker activity.
- `api-core`:
  - `status=ok`: DB + core auth config healthy.
  - `status=degraded/down`: DB unavailable or missing baseline auth envs.
- `reconciliation`:
  - `status=ok`: reconciliation queue within stale threshold.
  - `status=degraded/down`: stale or broken reconciliation processing path.

## 5) Incident record template

Capture for each incident:

- start time (UTC)
- affected provider(s)
- impact scope (orgs, payment/comms volume)
- root cause
- mitigation applied
- replay/drain completion time
- follow-up action items
