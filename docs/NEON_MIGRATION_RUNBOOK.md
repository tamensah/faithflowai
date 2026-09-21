# Neon Migration Runbook

This runbook records the move of ChurchTrack's PostgreSQL database, Fastify API, and scheduled jobs to Neon. Vercel continues to host the two Next.js applications.

## Scope and evidence boundary

- The former host contained no production ChurchTrack data, so no customer-row copy is required.
- The canonical target database is `faithflow_canonical`.
- The canonical schema has 32 Prisma migrations and 97 application tables.
- The Neon `develop` branch is `br-fragrant-salad-aukk1pvs`.
- Staging is the only environment deployed during this migration. Production remains unchanged until a separate `develop → main` approval.

## Target architecture

```text
Vercel web + admin
        |
        v
Neon Function (Fastify adapter)
        |
        v
faithflow_canonical on the same Neon branch

Neon Function Triggers ──> protected scheduler handlers
```

Clerk, Resend, Paystack, Polar, Stripe, Twilio, AI providers, and storage remain independent integrations. Moving hosting to Neon does not require replacing these providers.

## Branch mapping

| Git branch | Vercel | Neon |
| --- | --- | --- |
| Feature branch | PR preview | no automatic persistent backend branch yet |
| `develop` | stable staging aliases | long-lived Neon `develop` branch |
| `main` | production | Neon default branch after approved promotion |

## Completed staging migration

1. Reconciled the feature work against `develop`.
2. Applied and verified all 32 migrations in `faithflow_canonical`.
3. Added the Neon Function adapter while preserving the standalone Fastify entry point.
4. Added a readiness probe that verifies the canonical ChurchTrack schema, not only network reachability.
5. Deployed the API on Node.js 24 to the Neon `develop` branch.
6. Declared and enabled four Neon Function Triggers from `neon.ts`.
7. Pointed the Vercel `develop` previews at the Neon staging API.
8. Aligned the web and admin `develop` previews to one Clerk project.
9. Removed the former-host blueprints and disabled duplicate GitHub schedules.

## Database URL rule

Neon Functions inject a branch-default `DATABASE_URL`. ChurchTrack must override it with the pooled URL for `faithflow_canonical`. The initial scheduler smoke caught this distinction: the function was connected, but application tables were missing from the branch-default database.

The release gate is:

```text
GET /ready → 200 and { "database": "ready" }
```

`/health` alone is insufficient because it does not access PostgreSQL.

## Deploy or update staging

Use the complete, protected environment file described in [`DEPLOYMENT_MANUAL.md`](./DEPLOYMENT_MANUAL.md):

```bash
pnpm exec neon config plan \
  --project-id delicate-bird-01532427 \
  --branch br-fragrant-salad-aukk1pvs \
  --env /secure/path/faithflow-neon-staging.env

pnpm exec neon config apply \
  --project-id delicate-bird-01532427 \
  --branch br-fragrant-salad-aukk1pvs \
  --env /secure/path/faithflow-neon-staging.env \
  --update-existing \
  --no-env-pull
```

Never accept a plan that points `DATABASE_URL` at a database other than `faithflow_canonical`.

## Verification

- `/health`, `/ready`, and `/docs` return 200.
- Public calls to `/__triggers/*` return 403.
- All four triggers are enabled.
- Fresh scheduled runs contain no `Scheduled trigger failed` entries.
- The web and admin staging origins receive the expected CORS headers.
- Both frontends use the same Clerk project.
- A new organization provisions its ChurchTrack tenant and initial organization hierarchy.
- The canonical database remains empty until deliberate staging onboarding creates records.

## Production promotion

1. Complete the remaining provider and browser release gates.
2. Create and verify a recovery point on the Neon default branch.
3. Apply schema migrations to `faithflow_canonical` on that branch.
4. Review the production environment file without displaying its values.
5. Apply `neon.ts` to the default branch.
6. Update Vercel production variables and deploy `main`.
7. Update Clerk and payment-provider webhooks to the stable production API domain.
8. Run the verification list with fresh production logs.

## Rollback

- Disable the affected trigger if a scheduled job is failing.
- Redeploy the previous reviewed function source for an API regression.
- Restore the previous Vercel deployment for a frontend regression.
- Use a Neon recovery branch or reviewed forward migration for database recovery.
- Do not reconnect ChurchTrack to the former host.
