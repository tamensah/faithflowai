# FaithFlow AI — Beta Smoke Test

> Run this before every major deploy and before onboarding any new beta church.
> Each test should be run by a tester with a **fresh account** (not a pre-existing test church) unless noted.

**Status legend:** ✅ Pass · ❌ Fail · ⏭ Skipped (provider not configured)

---

## 1. Onboarding Flow (Critical Path)

> Tests the entire new-customer journey end to end.

| # | Step | Expected result | Status |
|---|------|----------------|--------|
| 1.1 | Visit `/get-started` while signed out | Wizard shows Step 1 active, Steps 2–3 locked/greyed | |
| 1.2 | Click "Create free account" → complete Google OAuth | Browser returns to `/get-started` (NOT `/` or `/portal`) | |
| 1.3 | Step 1 shows ✓ with signed-in email | Name and email shown, step marked done | |
| 1.4 | Create a new organisation in the switcher | Step 2 shows "Setting up your admin access…" then ticks to done | |
| 1.5 | Step 3 unlocks automatically | Plan selector and provider dropdown become interactive | |
| 1.6 | Select a plan and provider → click "Start free trial" | Redirected to Stripe/Paystack checkout | |
| 1.7 | Complete checkout (use test card `4242 4242 4242 4242`) | Redirected to admin console `/billing?checkout=success` | |
| 1.8 | Admin console loads and shows the new church's workspace | No errors, billing page shows active trial | |

**Fail criteria:** If 1.2 redirects to `/` or `/portal`, stop — the `forceRedirectUrl` is broken.

---

## 2. Admin Console — Core

| # | Step | Expected result | Status |
|---|------|----------------|--------|
| 2.1 | Sign in to admin console directly at `/sign-in` | Redirected to overview `/` after auth | |
| 2.2 | Overview page loads with setup wizard | Setup banner visible if no org/church created yet | |
| 2.3 | Create an Organisation from the overview | Organisation appears in the panel | |
| 2.4 | Create a Church under the organisation | Church appears with name, slug, country | |
| 2.5 | Go to Staff → invite a second email | Invite email received; invitee can sign in and access admin | |
| 2.6 | Go to Access Requests → approve one | Member linked; they can now sign in to portal | |

---

## 3. Members

| # | Step | Expected result | Status |
|---|------|----------------|--------|
| 3.1 | Add a member manually | Member appears in list with all fields | |
| 3.2 | Import CSV (use `docs/import_templates/members.csv`) | Preview shows column mapping and row count; import succeeds | |
| 3.3 | Edit a member's status and tags | Changes saved and reflected immediately | |
| 3.4 | Create a household and assign a member | Household shows member(s) | |
| 3.5 | Create a group and add members | Group shows member count | |

---

## 4. Events

| # | Step | Expected result | Status |
|---|------|----------------|--------|
| 4.1 | Create a new event (free, no form) | Event appears in list | |
| 4.2 | Create a ticketed event with a price | Event shows price; checkout is triggered on RSVP | |
| 4.3 | Register for the event from the member portal | Registration appears in admin with status CONFIRMED | |
| 4.4 | Generate QR code for event check-in | QR code displays and links to check-in page | |
| 4.5 | Check in a member via QR / kiosk | Attendance recorded; check-in count increments | |
| 4.6 | Cancel a registration from the portal | Status changes to CANCELLED in admin | |

---

## 5. Giving

| # | Step | Expected result | Status |
|---|------|----------------|--------|
| 5.1 | Create a fund | Fund appears in giving list | |
| 5.2 | Record a manual donation | Donation appears with amount, donor, fund | |
| 5.3 | Use a giving link (Stripe test card) | Checkout completes; donation recorded; receipt email sent | |
| 5.4 | Use a giving link (Paystack test card) | Checkout completes; donation recorded | |
| 5.5 | Trigger a refund on a donation | Refund processed; donation status updated | |
| 5.6 | Generate a tithing statement | PDF or email sent with giving totals | |

---

## 6. Finance

| # | Step | Expected result | Status |
|---|------|----------------|--------|
| 6.1 | Create a budget | Budget appears with amount and period | |
| 6.2 | Record an expense against the budget | Expense deducted from budget remaining | |
| 6.3 | Run the reconciliation view | Shows giving vs. expenses for the period | |
| 6.4 | Export finance report as CSV | File downloads with correct data | |

---

## 7. Communications

| # | Step | Expected result | Status |
|---|------|----------------|--------|
| 7.1 | Create an email template | Template saved with subject and body | |
| 7.2 | Send a test email to one member | Email received within 2 minutes | |
| 7.3 | Send a bulk email to a segment | All members in segment receive the email | |
| 7.4 | Send a test SMS (if Twilio configured) | SMS received on test number | |
| 7.5 | Send a WhatsApp message (if configured) | Message received on WhatsApp | |
| 7.6 | Schedule a campaign for future delivery | Campaign shows as SCHEDULED in calendar view | |
| 7.7 | Trigger a STOP reply from the test number | Suppression entry created; no further SMS to that number | |
| 7.8 | Queue a welcome email from ops/health page | Email received; `CommunicationSchedule` row created | |
| 7.9 | Queue a failed-payment notice from ops/health | Notice email received | |

