# FaithFlow AI Deployment Manual

This manual is the end-to-end go-live runbook for alpha.

It covers:
- Recommended hosting topology
- Render backend deployment
- Vercel frontend deployment
- Third-party webhook setup
- Scheduler/ops hardening
- Verification and rollback

## 1) Hosting Decision

### Recommended default (alpha and early scale)

- Frontend (`apps/web`, `apps/admin`): Vercel
- Backend (`apps/api`), Postgres, cron: Render

Why this is the best default:
- Vercel is strongest for Next.js performance, cache, and DX.
- Render is strong for API + Postgres + recurring jobs in one control plane.
- Keeps blast radius small: frontend deploys do not restart API jobs.

### Option B (single provider)

- Host frontend + backend on Render.

Use this when:
- You want one infra bill/provider.
- You can accept less specialized Next.js hosting behavior than Vercel.

## 2) Required Accounts and Access

- GitHub repo access to `tamensah/faithflowai`
- Render account with permission to create services/databases
- Vercel account with permission to import the repo
- Provider accounts: Clerk, Stripe, Paystack, Resend, Twilio, S3 or GCS

## 3) Source of Truth Files

- Render full blueprint: `/Users/tamensah/aihub/faithflow_ai/render.yaml`
- Render cron-only fallback: `/Users/tamensah/aihub/faithflow_ai/render.cron.yaml`
- Third-party setup checklist: `/Users/tamensah/aihub/faithflow_ai/docs/THIRDPARTY_CONFIG.md`
- Scheduler strategy and cadence: `/Users/tamensah/aihub/faithflow_ai/docs/SCHEDULER_PROFILES.md`
- Env baseline: `/Users/tamensah/aihub/faithflow_ai/.env.example`

## 4) Backend Deploy on Render (Blueprint)

1. In Render Dashboard, choose Blueprint deploy.
2. Select repo `tamensah/faithflowai` and branch `main`.
3. Use `/Users/tamensah/aihub/faithflow_ai/render.yaml`.
4. Confirm services:
- `faithflow-api` (web service)
- `faithflow-postgres` (database)
- `faithflow-support-sla-sweep` (cron)
- `faithflow-tenant-ops-automate` (cron)
- `faithflow-subscription-metadata-backfill` (cron)
5. Fill all `sync: false` env values before promoting.

### Render API critical envs

- `ALLOWED_ORIGINS`
- `NEXT_PUBLIC_WEB_URL`
- `NEXT_PUBLIC_ADMIN_URL`
- `INTEGRATION_API_KEY`
- `ENABLE_INTERNAL_SCHEDULER=false` (must stay false in multi-instance external scheduler setup)
- Clerk:
  - `CLERK_SECRET_KEY`
  - `CLERK_JWT_KEY`
  - `CLERK_JWT_ISSUER`
  - `CLERK_JWT_AUDIENCE`
  - `CLERK_WEBHOOK_SECRET`

### Render API optional by feature

- Payments: `STRIPE_*`, `PAYSTACK_*`
- Comms: `RESEND_*`, `TWILIO_*`
- AI: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`
- Storage: `STORAGE_PROVIDER` and matching S3/GCS vars

### Render cron envs (each cron service)

- `API_BASE_URL` (the Render API public URL)
- `INTEGRATION_API_KEY` (same value used by API service)

## 5) Frontend Deploy on Vercel (Recommended)

Create two Vercel projects from the same repo.

### Project A: Web app

- Root directory: `apps/web`
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm --filter @faithflow-ai/web build`
- Output: Next.js default

Required env:
- `NEXT_PUBLIC_API_URL` = Render API URL
- `NEXT_PUBLIC_WEB_URL` = public web URL
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_CLERK_JWT_TEMPLATE` (optional; required only if using Clerk custom JWT template)
- `CLERK_SECRET_KEY`

### Project B: Admin app

- Root directory: `apps/admin`
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm --filter @faithflow-ai/admin build`
- Output: Next.js default

