# ChurchTrack payment ownership

## Two separate payment relationships

| Money flow | Seller or recipient | Provider | ChurchTrack responsibility |
| --- | --- | --- | --- |
| ChurchTrack subscription | ChurchTrack | Polar | Sell Starter/Growth access, reconcile subscription state, and enforce tenant entitlements. |
| Church giving, donations, recurring gifts, and paid events | The subscribing church or organization | That church's connected Paystack or Stripe merchant account, where available | Supply the giving experience and tenant-scoped ledger, then reconcile provider-confirmed transactions. |

Polar subscription credentials must never be used for a church's donations. ChurchTrack's own Stripe or Paystack keys must never become a fallback merchant for church giving. The QRVIBE Paystack organization is not a default merchant account for ChurchTrack tenants.

## Merchant connection scope

An Organization should own the default giving connection. Its Churches (headquarters, branches, campuses, and diaspora locations) inherit that connection unless an authorized organization admin configures and verifies a separate connection for a Church that settles funds independently. Every checkout stores the exact merchant connection ID and Church ID used; changing the current setting must not change the attribution of earlier transactions.

The Church chooses which of its verified providers to offer. Where both are enabled, a donor can choose between them. Provider and currency availability depend on the merchant's country and enabled payment methods. A provider being available for ChurchTrack's own subscription does not make it available for a tenant's giving.

## Required connection flow

1. An organization admin connects a merchant account and confirms its legal owner, country, settlement destination, supported currencies, and operating mode (test/live). A Church override needs the same checks and explicit permission.
2. Stripe giving should use a connected account and create direct charges on that account. Connect onboarding and account status determine whether charges and payouts are enabled; the platform must not substitute its own merchant account. ChurchTrack's platform Stripe account and eligibility are separate prerequisites from any tenant account.
3. Paystack giving needs an individual merchant integration for the church. Paystack's documented API uses a merchant secret key; if no suitable delegated authorization is available, ChurchTrack must store each church's secret in a secure secret store, never in a client response or plain database field. A Paystack subaccount/split under QRVIBE would make QRVIBE the main merchant and is not the default design here.
4. Checkout fails closed until the selected connection is verified and supports the amount, currency, and payment mode. No global `STRIPE_SECRET_KEY` or `PAYSTACK_SECRET_KEY` fallback is permitted for tenant financial activity.
5. Webhooks are signature-verified with the correct connection's secret or Connect endpoint, then matched to the stored merchant connection, tenant, Church, provider reference, amount, and currency. Processing is idempotent. Callbacks alone do not mark a gift paid.
6. Refunds, disputes, recurring gifts, payout/settlement sync, receipts, and finance exports must use the same historical connection identity and remain tenant-scoped. Disconnecting an account stops new checkout but preserves historical records and reconciliation access as appropriate.

## Current implementation and release gate

The existing giving code uses server-wide Stripe and Paystack secrets and has no tenant merchant-connection model. That is incompatible with the ownership rule above. New online donation, recurring-gift, and paid-event checkout is blocked in the `develop` API code until verified church-owned connections replace the guard; the staging API still needs a safe redeploy. Manual donation records remain possible. The existing UI and older finance documentation may show provider choices; those choices are not evidence of an active connection. Do not set a shared platform secret to make giving appear to work.

Before a public pilot, test at least two separate church organizations and verify that each checkout, webhook, refund, and settlement maps only to its own account and ledger. Also test a branch inheriting the parent connection and one with an explicit override, failed/disconnected accounts, wrong-currency attempts, duplicate webhooks, delayed payments, and cancellation of recurring gifts. This is separate from Polar subscription testing.

Provider references: [Stripe connected-account requests](https://docs.stripe.com/api/connected-accounts), [Stripe Connect onboarding](https://docs.stripe.com/api/account_links/create), [Paystack API-key ownership](https://paystack.com/docs/api/authentication/), [Paystack split payments](https://paystack.com/docs/payments/multi-split-payments/), and [Paystack signed webhooks](https://paystack.com/docs/payments/webhooks/).
