# ChurchTrack

ChurchTrack is a global church management platform for a single congregation or a multi-site church organization. The product has a public website, a member portal, a church administration console, and a separate role-gated platform operations area.

**Current state (24 September 2026):** `develop` is the staging branch. The web and admin previews and the Fastify API run against Neon's `develop` branch. The first onboarding and Polar sandbox checkout have been exercised, but a fresh end-to-end onboarding test on the latest deployment and the remaining provider and multi-site checks are still open. `main` has not been promoted with this work. See the [current reconciliation status](./docs/RECONCILIATION_STATUS_2026-09-23.md) for evidence and release gates.

## Product surfaces

| Surface                       | Audience                           | App          | Staging entry                                                                                                                                                                |
| ----------------------------- | ---------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website and guided onboarding | Prospective churches               | `apps/web`   | [Website](https://churchtrack-web-git-develop-tamensahs-projects.vercel.app/) · [Get started](https://churchtrack-web-git-develop-tamensahs-projects.vercel.app/get-started) |
| Member portal                 | Members of a church                | `apps/web`   | [Portal](https://churchtrack-web-git-develop-tamensahs-projects.vercel.app/portal)                                                                                           |
| Church administration         | Church admins and staff            | `apps/admin` | [Admin](https://churchtrack-admin-git-develop-tamensahs-projects.vercel.app/)                                                                                                |
| Platform operations           | ChurchTrack's authorized operators | `apps/admin` | `/platform` within the admin app                                                                                                                                             |

The normal customer path is website → Clerk sign-in → create/select an organization workspace → choose a plan → configured checkout → church admin. The workspace owns the customer account and subscription. ChurchTrack then provisions an in-app Organization, first Church, and Campus. The first Organization uses the workspace name when available; the admin names the operating Church and confirms its public slug and country. The first Church's slug is suggested from its name and must be globally unique.

An independently operated congregation is a **Church**, even if the customer calls it a branch, assembly, or campus church. A **Campus** is a site sharing one Church's members and operating records. Headquarters and regional oversight of child Churches, delegated regional permissions, and a first-run timezone choice are **not yet implemented**. See the [onboarding manual](./docs/ONBOARDING_MANUAL.md) and [church structure review](./docs/CHURCH_STRUCTURE_REVIEW_2026-09-23.md).

## Architecture

- **Web and admin:** Next.js 16 App Router, React 19, Clerk.
- **API:** Fastify, tRPC, and documented external endpoints. The staging API runs as a Neon Function on Node.js 24.
- **Database:** Neon Postgres with Prisma 7. Runtime traffic uses a pooled connection; migrations use a direct connection.
- **Scheduled work:** Neon Function Triggers call protected API handlers.
- **Integrations:** Clerk for identity, Resend for transactional email, Polar for staging subscription checkout, with Paystack and Stripe activation tracked separately.

The database, API, and scheduled work are on Neon; Vercel hosts the two Next.js apps. The repository still uses `@faithflow-ai/*` package names, the `faithflow_canonical` database name, and the `faithflowapi` Function slug as internal identifiers. Changing those names requires a coordinated migration and is not part of the customer-facing ChurchTrack rename.

```text
apps/
  web/        Website, onboarding, and member portal
  admin/      Church administration and platform operations
  api/        Fastify API and Neon Function entry
packages/
  api/        Shared tRPC routers and business logic
  database/   Prisma schema, migrations, and generated client
  ui/         Shared UI components
  ai/         AI integration code
  utils/      Shared utilities
```

## Run locally

Use Node.js **24.x** and pnpm **10.28.2**. Start from a feature branch based on `develop`. Use a disposable or local Neon database branch for development; do not point routine local commands at staging or production.

1. Install dependencies: `pnpm install --frozen-lockfile`.
2. Use [`.env.example`](./.env.example) as the variable inventory. Create untracked, app-local environment files:
   - `packages/database/.env`: direct `DIRECT_URL` (or `DATABASE_URL_UNPOOLED`) for Prisma CLI and `DATABASE_URL` for the same disposable database.
   - `apps/api/.env.local`: pooled `DATABASE_URL`, allowed local origins, Clerk server credentials, and only the integration keys being tested.
   - `apps/web/.env.local` and `apps/admin/.env.local`: Clerk keys, `NEXT_PUBLIC_API_URL`, the Clerk JWT template, and their web/admin URLs.
3. Validate and apply the checked-in schema **only to the disposable database**:

   ```bash
   pnpm --filter @faithflow-ai/database exec prisma generate
   pnpm db:validate
   pnpm db:migrate:deploy
   ```

4. Run the three services in separate terminals:

   ```bash
   pnpm --filter @faithflow-ai/api-server dev
   pnpm --filter @faithflow-ai/web dev
   pnpm --filter @faithflow-ai/admin dev
   ```

The default local ports are API `4000`, web `3000`, and admin `3001`. Demo seeding is optional and belongs on a disposable database only. Avoid `db:push` for shared environments; use reviewed migrations.

## Branches and deployment

Changes start on a feature branch and enter `develop` through a PR. Vercel deploys web/admin previews from `develop`, while the matching Neon `develop` branch hosts the canonical database, API Function, and triggers. After staging verification, a separate `develop` → `main` PR promotes a release. Database migrations and backend deployment are deliberate steps; a Vercel Ready status alone does not verify the full product. See the [Git and deployment workflow](./docs/GITFLOW_WORKFLOW.md) and [deployment manual](./docs/DEPLOYMENT_MANUAL.md).

## Integration and release status

| Area                  | Current state                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subscription checkout | Polar **sandbox** is connected in staging; lifecycle and entitlement testing is still a release gate.                                                |
| Church giving         | Online giving requires each organization or church to connect its own Paystack or Stripe merchant account; checkout is blocked until that flow exists. |
| Paystack and Stripe   | Church-owned giving providers only. ChurchTrack subscriptions use Polar; the old shared-key giving adapters are not a release-ready merchant flow.    |
| Email                 | Resend is the transactional provider. The configured sending domain and delivery must be verified for each environment.                              |
| Multi-site oversight  | Separate operating Churches are supported. Nested regions, headquarters rollups, and delegated regional roles remain design and implementation work. |

The primary ChurchTrack domain has not been purchased. Staging uses the Vercel aliases above; do not assume a production domain or public launch from those URLs.

## Checks and documentation

- `pnpm typecheck` and `pnpm lint` check the workspaces; lint currently reports existing warnings.
- `pnpm test:e2e:api` writes test data and must run only against an isolated database.
- Use the [beta smoke test](./docs/BETA_SMOKE_TEST.md) for browser validation, including the complete onboarding journey and member/admin access.
- Use the [provider configuration tracker](./docs/THIRDPARTY_CONFIG.md) before enabling an integration.
- Use the [product surfaces guide](./docs/PRODUCT_SURFACES.md) for audience and route ownership.
