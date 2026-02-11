# Scheduler Profiles

FaithFlow supports three operational jobs for the platform hardening track:

- Support SLA sweep: every 5 minutes
- Tenant domain/SSL automation: every 15 minutes
- Subscription metadata backfill: daily at 02:10 UTC

## Preferred production pattern

Use an external scheduler (GitHub Actions or Render Cron). This keeps scheduling single-writer and avoids duplicate runs in multi-instance API deployments.

## Option A: GitHub Actions

Workflows included:

- `.github/workflows/support-sla-sweep.yml`
- `.github/workflows/tenant-ops-automate.yml`
- `.github/workflows/subscription-metadata-backfill.yml`

Required repository secrets:

- `FAITHFLOW_API_BASE_URL` (example: `https://api.faithflow.ai`)
- `FAITHFLOW_INTEGRATION_API_KEY`

## Option B: Render Blueprint (API + Cron)

Blueprint included:

- `render.yaml`

This blueprint provisions:

- API web service (`faithflow-api`)
- Postgres database (`faithflow-postgres`)
- Cron jobs for support SLA, tenant ops automation, and subscription metadata backfill

Set service env vars/secrets in Render for the API and cron services after sync.

## Option C: Render Cron only

Blueprint included:

- `render.cron.yaml`

Create Render cron services from that blueprint and set service env vars:

- `API_BASE_URL`
- `INTEGRATION_API_KEY`

## Option D: Internal scheduler (single-instance only)

The API server includes an internal scheduler, env-gated:

- `ENABLE_INTERNAL_SCHEDULER=true`
- `SCHEDULER_TIMEZONE=UTC`
- `CRON_SUPPORT_SLA_SWEEP=*/5 * * * *`
- `CRON_TENANT_OPS_AUTOMATE=*/15 * * * *`
- `CRON_SUBSCRIPTION_METADATA_BACKFILL=10 2 * * *`

Use this only when exactly one API process is guaranteed.
