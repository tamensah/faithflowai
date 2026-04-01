# FaithFlow AI — Beta Go-Live Environment Variable Checklist

> Use this as the single source of truth before promoting to production.
> Fill in the Status column for each environment: ✅ Set · ⚠️ Placeholder · ❌ Missing

**Environments:** `dev` (local) · `staging` (Render/Vercel preview) · `prod` (Render/Vercel production)

---

## Legend

| Symbol | Meaning |
|--------|---------|
| 🔴 REQUIRED | Must be set before beta launch. Platform will not function without this. |
| 🟡 RECOMMENDED | Needed for full feature set. Launch possible without it but functionality is degraded. |
| 🟢 OPTIONAL | Nice to have. Enables add-on features or advanced config. |

---

## 1. API Service (`apps/api`)

> Deployed on Render. Set in Render Environment → Environment Variables.

### Core

| Variable | Gate | Notes | dev | staging | prod |
|----------|------|-------|-----|---------|------|
| `NODE_ENV` | 🔴 | Set to `production` in staging/prod | ✅ | | |
| `PORT` | 🔴 | Default `4000` if unset | ✅ | | |
| `DATABASE_URL` | 🔴 | Postgres connection string | ✅ | | |
| `ALLOWED_ORIGINS` | 🔴 | Comma-separated list of web + admin URLs | ✅ | | |
| `ALLOWED_CHECKOUT_REDIRECT_ORIGINS` | 🔴 | Comma-separated trusted origins for Stripe/Paystack return URLs | ✅ | | |
| `NEXT_PUBLIC_WEB_URL` | 🔴 | Web app public URL — used in email links, QR codes | ✅ | | |
| `NEXT_PUBLIC_ADMIN_URL` | 🔴 | Admin console URL — used in email links | ✅ | | |
| `NEXT_PUBLIC_API_URL` | 🔴 | API URL — used internally | ✅ | | |
| `STREAM_SIGNING_SECRET` | 🔴 | Signs short-lived live-feed stream tokens | ✅ | | |
| `RECEIPT_PUBLIC_SECRET` | 🔴 | Signs public donation receipt access links | ✅ | | |

### Clerk

| Variable | Gate | Notes | dev | staging | prod |
|----------|------|-------|-----|---------|------|
| `CLERK_SECRET_KEY` | 🔴 | Server-side secret (starts `sk_`) | ✅ | | |
| `CLERK_JWT_KEY` | 🔴 | PEM public key for JWT verification | ✅ | | |
| `CLERK_JWT_ISSUER` | 🔴 | Issuer URL from Clerk Dashboard | ✅ | | |
| `CLERK_JWT_AUDIENCE` | 🔴 | Audience string (e.g. `faithflow-api`) | ✅ | | |
| `CLERK_WEBHOOK_SECRET` | 🔴 | Svix signing secret for `/webhooks/clerk` | ✅ | | |
| `PLATFORM_ADMIN_EMAILS` | 🔴 | Comma-separated emails that get platform-admin role | ✅ | | |
| `AUTH_POLICY_ENFORCE_SSO_STRICT` | 🟢 | Set `true` to hard-block non-SSO tokens when tenant policy enforces SSO | | | |

### Payments — Stripe

| Variable | Gate | Notes | dev | staging | prod |
|----------|------|-------|-----|---------|------|
| `STRIPE_SECRET_KEY` | 🔴 | Stripe secret key (starts `sk_`) | ✅ | | |
| `STRIPE_WEBHOOK_SECRET` | 🔴 | Signing secret for `/webhooks/stripe` | ✅ | | |
| `PLATFORM_STRIPE_WEBHOOK_SECRET` | 🔴 | Separate secret for platform-level Stripe webhook | ✅ | | |

### Payments — Paystack

| Variable | Gate | Notes | dev | staging | prod |
|----------|------|-------|-----|---------|------|
| `PAYSTACK_SECRET_KEY` | 🔴 | Paystack secret key | ✅ | | |
| `PAYSTACK_WEBHOOK_SECRET` | 🟡 | Falls back to secret key if unset | ✅ | | |
| `PLATFORM_PAYSTACK_WEBHOOK_SECRET` | 🔴 | Separate secret for platform-level Paystack webhook | ✅ | | |

### Email — Resend

| Variable | Gate | Notes | dev | staging | prod |
|----------|------|-------|-----|---------|------|
| `RESEND_API_KEY` | 🔴 | Resend API key — receipts, transactional, campaigns | ✅ | | |
| `RESEND_FROM_EMAIL` | 🔴 | Verified sending address (e.g. `no-reply@faithflow.ai`) | ✅ | | |

### SMS / WhatsApp — Twilio

