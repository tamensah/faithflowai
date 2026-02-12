import Link from 'next/link';
import { Badge, Button, Card } from '@faithflow-ai/ui';

const entries = [
  {
    title: 'Church onboarding',
    body: 'Create/select your organization, claim admin access, and activate subscription.',
    href: '/get-started',
    cta: 'Open onboarding',
  },
  {
    title: 'Membership portal',
    body: 'Members update profile, RSVP, volunteer, review notifications, and manage privacy.',
    href: '/portal',
    cta: 'Open member portal',
  },
  {
    title: 'Events',
    body: 'Public event discovery, registrations, and event-specific experiences.',
    href: '/events',
    cta: 'Open events',
  },
];

export default function ExistingUsersPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <Badge variant="default">Existing users</Badge>
      <h1 className="mt-4 text-4xl font-semibold">Pick the right workspace for your task.</h1>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        Use the entry points below to avoid routing confusion and keep onboarding, member actions, and events
        workflows separate.
      </p>

      <section className="mt-8 grid gap-5 md:grid-cols-3">
        {entries.map((entry) => (
          <Card key={entry.title} className="border-border bg-white p-6">
            <h2 className="text-xl font-semibold">{entry.title}</h2>
            <p className="mt-3 text-sm text-muted">{entry.body}</p>
            <div className="mt-5">
              <Link href={entry.href}>
                <Button className="w-full">{entry.cta}</Button>
              </Link>
            </div>
          </Card>
        ))}
      </section>
    </main>
  );
}
