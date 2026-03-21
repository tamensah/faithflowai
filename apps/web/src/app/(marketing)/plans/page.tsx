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
    cadence: '/month',
    trial: '14-day free trial',
    summary: 'For small churches getting to operational clarity fast.',
    features: ['Up to 500 members', '1 campus', 'Finance + membership + events', 'Email/SMS/WhatsApp messaging'],
  },
  {
    name: 'Growth',
    price: '$149',
    cadence: '/month',
    trial: '14-day free trial',
    summary: 'For growing churches running multiple teams and workflows.',
    features: ['Up to 5,000 members', 'Up to 5 campuses', 'AI insights enabled', 'Advanced automation + reporting'],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: '',
    trial: 'Sales-assisted onboarding',
    summary: 'For multi-campus and diaspora networks with advanced controls.',
    features: ['Unlimited members/campuses', 'Enterprise operations controls', 'Priority support + SLA', 'Custom rollout plan'],
  },
];

const comparisonRows: Row[] = [
  { label: 'Free trial', starter: '14 days', growth: '14 days', enterprise: 'Custom' },
  { label: 'Membership', starter: 'Included', growth: 'Included', enterprise: 'Included' },
  { label: 'Events', starter: 'Included', growth: 'Included', enterprise: 'Included' },
  { label: 'Finance', starter: 'Included', growth: 'Included', enterprise: 'Included' },
  { label: 'Multi-campus', starter: 'Included', growth: 'Included', enterprise: 'Included' },
  { label: 'AI insights', starter: 'Limited', growth: 'Included', enterprise: 'Included' },
  { label: 'Facilities', starter: 'Not included', growth: 'Included', enterprise: 'Included' },
  { label: 'Pastoral care', starter: 'Not included', growth: 'Included', enterprise: 'Included' },
  { label: 'Streaming', starter: 'Not included', growth: 'Included', enterprise: 'Included' },
  { label: 'Support center', starter: 'Included', growth: 'Included', enterprise: 'Included' },
  { label: 'Custom domain', starter: 'Not included', growth: 'Included', enterprise: 'Included' },
  { label: 'Member limit', starter: '500', growth: '5,000', enterprise: 'Unlimited' },
  { label: 'Campus limit', starter: '1', growth: '5', enterprise: 'Unlimited' },
  { label: 'Monthly events', starter: '30', growth: '200', enterprise: 'Unlimited' },
  { label: 'Monthly expenses', starter: '80', growth: '500', enterprise: 'Unlimited' },
];

export default function PlansPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <Badge variant="default">Pricing</Badge>
      <h1 className="mt-4 text-4xl font-semibold">Choose a plan that fits your church stage.</h1>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        Start with a free trial. Run USD giving on Stripe and local currency giving on Paystack. Scale from one campus
        to diaspora networks without changing systems.
      </p>

      <section className="mt-8 grid gap-5 md:grid-cols-3">
        {tiers.map((tier) => (
          <Card key={tier.name} className="border-border bg-white p-6">
            <p className="text-xs uppercase tracking-widest text-muted">{tier.name}</p>
            <div className="mt-2 flex items-end gap-1">
              <p className="text-3xl font-semibold text-foreground">{tier.price}</p>
              {tier.cadence ? <p className="pb-1 text-sm text-muted">{tier.cadence}</p> : null}
            </div>
            <p className="mt-2 text-xs font-medium text-secondary">{tier.trial}</p>
            <p className="mt-3 text-sm text-muted">{tier.summary}</p>
            <div className="mt-4 space-y-2 text-sm text-foreground">
              {tier.features.map((item) => (
                <p key={item}>• {item}</p>
              ))}
            </div>
            <div className="mt-5">
              <Link href="/get-started">
                <Button className="w-full">{tier.name === 'Enterprise' ? 'Talk to sales' : 'Start onboarding'}</Button>
              </Link>
            </div>
          </Card>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold text-foreground">Compare tiers</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          This is the current beta comparison. Final limits and add-ons will be refined with early adopters.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-muted/10">
                <tr>
                  <th className="px-4 py-3 font-semibold text-foreground">Capability</th>
                  <th className="px-4 py-3 font-semibold text-foreground">Starter</th>
                  <th className="px-4 py-3 font-semibold text-foreground">Growth</th>
                  <th className="px-4 py-3 font-semibold text-foreground">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="border-t border-border">
                    <td className="px-4 py-3 font-medium text-foreground">{row.label}</td>
                    <td className="px-4 py-3 text-muted">{row.starter}</td>
                    <td className="px-4 py-3 text-muted">{row.growth}</td>
                    <td className="px-4 py-3 text-muted">{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-5 md:grid-cols-2">
        <Card className="border-border bg-white p-6">
          <h2 className="text-2xl font-semibold text-foreground">FAQ</h2>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="font-semibold text-foreground">Do you offer a free trial?</p>
              <p className="mt-1 text-muted">Starter and Growth include a 14-day trial. Enterprise onboarding is handled case-by-case.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Can we take payments in Africa?</p>
              <p className="mt-1 text-muted">Yes. Use Paystack for supported local currencies and Stripe for USD giving where it fits.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Can we switch plans later?</p>
              <p className="mt-1 text-muted">
                Yes. In beta we support plan changes with guardrails. We will formalize proration and upgrade/downgrade rules next.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Is data migration supported?</p>
              <p className="mt-1 text-muted">For beta, we provide guided imports and a migration checklist. Automated competitor migrations are on the roadmap.</p>
            </div>
          </div>
        </Card>

        <Card className="border-border bg-primary p-6 text-primary-foreground">
          <p className="text-xs uppercase tracking-widest text-primary-foreground/70">Recommended next step</p>
          <h3 className="mt-3 text-2xl font-semibold">Run onboarding end-to-end.</h3>
          <p className="mt-3 text-sm text-primary-foreground/80">
            Create/select your church org, claim admin access, choose a plan, and land directly in the admin console.
          </p>
          <div className="mt-6">
            <Link href="/get-started">
              <Button variant="secondary" className="w-full">
                Start onboarding
              </Button>
            </Link>
          </div>
        </Card>
      </section>
    </main>
  );
}
