# FaithFlow AI — Pricing Strategy

> Internal reference for pricing decisions, competitive positioning, and market strategy.
> Last reviewed: March 2026.

---

## Our Position

FaithFlow AI is the only church management platform that combines:
- **Full-suite SaaS** (membership, finance, events, comms, volunteer, pastoral care, streaming, AI) in a single subscription
- **Native multi-currency giving** — Stripe (USD/international) + Paystack (NGN, GHS, KES, ZAR, XOF, USD)
- **Live streaming integrations** — YouTube, Facebook, Vimeo with auto-transitions and moderation (no competitor at this price tier)
- **Built-in AI** — donor insights, comms drafting, attendance forecasting, segment watchlists
- **Global-first architecture** — multi-campus, multi-currency, multi-timezone from day one

This combination is not available from any single competitor at any price. We are building a global church operating system.

---

## Competitive Landscape

### Direct Competitors

| Platform | Model | Mid-size church cost | Key weakness |
|---|---|---|---|
| **Planning Center** | À la carte per app | $100–250+/mo | Modular pricing adds up fast; no AI; US-only giving |
| **Breeze / Tithely** | Flat all-in | $72/mo | Unlimited members but shallow features; no AI; no streaming; no local currency |
| **Pushpay ChMS** | Quote-based | $300–600+/mo | Enterprise-skewed; expensive; adds platform giving fee on top |
| **Fellowship One** | Tiered | $179+/mo | Legacy UX; limited AI; no Paystack |
| **Subsplash** | App + giving | $99–250+/mo | App-focused; not a full ChMS |
| **ChurchCast (GH)** | Local | Unknown | Ghana-only; limited feature scope |
| **DaChurchMan** | Local | Unknown | Basic features; no AI; no streaming |

### African / Diaspora Market (Uncaptured Opportunity)

No major global ChMS has native Paystack integration or local-currency giving flows. Local alternatives (ChurchCast, DaChurchMan) are operationally basic. The 500M+ Christian population across sub-Saharan Africa, West Africa, and the diaspora is almost entirely unserved by modern SaaS ChMS.

**FaithFlow is the first global ChMS built to serve this market natively.**

MTN MoMo alone processes GHS 1.4 trillion annually in Ghana. The demand for digital church giving is proven — the infrastructure for a platform to capture it is not yet there from any competitor.

---

## Current Pricing (as of March 2026)

| Plan | Monthly | Annual | Members | Campuses |
|---|---|---|---|---|
| Starter | $49/mo | $490/yr ($41/mo) | 1,000 | 1 |
| Growth | $149/mo | $1,490/yr ($124/mo) | 5,000 | 5 |
| Enterprise | Custom | Custom | Unlimited | Unlimited |

**No platform giving fee** on any plan. Standard Stripe/Paystack processing rates apply (2.9% + $0.30 for Stripe; 1.5% + ₦100 for Paystack). Pushpay and some competitors layer their own cut on top — we do not.

---

## Pricing Decisions & Rationale

### Starter at $49/mo (1,000 members)

**Why $49:** Accessible entry point below Breeze/Tithely ($72) while offering more features. Target: small-to-mid churches with 50–500 active members.

**Why 1,000 members (not 500):** The original 500-member cap was defensive. Breeze offers unlimited at $72. Our cap at 500 created a "less for less" perception. 1,000 members covers ~95% of small churches and signals confidence in our value.

**Why Pastoral Care is included at Starter:** It's a low-infrastructure feature (forms + notes + assignment tracking) but high in ministry value. Including it at Starter differentiates us immediately — no competitor includes pastoral care workflows at this price point. It shows FaithFlow is built for ministry, not just administration.

**What's excluded at Starter:** Streaming (requires provider integrations + infrastructure), Facilities, Custom Domain. These are growth-appropriate features that justify the Growth upgrade.

### Growth at $149/mo (5,000 members, 5 campuses)

**Why $149:** Planning Center alone (without AI, streaming, or local giving) runs $150–250/mo for a mid-size church using multiple apps. We include everything for $149.

**Why this wins globally:** A diaspora church with campuses in London, Toronto, and Lagos needs multi-currency giving, multi-campus management, and streaming — all covered at $149. No competitor serves this need at this price.

**Key differentiators at Growth:**
- Live streaming with YouTube/Facebook/Vimeo — no competitor at this tier
- AI insights — first-wave donor risk, giving trends, attendance prediction
- Paystack + Stripe giving side by side
- 5 campuses with inter-campus analytics

### Enterprise (Custom)

**Target:** Multi-campus networks (50+ campuses), denominational bodies, large diaspora ministries, and churches with custom compliance requirements.

**Anchoring signals:** Unlimited members/campuses, custom rollout plan, priority SLA, dedicated support. Price anchored to Pushpay territory ($300–600+/mo) but with significantly more feature depth.

### Annual Billing (Save 2 Months)

Offering 2 months free on annual billing ($41/mo and $124/mo respectively):
- Improves ARR predictability and cash flow
- Standard SaaS conversion driver — reduces monthly churn risk
- Signals seriousness from the church (reduces involuntary churn)

### No Platform Giving Fee

This is a genuine competitive differentiator:
- Pushpay layers their own fee on top of card processing
- Some platforms charge 0.5–1% on giving volume
- We charge nothing — churches keep every dollar beyond what Stripe/Paystack takes
- At scale this saves a church thousands per year in giving volume fees

**This must be communicated clearly on the pricing page.** It removes a common objection and is provably better than competitors.

---

## Global Market Strategy

### Phase 1: English-speaking global (current)
- US, UK, Canada, Ghana, Nigeria, Kenya, South Africa, diaspora networks
- USD billing for all, Paystack for local giving flows

### Phase 2: Localised pricing (upcoming)
- GHS / NGN / KES pricing tiers for African continental churches
- Adjust price points to purchasing power parity — a Ghanaian church should not pay the same USD rate as a US church
- Suggested: GHS 299/mo Starter, GHS 799/mo Growth (approximate equivalents at current FX)

### Phase 3: Denomination networks
- Denominational body licenses covering all member churches
- Usage-based pricing per active church in the network
- White-label options for denominations wanting branded ChMS

---

## Messaging Principles

1. **Lead with outcomes, not features.** "Run your church like a world-class organisation" beats a feature list.
2. **Name the competitors indirectly.** "No à la carte pricing" (Planning Center), "No platform giving fee" (Pushpay).
3. **Africa and diaspora is a first-class market**, not a footnote. Paystack is a feature to lead with for that audience.
4. **AI is a differentiator now, not a gimmick.** Frame it as "always reviewed, never auto-applied" to build trust.
5. **Annual billing default.** Show annual price first, monthly as secondary.

---

## Pricing Review Cadence

- Review pricing positioning every 6 months or after reaching 100 paying tenants
- Trigger a full review if: churn rate exceeds 5%/month, conversion rate from trial drops below 20%, or a major competitor changes pricing significantly

---

*FaithFlow AI Pricing Strategy · Internal document · March 2026*
*Cross-reference: `docs/FEATURES_TRACKER.md`, `docs/SUBSCRIPTION_SYSTEM.md`*
