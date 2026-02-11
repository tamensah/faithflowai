'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { Badge, Button, Card } from '@faithflow-ai/ui';
import { Shell } from '../../../components/Shell';
import { trpc } from '../../../lib/trpc';

export default function EventBadgesPage() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('eventId') ?? '';
  const { data: event } = trpc.event.detail.useQuery(
    { eventId },
    { enabled: Boolean(eventId) }
  );
  const { data: badges } = trpc.event.listBadges.useQuery(
    { eventId },
    { enabled: Boolean(eventId) }
  );
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

  const badgeList = useMemo(() => badges ?? [], [badges]);

  useEffect(() => {
    if (!badgeList.length || !eventId) return;
    let active = true;
    Promise.all(
      badgeList.map(async (badge) => {
        const text = `ffbadge:${eventId}:${badge.badgeCode}`;
        const dataUrl = await QRCode.toDataURL(text, { width: 180, margin: 1 });
        return [badge.id, dataUrl] as const;
      })
    )
      .then((entries) => {
        if (!active) return;
        const nextMap: Record<string, string> = {};
        for (const [id, url] of entries) {
          nextMap[id] = url;
        }
        setQrMap(nextMap);
      })
      .catch(() => {
        if (active) setQrMap({});
      });
    return () => {
      active = false;
    };
  }, [badgeList, eventId]);

  return (
    <Shell>
      <style jsx global>{`
        @media print {
          header {
            display: none !important;
          }
          .print-hidden {
            display: none !important;
          }
          .print-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          body {
            background: white !important;
          }
        }
      `}</style>
      <div className="space-y-6">
        <Card className="print-hidden p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Event badges</h1>
              <p className="mt-1 text-sm text-muted">
                {event?.title ?? 'Select an event'} · {event?.church?.name ?? 'Church'}
              </p>
            </div>
            <Button onClick={() => window.print()} disabled={!badgeList.length}>
              Print
            </Button>
          </div>
          {!eventId ? <p className="mt-4 text-sm text-muted">Missing eventId.</p> : null}
          {eventId && !badgeList.length ? (
            <p className="mt-4 text-sm text-muted">No badges available yet.</p>
          ) : null}
        </Card>

        <div className="print-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {badgeList.map((badge) => {
            const displayName = badge.member
              ? `${badge.member.firstName} ${badge.member.lastName}`
              : badge.registration?.guestName ?? 'Guest attendee';
            const badgeType = badge.ticketOrder ? `Ticket ${badge.sequence ?? 1}` : 'Registration';
            return (
              <Card key={badge.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{displayName}</p>
                    <p className="text-xs text-muted">{badgeType}</p>
                    <p className="text-xs text-muted">Code: {badge.badgeCode}</p>
                  </div>
                  <Badge variant="default">{badge.status}</Badge>
                </div>
                <div className="mt-4 flex items-center justify-center rounded-md border border-border bg-white p-2">
                  {qrMap[badge.id] ? (
                    <img src={qrMap[badge.id]} alt={`Badge ${badge.badgeCode}`} />
                  ) : (
                    <div className="h-24 w-24 animate-pulse rounded-md bg-muted" />
                  )}
                </div>
                <p className="mt-2 text-center text-[11px] text-muted">
                  {event?.title ?? 'FaithFlow Event'}
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}
