# ChurchTrack Third‑Party Configuration (Beta Go‑Live)

This doc lists the required provider‑side configuration to run the alpha. Once the API keys and webhooks below are set in environment variables, the app should be live without additional code changes.

## 1. Clerk (Auth + Orgs)

**Goal**: enable JWT validation and org provisioning.

- Create a Clerk application.
- Enable Organizations.
- Configure JWTs for backend validation.
- Create a JWT template (recommended name: `faithflow-api`) for frontend token minting.
  - Suggested custom claims:
    - `org_id`: `{{organization.id}}`
    - `org_slug`: `{{organization.slug}}`
    - `email`: `{{user.primary_email_address.email_address}}`
  - Set template audience to `faithflow-api` if you want strict audience validation.
- Create a webhook and set endpoint:
  - `POST /webhooks/clerk`
  - Events: `organization.created`
- Required env:
  - `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
  - `CLERK_JWT_KEY`, `CLERK_JWT_ISSUER`, `CLERK_JWT_AUDIENCE`
  - `CLERK_WEBHOOK_SECRET`
  - `NEXT_PUBLIC_CLERK_JWT_TEMPLATE` (web/admin, if using custom JWT template)

Optional guardrail env:

- `AUTH_POLICY_ENFORCE_SSO_STRICT` (`true` to hard-block when tenant policy enforces SSO and token lacks SSO auth method signal)

## Payment provider release order

- **First production release:** Polar for ChurchTrack SaaS billing and Paystack for Ghana/African payment flows.
- **Retained adapter:** Stripe is already implemented in the codebase but live use is deferred until the US LLC and Stripe account setup are complete.
- Keep provider SDKs and webhook payloads behind billing/payment adapters. Entitlements, subscription state, pricing, reconciliation, webhook idempotency, and tenant business rules remain server-side and provider-neutral.

Polar is the first-release SaaS subscription provider. The adapter uses the official `@polar-sh/sdk` and keeps provider payloads behind ChurchTrack's subscription boundary.

- Use the Polar sandbox organization `churchtrack` for staging. OAuth authorization and organization creation were confirmed on 2026-09-21.
- Starter (`46305a55-da31-495f-98b0-e763a0ccc926`) and Growth (`9db3247e-2ecb-4deb-b6ee-d9887e790b47`) are configured as private monthly products with 14-day trials and are mapped to the matching ChurchTrack plans through `metadata.polarProductId`.
- The enabled webhook (`41e4ae0e-91c6-472f-86f1-e80b7e8fef34`) sends the required subscription lifecycle events to `POST /webhooks/polar/platform` on the Neon staging Function.
- Required env: `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_SERVER=sandbox`.
- Neon staging deployment 11 contains these variables. Runtime checks confirm that the token can read subscriptions, denied ungranted product access, and the webhook rejects unsigned payloads.
- Complete hosted checkout, signed webhook, customer portal, cancellation, and recovery tests before enabling production.

## 2. Stripe (implemented, live activation deferred)

**Goal**: enable card giving, recurring donations, and payout reconciliation.

- Create a Stripe account and enable Checkout.
- Create a webhook endpoint:
  - `POST /webhooks/stripe`
  - Events used: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `checkout.session.async_payment_failed`, `charge.refunded`, `refund.created`, `refund.updated`, `refund.failed`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`.
- Required env:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`

## 3. Paystack (implemented, first-release priority)

**Goal**: enable NGN/GHS/KES/ZAR/USD/XOF giving and settlement reconciliation.

- Create a Paystack account.
- Configure webhook:
  - `POST /webhooks/paystack`
- Required env:
  - `PAYSTACK_SECRET_KEY`
  - `PAYSTACK_WEBHOOK_SECRET` (falls back to secret key if not set)
- Dispute evidence API requires customer email, name, phone, and service details for each dispute.

## 4. Twilio (SMS + WhatsApp + Text‑to‑Give)

**Goal**: enable inbound SMS giving and outbound SMS/WhatsApp.

- Create a Twilio account and get a phone number.
- Configure the SMS webhook on the phone number:
  - `POST /webhooks/twilio/sms`
- (Optional) Enable WhatsApp sandbox or business‑approved sender.
- Configure WhatsApp inbound webhook (sandbox or production sender):
  - `POST /webhooks/twilio/whatsapp`
- Required env:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_SMS_NUMBER`
  - `TWILIO_WHATSAPP_NUMBER` (for WhatsApp outbound)
  - `TWILIO_WEBHOOK_URL` (if you need strict signature validation behind a proxy)
  - `TWILIO_SMS_WEBHOOK_URL` (optional, overrides `TWILIO_WEBHOOK_URL` for SMS signature validation)
  - `TWILIO_WHATSAPP_WEBHOOK_URL` (optional, overrides `TWILIO_WEBHOOK_URL` for WhatsApp signature validation)

