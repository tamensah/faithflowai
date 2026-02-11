'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Badge, Button, Card, Input } from '@faithflow-ai/ui';
import { trpc } from '../../../../lib/trpc';

export default function PublicEventDetailPage() {
  const params = useParams<{ churchSlug: string; eventId: string }>();
  const churchSlug = params?.churchSlug ?? '';
  const eventId = params?.eventId ?? '';
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [registrationStatus, setRegistrationStatus] = useState<string>('');

  const { data } = trpc.event.publicDetail.useQuery(
    { churchSlug, eventId },
    { enabled: Boolean(churchSlug && eventId) }
  );

  const { mutate: publicRegister, isPending } = trpc.event.publicRegister.useMutation({
    onSuccess: (registration) => {
      setRegistrationStatus(registration.status);
    },
  });

  const registrationFields = useMemo(() => {
    const fields = data?.event?.registrationFields;
    return Array.isArray(fields) ? fields : [];
  }, [data?.event?.registrationFields]);

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  if (!data?.event) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Card className="p-6">
          <p className="text-sm text-muted">Loading event details…</p>
        </Card>
      </div>
    );
  }

  const event = data.event;
  const startIso = new Date(event.startAt).toISOString();
  const endIso = new Date(event.endAt).toISOString();
  const formatGoogleDate = (value: string) =>
    value.replace(/[-:]/g, '').split('.')[0] + 'Z';
  const calendarDetails = [event.description, event.meetingUrl ? `Join: ${event.meetingUrl}` : null]
    .filter(Boolean)
    .join('\n');
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    event.title
  )}&dates=${formatGoogleDate(startIso)}/${formatGoogleDate(endIso)}&details=${encodeURIComponent(
    calendarDetails
  )}&location=${encodeURIComponent(event.location ?? '')}`;
  const outlookCalendarUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(
    event.title
  )}&startdt=${encodeURIComponent(startIso)}&enddt=${encodeURIComponent(
    endIso
  )}&body=${encodeURIComponent(calendarDetails)}&location=${encodeURIComponent(event.location ?? '')}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">{event.title}</h1>
            <p className="mt-2 text-sm text-muted">
              {new Date(event.startAt).toLocaleString()} → {new Date(event.endAt).toLocaleString()}
            </p>
            {event.location ? <p className="text-xs text-muted">{event.location}</p> : null}
          </div>
          <Badge variant="default">{event.format}</Badge>
        </div>
        {event.description ? <p className="mt-4 text-sm text-muted">{event.description}</p> : null}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted">
          <a
            className="text-primary underline"
            href={`${apiBase}/public/events/${churchSlug}/${event.id}.ics`}
          >
            iCal file
          </a>
          <a className="text-primary underline" href={googleCalendarUrl} target="_blank" rel="noreferrer">
            Google Calendar
          </a>
          <a className="text-primary underline" href={outlookCalendarUrl} target="_blank" rel="noreferrer">
            Outlook
          </a>
          {event.meetingUrl ? (
            <a className="text-primary underline" href={event.meetingUrl} target="_blank" rel="noreferrer">
              Join livestream
            </a>
          ) : null}
        </div>
      </Card>

      {event.assignments?.length ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Speakers &amp; team</h2>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {event.assignments.map((assignment: any) => (
              <div key={assignment.id} className="flex items-center justify-between">
                <span>
                  {assignment.member
                    ? `${assignment.member.firstName} ${assignment.member.lastName}`
                    : assignment.displayName}
                </span>
                <Badge variant="default">{assignment.role}</Badge>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {event.media?.length ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Event media</h2>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {event.media.map((media: any) => (
              <div key={media.id} className="flex items-center justify-between">
                <span>{media.title ?? media.asset?.filename ?? media.type}</span>
                <a className="text-primary underline" href={media.asset?.url} target="_blank" rel="noreferrer">
                  View
                </a>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {event.ticketTypes?.length ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Tickets</h2>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {event.ticketTypes.map((ticket: any) => (
              <div key={ticket.id} className="flex items-center justify-between">
                <span>{ticket.name}</span>
                <Badge variant="default">
                  {ticket.currency} {ticket.price}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {event.registrationEnabled && event.allowGuestRegistration ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Event registration</h2>
          <p className="mt-1 text-sm text-muted">Reserve your spot and receive updates.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input placeholder="Full name" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
            <Input placeholder="Email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
            <Input placeholder="Phone (optional)" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
          </div>
          {registrationFields.length ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {registrationFields.map((field: any, idx: number) => {
                const key = field.id ?? field.label ?? `field-${idx}`;
                const value = responses[key] ?? '';
                if (field.type === 'SELECT' || field.type === 'MULTI_SELECT') {
                  return (
                    <select
                      key={key}
                      className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                      value={value}
                      onChange={(e) => setResponses((prev) => ({ ...prev, [key]: e.target.value }))}
                    >
                      <option value="">Select {field.label}</option>
                      {(field.options ?? []).map((option: string) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  );
                }
                if (field.type === 'CHECKBOX') {
                  return (
                    <label key={key} className="flex items-center gap-2 text-sm text-muted">
                      <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(e) => setResponses((prev) => ({ ...prev, [key]: e.target.checked }))}
                      />
                      {field.label}
                    </label>
                  );
                }
                return (
                  <Input
                    key={key}
                    placeholder={field.label}
                    type={field.type === 'NUMBER' ? 'number' : field.type === 'DATE' ? 'date' : 'text'}
                    value={value}
                    onChange={(e) => setResponses((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                );
              })}
            </div>
          ) : null}
          <div className="mt-4 flex items-center gap-3">
            <Button
              onClick={() =>
                publicRegister({
                  eventId: event.id,
                  guestName,
                  guestEmail,
                  guestPhone: guestPhone || undefined,
                  responses,
                })
              }
              disabled={!guestName || !guestEmail || isPending}
            >
              {isPending ? 'Submitting…' : 'Register'}
            </Button>
            {registrationStatus ? <Badge variant="default">{registrationStatus}</Badge> : null}
          </div>
        </Card>
      ) : event.registrationEnabled ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Event registration</h2>
          <p className="mt-2 text-sm text-muted">Guest registration is closed for this event.</p>
        </Card>
      ) : null}
    </div>
  );
}
