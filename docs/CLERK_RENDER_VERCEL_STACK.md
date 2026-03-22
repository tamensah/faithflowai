# Clerk + Render + Vercel Stack — Gotchas & Reference

Hard-won lessons from shipping FaithFlow AI on this stack. Read this before setting up a new project.

---

## 1. Clerk Instance Types — The Most Important Decision

Clerk has two instance types and the difference matters from day one.

| | Development | Production |
|---|---|---|
| Key prefix | `pk_test_` / `sk_test_` | `pk_live_` / `sk_live_` |
| Primary domain | localhost | Your actual domain |
| Allowed subdomains | **Not available** | `*.yourdomain.com` wildcard |
| Vercel preview URLs | Broken (cross-domain handshake fails) | Requires custom domain |
| Provider domains (*.vercel.app) | Not supported | **Not supported either** |
| User-facing banner | Shows "development mode" warning | None |
| Rate limits | Tight | Production limits |

**The core rule:** Clerk production instances require a real domain (e.g. `app.yourdomain.com`). Neither instance type accepts `*.vercel.app` or `*.onrender.com` as a primary or allowed domain — Clerk calls these "provider domains" and blocks them via their Platform API restriction.

### Practical setup for the Clerk + Vercel + Render stack

```
Local dev    → Clerk development instance (pk_test_)
Staging      → Clerk production instance → custom subdomain e.g. staging.yourdomain.com
Production   → Clerk production instance → custom domain e.g. app.yourdomain.com
```

Buy the domain early. It unblocks everything else.

---

## 2. Clerk + Next.js 16 — Middleware Filename

Next.js 16 changed the middleware filename from `middleware.ts` to `proxy.ts`.

- **Next.js ≤15**: middleware file is `src/middleware.ts`
- **Next.js 16+**: middleware file is `src/proxy.ts`

Having **both files** causes a build error:
```
Error: Both middleware file "./src/src/middleware.ts" and proxy file
"./src/src/proxy.ts" are detected. Please use "./src/src/proxy.ts" only.
```

The Clerk docs sometimes show the middleware logic inside `middleware.ts`. In a Next.js 16 project, that same logic goes in `proxy.ts`. The filename is a Next.js convention — Clerk doesn't control it.

### Recommended proxy.ts for Clerk v7 (Core 3)

```ts
import { clerkMiddleware } from '@clerk/nextjs/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const baseMiddleware = clerkMiddleware();

function isHandshakeVerificationError(error: unknown) {
  return error instanceof Error && error.message.includes('Handshake token verification failed');
}

export default async function proxy(req: NextRequest, event: NextFetchEvent) {
  try {
    return await baseMiddleware(req, event);
  } catch (error) {
    if (req.nextUrl.searchParams.has('__clerk_handshake') && isHandshakeVerificationError(error)) {
      const url = req.nextUrl.clone();
      url.searchParams.delete('__clerk_handshake');
      return NextResponse.redirect(url);
    }
    throw error;
  }
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

---

## 3. Clerk v7 (Core 3) — Breaking Changes from v6

### getToken() now throws instead of returning null

In Clerk v6, `getToken()` returned `null` when there was no session. In v7 it throws. Always wrap it:

```ts
let token: string | null = null;
try {
  token = await getToken(tokenTemplate ? { template: tokenTemplate } : undefined);
} catch {
  // throws in Core 3 when offline, session invalid, or cross-domain sync fails
}
```

### JWT templates — verify they exist before using

Setting `NEXT_PUBLIC_CLERK_JWT_TEMPLATE` to a template name that doesn't exist in the Clerk dashboard causes every `getToken()` call to 404. The symptom looks like auth is broken globally. Remove the env var if you're not using a custom template.

### SignedIn / SignedOut components deprecated

Use the `Show` component from `@clerk/nextjs` instead:

```tsx
// v6
<SignedIn><UserButton /></SignedIn>

// v7
<Show when="signed-in"><UserButton /></Show>
```

Run the upgrade codemod to fix these automatically:
```bash
npx @clerk/upgrade --dir=./apps/web --sdk=nextjs
```

### afterSignOutUrl moved to ClerkProvider

```tsx
// v6 — on UserButton
<UserButton afterSignOutUrl="/" />

// v7 — on ClerkProvider
<ClerkProvider afterSignOutUrl="/">
  ...
</ClerkProvider>
```

### Token verification — use @clerk/backend SDK

Don't verify JWTs manually with SPKI/JWK — the required env vars (`CLERK_JWT_KEY`, `CLERK_JWT_ISSUER`, `CLERK_JWT_AUDIENCE`) are painful to configure and break on key rotation. Use the SDK:

```ts
import { verifyToken } from '@clerk/backend';

export async function verifyClerkToken(token: string) {
  if (!env.CLERK_SECRET_KEY) return null;
  try {
    const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
    return payload;
  } catch {
    return null;
  }
}
```

Only `CLERK_SECRET_KEY` is needed — the SDK handles key rotation automatically.

---

## 4. Render — Environment Variables via REST API

The Render CLI (v2.1.4) has no `env` command. Use the REST API directly.

**Base URL:** `https://api.render.com/v1/`
**Auth:** `Authorization: Bearer <api_key>`
**API key location:** `~/.render/cli.yaml` → `api.key`

