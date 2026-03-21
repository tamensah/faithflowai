import Link from 'next/link';
import { Badge, Button, Card } from '@faithflow-ai/ui';

const featureGroups = [
  {
    tag: 'Finance',
    heading: 'Church finance without the guesswork',
    summary: 'Multi-currency giving, budgets, expenses, reconciliation, and a full audit trail — all in one place.',
    items: [
      'Stripe (USD) and Paystack (local currency) giving — both native',
      'One-time and recurring donations with receipt generation',
      'Pledge campaigns and pledge tracking',
      'Budget creation, line-item allocation, and approval workflows',
      'Expense recording against budget lines',
      'Full audit trail — every financial action logged to a user and timestamp',
      'Reconciliation console with dispute tracking and payout summaries',
      'Multi-currency totals with currency-grouped reporting',
    ],
  },
  {
    tag: 'Membership',
    heading: 'Every member, always in context',
    summary: 'Household management, groups, directory, and a self-service portal members actually want to use.',
    items: [
      'Member profiles with contact, address, and engagement data',
      'Household grouping with relationship mapping',
      'Small groups and ministry teams with leader assignment',
      'Directory with privacy controls — each member sets their own visibility',
      'Self-service member portal: profile, events, messages, volunteer sign-up',
      'Staff access requests and role-based admin permissions',
      'Member access request flow for self-onboarding',
      'Engagement scoring based on attendance, giving, and group participation',
    ],
  },
  {
    tag: 'Events',
    heading: 'Events that run end-to-end',
    summary: 'From creation to check-in to follow-up — the full event lifecycle in one workflow.',
    items: [
      'Event creation with location, capacity, and registration settings',
      'Custom registration forms with field builder (text, select, checkbox, date)',
      'Ticket types with pricing, capacity limits, and Stripe/Paystack checkout',
      'QR code generation for event check-in kiosk',
      'Mobile and desktop check-in interfaces',
      'Event series (recurring events with shared config)',
      'Badge printing per attendee',
      'Roster management with attendance tracking',
      'Post-event automated comms to registrants',
    ],
  },
  {
    tag: 'Communications',
    heading: 'Multi-channel comms from one console',
    summary: 'Email, SMS, and WhatsApp with templates, automation, and delivery tracking.',
    items: [
      'Channel support: Email (Resend), SMS (Twilio), WhatsApp',
      'Template builder with reusable message templates',
      'AI draft assistant — generate messages from context',
      'Audience segmentation (all members, groups, attendees, donors)',
      'One-off sends, scheduled messages, and batch dispatch',
      'Drip campaign builder with multi-step sequences',
      'Calendar view of scheduled messages',
      'Delivery log with status tracking per message',
      'Quiet hours configuration per church',
      'Analytics: open rates, bounce rates, channel performance',
    ],
  },
  {
    tag: 'Volunteer',
    heading: 'Volunteer management that fills itself',
    summary: 'Roles, shifts, availability, and self-service sign-up so leaders stop chasing people.',
    items: [
      'Volunteer roles with descriptions and requirements',
      'Shift scheduling with capacity per shift',
      'Member self-service: browse and join shifts from the portal',
      'Availability collection — members set recurring availability',
      'Assignment tracking with confirmation and cancellation',
      'Leader visibility into shift coverage across all roles',
    ],
  },
  {
    tag: 'Support Center',
    heading: 'Support that closes fast, tracked to SLA',
    summary: 'Ticket threads, SLA enforcement, and a knowledge base with deflection search.',
    items: [
      'Member-facing ticket submission with subject and priority',
      'Threaded ticket conversations between member and staff',
      'Platform-level queue for multi-tenant support operations',
      'SLA target configuration with first-response and resolution tracking',
      'SLA breach detection and automated sweep',
      'Staff assignment and status management per ticket',
      'Knowledge base with article creation, categories, and publish control',
      'Deflection search — KB articles surfaced as members type their issue',
    ],
  },
  {
    tag: 'Pastoral Care',
    heading: 'Pastoral care that follows through',
    summary: 'Care request tracking and follow-up workflows so no one falls through the cracks.',
    items: [
      'Care request logging with category and priority',
      'Pastor assignment and follow-up tracking',
      'Status progression from open through resolution',
      'Private notes visible only to assigned pastoral staff',
      'Congregation-level care overview for leadership',
    ],
  },
  {
    tag: 'Facilities',
    heading: 'Resources managed, not guessed',
    summary: 'Facility and resource tracking so physical assets are used efficiently.',
    items: [
      'Facility and room definitions with capacity',
      'Resource booking and availability tracking',
      'Conflict detection for overlapping reservations',
      'Event-linked room assignments',
    ],
  },
  {
    tag: 'Streaming & Content',
    heading: 'Live and on-demand in one system',
    summary: 'Stream management and a content library for sermons, media, and resources.',
    items: [
      'Live stream session management',
      'Content library for sermons, media, and downloadable resources',
      'Category tagging and search',
      'Member access to content via portal',
    ],
  },
  {
    tag: 'AI Insights',
    heading: 'AI that earns its place',
    summary: 'Insights and automation that surface in context — always reviewed, never auto-applied.',
    items: [
      'Donor risk scoring — flag members showing giving drop-off patterns',
      'Attendance prediction based on historical and seasonal patterns',
      'Giving trend analysis with year-over-year comparison',
      'AI comms drafting from event and segment context',
      'Insight review workflow — all suggestions require human approval',
    ],
  },
];

