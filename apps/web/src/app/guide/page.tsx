'use client';

import Link from 'next/link';
import { Badge, Button, Card } from '@faithflow-ai/ui';

const ADMIN_URL =
  (process.env.NEXT_PUBLIC_ADMIN_URL ?? 'https://admin-gamma-beryl.vercel.app').replace(/\/+$/, '');
const WEB_URL =
  (process.env.NEXT_PUBLIC_WEB_URL ?? 'https://web-nu-eight-62.vercel.app').replace(/\/+$/, '');

const adminLink = (path: string) => `${ADMIN_URL}${path}`;
const webLink = (path: string) => `${WEB_URL}${path}`;

const onboardingSteps = [
  {
    n: 1,
    title: 'Create your account',
    detail:
      'Sign up at faithflow.ai. Use the email address you want as the primary admin for your church.',
    link: { label: 'Create account', href: webLink('/sign-up') },
  },
  {
    n: 2,
    title: 'Create your Clerk organization',
    detail:
      'After signing in, the onboarding wizard asks you to create (or select) an organization. This is your Clerk-level tenant — name it after your church or network.',
    link: { label: 'Start onboarding', href: webLink('/get-started') },
  },
  {
    n: 3,
    title: 'Claim admin access',
    detail:
      'The first user in a new organization is auto-bootstrapped as admin. Click "Claim admin access" in the wizard. Subsequent staff members must be invited from the Staff page.',
    link: null,
  },
  {
    n: 4,
    title: 'Choose a plan and check out',
    detail:
      'Select your plan (Starter, Growth, or Enterprise) and your payment provider (Stripe for USD, Paystack for local currency). You start a 14-day free trial — no card required.',
    link: { label: 'View plans', href: webLink('/plans') },
  },
  {
    n: 5,
    title: 'Open the admin console',
    detail:
      'After checkout you are redirected to the admin console. At this point your Clerk account is linked, but you still need to create your in-app organization and church.',
    link: { label: 'Open admin', href: adminLink('/') },
  },
  {
    n: 6,
    title: 'Create your in-app Organization',
    detail:
      'On the admin Overview page, use the "Organizations" panel to create your church organization. This is the database-level entity that groups your churches — name it the same as your Clerk org.',
    link: { label: 'Admin overview', href: adminLink('/') },
  },
  {
    n: 7,
    title: 'Create your first Church',
    detail:
      'In the "Churches" panel (below Organizations), add your church with a name, a URL slug (e.g. grace-chapel-main), and a two-letter country code (e.g. US, GH, NG). For multi-campus networks, add additional churches under the same organization.',
    link: null,
  },
  {
    n: 8,
    title: 'Invite your staff team',
    detail:
      'Go to Staff → send invite emails to co-admins and staff. Each person clicks their invite link, signs in (or creates an account), and is automatically linked to your church.',
    link: { label: 'Staff page', href: adminLink('/staff') },
  },
  {
    n: 9,
    title: 'Add your congregation',
    detail:
      'Import members via CSV or add them individually. Once added, they can sign in to the member portal and request access if not already linked.',
    link: { label: 'Members page', href: adminLink('/members') },
  },
  {
    n: 10,
    title: 'Run the go-live checklist',
    detail:
      'Operations → Go-live checks runs a readiness audit across all modules. Address any MISSING or WARN items before opening the portal to your congregation.',
    link: { label: 'Go-live checks', href: adminLink('/operations/health') },
  },
];