| Variable | Gate | Notes | dev | staging | prod |
|----------|------|-------|-----|---------|------|
| `TWILIO_ACCOUNT_SID` | 🟡 | Required for SMS/WhatsApp comms | ✅ | | |
| `TWILIO_AUTH_TOKEN` | 🟡 | Required for SMS/WhatsApp comms | ✅ | | |
| `TWILIO_SMS_NUMBER` | 🟡 | Phone number for outbound SMS and text-to-give | ✅ | | |
| `TWILIO_WHATSAPP_NUMBER` | 🟡 | WhatsApp sender number | ✅ | | |
| `TWILIO_WEBHOOK_URL` | 🟡 | Public URL for Twilio signature validation | ✅ | | |
| `COMMS_QUIET_HOURS_ENABLED` | 🟢 | Defaults `true` | | | |
| `COMMS_QUIET_START_HOUR` | 🟢 | Defaults `21` (9 PM) | | | |
| `COMMS_QUIET_END_HOUR` | 🟢 | Defaults `7` (7 AM) | | | |
| `COMMS_UNSUBSCRIBE_SECRET` | 🔴 | Required for one-click unsubscribe links in emails | | | |

### Push Notifications — FCM

| Variable | Gate | Notes | dev | staging | prod |
|----------|------|-------|-----|---------|------|
| `FCM_SERVER_KEY` | 🟡 | Firebase Cloud Messaging server key | ✅ | | |

### File Storage

| Variable | Gate | Notes | dev | staging | prod |
|----------|------|-------|-----|---------|------|
| `STORAGE_PROVIDER` | 🔴 | `S3` or `GCS` | ✅ | | |
| `UPLOAD_MAX_BYTES` | 🟢 | Defaults to 25 MB | ✅ | | |
| **If S3:** | | | | | |
| `S3_BUCKET` | 🔴 | Bucket name | ✅ | | |
| `S3_REGION` | 🔴 | AWS region | ✅ | | |
| `S3_ACCESS_KEY_ID` | 🔴 | IAM access key | ✅ | | |
| `S3_SECRET_ACCESS_KEY` | 🔴 | IAM secret | ✅ | | |
| `S3_PUBLIC_URL` | 🟡 | CloudFront or custom domain for public file URLs | ✅ | | |
| **If GCS:** | | | | | |
| `GCS_BUCKET` | 🔴 | Bucket name | | | |
| `GCS_PROJECT_ID` | 🔴 | GCP project ID | | | |
| `GCS_CLIENT_EMAIL` | 🔴 | Service account email | | | |
| `GCS_PRIVATE_KEY` | 🔴 | Service account private key (escape `\n`) | | | |

### AI

| Variable | Gate | Notes | dev | staging | prod |
|----------|------|-------|-----|---------|------|
| `OPENAI_API_KEY` | 🟡 | Required for OpenAI-backed AI features | ✅ | | |
| `ANTHROPIC_API_KEY` | 🟡 | Required for Claude-backed AI features | ✅ | | |
| `GOOGLE_API_KEY` | 🟢 | Required for Gemini-backed AI features | | | |
| `AI_OPENAI_MODEL` | 🟢 | Default `gpt-4o-mini` | | | |
| `AI_ANTHROPIC_MODEL` | 🟢 | Default `claude-3-5-sonnet-latest` | | | |

### Live Streaming (Add-on)

| Variable | Gate | Notes | dev | staging | prod |
|----------|------|-------|-----|---------|------|
| `YOUTUBE_API_KEY` | 🟢 | YouTube Data API v3 — enables viewer counts + status sync | | | |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | 🟢 | Long-lived Page Access Token | | | |
| `VIMEO_ACCESS_TOKEN` | 🟢 | Personal Access Token with `video_files`, `live_events` scopes | | | |
| `STREAMING_SYNC_HTTP_TIMEOUT_MS` | 🟢 | HTTP probe timeout, default `3000` | | | |

### Integrations / Cron

| Variable | Gate | Notes | dev | staging | prod |
|----------|------|-------|-----|---------|------|
| `INTEGRATION_API_KEY` | 🔴 | API key for all cron task endpoints (`x-api-key` header) | ✅ | | |
| `API_BASE_URL` | 🔴 | Used by Render cron services to call task endpoints | | | |
| `ENABLE_INTERNAL_SCHEDULER` | 🟢 | `true` for single-instance in-process cron (dev only) | ✅ | | |
| `SCHEDULER_TIMEZONE` | 🟢 | Default `UTC` | | | |
| `DOMAIN_PENDING_ESCALATION_HOURS` | 🟢 | Default `24` | | | |

---

## 2. Web App (`apps/web`)

> Deployed on Vercel. Set in Vercel → Project → Settings → Environment Variables.

