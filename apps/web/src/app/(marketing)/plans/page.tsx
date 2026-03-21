import Link from 'next/link';
import { Badge, Button, Card } from '@faithflow-ai/ui';

type Row = {
  label: string;
  starter: string;
  growth: string;
  enterprise: string;
};

const tiers = [
  {
    name: 'Starter',
    price: '$49',
    annual: '$490',
    annualMonthly: '$41',
    cadence: '/mo',
    trial: '14-day free trial',
    highlight: false,
    summary: 'For small churches getting operational clarity fast.',
    features: [
      'Up to 1,000 members',
      '1 campus',
      'Finance, membership, events + pastoral care',
      'Email / SMS / WhatsApp messaging',
      'No platform giving fee',
    ],
  },
  {
    name: 'Growth',
    price: '$149',
    annual: '$1,490',
    annualMonthly: '$124',
    cadence: '/mo',
    trial: '14-day free trial',
    highlight: true,
    summary: 'For growing churches running multiple campuses and global giving.',
    features: [
      'Up to 5,000 members · 5 campuses',
      'Live streaming — YouTube, Facebook, Vimeo',
      'AI insights: giving trends, donor risk, attendance',
      'Stripe (USD) + Paystack (local currency) giving',
      'No platform giving fee',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    annual: null,
    annualMonthly: null,
    cadence: '',
    trial: 'Sales-assisted onboarding',
    highlight: false,
    summary: 'For multi-campus networks, denominations, and diaspora ministries.',
    features: [
      'Unlimited members and campuses',
      'Dedicated support + custom SLA',
      'White-label and denomination licensing',
      'Custom rollout and data migration plan',
      'No platform giving fee',
    ],
  },
];

const comparisonRows: Row[] = [
  { label: 'Free trial', starter: '14 days', growth: '14 days', enterprise: 'Custom' },
  { label: 'Members', starter: '1,000', growth: '5,000', enterprise: 'Unlimited' },
  { label: 'Campuses', starter: '1', growth: '5', enterprise: 'Unlimited' },
  { label: 'Membership', starter: 'Included', growth: 'Included', enterprise: 'Included' },
  { label: 'Events', starter: 'Included', growth: 'Included', enterprise: 'Included' },
  { label: 'Finance + giving', starter: 'Included', growth: 'Included', enterprise: 'Included' },
  { label: 'Pastoral care', starter: 'Included', growth: 'Included', enterprise: 'Included' },
  { label: 'Communications (email / SMS / WhatsApp)', starter: 'Included', growth: 'Included', enterprise: 'Included' },
  { label: 'Volunteer management', starter: 'Included', growth: 'Included', enterprise: 'Included' },
  { label: 'Support centre + knowledge base', starter: 'Included', growth: 'Included', enterprise: 'Included' },
  { label: 'Multi-campus operations', starter: '1 campus', growth: 'Up to 5', enterprise: 'Unlimited' },
  { label: 'AI insights', starter: 'Limited', growth: 'Included', enterprise: 'Included' },
  { label: 'Facilities management', starter: 'Not included', growth: 'Included', enterprise: 'Included' },
  { label: 'Live streaming (YouTube / Facebook / Vimeo)', starter: 'Not included', growth: 'Included', enterprise: 'Included' },
  { label: 'Paystack local currency giving', starter: 'Included', growth: 'Included', enterprise: 'Included' },
  { label: 'Platform giving fee', starter: 'None', growth: 'None', enterprise: 'None' },
  { label: 'Custom domain', starter: 'Not included', growth: 'Included', enterprise: 'Included' },
  { label: 'Monthly events', starter: '30', growth: '200', enterprise: 'Unlimited' },
  { label: 'Monthly expenses', starter: '80', growth: '500', enterprise: 'Unlimited' },
  { label: 'Priority support + SLA', starter: 'Standard', growth: 'Standard', enterprise: 'Dedicated' },
];

const differentiators = [
  {
    heading: 'No giving fee. Ever.',
    body: 'We never take a cut of your donations. Standard Stripe and Paystack processing rates apply — that\'s it. Competitors like Pushpay layer their own fee on top. We don\'t.',
  },
  {
    heading: 'Global giving, natively built.',
    body: 'Stripe for USD giving. Paystack for NGN, GHS, KES, ZAR, XOF, and more. Run both side by side from one dashboard. No third-party integration required.',
  },
  {
    heading: 'Every module. One price.',
    body: 'Planning Center charges separately for People, Services, Giving, Check-Ins, and Groups. A typical church pays $150–250/mo for the basics. FaithFlow includes everything.',
  },
  {
    heading: 'AI built in, not bolted on.',
    body: 'Donor risk scoring, giving forecasts, attendance prediction, and comms drafting — included in Growth. No AI add-on. No API key to configure.',
  },
];

function CheckCell({ value }: { value: string }) {
  const included = value === 'Included' || value === 'None';
  const excluded = value === 'Not included';
  return (
    <td className={`px-4 py-3 text-center text-sm ${included ? 'font-medium text-foreground' : excluded ? 'text-muted' : 'text-foreground'}`}>
      {value}
    </td>
  );
}

export default function PlansPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      {/* ── Header ── */}
      <Badge variant="default">Pricing</Badge>
      <h1 className="mt-4 text-4xl font-semibold leading-tight">
        One platform. One price. Built for the global church.
      </h1>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        Start with a 14-day free trial. Run USD giving on Stripe and local currency giving on Paystack — no platform
        fee on either. Scale from one campus to a diaspora network without switching systems.
      </p>

      {/* ── Annual savings callout ── */}
      <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-secondary/10 px-4 py-2 text-sm text-secondary">
        <span className="font-semibold">Save 2 months</span>
        <span className="text-muted">·</span>
        <span>Pay annually and get Starter from $41/mo · Growth from $124/mo</span>
      </div>

      {/* ── Tier cards ── */}
      <section className="mt-8 grid gap-5 md:grid-cols-3">
        {tiers.map((tier) => (
          <Card
            key={tier.name}
            className={`relative border p-6 ${tier.highlight ? 'border-secondary shadow-md' : 'border-border bg-white'}`}
          >
            {tier.highlight ? (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="success">Most popular</Badge>
              </div>
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">{tier.name}</p>
            <div className="mt-2 flex items-end gap-1">
              <p className="text-3xl font-semibold text-foreground">{tier.price}</p>
              {tier.cadence ? <p className="pb-1 text-sm text-muted">{tier.cadence}</p> : null}
            </div>
            {tier.annual ? (
              <p className="mt-1 text-xs text-muted">
                or {tier.annual}/yr &mdash; <span className="font-medium text-secondary">{tier.annualMonthly}/mo billed annually</span>
              </p>
            ) : null}
            <p className="mt-2 text-xs font-medium text-secondary">{tier.trial}</p>
            <p className="mt-3 text-sm text-muted">{tier.summary}</p>
            <ul className="mt-4 space-y-2">
              {tier.features.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Link href="/get-started">
                <Button
                  className="w-full"
                  variant={tier.highlight ? 'default' : 'outline'}
                >
                  {tier.name === 'Enterprise' ? 'Talk to us' : 'Start free trial'}
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </section>

      {/* ── Why FaithFlow leads ── */}
      <section className="mt-20">
        <div className="mb-8 max-w-xl">
          <Badge variant="default">Why FaithFlow</Badge>
          <h2 className="mt-4 text-3xl font-semibold">
            The only ChMS built for the global church.
          </h2>
          <p className="mt-3 text-sm text-muted">
            Most church management software was built for a single market, with giving integrations added as an afterthought. FaithFlow was designed from the ground up to serve churches across currencies, campuses, and continents.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {differentiators.map((d) => (
            <Card key={d.heading} className="border-border bg-white p-5">
              <p className="text-sm font-semibold text-foreground">{d.heading}</p>
              <p className="mt-2 text-sm text-muted">{d.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Comparison table ── */}
      <section className="mt-20">
        <div className="mb-6">
          <Badge variant="default">Full comparison</Badge>
          <h2 className="mt-4 text-2xl font-semibold">What&apos;s included on each plan</h2>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-white">
                <th className="px-4 py-3 text-sm font-semibold text-foreground">Feature</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Starter</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-secondary">Growth</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                  <td className="px-4 py-3 text-sm text-foreground">{row.label}</td>
                  <CheckCell value={row.starter} />
                  <CheckCell value={row.growth} />
                  <CheckCell value={row.enterprise} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          * No platform giving fee on any plan. Stripe processing: 2.9% + $0.30 per transaction. Paystack processing: 1.5% + local fee. Standard rates — we add nothing on top.
        </p>
      </section>

      {/* ── FAQ ── */}
      <section className="mt-20">
        <Badge variant="default">Common questions</Badge>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            {
              q: 'Does FaithFlow take a cut of donations?',
              a: 'No. We never charge a platform giving fee. You pay standard Stripe or Paystack processing rates and keep everything else.',
            },
            {
              q: 'Can I run giving in Ghanaian Cedis or Nigerian Naira?',
              a: 'Yes. Paystack is natively integrated and supports NGN, GHS, KES, ZAR, XOF, and more. Stripe handles USD and other international currencies. Both run from the same giving dashboard.',
            },
            {
              q: 'What happens after the 14-day trial?',
              a: 'You choose a plan and subscribe. If you don\'t subscribe, your account moves to read-only mode — your data is safe and you can still export it.',
            },
            {
              q: 'Can I switch plans?',
              a: 'Yes, any time. Upgrades take effect immediately. Downgrades take effect at the next billing cycle.',
            },
            {
              q: 'Is there a contract or lock-in?',
              a: 'Monthly plans have no lock-in — cancel any time. Annual plans are billed upfront for the year.',
            },
            {
              q: 'We have multiple campuses across different countries. Does that work?',
              a: 'Yes. Growth supports up to 5 campuses, each with their own timezone, currency, and giving setup. Enterprise supports unlimited campuses — ideal for denominations and diaspora networks.',
            },
          ].map((item) => (
            <Card key={item.q} className="border-border bg-white p-5">
              <p className="text-sm font-semibold text-foreground">{item.q}</p>
              <p className="mt-2 text-sm text-muted">{item.a}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="mt-20 rounded-2xl bg-primary p-12 text-center">
        <h2 className="text-3xl font-semibold text-primary-foreground">
          Start your free trial today.
        </h2>
        <p className="mt-3 max-w-lg mx-auto text-sm text-primary-foreground/80">
          14 days. Every feature. No credit card required. Cancel any time.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/get-started">
            <Button variant="secondary" size="lg">Start free trial</Button>
          </Link>
          <Link href="/features">
            <Button variant="outline" size="lg" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
              Explore features
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
