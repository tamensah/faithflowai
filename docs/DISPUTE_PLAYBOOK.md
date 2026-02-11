# Dispute Resolution Playbook

This playbook is for finance/admin teams and developers operating dispute workflows. It assumes disputes are already ingested via Stripe/Paystack webhooks and visible in Admin → Finance.

## Goals
- Respond within provider deadlines
- Provide complete evidence in the correct format
- Reduce dispute loss rate over time

---

## 1) Triage (Day 0)

1. Identify dispute provider (Stripe or Paystack).
2. Verify donation record and donor details.
3. Confirm dispute reason and deadline (`evidence_due_by` in Stripe).
4. Assign an owner and record internal SLA (48–72h default).

---

## 2) Evidence Checklist

Use as many as relevant and accurate:

- Receipt (auto‑generated URL)
- Donor communications (email/SMS/WhatsApp logs)
- Refund policy or giving policy
- Event/service documentation (event records, attendance logs)
- Donor identity details (name, email, phone)

Best practice: include a short narrative tying evidence to the donor and donation.

---

## 3) Stripe Workflow

### Evidence submission
- Admin → Finance → Refunds & disputes → select dispute
- Upload evidence files and/or submit text
- Optional: click “Submit dispute” when evidence is complete

### Evidence guidance
- Use the correct evidence type: receipt, customer communication, service documentation, etc.
- A short narrative improves win rate (purpose, service delivered, date, confirmation).

### Deadlines
- Evidence must be submitted before the deadline (Stripe uses UTC).

---

## 4) Paystack Workflow

### Evidence submission
- Admin → Finance → Refunds & disputes → select dispute
- Submit text evidence (required fields):
  - customer email
  - customer name
  - customer phone
  - service details

Files are not supported in the Paystack evidence endpoint; use text and reference external documentation if needed.

---

## 5) Post‑Dispute Actions

- If dispute lost, evaluate refund policy and donor communication.
- If dispute won, record what evidence worked.
- Add a short internal note for recurring improvements (e.g., improved giving confirmation emails).

---

## 6) Internal SLAs (Recommended)

- Triage: < 24 hours
- Evidence submission: < 72 hours
- Follow‑up: within 7 days after dispute closure

---

## 7) Developer Notes

- Stripe evidence types are mapped to specific fields; keep them aligned with provider docs.
- Evidence submissions are logged in `DisputeEvidence` with status transitions.
- For automation, use `/tasks/communications/dispatch` with a cron to send donor confirmation sequences and reduce disputes.
