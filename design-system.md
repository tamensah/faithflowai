# ChurchTrack design system: current baseline and handoff

**Status:** inventory and design contract, not a completed or approved token library. Use [brand.md](brand.md) for product identity, [ui-principles.md](ui-principles.md) for interaction rules, and [the design handoff](docs/DESIGN_HANDOFF.md) for deliverables. Claude Design should propose and document the final system before implementation replaces current tokens.

## What is implemented today

- Both Next.js applications load Sora and Source Sans 3 from their root layouts and share near-identical HSL color tokens in `apps/web/src/styles/globals.css` and `apps/admin/src/styles/globals.css`.
- Tailwind configurations map background, foreground, primary, secondary, accent, muted, border, ring, typography, and radii. The admin stylesheet adds `surface` and `surface-2` plus local `.ff-surface` and `.ff-kpi` treatments.
- `packages/ui/src/components/` contains shared buttons, fields, cards, tables/data tables, tabs, dialogs, sheets, popovers, badges, feedback primitives, and related controls. Reuse or evolve these rather than create unrelated controls in each app.
- The admin shell groups navigation by Workspace, Ministry, Intelligence, and role-gated Platform. The member portal has its own desktop navigation and mobile bottom navigation. The marketing site uses a separate public shell.

These are implementation observations, not evidence that every screen is visually consistent or accessible. `docs/UI_COMPONENTS.md` contains older illustrative snippets and is not a verified component API. Inspect the source components and rendered screens before specifying their final variants.

## Current token seed

| Semantic use | Existing token | Existing value | Review needed |
| --- | --- | --- | --- |
| Page background | `--background` | `45 33% 96%` | Contrast and surface layering |
| Main text | `--foreground` | `222 47% 11%` | Long-form and dense-table readability |
| Primary action | `--primary` | `210 63% 23%` | Hover, pressed, disabled, focus |
| Secondary action | `--secondary` | `178 47% 33%` | Distinction from success state |
| Accent | `--accent` | `35 68% 68%` | Restrained use and contrast |
| Secondary text | `--muted` | `220 8% 46%` | Small text and placeholders |
| Border | `--border` | `220 13% 91%` | Controls, separators, tables |
| Focus | `--ring` | `210 63% 23%` | Visibility on every surface |

The current tokens do not define a full status scale, data visualization palette, density variants, or comprehensive component states. The final system should add these only where actual ChurchTrack workflows require them.

## Required final specification

1. **Foundations:** approved logo use, color roles and accessible pairs, type scale, spacing/layout scale, radii, borders, elevation, icon rules, motion limits, responsive breakpoints, and financial/data formatting. Include light-mode defaults; add dark mode only if approved.
2. **Components:** variants and anatomy for navigation, buttons, links, fields/selects, validation, cards, stepper/checklist, tabs, tables, filters, dialogs/sheets, banners, notices, empty/loading/error/success states, access restrictions, and provider or payment-status indicators.
3. **Patterns:** first-run setup, hierarchy/context switching, create/edit forms, bulk operations, destructive actions, role-limited views, saved/unsaved feedback, asynchronous checkout handoff, and responsive dense data.
4. **Four-surface coherence:** one ChurchTrack identity with deliberate density and navigation differences for marketing, member, church admin, and platform ops.
5. **Implementation mapping:** map new semantic tokens to the two Tailwind/CSS files and shared `packages/ui` components; identify which local styles should be consolidated. Supply migration notes so screens can be updated in slices without mixing systems.

For each component and key screen, specify default, hover/focus, loading, empty, validation, error, disabled, success, permission, and retry states where relevant. Include keyboard and touch behavior, screen-reader labels, reduced-motion behavior, and responsive composition. A static mockup alone is not the system.

## Non-negotiable interaction constraints

- Do not use color alone for status. Financial amounts, access levels, and checkout states need text and clear semantics.
- Avoid decorative gradients, glass effects, or card proliferation that make operational work harder to scan.
- Keep high-frequency admin tasks calm and compact; keep first-run onboarding guided and progressive.
- Do not invent live payment availability, nested regional authority, or a production domain in design copy.
- Validate final contrast, focus order, keyboard access, touch targets, overflow, and realistic long names/numbers in implementation.
