'use client';

import Link from 'next/link';
import { Badge, Button, Card } from '@faithflow-ai/ui';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15),_transparent_45%),radial-gradient(circle_at_right,_rgba(14,116,144,0.18),_transparent_40%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.12),_transparent_50%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-10">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white">
                FF
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted">FaithFlow AI</p>
                <p className="text-sm font-semibold text-foreground">Trustworthy. Modern. Ready.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Link className="text-muted hover:text-foreground" href="/portal">
                Member portal
              </Link>
              <Link className="text-muted hover:text-foreground" href="/events">
                Events
              </Link>
              <SignedOut>
                <SignInButton mode="modal">
                  <Button variant="outline">Sign in</Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button>Get access</Button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </div>
          </header>

          <section className="mt-16 grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <Badge variant="default">AI-powered church management</Badge>
              <h1 className="mt-5 text-5xl font-semibold text-foreground">
                The operating system for churches that want clarity, speed, and trust.
              </h1>
              <p className="mt-6 text-lg text-muted">
                FaithFlow AI unifies finance, membership, events, and communications into a single, resilient platform
                built for single locations, multi‑campus networks, and diaspora communities.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button>Request a demo</Button>
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/10"
                  href="/portal"
                >
                  Member portal
                </Link>
              </div>
              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {[
                  { label: 'Multi‑campus ready', value: 'Org + church + campus' },
                  { label: 'Security first', value: 'Tenant‑isolated data' },
                  { label: 'AI leverage', value: 'Insights + automation' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-border bg-white/70 p-4">
                    <p className="text-xs uppercase tracking-widest text-muted">{item.label}</p>
                    <p className="mt-2 text-sm font-medium text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <Card className="relative overflow-hidden border-border bg-white/80 p-6 shadow-sm">
              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-secondary/15 blur-3xl" />
              <div className="relative space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted">Live platform preview</p>
                  <h2 className="mt-3 text-2xl font-semibold text-foreground">What’s already working</h2>
                </div>
                <div className="grid gap-3">
                  {[
                    'Giving, recurring donations, payouts, and receipts',
                    'Membership profiles, groups, and engagement analytics',
                    'Event registration, ticketing, and badges',
                    'Communications: email, SMS, WhatsApp scheduling',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm text-muted">
                      <span className="mt-1 h-2 w-2 rounded-full bg-secondary" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-border bg-muted/10 p-4 text-sm text-muted">
                  <p className="font-medium text-foreground">Next build focus</p>
                  <p className="mt-1">
                    Identity-driven onboarding, smart event operations, and AI-guided donor stewardship.
                  </p>
                </div>
              </div>
            </Card>
          </section>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-8 lg:grid-cols-3">
          {[
            {
              title: 'Finance that stays clean',
              body: 'Multi-currency giving, budgets, expenses, and reconciliation with full audit trails.',
              tag: 'Finance',
            },
            {
              title: 'Membership that stays connected',
              body: 'Households, groups, volunteer scheduling, and member self-service in one flow.',
              tag: 'Membership',
            },
            {
              title: 'Events that stay full',
              body: 'Registration, badges, ticketing, check-in, and follow-up comms in one workflow.',
              tag: 'Events',
            },
          ].map((card) => (
            <Card key={card.title} className="border-border bg-white p-6">
              <Badge variant="default">{card.tag}</Badge>
              <h3 className="mt-4 text-xl font-semibold text-foreground">{card.title}</h3>
              <p className="mt-2 text-sm text-muted">{card.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-border bg-white p-6">
            <p className="text-xs uppercase tracking-widest text-muted">Resilience</p>
            <h3 className="mt-3 text-2xl font-semibold text-foreground">Built like a top‑tier SaaS.</h3>
            <div className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-2">
              {[
                'Postgres backbone with tenant isolation',
                'Real-time updates via SSE',
                'Stripe + Paystack payments',
                'Clerk identity & org management',
                'OpenAPI + tRPC for internal APIs',
                'GCS / S3 asset storage',
              ].map((item) => (
                <div key={item} className="rounded-lg border border-border bg-muted/10 px-3 py-2">
                  {item}
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-border bg-primary text-primary-foreground p-6">
            <p className="text-xs uppercase tracking-widest text-primary-foreground/70">AI advantage</p>
            <h3 className="mt-3 text-2xl font-semibold">Fewer dashboards, more answers.</h3>
            <p className="mt-3 text-sm text-primary-foreground/80">
              AI highlights donor risk, predicts attendance, and drafts communications with clear human review.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="secondary">Explore AI roadmap</Button>
              <Link className="text-sm underline" href="/portal">
                Try the portal
              </Link>
            </div>
          </Card>
        </div>
      </section>

      <section className="border-t border-border bg-white/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-12">
          <div>
            <h4 className="text-xl font-semibold text-foreground">Ready to see FaithFlow AI in action?</h4>
            <p className="mt-2 text-sm text-muted">
              Test the member portal, preview events, and validate authentication with Clerk.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="outline">Sign in</Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button>Get access</Button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-white" href="/portal">
                Go to portal
              </Link>
            </SignedIn>
          </div>
        </div>
      </section>
    </main>
  );
}
