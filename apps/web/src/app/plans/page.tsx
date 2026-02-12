import Link from 'next/link';
import { Badge, Button, Card } from '@faithflow-ai/ui';

const tiers = [
  {
    name: 'Starter',
    price: '$49',
    cadence: '/month',
    trial: '14-day free trial',
    summary: 'For small churches launching digital operations.',
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

export default function PlansPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <Badge variant="default">Pricing</Badge>
      <h1 className="mt-4 text-4xl font-semibold">Choose a plan that fits your church stage.</h1>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        Start with a free trial, keep Stripe and Paystack enabled, and scale to multi-campus operations without
        changing platforms.
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
    </main>
  );
}
