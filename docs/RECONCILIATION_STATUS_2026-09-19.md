# FaithFlow Reconciliation Status — 2026-09-19

Status: **migration baseline complete; staging service configuration pending**

## Canonical source line

- Base: `origin/develop`
- Working branch: `codex/neon-migration-upgrade`
- Promotion path: feature PR → `develop` staging → `main` production
- `main` and production configuration were not changed during this recovery.

The unrelated `phase-2-auth-and-core-features` work is preserved as a UX donor. It is not a database or API baseline. See `docs/UX_BRANCH_RECONCILIATION.md`.

## Database baseline

- Neon project: `faithflow` (`delicate-bird-01532427`)
- Canonical recovery database: `faithflow_canonical`
- Long-lived staging branch: `develop` (`br-fragrant-salad-aukk1pvs`)
- Prisma schema: 96 models
- Applied migration directories: 32 of 32
- Public tables: 97, including `_prisma_migrations`
- Initial tenant, organization, church, and user rows: 0
- `prisma migrate status`: database schema is up to date

The Neon `develop` branch was cloned from the verified canonical baseline and independently checked: 32 finished migrations, 97 public tables, and no tenant, organization, church, or user rows. The earlier `faithflow` database remains isolated as the incompatible small test-schema reference. The application has not been pointed at `faithflow_canonical` yet.

## Runtime and dependency baseline

- Node.js: 24.x
- Next.js: 16.3.4
- React / React DOM: 19.2.8
- Prisma: 7.10.0
- Fastify: 5.12.x
- Clerk Next.js: 7.9.x
- Resend: 6.26.0
- TypeScript: 5.9.3
- Production dependency audit: 0 critical, 0 high, 0 moderate, 0 low

The Fastify service exposes its static OpenAPI document at `/docs` without the vulnerable Swagger UI static-file dependency.

## Validation evidence

- Prisma schema validation: passed
- TypeScript across API, web, and admin: passed
- Web and admin production builds: passed
- Web and admin lint: passed with 159 pre-existing React/Next warnings and 0 errors
- API validation: TypeScript and production build passed; a dedicated API ESLint configuration remains follow-up work
- Production dependency audit: passed with 0 known vulnerabilities
- CI workflow added for pull requests and pushes to `develop` and `main`

## Deployment configuration prepared

- Render blueprints no longer provision Render PostgreSQL.
- Runtime `DATABASE_URL` is the Neon pooled connection.
- Migration `DATABASE_URL_UNPOOLED` is the Neon direct connection.
- Vercel continues to host `apps/web` and `apps/admin`.
- Render continues to host `apps/api` and scheduled jobs.

## Remaining staging gates

1. Configure Render staging with the Neon `develop` branch's pooled and direct connection strings.
2. Configure the correct Clerk staging instance, domains, JWT template, and webhook.
3. Merge this feature branch to `develop` through a reviewed PR and verify CI.
4. Run browser tests for marketing → sign-up → organization → church workspace → admin dashboard.
5. Port the UX donor's onboarding and access-recovery flow against the canonical API and schema.
6. Add a dedicated API ESLint configuration and resolve its baseline findings.
7. Complete Paystack and Resend sandbox verification.
8. Implement and verify the provider-neutral Polar billing adapter. Keep Stripe dormant until the US LLC and live provider setup are complete.

No production-readiness claim should be made until these staging and provider gates are evidenced.
