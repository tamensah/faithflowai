'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, Card, Input } from '@faithflow-ai/ui';
import { trpc } from '../../../lib/trpc';

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return '—';
  return (typeof value === 'string' ? new Date(value) : value).toLocaleString();
};

const hasValue = (value: unknown) => {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined;
};

export default function EventsPage() {
  const { data: selfProfile } = trpc.member.selfProfile.useQuery(undefined, { retry: false });
  const churchId = selfProfile?.member?.churchId;

  const { data: events } = trpc.event.list.useQuery(
    { churchId, limit: 10 },
    { enabled: Boolean(churchId) }
  );
  const { data: myRsvps } = trpc.event.myRsvps.useQuery(undefined, { enabled: Boolean(selfProfile) });
  const { data: myTicketOrders } = trpc.event.myTicketOrders.useQuery(undefined, { enabled: Boolean(selfProfile) });
  const { data: myRegistrations } = trpc.event.myRegistrations.useQuery(undefined, { enabled: Boolean(selfProfile) });

  const [ticketProvider, setTicketProvider] = useState('STRIPE');
  const [registrationResponses, setRegistrationResponses] = useState<Record<string, Record<string, any>>>({});
  const [registrationErrors, setRegistrationErrors] = useState<Record<string, string>>({});

  const { mutate: rsvp } = trpc.event.rsvp.useMutation();
  const { mutate: registerEvent } = trpc.event.register.useMutation();
  const { mutate: cancelRegistration } = trpc.event.cancelRegistration.useMutation();
  const { mutateAsync: ticketCheckout } = trpc.event.ticketCheckout.useMutation();

  const rsvpMap = useMemo(() => {
    const map = new Map<string, string>();
    (myRsvps ?? []).forEach((entry) => map.set(entry.eventId, entry.status));
    return map;
  }, [myRsvps]);

  const ticketOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    (myTicketOrders ?? []).forEach((order) => {
      map.set(order.eventId, (map.get(order.eventId) ?? 0) + order.quantity);
    });
    return map;
  }, [myTicketOrders]);

  const registrationMap = useMemo(() => {
    const map = new Map<string, any>();
    (myRegistrations ?? []).forEach((registration) => map.set(registration.eventId, registration));
    return map;
  }, [myRegistrations]);

  const isRegistrationFieldAnswered = (field: any, value: unknown) => {
    if (field.type === 'CHECKBOX') return value === true;
    if (field.type === 'MULTI_SELECT') return hasValue(value);
    return hasValue(value);
  };

  const getMissingRegistrationFields = (eventId: string, fields: any[]) => {
    return fields
      .filter((field) => field?.required)
      .filter((field, idx) => {
        const key = field.id ?? field.label ?? `field-${idx}`;
        return !isRegistrationFieldAnswered(field, registrationResponses[eventId]?.[key]);
      })
      .map((field, idx) => field.label ?? `Field ${idx + 1}`);
  };

  const handleRegistrationResponse = (eventId: string, fieldKey: string, value: any) => {
    setRegistrationErrors((prev) => {
      if (!prev[eventId]) return prev;
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
    setRegistrationResponses((prev) => ({
      ...prev,
      [eventId]: { ...(prev[eventId] ?? {}), [fieldKey]: value },
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Upcoming Events</h2>
          <p className="text-sm text-muted">RSVP and manage your attendance.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted">Payment provider</label>
          <select
            className="h-8 rounded-md border border-border bg-white px-2 text-xs"
            value={ticketProvider}
            onChange={(e) => setTicketProvider(e.target.value)}
          >
            <option value="STRIPE">Stripe</option>
            <option value="PAYSTACK">Paystack</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {events?.map((event) => {
          const status = rsvpMap.get(event.id);
          const ticketTypes = event.ticketTypes ?? [];
          const ticketCount = ticketOrderMap.get(event.id) ?? 0;
          const registration = registrationMap.get(event.id);
          const registrationFields = Array.isArray(event.registrationFields) ? event.registrationFields : [];
          const missingRegistrationFields = getMissingRegistrationFields(event.id, registrationFields);
          const canRegisterForEvent = missingRegistrationFields.length === 0;
          const registrationError = registrationErrors[event.id];

          return (
            <Card key={event.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{event.title}</p>
                  <p className="text-xs text-muted">
                    {formatDateTime(event.startAt)} → {formatDateTime(event.endAt)}
                  </p>
                  {event.location ? <p className="text-xs text-muted">{event.location}</p> : null}
                  {ticketCount ? <p className="text-xs text-muted">Tickets purchased: {ticketCount}</p> : null}
                  {event.registrationEnabled ? (
                    <p className="text-xs text-muted">
                      Registration: {registration?.status ?? 'Not registered'}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {event.requiresRsvp && ticketTypes.length === 0 ? (
                    <Badge variant="default">{status ?? 'RSVP'}</Badge>
                  ) : (
                    <Badge variant="default">Open</Badge>
                  )}
                  {event.requiresRsvp && ticketTypes.length === 0 ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => rsvp({ eventId: event.id, status: 'GOING' })}>
                        Going
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rsvp({ eventId: event.id, status: 'DECLINED' })}
                      >
                        Decline
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>

              {event.registrationEnabled ? (
                <div className="mt-3 space-y-2 text-xs text-muted">
                  {registrationFields.length ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {registrationFields.map((field: any, idx: number) => {
                        const fieldKey = field.id ?? field.label ?? `field-${idx}`;
                        const value = registrationResponses[event.id]?.[fieldKey] ?? '';
                        const label = `${field.label ?? `Field ${idx + 1}`}${field.required ? ' *' : ''}`;
                        if (field.type === 'SELECT' || field.type === 'MULTI_SELECT') {
                          return (
                            <select
                              key={fieldKey}
                              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                              value={value}
                              onChange={(e) => handleRegistrationResponse(event.id, fieldKey, e.target.value)}
                            >
                              <option value="">Select {label}</option>
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
                            <label key={fieldKey} className="flex items-center gap-2 text-sm text-muted">
                              <input
                                type="checkbox"
                                checked={Boolean(value)}
                                onChange={(e) =>
                                  handleRegistrationResponse(event.id, fieldKey, e.target.checked)
                                }
                              />
                              {label}
                            </label>
                          );
                        }
                        return (
                          <Input
                            key={fieldKey}
                            placeholder={label}
                            type={
                              field.type === 'NUMBER'
                                ? 'number'
                                : field.type === 'DATE'
                                  ? 'date'
                                  : 'text'
                            }
                            value={value}
                            onChange={(e) => handleRegistrationResponse(event.id, fieldKey, e.target.value)}
                          />
                        );
                      })}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {registration && registration.status !== 'CANCELED' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cancelRegistration({ eventId: event.id })}
                      >
                        Cancel registration
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!canRegisterForEvent) {
                            setRegistrationErrors((prev) => ({
                              ...prev,
                              [event.id]: `Complete required fields: ${missingRegistrationFields.join(', ')}`,
                            }));
                            return;
                          }
                          setRegistrationErrors((prev) => {
                            const next = { ...prev };
                            delete next[event.id];
                            return next;
                          });
                          registerEvent({
                            eventId: event.id,
                            responses: registrationResponses[event.id] ?? {},
                          });
                        }}
                        disabled={!canRegisterForEvent}
                      >
                        {registration?.status === 'WAITLISTED' ? 'Join waitlist' : 'Register'}
                      </Button>
                    )}
                  </div>
                  {registrationError ? (
                    <p className="text-xs text-destructive">{registrationError}</p>
                  ) : null}
                  {!registrationError && !canRegisterForEvent ? (
                    <p className="text-xs text-muted">Required: {missingRegistrationFields.join(', ')}</p>
                  ) : null}
                </div>
              ) : null}

              {ticketTypes.length ? (
                <div className="mt-3 space-y-2 text-xs text-muted">
                  {ticketTypes.map((type: any) => (
                    <div key={type.id} className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">{type.name}</p>
                        <p className="text-xs text-muted">
                          {type.currency} {type.price}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={async () => {
                          const result = await ticketCheckout({
                            eventId: event.id,
                            ticketTypeId: type.id,
                            quantity: 1,
                            provider: ticketProvider as any,
                            successUrl: `${window.location.origin}/portal`,
                            cancelUrl: `${window.location.origin}/portal`,
                          });
                          if (result?.checkoutUrl) {
                            window.location.href = result.checkoutUrl;
                          }
                        }}
                      >
                        Buy ticket
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          );
        })}
        {!events?.length ? <p className="text-sm text-muted">No upcoming events.</p> : null}
      </div>
    </div>
  );
}