Optional communications policy env:

- `COMMS_QUIET_HOURS_ENABLED` (defaults to `true`)
- `COMMS_QUIET_START_HOUR` (defaults to `21`)
- `COMMS_QUIET_END_HOUR` (defaults to `7`)
- `COMMS_QUIET_RESCHEDULE_INCREMENT_MINUTES` (defaults to `30`)
- `COMMS_UNSUBSCRIBE_SECRET` (required to generate/verify one-click unsubscribe links)

When enabled, queued SMS/WhatsApp messages are automatically deferred out of quiet hours using the church timezone.
Inbound STOP/unsubscribe keywords (`STOP`, `UNSUBSCRIBE`, `CANCEL`, etc.) are processed on Twilio webhooks and create channel suppressions automatically.

## 5. Resend (Email Delivery)

**Goal**: enable receipts, outbound email communications, transactional onboarding/billing reminders, and marketing contact form delivery.

- Create a Resend account.
- Verify sending domain (DNS records for DKIM/SPF).
- Required env:
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL` (`ChurchTrack <notifications@susubiribi.com>` in staging)
  - `CONTACT_TO_EMAIL` (where marketing site contact messages should be delivered)
- `susubiribi.com` is the verified interim sending domain. It is not the future public ChurchTrack domain; purchase and verify that domain before switching production branding.
- Use a product-specific sending-only API key restricted to that domain. Staging uses the key named `faithflow-staging-sending`.
- Validation path in admin:
  - Open `Admin -> Ops -> Health`
  - Use **Queue welcome email** and **Queue trial reminder** buttons to enqueue transactional templates through the normal provider/outbox path.

## 6. Push Notifications (Firebase Cloud Messaging)

**Goal**: enable mobile/web push notifications.

- Create a Firebase project and FCM server key.
- Required env:
  - `FCM_SERVER_KEY`

## 7. File Storage (S3 or GCS)

**Goal**: enable secure uploads for messaging attachments and future media assets.

Pick one provider:

**Option A: Amazon S3**
- Create a bucket (public-read or fronted by CloudFront).
- Required env:
  - `S3_BUCKET`
  - `S3_REGION`
  - `S3_ACCESS_KEY_ID`
  - `S3_SECRET_ACCESS_KEY`
- Optional env:
  - `S3_PUBLIC_URL` (CloudFront or custom domain)
  - `S3_ENDPOINT` (for S3-compatible storage)
  - `S3_PUBLIC_READ` (set to `true` if objects should be public)
  - `S3_FORCE_PATH_STYLE` (set to `true` for some S3-compatible vendors)

**Option B: Google Cloud Storage**
- Create a GCS bucket.
- Required env:
  - `GCS_BUCKET`
  - `GCS_PROJECT_ID`
  - `GCS_CLIENT_EMAIL`
  - `GCS_PRIVATE_KEY` (newline escaped, replace `\n` with `\\n`)
- Optional env:
  - `GCS_KEYFILE_PATH` (if using a JSON key file instead of env vars)
  - `GCS_PUBLIC_URL` (custom domain)

Shared:
- `STORAGE_PROVIDER` (`S3` or `GCS`)
- `UPLOAD_MAX_BYTES` (defaults to 25MB)

## 8. AI Providers (Vercel AI SDK)

**Goal**: enable AI features when you’re ready.

- Create API keys for:
  - OpenAI → `OPENAI_API_KEY`
  - Anthropic → `ANTHROPIC_API_KEY`
  - Google Gemini → `GOOGLE_GENERATIVE_AI_API_KEY`

- Optional model defaults:
  - `AI_OPENAI_MODEL` (default: `gpt-4o-mini`)
  - `AI_ANTHROPIC_MODEL` (default: `claude-3-5-sonnet-latest`)
  - `AI_GOOGLE_MODEL` (default: `gemini-1.5-pro`)

## 9. Database (Neon Postgres)

- Provision an isolated Neon branch for the target environment.
- Set `DATABASE_URL` to its pooled connection string for application traffic.
- Set `DATABASE_URL_UNPOOLED` to its direct connection string for Prisma migrations.
- Run:
  - `pnpm db:validate`
  - `pnpm db:migrate:deploy`
  - `pnpm db:migrate:status`
- Seed only a local or explicitly designated test environment with `pnpm db:seed`.
- Follow `docs/NEON_MIGRATION_RUNBOOK.md` for promotion, verification, and restore procedures.

## 10. App URLs / CORS

- Set allowed origins in `ALLOWED_ORIGINS`.
- Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WEB_URL` for QR links and public redirects.

