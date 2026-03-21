'use client';

import Link from 'next/link';
import { Badge, Button, Card } from '@faithflow-ai/ui';
import { SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/nextjs';

const modules = [
  {
    tag: 'Finance',
    title: 'Finance that stays clean',
    body: 'Multi-currency giving, pledges, recurring donations, budgets, expenses, reconciliation, and full audit trails. Stripe and Paystack native.',
  },
  {
    tag: 'Membership',
    title: 'Membership that stays connected',
    body: 'Household management, small groups, directory with privacy controls, access requests, and a self-service member portal.',
  },
  {
    tag: 'Events',
    title: 'Events that run themselves',
    body: 'Registration, ticketing, QR check-in, badge printing, multi-event series, and automated follow-up comms in one workflow.',
  },
  {
    tag: 'Communications',
    title: 'Communications that land',
    body: 'Email, SMS, and WhatsApp from one console. Template builder, AI draft assistant, drip campaigns, scheduling, and delivery logs.',
  },
  {
    tag: 'Volunteer',
    title: 'Volunteers always covered',
    body: 'Role definitions, shift scheduling, availability collection, and self-service sign-up so leaders spend less time chasing people.',
  },
  {
    tag: 'Support Center',
    title: 'Support that closes fast',
    body: 'Ticket threads, SLA tracking, SLA breach alerts, knowledge base with deflection search, and platform-level queue for multi-tenant ops.',
  },
  {
    tag: 'Pastoral Care',
    title: 'Pastoral care that follows through',
    body: 'Care request tracking, follow-up workflows, and pastor-level visibility into congregation needs without losing privacy.',
  },
  {
    tag: 'AI Insights',
    title: 'AI that earns its place',
    body: 'Donor risk scoring, attendance prediction, AI comms drafting, and giving trend analysis — all reviewable, traceable, and admin-controlled.',
  },
];

const pillars = [
  {
    label: 'Admin console',
    desc: 'Full-featured admin with tabs, data tables, and actionable sheets — no modal overload.',
  },
  {
    label: 'Member portal',
    desc: 'Self-service profiles, events, messages, volunteer sign-up, and notifications.',
  },
  {
    label: 'Multi-campus',
    desc: 'Organization → church → campus hierarchy scales from one location to diaspora networks.',
  },
  {
    label: 'Stripe + Paystack',
    desc: 'USD giving via Stripe and local-currency giving via Paystack — both fully integrated.',
  },
  {
    label: 'Tenant isolation',
    desc: 'Every church\'s data is strictly isolated. Row-level policies enforced at the database.',
  },
  {
    label: 'AI with oversight',
    desc: 'AI suggestions surface in context with one-click review — never auto-applied.',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15),_transparent_45%),radial-gradient(circle_at_right,_rgba(14,116,144,0.18),_transparent_40%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.12),_transparent_50%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <div className="max-w-3xl">
            <Badge variant="default">Built for the modern church</Badge>
            <h1 className="mt-5 text-5xl font-semibold leading-tight text-foreground sm:text-6xl">
              Run your entire church from one platform.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted">
              FaithFlow AI covers finance, membership, events, communications, pastoral care, volunteer management,
              and AI-assisted insights — with a member portal your congregation will actually use.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/get-started">
                <Button size="lg">Start free trial</Button>
              </Link>
              <Link href="/features">
                <Button size="lg" variant="outline">See all features</Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted">14-day free trial · No credit card required · Cancel anytime</p>
          </div>
        </div>
      </div>

      {/* ── Platform pillars strip ─────────────────────────────────────── */}
      <section className="border-y border-border bg-white/70">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.map((pillar) => (
              <div key={pillar.label} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-secondary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{pillar.label}</p>
                  <p className="mt-0.5 text-xs text-muted">{pillar.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Module grid ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 max-w-2xl">
          <Badge variant="default">Platform modules</Badge>
          <h2 className="mt-4 text-3xl font-semibold text-foreground">
            Everything a church needs to operate well.
          </h2>
          <p className="mt-3 text-sm text-muted">
            Eight fully built modules — not a roadmap promise. Every module is live, tested, and connected to the others.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((mod) => (
            <Card key={mod.tag} className="border-border bg-white p-5">
              <Badge variant="default">{mod.tag}</Badge>
              <h3 className="mt-3 text-base font-semibold text-foreground">{mod.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">{mod.body}</p>
            </Card>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/features">
            <Button variant="outline">View detailed feature list →</Button>
          </Link>
        </div>
      </section>

      {/* ── Two portals section ─────────────────────────────────────────── */}
      <section className="border-y border-border bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-10 max-w-2xl">
            <Badge variant="default">Two sides of one platform</Badge>
            <h2 className="mt-4 text-3xl font-semibold text-foreground">
              Built for admins and members equally.
            </h2>
            <p className="mt-3 text-sm text-muted">
              Staff get a powerful operations console. Members get a clean self-service portal. Both share the same live data.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border bg-white p-6">
              <p className="text-xs uppercase tracking-widest text-muted">Church admin console</p>
              <h3 className="mt-3 text-xl font-semibold text-foreground">Operate with full context.</h3>
              <div className="mt-4 space-y-2 text-sm text-muted">
                {[
                  'DataTables with search, sort, and pagination across all modules',
                  'Side panels for member profiles, event details, ticket threads',
                  'Tab-based navigation — no losing your place mid-workflow',
                  'Role-based access for staff with read-only and write gates',
                  'Platform admin view for multi-tenant management',
                ].map((line) => (
                  <div key={line} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                    <span>{line}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <Link href="/get-started">
                  <Button variant="outline" className="w-full">Access admin console</Button>
                </Link>
              </div>
            </Card>

            <Card className="border-border bg-primary p-6 text-primary-foreground">
              <p className="text-xs uppercase tracking-widest text-primary-foreground/70">Member portal</p>
              <h3 className="mt-3 text-xl font-semibold">Give members a home base.</h3>
              <div className="mt-4 space-y-2 text-sm text-primary-foreground/80">
                {[
                  'Personal profile + directory privacy controls',
                  'Browse and register for upcoming events',
                  'Direct messages with staff and members',
                  'Volunteer shift sign-up and availability',
                  'Notifications, surveys, and giving history',
                ].map((line) => (
                  <div key={line} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-foreground/60" />
                    <span>{line}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <Link href="/portal">
                  <Button variant="secondary" className="w-full">Open member portal</Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ── AI section ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <Badge variant="default">AI Intelligence</Badge>
            <h2 className="mt-4 text-3xl font-semibold text-foreground">
              Fewer dashboards. More answers.
            </h2>
            <p className="mt-3 text-sm text-muted">
              FaithFlow AI surfaces patterns in your data so you spend less time reading spreadsheets and more time leading. Every suggestion is traceable and requires human approval before action.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                { title: 'Donor risk scoring', desc: 'Flag members who may be disengaging before they lapse.' },
                { title: 'Attendance prediction', desc: 'Forecast attendance based on historical patterns and seasonality.' },
                { title: 'Comms drafting', desc: 'Generate email and SMS drafts with context from your schedule and segments.' },
                { title: 'Giving trend analysis', desc: 'Understand year-over-year giving movement and seasonal patterns.' },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-border bg-white p-4">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs text-muted">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <Card className="border-border bg-white p-6">
            <p className="text-xs uppercase tracking-widest text-muted">Resilience</p>
            <h3 className="mt-3 text-xl font-semibold text-foreground">Built like top-tier SaaS.</h3>
            <div className="mt-4 space-y-2 text-sm text-muted">
              {[
                'Postgres with row-level tenant isolation',
                'Stripe + Paystack payment integrations',
                'Clerk identity & org management',
                'Real-time updates via SSE',
                'GCS / S3 asset storage',
                'tRPC type-safe internal APIs',
                'OpenAPI for external access',
              ].map((item) => (
                <div key={item} className="rounded-lg border border-border bg-muted/10 px-3 py-2 text-xs">
                  {item}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* ── Who it's for ────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-10 max-w-2xl">
            <Badge variant="default">Who it's for</Badge>
            <h2 className="mt-4 text-3xl font-semibold text-foreground">
              One platform across every stage of church growth.
            </h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {[
              {
                stage: 'Small church',
                range: 'Up to 500 members · 1 campus',
                desc: 'Get off spreadsheets. Clean giving records, member directory, and event check-in from day one.',
                plan: 'Starter — from $49/mo',
              },
              {
                stage: 'Growing church',
                range: 'Up to 5,000 members · 5 campuses',
                desc: 'Run multi-campus operations, automate communications, and let AI surface the insights your team needs.',
                plan: 'Growth — from $149/mo',
              },
              {
                stage: 'Multi-campus & diaspora',
                range: 'Unlimited · Global ready',
                desc: 'Manage distributed campuses, local-currency payments, and platform-level operations across your entire network.',
                plan: 'Enterprise — custom pricing',
              },
            ].map((item) => (
              <Card key={item.stage} className="border-border bg-white p-6">
                <p className="text-sm font-semibold text-foreground">{item.stage}</p>
                <p className="mt-1 text-xs text-secondary">{item.range}</p>
                <p className="mt-3 text-sm text-muted">{item.desc}</p>
                <p className="mt-4 text-xs font-medium text-foreground">{item.plan}</p>
              </Card>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/plans">
              <Button variant="outline">See full pricing →</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA footer ──────────────────────────────────────────────────── */}
      <section className="bg-primary">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-16 text-center">
          <h4 className="text-3xl font-semibold text-primary-foreground">
            Ready to see FaithFlow AI in action?
          </h4>
          <p className="max-w-xl text-sm text-primary-foreground/80">
            Start your 14-day free trial. Set up your church, explore every module, and bring your team along — no credit card needed.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <SignedOut>
              <Link href="/get-started">
                <Button variant="secondary" size="lg">Start free trial</Button>
              </Link>
              <Link href="/contact">
                <Button variant="outline" size="lg" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                  Talk to us
                </Button>
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/get-started">
                <Button variant="secondary" size="lg">Continue onboarding</Button>
              </Link>
            </SignedIn>
          </div>
        </div>
      </section>
    </main>
  );
}