const portalFeatures = [
  'Personal profile with editable contact and address information',
  'Directory with privacy-controlled member listings',
  'Event browsing, RSVP, registration, and ticket checkout',
  'Direct messages with staff and other members',
  'Volunteer shift browsing and self-service sign-up',
  'Notification inbox and notification preference management',
  'Active survey completion',
  'Mobile-optimised bottom tab bar navigation',
];

export default function FeaturesPage() {
  return (
    <main className="min-h-screen">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,116,144,0.12),_transparent_50%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <Badge variant="default">Platform features</Badge>
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-tight text-foreground">
            Ten modules. One platform. No integrations to maintain.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Every capability below is live and connected. Add a member once — they appear across events, communications,
            volunteer scheduling, and the AI dashboard automatically.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/get-started">
              <Button size="lg">Start free trial</Button>
            </Link>
            <Link href="/plans">
              <Button size="lg" variant="outline">See pricing</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Feature groups ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="space-y-16">
          {featureGroups.map((group, i) => (
            <div
              key={group.tag}
              className={`grid gap-8 lg:grid-cols-[1fr_1.4fr] ${i % 2 === 1 ? 'lg:[direction:rtl]' : ''}`}
            >
              <div className={i % 2 === 1 ? 'lg:[direction:ltr]' : ''}>
                <Badge variant="default">{group.tag}</Badge>
                <h2 className="mt-4 text-2xl font-semibold text-foreground">{group.heading}</h2>
                <p className="mt-3 text-sm text-muted">{group.summary}</p>
                <div className="mt-5">
                  <Link href="/get-started">
                    <Button variant="outline" size="sm">Try {group.tag} →</Button>
                  </Link>
                </div>
              </div>
              <Card className={`border-border bg-white p-6 ${i % 2 === 1 ? 'lg:[direction:ltr]' : ''}`}>
                <ul className="space-y-2">
                  {group.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      </section>

      {/* ── Member portal ────────────────────────────────────────────── */}
      <section className="border-t border-border bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <Badge variant="default">Member portal</Badge>
              <h2 className="mt-4 text-3xl font-semibold text-foreground">
                A portal your congregation will actually use.
              </h2>
              <p className="mt-3 text-sm text-muted">
                Members get their own login, their own profile, and access to every church touchpoint — events, messages, giving, volunteering — from a single mobile-friendly interface.
              </p>
              <div className="mt-6">
                <Link href="/portal">
                  <Button variant="outline">Open member portal</Button>
                </Link>
              </div>
            </div>
            <Card className="border-border bg-white p-6">
              <ul className="space-y-2">
                {portalFeatures.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Tech stack ───────────────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-10 max-w-xl">
            <Badge variant="default">Infrastructure</Badge>
            <h2 className="mt-4 text-3xl font-semibold text-foreground">Built on infrastructure you can trust.</h2>
            <p className="mt-3 text-sm text-muted">
              Church data is sensitive. Every layer of FaithFlow AI is chosen for security, reliability, and compliance.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: 'PostgreSQL', desc: 'Row-level tenant isolation. No shared tables between churches.' },
              { name: 'Clerk', desc: 'Identity, org management, and SSO with Clerk — a category leader in auth.' },
              { name: 'Stripe', desc: 'PCI-compliant card payments for USD giving and ticket checkout.' },
              { name: 'Paystack', desc: 'Local-currency giving and checkout for African churches.' },
              { name: 'tRPC', desc: 'Type-safe internal APIs — no schema drift between frontend and backend.' },
              { name: 'GCS / S3', desc: 'Asset storage for media, documents, and member uploads.' },
            ].map((item) => (
              <div key={item.name} className="rounded-xl border border-border bg-white p-4">
                <p className="text-sm font-semibold text-foreground">{item.name}</p>
                <p className="mt-1 text-xs text-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="bg-primary">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-16 text-center">
          <h4 className="text-3xl font-semibold text-primary-foreground">
            Every module. One free trial.
          </h4>
          <p className="max-w-lg text-sm text-primary-foreground/80">
            14 days to explore everything — finance, events, members, comms, AI, and more. No credit card required.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/get-started">
              <Button variant="secondary" size="lg">Start free trial</Button>
            </Link>
            <Link href="/plans">
              <Button variant="outline" size="lg" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                View pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
