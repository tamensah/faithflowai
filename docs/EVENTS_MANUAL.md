# FaithFlow AI Events Manual

This guide explains the event model, operations, and recommended workflows for FaithFlow AI. It is written for developers and early adopters running events at scale.

## 1. Core Concepts

- **Event**: A single gathering (service, class, fundraiser, conference).
- **Series**: A recurring schedule that auto‑creates events (weekly/monthly).
- **RSVP**: Lightweight attendance intent, optionally with guest counts.
- **Registration**: Structured sign‑up with custom fields and waitlists.
- **Ticketing**: Paid access for conferences or fundraisers.
- **Assignments**: Speakers, hosts, and volunteer roles tied to an event.
- **Media**: Post‑event photos, videos, sermons, or documents.

## 2. Event Types & Formats

Events support:
- Types: Service, Bible Study, Fundraiser, Ceremony, Meeting, Conference, Other.
- Formats: In‑person, Online, Hybrid.
- Visibility: Public, Members‑only, Leaders‑only.

Use these fields to drive calendars, marketing, and targeted invites.

## 3. Registration + RSVP

Use RSVP when you want a quick “I’m coming” signal.
Use Registration when you need structured sign‑ups and follow‑up.

Registration supports:
- Custom fields (text, email, phone, number, select, checkbox, date)
- Capacity limits
- Waitlist
- Guest registration (public)

## 4. Ticketing

Ticketing supports Stripe + Paystack:
- Create ticket types per event
- Enforce ticket capacity
- Track orders and payment status
- Map ticket purchases to RSVP when required

## 5. Check‑In

Check‑in supports three modes:
- Admin roster (manual check‑in/out)
- Kiosk mode (public roster for greeters)
- Mobile check‑in (camera scan + manual fallback)

## 6. Badges & Credentialing

Event badges create scannable credentials for registrations and paid tickets:
- Generate badges for registrations and paid ticket orders
- Each badge includes a unique code + QR payload (`ffbadge:<eventId>:<code>`)
- Badge check‑in updates attendance and badge status (active → used)
- Revocation invalidates a badge without deleting history

Use badges for conferences, volunteer check‑in, and VIP access control.

## 7. Assignments

Assignments connect people to events:
- Speakers, hosts, worship leaders, volunteers, tech
- Assign members or add external names
- Use assignments for event ops and comms targeting

## 8. Media & Post‑Event Sharing

Upload event media (photo/video/sermon/document):
- Stored via S3 or GCS
- Public toggle for sharing on event pages
- Supports direct links to media assets

## 9. Public Event Pages

Each church has public event pages:
- `GET /public/events/:churchSlug` (JSON)
- `/events/:churchSlug` (web list)
- `/events/:churchSlug/:eventId` (web detail + registration)
- `.ics` endpoints for calendar subscription

## 10. Calendar Integration

Calendar export is supported via iCal:
- `GET /public/events/:churchSlug/calendar.ics`
- `GET /public/events/:churchSlug/:eventId.ics`

Public pages also provide Google and Outlook calendar links.

## 11. Event Communications Playbook

Use the default playbook to schedule reminders:
- Day‑before reminder
- Day‑of update
- Post‑event follow‑up

Playbook schedules target event registrations and RSVP “going”.

## 12. Analytics & Reporting

Event analytics include:
- Registration totals by status
- RSVP totals by status
- Attendance counts
- Ticket revenue

Use these metrics for staffing decisions and follow‑up sequences.

## 13. Recommended Alpha Playbook

- Create a weekly Service series.
- Enable RSVP for high‑attendance services.
- Use Registration + Waitlist for conferences.
- Enable kiosk check‑in for greeters.
- Post event media to drive community engagement.

## 14. Key API Routes (High Level)

- tRPC: `event` (create/update/list, RSVP, registration, assignments, media, analytics)
- Public:
  - `/public/events/:churchSlug`
  - `/public/events/:churchSlug/calendar.ics`
  - `/public/events/:churchSlug/:eventId.ics`

## 15. Security & Privacy

- All admin operations are tenant‑scoped.
- Public pages only expose `PUBLIC` events.
- Guest registrations require email.

If you want advanced playbooks (segmented comms, volunteer staffing flows), we can add those next.
