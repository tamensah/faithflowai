# UX Branch Reconciliation

The work on `phase-2-auth-and-core-features` is treated as a UX donor, not as the product's canonical code line. It has no Git merge base with the current repository history and carries a smaller, incompatible Prisma schema. The canonical development line remains `develop`.

## What the donor branch contributes

The donor branch contains useful experience work that addresses real gaps:

- a guided church onboarding route that creates or selects a Clerk organization;
- a first-workspace setup step before opening the church dashboard;
- clearer organization-context and security-policy explanations;
- more structured dashboard navigation and visual hierarchy;
- a concise early-adopter landing page and direct onboarding calls to action;
- reusable cards, tables, charts, sidebar, and top-navigation components.

These artifacts are preserved in the recovery backup and must be reviewed as design and interaction references.

## Why it cannot be merged wholesale

- Its Git history is unrelated to canonical `develop`.
- Its Prisma schema has 33 models and four migrations; canonical `develop` has 96 models and 32 migrations.
- Its API/router structure differs from the current Fastify and shared tRPC implementation.
- Its route hierarchy differs from the canonical four-surface product model.
- Its local worktree contains extensive uncommitted changes, so a branch merge would mix intended UX work with infrastructure and compatibility experiments.

## Porting rules

1. Start every port from current `develop` on a feature branch.
2. Define the user journey and acceptance criteria before copying code.
3. Reimplement the interaction against the canonical schema, API, RBAC, and route structure.
4. Preserve tenant isolation and server-side role checks; do not solve UX errors by weakening authorization.
5. Add browser coverage for sign-up, organization creation/selection, church workspace provisioning, dashboard arrival, and sign-out/sign-in recovery.
6. Merge each coherent UX slice through a PR to `develop` after staging validation.

## Recommended sequence

1. **Onboarding recovery:** marketing call to action → sign-up → Clerk organization → church workspace provisioning → church admin dashboard.
2. **Access recovery states:** distinguish no organization, workspace not provisioned, insufficient church role, and platform-operator access.
3. **Navigation shell:** port the strongest sidebar/top-navigation patterns without changing canonical route ownership.
4. **Dashboard information design:** port cards, tables, charts, and contextual empty states module by module.
5. **Marketing refinement:** reconcile the donor's concise early-adopter messaging with the fuller canonical marketing website.

The original donor work is therefore retained as product design input. Database migrations, dependency upgrades, and production configuration come only from the canonical branch line.
