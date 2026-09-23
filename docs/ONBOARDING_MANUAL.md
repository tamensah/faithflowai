# Onboarding Manual

This manual defines the standard onboarding flow for ChurchTrack beta and the expected UX for admins, staff, and members. ChurchTrack is a global church management platform for single congregations and multi-site organizations; the examples below are illustrative, not a required church structure.

## Goals
- Make first-time church onboarding deterministic and fast.
- Route users by role (admin/staff vs member) without confusion.
- Ensure payments, org setup, and admin access work in one guided path.

## Canonical Entry Points
- Marketing + onboarding (staging): `https://churchtrack-web-git-develop-tamensahs-projects.vercel.app`
- Guided onboarding (staging): `https://churchtrack-web-git-develop-tamensahs-projects.vercel.app/get-started`
- Member portal (staging): `https://churchtrack-web-git-develop-tamensahs-projects.vercel.app/portal`
- Admin console (staging): `https://churchtrack-admin-git-develop-tamensahs-projects.vercel.app`

## Standard User Flows

### 1) Church admin self-serve onboarding
1. User opens `/get-started`.
2. User signs in/signs up with Clerk.
3. User creates/selects a workspace through the organization switcher (church tenant and subscription boundary).
4. The first user in the new organization receives admin access automatically in staging.
5. User selects a plan and starts Polar sandbox checkout in staging. Paystack and Stripe remain listed in the interface but require their own configuration before use.
6. User lands in admin billing/admin workspace.

Expected result:
- Tenant + default org/church/campus exist.
- User has admin staff membership in that tenant.
- Subscription flow is started from a valid admin context.

### Name the first organization and church

The first Organization, Church, and Campus are created during onboarding. The Organization takes the workspace name when available; the admin can correct it on Overview. Rename the existing Church, review its slug, set its country, then select **Save church**. Do not create another Church just to replace the default. The first Church starts with an ID-based slug; while naming that default Church, Overview suggests a readable slug based on the Organization and Church names (for example, `churchtrack-organization-hq`). A manually edited slug is preserved. A slug must use lowercase letters, numbers, and hyphens and must be unique across ChurchTrack because it appears in public links. A changed slug changes those links, so settle it before sharing them. Select the actual two-letter country code; there is no assumed country for a new church (`GH` is Ghana and `CH` is Switzerland).

## What the entities mean today

| Entity | Meaning | Example |
|---|---|---|
| Workspace / tenant | One customer's isolated account and subscription, tied to the selected sign-up organization | ChurchTrack Organization account |
| Organization | A ministry or church network inside that workspace | ChurchTrack Organization |
| Church | An operating congregation with its own members, staff, events, and giving, whatever local name it uses | Headquarters Church, East Branch, University Campus Church, Zurich Branch |
| Campus | A meeting site inside one Church; some site-scoped features include events and facilities | A venue run by East Branch |
| Oversight unit (planned) | A headquarters, region, area, district, or similar group that supervises churches | Accra Region overseeing several branches |

For a network such as the fictional ChurchTrack Organization, name the workspace and Organization after the network and rename the first Church to the actual headquarters **congregation**. The network's administrative headquarters and the congregation meeting there are conceptually different. Give independently operated branches their own Churches under the same Organization. If a university campus church has its own members and staff, it is a Church even when its local name says “campus”; a Campus record is for a site that shares a Church's operational records. A Swiss branch can be another Church with country `CH` if it shares the same workspace and subscription; its legal, billing, and oversight boundaries need a separate decision before real rollout.

**Current limitation:** Churches are siblings under an Organization. ChurchTrack does not yet represent an oversight unit that governs child Churches. A Campus is nested under one Church and is not a substitute for a regional branch. The requested headquarters → regions → branches → campus churches hierarchy and regional oversight/reporting require further product and data-model work; do not infer that the current Overview supports that hierarchy. See `docs/CHURCH_STRUCTURE_REVIEW_2026-09-23.md` for the verified gap and next design slice.

**Slug routing:** Public routes find a Church by slug alone. The global unique index and API conflict message keep those links unambiguous. Use a distinctive network-prefixed slug, and do not change it after distributing public links without a link-migration plan.

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
- Tenant is resolved from a verified Clerk bearer token plus org context.
- tRPC clients send:
  - `Authorization: Bearer <Clerk session token>`
  - `x-clerk-org-id` when the active organization is selected in Clerk
- `x-tenant-id` is reserved for API-key integration routes, not browser auth.
- First user in a fresh tenant can bootstrap as admin only inside non-production environments.
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
  - Polar sandbox token, product mapping, and signed webhook for staging subscription tests
  - Paystack credentials and signed webhook before its staging tests
  - Stripe credentials only when that provider is enabled after US setup

For full provider setup details, see `docs/THIRDPARTY_CONFIG.md`.

## Operational Runbook (Beta Onboarding)
1. Verify the Neon Function deployment is current and `/ready` returns 200.
2. Verify both `develop` web/admin staging deployments are Ready.
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
  - Verify the selected provider's credentials, product mapping, and webhook setup.

## Source Files (Current)
- Web onboarding: `apps/web/src/app/(marketing)/get-started/page.tsx`
- Web role redirect: `apps/web/src/app/portal/page.tsx`
- Admin gate: `apps/admin/src/components/AdminGate.tsx`
- Org-aware tRPC providers:
  - `apps/web/src/app/providers.tsx`
  - `apps/admin/src/app/providers.tsx`
- Billing onboarding bootstrap: `packages/api/src/router/billing.ts`
- Tenant context resolver: `apps/api/src/context.ts`
