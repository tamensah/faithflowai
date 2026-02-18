# FaithFlow Demo Playbook

Use this guide to demo the current beta to church leadership without onboarding friction.

## 1) Seeded Accounts Reality Check

Seed data exists in the Prisma seed script (`packages/database/prisma/seed.ts`) and is designed for local/dev DBs.

Current seeded identities:

- Tenant: `Demo Tenant` (`clerkOrgId: org_demo`)
- Church: `Demo Church` (`slug: demo-church`)
- Admin user record: `admin@demo.church` (`clerkUserId: user_demo`)
- Members:
  - `ava@demo.church`
  - `noah@demo.church`
  - `mia@demo.church`

Important:

- These are DB records only.
- There are no Clerk passwords for seeded users.
- `clerkUserId: user_demo` is synthetic and will not authenticate in Clerk-hosted sign-in.

## 2) Best Practice for Live Demo (Recommended)

For pastor demo on hosted env (`web` + `admin`), use real Clerk accounts and a dedicated demo org.

### Step A — Create demo identities in Clerk

Create/prepare three real accounts:

- Church owner/admin (you)
- Staff account (assistant/secretary)
- Member account (regular congregant)

### Step B — Create demo org and bootstrap admin

1. Sign in on web onboarding: `https://web-nu-eight-62.vercel.app/get-started`
2. Create org: e.g. `FaithFlow Demo Church`
3. Complete onboarding flow and land in admin.
4. First admin bootstrap is automatic when no staff exists.

### Step C — Build demo dataset in admin

In admin (`https://admin-gamma-beryl.vercel.app`):

1. Add 10-30 members (or import CSV).
2. Create 2-3 events (service, prayer, training).
3. Add 1-2 funds and 3-5 manual donations.
4. Add one volunteer shift and assign one member.
5. Create one communication template.

### Step D — Link member account for portal demo

1. Sign in as member account once (to get Clerk user id context).
2. In admin `/members`, link that member record to the member's Clerk user.
3. Show member portal at `/portal` (profile, privacy, events, availability).

### Step E — Staff role demo

1. In admin `/staff`, invite/add staff account.
2. Sign in as staff account and show staff-scoped access.

## 3) Suggested Pastor Demo Flow (20-30 min)

1. **Onboarding + org**: create/select church org and land in admin.
2. **Membership**: member records, household/group basics, member portal.
3. **Events**: create event, RSVP/check-in flow.
4. **Finance**: donation tracking, receipts, statements, payout/reconciliation surface.
5. **Comms + AI**: AI draft -> review checklist -> draft/approve/queue, suppressions/unsubscribe.
6. **Operations**: health/go-live checklist page.

## 4) If You Want Seeded Data in a Hosted DB

Only do this in staging/demo DBs, not production customer data.

```bash
# from repo root
DATABASE_URL=\"<target_postgres_url>\" pnpm db:seed
```

Then immediately map real Clerk users:

- Create or update `User` rows with real `clerkUserId`
- Ensure `StaffMembership` and member `clerkUserId` links are set

Without this mapping, seeded users cannot sign in.

## 5) Demo Stability Checklist

- `PLATFORM_ADMIN_EMAILS` includes your demo admin email.
- Clerk org switcher is visible and org selected before opening admin.
- Stripe/Paystack keys present (or clearly marked as sandbox for demo).
- Resend configured if you plan to demo email sends.
- Twilio configured if you plan to demo SMS/WhatsApp unsubscribe/STOP flows.

