# FaithFlow AI

FaithFlow AI is a performance-first, security‑first church management platform designed to serve everyone from single‑campus churches to multi‑campus and diaspora ministries. The product focus is operational clarity and AI leverage that demonstrably saves admin time.

## Principles
- Tenant isolation by default
- Auditability everywhere
- Fast, predictable performance
- AI with provenance (traceable inputs and outputs)

## Stack
- Frontend: Next.js App Router (Web + Admin)
- Backend: Fastify + tRPC + OpenAPI
- Database: Postgres + Prisma (v7, adapter‑pg)
- Auth: Clerk (JWT)
- Realtime: SSE (tenant‑filtered)
- AI: Vercel AI SDK (OpenAI + Anthropic + Gemini)
- Email: Resend
- Comms: Twilio (SMS + WhatsApp)

## Repository Structure
```
apps/
  web/        Marketing + member‑facing UX
  admin/      Admin console
  api/        Fastify API service (tRPC + OpenAPI)
packages/
  api/        Shared tRPC router + types
  ui/         Design system (shadcn‑style)
  database/   Prisma schema + client + seed
  ai/         AI orchestration (Vercel AI SDK)
  utils/      Shared utilities
```

## Quick Start
1. Install dependencies:
```
pnpm install
```

2. Create `.env` from `.env.example`:
```
cp .env.example .env
```

