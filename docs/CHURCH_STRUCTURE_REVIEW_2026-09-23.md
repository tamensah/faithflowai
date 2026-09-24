# ChurchTrack structure and onboarding review — 23 September 2026

ChurchTrack is a **global church management platform** for a single congregation or a multi-site network. A Ghanaian network is a useful stress test, not the only structure the product should support. Customer-facing examples use the fictional **ChurchTrack Organization**; a real church's identity and topology belong in internal discovery material only.

## The customer journey we need

1. A person creates their login.
2. They create or select their organization's workspace, which owns access and the subscription.
3. They choose a plan and complete the configured checkout.
4. The first in-app Organization and Church are already present. The Organization inherits the workspace name when it can be read from Clerk; the admin confirms it, names the first congregation, reviews the suggested public slug, and selects the real country.
5. The admin adds further operating Churches, invites staff, and adds members. Additional hierarchy and delegated regional oversight are a separate feature, not a hidden capability of the current Overview.

The interface must present this as one coherent setup. The workspace is the customer account; the in-app Organization represents the ministry network. Asking the customer to create both with the same name without explanation is confusing. The initial Organization now uses the workspace name when available, but the two-record model remains and needs a deliberate product decision before a larger UI redesign.

## Canonical classification rule

Classify by **operational responsibility**, not by what a customer calls the location:

| If it… | Model it as… | Current support |
|---|---|---|
| Owns the subscription and access boundary | Workspace / Tenant | Yes |
| Represents the ministry network within that workspace | Organization | Yes |
| Maintains its own congregation, staff, events, and giving | Church | Yes |
| Supervises several Churches without necessarily being a congregation | Oversight unit (headquarters, region, area, district) | **No** |
| Is a meeting venue sharing a Church's members and financial records | Campus / site | Partial: Campus exists, but the setup UI does not manage it |

For example, a fictional ChurchTrack Organization may have a Headquarters Church, five directly supervised branches, several regional groups with their own branches, independent university campus churches, and a Swiss diaspora church. The headquarters **office** is an oversight unit; the Headquarters **Church** is the operating congregation at that location. A customer may call an independent congregation a “campus”; it still needs Church-level operations. A university meeting site sharing another Church's records is instead a Campus. A country's administrative regions are not the same as a customer's oversight regions, so neither Ghana's count nor any other national map should be hard-coded.

For an international Church, country and timezone must be explicit at the Church level, and legal or billing separation may require a separate workspace. The system currently creates the first Church with timezone `UTC`; the Overview does not yet ask for its timezone. Treat that as an international onboarding gap before time-sensitive communication goes live.

## Verified implementation, not projected capability

- `Tenant → Organization → Church → Campus` exists in `packages/database/prisma/schema.prisma`. Members and staff belong to a Church. Events and facilities may also refer to a Campus.
- `Church` has no parent Church, region, district, or oversight-unit relation. The database and admin UI cannot represent headquarters or regional authority over child Churches.
- `StaffMembership` is scoped to a Church. There is no implemented multi-level regional role or roll-up permission model.
- The first Organization, Church, and Campus are provisioned in `apps/api/src/context.ts`; the first Church's previous `US` country assumption was unsuitable for a global product.
- Public event, fundraiser, registration, and giving routes look up a Church by slug. A global unique slug and a clear collision error are needed until public URLs include a second scope component.
- `docs/notes/MEGA_CHURCH_READINESS.md` previously claimed OrgUnit, scoped assignments, aliasing, and hierarchy rollups were implemented. Those claims do **not** match the current schema or routers. The document now labels them as planned work.

An [official Church of Pentecost description of its district](https://thecophq.org/the-district/) places districts under areas and local congregations under districts; its [local-congregation description](https://thecophq.org/local-congregation/) names the local assembly as an operating level. This is evidence that one fixed “region → branch → campus” vocabulary would be too narrow, not a claim that every African or global church uses that structure.

## Next architecture slice: hierarchy without duplicate Church records

Add a tenant-scoped **oversight graph** for headquarters, regions, areas, districts, and other customer-defined groups. Each oversight unit has a parent (except the root), a type/label, leaders with scoped permissions, and child units or Churches. Link each existing Church to its place in that graph rather than replacing Church records or moving members and payments into generic nodes. This retains current operating data while enabling headquarters and regional reporting. Enforce no cycles, same-tenant parent/child links, one clear home for each Church, and authorization on every traversal. Decide separately whether one Church may report to multiple oversight units; default to one reporting parent until that need is proven.

The branch/campus/assembly terminology should be configurable **display language** for operating Churches. It should not determine data ownership. A Campus remains a site within one Church unless a migration explicitly changes that contract. Existing `docs/brainstorm/perspective.md` and the enterprise reference describe the desired flexibility; they are design inputs, not acceptance evidence.

## UX/UI work, in priority order

1. **One visible setup path:** after checkout, show a focused checklist for Organization name, first Church name, country, timezone, and slug; hide the “create another” forms until the first Church is ready. Preserve the rest of the dashboard behind a clear “Open workspace” step.
2. **Church structure screen:** show the network as a tree with expandable oversight groups and Churches. Only expose “Add region” and delegated roles after the hierarchy API and authorization exist. The current flat Churches panel must not imply nesting.
3. **Clear words at decision points:** distinguish “organization workspace,” “network Organization,” “Church/congregation,” and “Campus/site.” Let a customer choose a display label for Churches only after the meaning is explained.
4. **Progressive navigation:** separate first-time setup from daily operations; show the church admin's active Church and role. Keep platform-operator controls in their own scope.
5. **International defaults:** collect country and timezone; show currency and payment-provider availability accurately for each market. Avoid defaulting to the United States or claiming providers are active where they are not.

## Release evidence needed

The 24 September staging deployment applied the global slug and country-default migrations and served the updated web guide, home, and admin sign-in pages. The checks below still require real customer-flow and authorization testing; a 200 response does not complete them.

- A fresh single-congregation account completes checkout, names its Church, and reaches the admin without duplicate Organization/Church creation.
- A multi-site test account adds two Churches with different countries; staff, members, events, and giving stay in the correct Church.
- Two separate customers cannot claim the same public Church slug; the second receives a useful error and can choose another.
- The first Church's country is explicitly chosen; timezone is configured before scheduled communications are enabled.
- After the hierarchy slice ships, a headquarters leader can see descendant Churches while a branch leader cannot read a sibling branch. Regional totals match underlying Church records.
- New UI is checked on desktop and mobile with a first-time admin and a returning admin. A successful build or Ready deployment alone is not evidence that the journey works.
- Before inviting external early adopters, audit every public feature, pricing, and privacy claim against the deployed behavior and provider contracts. The homepage, About, Features, and Plans pages previously described unfinished regional oversight and payment integrations as live; their most direct claims were corrected here, but a full commercial and legal copy review remains a release gate.
