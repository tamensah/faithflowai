'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { trpc } from '../../lib/trpc';

function formatNumber(value: number | string) {
  if (typeof value === 'string') return value;
  return new Intl.NumberFormat().format(value);
}

function toDateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default function OperationsPage() {
  const today = new Date();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [churchId, setChurchId] = useState('');
  const [from, setFrom] = useState(toDateInputValue(ninetyDaysAgo));
  const [to, setTo] = useState(toDateInputValue(today));

  const rangeInput = useMemo(
    () => ({
      churchId: churchId || undefined,
      from: from ? new Date(`${from}T00:00:00.000Z`) : undefined,
      to: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
    }),
    [churchId, from, to]
  );

  const { data: churches } = trpc.church.list.useQuery({});
  const { data: summary } = trpc.operations.headquartersSummary.useQuery(rangeInput);
  const { data: campuses } = trpc.operations.campusPerformance.useQuery(rangeInput);

  return (
    <Shell>
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">Headquarters Operations</h1>
            <p className="mt-2 text-sm text-muted">Cross-campus rollups with drill-down performance signals.</p>
          </div>
          <Link href="/operations/health">
            <Button variant="outline">Operational health</Button>
          </Link>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Filters</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={churchId}
              onChange={(event) => setChurchId(event.target.value)}
            >
              <option value="">All churches</option>
              {churches?.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.name}
                </option>
              ))}
            </select>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Platform Rollup</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <p className="text-sm">Organizations: {formatNumber(summary?.totals.organizations ?? 0)}</p>
            <p className="text-sm">Churches: {formatNumber(summary?.totals.churches ?? 0)}</p>
            <p className="text-sm">Campuses: {formatNumber(summary?.totals.campuses ?? 0)}</p>
            <p className="text-sm">Members: {formatNumber(summary?.totals.members ?? 0)}</p>
            <p className="text-sm">Events: {formatNumber(summary?.totals.events ?? 0)}</p>
            <p className="text-sm">Attendance: {formatNumber(summary?.totals.attendance ?? 0)}</p>
            <p className="text-sm">Donations: {formatNumber(summary?.totals.donationCount ?? 0)}</p>
            <p className="text-sm">Facilities: {formatNumber(summary?.totals.facilities ?? 0)}</p>
            <p className="text-sm">Facility bookings: {formatNumber(summary?.totals.facilityBookings ?? 0)}</p>
            <p className="text-sm">Care requests: {formatNumber(summary?.totals.careRequests ?? 0)}</p>
            <p className="text-sm">Published sermons: {formatNumber(summary?.totals.publishedSermons ?? 0)}</p>
            <p className="text-sm">
              Donation amount: {summary?.totals.donationAmount?.toString() ?? '0'}
            </p>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Campus Drilldown</h2>
          <div className="mt-4 space-y-3">
            {campuses?.map((campus) => (
              <Card key={campus.campusId} className="p-4">
                <p className="text-sm font-semibold">{campus.campusName}</p>
                <div className="mt-2 grid gap-2 text-xs text-muted sm:grid-cols-3 lg:grid-cols-5">
                  <p>Events: {formatNumber(campus.eventCount)}</p>
                  <p>Attendance: {formatNumber(campus.attendanceCount)}</p>
                  <p>Facilities: {formatNumber(campus.facilityCount)}</p>
                  <p>Booked hours: {campus.bookedHours.toFixed(1)}</p>
                  <p>Care (open/total): {campus.openCareRequests}/{campus.careRequestCount}</p>
                  <p>Published sermons: {formatNumber(campus.publishedSermons)}</p>
                  <p>Sermon views: {formatNumber(campus.sermonViews)}</p>
                </div>
              </Card>
            ))}
            {!campuses?.length ? <p className="text-sm text-muted">No campus data found for current filters.</p> : null}
          </div>
        </Card>
      </div>
    </Shell>
  );
}
