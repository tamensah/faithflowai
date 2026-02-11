'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge, Card } from '@faithflow-ai/ui';
import { trpc } from '../../../lib/trpc';

export default function PublicEventsPage() {
  const params = useParams<{ churchSlug: string }>();
  const churchSlug = params?.churchSlug ?? '';

  const { data } = trpc.event.publicList.useQuery(
    { churchSlug, limit: 20 },
    { enabled: Boolean(churchSlug) }
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold">{data?.church?.name ?? 'Events'}</h1>
        <p className="mt-2 text-sm text-muted">Discover upcoming gatherings and register online.</p>
      </div>

      <div className="grid gap-4">
        {data?.events?.map((event) => (
          <Card key={event.id} className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-foreground">{event.title}</h2>
                <p className="mt-1 text-sm text-muted">
                  {new Date(event.startAt).toLocaleString()} → {new Date(event.endAt).toLocaleString()}
                </p>
                {event.location ? <p className="text-xs text-muted">{event.location}</p> : null}
              </div>
              <Badge variant="default">{event.format}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
              {event.registrationEnabled ? (
                <Badge variant="default">{event._count?.registrations ?? 0} registrations</Badge>
              ) : null}
              {event.requiresRsvp ? (
                <Badge variant="default">{event._count?.rsvps ?? 0} RSVPs</Badge>
              ) : null}
              {event.ticketTypes?.length ? <Badge variant="default">Ticketed</Badge> : null}
            </div>
            <div className="mt-4">
              <Link className="text-primary underline" href={`/events/${churchSlug}/${event.id}`}>
                View event details
              </Link>
            </div>
          </Card>
        ))}
        {!data?.events?.length && (
          <Card className="p-6">
            <p className="text-sm text-muted">No upcoming events.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
