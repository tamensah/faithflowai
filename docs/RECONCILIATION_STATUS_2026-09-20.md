# FaithFlow Reconciliation Status — 2026-09-20

Status: **Neon staging stack deployed and publicly verified; authenticated onboarding verification pending**

Last verified: **2026-09-21**

## Canonical source line

- Base: `origin/develop`
- Migration PR: [#3](https://github.com/tamensah/faithflowai/pull/3)
- Merge commit: `b7361c3ec274d00ce04427d2afadc00f276cce10`
- Promotion path: feature PR → `develop` staging → `main` production
- Production and `main` have not been changed.

## Staging architecture now deployed

- Web and member portal: Vercel project `faithflow-web`
- Church admin and platform operations: Vercel project `faithflow-admin`
- API: Neon Function `faithflowapi` on branch `br-fragrant-salad-aukk1pvs`
- Database: `faithflow_canonical` on the same Neon branch
- Scheduler: four Neon Function Triggers declared in `neon.ts`
- Identity: one shared staging Clerk project across web, admin, and API
- Email provider: Resend with `susubiribi.com` verified and the interim sender `FaithFlow <notifications@susubiribi.com>` configured
- Public product domain: not purchased; the Vercel `develop` aliases remain the canonical staging URLs

Staging API:

`https://br-fragrant-salad-aukk1pvs-faithflowapi.compute.c-10.us-east-1.aws.neon.tech`

Stable `develop` applications:

- Web and member portal: `https://faithflow-web-git-develop-tamensahs-projects.vercel.app`
- Church admin and platform operations: `https://faithflow-admin-git-develop-tamensahs-projects.vercel.app`

## Verified evidence

- Function runtime: Node.js 24, 2048 MiB
- `GET /health`: 200
- `GET /ready`: 200 with `database: ready`
- `GET /docs`: 200
- Public `POST /__triggers/support-sla`: 403
- CORS preflight from both stable `develop` aliases: 204 with the exact allowed origin
- Web `/` and `/get-started`: 200
- Admin `/` and `/dashboard`: 200
- Both merged `develop` Vercel deployments reached Ready, and the stable aliases resolve to them.
- No Vercel error logs were present for either `develop` application in the 30-minute verification window.
- Four triggers exist and are enabled:
  - support SLA every 5 minutes
  - tenant operations every 15 minutes
  - streaming provider sync every 10 minutes
  - subscription metadata backfill daily at 02:10 UTC
- After correcting `DATABASE_URL` to `faithflow_canonical`, support, tenant-ops, and streaming invocations emitted `Scheduled trigger completed` records through 2026-09-21 00:05 UTC. No `Scheduled trigger failed` records appeared in the final 30-minute verification window.
- API typecheck passed.
- API end-to-end tests passed: 19 of 19, including Polar's signed-webhook coverage.
- The focused Polar adapter suite passed 3 of 3 against the isolated Neon `develop` database and verified tenant-scoped activation, duplicate-delivery handling, invalid-signature rejection, and fail-closed handling for unknown provider states.
- Neon `develop` now has migration `20260921010000_polar_platform_billing`; production/default branches remain unchanged.
- Polar's live MCP endpoint is authenticated in Codex, the separate sandbox authorization remains pending, and the official `setup-polar`, `polar-integration`, `polar-testing`, and `polar-migration` skills are installed.
- Neon Function adapter coverage includes health routing, public trigger rejection, and empty CORS preflight handling.
- Production builds passed for the API, web, and admin applications.
- Production dependency audit reported no known vulnerabilities.
- GitHub Actions run `35538712270` passed install, Prisma validation, Neon configuration typecheck, monorepo typecheck, adapter tests, lint, build, and production dependency audit.
- Resend reports `susubiribi.com` as verified with sending enabled and its DKIM, SPF MX, and SPF TXT records verified.
- FaithFlow staging uses the dedicated `faithflow-staging-sending` Resend key with sending-only permission restricted to `susubiribi.com`.
- Neon Function deployment 8 includes `RESEND_FROM_EMAIL` and the restricted sending key; `/health` and `/ready` remained 200, and no scheduled-trigger failures appeared in the final verification window.
- The web `develop` environment includes the same interim sender.

## Defect caught during staging

The first Function deployment used Neon's branch-default database. Network health passed, but scheduled jobs could not find FaithFlow tables. The deployment now explicitly supplies the pooled `faithflow_canonical` URL, and `/ready` prevents this configuration from passing again.

## Configuration changes

- Both Vercel `develop` environments now point `NEXT_PUBLIC_API_URL` at the Neon staging API.
- The web `develop` environment was aligned to the admin staging Clerk project.
- The Neon Function uses the matching Clerk secret.
- The Neon Function and web `develop` environment use `FaithFlow <notifications@susubiribi.com>` until a primary FaithFlow domain is purchased and verified.
- Former-host deployment blueprints were removed.
- GitHub cron schedules were disabled; their workflows remain manual incident fallbacks.

The merged `develop` deployments include these environment changes.

## Remaining staging gates

1. Test marketing → sign-up → organization creation/selection → tenant provisioning → church-admin dashboard.
2. Test an existing member portal session under the same Clerk organization.
3. Confirm protected admin and member tRPC calls reach the Neon API without authorization or CORS errors.
4. Send and confirm a staging transactional email, and configure `CONTACT_TO_EMAIL` after the monitored recipient inbox is selected.
5. Configure Paystack staging secrets and pass sandbox checkout plus signed webhook replay.
6. Use the authenticated Polar MCP after session refresh to create or verify the sandbox organization, recurring products, and webhook; then add product IDs and sandbox secrets to staging and complete checkout/customer-portal/lifecycle tests.
7. Keep Stripe dormant until the US LLC and live provider setup are complete.
8. Add shared realtime fan-out before treating SSE delivery as multi-instance production-ready.

The interim email domain is an infrastructure choice, not the public FaithFlow domain. No production-readiness claim should be made until the browser and provider gates have current evidence.
