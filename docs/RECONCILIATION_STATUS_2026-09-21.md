# ChurchTrack Reconciliation Status — 2026-09-21

## Product identity

- The public product name is **ChurchTrack**.
- Product interfaces, authentication copy, transactional-email content, API titles, operational alerts, manuals, and current product documentation have been updated from the former FaithFlow name.
- The primary ChurchTrack domain has not been purchased. Documentation uses the reserved `churchtrack.example` domain for planning examples.
- Existing lowercase technical identifiers remain unchanged for compatibility, including the `@faithflow-ai/*` package scope, repository name, environment-variable names, `faithflow_canonical` database, `faithflowapi` Neon Function slug, and current Vercel project aliases.
- Production `main` remains untouched. The rebrand is being validated through the normal feature branch → `develop` workflow.

## Polar sandbox

- Polar sandbox OAuth authorization completed successfully.
- Sandbox organization `churchtrack` exists and is the staging billing organization.
- The ChurchTrack subscription adapter is implemented and tested for hosted checkout, customer portal, signed and idempotent webhooks, plan changes, cancellation, resume, and fail-closed status handling.
- Provider-side creation of the Starter and Growth recurring products and the webhook remains pending because the current long-running Codex session has not reloaded the newly authenticated Polar sandbox MCP tool surface.
- No Polar access token, webhook secret, or product ID has been added to staging yet.
- Enterprise remains sales-assisted and must not be created as a zero-price self-service product.

## Validation evidence

- Typecheck passed across API, web, and admin.
- Production builds passed across API, web, and admin.
- Lint completed with zero errors and 159 existing warnings.
- Production dependency audit reported no known vulnerabilities.
- API end-to-end suite passed 20 of 20 serially against the isolated Neon `develop` database.
- Focused Polar adapter suite passed 3 of 3.
- The initial parallel API run exposed a temporary-plan cleanup race; cleanup now removes subscriptions by tenant or temporary plan before deleting that plan.

## Remaining release gates

1. Create Polar sandbox products `ChurchTrack Starter` at USD 49/month and `ChurchTrack Growth` at USD 149/month, each with a 14-day trial.
2. Create the signed Polar webhook for the documented subscription lifecycle events.
3. Store the resulting product IDs in each local `SubscriptionPlan.metadata.polarProductId` record.
4. Add the dedicated sandbox access token and webhook secret to the Neon staging Function without replacing its existing protected environment.
5. Complete hosted checkout, webhook replay, customer portal, cancellation, recovery, and entitlement tests.
6. Configure Paystack staging credentials and complete its sandbox checkout and signed-webhook tests.
7. Test marketing → sign-up → organization creation → church onboarding → admin dashboard and member portal in a real browser.
8. Promote `develop` to `main` only after the staging gates pass.
