# FaithFlow AI Finance Manual

This guide explains how the finance domain works across donations, budgeting, reconciliation, and reporting. It is written for both developers and early adopters who need to operate the platform confidently.

## 1. Core Concepts

- **Fund**: A designated bucket for giving (e.g., General Fund, Missions). One fund can be set as the default.
- **Campaign**: Time‑boxed or goal‑based giving focus (e.g., Building Fund). Campaigns can have target amounts and dates.
- **Donation**: A gift record created after a payment is initiated and completed (or manually recorded).
- **Payment Intent**: The in‑progress payment record tied to the checkout and provider reference.
- **Recurring Donation**: A scheduled subscription (Stripe or Paystack) that generates donations on each cycle.
- **Pledge**: A commitment to give over time; it can be fulfilled by one or many donations.
- **Receipt**: A generated receipt for a completed donation (HTML page + optional email delivery).
- **Expense**: A tracked outflow of funds with approvals and categories.
- **Budget**: A top‑level budget window with line items and allocations.
- **Payout**: A provider settlement (Stripe payout or Paystack settlement) that reconciles bank deposits.
- **Payout Transaction**: An individual charge/fee entry belonging to a payout.

## 2. Giving & Checkout Flow

1. **Start checkout**
   - Admin /giving: create Stripe or Paystack checkout links.
   - Public /give: calls `POST /public/giving/checkout`.
2. **Payment intent created**
   - Status starts as `REQUIRES_ACTION` then `PROCESSING`.
3. **Provider redirect**
   - Stripe/Paystack processes the payment and returns to success/cancel URLs.
4. **Webhook confirmation**
   - `POST /webhooks/stripe` or `POST /webhooks/paystack` updates the donation status.
5. **Receipt issuance**
   - For completed donations a receipt is generated and can be emailed.

## 3. Recurring Donations

- Supported providers: Stripe + Paystack.
- A recurring checkout creates a `RecurringDonation` and provider subscription reference.
- Webhooks update the next charge date and create donations on each billing cycle.

## 4. Text‑to‑Give (SMS)

- Twilio inbound SMS → `/webhooks/twilio/sms`.
- Format: `GIVE 50 USD` or `GIVE 50 GHS email@domain.com` (Paystack requires email).
- The system creates a checkout URL and replies to the donor.

## 5. Multi‑Currency

- Currency is stored per donation and per fund/campaign.
- Paystack currency restrictions are enforced by `Church.countryCode` and minimum amounts.
- Stripe supports most currencies; the checkout uses the currency supplied.

## 6. Reconciliation

- Stripe payouts: `syncStripePayouts` pulls payouts and balance transactions.
- Paystack settlements: `syncPaystackSettlements` pulls settlements and settlement transactions.
- Payout entries are stored in `Payout` and `PayoutTransaction`.

## 7. Budgets & Expenses

- Budgets have a start/end window and line items with allocated amounts.
- Expenses are captured with categories and approval status.
- Finance dashboard aggregates totals by currency for budgets and expenses.

## 8. Receipts

- Each completed donation can generate one receipt (unique receipt number).
- Public receipt access: `GET /public/receipts/:receiptNumber`.
- Receipts can be emailed via Resend.

## 9. Refunds & Disputes

- Refunds can be issued for Stripe, Paystack, or manual donations.
- Partial refunds are supported; full refunds mark the donation as `REFUNDED`.
- Disputes (chargebacks) are tracked per provider and linked to donations when possible.
- Evidence can be uploaded and submitted for Stripe disputes (text or files).
- Dispute monitoring task alerts staff before evidence deadlines: `POST /tasks/disputes/monitor`.
- See the dispute playbook: `/Users/tamensah/aihub/faithflow_ai/docs/DISPUTE_PLAYBOOK.md`.

## 10. Reporting & Exports

- CSV exports are available for:
  - Donations
  - Expenses
  - Pledges
  - Recurring donations
  - Receipts
  - Payouts
  - Refunds
  - Disputes
- Admin console `/finance` exposes the export actions.

## 11. Analytics & Forecasting

- Donation trends are calculated monthly by currency.
- Forecasts use a rolling 3‑month average to project next month and next quarter.
- Donor segmentation classifies new, active, lapsed, and recurring donors for targeted follow‑ups.

## 12. Audit & Compliance

- All finance operations write audit logs (donations, pledges, recurring, expenses, budgets, receipts, funds, campaigns, payouts).
- Logs are tenant‑scoped and visible in admin `/finance`.

## 13. Operational Guardrails

- **Tenant isolation** is enforced in every finance query.
- **Provider webhooks** are verified before any data is written.
- **Receipts** can be voided for compliance; voids are logged.
- **Reconciliation** is designed to be idempotent (upsert‑based).

## 14. Key API Routes (High Level)

- `POST /public/giving/checkout`
- `POST /webhooks/stripe`
- `POST /webhooks/paystack`
- `POST /webhooks/twilio/sms`
- `GET /public/receipts/:receiptNumber`
- `GET /public/fundraisers/:churchSlug/:slug`
- tRPC: `giving`, `finance`, `pledge`, `recurring`, `receipt`, `fund`, `campaign`

## 15. Recommended Alpha Operations

- Create one default fund and at least one campaign.
- Validate Paystack country code for the church.
- Configure text‑to‑give numbers (if SMS is enabled).
- Run payout sync weekly during pilot.
- Export donations monthly for bookkeeping.

If you need specific operational playbooks (e.g., weekly close, donor statements, year‑end receipts), we can add them.
