# ChurchTrack Reconciliation Status — 2026-09-23

## Product identity

- The public product name is **ChurchTrack**.
- Product interfaces, authentication copy, transactional-email content, API titles, operational alerts, manuals, and current product documentation have been updated from the former FaithFlow name.
- The primary ChurchTrack domain has not been purchased. Documentation uses the reserved `churchtrack.example` domain for planning examples.
- The `@faithflow-ai/*` package scope, repository name, environment-variable names, `faithflow_canonical` database, and `faithflowapi` Neon Function slug remain service identifiers pending a coordinated migration.
- Vercel projects and `develop` aliases use `churchtrack-web` and `churchtrack-admin`. The preview cross-app URLs and Clerk route settings now point to ChurchTrack aliases without trailing newlines.
- Production `main` remains untouched. The rebrand is being validated through the normal feature branch → `develop` workflow.

## Polar sandbox

- Polar sandbox OAuth authorization completed successfully.
- Sandbox organization `churchtrack` (`5f70fd30-2aa3-4c9c-9994-c6abf4727668`) exists and is the staging billing organization.
- The ChurchTrack subscription adapter is implemented and tested for hosted checkout, customer portal, signed and idempotent webhooks, plan changes, cancellation, resume, and fail-closed status handling.
- `ChurchTrack Starter` is configured as a private USD 49/month product with a 14-day trial (`46305a55-da31-495f-98b0-e763a0ccc926`; price `ce9fe57b-8775-4bf1-bebf-2f4fed0abdbf`).
- `ChurchTrack Growth` is configured as a private USD 149/month product with a 14-day trial (`9db3247e-2ecb-4deb-b6ee-d9887e790b47`; price `5fc9a29b-83b1-46ce-b65e-3bc21b8e6ae1`).
- The enabled `ChurchTrack Staging Subscriptions` webhook (`41e4ae0e-91c6-472f-86f1-e80b7e8fef34`) points to the Neon Function and subscribes to the seven documented subscription lifecycle events.
- The canonical Starter and Growth plan rows contain the matching Polar product IDs. Enterprise remains a local sales-assisted plan without a Polar product.
- Neon Function deployment 11 contains the sandbox access token, webhook secret, and `POLAR_SERVER=sandbox` while preserving all previously deployed environment variables.
- The deployed access token is least-privilege and expires on 2026-10-21. Its granted scopes are `checkouts:write`, `customer_sessions:write`, `subscriptions:read`, and `subscriptions:write`.
- Polar currently shows an additional unused token with the same name expiring on 2026-12-20. It should be revoked after explicit credential-revocation approval.
- Enterprise remains sales-assisted and must not be created as a zero-price self-service product.

## Validation evidence

- Typecheck passed across API, web, and admin.
- Production builds passed across API, web, and admin.
- Lint completed with zero errors and 159 existing warnings.
- Production dependency audit reported no known vulnerabilities.
- API end-to-end suite passed 20 of 20 serially against the isolated Neon `develop` database.
- Focused Polar adapter suite passed 3 of 3.
- The initial parallel API run exposed a temporary-plan cleanup race; cleanup now removes subscriptions by tenant or temporary plan before deleting that plan.
- Neon Function deployment 11 completed with all expected environment-variable names present; protected values remain write-only.
- Live `/health` and `/ready` checks returned 200, and `/docs` reported `ChurchTrack API` version `0.0.1`.
- An unsigned Polar webhook request returned 403, confirming that deployed signature verification rejects untrusted payloads.
- The deployed token returned 200 from Polar's sandbox subscription-list endpoint and 403 from the ungranted product-list endpoint, confirming both validity and least-privilege enforcement.
- The stale `polar-growth-*` test plan had no subscriptions and was removed from the Neon `develop` database after approval.
- The admin `/sign-in` and `/sign-up` routes now render their Clerk forms outside the protected admin gate. Real-browser checks confirmed both forms on the merged `develop` deployment.
- Clean `develop`-specific Clerk route values now override inherited preview values that contained trailing newlines.
- The duplicate `/dashboard`, `/dashboard/payments`, and `/dashboard/comms` routes and their consoles have been removed. AI summary links point directly to the canonical overview, events, finance, and members routes.
- The Neon `develop` canonical database now has zero tenants, organizations, churches, users, staff memberships, and tenant subscriptions. One orphan Polar test tenant and its single audit entry were deleted; all three configured subscription plans remain.
- The shared Clerk development instance still contains six test users and five test organizations, including `Algebra_Church`. Deleting those identities is a separate reset action; authenticated onboarding has not yet been repeated against a fresh account.

## Remaining release gates

1. Revoke the unused duplicate Polar token after explicit credential-revocation approval.
2. Complete authenticated hosted checkout, signed webhook delivery, customer portal, cancellation, recovery, and entitlement tests.
3. Configure Paystack staging credentials and complete its sandbox checkout and signed-webhook tests.
4. Complete the authenticated portion of marketing → sign-up → organization creation → church onboarding → admin dashboard and member portal in a real browser. Public sign-in and sign-up entry routes are verified.
5. Promote `develop` to `main` only after the staging gates pass.