const adminModules = [
  {
    section: 'Workspace',
    items: [
      {
        label: 'Overview',
        path: '/',
        desc: 'Command center. Stats, setup wizard, go-live checklist, org/church creation.',
      },
      {
        label: 'Members',
        path: '/members',
        desc: 'Member directory, households, groups, access requests, CSV import.',
        featureKey: 'membership_enabled',
      },
      {
        label: 'Events',
        path: '/events',
        desc: 'Event creation, registration, ticketing, QR check-in, series management.',
        featureKey: 'events_enabled',
      },
      {
        label: 'Giving',
        path: '/giving',
        desc: 'Donation records, pledge campaigns, recurring giving overview.',
        featureKey: 'finance_enabled',
      },
      {
        label: 'Finance',
        path: '/finance',
        desc: 'Budgets, expenses, reconciliation, audit trail, multi-currency totals.',
        featureKey: 'finance_enabled',
      },
      {
        label: 'Comms',
        path: '/communications',
        desc: 'Email / SMS / WhatsApp campaigns, drip sequences, templates, delivery logs.',
        featureKey: 'communications_enabled',
      },
      {
        label: 'Billing',
        path: '/billing',
        desc: 'Subscription management, plan changes, portal session, trial status.',
      },
      {
        label: 'Staff',
        path: '/staff',
        desc: 'Staff accounts, role assignment (Admin / Staff), invite management.',
      },
      {
        label: 'Access requests',
        path: '/access-requests',
        desc: 'Review and approve member access requests from the portal.',
      },
    ],
  },
  {
    section: 'Ministry',
    items: [
      {
        label: 'Operations',
        path: '/operations',
        desc: 'Church settings, integration keys, quiet hours, transactional email triggers.',
      },
      {
        label: 'Go-live checks',
        path: '/operations/health',
        desc: 'Automated readiness audit. Run before launching to your congregation.',
      },
      {
        label: 'Support',
        path: '/support',
        desc: 'Ticket threads, SLA tracking, breach alerts, knowledge base.',
        featureKey: 'support_center_enabled',
      },
      {
        label: 'Pastoral care',
        path: '/care',
        desc: 'Care request tracking, pastor assignment, follow-up workflows.',
        featureKey: 'pastoral_care_enabled',
      },
      {
        label: 'Facilities',
        path: '/facilities',
        desc: 'Room/resource definitions, booking, conflict detection.',
        featureKey: 'facility_management_enabled',
      },
      {
        label: 'Streaming',
        path: '/streaming',
        desc: 'Live stream session management.',
        featureKey: 'streaming_enabled',
      },
      {
        label: 'Content',
        path: '/content',
        desc: 'Sermon library, media uploads, downloadable resources.',
        featureKey: 'content_library_enabled',
      },
      {
        label: 'Live',
        path: '/live',
        desc: 'Active live session controls and viewer stats.',
      },
    ],
  },
  {
    section: 'Intelligence',
    items: [
      {
        label: 'AI insights',
        path: '/ai',
        desc: 'Donor risk scoring, attendance prediction, giving trends, comms drafting.',
        featureKey: 'ai_insights',
      },
    ],
  },
  {
    section: 'Platform (super-admins only)',
    items: [
      {
        label: 'Platform users',
        path: '/platform',
        desc: 'Manage platform-level accounts across all tenants.',
      },
      {
        label: 'Subscriptions',
        path: '/platform/subscriptions',
        desc: 'View and manage all tenant subscriptions.',
      },
      {
        label: 'Tenants',
        path: '/platform/tenants',
        desc: 'Tenant directory, status, and metadata.',
      },
      {
        label: 'Platform ops',
        path: '/platform/ops',
        desc: 'System-wide operations, queue health, dunning.',
      },
    ],
  },
];

const roles = [
  {
    role: 'Platform admin',
    scope: 'All tenants',
    access:
      'Full read/write across every church. Sees the Platform section in the admin sidebar. Set via platform bootstrap — internal use only.',
  },
  {
    role: 'Church admin',
    scope: 'One church (or org)',
    access:
      'Full read/write on their church. First user in a new org is auto-bootstrapped as admin via the onboarding wizard or the "Claim admin access" button.',
  },
  {
    role: 'Staff',
    scope: 'One church',
    access:
      'Read/write on their assigned church. Cannot manage billing or invite other admins. Invited from the Staff page.',
  },
  {
    role: 'Member',
    scope: 'Member portal only',
    access:
      'Self-service access to profile, events, messages, volunteer sign-up, notifications, surveys. Cannot access the admin console.',
  },
];

const portalSections = [
  { label: 'Profile', path: '/portal/profile', desc: 'Edit contact info, photo, and directory privacy settings.' },
  { label: 'Directory', path: '/portal/directory', desc: 'Browse church members (subject to each member\'s privacy settings).' },
  { label: 'Events', path: '/portal/events', desc: 'Browse, RSVP, and register for upcoming events.' },
  { label: 'Messages', path: '/portal/messages', desc: 'Direct messages with staff and other members.' },
  { label: 'Volunteer', path: '/portal/volunteer', desc: 'Browse open shifts and sign up for service roles.' },
  { label: 'Notifications', path: '/portal/notifications', desc: 'Notification inbox and preference management.' },
  { label: 'Surveys', path: '/portal/surveys', desc: 'Complete active surveys from church leadership.' },
];

