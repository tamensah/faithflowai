'use client';

import { useMemo, useState } from 'react';
import { Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../../components/Shell';
import { PageSectionLayout } from '../../../components/PageSectionLayout';
import { trpc } from '../../../lib/trpc';

const channelOptions = ['EMAIL', 'SMS', 'WHATSAPP'] as const;
const reasonOptions = ['USER_UNSUBSCRIBE', 'ADMIN_SUPPRESS', 'BOUNCE', 'COMPLAINT'] as const;

export default function SuppressionsPage() {
  const utils = trpc.useUtils();
  const [channel, setChannel] = useState<(typeof channelOptions)[number] | ''>('');
  const [q, setQ] = useState('');
  const [windowDays, setWindowDays] = useState('30');

  const [newChannel, setNewChannel] = useState<(typeof channelOptions)[number]>('EMAIL');
  const [newAddress, setNewAddress] = useState('');
  const [newReason, setNewReason] = useState<(typeof reasonOptions)[number]>('ADMIN_SUPPRESS');

  const queryInput = useMemo(() => {
    const trimmed = q.trim();
    return {
      channel: channel || undefined,
      q: trimmed || undefined,
      limit: 100,
    };
  }, [channel, q]);

  const { data, isLoading, error } = trpc.communications.suppressions.useQuery(queryInput);
  const { data: summary } = trpc.communications.suppressionSummary.useQuery({ days: Number(windowDays) || 30 });

  const summaryByChannel = useMemo(() => {
    const rows = summary?.byChannelReason ?? [];
    const out: Record<string, { total: number; byReason: Record<string, number> }> = {};
    for (const ch of channelOptions) out[ch] = { total: 0, byReason: {} };
    for (const row of rows) {
      const bucket = out[row.channel] ?? { total: 0, byReason: {} };
      bucket.total += row._count;
      bucket.byReason[row.reason] = (bucket.byReason[row.reason] ?? 0) + row._count;
      out[row.channel] = bucket;
    }
    return out;
  }, [summary?.byChannelReason]);

  const recentUnsubscribesByChannel = useMemo(() => {
    const out: Record<string, number> = {};
    for (const ch of channelOptions) out[ch] = 0;
    for (const row of summary?.recentUnsubscribes ?? []) {
      out[row.channel] = row._count;
    }
    return out;
  }, [summary?.recentUnsubscribes]);

  const { mutate: addSuppression, isPending: isAdding } = trpc.communications.addSuppression.useMutation({
    onSuccess: async () => {
      setNewAddress('');
      await utils.communications.suppressions.invalidate();
    },
  });

  const { mutate: removeSuppression, isPending: isRemoving } = trpc.communications.removeSuppression.useMutation({
    onSuccess: async () => {
      await utils.communications.suppressions.invalidate();
    },
  });

  return (
    <Shell>
      <PageSectionLayout rootId="communications-suppressions-page-sections" title="Suppression sections" className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Comms Suppressions</h1>
          <p className="mt-2 text-sm text-muted">
            Durable unsubscribe/suppression list. Suppressed recipients will not receive scheduled communications.
          </p>
        </div>

        <Card className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Suppression summary</h2>
              <p className="mt-1 text-sm text-muted">Durable unsubscribe/suppression posture by channel.</p>
            </div>
            <select
              className="h-10 rounded-md border border-border bg-white px-3 text-sm"
              value={windowDays}
              onChange={(e) => setWindowDays(e.target.value)}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {channelOptions.map((entry) => (
              <div key={entry} className="rounded-md border border-border p-3">
                <p className="text-sm font-semibold">{entry}</p>
                <p className="mt-1 text-xs text-muted">Total suppressed: {summaryByChannel[entry]?.total ?? 0}</p>
                <p className="text-xs text-muted">
                  User unsubscribes ({windowDays}d): {recentUnsubscribesByChannel[entry] ?? 0}
                </p>
                <div className="mt-2 space-y-1 text-xs text-muted">
                  {Object.entries(summaryByChannel[entry]?.byReason ?? {}).map(([reason, count]) => (
                    <div key={reason} className="flex items-center justify-between gap-2">
                      <span>{reason.replace(/_/g, ' ')}</span>
                      <span className="font-mono text-foreground">{count}</span>
                    </div>
                  ))}
                  {!Object.keys(summaryByChannel[entry]?.byReason ?? {}).length ? <p>No suppressions.</p> : null}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Add suppression</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={newChannel}
              onChange={(e) => setNewChannel(e.target.value as (typeof channelOptions)[number])}
            >
              {channelOptions.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
            <Input
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder={newChannel === 'EMAIL' ? 'email@example.com' : '+15551234567'}
            />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value as (typeof reasonOptions)[number])}
            >
              {reasonOptions.map((entry) => (
                <option key={entry} value={entry}>
                  {entry.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <Button
              disabled={isAdding || newAddress.trim().length < 3}
              onClick={() =>
                addSuppression({
                  channel: newChannel,
                  address: newAddress,
                  reason: newReason,
                })
              }
            >
              {isAdding ? 'Adding...' : 'Add'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Notes: phone numbers should be E.164 (e.g. +233XXXXXXXXX). WhatsApp numbers should be plain E.164 (no
            `whatsapp:` prefix).
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Current suppressions</h2>
              <p className="mt-1 text-sm text-muted">Filter and remove suppressions for this tenant.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="h-10 rounded-md border border-border bg-white px-3 text-sm"
                value={channel}
                onChange={(e) => setChannel(e.target.value as typeof channel)}
              >
                <option value="">All channels</option>
                {channelOptions.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search address..." />
            </div>
          </div>

          {isLoading ? <p className="mt-4 text-sm text-muted">Loading suppressions...</p> : null}
          {error ? <p className="mt-4 text-sm text-destructive">{error.message}</p> : null}

          <div className="mt-4 space-y-2">
            {(data ?? []).map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                <div className="min-w-[260px]">
                  <p className="text-sm font-medium">{row.address}</p>
                  <p className="text-xs text-muted">
                    {row.channel} · {row.reason.replace(/_/g, ' ')} · {new Date(row.createdAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isRemoving}
                  onClick={() => removeSuppression({ id: row.id })}
                >
                  Remove
                </Button>
              </div>
            ))}

            {!data?.length && !isLoading ? <p className="text-sm text-muted">No suppressions.</p> : null}
          </div>
        </Card>
      </PageSectionLayout>
    </Shell>
  );
}
