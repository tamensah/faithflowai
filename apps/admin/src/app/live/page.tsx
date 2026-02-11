'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Input } from '@faithflow-ai/ui';
import { trpc } from '../../lib/trpc';
import { Shell } from '../../components/Shell';
import { useAuth } from '@clerk/nextjs';

type FeedEvent = {
  type: string;
  data: Record<string, unknown>;
  ts: number;
};

export default function LivePage() {
  const utils = trpc.useUtils();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [eventId, setEventId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [donationAmount, setDonationAmount] = useState('25');
  const [donationProvider, setDonationProvider] = useState<'MANUAL' | 'STRIPE' | 'PAYSTACK'>('MANUAL');
  const [donationRef, setDonationRef] = useState('demo-ref');

  const { getToken } = useAuth();
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  const baseUrl = useMemo(() => {
    const base = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/trpc\/?$/, '');
    return base;
  }, []);

  const { data: members } = trpc.member.list.useQuery({});
  const { data: eventList } = trpc.event.list.useQuery({});

  const { mutate: checkIn, isPending: isCheckingIn } = trpc.attendance.checkIn.useMutation({
    onSuccess: () => utils.attendance.listByEvent.invalidate(),
  });

  const { mutate: createDonation, isPending: isCreatingDonation } = trpc.donation.create.useMutation({
    onSuccess: () => utils.donation.list.invalidate(),
  });

  useEffect(() => {
    let isMounted = true;

    getToken().then((token) => {
      if (!token || !isMounted) return;
      setStreamUrl(`${baseUrl}/stream?token=${encodeURIComponent(token)}`);
    });

    return () => {
      isMounted = false;
    };
  }, [baseUrl, getToken]);

  useEffect(() => {
    if (!streamUrl) return;
    const source = new EventSource(streamUrl);

    const handle = (type: string) => (event: MessageEvent) => {
      const data = JSON.parse(event.data) as Record<string, unknown>;
      setEvents((prev) => [{ type, data, ts: Date.now() }, ...prev].slice(0, 50));
    };

    source.addEventListener('attendance.checked_in', handle('attendance.checked_in'));
    source.addEventListener('donation.created', handle('donation.created'));

    return () => {
      source.close();
    };
  }, [streamUrl]);

  const selectedEvent = eventList?.find((event) => event.id === eventId);

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Live feed</h1>
          <p className="mt-2 text-muted">Realtime attendance and giving activity.</p>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Trigger realtime events</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <label className="text-sm text-muted">Event</label>
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={eventId}
                onChange={(event) => setEventId(event.target.value)}
              >
                <option value="">Select event</option>
                {eventList?.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>

              <label className="text-sm text-muted">Member</label>
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={memberId}
                onChange={(event) => setMemberId(event.target.value)}
              >
                <option value="">Select member</option>
                {members?.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.firstName} {member.lastName}
                  </option>
                ))}
              </select>

              <Button
                onClick={() => checkIn({ eventId, memberId })}
                disabled={!eventId || !memberId || isCheckingIn}
              >
                {isCheckingIn ? 'Checking in…' : 'Check in member'}
              </Button>
            </div>

            <div className="space-y-3">
              <label className="text-sm text-muted">Donation amount</label>
              <Input
                type="number"
                value={donationAmount}
                onChange={(event) => setDonationAmount(event.target.value)}
              />

              <label className="text-sm text-muted">Provider</label>
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={donationProvider}
                onChange={(event) => setDonationProvider(event.target.value as 'MANUAL' | 'STRIPE' | 'PAYSTACK')}
              >
                <option value="MANUAL">Manual</option>
                <option value="STRIPE">Stripe</option>
                <option value="PAYSTACK">Paystack</option>
              </select>

              <label className="text-sm text-muted">Provider reference</label>
              <Input value={donationRef} onChange={(event) => setDonationRef(event.target.value)} />

              <Button
                onClick={() =>
                  createDonation({
                    churchId: selectedEvent?.churchId ?? eventList?.[0]?.churchId ?? '',
                    amount: Number(donationAmount),
                    currency: 'USD',
                    provider: donationProvider,
                    providerRef: donationRef,
                  })
                }
                disabled={!(selectedEvent?.churchId || eventList?.[0]?.churchId) || !donationAmount || isCreatingDonation}
              >
                {isCreatingDonation ? 'Creating…' : 'Create donation'}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Events</h2>
            <Badge variant="default">{events.length} updates</Badge>
          </div>

          <div className="mt-4 space-y-3">
            {events.map((event, index) => (
              <div key={`${event.type}-${event.ts}-${index}`} className="rounded-md border border-border px-3 py-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{event.type}</span>
                  <span className="text-muted">{new Date(event.ts).toLocaleTimeString()}</span>
                </div>
                <pre className="mt-2 overflow-x-auto text-xs text-muted">
                  {JSON.stringify(event.data, null, 2)}
                </pre>
              </div>
            ))}
            {!events.length && <p className="text-sm text-muted">Waiting for events…</p>}
          </div>
        </Card>
      </div>
    </Shell>
  );
}
