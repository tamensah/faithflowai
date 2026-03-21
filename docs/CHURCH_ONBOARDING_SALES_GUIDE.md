# Church Onboarding Sales Guide

> **Audience:** FaithFlow AI sales team and customer success managers.
> This guide covers how to qualify, onboard, and hand off a new church from first contact to a live admin workspace. Keep this open during every onboarding call.

---

## Table of Contents

1. [What "Onboarded" Means](#1-what-onboarded-means)
2. [Church Profiles — Who We Sell To](#2-church-profiles--who-we-sell-to)
3. [Pre-Onboarding: The Discovery Call](#3-pre-onboarding-the-discovery-call)
4. [Onboarding Session — Step-by-Step](#4-onboarding-session--step-by-step)
5. [After the Session — Follow-Up Checklist](#5-after-the-session--follow-up-checklist)
6. [Common Objections and Responses](#6-common-objections-and-responses)
7. [Plan Guidance by Church Size](#7-plan-guidance-by-church-size)
8. [Escalation and Support](#8-escalation-and-support)
9. [Church Profile Template](#9-church-profile-template)

---

## 1. What "Onboarded" Means

A church is **fully onboarded** when:

- [ ] Church admin account is created and signed in
- [ ] Church organisation is created in FaithFlow AI
- [ ] At least one plan is active (trial or paid)
- [ ] Admin console is accessible and loaded
- [ ] At least one church is configured under the organisation
- [ ] At least one other staff member has been invited
- [ ] Member import has started (CSV or manual)
- [ ] Admin has visited the go-live checklist and understands open items

A church is **partially onboarded** (requires follow-up) if they stopped at account creation or plan selection but haven't opened the admin console.

A church is **at risk** if they completed the trial sign-up but have not logged in to the admin console within 3 days. Flag these immediately.

---

## 2. Church Profiles — Who We Sell To

Understanding who you're talking to changes how you pitch and onboard. FaithFlow AI typically sells to three profiles:

### The Senior Pastor / Founder
- Usually the decision-maker but not the day-to-day user
- Cares about: cost, security, time savings, and whether their staff will actually use it
- Needs: a brief demo, a clear pricing conversation, and reassurance that setup won't fall on them
- Hand off to: their church administrator or operations manager for the technical onboarding
- **Talking point:** "You don't need to be the one who sets it up — your admin manager handles day-to-day. You'll just approve the plan."

### The Church Administrator / Operations Manager
- The actual user who will run the platform daily
- Cares about: ease of use, member import, how communications work, and whether it replaces their current spreadsheets
- Needs: a live walkthrough of the admin console, to see member import work, and to see a communication sent
- **Talking point:** "You can import your existing member list from Excel or Google Sheets in under 5 minutes. We'll do that together on the call."

### The IT Lead or Finance Manager
- Often pulled in for sign-off on billing and data
- Cares about: data security, payment providers, how billing works, cancellation terms
- Needs: straight answers on PCI compliance, data residency, and pricing tiers
- **Talking point:** "Payments go through Stripe (international) or Paystack (Africa). We never store card details. Cancellation is month-to-month with no lock-in."

---

## 3. Pre-Onboarding: The Discovery Call

Run a 20–30 minute discovery call before the onboarding session. The goal is to understand the church so you can customise the onboarding to their situation.

### Questions to ask

**Church basics**
- How many active members in your congregation?
- Do you have multiple campuses or locations?
- Which country are you based in? (Determines payment provider recommendation)
- Who currently manages membership records, and where do they live? (Spreadsheet, ChurchSuite, Planning Center, paper?)

**Pain points**
- What's the biggest frustration with how you currently manage church operations?
- Have you tried any other church management software? What happened?
- What's the one thing you most want to fix in the first 30 days?

**Decision and timeline**
- Who else needs to be involved in the decision to go ahead?
- Is there a specific date you want to be live (e.g. before a series launch, end of quarter)?
- Are you comparing us to anything else right now?

**Technical**
- Who will be the main admin logging in day-to-day? Can they be on the onboarding call?
- Do you have your member list in a spreadsheet we can import?
- What email domain does your team use? (Affects invite flow)

### Before the onboarding session

- [ ] Send them the onboarding guide link: `[web-url]/guide`
- [ ] Confirm the admin's email address (the one they'll sign up with)
- [ ] Ask them to export their member list as a CSV if possible
- [ ] Book a 60-minute onboarding session with screen share
- [ ] Fill in the [Church Profile Template](#9-church-profile-template)

---

## 4. Onboarding Session — Step-by-Step

**Duration:** 45–60 minutes
**Format:** Video call with screen share (the church admin shares their screen)
**Goal:** Church leaves the call with an active workspace and at least one staff member invited

---

### Step 1 — Account creation (5 min)

Direct the admin to: `[web-url]/get-started`

**Script:** *"Go to that link and click 'Create free account'. You can use Google to sign up or create an account with your email. Either is fine — just use the email address you want as your church admin login."*

**What happens:**
- They sign up with Google or email
- Clerk sends a verification email if using email/password
- After completing, they are **automatically returned to the onboarding page** (this is expected — do not panic if the screen briefly goes to Google and comes back)

**Watch for:**
- If they accidentally sign in with a personal Google account, ask them to sign out and sign in with their work email
- If the page doesn't return to `/get-started` after OAuth, ask them to go back to that URL manually — it's a known issue in some browser configurations

---

### Step 2 — Create the church organisation (5–10 min)

They are now on Step 2 of the wizard.

**Script:** *"Now click the organisation switcher — it should say 'No organisation selected'. Click 'Create organisation' and name it after your church. If you're a network with multiple churches, name it after the network (e.g. 'Grace Chapel International'), not a single location."*

**Naming guidance:**
- Single church: use the full church name (e.g. `Redemption Church Accra`)
- Multi-campus network: use the network name, not a campus name
- Avoid acronyms unless that's genuinely how you're known

**What happens automatically after they create the org:**
- FaithFlow AI provisions their tenant in the background (takes 2–3 seconds)
- Admin access is claimed automatically — they will see Step 2 tick to done on its own
- **You do not need to explain or help with "admin access" — it is invisible to them**

**Watch for:**
- "It says this org already has an admin" — this means someone else already created an org with that name. Ask if a colleague may have already signed up. If not, they should create a new organisation.

---

### Step 3 — Choose a plan (5 min)

They are now on Step 3.

**Script:** *"Now choose your plan. I'd recommend [plan name] based on what we discussed — it covers [key features]. For payment, choose [Stripe / Paystack] — [reason]."*

**Payment provider guidance:**
- **Stripe** — churches in the US, UK, Canada, Europe, Australia
- **Paystack** — churches in Ghana, Nigeria, Kenya, South Africa, and most of Africa
- If unsure: ask what currency they give in. If it's USD/GBP/EUR → Stripe. If it's GHS/NGN/KES/ZAR → Paystack.

**Script for trial:** *"You're starting a 14-day free trial — no card required today. You'll get the full platform to explore. At the end of the trial you'll be prompted to add a card to continue."*

**What happens after they click "Start free trial":**
- They are redirected to a Stripe or Paystack checkout page
- Trial activation does not require a card (if your plan is configured for no-card trials)
- After completing, they land on the admin console billing page

---

### Step 4 — First time in the admin console (15–20 min)

They are now in the admin console. Walk them through:

#### 4a. Create the in-app Organisation and Church

On the Overview page, there is a setup wizard banner. Help them:
1. Create an Organisation (matches their Clerk org name)
2. Create a Church under that organisation (the specific campus or church entity)
   - Name: full church name
   - Slug: short URL-safe identifier (e.g. `grace-chapel-accra`)
   - Country: two-letter country code

**Script:** *"Think of the Organisation as the legal entity or network, and the Church as the physical congregation. Even if you only have one location, you still create one of each."*

#### 4b. Invite at least one other staff member

Go to **Admin → Staff**

**Script:** *"Let's add at least one other person now — even if it's just you testing with a second email. This makes sure invites work before you send them to your whole team."*

- Enter their email and select a role: **Admin** (full access) or **Staff** (day-to-day, no billing)
- They will receive an email invite and sign in to join

#### 4c. Import the member list

If they brought a CSV:
- Go to **Admin → Members** → Import
- Walk through the column mapping (the preview will show which columns matched)
- Required: at least first name or last name; recommended: email or phone

If they don't have a CSV yet:
- Add 2–3 members manually to show the flow
- Book a follow-up specifically for bulk import

#### 4d. Run the go-live checklist

Go to **Admin → Operations → Go-live checks**

**Script:** *"This is your readiness checklist. Any item marked MISSING needs attention before you open the portal to members. WARN items are non-blocking but worth fixing. Let's look at what's flagged for you."*

Walk through any MISSING items together. Common ones:
- No members imported → fix now or book follow-up
- No communication templates → offer to help set them up
- Stripe/Paystack not configured for giving → note as Phase 2

---

### Step 5 — Close the session (5 min)

Before ending the call, confirm:

- [ ] They can log in to the admin console independently (ask them to close the tab and reopen it)
- [ ] They know where to find the member portal link for their congregation
- [ ] They know who to contact if they get stuck (your contact + support email)
- [ ] Next call is booked if there are open items (import, comms setup, etc.)

**Closing script:** *"You're live. Your workspace is set up, your team is invited, and you've got [X] days left on your trial. My recommendation for this week: focus on getting your full member list imported, and send one test communication to a few people so you can see how that works. I'll check in with you on [date]."*

---

## 5. After the Session — Follow-Up Checklist

Send a follow-up email within 2 hours of the session.

**Template:**

> Hi [Name],
>
> Great session today — your workspace is live at [admin URL].
>
> Here's what we covered and what's next:
>
> **Done today:**
> - ✓ Account and organisation set up
> - ✓ [Plan] trial activated
> - ✓ [X] staff invited
> - ✓ [X] members imported / member import to complete
>
> **Your next steps this week:**
> - [ ] Complete member import (I've attached the CSV template if you need it)
> - [ ] Set up your first communication template
> - [ ] Review go-live checklist: [admin URL]/operations/health
>
> **Useful links:**
> - Admin console: [admin URL]
> - Member portal (share with your congregation): [web URL]/portal
> - Setup guide: [web URL]/guide
> - Support: [support email]
>
> Our next call is booked for [date/time]. Talk soon.

---

**Internal CRM notes to log:**
- Church name, country, size
- Plan selected, trial end date
- Open items from the session
- Primary contact name + email
- Risk flag if any steps were incomplete

---

## 6. Common Objections and Responses

### "We already use [Planning Center / ChurchSuite / Elvanto]."
*"A lot of churches we work with came from those platforms. The main reasons they switched: [Paystack support for African currencies / AI insights / all-in-one pricing without per-module add-ons]. Can I ask what's not working perfectly in what you're using today?"*

Keep probing. Don't fight the existing tool — identify the gap.

---

### "We're too small to need software like this."
*"We actually work best with churches from 50 members upward. The Starter plan is built for exactly that size — it covers membership, events, and giving for a price that's less than most churches spend on coffee for leadership meetings in a month. And you get the full trial free so there's nothing to lose by seeing it."*

---

### "We can't afford it right now."
*"Totally understand. Can I ask what 'right now' looks like — is it a budget cycle thing, or is the monthly cost the issue? The reason I ask is that a lot of churches we work with found that giving administration alone covered the platform cost within the first month — members who weren't giving online started doing so, and they recovered the subscription fee and more."*

If it's genuinely a budget issue: explore the Starter plan, emphasise the free trial, offer to send a cost-per-member breakdown.

---

### "We need our IT person / board to approve this."
*"Absolutely — that's the right process. I can send you a one-page summary with security information (PCI compliance, data handling, cancellation terms) that you can share with them. Would it help if I joined a short call with your IT person to answer any technical questions directly?"*

Offer to provide: pricing PDF, security one-pager, and a reference from a similar church.

---

### "We're worried about data privacy / where our member data goes."
*"Your data is stored with row-level isolation — no other church can access yours. We don't sell data or use it for advertising. Payments go through Stripe or Paystack and we never store card details. If you're in a region with specific data residency requirements, let me know and I can confirm our hosting configuration."*

If they push further: escalate to the technical team for a formal data processing agreement.

---

### "We tried it and it was too complicated."
*"I'm sorry to hear that. Can I ask where you got stuck? We've significantly improved the onboarding flow — you now go from sign-up to a working workspace in under 20 minutes, and we do that together on a call. Would you be open to giving it another look with me walking you through it live?"*

---

### "We need to think about it."
This almost always means something else. Probe:
- *"Of course. Is there a specific concern I can address before we wrap up?"*
- *"What would need to be true for this to be an easy yes?"*
- *"When are you hoping to have something in place by?"*

Always leave with a specific next step — even if it's "I'll send you the pricing and follow up Thursday."

---

## 7. Plan Guidance by Church Size

| Church size | Recommended plan | Key features to highlight |
|-------------|-----------------|--------------------------|
| Under 100 members | Starter | Membership, events, giving, member portal |
| 100–500 members | Growth | + Communications (email/SMS/WhatsApp), AI insights, volunteer management |
| 500–2,000 members | Growth / Enterprise | + Multi-campus, pastoral care, streaming, advanced analytics |
| 2,000+ members / networks | Enterprise | Custom pricing, dedicated onboarding, SLA support |

**When they ask "which plan is right for us?"**
- Lead with the features they mentioned in discovery, not the price
- Start with Growth if they mentioned communications or multiple staff
- Offer to start on Starter and upgrade — plan changes take effect immediately

**When to escalate to leadership for custom pricing:**
- Networks with 5+ churches under one organisation
- Churches requesting annual billing upfront
- Any request for custom feature development or integrations

---

## 8. Escalation and Support

| Issue | Who handles it | How |
|-------|---------------|-----|
| Can't sign in / account locked | Sales + Clerk support | Check if email is verified; resend invite |
| Billing / checkout failed | Sales + platform support | Check Stripe/Paystack dashboard for the error |
| Member import not working | Customer success | Share CSV template, check column headers |
| Data or privacy concerns | Technical lead | Loop in technical team before making commitments |
| Feature request / custom build | Product team | Log in CRM, set expectation on timeline |
| Trial extension request | Sales manager approval | Standard: up to 7 additional days |
| Church wants to cancel | Customer success | Trigger retention call within 24 hours |

**Support contacts:**
- General support: [support email]
- Technical escalation: [tech lead contact]
- Billing issues: [billing contact]
- Sales manager: [sales manager contact]

---

## 9. Church Profile Template

Fill this in during or before the discovery call. Store in CRM.

```
── CHURCH PROFILE ─────────────────────────────────────

Church name:
Network / denomination:
Country:
City:
Website:

Primary contact:
  Name:
  Role:
  Email:
  Phone:

Decision maker (if different):
  Name:
  Role:
  Email:

── SIZE & SETUP ────────────────────────────────────────

Active members:             [ ] < 100  [ ] 100–500  [ ] 500–2,000  [ ] 2,000+
Campuses / locations:
Countries of operation:
Current software (if any):
Member data format:         [ ] Spreadsheet  [ ] Other software  [ ] Paper  [ ] None

── DISCOVERY ───────────────────────────────────────────

Biggest operational pain point:

What they most want to fix in 30 days:

Comparing to anything else:

Budget status:              [ ] Approved  [ ] Needs board/IT approval  [ ] Unknown
Decision timeline:
Target go-live date:

── PLAN & BILLING ──────────────────────────────────────

Recommended plan:           [ ] Starter  [ ] Growth  [ ] Enterprise
Payment provider:           [ ] Stripe  [ ] Paystack
Billing cycle:              [ ] Monthly  [ ] Annual
Trial start date:
Trial end date:

── ONBOARDING SESSION ──────────────────────────────────

Session date:
Session attendees:
Steps completed:
  [ ] Account created
  [ ] Organisation created
  [ ] Plan activated
  [ ] Admin console accessed
  [ ] Staff invited (how many: ___ )
  [ ] Member import done (how many: ___ )
  [ ] Go-live checklist reviewed

Open items after session:

Follow-up call date:

── STATUS ──────────────────────────────────────────────

Status:   [ ] Lead  [ ] Discovery  [ ] Onboarding  [ ] Live  [ ] At risk  [ ] Churned

Notes:
```

---

*FaithFlow AI — Internal Sales Guide · Last updated March 2025*
*For questions about this guide, contact the customer success lead.*