export default function GuidePage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.1),_transparent_50%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <Badge variant="default">Admin manual</Badge>
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-tight text-foreground">
            Getting started with FaithFlow AI.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Complete onboarding guide, admin module reference, user roles, and member portal access — everything in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={adminLink('/')}>
              <Button size="lg">Open admin console</Button>
            </a>
            <a href={webLink('/portal')}>
              <Button size="lg" variant="outline">Open member portal</Button>
            </a>
          </div>
        </div>
      </section>

      {/* Table of contents */}
      <section className="border-b border-border bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">On this page</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {['Onboarding flow', 'Admin modules', 'User roles', 'Member portal', 'Quick links'].map((s) => (
              <a
                key={s}
                href={`#${s.toLowerCase().replace(/\s+/g, '-')}`}
                className="rounded-full border border-border bg-white px-4 py-1.5 text-foreground hover:bg-muted/10"
              >
                {s}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Onboarding flow */}
      <section id="onboarding-flow" className="mx-auto max-w-6xl px-6 py-20">
        <Badge variant="default">Step by step</Badge>
        <h2 className="mt-4 text-3xl font-semibold text-foreground">Onboarding flow</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Follow these steps in order. Steps 1–4 happen on the marketing site. Steps 5–10 happen inside the admin console.
        </p>
        <div className="mt-10 space-y-4">
          {onboardingSteps.map((step) => (
            <div key={step.n} className="flex gap-5">
              <div className="flex flex-col items-center">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {step.n}
                </span>
                {step.n < onboardingSteps.length ? (
                  <div className="mt-1 w-px flex-1 bg-border" />
                ) : null}
              </div>
              <div className="pb-6 pt-1">
                <p className="text-base font-semibold text-foreground">{step.title}</p>
                <p className="mt-1 max-w-2xl text-sm text-muted">{step.detail}</p>
                {step.link ? (
                  <a
                    href={step.link.href}
                    className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    {step.link.label} →
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Admin modules */}
      <section id="admin-modules" className="border-t border-border bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Badge variant="default">Admin console</Badge>
          <h2 className="mt-4 text-3xl font-semibold text-foreground">Admin module reference</h2>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            Every section in the admin sidebar — what it does and when to use it.
          </p>
          <div className="mt-10 space-y-10">
            {adminModules.map((group) => (
              <div key={group.section}>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted">{group.section}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((item) => (
                    <a
                      key={item.path}
                      href={adminLink(item.path)}
                      className="group flex flex-col rounded-xl border border-border bg-white p-4 transition hover:border-primary/30 hover:shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground group-hover:text-primary">
                          {item.label}
                        </p>
                        {'featureKey' in item ? (
                          <span className="rounded-full bg-muted/10 px-2 py-0.5 text-[10px] font-medium text-muted">
                            Plan feature
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted">{item.desc}</p>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* User roles */}
      <section id="user-roles" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Badge variant="default">Access control</Badge>
          <h2 className="mt-4 text-3xl font-semibold text-foreground">User roles</h2>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            FaithFlow AI has four distinct access levels. Staff and admins use the admin console. Members use the portal.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {roles.map((r) => (
              <Card key={r.role} className="border-border bg-white p-5">
                <p className="text-sm font-semibold text-foreground">{r.role}</p>
                <p className="mt-0.5 text-xs font-medium text-secondary">{r.scope}</p>
                <p className="mt-3 text-sm text-muted">{r.access}</p>
              </Card>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-border bg-white p-5">
            <p className="text-sm font-semibold text-foreground">How to add staff</p>
            <ol className="mt-3 space-y-2 text-sm text-muted">
              <li>1. Go to <a href={adminLink('/staff')} className="font-medium text-primary hover:underline">Admin → Staff</a></li>
              <li>2. Enter the staff member's email and select their role (Admin or Staff)</li>
              <li>3. They receive an email invite. When they click it and sign in, they're automatically linked.</li>
              <li>4. For the first admin only: use "Claim admin access" during the <a href={webLink('/get-started')} className="font-medium text-primary hover:underline">onboarding wizard</a></li>
            </ol>
          </div>
        </div>
      </section>

      {/* Member portal */}
      <section id="member-portal" className="border-t border-border bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Badge variant="default">Member portal</Badge>
          <h2 className="mt-4 text-3xl font-semibold text-foreground">Member portal access</h2>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            Members access the portal at <a href={webLink('/portal')} className="font-medium text-primary hover:underline">{WEB_URL}/portal</a>.
            They sign in with their own account and are linked to their member record.
          </p>

          <div className="mt-8 rounded-xl border border-border bg-white p-5">
            <p className="text-sm font-semibold text-foreground">Member access flow</p>
            <ol className="mt-3 space-y-2 text-sm text-muted">
              <li>1. Member visits <a href={webLink('/portal')} className="font-medium text-primary hover:underline">{WEB_URL}/portal</a></li>
              <li>2. If not signed in: a sign-in form appears inline — they sign in or create an account</li>
              <li>3. If their email matches an existing member record: they're linked automatically and see the portal</li>
              <li>4. If no member record matches: they submit an access request (name, email, church, optional message)</li>
              <li>5. Admin reviews and approves the request from <a href={adminLink('/access-requests')} className="font-medium text-primary hover:underline">Admin → Access requests</a></li>
              <li>6. Once approved, the member can sign in and use the full portal</li>
            </ol>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {portalSections.map((s) => (
              <a
                key={s.path}
                href={webLink(s.path)}
                className="group flex flex-col rounded-xl border border-border bg-white p-4 transition hover:border-primary/30 hover:shadow-sm"
              >
                <p className="text-sm font-semibold text-foreground group-hover:text-primary">{s.label}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">{s.desc}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section id="quick-links" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Badge variant="default">Quick links</Badge>
          <h2 className="mt-4 text-3xl font-semibold text-foreground">Everything in one place</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Church onboarding', href: webLink('/get-started'), desc: 'New church setup wizard' },
              { label: 'Admin console', href: adminLink('/'), desc: 'Operations dashboard' },
              { label: 'Member portal', href: webLink('/portal'), desc: 'Congregation self-service' },
              { label: 'Member directory', href: adminLink('/members'), desc: 'All members + import' },
              { label: 'Events', href: adminLink('/events'), desc: 'Create and manage events' },
              { label: 'Giving', href: adminLink('/giving'), desc: 'Donations and pledges' },
              { label: 'Finance', href: adminLink('/finance'), desc: 'Budgets and reconciliation' },
              { label: 'Communications', href: adminLink('/communications'), desc: 'Email / SMS / WhatsApp' },
              { label: 'Staff management', href: adminLink('/staff'), desc: 'Invite and manage staff' },
              { label: 'Access requests', href: adminLink('/access-requests'), desc: 'Approve member requests' },
              { label: 'Support center', href: adminLink('/support'), desc: 'Tickets and knowledge base' },
              { label: 'Pastoral care', href: adminLink('/care'), desc: 'Care requests and follow-up' },
              { label: 'Billing', href: adminLink('/billing'), desc: 'Subscription and plan' },
              { label: 'Go-live checks', href: adminLink('/operations/health'), desc: 'Readiness audit' },
              { label: 'AI insights', href: adminLink('/ai'), desc: 'Giving trends, predictions' },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="group flex items-start gap-3 rounded-xl border border-border bg-white p-4 transition hover:border-primary/30 hover:shadow-sm"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">→</span>
                <div>
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary">{link.label}</p>
                  <p className="mt-0.5 text-xs text-muted">{link.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-16 text-center">
          <h4 className="text-3xl font-semibold text-primary-foreground">Ready to set up your church?</h4>
          <p className="max-w-lg text-sm text-primary-foreground/80">
            Follow the onboarding steps above to have your admin console live in under 30 minutes.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/get-started">
              <Button variant="secondary" size="lg">Start onboarding</Button>
            </Link>
            <a href={adminLink('/')}>
              <Button variant="outline" size="lg" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                Open admin console
              </Button>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
