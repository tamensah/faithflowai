# ChurchTrack Product Surfaces

ChurchTrack has four user-facing surfaces delivered by two Next.js applications and one shared API.

| Surface               | Audience                                | Code location | Primary entry                       |
| --------------------- | --------------------------------------- | ------------- | ----------------------------------- |
| Marketing website     | Prospective churches and early adopters | `apps/web`    | `/`                                 |
| Member portal         | Church members                          | `apps/web`    | `/portal`                           |
| Church administration | Church owners, admins, and staff        | `apps/admin`  | `/`                                 |
| Platform operations   | ChurchTrack platform operators          | `apps/admin`  | `/platform` and protected subroutes |

The platform operations routes are role-gated. A newly registered church user must not be sent there. The normal self-service journey is:

1. Visit the marketing website.
2. Create an account.
3. Create or select a Clerk organization workspace, which owns the customer account and subscription.
4. Choose a plan and complete the configured checkout (Polar sandbox in staging).
5. Land in church administration with the organization context active. Confirm the already provisioned in-app Organization and first Church; name the Church and set its slug and country.
6. Invite staff and members from the church workspace.

An operating congregation is a Church even when the customer calls it a branch or campus church. A Campus is a site that shares a Church's operating records. Regional and headquarters oversight of child Churches is not yet implemented; see [`CHURCH_STRUCTURE_REVIEW_2026-09-23.md`](./CHURCH_STRUCTURE_REVIEW_2026-09-23.md).

The member portal and church administration dashboard are separate experiences even though they share identity, tenant context, and the Fastify API. ChurchTrack's own operators use the platform routes inside the admin application rather than a separate frontend deployment.

The prior `phase-2-auth-and-core-features` work is a UX donor for these surfaces. See [`UX_BRANCH_RECONCILIATION.md`](./UX_BRANCH_RECONCILIATION.md) for the selective porting rules.