## 10a. Frontend App Env Vars

These are required in Vercel (or your hosting provider) for each frontend app. They are **not** in the API.

### Web app (`apps/web`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | API base URL; use the current Neon Function URL in staging |
| `NEXT_PUBLIC_WEB_URL` | ✅ | Web app base URL; use the stable Vercel `develop` alias until a primary domain is purchased |
| `NEXT_PUBLIC_ADMIN_URL` | ✅ | Admin console URL; use the stable Vercel `develop` alias until a primary domain is purchased |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk publishable key (starts `pk_`) |
| `CLERK_SECRET_KEY` | ✅ | Clerk secret key (server-side only, starts `sk_`) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | ✅ | Set to `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | ✅ | Set to `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | ✅ | Set to `/portal` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | ✅ | Set to `/get-started` |
| `NEXT_PUBLIC_CLERK_JWT_TEMPLATE` | Optional | Custom JWT template name (e.g. `faithflow-api`) |
| `RESEND_API_KEY` | ✅ | For contact form email delivery |
| `RESEND_FROM_EMAIL` | ✅ | Sending address for contact form |
| `CONTACT_TO_EMAIL` | ✅ | Recipient address for marketing contact form submissions |

### Admin app (`apps/admin`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | API base URL |
| `NEXT_PUBLIC_WEB_URL` | ✅ | Web app base URL (for portal links) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk publishable key |
| `CLERK_SECRET_KEY` | ✅ | Clerk secret key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | ✅ | Set to `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | ✅ | Set to `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | ✅ | Set to `/` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | ✅ | Set to `/` |
| `NEXT_PUBLIC_CLERK_JWT_TEMPLATE` | Optional | Custom JWT template name |

## 11. External Integrations (OpenAPI)

- Set `INTEGRATION_API_KEY` for API key–based integrations.
- Use headers:
  - `x-api-key`: integration key
  - `x-clerk-org-id` or `x-tenant-id`: tenant scoping for server-to-server integrations only
- Browser and admin/member portal requests must use Clerk bearer auth instead of `x-tenant-id`.
- Dispatch scheduled comms (cron): `POST /tasks/communications/dispatch` with `x-api-key`.
- Monitor disputes (cron): `POST /tasks/disputes/monitor` with `x-api-key`.
- Volunteer reminders (cron): `POST /tasks/volunteer/reminders` with `x-api-key`.
- Volunteer staffing gap alerts (cron): `POST /tasks/volunteer/gap-alerts` with `x-api-key`.
- Subscription metadata backfill (cron): `POST /tasks/subscriptions/metadata-backfill` with `x-api-key`.
- Tenant domain + SSL automation (cron): `POST /tasks/tenant-ops/automate` with `x-api-key`.
- Support SLA sweep (cron): `POST /tasks/support/sla` with `x-api-key`.
- Streaming provider sync (cron): `POST /tasks/streaming/provider-sync` with `x-api-key`.

Tenant domain runbook/escalation tuning env:

- `DOMAIN_PENDING_ESCALATION_HOURS` (default `24`)
- `DOMAIN_INCIDENT_AUTO_CLOSE` (default enabled; set `false` to require manual incident closure)

### Default cadence (recommended)

- `POST /tasks/support/sla`: every 5 minutes
- `POST /tasks/tenant-ops/automate`: every 15 minutes
- `POST /tasks/streaming/provider-sync`: every 10 minutes
- `POST /tasks/subscriptions/metadata-backfill`: daily at 02:10 UTC

Operational guardrail telemetry:

- `GET /health/auth-guardrails`

### Optional internal scheduler

If you prefer in-process scheduling (single-instance only), set:

- `ENABLE_INTERNAL_SCHEDULER=true`
- `SCHEDULER_TIMEZONE=UTC`
- `CRON_SUPPORT_SLA_SWEEP=*/5 * * * *`
- `CRON_TENANT_OPS_AUTOMATE=*/15 * * * *`
- `CRON_SUBSCRIPTION_METADATA_BACKFILL=10 2 * * *`
- `CRON_STREAMING_PROVIDER_SYNC=*/10 * * * *`

See scheduler profiles: [`SCHEDULER_PROFILES.md`](./SCHEDULER_PROFILES.md).

## 12. Live Streaming Providers (Add-on)