---

## 8. Billing & Subscriptions

| # | Step | Expected result | Status |
|---|------|----------------|--------|
| 8.1 | Trial showing on `/billing` | Trial end date and days remaining shown | |
| 8.2 | Change plan (next cycle) | Change scheduled; confirmation shown | |
| 8.3 | Attempt plan change monthly→annual with IMMEDIATE | Blocked with `BAD_REQUEST` (interval-change guardrail) | |
| 8.4 | Open Stripe Customer Portal | Redirected to Stripe portal with current subscription | |
| 8.5 | Cancel subscription in-app | Status changes to CANCELLED; read-only mode activates | |
| 8.6 | Resume subscription | Status returns to active; write access restored | |
| 8.7 | Simulate `invoice.payment_failed` (Stripe CLI) | Immediate dunning email sent; subscription status → PAST_DUE | |
| 8.8 | Read-only mode: try to create a member | Blocked with read-only notice; billing buttons still work | |

---

## 9. Member Portal

| # | Step | Expected result | Status |
|---|------|----------------|--------|
| 9.1 | Visit `/portal` while signed out | Inline sign-in form shown (no redirect to /sign-in) | |
| 9.2 | Sign in with a member account | Portal loads with member's name and tabs | |
| 9.3 | Sign in with an admin account | Redirected to admin console automatically | |
| 9.4 | Visit `/portal` with account not linked to a member | Access request form shown | |
| 9.5 | Submit an access request | Admin sees pending request in `/access-requests` | |
| 9.6 | Update profile fields (phone, address) | Changes saved; updated in admin member record | |
| 9.7 | Set directory privacy to Private | Member no longer appears in directory | |
| 9.8 | RSVP to an event from the portal | RSVP appears in admin event registrations | |
| 9.9 | Start a direct message with another member | Message thread created; other member sees it | |
| 9.10 | Sign up for a volunteer shift | Shift roster updated in admin | |
| 9.11 | Toggle off Email notifications | No emails sent to that member for subsequent campaigns | |
| 9.12 | Submit a survey | Response recorded in admin survey analytics | |
| 9.13 | Click `?` help button | Help sheet opens; Q&As shown for current page | |
| 9.14 | Search in help sheet | Matching Q&As from all sections returned | |

---

## 10. Operations & Platform

| # | Step | Expected result | Status |
|---|------|----------------|--------|
| 10.1 | Open `/operations/health` | All configured providers show ✅; any missing show MISSING with instructions | |
| 10.2 | Send a test email from health page | Delivery confirmed | |
| 10.3 | Run go-live checklist | All REQUIRED checks pass for a fully-configured tenant | |
| 10.4 | Platform admin: view all tenants at `/platform` | Tenant list loads with status | |
| 10.5 | Platform admin: suspend a tenant | Tenant enters suspended state; API calls blocked | |
| 10.6 | Platform admin: activate the tenant | Normal access restored | |
| 10.7 | Run dunning (platform cron) | Tiers fire correctly; no duplicate emails within 24h | |

---

## 11. Webhooks (Regression)

Run these with Stripe CLI (`stripe trigger`) and Paystack test webhooks.

| # | Webhook event | Expected result | Status |
|---|--------------|----------------|--------|
| 11.1 | `checkout.session.completed` (Stripe) | Donation or subscription recorded | |
| 11.2 | `invoice.paid` (Stripe) | Subscription renewed; status active | |
| 11.3 | `invoice.payment_failed` (Stripe) | Status → PAST_DUE; dunning email queued immediately | |
| 11.4 | `customer.subscription.deleted` (Stripe) | Status → CANCELLED; read-only activates | |
| 11.5 | `charge.dispute.created` (Stripe) | Dispute record created in admin | |
| 11.6 | Paystack `charge.success` | Donation or subscription recorded | |
| 11.7 | Paystack `subscription.disable` | Status → CANCELLED | |
| 11.8 | Clerk `organization.created` | Tenant provisioned; welcome email queued | |
| 11.9 | Twilio inbound STOP SMS | Suppression created for that number + channel | |
| 11.10 | Replay any webhook (duplicate delivery) | Idempotency key prevents double-processing | |

---

## Smoke Test Sign-Off

**Tester:**
**Date:**
**Environment:** `staging` / `prod`
**Deploy commit:**

| Area | Result | Notes |
|------|--------|-------|
| Onboarding flow | | |
| Admin console | | |
| Members | | |
| Events | | |
| Giving | | |
| Finance | | |
| Communications | | |
| Billing | | |
| Member portal | | |
| Operations | | |
| Webhooks | | |

**Overall status:** ✅ Ready to launch / ❌ Blockers found (see notes)

---

*FaithFlow AI — Beta Smoke Test · Last updated March 2025*
*Run after every deploy to staging before promoting to production.*