| Variable | Gate | Notes | dev | staging | prod |
|----------|------|-------|-----|---------|------|
| `NEXT_PUBLIC_API_URL` | 🔴 | API base URL | ✅ | | |
| `NEXT_PUBLIC_WEB_URL` | 🔴 | This app's own public URL | ✅ | | |
| `NEXT_PUBLIC_ADMIN_URL` | 🔴 | Admin console URL — used in onboarding redirect after checkout | ✅ | | |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | 🔴 | Clerk publishable key (starts `pk_`) | ✅ | | |
| `CLERK_SECRET_KEY` | 🔴 | Clerk secret key (server-side) | ✅ | | |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | 🔴 | Set to `/sign-in` | ✅ | | |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | 🔴 | Set to `/sign-up` | ✅ | | |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | 🔴 | Set to `/portal` | ✅ | | |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | 🔴 | Set to `/get-started` | ✅ | | |
| `NEXT_PUBLIC_CLERK_JWT_TEMPLATE` | 🟡 | Custom JWT template name (e.g. `faithflow-api`) | | | |
| `RESEND_API_KEY` | 🔴 | For contact form email delivery | | | |
| `RESEND_FROM_EMAIL` | 🔴 | Verified sending address for contact form | | | |
| `CONTACT_TO_EMAIL` | 🔴 | Recipient address for contact form submissions | | | |

---

## 3. Admin App (`apps/admin`)

> Deployed on Vercel. Set in Vercel → Project → Settings → Environment Variables.

| Variable | Gate | Notes | dev | staging | prod |
|----------|------|-------|-----|---------|------|
| `NEXT_PUBLIC_API_URL` | 🔴 | API base URL | ✅ | | |
| `NEXT_PUBLIC_WEB_URL` | 🔴 | Web app URL — used for portal links shown to admins | ✅ | | |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | 🔴 | Clerk publishable key | ✅ | | |
| `CLERK_SECRET_KEY` | 🔴 | Clerk secret key | ✅ | | |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | 🔴 | Set to `/sign-in` | ✅ | | |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | 🔴 | Set to `/` | ✅ | | |
| `NEXT_PUBLIC_CLERK_JWT_TEMPLATE` | 🟡 | Custom JWT template name | | | |

---

## 4. Beta Go-Live Gate

All items below must be ✅ before flipping any church to production.

### Minimum viable (hard blockers)

- [ ] `DATABASE_URL` configured and migrations run (`pnpm db:migrate && pnpm db:seed`)
- [ ] `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`, `CLERK_WEBHOOK_SECRET` set on API
- [ ] Clerk webhook registered: `POST /webhooks/clerk` → `organization.created`
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` set on web and admin apps
- [ ] Clerk routing env vars set on web (`/sign-in`, `/sign-up`, fallback URLs)
- [ ] `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` set; all 13 webhook events registered
- [ ] `PAYSTACK_SECRET_KEY` + `PAYSTACK_WEBHOOK_SECRET` set; webhook URL registered
- [ ] `RESEND_API_KEY` + `RESEND_FROM_EMAIL` set; sending domain verified (DKIM/SPF)
- [ ] `CONTACT_TO_EMAIL` set on web app
- [ ] `COMMS_UNSUBSCRIBE_SECRET` set on API
- [ ] `STORAGE_PROVIDER` + bucket credentials set; upload test passing in go-live checks
- [ ] `INTEGRATION_API_KEY` set; all cron jobs registered and firing
- [ ] `ALLOWED_ORIGINS` includes production web and admin URLs
- [ ] `NEXT_PUBLIC_WEB_URL` and `NEXT_PUBLIC_ADMIN_URL` set correctly on API
- [ ] Go-live checklist (`/operations/health`) shows no MISSING items for a test tenant

### Recommended before launch

- [ ] `TWILIO_ACCOUNT_SID/AUTH_TOKEN/SMS_NUMBER` set; SMS test sent successfully
- [ ] `FCM_SERVER_KEY` set; push test sent successfully
- [ ] At least one AI key set (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`)
- [ ] `PLATFORM_ADMIN_EMAILS` includes all platform admin email addresses
- [ ] Stripe Customer Portal configured (branding, allowed features)
- [ ] Paystack webhook tested end-to-end with a real transaction

### Can launch without (Phase 2)

- [ ] WhatsApp sender approved + `TWILIO_WHATSAPP_NUMBER` set
- [ ] YouTube / Facebook / Vimeo streaming credentials (streaming add-on)
- [ ] GitHub Actions scheduler alert secrets (`FAITHFLOW_ALERT_*`)
- [ ] Custom domain + SSL configured per-tenant

---

*Last updated: March 2025 · Cross-reference: `docs/THIRDPARTY_CONFIG.md`*
