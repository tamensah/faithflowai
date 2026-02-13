# FaithFlow AI Third‑Party Configuration (Alpha Go‑Live)

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

## 2. Stripe (USD Giving + Payouts)

**Goal**: enable card giving, recurring donations, and payout reconciliation.

- Create a Stripe account and enable Checkout.
- Create a webhook endpoint:
  - `POST /webhooks/stripe`
  - Events used: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `checkout.session.async_payment_failed`, `charge.refunded`, `refund.created`, `refund.updated`, `refund.failed`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`.
- Required env:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`

## 3. Paystack (Local/African Giving + Settlements)

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
- Required env:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_SMS_NUMBER`
  - `TWILIO_WHATSAPP_NUMBER` (for WhatsApp outbound)
  - `TWILIO_WEBHOOK_URL` (if you need strict signature validation behind a proxy)

Optional communications policy env:

- `COMMS_QUIET_HOURS_ENABLED` (defaults to `true`)
- `COMMS_QUIET_START_HOUR` (defaults to `21`)
- `COMMS_QUIET_END_HOUR` (defaults to `7`)
- `COMMS_QUIET_RESCHEDULE_INCREMENT_MINUTES` (defaults to `30`)
- `COMMS_UNSUBSCRIBE_SECRET` (required to generate/verify one-click unsubscribe links)

When enabled, queued SMS/WhatsApp messages are automatically deferred out of quiet hours using the church timezone.

## 5. Resend (Email Delivery)

**Goal**: enable receipts, outbound email communications, and marketing contact form delivery.

- Create a Resend account.
- Verify sending domain (DNS records for DKIM/SPF).
- Required env:
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL` (e.g., `FaithFlow AI <no-reply@yourdomain>`)
  - `CONTACT_TO_EMAIL` (where marketing site contact messages should be delivered)

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

## 9. Database (Postgres)

- Provision Postgres (Neon, Supabase, RDS, etc.).
- Set `DATABASE_URL`.
- Run:
  - `pnpm db:migrate`
  - `pnpm db:seed`

## 10. App URLs / CORS

- Set allowed origins in `ALLOWED_ORIGINS`.
- Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WEB_URL` for QR links and public redirects.

## 11. External Integrations (OpenAPI)

- Set `INTEGRATION_API_KEY` for API key–based integrations.
- Use headers:
  - `x-api-key`: integration key
  - `x-clerk-org-id` or `x-tenant-id`: tenant scoping
- Dispatch scheduled comms (cron): `POST /tasks/communications/dispatch` with `x-api-key`.
- Monitor disputes (cron): `POST /tasks/disputes/monitor` with `x-api-key`.
- Volunteer reminders (cron): `POST /tasks/volunteer/reminders` with `x-api-key`.
- Volunteer staffing gap alerts (cron): `POST /tasks/volunteer/gap-alerts` with `x-api-key`.
- Subscription metadata backfill (cron): `POST /tasks/subscriptions/metadata-backfill` with `x-api-key`.
- Tenant domain + SSL automation (cron): `POST /tasks/tenant-ops/automate` with `x-api-key`.
- Support SLA sweep (cron): `POST /tasks/support/sla` with `x-api-key`.

### Default cadence (recommended)

- `POST /tasks/support/sla`: every 5 minutes
- `POST /tasks/tenant-ops/automate`: every 15 minutes
- `POST /tasks/subscriptions/metadata-backfill`: daily at 02:10 UTC

### Optional internal scheduler

If you prefer in-process scheduling (single-instance only), set:

- `ENABLE_INTERNAL_SCHEDULER=true`
- `SCHEDULER_TIMEZONE=UTC`
- `CRON_SUPPORT_SLA_SWEEP=*/5 * * * *`
- `CRON_TENANT_OPS_AUTOMATE=*/15 * * * *`
- `CRON_SUBSCRIPTION_METADATA_BACKFILL=10 2 * * *`

See scheduler profiles: `/Users/tamensah/aihub/faithflow_ai/docs/SCHEDULER_PROFILES.md`.

## 12. Deployment (Render)

Recommended alpha backend deployment uses Render Blueprint:

- `render.yaml` (API web service + Postgres + cron jobs)
- `render.cron.yaml` (cron-only fallback if API is hosted elsewhere)

For Render cron services, set:

- `API_BASE_URL`
- `INTEGRATION_API_KEY`

## 13. Scheduler Alerts (GitHub Actions)

Optional but recommended repository secrets for scheduler failure notifications:

- `FAITHFLOW_ALERT_SLACK_WEBHOOK_URL`
- `FAITHFLOW_ALERT_RESEND_API_KEY`
- `FAITHFLOW_ALERT_EMAIL_FROM`
- `FAITHFLOW_ALERT_EMAIL_TO`

## 14. Optional: Realtime + Webhooks

- `GET /stream` requires a Clerk JWT in the Authorization header or query string.
- Ensure your reverse proxy supports SSE.

---

Once the env variables are populated, the system is ready for alpha: auth, giving, receipts, reconciliation, text‑to‑give, and communications will work end‑to‑end.
