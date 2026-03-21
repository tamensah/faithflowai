# FaithFlow AI — Member Portal Manual

> This manual is written for **church members** using the self-service portal. For admin and staff operations, see [ONBOARDING_MANUAL.md](./ONBOARDING_MANUAL.md) or visit the admin guide at `/guide` on the marketing site.

---

## Table of Contents

1. [What is the Member Portal?](#1-what-is-the-member-portal)
2. [How to Access the Portal](#2-how-to-access-the-portal)
3. [Navigation](#3-navigation)
4. [Profile](#4-profile)
5. [Directory](#5-directory)
6. [Events](#6-events)
7. [Messages](#7-messages)
8. [Volunteer](#8-volunteer)
9. [Notifications](#9-notifications)
10. [Surveys](#10-surveys)
11. [Privacy Controls](#11-privacy-controls)
12. [FAQ for Admins](#12-faq-for-admins)

---

## 1. What is the Member Portal?

The Member Portal is the self-service interface for church members. It is separate from the admin console — members sign in to the portal, admins and staff use the admin console. The portal gives members access to:

- Their personal profile and directory presence
- Upcoming events, RSVP, and ticketed registrations
- Direct messages with staff and other members
- Volunteer shift sign-up and availability
- Notification preferences across all channels
- Active church surveys

The portal is fully decoupled from the marketing website. There is no shared navigation between the marketing pages and the portal.

---

## 2. How to Access the Portal

### Member access flow

```
Member visits /portal
       ↓
Not signed in?
       ↓ Yes
Sign-in form shown inline → sign in or create account
       ↓
Email matches a member record?
       ↓ Yes → Portal loads immediately
       ↓ No  → Access request form shown
                    ↓
             Submit request (name, email, church, optional message)
                    ↓
             Admin reviews in Admin → Access Requests
                    ↓
             Approved → member can sign in and use portal
```

### Step by step

1. Visit the portal URL (e.g. `https://yourchurch.faithflow.ai/portal`)
2. If you are not signed in, a sign-in form appears inline. Sign in with your email or create an account — no separate sign-in page redirect is needed.
3. If your email address matches a member record already in the system, the portal opens immediately.
4. If no record matches your email, you will see the **"Request member access"** screen. Fill in:
   - Full name (required)
   - Email address (required, must be valid)
   - Church (required — select from the dropdown)
   - Message to staff (optional)
5. Submit the request. Your church admin will review it from **Admin → Access Requests**.
6. Once approved, sign in again and the portal will open.

### Notes

- If you have **admin or staff** access, visiting `/portal` redirects you automatically to the admin console. The member portal is for congregation members only.
- If you are signed in but see a "Select your church" screen, your Clerk account does not have an active church organization. Use the organization switcher to select your church's organization, or contact your church admin.

---

## 3. Navigation

### Desktop

The portal header shows a horizontal tab bar:

| Tab | Section |
|-----|---------|
| Profile | Your personal info and privacy settings |
| Directory | Browse fellow members |
| Events | Upcoming events and registrations |
| Volunteer | Shifts and availability |
| Messages | Chat with staff and members |
| Notifications | Inbox and channel preferences |
| Surveys | Active church surveys |

### Mobile

On smaller screens, a **bottom tab bar** is shown with the 5 most-used tabs:

| Icon | Tab |
|------|-----|
| Person | Profile |
| Calendar | Events |
| Chat bubble | Messages |
| Hand | Volunteer |
| Bell | Alerts (Notifications) |

The **"More"** tab at the right of the mobile bar links to the Directory (and Surveys is accessible from the desktop nav or by navigating directly).

---

## 4. Profile

**URL:** `/portal/profile`

The Profile section shows your member record and lets you update your contact information and directory visibility.

### What you can see

| Field | Description |
|-------|-------------|
| Preferred name | Displayed instead of your first name throughout the portal |
| First name / Last name | Your legal name on record |
| Email address | Primary contact email |
| Phone number | Mobile or landline |
| Address | Mailing address (street, city, state, zip, country) |
| Membership status | Current status (Active, Inactive, etc.) |
| Tags | Labels applied by church admin |
| Household | Your household group (if assigned) |

### Engagement stats

At the top of your profile you'll see read-only stats:

- **Engagement score** — a composite score based on attendance and activity
- **Attendance count** — number of recorded attendance events
- **Giving total** — cumulative giving amount on file (if giving records exist)

These stats are maintained by the admin. Members cannot edit them.

### What you can edit

- **Preferred name** — the name you want to be called
- **Phone number**
- **Address** fields (street, city, state, zip, country)

> First name, last name, and email are managed by church admins and are not editable in the portal.

### Directory privacy controls

You control how much of your information is visible to other members in the directory:

| Setting | Options |
|---------|---------|
| Directory visibility | `PUBLIC` — visible to all members · `PRIVATE` — hidden from directory |
| Show email | Toggle |
| Show phone | Toggle |
| Show address | Toggle |
| Show photo | Toggle |

These settings take effect immediately after saving. See [Section 11](#11-privacy-controls) for full details.

---

## 5. Directory

**URL:** `/portal/directory`

The Directory shows a list of fellow church members. What each person's entry shows depends on their own privacy settings.

### What you see per member

- **Name** — preferred name or first name + last name
- **Email** — shown only if the member has `showEmail` enabled
- **Phone** — shown only if the member has `showPhone` enabled
- **Location** — city, state, country (shown only if `showAddress` is enabled)
- **Visibility badge** — indicates whether the member's listing is `PUBLIC` or another visibility tier

### Filtering

The directory is filtered server-side based on the `viewer: 'MEMBER'` context. Members with `directoryVisibility: 'PRIVATE'` are not shown.

### Data freshness

The directory reflects real-time data. If a member recently updated their privacy settings, the change is visible immediately.

---

## 6. Events

**URL:** `/portal/events`

The Events section lets you browse upcoming events, RSVP, register, and manage your registrations.

### Browsing events

Events are shown with:
- Title and description
- Date, time, and location
- Capacity (if limited) and spots remaining
- Registration status badge

### RSVP

For events with a simple RSVP (no ticket/form):

1. Find the event
2. Click **RSVP** — confirmation is immediate
3. Your RSVP appears in your registration list

### Registration with a form

Some events have custom registration forms (e.g. dietary requirements, t-shirt size, emergency contact). When you register:

1. Click **Register**
2. Fill in all required fields — text inputs, dropdowns, multi-select checkboxes
3. Click **Submit registration**

Required fields are marked with `*`. You cannot submit until all required fields are filled.

### Ticketed events (paid)

For events that require a ticket purchase:

1. Click **Register** to start registration
2. If a ticket price is configured, you are redirected to a checkout session (Stripe or Paystack, depending on your church's configuration)
3. Complete payment — you are redirected back to the portal on success
4. Your registration is confirmed automatically after payment

### Cancelling a registration

From the registrations list:

1. Find your registration
2. Click **Cancel registration**
3. Confirm — cancellation is immediate

> Refund policies for paid tickets are managed by your church admin. Cancellation in the portal removes your registration but does not automatically issue a refund.

### Registration status labels

| Status | Meaning |
|--------|---------|
| `CONFIRMED` | Registration accepted |
| `PENDING` | Awaiting confirmation or payment |
| `CANCELLED` | You or an admin cancelled the registration |
| `WAITLISTED` | Event is at capacity; you are on the waitlist |

---

## 7. Messages

**URL:** `/portal/messages`

The Messages section is a real-time chat interface for direct conversations with church staff or other members.

### Starting a conversation

To start a new direct conversation:

1. Use the **"Start new conversation"** dropdown to select a member from the directory
2. Click **Start**
3. The conversation opens in the message thread panel

### Sending a message

1. Select a conversation from the dropdown
2. Type your message in the input field
3. Click **Send** (or press Enter)

Messages appear in chronological order (oldest at top, newest at bottom).

### Attachments

You can attach files to messages in two ways:

**Upload a file:**
- Use the file picker at the bottom of the message composer
- Supported types: images (JPEG, PNG, GIF, WebP), PDF, Word documents (.doc, .docx), plain text
- Maximum size: 10 MB
- Files are uploaded to cloud storage; a link is attached to the message

**Attach a URL:**
- Paste a URL into the "Attachment URL" field
- Add an optional label in the "Label" field
- Click **Add attachment**
- The link appears as a clickable attachment in your message

### Typing indicators

When someone else in the conversation is typing, a "X is typing…" indicator appears below the message thread.

### Read receipts

Below the thread you can see when the other participant(s) last read the conversation.

### Conversation management

- Conversations are automatically marked as read when you open them
- Unread conversations are surfaced at the top of the dropdown list
- Members can only see conversations they are a participant in

---

## 8. Volunteer

**URL:** `/portal/volunteer`

The Volunteer section lets you see open service opportunities, sign up for shifts, and set your availability.

### Roles

Volunteer roles are defined by church administrators. Each role has:
- A name and description
- A department or ministry area
- Minimum and maximum volunteer capacity

Browse active roles in the Roles tab.

### Shifts

Shifts are specific scheduled instances of a volunteer role. Each shift shows:
- Role name and description
- Date and time
- Location (if specified)
- Current volunteer count vs. capacity

### Signing up for a shift

1. Find an open shift
2. Click **Sign up**
3. You are added to the shift roster immediately
4. The shift appears in your "My shifts" list

### Cancelling a shift

From "My shifts":
1. Find the shift you want to leave
2. Click **Cancel**
3. You are removed from the roster

### Setting your availability

Availability helps your church plan volunteer scheduling. To add availability:

1. Go to the **Availability** section
2. Select a **day of the week**
3. Set a **time window** (start time and end time)
4. Add optional notes (e.g. "School holidays only", "Mornings preferred")
5. Click **Save availability**

You can add multiple availability entries for different days or time windows. To remove one, click **Delete** next to the entry.

---

## 9. Notifications

**URL:** `/portal/notifications`

The Notifications section has two parts: your inbox and your channel preferences.

### Inbox

Your notification inbox shows messages sent to you by the church system or staff:

- Notification title and body
- Timestamp
- Read/unread status

**Mark as read:** Click **Mark read** on any unread notification. Read notifications are visually de-emphasised.

Notifications are sorted newest-first.

### Channel preferences

You control which channels you receive notifications on. Supported channels:

| Channel | Description |
|---------|-------------|
| `IN_APP` | Notifications shown in this inbox |
| `EMAIL` | Sent to your registered email address |
| `SMS` | Text message to your phone number |
| `WHATSAPP` | WhatsApp message (requires phone number) |
| `PUSH` | Browser/app push notifications |

For each channel you can toggle:

- **Enabled** — whether you receive any notifications on this channel
- **Quiet hours** — a time window when notifications are held and delivered later (e.g. 10 PM – 7 AM)

To update preferences:
1. Find the channel card
2. Toggle **Enabled** on or off
3. If enabling quiet hours, set start and end time
4. Changes are saved immediately

> Some notification types (e.g. urgent care or security alerts) may bypass quiet hours. This is controlled by church admin configuration.

---

## 10. Surveys

**URL:** `/portal/surveys`

The Surveys section shows active surveys published by your church leadership.

### Viewing surveys

Active surveys are listed with:
- Title
- Description
- Status badge (e.g. `ACTIVE`)
- List of questions

### Question types

| Type | Input method |
|------|-------------|
| `TEXT` | Free-text input |
| `RATING` | Number input (1–5 scale) |
| `MULTI_CHOICE` | Checkboxes (select one or more) |
| `SINGLE_CHOICE` | Dropdown (select one) |

Required questions are marked with `*`.

### Submitting a survey

1. Answer all required questions (marked `*`)
2. The **Submit survey** button becomes active when all required fields are complete
3. Click **Submit survey**

If required questions are missing, an error message lists which questions still need answers.

### Multiple surveys

If your church has published multiple active surveys, they all appear on this page as separate cards. Each is submitted independently.

---

## 11. Privacy Controls

Your privacy settings on the Profile page control what other members can see in the Directory.

### Visibility levels

| Setting | Effect |
|---------|--------|
| `PUBLIC` | Your entry appears in the member directory |
| `PRIVATE` | Your entry is hidden from the directory entirely |

### Field-level controls

Even if your listing is `PUBLIC`, you can hide individual fields:

| Toggle | What it hides |
|--------|--------------|
| Show email | Hides your email from directory listings |
| Show phone | Hides your phone number |
| Show address | Hides your city, state, and country |
| Show photo | Hides your profile photo |

These settings only affect **other members** browsing the directory. Church admins and staff can always see your full contact information through the admin console.

### How to update privacy settings

1. Go to **Profile** (`/portal/profile`)
2. Scroll to the Privacy section
3. Change the visibility level or toggle individual fields
4. Click **Save**

---

## 12. FAQ for Admins

This section answers common admin questions about managing members' portal access.

### How do I approve a member access request?

Go to **Admin → Access Requests**. Each pending request shows the member's name, email, church, and any message they included. Click **Approve** to link their account to a member record, or **Reject** to decline.

### A member says they can't log in — what should I check?

1. Confirm their email in the Members list matches what they're signing in with.
2. Check whether they have a pending access request (Access Requests page).
3. Check whether their member record is active (Members → Status field).
4. If their email matches but they still can't access, their Clerk account may be using a different email. Ask them to sign up with the exact email on their member record.

### How do I remove a member from the directory?

In **Admin → Members**, open the member's record and set `directoryVisibility` to `PRIVATE`, or set their membership status to `Inactive`. Members with `PRIVATE` visibility are hidden from the portal directory but their record is retained.

### Can members message each other directly?

Yes. Any two members can start a direct conversation from the Messages tab. Staff can also initiate conversations with members. Conversation history is visible to both participants.

### How do I create a survey for members?

From **Admin → Communications** (or the Surveys section in admin), create a new survey with questions. Publish it to make it visible in the member portal under `/portal/surveys`.

### How do I set up volunteer roles and shifts?

From **Admin → Members** or the dedicated volunteer section in admin, create roles (ministry areas and descriptions) and then add shifts (date, time, capacity) under each role. Shifts immediately appear in the member portal volunteer section.

### Can I disable specific portal sections?

Portal section availability is tied to feature flags on your plan. Features like `communications_enabled`, `events_enabled`, etc., can be configured through your subscription plan. Contact platform support to adjust feature flags.

### How do notification quiet hours work?

Quiet hours are set per member per channel in the portal. When a notification is triggered during quiet hours, it is held and delivered after the quiet window ends. Admins configure the global quiet hours window from **Admin → Operations** (church settings). Individual members can override or adjust their own quiet hours in the portal.

---

*Last updated: March 2025 · FaithFlow AI*
