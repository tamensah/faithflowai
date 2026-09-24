# ChurchTrack UI principles

These principles describe the user experience ChurchTrack needs across its four surfaces. They complement [brand.md](brand.md) and the [design-system baseline](design-system.md); they do not declare unbuilt features complete.

## One job and one scope at a time

Show the user's current workspace, Church, role, and page purpose before secondary metrics or actions. Keep ChurchTrack platform operations separate from church administration, and church administration separate from the member portal. A first-time admin should see the next setup action, while a returning admin should see operational priorities. Do not force users to parse every module on the first screen.

## Explain the church model where decisions happen

A Clerk organization workspace owns the customer account and subscription. The in-app Organization represents the church network. A Church is an independently operated congregation with its own members, staff, events, and giving. A Campus is a site sharing a Church's operating records. These records currently exist; nested regional/headquarters oversight does not. Use the customer's language for branches and campus churches only after explaining which record owns operations. Do not imply a tree or delegated authority before it is built. See [church structure review](docs/CHURCH_STRUCTURE_REVIEW_2026-09-23.md).

## Make the first journey continuous

The intended path is public site → account → workspace → Polar plan checkout → return and confirm subscription → church admin → finish the already-created Organization and first Church. Suggest a readable unique slug, explain that it appears in public links, ask for the actual country, and specify how to collect timezone (currently missing). Avoid asking the user to create duplicate records. The current web and admin apps use separate staging domains; a second Clerk sign-in can occur there. Design that handoff truthfully rather than depicting invisible single sign-on.

## Be exact about money and access

Polar handles ChurchTrack's subscription. A church's donations and paid events belong to that church's own connected Paystack or Stripe account when the future connection flow is verified. Do not combine those provider choices in one pricing control or show church giving as available before connection. Show trial, checkout, pending activation, failed payment, refund, and permission states with their actual next action. An access-denied screen must explain which scope is missing and how an authorized user can recover without suggesting unsafe self-escalation.

## Design the whole state, not just the ideal screenshot

For each flow, show loading, empty, validation, error, disabled, success, and permission states as applicable. Preserve user input on errors. Confirm consequential actions, give specific recovery, and make progress or background work visible. Never label a payment, invite, import, or provider setup “complete” until the server confirms it.

## Global by design

Use realistic names, addresses, timezones, currencies, and long organization names from more than one region. Do not default every church to the US or Ghana, assume one country-wide hierarchy, or make African-market context a visual motif. Financial, consent, provider, and communication availability must follow the actual church and merchant location. Design first for legibility and useful performance on common desktop and mobile conditions; there is no native mobile app in scope.

## Accessible, calm, and testable

Use semantic headings and controls, visible focus, keyboard-operable navigation, readable text, sufficient contrast, and touch-friendly actions. Do not rely on hover, motion, or color alone. Respect reduced-motion preferences. Check the rendered flow on desktop and narrow screens, including long data and failures; design files and successful builds are not usability evidence.
