# FaithFlow AI Security Review

Date: 2026-04-01

Scope reviewed:
- `/Users/tamensah/aihub/faithflow_ai/apps/api`
- `/Users/tamensah/aihub/faithflow_ai/apps/admin`
- `/Users/tamensah/aihub/faithflow_ai/apps/web`
- `/Users/tamensah/aihub/faithflow_ai/packages/api`

Review method:
- Read-only source audit of auth, tenant scoping, billing, webhook, realtime, public endpoint, and admin-surface code.
- No exploit execution against live environments.

## Prioritized findings

### 1. Critical - tRPC auth can be bypassed with trusted headers

Files:
- `/Users/tamensah/aihub/faithflow_ai/apps/api/src/context.ts`
- `/Users/tamensah/aihub/faithflow_ai/packages/api/src/trpc.ts`

Evidence:
- `createContext()` falls back to `x-user-id` when no bearer token is present and trusts `x-clerk-org-id` / `x-tenant-id` for tenant resolution.
- `protectedProcedure` and `userProcedure` only require `ctx.userId` / `ctx.tenantId`.

Why this matters:
- Any caller that can reach `/trpc` can forge `x-user-id` and `x-clerk-org-id` headers and be treated as an authenticated tenant user.
- That is enough to reach protected mutations, bootstrap empty tenants, create or mutate tenant data, and potentially impersonate known Clerk users.

Recommended fix:
- Remove the `x-user-id` fallback entirely from request auth context.
- Derive user identity only from a successfully verified Clerk token.
- Treat `x-clerk-org-id` as advisory only when it matches token claims or verified Clerk membership.
- Add regression tests that assert unauthenticated `/trpc` requests cannot set identity via headers.

### 2. High - Admin-scope tenant mutations are missing staff/admin RBAC

Files:
- `/Users/tamensah/aihub/faithflow_ai/packages/api/src/router/organization.ts`
- `/Users/tamensah/aihub/faithflow_ai/packages/api/src/router/campus.ts`
- `/Users/tamensah/aihub/faithflow_ai/packages/api/src/router/fund.ts`

Evidence:
- `organization.create` is guarded only by `protectedProcedure`.
- `campus.create` / `campus.update` are guarded only by `protectedProcedure`.
- `fund.create` is guarded only by `protectedProcedure`.

Why this matters:
- Once a user has tenant context, these routes allow sensitive structural or financial mutations without an explicit staff or admin role check.
- That creates privilege escalation from ordinary authenticated tenant users or low-privilege staff into admin operations.

Recommended fix:
- Introduce a shared tenant RBAC middleware, for example `requireTenantStaff` and `requireTenantAdmin`.
- Apply it consistently to all org, campus, fund, billing, finance, ops, and tenant-management mutation routes.
- Add tests for a non-admin tenant user attempting these mutations.

### 3. High - Platform super-admin can be claimed by the first signed-in user when allowlisting is unset

File:
- `/Users/tamensah/aihub/faithflow_ai/packages/api/src/router/platform.ts`

Evidence:
- `platform.self` and `platform.bootstrap` allow first-user bootstrap when `PLATFORM_ADMIN_EMAILS` is empty and no platform users exist.

Why this matters:
- In a fresh deployment, any authenticated Clerk user who reaches the platform console first can self-assign `SUPER_ADMIN`.
- This is a platform takeover risk caused by an insecure bootstrap default.

Recommended fix:
- Require `PLATFORM_ADMIN_EMAILS` or a one-time bootstrap secret in non-development environments.
- Refuse first-user bootstrap in production when the allowlist is empty.
- Audit existing environments for whether platform bootstrap was already claimed.

### 4. High - Public donation receipts are guessable and expose donor PII and payment references

Files:
- `/Users/tamensah/aihub/faithflow_ai/packages/api/src/receipts.ts`
- `/Users/tamensah/aihub/faithflow_ai/apps/api/src/server.ts`

Evidence:
- Receipt numbers are date-prefixed with only a 4-character `Math.random()` nonce.
- `/public/receipts/:receiptNumber` serves receipt HTML without auth, secondary secret, or route-specific rate limit.
- Receipt HTML includes donor email, phone, amount, and provider reference.

