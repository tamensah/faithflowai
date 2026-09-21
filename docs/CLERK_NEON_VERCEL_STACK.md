# Clerk + Neon + Vercel Reference

ChurchTrack uses one Clerk project per environment across the web application, admin application, and Neon Function API.

## Surface ownership

| Component | Responsibility |
| --- | --- |
| Clerk | users, sessions, organizations, organization memberships |
| Vercel web | marketing pages and member portal |
| Vercel admin | church administration and platform operations |
| Neon Function | token verification, authorization, tenant provisioning, API and webhooks |
| Neon Postgres | ChurchTrack tenant, church, member, role, billing, and audit data |

## Shared Clerk project rule

The two Vercel applications must use the same values for:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_JWT_TEMPLATE`, when enabled

The Neon Function must use the matching `CLERK_SECRET_KEY`. A token minted by a different Clerk instance will fail verification even if the user has the same email address.

This is an environment-level requirement:

- all `develop` previews share the staging Clerk project;
- all `main` deployments share the production Clerk project;
- staging and production Clerk data remain separate.

## Organization and tenant flow

1. A visitor signs up or signs in through Clerk.
2. The user creates or selects a Clerk organization.
3. The frontend sends the Clerk bearer token and active organization context to the Neon API.
4. The API verifies the token with `CLERK_SECRET_KEY`.
5. The first authorized request provisions the ChurchTrack tenant, organization, church, and main campus for the Clerk organization.
6. Role claims and persisted staff assignments determine access to church-admin and platform operations features.

An authenticated user with no active organization should see an onboarding action, not a dashboard that can only return authorization errors.

## Vercel variables

Set these on both `faithflow-web` and `faithflow-admin` for the appropriate environment:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_JWT_TEMPLATE` if used
- application-specific sign-in/sign-up and fallback redirect URLs
- `NEXT_PUBLIC_API_URL` pointing at the matching Neon Function

The web app normally redirects a new user to `/get-started`; the admin app redirects to its dashboard/onboarding flow.

## Neon Function variables

- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET` when organization provisioning webhooks are enabled
- optional `CLERK_JWT_KEY`, `CLERK_JWT_ISSUER`, and `CLERK_JWT_AUDIENCE` for a reviewed custom JWT policy
- `ALLOWED_ORIGINS` containing the exact web and admin origins

Deploy variables through the protected environment file described in [`DEPLOYMENT_MANUAL.md`](./DEPLOYMENT_MANUAL.md).

## Clerk webhook

Register:

`POST https://<stable-api-domain>/webhooks/clerk`

Store the Svix signing secret as `CLERK_WEBHOOK_SECRET`. The handler provisions a tenant for `organization.created` and must remain replay-safe.

## Domain behavior

Use Vercel provider domains for private staging only. Before a public production launch, configure real ChurchTrack domains in Clerk and use the matching web, admin, and API custom domains.

## Troubleshooting

### Token verifies in one app but fails in the other

Compare the Clerk publishable-key project and secret-key project across both Vercel deployments and the Neon Function. Align all three to the same environment.

### Signed in but “no role claims” appears

Confirm an active Clerk organization, its organization membership, and the ChurchTrack staff assignment. Then sign out and back in so the session carries the current organization context.

### Browser reports a CORS error

Add the exact frontend origin to `ALLOWED_ORIGINS`, redeploy the Neon Function with the complete environment file, and verify the preflight response.

### The API is reachable but onboarding fails

Check `/ready`. A 200 response confirms the function is connected to the `faithflow_canonical` schema. Then inspect fresh Function logs for token or provisioning failures.
