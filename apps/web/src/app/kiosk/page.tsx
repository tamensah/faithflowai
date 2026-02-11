'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge, Button, Card, Input } from '@faithflow-ai/ui';
import { trpc } from '../../lib/trpc';

export default function KioskPage() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('eventId') ?? '';
  const code = searchParams.get('code') ?? '';
  const [search, setSearch] = useState('');

  const { data, refetch } = trpc.attendance.kioskRoster.useQuery(
    { eventId, code, query: search || undefined, limit: 200 },
    { enabled: Boolean(eventId && code) }
  );
  const { mutate: kioskCheckIn } = trpc.attendance.kioskCheckIn.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });
  const { mutate: kioskCheckOut } = trpc.attendance.kioskCheckOut.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });

  const filtered = useMemo(() => data?.roster ?? [], [data?.roster]);

  if (!eventId || !code) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <Card className="p-6">
          <h1 className="text-2xl font-semibold">Kiosk</h1>
          <p className="mt-2 text-sm text-muted">Missing event credentials.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">{data?.event?.title ?? 'Event check-in'}</h1>
            <p className="mt-1 text-sm text-muted">Kiosk mode for fast check-in.</p>
          </div>
          <Badge variant="default">
            {data?.roster?.length ?? 0} / {data?.totalCount ?? 0} members
          </Badge>
        </div>
        <div className="mt-4">
          <Input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          <p className="mt-2 text-xs text-muted">Search by name, email, or phone.</p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="overflow-x-auto text-sm text-muted">
          <table className="min-w-full">
            <thead className="text-left text-xs uppercase text-muted">
              <tr>
                <th className="py-2">Member</th>
                <th className="py-2">Email</th>
                <th className="py-2">Phone</th>
                <th className="py-2">Status</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.member.id} className="border-t border-border">
                  <td className="py-2">{entry.member.firstName} {entry.member.lastName}</td>
                  <td className="py-2">{entry.member.email ?? '—'}</td>
                  <td className="py-2">{entry.member.phone ?? '—'}</td>
                  <td className="py-2">
                    <Badge variant={entry.status === 'CHECKED_IN' ? 'success' : 'default'}>
                      {entry.status}
                    </Badge>
                  </td>
                  <td className="py-2">
                    {entry.status === 'CHECKED_IN' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => kioskCheckOut({ eventId, code, memberId: entry.member.id })}
                      >
                        Check out
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => kioskCheckIn({ eventId, code, memberId: entry.member.id })}
                      >
                        Check in
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <p className="mt-3 text-sm text-muted">No members found.</p>}
        </div>
      </Card>
    </div>
  );
}
