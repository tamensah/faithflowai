# ChurchTrack brand and product design handoff

**Prepared:** 24 September 2026 · **Design partner:** Claude Design · **Product:** ChurchTrack

## Assignment

Create a coherent ChurchTrack brand identity and design system, then design the key journeys across the public website, guided onboarding, member portal, church admin, and role-gated platform operations. This is a global church management product for one congregation or a multi-site organization. It is not a Ghana-only product and is not a mosque/Islamic-organization product.

Start with the product-local [brand](../brand.md), [design-system baseline](../design-system.md), and [UI principles](../ui-principles.md). They distinguish settled product facts from current styling and open visual decisions. Apply `$tms-design` as a product-aware craft overlay after these files, not as a substitute for them. Use the source components and rendered screens for implementation evidence. `docs/UI_COMPONENTS.md` is an older illustrative guide, not a verified component contract.

## Implementation baseline

The canonical design and implementation baseline is `develop`. It already contains a shared UI primitive library, admin navigation and page-layout improvements, member portal sub-routes, and a guided onboarding route. These were built without a complete approved visual system. Use the current product and this brief as the design reference; no retired branch is part of the engagement.

The product currently has four surfaces in two Next.js apps, with a shared Fastify API:

| Surface | Main user | Code | Staging starting point |
| --- | --- | --- | --- |
| Public website and onboarding | Prospective church and first admin | `apps/web/src/app/(marketing)` | [Website](https://churchtrack-web-git-develop-tamensahs-projects.vercel.app/) · [Get started](https://churchtrack-web-git-develop-tamensahs-projects.vercel.app/get-started) |
| Member portal | Member of one Church | `apps/web/src/app/portal` | [Portal](https://churchtrack-web-git-develop-tamensahs-projects.vercel.app/portal) |
| Church administration | Organization admin and Church staff | `apps/admin/src/app` | [Admin](https://churchtrack-admin-git-develop-tamensahs-projects.vercel.app/) |
| ChurchTrack platform operations | Authorized internal operators | `apps/admin/src/app/platform` | Role-gated `/platform` |

The staging links require suitable Clerk accounts and may change. Inspect real screens and their meaningful states before final approval; code and screenshots alone are incomplete usability evidence. The main ChurchTrack domain has not been purchased.

## Product model and honest capability boundary

The customer signs up for a Clerk **workspace/tenant**, which owns access and the Polar subscription. An in-app **Organization** represents their church network. Each **Church** is an independently operated congregation with members, staff, events, and giving. A **Campus** is a site that shares one Church's operating records. Headquarters or regional **oversight units** and delegated cross-Church authority are planned, not implemented. A church called a “campus church” may be a Church if it operates its own records. See [the church-structure review](CHURCH_STRUCTURE_REVIEW_2026-09-23.md).

Use fictional **ChurchTrack Organization** examples in public concepts. Show a Headquarters Church, branches, a university congregation, and a diaspora congregation to stress-test labels, long names, different countries, and permission scopes. Do not use a real church from discovery as public demo content or imply that a hierarchy tree already works.

ChurchTrack subscriptions use **Polar**. Church giving and paid events should eventually use each church's own **Paystack or Stripe** merchant connection, with Organization default and optional Church override; that tenant-owned flow is not active yet. Do not merge SaaS checkout and giving provider selection in a single design. See [payment ownership](PAYMENT_OWNERSHIP.md) and [provider status](PAYMENTS_PROVIDER_STATUS.md).

## Priority journeys and key screens

Design the connected journey first, then the supporting modules. For each screen show desktop and narrow-layout behavior plus relevant loading, empty, error, success, permission, and recovery states.

1. **Public entry:** home, Features, Plans, About, Guide, Contact, and clear Get Started actions. The content-rich website is the intended early-adopter entry, not a two-card demo gateway. Distinguish implemented features from preview or planned integrations and keep pricing honest.
2. **First admin onboarding:** account/social sign-in → workspace creation/selection → plan selection → Polar hosted checkout → return/pending confirmation → admin sign-in where separate staging domains require it → setup checklist. Preserve continuity and explain any repeated sign-in. Enterprise uses assisted setup rather than displaying `$0/month` as a real price.
3. **First Church setup:** explain the workspace/Organization/Church distinction at the point of naming; confirm the existing Organization, rename the already-provisioned first Church, suggest and explain a globally unique public slug, collect country and timezone, then open the operational workspace. Do not lead with “create another organization/church.”
4. **Church admin overview and navigation:** first-run state versus established church state; current Church/role context; one clear next action; operational alerts and useful metrics; progressive access to Members, Events, Giving, Billing, Finance, Comms, Staff, and ministry modules. Keep platform-only tools out of normal church admin navigation.
5. **Multi-site organization concepts:** distinguish current sibling Churches and Campus sites from the planned oversight graph. Design the future headquarters/region/branch model as a labeled concept, with delegated scope, inheritance, and per-Church context; do not make the future tree look like a shipped feature.
6. **Core work:** member list/profile and invitation or access request; event scheduling and check-in; giving records/finance with provider connection unavailable state; Polar billing and subscription status. Prefer task-driven views over a page of interchangeable summary cards.
7. **Member portal:** request access, profile/privacy, events, volunteer work, messages, notifications, and mobile navigation. A member should never land in the church admin or platform console by visual accident.
8. **Platform operations:** tenant overview, subscriptions, support/health, and role/permission views for ChurchTrack's own team. Share the brand system while making the operator scope unmistakable.

## Design deliverables

- Two or three distinct brand directions with rationale, wordmark/mark, favicon/app icon, accessible palette, type pairing, and imagery/illustration guidance. Show each in a real ChurchTrack screen before requesting the owner's choice.
- An approved, semantic design system documented in `brand.md`, `design-system.md`, and `ui-principles.md`: tokens, components, interaction states, responsive rules, accessibility, content patterns, and usage examples. Keep one source of truth; do not leave conflicting token lists in parallel files.
- A screen map and high-fidelity key flows above, with responsive variants and non-happy paths. Include the transition between web and admin as it actually behaves in staging.
- A component-to-code migration map for `packages/ui`, both Tailwind/CSS setups, and local app styles. Call out reusable pieces, duplicates, and the safest order to adopt the system across the four surfaces.
- A short decision log: what is approved, what remains proposed, what is blocked by product or backend work, and what was validated with real users or browser testing. Do not turn a visual concept into a release claim.

## Acceptance and collaboration

Lead with user journeys and information architecture before polishing colors. Show how a first-time church admin gets to a usable workspace without understanding implementation terms; how a returning staff member finds work quickly; and how a member knows what is private. Test common desktop and narrow screens, keyboard navigation, visible focus, contrast, realistic international names, long tables, empty accounts, and failed or delayed checkout. Follow the restrained, practical principles in `$tms-design`: calm operational screens, clear feedback, no decorative treatment that obscures work, and no stereotyped regional imagery.

Do not implement a brand direction as final until the owner chooses it. After approval, update the canonical product-local files and migrate the code in reviewable slices through `develop`; production `main` remains a separate promotion.

## Copy-ready prompt for Claude Design

> Work in the ChurchTrack repository from `develop`. Read `README.md`, `brand.md`, `design-system.md`, `ui-principles.md`, and `docs/DESIGN_HANDOFF.md` first. Apply `$tms-design` from `/Users/tamensah/Projects/tamensah_labs/Tamensah Labs AI Engineering/Skills/tms-design/SKILL.md` as a craft overlay. Inspect the implemented web, member, church-admin, and platform-ops screens and shared `packages/ui` components. Do not use retired branches as a design source.
>
> Create two or three distinct ChurchTrack identity directions grounded in this global church-management product, then show each on a real key screen. Ask me to choose the direction before finalizing the visual system. After selection, produce the approved brand specification, semantic design tokens, component and interaction patterns, responsive rules, and high-fidelity designs for the public site, first-admin onboarding through Polar checkout and Church setup, admin overview and core workflows, member portal, and separate platform operations. Include loading, empty, error, permission, payment, and recovery states, and a practical migration map into the current code. Keep ChurchTrack subscriptions on Polar; church-owned Paystack/Stripe giving connections and regional oversight are planned rather than live. Use fictional ChurchTrack Organization examples and preserve the four-surface product model. Validate accessibility and screen behavior in the browser; label anything not tested as unverified.
