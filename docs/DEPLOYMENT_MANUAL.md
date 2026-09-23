# ChurchTrack Deployment Manual

> Follow [`GITFLOW_WORKFLOW.md`](./GITFLOW_WORKFLOW.md): feature branches merge into `develop`, staging is verified, and only then does `develop` move to `main`.

This is the deployment source of truth for the Vercel + Neon topology.

## Hosting topology

| Surface | Staging | Production |
| --- | --- | --- |
| Marketing site + member portal (`apps/web`) | Vercel preview for `develop` | Vercel production from `main` |
| Church admin + platform operations (`apps/admin`) | Vercel preview for `develop` | Vercel production from `main` |
| Fastify API (`apps/api`) | Neon Function on the Neon `develop` branch | Neon Function on the Neon default branch |
| PostgreSQL | `faithflow_canonical` on Neon `develop` | `faithflow_canonical` on the Neon default branch |
| Scheduled jobs | Neon Function Triggers declared in `neon.ts` | Neon Function Triggers declared in `neon.ts` |

Clerk remains the identity provider. Resend handles email. Paystack and Polar are the priority payment providers for the first release; Stripe remains supported for later activation after the US LLC setup.

## Repository deployment contract

- `neon.ts` declares the API function, Node.js 24 runtime, and schedules.
- `apps/api/src/neon-function.ts` adapts web-standard Neon requests to Fastify and owns trigger-only routes.
- `apps/api/src/server.ts` remains the local/standalone Fastify entry point.
- `DATABASE_URL` must be the pooled connection string for the `faithflow_canonical` database. Do not accept the branch default database implicitly.
- Neon supplies the function runtime; Vercel supplies only the two Next.js applications.

The current staging API URL is:

`https://br-fragrant-salad-aukk1pvs-faithflowapi.compute.c-10.us-east-1.aws.neon.tech`

Use a custom API domain before public production launch. Provider webhooks must use the final stable domain.

## Required access

- GitHub repository `tamensah/faithflowai`
- Neon project `delicate-bird-01532427`
- Vercel projects `churchtrack-web` and `churchtrack-admin`
- The shared Clerk project used by both frontend applications and the API
- Resend, Paystack, Polar, and any enabled optional provider accounts

## Neon environment file

Keep the real file outside Git and restrict it to the operator account. Start from `.env.neon.example`.

Required for every API deployment:

- `DATABASE_URL`: pooled URL for `faithflow_canonical` on the target branch
- `ALLOWED_ORIGINS`: exact web and admin origins for the target environment
- `CLERK_SECRET_KEY`: must match the Clerk publishable key used by both frontends
- `NEXT_PUBLIC_WEB_URL`
- `NEXT_PUBLIC_ADMIN_URL`
- `RESEND_API_KEY`

Required before email release testing:

- `RESEND_FROM_EMAIL`: verified sender on the ChurchTrack sending domain

Staging currently uses `ChurchTrack <notifications@susubiribi.com>`. `susubiribi.com` is a verified interim transactional-email domain; the primary ChurchTrack public domain has not been purchased. After that domain is selected and purchased, verify it in Resend before changing the sender or publishing branded production URLs.

Use a dedicated sending-only Resend API key restricted to the configured sending domain. ChurchTrack staging uses the key named `faithflow-staging-sending`; do not reuse account-wide or other-product credentials.

Required when each integration is enabled:

- Clerk webhooks: `CLERK_WEBHOOK_SECRET`
- Paystack: `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `PLATFORM_PAYSTACK_WEBHOOK_SECRET`
- Polar: `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_SERVER`; each plan also needs `metadata.polarProductId`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PLATFORM_STRIPE_WEBHOOK_SECRET`
- Twilio, AI, storage, and streaming provider variables listed in [`ENV_CHECKLIST.md`](./ENV_CHECKLIST.md)

Never print or commit the environment file. When a provider key changes, deploy a complete reviewed environment file so a partial update does not remove another integration.

## Deploy staging API and triggers

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
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

The configuration creates these UTC schedules:

| Trigger | Schedule | Handler |
| --- | --- | --- |
| Support SLA sweep | every 5 minutes | `/__triggers/support-sla` |
| Tenant operations | every 15 minutes | `/__triggers/tenant-ops` |
| Subscription metadata backfill | daily at 02:10 | `/__triggers/subscription-metadata` |
| Streaming provider sync | every 10 minutes | `/__triggers/streaming-sync` |

Neon attaches `X-Neon-Trigger-Invocation-Id` to trigger requests. The API rejects direct public calls to these routes.

## Configure Vercel staging

Both Vercel projects must use the same Clerk project. For the `develop` preview environment set:

- `NEXT_PUBLIC_API_URL` to the Neon staging function URL
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to the shared Clerk project
- `CLERK_SECRET_KEY` to the matching shared Clerk secret
- `NEXT_PUBLIC_CLERK_JWT_TEMPLATE` if the shared Clerk project uses a custom template
- the application-specific sign-in, sign-up, and fallback URLs

Stable staging aliases:

- Web: `https://churchtrack-web-git-develop-tamensahs-projects.vercel.app`
- Admin: `https://churchtrack-admin-git-develop-tamensahs-projects.vercel.app`

Environment changes apply on the next Vercel deployment. Merge through `develop` or redeploy the current `develop` deployment after changing them.

## Database migrations

Use the direct connection string for Prisma migrations and the pooled string for application traffic.

```bash
DATABASE_URL_UNPOOLED='<direct faithflow_canonical URL>' pnpm db:migrate:status
DATABASE_URL_UNPOOLED='<direct faithflow_canonical URL>' pnpm db:migrate:deploy
```

Verify `/ready` after deployment. A 200 response confirms both database connectivity and the canonical ChurchTrack schema; `/health` verifies only that the function can serve requests.

## Provider webhooks

Register these routes only after the target API domain is stable:

- Clerk: `POST /webhooks/clerk`
- Paystack: `POST /webhooks/paystack`
- Paystack platform: `POST /webhooks/paystack/platform`
- Stripe: `POST /webhooks/stripe`
- Stripe platform: `POST /webhooks/stripe/platform`
- Twilio SMS: `POST /webhooks/twilio/sms`

See [`THIRDPARTY_CONFIG.md`](./THIRDPARTY_CONFIG.md) for events and signing secrets.

## Staging verification

1. `/health` returns 200.
2. `/ready` returns 200 with `database: ready`.
3. `/docs` returns 200.
4. A normal client call to `/__triggers/support-sla` returns 403.
5. Neon shows all four triggers enabled and recent scheduled invocations without application errors.
6. The web and admin `develop` aliases load and call the Neon API without CORS errors.
7. A new Clerk user creates or selects an organization and the first authenticated request provisions the tenant.
8. Member and church-admin journeys use the same Clerk organization context.
9. Resend sends from a verified ChurchTrack sender.
10. Paystack sandbox checkout and signed webhook replay pass. Add the equivalent Polar check when its adapter lands.

## Production promotion

Production is a separate reviewed action after staging sign-off:

1. Merge `develop` into `main` through a PR.
2. Create a fresh Neon restore branch or other reviewed recovery point.
3. Apply migrations to `faithflow_canonical` on the Neon default branch.
4. Apply `neon.ts` to the Neon default branch with the complete production environment file.
5. Set the Vercel production API URL and shared production Clerk configuration.
6. Deploy both Vercel projects from `main`.
7. Run the full verification list and inspect fresh Neon Function logs.

## Rollback

- Frontend: restore the previous Vercel deployment.
- API: redeploy the previous reviewed function source to the same Neon branch.
- Trigger: disable the affected Neon trigger while investigating; do not enable a second scheduler.
- Database: restore from a verified Neon branch or ship a reviewed forward migration. Do not improvise destructive SQL.
- Webhooks remain replay-safe through `WebhookEvent` idempotency.

## Current release gates

- A staging transactional email must be sent and confirmed from the verified interim sender; the eventual primary ChurchTrack domain must be purchased and verified before the sender is switched.
- Paystack secrets and signed webhook testing remain outstanding.
- The Polar adapter and its signed webhook path remain outstanding.
- Browser testing must confirm the unified Clerk organization flow on the redeployed `develop` aliases.
- SSE fan-out is process-local in the current implementation; validate a shared event transport before relying on multi-instance realtime delivery in production.
