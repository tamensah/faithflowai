# FaithFlow AI — Hiring Plan

> Key positions needed to operate and grow the platform.
> Prioritised by impact at each stage of growth.

---

## Hiring Philosophy

FaithFlow AI is a global product serving churches that handle pastoral care, finances, and community relationships. Every hire must carry two qualities above technical skill: **genuine care for the church community** and **operational reliability**. A support agent who loves churches will outperform one who merely knows the software.

---

## Stage 1 — Beta to First 50 Paying Churches

These are the positions that cannot wait.

---

### 1. Head of Customer Success

**Why this hire is first:** Retention is the business. A church that onboards poorly churns within 60 days. This person ensures every beta church gets to value fast and every paying church stays.

**What they do:**
- Own the onboarding journey for every new church — from first login to fully operational
- Run weekly check-ins with beta churches and document feedback
- Build and maintain onboarding playbooks, video walkthroughs, and getting-started guides
- Track churn signals (login frequency, feature adoption, support ticket volume) and intervene early
- Work directly with the sales lead to hand off new churches smoothly
- Collaborate with engineering to flag recurring friction points

**What they need:**
- 3+ years in a customer success or account management role, ideally in SaaS
- Genuine understanding of how churches operate — ministry background is a strong plus
- Strong written and verbal communication — they will spend significant time on WhatsApp, email, and video calls with pastors and church administrators
- Comfort with basic analytics (who logged in, what features are used, where drop-off happens)
- Fluency in English; Twi, Pidgin, or French is a significant advantage for the African market

**Compensation guide:** $40,000–65,000/yr (adjust for market; consider equity at early stage)

---

### 2. Full-Stack Software Engineer

**Why this hire is second:** The founding engineer (you) is the bottleneck for every feature, bug, and infrastructure change. One solid hire multiplies output and reduces single-point-of-failure risk on the codebase.

**What they do:**
- Build and maintain features across the admin console, member portal, and API
- Own specific modules end-to-end (e.g. events, comms, or finance) after a ramp period
- Write clean, tenant-isolated, tested code following the existing patterns (tRPC, Prisma, Next.js)
- Review PRs, participate in architecture decisions, and contribute to docs
- Respond to production incidents — on-call rotation (light at early stage)
- Maintain Prisma migrations with zero-downtime discipline

**What they need:**
- Strong TypeScript — the entire stack is TypeScript (Next.js, tRPC, Prisma, Fastify)
- Comfortable with PostgreSQL — schema design, query optimisation, migration safety
- Familiarity with SaaS patterns: multi-tenancy, RBAC, webhook idempotency, background jobs
- React and Next.js App Router experience
- Production mindset — they should think about what breaks before shipping, not after
- Bonus: experience with Stripe or Paystack integrations, Clerk, or Resend

**Compensation guide:** $70,000–110,000/yr depending on seniority and market

---

### 3. Church Partnerships & Sales Lead

**Why this hire is third:** Growth at this stage is relationship-driven, not ad-driven. Churches adopt software through trusted referrals — from other pastors, from denominational bodies, from consultants they already trust. This person works those networks.

**What they do:**
- Identify and qualify prospective churches — across Ghana, Nigeria, UK diaspora, US diaspora
- Run product demos tailored to church context (not a generic SaaS demo)
- Build relationships with denominational leadership and church network coordinators
- Negotiate and close Growth and Enterprise contracts
- Manage the pipeline and report on conversion rates, deal stages, and ARR growth
- Collaborate with Customer Success on smooth handoffs post-close
- Attend church conferences, ministry events, and pastor summits as a brand ambassador

**What they need:**
- 3+ years in a sales or business development role — SaaS sales experience is ideal but not essential
- Deep personal connection to the church community — they should be known and trusted in ministry circles, not just selling into them
- Ability to speak to both pastoral vision and operational pain in the same conversation
- Strong follow-through — church decision cycles can be slow; this person tracks every touchpoint
- Existing network in Ghanaian, Nigerian, or diaspora church communities is a significant advantage
- Willingness to travel to church campuses and events

**Compensation guide:** $45,000–70,000 base + commission on ARR closed (5–8% first-year)

---

## Stage 2 — 50 to 200 Paying Churches

Add these roles once the foundation is solid and revenue supports it.