3. Set Clerk keys and DB connection. At minimum:
- `DATABASE_URL`
- `CLERK_JWT_KEY`, `CLERK_JWT_ISSUER`, `CLERK_JWT_AUDIENCE`
- `NEXT_PUBLIC_API_URL`
 - `NEXT_PUBLIC_WEB_URL` (used for QR/share links)
 - Optional: `CLERK_WEBHOOK_SECRET` (for org creation webhook)
 - Payments: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`
 - Storage: `STORAGE_PROVIDER` (`S3` or `GCS`) plus the matching bucket credentials

4. Generate DB tables:
```
pnpm db:push
```

5. Seed demo data:
```
pnpm db:seed
```

6. Start services:
```
pnpm --filter @faithflow-ai/api-server dev
pnpm --filter @faithflow-ai/admin dev
pnpm --filter @faithflow-ai/web dev
```

## Auth + Tenant Bootstrapping
- API verifies Clerk JWTs on every request.
- Tenant ID is derived from the Clerk Org ID.
- On first request, the API auto‑creates:
  - Tenant
  - Default Organization
  - Default Church
  - Main Campus

This makes org setup immediate for new tenants without manual bootstrapping.

## Clerk Webhook (Org Provisioning)
- Endpoint: `POST /webhooks/clerk`
- Expects Clerk Svix headers (`svix-id`, `svix-timestamp`, `svix-signature`)
- When `organization.created` fires, the API provisions:
  - Tenant
  - Default Organization
  - Default Church
  - Main Campus

## Prisma 7 Notes
- Prisma config lives at `/Users/tamensah/aihub/faithflow_ai/packages/database/prisma.config.ts`.
- `DATABASE_URL` is required for the Prisma PG adapter.

## Realtime
- SSE endpoint: `GET /stream`
- Requires Clerk JWT token (query string or Authorization header).
- Events are tenant‑filtered server‑side.

Currently emitting:
- `attendance.checked_in`
- `donation.created`

## Giving + Payments
- Admin console: `/giving` for funds, campaigns, and checkout links.
- Finance console: `/finance` for reconciliation, pledges, recurring, budgets, expenses.
- Public giving form: `/give` (calls `POST /public/giving/checkout`).
- Public fundraiser page: `/fundraisers/:churchSlug/:slug` (calls `GET /public/fundraisers/:churchSlug/:slug`).
- Receipts: `GET /public/receipts/:receiptNumber` (HTML).
- Shareable links + QR codes generated in admin `/giving` (uses `NEXT_PUBLIC_WEB_URL`).
- Recurring checkout: Stripe + Paystack via `/finance`.
- Webhooks:
  - `POST /webhooks/stripe`
  - `POST /webhooks/paystack`
  - `POST /webhooks/stripe/platform`
  - `POST /webhooks/paystack/platform`
  - `POST /webhooks/twilio/sms`
- Webhook deliveries are replay-safe and persisted in `WebhookEvent` for idempotency/audit.
- Paystack signature verification uses `PAYSTACK_WEBHOOK_SECRET` if set, otherwise `PAYSTACK_SECRET_KEY`.
- Paystack currencies enforced server-side: NGN, USD, GHS, ZAR, KES, XOF.
- Currency availability enforced by `Church.countryCode` (NGN=NG, USD=NG/KE, GHS=GH, ZAR=ZA, KES=KE, XOF=CI).
- Paystack minimums enforced: NGN 50, USD 2, GHS 0.1, ZAR 1, KES 3, XOF 1.
- USD via Paystack is only available to Kenya/Nigeria businesses; enforced via `Church.countryCode`.

## Text-to-Give
- Configure numbers in `/giving` → Text-to-give.
- Incoming SMS syntax: `GIVE 50 USD` (include email for Paystack).
- Twilio signature verification uses `TWILIO_AUTH_TOKEN` and optional `TWILIO_WEBHOOK_URL`.

## Communications
- Admin `/communications` for templates and outbound email/SMS/WhatsApp.
- Messages are logged with delivery status for auditability.
- Scheduling + drip campaigns supported (use dispatch task endpoint).
- Task endpoint: `POST /tasks/communications/dispatch` (API key).

## Operations Automation
- Subscription dunning: `POST /tasks/subscriptions/dunning`
- Subscription metadata normalization: `POST /tasks/subscriptions/metadata-backfill`
- Tenant domain + SSL automation: `POST /tasks/tenant-ops/automate`
- Support SLA evaluation: `POST /tasks/support/sla`
- All task routes are API key protected via `INTEGRATION_API_KEY`.
- Recommended cadence:
  - support SLA: every 5 minutes
  - tenant ops automation: every 15 minutes
  - subscription metadata backfill: daily at 02:10 UTC
- Render Blueprint (API + Postgres + cron): `/Users/tamensah/aihub/faithflow_ai/render.yaml`
- Render cron-only Blueprint: `/Users/tamensah/aihub/faithflow_ai/render.cron.yaml`
- Optional in-process scheduler is available in API server (`ENABLE_INTERNAL_SCHEDULER=true`).
- Scheduler profiles guide: `/Users/tamensah/aihub/faithflow_ai/docs/SCHEDULER_PROFILES.md`.

## Membership
- Member profiles, households, groups, tags, milestones, and volunteer roles.
- Onboarding workflows, directory privacy, and group events.
- Admin `/members` for core management workflows.
- Member self‑service portal: `/portal`.
- Manual: `/Users/tamensah/aihub/faithflow_ai/docs/MEMBERSHIP_MANUAL.md`.

## Refunds + Disputes
- Refunds supported for Stripe, Paystack, and manual donations.
- Disputes recorded from provider webhooks.
- Evidence submission supported for Stripe disputes.
- Task endpoint: `POST /tasks/disputes/monitor` (API key).
- Operational playbook: `/Users/tamensah/aihub/faithflow_ai/docs/DISPUTE_PLAYBOOK.md`.

## Payout Reconciliation
- Sync payouts from Stripe and settlements from Paystack in `/finance`.
- Transactions stored in `Payout` and `PayoutTransaction`.

## External Integrations (OpenAPI)
- API key–secured endpoints under `/api/v1` for integrations.
- Headers: `x-api-key` plus `x-clerk-org-id` or `x-tenant-id`.

## AI Insights
- Finance dashboard includes AI donor insights (uses Vercel AI SDK providers).

## Exports
- CSV exports for donations, expenses, pledges, recurring, receipts, and payouts in `/finance`.

## Fundraising
- Fundraiser (peer-to-peer) pages with shareable URLs:
  - Public route: `/fundraisers/:churchSlug/:slug`
  - Admin creation: `/giving` → Fundraiser pages
  - Donations can be marked anonymous

## Audit Logs
- Router: `audit.list` for recent activity.
- Logged actions: donations, pledges, recurring, expenses, budgets, receipts, funds, campaigns, fundraisers.

## Development Commands
- `pnpm dev` – run all packages in parallel
- `pnpm db:push` – sync Prisma schema to DB
- `pnpm db:migrate` – create/apply migrations (requires DB)
- `pnpm db:seed` – seed demo tenant + data

## Brand Guide
See `/Users/tamensah/aihub/faithflow_ai/docs/BRAND_GUIDE.md`.

## Next Focus Areas
- Payments refinements (refunds, disputes, multi-account routing)
- Communications orchestration (Resend + Twilio/WhatsApp)
- AI insights + automation flows

---
If you want a specific domain built next (Giving, Comms, or Insights), we can wire it into both API and admin with full flows.
