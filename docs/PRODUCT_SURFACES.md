# FaithFlow Product Surfaces

FaithFlow has four user-facing surfaces delivered by two Next.js applications and one shared API.

| Surface | Audience | Code location | Primary entry |
| --- | --- | --- | --- |
| Marketing website | Prospective churches and early adopters | `apps/web` | `/` |
| Member portal | Church members | `apps/web` | `/portal` |
| Church administration | Church owners, admins, and staff | `apps/admin` | `/dashboard` |
| Platform operations | FaithFlow platform operators | `apps/admin` | `/platform/*` |

The platform operations routes are role-gated. A newly registered church user must not be sent there. The normal self-service journey is:

1. Visit the marketing website.
2. Create an account.
3. Create or select a Clerk organization.
4. Complete church onboarding and plan selection.
5. Land in the church administration dashboard with the organization context active.
6. Invite staff and members from the church workspace.

The member portal and church administration dashboard are separate experiences even though they share identity, tenant context, and the Fastify API. FaithFlow's own operators use the platform routes inside the admin application rather than a separate frontend deployment.

The prior `phase-2-auth-and-core-features` work is a UX donor for these surfaces. See [`UX_BRANCH_RECONCILIATION.md`](./UX_BRANCH_RECONCILIATION.md) for the selective porting rules.