Why this matters:
- Attackers can enumerate plausible receipt numbers for a date range and retrieve donor PII.
- Provider references should not be exposed publicly.

Recommended fix:
- Replace receipt-number-only access with signed receipt links or a high-entropy access token.
- Remove donor phone, donor email, and provider reference from public receipt pages.
- Add route-specific rate limiting and anomaly logging for receipt lookups.
- Use a cryptographically secure receipt identifier if public lookup must remain.

### 5. Medium - Receipt HTML is built from unescaped user-controlled values

File:
- `/Users/tamensah/aihub/faithflow_ai/packages/api/src/receipts.ts`

Evidence:
- `renderReceiptHtml()` interpolates `church.name`, `donorName`, `donorEmail`, `donorPhone`, and `providerRef` directly into HTML.

Why this matters:
- Stored HTML injection is possible through donation or church fields.
- On the public receipt page this can become browser-side XSS on the API origin.

Recommended fix:
- HTML-escape all interpolated values before rendering.
- Prefer a templating helper that escapes by default.
- Add tests with payloads containing `<`, `>`, quotes, and event-handler strings.

### 6. Medium - Realtime auth tokens are placed in the URL query string

Files:
- `/Users/tamensah/aihub/faithflow_ai/apps/admin/src/app/live/page.tsx`
- `/Users/tamensah/aihub/faithflow_ai/apps/api/src/server.ts`

Evidence:
- The admin live page builds `/stream?token=...`.
- The API accepts the bearer token from the query string.

Why this matters:
- URL tokens leak into browser history, reverse-proxy logs, observability tools, and potentially `Referer` headers.
- This unnecessarily exposes live session credentials.

Recommended fix:
- Stop accepting auth tokens in the query string.
- Move realtime auth to a short-lived signed stream ticket or an authenticated fetch-to-SSE bridge.
- Redact query strings from any existing request logging until the change is deployed.

### 7. Medium - Public and ticket checkout flows accept arbitrary redirect URLs

Files:
- `/Users/tamensah/aihub/faithflow_ai/packages/api/src/payments/inputs.ts`
- `/Users/tamensah/aihub/faithflow_ai/packages/api/src/router/giving.ts`
- `/Users/tamensah/aihub/faithflow_ai/packages/api/src/router/event.ts`
- `/Users/tamensah/aihub/faithflow_ai/packages/api/src/payments/index.ts`
- `/Users/tamensah/aihub/faithflow_ai/packages/api/src/router/billing.ts`

Evidence:
- Public giving and event ticket checkout accept arbitrary absolute `successUrl` / `cancelUrl`.
- Those URLs are passed directly to Stripe and Paystack.
- Billing already has an allowed-origin validator, but donation and ticket flows do not.

Why this matters:
- A malicious client can generate legitimate checkout sessions that return donors to attacker-controlled domains.
- This creates a phishing and brand-trust problem immediately after payment.

Recommended fix:
- Reuse the billing redirect allowlist validation for donation, recurring, and ticket checkout flows.
- Ideally resolve success/cancel URLs server-side from trusted tenant or platform configuration instead of client input.

## Verification gaps and residual risk

- No app-level CSP, HSTS, or related security headers were defined in:
  - `/Users/tamensah/aihub/faithflow_ai/apps/admin/next.config.mjs`
  - `/Users/tamensah/aihub/faithflow_ai/apps/web/next.config.mjs`
  This may be handled at the edge, but it should be verified explicitly in deployment configuration and runtime responses.
- Clerk JWT issuer/audience env vars exist in config and docs, but the API auth path currently verifies tokens via `verifyToken(..., { secretKey })`. Confirm the intended production token validation model and align docs, env requirements, and code.

## Recommended remediation order

1. Remove header-based identity fallback from `/trpc` context and ship auth regression tests.
2. Lock down admin-scope mutation routers with shared tenant RBAC middleware.
3. Disable insecure first-user platform bootstrap in production.
4. Replace public receipt lookup with signed access and escape receipt HTML output.
5. Remove query-string auth from realtime and restrict checkout redirect URLs to trusted origins.