---

### 4. Platform Support Specialist

**What they do:**
- Handle inbound support tickets from church administrators and members
- Maintain and expand the knowledge base (articles, video guides, FAQ updates)
- Triage issues — distinguish configuration problems (handle directly) from bugs (escalate to engineering)
- Build and run proactive comms: "here's what's new this month" updates to church admins
- Serve as the day-to-day voice of FaithFlow to church staff

**What they need:**
- Patient, clear communicator — church admins range from tech-savvy to first-time SaaS users
- Ability to learn a complex product deeply and explain it simply
- Experience with helpdesk tools (Intercom, Zendesk, or similar)
- Church or non-profit background strongly preferred
- Familiarity with WhatsApp for Business (primary support channel in West Africa)

**Compensation guide:** $28,000–42,000/yr

---

### 5. DevOps / Platform Reliability Engineer

**What they do:**
- Own infrastructure: Render services, Vercel deployments, Postgres, cron jobs
- Build and maintain monitoring, alerting, and on-call runbooks
- Manage deployment pipelines across dev → staging → production
- Implement infrastructure-as-code for reproducibility
- Tune database performance as tenant count and data volume scale
- Own the SSL, domain automation, and security policy infrastructure already in the codebase
- Respond to production incidents and conduct post-mortems

**What they need:**
- Solid experience with Render, Railway, or similar PaaS platforms — or AWS/GCP if we migrate there
- PostgreSQL operations: connection pooling (PgBouncer/Neon), read replicas, backup verification
- GitHub Actions CI/CD pipelines
- Familiarity with Node.js runtime characteristics (memory, event loop, connection limits)
- Security mindset — tenant isolation, secret rotation, audit log integrity

**Compensation guide:** $75,000–115,000/yr

---

### 6. Product Designer (UI/UX)

**What they do:**
- Own the design system and visual language across admin console, member portal, and marketing site
- Design new features from first principles — user flows, wireframes, high-fidelity Figma
- Run usability sessions with church admins and members to surface friction
- Maintain brand consistency across all surfaces
- Collaborate with engineering on component specifications and handoff

**What they need:**
- Strong Figma skills — component libraries, auto-layout, prototyping
- Experience designing complex data-heavy UIs (dashboards, tables, forms) — not just marketing pages
- Ability to design for non-technical users (church administrators are not SaaS power users)
- Understanding of accessibility and mobile-first design
- Bonus: experience designing for African or emerging market audiences

**Compensation guide:** $55,000–85,000/yr

---

## Interview Principles

**For every role:**
1. Ask how they use technology in their own church or faith community — it reveals genuine affinity vs. performative fit
2. Give a realistic scenario from a real church context (e.g. "a pastor calls saying their Paystack giving link isn't working and they have a service in 2 hours — walk me through what you do")
3. Check writing quality — every team member at this stage will communicate directly with church leaders; clear writing matters

**For technical roles:**
- Pair programming session on a real codebase issue, not a whiteboard algorithm
- Review a PR diff and ask what questions they would raise

**For sales/CS roles:**
- Role-play a demo or a difficult customer call
- Ask them to map out what a church's first 30 days should look like

---

## Equity & Compensation Philosophy

At beta stage, FaithFlow AI can offer:
- Competitive base salary for the market (adjust for Ghana, UK, or US based on location)
- Early-stage equity (0.25–1.5% depending on role seniority and timing)
- Meaningful mission — building the operating system for the global church

The equity conversation should be honest: this is early-stage, the value is speculative, and it rewards those who commit to the long-term journey. Don't oversell it; the right people will value the mission as much as the upside.

---

## Roles Summary

| Priority | Role | Stage | Comp Range |
|---|---|---|---|
| 1 | Head of Customer Success | Beta now | $40k–65k |
| 2 | Full-Stack Engineer | Beta now | $70k–110k |
| 3 | Church Partnerships & Sales Lead | Beta now | $45k–70k + commission |
| 4 | Platform Support Specialist | 50+ churches | $28k–42k |
| 5 | DevOps / Platform Reliability Engineer | 50+ churches | $75k–115k |
| 6 | Product Designer | 50+ churches | $55k–85k |

---

*FaithFlow AI — Hiring Plan · March 2026 · Internal document*