Required env:
- `NEXT_PUBLIC_API_URL` = Render API URL
- `NEXT_PUBLIC_ADMIN_URL` = public admin URL
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_CLERK_JWT_TEMPLATE` (optional; required only if using Clerk custom JWT template)
- `CLERK_SECRET_KEY`

### Monorepo deploy command profile (Codex/Vercel CLI)

For this workspace, use prebuilt deploys from repo root with project-specific settings:

- Web:
  - `npx vercel@latest build --prod --yes`
  - `npx vercel@latest deploy --prebuilt --prod --yes`
  - with project settings: `rootDirectory=apps/web`, `buildCommand=pnpm --filter @faithflow-ai/web build`
- Admin:
  - `npx vercel@latest build --prod --yes`
  - `npx vercel@latest deploy --prebuilt --prod --yes`
  - with project settings: `rootDirectory=apps/admin`, `buildCommand=pnpm --filter @faithflow-ai/admin build`

Using `--prebuilt` avoids workspace protocol install failures on direct app-folder deploys.

### Cross-origin rule

`ALLOWED_ORIGINS` in Render API must include both Vercel app origins.

Example:
`ALLOWED_ORIGINS=https://app.faithflow.ai,https://admin.faithflow.ai,http://localhost:3000,http://localhost:3001`

## 6) Third-Party Webhooks (Provider Side)

Configure these provider endpoints after API is live:

- Clerk: `POST https://<api-domain>/webhooks/clerk`
- Stripe: `POST https://<api-domain>/webhooks/stripe`
- Stripe platform: `POST https://<api-domain>/webhooks/stripe/platform`
- Paystack: `POST https://<api-domain>/webhooks/paystack`
- Paystack platform: `POST https://<api-domain>/webhooks/paystack/platform`
- Twilio SMS: `POST https://<api-domain>/webhooks/twilio/sms`

Use exact event lists from `/Users/tamensah/aihub/faithflow_ai/docs/THIRDPARTY_CONFIG.md`.

## 7) Operations and Alerts

GitHub workflows already exist:
- `/Users/tamensah/aihub/faithflow_ai/.github/workflows/support-sla-sweep.yml`
- `/Users/tamensah/aihub/faithflow_ai/.github/workflows/tenant-ops-automate.yml`
- `/Users/tamensah/aihub/faithflow_ai/.github/workflows/subscription-metadata-backfill.yml`

Set GitHub environment `alpha-ops` and required secrets:
- `FAITHFLOW_API_BASE_URL`
- `FAITHFLOW_INTEGRATION_API_KEY`

Optional alerting secrets:
- `FAITHFLOW_ALERT_SLACK_WEBHOOK_URL`
- `FAITHFLOW_ALERT_RESEND_API_KEY`
- `FAITHFLOW_ALERT_EMAIL_FROM`
- `FAITHFLOW_ALERT_EMAIL_TO`

## 8) Release Verification Checklist

Run post-deploy checks in this order:

1. API health/docs loads.
2. Clerk sign-in works in both web/admin.
3. Tenant auto-provision works on first org request.
4. One Stripe test donation succeeds and receipt resolves.
5. One Paystack test donation succeeds for supported currency/country pair.
6. Webhook replay-idempotency verified (no duplicate rows).
7. Cron jobs execute successfully and write expected audit/log records.
8. Basic comms send test (Resend email + Twilio SMS if configured).

## 9) Rollback Strategy

- Frontend rollback: redeploy previous Vercel deployment.
- API rollback: rollback Render service to prior deploy.
- DB safety: never rollback with destructive SQL; use forward-fix migrations.
- Webhook safety: idempotency is already enforced in `WebhookEvent`.

## 10) Render MCP (Optional but Recommended)

If you want deployment/ops from AI tools via MCP:

1. Create Render API key in Render dashboard.
2. Export key locally:
```bash
export RENDER_API_KEY="YOUR_RENDER_API_KEY"
```
3. Add Render MCP to Codex:
```bash
codex mcp add render --url https://mcp.render.com/mcp --bearer-token-env-var RENDER_API_KEY
```
4. Restart Codex and verify MCP resources list.

If MCP is unavailable, use Dashboard Blueprint deploy with `/Users/tamensah/aihub/faithflow_ai/render.yaml`.

## 11) Production Hardening Before Beta

- Enforce least-privilege API keys per provider.
- Add WAF/rate-limits at edge for webhook and public endpoints.
- Add uptime checks for API and scheduled task endpoints.
- Enable centralized logging/metrics and error alert routing.
- Add DB backup retention policy and restore test.