### Get all env vars for a service
```bash
curl "https://api.render.com/v1/services/$SERVICE_ID/env-vars?limit=100" \
  -H "Authorization: Bearer $RENDER_KEY"
```

### CRITICAL — PUT replaces ALL env vars

`PUT /services/{id}/env-vars` is destructive. It **replaces the entire env var set** with whatever you send. Always include every variable in the payload, not just the one you're changing.

```bash
# WRONG — wipes all other vars
curl -X PUT ".../env-vars" -d '[{"key":"ALLOWED_ORIGINS","value":"..."}]'

# RIGHT — include all vars
curl -X PUT ".../env-vars" -d '[
  {"key":"NODE_ENV","value":"production"},
  {"key":"DATABASE_URL","value":"..."},
  {"key":"ALLOWED_ORIGINS","value":"..."},
  ... all others ...
]'
```

### Get the Render Postgres connection string
```bash
curl "https://api.render.com/v1/postgres/$DB_ID/connection-info" \
  -H "Authorization: Bearer $RENDER_KEY"
```

Returns `internalConnectionString`, `externalConnectionString`, and `password`. Use `internalConnectionString` for services in the same Render region.

### CORS — ALLOWED_ORIGINS

Set `ALLOWED_ORIGINS` on the API service to a comma-separated list of all frontend origins:

```
https://app.yourdomain.com,https://admin.yourdomain.com,http://localhost:3000,http://localhost:3001
```

CORS failures surface as `No 'Access-Control-Allow-Origin' header` in the browser — not as auth errors. Check CORS first when API calls fail from a new domain.

---

## 5. Vercel — Environment Variables via CLI

```bash
# Add/update for all environments
vercel env add VAR_NAME production
vercel env add VAR_NAME preview
vercel env add VAR_NAME development

# Remove
vercel env rm VAR_NAME production

# List
vercel env ls
```

Link the project first: `vercel link` inside the app directory.

---

## 6. Gitflow + Multi-Environment Clerk Pairing

The typical Vercel gitflow:
- `main` → production deployment
- `develop` → preview deployment (e.g. `web-git-develop-yourteam.vercel.app`)

Clerk cannot be paired with Vercel preview URLs as primary domains — you need a real domain at every level. The working pattern:

| Branch | Vercel URL | Custom Domain | Clerk Instance |
|--------|-----------|---------------|----------------|
| `develop` | (preview) | `staging.yourdomain.com` | Production instance |
| `main` | (production) | `app.yourdomain.com` | Production instance |

Configure Vercel custom domains in **Project → Settings → Domains**. The preview URL still exists but use the custom domain for Clerk auth flows.

Use **separate Clerk applications** for staging vs production if you want isolated user databases — or use the same application with environment-specific JWT templates.

---

## 7. Environment Variable Checklist — New Project

### Vercel (web app)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY   pk_live_...
CLERK_SECRET_KEY                    sk_live_...
NEXT_PUBLIC_API_URL                 https://api.yourdomain.com
NEXT_PUBLIC_ADMIN_URL               https://admin.yourdomain.com
```

Do NOT set `NEXT_PUBLIC_CLERK_JWT_TEMPLATE` unless you have created that template in the Clerk dashboard.

### Render (API)
```
NODE_ENV                            production
PORT                                10000
DATABASE_URL                        postgresql://... (internal connection string)
ALLOWED_ORIGINS                     https://app.yourdomain.com,https://admin.yourdomain.com
CLERK_SECRET_KEY                    sk_live_...
CLERK_WEBHOOK_SECRET                whsec_...
PLATFORM_ADMIN_EMAILS               your@email.com
```

### Clerk Dashboard
- Webhook URL: `https://api.yourdomain.com/webhooks/clerk`
- Events to subscribe: `organization.created`, `user.created` (at minimum)
- Signing secret → `CLERK_WEBHOOK_SECRET` on Render

---

## 8. Debugging Auth 401s — Decision Tree

```
401 on API calls?
│
├── Is CORS the issue?
│   Check: does the browser console show "No Access-Control-Allow-Origin"?
│   Fix: add the frontend origin to ALLOWED_ORIGINS on Render (PUT all vars)
│
├── Is the Authorization header being sent?
│   Check: Network tab → request headers → look for "Authorization: Bearer ..."
│   Not sent → getToken() is returning null/throwing
│     ├── Clerk dev instance on non-localhost domain → cross-domain session sync failing
│     │   Fix: use a real domain + production Clerk instance
│     ├── NEXT_PUBLIC_CLERK_JWT_TEMPLATE set but template doesn't exist
│     │   Fix: remove the env var
│     └── proxy.ts middleware not running (wrong filename for Next.js version)
│         Fix: Next.js 16 = proxy.ts, Next.js ≤15 = middleware.ts
│
└── Header IS sent but still 401?
    Check: CLERK_SECRET_KEY on Render matches the Clerk project being used
    Check: verifyToken() implementation — use @clerk/backend SDK, not manual JWK
```