Live streaming requires the `STREAMING_SUITE` add-on to be enabled for a tenant. Each channel stores a `provider` (YOUTUBE, FACEBOOK, VIMEO, CUSTOM_RTMP) and an optional `externalChannelId` used to call real provider APIs.

When provider credentials are absent, the sync runtime falls back to HTTP HEAD probing of the channel's `playbackUrl` to infer session state. Setting API credentials enables richer signals: live viewer counts, authoritative stream status, and automatic recording URL ingestion.

### YouTube Live

- Create a project in [Google Cloud Console](https://console.cloud.google.com/).
- Enable the **YouTube Data API v3**.
- Create an API key (restrict to `youtube.googleapis.com` for production).
- Store the broadcast ID (from YouTube Studio → Go Live → Broadcast ID) in the channel's **External channel ID** field.
- Required env:
  - `YOUTUBE_API_KEY`

Signal mapping:
| YouTube `lifeCycleStatus` | ChurchTrack action |
|--------------------------|-----------------|
| `liveStarting`, `live` | → LIVE transition suggested |
| `complete`, `revoked` | → ENDED transition suggested |

### Facebook Live Video

- Create a [Facebook Developer App](https://developers.facebook.com/) with `pages_read_engagement` and `pages_manage_videos` permissions.
- Generate a long-lived Page Access Token.
- Store the Facebook Live Video ID in the channel's **External channel ID** field.
- Required env:
  - `FACEBOOK_PAGE_ACCESS_TOKEN`

Signal mapping:
| Facebook `status` | ChurchTrack action |
|-------------------|-----------------|
| `LIVE`, `SCHEDULED_LIVE` | → LIVE transition suggested |
| `VOD`, `PROCESSING` | → ENDED transition suggested |

### Vimeo Live

- Create a [Vimeo Developer App](https://developer.vimeo.com/) with `video_files`, `live_events` scopes.
- Generate a Personal Access Token with those scopes.
- Store the Vimeo Live Event ID in the channel's **External channel ID** field.
- Required env:
  - `VIMEO_ACCESS_TOKEN`

Signal mapping:
| Vimeo `status` | ChurchTrack action |
|----------------|-----------------|
| `streaming` | → LIVE transition suggested |
| `archive_in_progress`, `archived` | → ENDED + recording URL auto-ingested |

### Custom RTMP

No provider API integration. Relies entirely on HTTP HEAD probe of the `playbackUrl`. Set a public HLS or DASH URL in the channel's **Playback URL** field.

### Shared streaming env

- `STREAMING_SYNC_HTTP_TIMEOUT_MS` — HTTP probe timeout in milliseconds (default: `3000`)

### Sync cron

The provider sync runs every 10 minutes through the `streaming-provider-sync` Neon Function Trigger declared in `neon.ts`. It applies suggested SCHEDULED→LIVE and LIVE→ENDED transitions automatically and ingests recording URLs when available.

Task endpoint (API key protected):
- `POST /tasks/streaming/provider-sync`
  - Body: `{ limit, applySuggestedTransitions, tenantId?, churchId?, dryRun? }`

Optional in-process scheduler env:
- `CRON_STREAMING_PROVIDER_SYNC` (default: `*/10 * * * *`)

---

## 15. Deployment (Neon + Vercel)

The Fastify API, PostgreSQL, and scheduled jobs run on Neon. The web and admin applications run on Vercel.

- `neon.ts` declares the Function and Function Triggers.
- `apps/api/src/neon-function.ts` is the Neon runtime entry point.
- [`DEPLOYMENT_MANUAL.md`](./DEPLOYMENT_MANUAL.md) defines environment and promotion steps.

Manual task endpoints still require `INTEGRATION_API_KEY`. Neon trigger handlers use Neon platform invocation headers and do not expose that key.

## 16. Manual Scheduler Fallback Alerts

The GitHub workflows are manual-only fallbacks. Optional repository secrets for their failure notifications:

- `FAITHFLOW_ALERT_SLACK_WEBHOOK_URL`
- `FAITHFLOW_ALERT_RESEND_API_KEY`
- `FAITHFLOW_ALERT_EMAIL_FROM`
- `FAITHFLOW_ALERT_EMAIL_TO`

## 17. Optional: Realtime + Webhooks

- `GET /stream` requires a short-lived signed `streamToken` issued by `auth.streamToken`.
- Ensure your reverse proxy supports SSE.

---

Once the env variables are populated, the system is ready for beta: auth, giving, receipts, reconciliation, text‑to‑give, and communications will work end‑to‑end. See `docs/ENV_CHECKLIST.md` for the consolidated per-environment checklist.
