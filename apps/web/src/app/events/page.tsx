import Link from 'next/link';
import { Card, Button } from '@faithflow-ai/ui';

export default function EventsLandingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center p-8">
      <Card className="w-full p-8">
        <h1 className="text-2xl font-semibold">Events</h1>
        <p className="mt-2 text-sm text-muted">
          Sign in to access your church events, RSVPs, and registrations in the member portal.
        </p>
        <div className="mt-6">
          <Link href="/portal">
            <Button>Open member portal</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
