# FaithFlow AI Membership Manual

This guide explains how membership data is modeled and operated in FaithFlow AI. It is written for developers and early adopters who need a reliable operating playbook.

## 1. Core Concepts

- **Member**: A person record attached to a church with profile data, contact info, and engagement history.
- **Household**: A family or shared living unit that can group multiple members.
- **Group**: A small group, ministry team, class, or committee for engagement and leadership.
- **Volunteer Role**: A service assignment (e.g., Usher, Worship Team, Youth Mentor).
- **Tags**: Lightweight labels used for segmentation and communication.
- **Milestones**: Spiritual or membership events (baptism, confirmation, membership date).

## 2. Member Profiles

Profiles capture both contact and spiritual context:

- Identity: first, middle, last, preferred name
- Contact: email, phone, address, emergency contact
- Journey: join date, baptism date, confirmation date, notes
- Status: active/inactive/archived

Profiles are scoped to a single church and enforce tenant isolation.

## 3. Households

Households group members into a family unit. One member can be marked as the primary contact.

Common use cases:
- Family giving statements
- Child/guardian relationships
- Household-based communications

## 4. Groups & Ministry Teams

Groups represent recurring communities:
- Small groups
- Ministry teams
- Classes

Each group tracks members and roles (leader, co-leader, member). Use this for targeted communication, volunteer scheduling, and attendance.

## 5. Group Events & Attendance

Group events are scheduled against a group and use the standard attendance system. This allows leaders to track participation over time and see engagement metrics.

## 6. Messaging & Notifications

Members can use in‑app messaging to connect with staff or other members:
- Direct message threads
- Staff‑initiated threads for pastoral care
- In‑app notifications for new messages and updates
- Message attachments for resources and files
- Typing indicators and read status for context

Push notifications are supported when device tokens are registered and push keys are configured.

## 7. Volunteer Management

Volunteer roles store staffing needs and assignments:
- Create volunteer roles for each serving area
- Assign members to roles with an active status
- Track role health by member count

## 8. Tags & Segmentation

Tags provide lightweight segmentation:
- New member
- Donor
- Youth
- Choir

Use tags for audience targeting in communications and analytics.

## 9. Milestones

Milestones capture important spiritual steps:
- Baptism
- Confirmation
- Membership date
- Salvation or other key events

This gives leaders a pastoral view of member growth.

## 10. Relationship Graphs

Member relationships are stored as directed edges to build a care network:
- Define relationships like parent/child, spouse, mentor, or caregiver
- Create reciprocal links when needed
- Use relationship graphs for pastoral care, emergency contacts, and family context

## 11. Member Directory & Search

The member list supports search by name, email, phone, status, group, and tags. This is the foundation for directories and privacy‑aware listings.

Directory privacy controls:
- Visibility: public, members only, leaders only, private
- Field‑level sharing for email, phone, address, and photo

## 12. Onboarding Workflows

Onboarding workflows track structured steps for new members:
- Create workflows with ordered steps
- Assign workflows to members
- Track completion and due dates

Use workflows for new member classes, welcome calls, and ministry onboarding.

## 13. Online Membership Registration

Public registration allows new members to join online:
- Registration form creates an inactive member profile
- Email verification activates the profile
- Admins can resend verification links if needed

## 14. Member Self‑Service Portal

Members can manage their own profile and privacy settings:
- Update preferred name, phone, and address
- Control directory visibility and field‑level sharing
- View engagement score and recent activity
- Join volunteer shifts and submit surveys
- Set volunteer availability preferences

Operational note: admins must link the member record to the Clerk user (member `clerkUserId`) before self‑service access works.

## 15. Volunteer Scheduling

Volunteer shifts allow leaders to schedule coverage:
- Create shifts tied to a volunteer role
- Members can sign up and see their upcoming assignments
- Reminder job sends notifications before shift start
- Staffing gap alerts highlight under‑filled shifts in the next 48 hours (configurable)
- Volunteers can set weekly availability windows to guide scheduling

Task endpoint:
- `POST /tasks/volunteer/reminders`
- `POST /tasks/volunteer/gap-alerts`

## 16. Surveys & Feedback

Surveys are available for member feedback and event retrospectives:
- Create surveys with ordered questions
- Collect responses from the member portal
- Summaries are available for quick analysis
- Export responses to CSV for offline analysis
- AI summaries provide themes and recommendations when an AI provider is configured

## 17. Data Migration & Imports

## 18. Events, RSVP, and Recurrence

Events support RSVP requirements, paid tickets, and recurring series:
- Weekly or monthly recurring events
- RSVP tracking with capacity enforcement
- Ticket types with Stripe/Paystack checkout flows
- QR code check‑in + public kiosk roster for greeters
- Mobile check‑in (camera scan + manual fallback) for ushers
- Check‑in roster for attendance

Admins can import member data via CSV:
- Upload a CSV with core fields (name, contact, household, tags)
- Run a dry‑run to validate rows
- Imports upsert existing members by email or phone

## 19. Engagement & Analytics

Engagement data uses:
- Attendance records
- Donation history
- Group participation

Segmentation uses these signals to create cohorts like:
- New members
- Active attenders
- Recent donors
- Volunteers
- Lapsed members
- Missing contact details

Member profiles surface these metrics for pastoral care and outreach.

## 20. Security & Privacy

- All membership data is tenant‑scoped.
- Admin/staff roles gate access.
- Sensitive details (addresses, notes) should be shared on a need‑to‑know basis.

## 21. Key API Routes (High Level)

- tRPC: `member`, `household`, `group`, `memberTag`, `memberMilestone`, `volunteer`, `onboarding`, `survey`, `relationship`, `attendance`, `messaging`, `notifications`, `registration`, `event`

## 22. Recommended Alpha Operations

- Create households for families with children.
- Set primary contacts for giving statements.
- Stand up key ministry groups and assign leaders.
- Add milestones for baptisms and membership dates.
- Use tags for segmentation and communication targeting.
- Capture relationships for pastoral care and emergency context.
- Use check‑in for services and classes to measure attendance.
- Import legacy members via CSV for initial rollout.
- Enable RSVPs for high‑demand events.
- Turn on ticketed events for conferences or paid gatherings.
- Share kiosk check‑in links for guest-friendly check‑ins.
- Turn on messaging + notifications for staff care.

If you need operational playbooks for onboarding, follow‑ups, or volunteer scheduling, we can add them next.
