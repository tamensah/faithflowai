# ChurchTrack brand

**Status:** product identity and current visual baseline for design exploration, 24 September 2026. The product facts below are settled; the visual identity is a starting point to review with the owner, not a finished design system. See [the design handoff](docs/DESIGN_HANDOFF.md), [design-system.md](design-system.md), and [ui-principles.md](ui-principles.md).

## Product identity

- **Name:** ChurchTrack. Use it in all customer-facing interfaces, marketing, support, and plan names. FaithFlow AI is the previous product name.
- **Category:** global church management platform for one congregation or a multi-site church organization. It is not scoped to Ghana or Africa and does not support mosque or Islamic-organization structures.
- **Purpose:** help church teams run membership, events, giving records, communications, ministry work, and administration with clear ownership and trustworthy records.
- **Character:** calm authority, warmth without sentimentality, operational clarity, and respect for people doing real church work.
- **Primary audiences:** prospective church decision-makers, first-time organization admins, returning church admins and staff, congregation members, and ChurchTrack's internal platform operators. Each needs a distinct task-focused experience.
- **Illustrative customer:** use the fictional “ChurchTrack Organization” and its Headquarters Church, branches, and campuses in public examples. Real churches discussed during product discovery are not default marketing testimonials or demo identities.

## Brand promise and voice

ChurchTrack should make it easier to set up and operate a church workspace, understand what needs attention, and act with confidence. Write in plain, direct language. Name the object, action, consequence, and recovery path. Be welcoming during onboarding and precise in finance, access, and privacy flows. Avoid hype, exaggerated automation claims, and religious imagery or language chosen merely for decoration.

Describe capabilities according to their **verified release state**. Polar handles ChurchTrack subscriptions. Church-owned Paystack and Stripe giving connections are planned, not an active tenant payment flow. Nested headquarters and regional oversight is planned, not implemented. Do not imply that an interface, provider choice, or staging deployment proves a feature is live for customers.

## Current visual baseline, open to review

The previous brand guide proposed this palette and typography; current CSS in both applications largely reflects its HSL tokens. Treat these as **existing implementation**, not a final approval of the brand direction.

| Role | Current value |
| --- | --- |
| Deep navy | `#163A5F` |
| Teal | `#2C7A78` |
| Warm sand | `#E3B778` |
| Ivory | `#F7F5F0` |
| White surface | `#FFFFFF` |
| Charcoal text | `#1F2937` |
| Slate secondary text | `#6B7280` |
| Heading font | Sora |
| Body font | Source Sans 3 |

The current product uses a 4 px spacing scale, roughly 10 px control and 16 px card radii, line icons, and tabular numerals for financial data. These choices need a cross-surface coherence and accessibility review before becoming a final token specification.

## Decisions for the design engagement

Present a small number of distinct, defensible identity directions for the owner to choose from. Each should show the wordmark/mark, core palette, type pairing, imagery or illustration direction, and one real ChurchTrack screen. Explain how it works in the marketing site, church admin, member portal, and platform operations without giving each surface an unrelated identity. Propose a favicon and app icon. Test legibility at small sizes and on light/dark backgrounds; do not assume dark mode is a product requirement.

Do not silently replace the current colors, fonts, or logo with a new system in code. Record the approved direction and migrations in [design-system.md](design-system.md) after owner review.

## Naming boundary

The repository, `@faithflow-ai/*` package scope, database, and Neon Function slug still contain legacy service identifiers. They do not define the public brand. Renaming them is a separate coordinated technical migration, outside this design engagement.
