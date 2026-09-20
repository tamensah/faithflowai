# FaithFlow Reconciliation Status — 2026-09-20

Status: **Neon staging backend deployed; frontend redeploy and end-to-end onboarding verification pending**

## Canonical source line

- Base: `origin/develop`
- Working branch: `codex/neon-staging-cutover`
- Promotion path: feature PR → `develop` staging → `main` production
- Production and `main` have not been changed.

## Staging architecture now deployed

- Web and member portal: Vercel project `faithflow-web`
- Church admin and platform operations: Vercel project `faithflow-admin`
- API: Neon Function `faithflowapi` on branch `br-fragrant-salad-aukk1pvs`
- Database: `faithflow_canonical` on the same Neon branch
- Scheduler: four Neon Function Triggers declared in `neon.ts`
- Identity: one shared staging Clerk project across web, admin, and API
- Email provider: Resend API key present; verified sender is still missing

Staging API:

`https://br-fragrant-salad-aukk1pvs-faithflowapi.compute.c-10.us-east-1.aws.neon.tech`

## Verified evidence

- Function runtime: Node.js 24, 2048 MiB
- `GET /health`: 200
- `GET /ready`: 200 with `database: ready`
- `GET /docs`: 200
- Public `POST /__triggers/support-sla`: 403
- CORS preflight from the stable admin `develop` alias: 204 with the exact allowed origin
- Four triggers exist and are enabled:
  - support SLA every 5 minutes
  - tenant operations every 15 minutes
  - streaming provider sync every 10 minutes
  - subscription metadata backfill daily at 02:10 UTC
- After correcting `DATABASE_URL` to `faithflow_canonical`, fresh support, tenant-ops, and streaming invocations emitted `Scheduled trigger completed` records.
- API typecheck passed.
- API end-to-end tests passed: 17 of 17.
- Neon Function adapter coverage includes health routing, public trigger rejection, and empty CORS preflight handling.
- Production builds passed for the API, web, and admin applications.
- Production dependency audit reported no known vulnerabilities.

## Defect caught during staging

The first Function deployment used Neon's branch-default database. Network health passed, but scheduled jobs could not find FaithFlow tables. The deployment now explicitly supplies the pooled `faithflow_canonical` URL, and `/ready` prevents this configuration from passing again.

## Configuration changes

- Both Vercel `develop` environments now point `NEXT_PUBLIC_API_URL` at the Neon staging API.
- The web `develop` environment was aligned to the admin staging Clerk project.
- The Neon Function uses the matching Clerk secret.
- Former-host deployment blueprints were removed.
- GitHub cron schedules were disabled; their workflows remain manual incident fallbacks.

Vercel environment changes take effect on the next `develop` deployment.

## Remaining staging gates

1. Merge this branch to `develop` through a reviewed PR and wait for both Vercel previews.
2. Test marketing → sign-up → organization creation/selection → tenant provisioning → church-admin dashboard.
3. Test an existing member portal session under the same Clerk organization.
4. Confirm protected admin and member tRPC calls reach the Neon API without authorization or CORS errors.
5. Configure and verify `RESEND_FROM_EMAIL`.
6. Configure Paystack staging secrets and pass sandbox checkout plus signed webhook replay.
7. Implement and verify the provider-neutral Polar adapter and signed webhook.
8. Keep Stripe dormant until the US LLC and live provider setup are complete.
9. Add shared realtime fan-out before treating SSE delivery as multi-instance production-ready.

No production-readiness claim should be made until these browser and provider gates have current evidence.
