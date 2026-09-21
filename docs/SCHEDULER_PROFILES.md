# Scheduler Profiles

ChurchTrack uses Neon Function Triggers as the single scheduler in deployed environments. The schedules and handler paths live in `neon.ts`.

## Staging and production

| Job | UTC schedule | Trigger handler |
| --- | --- | --- |
| Support SLA sweep | `*/5 * * * *` | `/__triggers/support-sla` |
| Tenant operations automation | `*/15 * * * *` | `/__triggers/tenant-ops` |
| Subscription metadata backfill | `10 2 * * *` | `/__triggers/subscription-metadata` |
| Streaming provider sync | `*/10 * * * *` | `/__triggers/streaming-sync` |

Neon supplies `X-Neon-Trigger-Invocation-Id`. The function rejects public requests to these paths without that platform header.

Do not enable the internal scheduler or GitHub scheduled workflows while Neon triggers are enabled. Duplicate schedulers can repeat notifications and provider work even when database operations are idempotent.

## Local development

The standalone Fastify server can run its internal scheduler for local-only testing:

```env
ENABLE_INTERNAL_SCHEDULER=true
SCHEDULER_TIMEZONE=UTC
```

Keep `ENABLE_INTERNAL_SCHEDULER=false` in every Neon Function environment.

## Manual fallback

The three GitHub Actions workflows remain manual-only runbooks:

- `.github/workflows/support-sla-sweep.yml`
- `.github/workflows/tenant-ops-automate.yml`
- `.github/workflows/subscription-metadata-backfill.yml`

Use `workflow_dispatch` only during an incident or an explicitly reviewed backfill. They require `FAITHFLOW_API_BASE_URL` and `FAITHFLOW_INTEGRATION_API_KEY` in the `alpha-ops` GitHub environment.

## Verification

After applying `neon.ts`:

1. List the branch triggers and confirm all four are enabled.
2. Confirm their next run times match the UTC schedules above.
3. Query fresh Neon Function logs after at least one run.
4. Treat any `Scheduled trigger failed` record as a failed release gate.
5. Confirm `/ready` before investigating scheduler-specific code; it detects the wrong database and missing ChurchTrack schema.
