import Link from 'next/link';
import { Badge, Button, Card } from '@faithflow-ai/ui';

const values = [
  {
    title: 'Trustworthy by design',
    body: 'Tenant isolation, audit trails, and role-based access are defaults — not add-ons. Every action is traceable back to a user and a timestamp.',
  },
  {
    title: 'Built for every scale',
    body: 'The same data model works for a 50-person congregation and a 50,000-member diaspora network. Org → church → campus scales with you.',
  },
  {
    title: 'AI with accountability',
    body: 'AI surfaces suggestions, never takes autonomous action. Every insight is reviewable, every draft is editable, every recommendation is traceable.',
  },
  {
    title: 'Multi-currency, multi-region',
    body: 'Stripe for USD giving, Paystack for local African currencies. Both fully integrated — not bolted on — so global churches operate without friction.',
  },
];

const modules = [
  'Finance & giving',
  'Membership & households',
  'Groups & volunteers',
  'Events & check-in',
  'Communications (Email/SMS/WhatsApp)',
  'Support center & SLA',
  'Pastoral care workflows',
  'Facilities management',
  'Streaming & content library',
  'AI insights & automation',
  'Member self-service portal',
  'Platform admin for multi-tenant ops',
];

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.1),_transparent_50%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <Badge variant="default">About FaithFlow AI</Badge>
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-tight text-foreground">
            A complete operating system built for the modern church.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Most church software solves one problem well and forces you to stitch together the rest. FaithFlow AI is
            built from the ground up as one unified platform — so finance, membership, events, communications, and care
            all share the same data, the same members, and the same workflows.
          </p>
        </div>
      </section>

      {/* ── The problem ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">Why we built this</p>
            <h2 className="mt-4 text-3xl font-semibold text-foreground">
              Church admin shouldn't feel like a second job.
            </h2>
            <div className="mt-5 space-y-4 text-sm text-muted">
              <p>
                Church leaders are managing more than ever — giving records in one tool, membership in another, events in a third, and communications in a spreadsheet. Every transition between systems is a chance for data to get lost or a person to fall through the cracks.
              </p>
              <p>
                FaithFlow AI was built to end that fragmentation. We started with the hardest problems — multi-currency finance, tenant-isolated multi-campus membership, and real-time event operations — and built outward from there.
              </p>
              <p>
                The result is a platform where a member added to the directory shows up in events, communications, and volunteer scheduling automatically. Where a donation triggers a receipt, updates the dashboard, and feeds the AI giving analysis without anyone exporting a CSV.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-widest text-muted">What we've built</p>
            <p className="text-sm text-muted">Twelve fully integrated modules — live today, not on a roadmap:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {modules.map((mod) => (
                <div key={mod} className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                  {mod}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Values ─────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-10 max-w-xl">
            <Badge variant="default">Our principles</Badge>
            <h2 className="mt-4 text-3xl font-semibold text-foreground">
              What guides every design and engineering decision.
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {values.map((v) => (
              <Card key={v.title} className="border-border bg-white p-6">
                <h3 className="text-base font-semibold text-foreground">{v.title}</h3>
                <p className="mt-3 text-sm text-muted">{v.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-primary">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-16 text-center">
          <h4 className="text-3xl font-semibold text-primary-foreground">
            See it for yourself.
          </h4>
          <p className="max-w-lg text-sm text-primary-foreground/80">
            Start the free trial, explore every module, and bring your team. No credit card required.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/get-started">
              <Button variant="secondary" size="lg">Start free trial</Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" size="lg" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                Talk to us
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
