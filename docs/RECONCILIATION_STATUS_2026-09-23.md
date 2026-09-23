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
- Neon Function deployment 21 contains the sandbox access token, webhook secret, and `POLAR_SERVER=sandbox`. The ChurchTrack `develop` web and admin origins and return URLs were updated without replacing the protected credentials.
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
- Neon Function deployment 21 is live. Both ChurchTrack `develop` origins passed CORS preflight, the old FaithFlow admin origin did not, and `/health` and `/ready` returned 200.
- Live `/health` and `/ready` checks returned 200, and `/docs` reported `ChurchTrack API` version `0.0.1`.
- An unsigned Polar webhook request returned 403, confirming that deployed signature verification rejects untrusted payloads.
- The deployed token returned 200 from Polar's sandbox subscription-list endpoint and 403 from the ungranted product-list endpoint, confirming both validity and least-privilege enforcement.
- The stale `polar-growth-*` test plan had no subscriptions and was removed from the Neon `develop` database after approval.
- The admin `/sign-in` and `/sign-up` routes now render their Clerk forms outside the protected admin gate. Real-browser checks confirmed both forms on the merged `develop` deployment.
- Clean `develop`-specific Clerk route values now override inherited preview values that contained trailing newlines.
- The duplicate `/dashboard`, `/dashboard/payments`, and `/dashboard/comms` routes and their consoles have been removed. AI summary links point directly to the canonical overview, events, finance, and members routes.
- Before the fresh onboarding test, the Neon `develop` canonical database had zero tenants, organizations, churches, users, staff memberships, and tenant subscriptions. One orphan Polar test tenant and its single audit entry were deleted; all three configured subscription plans remained.
- The merged `develop` commit passed GitHub Validate. Its ChurchTrack web and admin Vercel deployments are Ready. The web entry, `/get-started`, sign-in, sign-up, and portal routes returned 200; the retired admin `/dashboard*` routes returned 404. Both old stable FaithFlow `develop` aliases were removed and return 404.
- The shared Clerk development instance was reset after explicit approval: all six test users and five test organizations, including `Algebra_Church`, were deleted. A fresh inventory returned zero users and zero organizations before the next onboarding attempt.
- A fresh Google sign-in and Clerk organization creation initially stalled at “Organisation selected. Finalising access…”. Both `develop` frontends had a trailing newline in `NEXT_PUBLIC_CLERK_JWT_TEMPLATE`, while Clerk's actual template is `faithflow-api`. The preview values were corrected and both clients now trim the template name. After a refresh, the user created `TexaAlpha`; Neon contains its church and staff membership.
- The user completed one Polar sandbox Growth checkout with a 14-day trial. Polar created the subscription, but all initial webhook deliveries were rejected with HTTP 403. A live signed-delivery diagnostic found that the sandbox signed the decoded `whsec_` key while the installed Polar SDK verified the literal key. The adapter now verifies the real delivery with Standard Webhooks before SDK parsing. Existing `subscription.created`, `subscription.active`, and `subscription.updated` events were redelivered and all returned HTTP 200. Neon has one `TRIALING` Polar tenant subscription and three processed Polar events.
- The user's next admin sign-in landed on an access-restricted page because the separate admin origin had no active Clerk organization. The protected gate now selects a sole organization automatically and offers an organization switcher when selection or access verification fails. Both frontends clear their API query cache when the active organization changes. The subsequent Incognito retest exposed a separate response-decoding issue, resolved below.
- A fresh Incognito admin sign-in selected `TexaAlpha` but initially still showed access restricted. Clerk has one user and one organization, and that user has an `ADMIN` staff membership in Neon. The admin tRPC client omitted the API's SuperJSON transformer, so successful responses arrived as `{ json: { isStaff: true } }` while the gate read `isStaff` at the top level. The web client already supplied the transformer; the admin client now does too. The user subsequently reached the authenticated ChurchTrack Admin Overview in Incognito on the `develop` alias (screenshot, 2026-09-23 10:08 Accra time).
- That Overview showed the automatically provisioned `Default Organization` and `Default Church`. The guide incorrectly told the first admin to create both again. The Overview now offers name, slug, and country editing for the existing records, and the guide describes that path so onboarding does not create duplicates. A fresh browser check of these edit controls remains pending.

## Remaining release gates

1. Revoke the unused duplicate Polar token after explicit credential-revocation approval.
2. Hosted checkout and signed webhook delivery passed in Polar sandbox. Complete customer portal, cancellation, recovery, and entitlement tests.
3. Configure Paystack staging credentials and complete its sandbox checkout and signed-webhook tests.
4. The authenticated admin Overview has been verified by the user. Continue real-browser checks of the Overview edit controls, key admin modules, and member portal. Marketing → Google sign-in → church creation → Growth trial checkout passed.
5. Promote `develop` to `main` only after the staging gates pass.
