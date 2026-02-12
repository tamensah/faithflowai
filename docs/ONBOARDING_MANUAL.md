# Onboarding Manual

This manual defines the standard onboarding flow for FaithFlow AI beta and the expected UX for admins, staff, and members.

## Goals
- Make first-time church onboarding deterministic and fast.
- Route users by role (admin/staff vs member) without confusion.
- Ensure payments, org setup, and admin access work in one guided path.

## Canonical Entry Points
- Marketing + onboarding: `https://web-nu-eight-62.vercel.app`
- Guided onboarding: `https://web-nu-eight-62.vercel.app/get-started`
- Member portal: `https://web-nu-eight-62.vercel.app/portal`
- Admin console: `https://admin-gamma-beryl.vercel.app`

## Standard User Flows

### 1) Church admin self-serve onboarding
1. User opens `/get-started`.
2. User signs in/signs up with Clerk.
3. User creates/selects a Clerk Organization (church tenant boundary).
4. User claims admin access (auto bootstrap for first staff in tenant).
5. User selects plan and starts checkout (Stripe/Paystack).
6. User lands in admin billing/admin workspace.

Expected result:
- Tenant + default org/church/campus exist.
- User has admin staff membership in that tenant.
- Subscription flow is started from a valid admin context.

### 2) Invited admin/staff onboarding
1. Existing admin invites staff via admin `/staff` (or pre-creates platform user).
2. Invitee signs in, selects same organization.
3. Access is auto-accepted when possible or claimed via bootstrap route.
4. Invitee lands in admin console with assigned role.

### 3) Member onboarding
1. User signs in and opens `/portal`.
2. If linked to member record: full member portal.
3. If not linked: submit access request form.
4. Staff approves request in admin `/access-requests`.

## Role-Based Routing Rules
- Signed-out user at admin: show sign-in/sign-up prompt.
- Signed-in user without org context: show organization selection guidance.
- Signed-in admin/staff at member portal: redirect to admin console.
- Signed-in member at admin (no staff role): show restricted state + member portal path.

## Platform Behavior (Implementation Notes)
- Tenant is resolved from Clerk org context (`org_id`) or org headers.
- tRPC clients include org headers:
  - `x-clerk-org-id`
  - `x-tenant-id`
- First user in a fresh tenant can bootstrap as admin.
- Billing routes can bootstrap tenant admin in first-user flow.

## Required Provider Configuration (Before Beta)
- Clerk app with organizations enabled.
- Clerk JWT template and API JWT verification values configured:
  - `NEXT_PUBLIC_CLERK_JWT_TEMPLATE`
  - `CLERK_JWT_KEY`, `CLERK_JWT_ISSUER`, `CLERK_JWT_AUDIENCE`
- API env:
  - `NEXT_PUBLIC_WEB_URL`
  - `NEXT_PUBLIC_ADMIN_URL`
  - `PLATFORM_ADMIN_EMAILS` (recommended for deterministic super-admin access)
- Payments:
  - Stripe keys and webhook secret
  - Paystack keys and webhook secret

For full provider setup details, see `docs/THIRDPARTY_CONFIG.md`.

## Operational Runbook (Beta Onboarding)
1. Verify API deployment is current (Render auto-deploy complete).
2. Verify web/admin deployments are current (Vercel production ready).
3. Test with a fresh email:
   - Complete `/get-started` flow end-to-end.
   - Confirm admin access.
   - Confirm checkout URL creation.
4. Test member-only email:
   - Confirm `/portal` request-access path.
   - Approve in `/access-requests`.
   - Confirm profile save works after linking.

## QA Checklist
- [ ] Signed-out admin page shows sign-in/sign-up, not restricted error.
- [ ] Org switch updates access state without stale tenant context.
- [ ] First admin in new org can claim access.
- [ ] Admin user hitting `/portal` redirects to admin.
- [ ] Member without link sees access request form with required validation.
- [ ] Member linked to record can save profile and privacy settings.
- [ ] Staff invite + acceptance flow results in admin console access.

## Troubleshooting
- **Access restricted in admin after sign-in**
  - Confirm correct org is selected in Clerk org switcher.
  - Confirm API deployment includes latest auth/onboarding fixes.
  - Confirm user has staff/admin membership or bootstrap eligibility.

- **Portal says member not linked**
  - Expected for unlinked users.
  - Link Clerk user ID to member in admin `/members` or approve access request.

- **Checkout blocked**
  - User is not tenant admin yet, or payment provider env is missing.
  - Verify Stripe/Paystack env vars and webhook setup.

## Source Files (Current)
- Web onboarding: `apps/web/src/app/get-started/page.tsx`
- Web role redirect: `apps/web/src/app/portal/page.tsx`
- Admin gate: `apps/admin/src/components/AdminGate.tsx`
- Org-aware tRPC providers:
  - `apps/web/src/app/providers.tsx`
  - `apps/admin/src/app/providers.tsx`
- Billing onboarding bootstrap: `packages/api/src/router/billing.ts`
- Tenant context resolver: `apps/api/src/context.ts`

