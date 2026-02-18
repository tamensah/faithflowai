'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, Input } from '@faithflow-ai/ui';
import { trpc } from '../lib/trpc';
import { Shell } from '../components/Shell';

function toNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === 'object' && 'toString' in value) {
    const parsed = Number((value as { toString: () => string }).toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatWhen(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AdminHome() {
  const utils = trpc.useUtils();
  const [orgName, setOrgName] = useState('');
  const [churchName, setChurchName] = useState('');
  const [churchSlug, setChurchSlug] = useState('');
  const [churchCountry, setChurchCountry] = useState('US');
  const [selectedChurchId, setSelectedChurchId] = useState<string | null>(null);
  const [updateCountry, setUpdateCountry] = useState('');
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [churchError, setChurchError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const countryRegex = /^[A-Z]{2}$/;

  const { data: organizations } = trpc.organization.list.useQuery();

  useEffect(() => {
    if (!organizationId && organizations?.length) {
      setOrganizationId(organizations[0].id);
    }
  }, [organizationId, organizations]);

  const { mutate: createOrganization, isPending: isCreatingOrg } = trpc.organization.create.useMutation({
    onSuccess: async (org) => {
      setOrgError(null);
      setOrgName('');
      setOrganizationId(org.id);
      await utils.organization.list.invalidate();
    },
  });

  const { data: churches } = trpc.church.list.useQuery({
    organizationId: organizationId ?? undefined,
  });

  useEffect(() => {
    if (!selectedChurchId && churches?.length) {
      setSelectedChurchId(churches[0].id);
      setUpdateCountry(churches[0].countryCode ?? '');
    }
  }, [selectedChurchId, churches]);

  const { mutate: createChurch, isPending: isCreatingChurch } = trpc.church.create.useMutation({
    onSuccess: async () => {
      setChurchError(null);
      setChurchName('');
      setChurchSlug('');
      setChurchCountry('US');
      await utils.church.list.invalidate();
    },
  });

  const { mutate: updateChurch, isPending: isUpdatingChurch } = trpc.church.update.useMutation({
    onSuccess: async () => {
      setUpdateError(null);
      await utils.church.list.invalidate();
    },
  });

  const { data: memberAnalytics } = trpc.member.analytics.useQuery(
    { lookbackDays: 90 },
    { retry: false }
  );
  const { data: financeDashboard } = trpc.finance.dashboard.useQuery(
    {},
    { retry: false }
  );
  const { data: goLiveChecklist } = trpc.operations.goLiveChecklist.useQuery(undefined, {
    retry: false,
  });
  const { data: recentEvents } = trpc.event.list.useQuery(
    { limit: 5 },
    { retry: false }
  );

  const selectedOrg = organizationId ?? organizations?.[0]?.id ?? null;

  const financeSummary = useMemo(() => {
    const donationRows = financeDashboard?.donations ?? [];
    const expenseRows = financeDashboard?.expenses ?? [];
    const donationCount = donationRows.reduce((sum, row) => sum + row._count, 0);
    const expenseCount = expenseRows.reduce((sum, row) => sum + row._count, 0);
    const donationAmount = donationRows.reduce((sum, row) => sum + toNumber(row._sum.amount), 0);
    return {
      donationCount,
      expenseCount,
      donationAmount,
    };
  }, [financeDashboard]);

  const checklistSummary = useMemo(() => {
    const items = goLiveChecklist?.items ?? [];
    const ok = items.filter((item) => item.status === 'OK').length;
    const warn = items.filter((item) => item.status === 'WARN').length;
    const missing = items.filter((item) => item.status === 'MISSING').length;
    return { total: items.length, ok, warn, missing, items };
  }, [goLiveChecklist]);

  const readinessPct =
    checklistSummary.total > 0 ? Math.round((checklistSummary.ok / checklistSummary.total) * 100) : 0;

  return (
    <Shell>
      <div className="space-y-6">
        <Card className="border-primary/10 bg-gradient-to-r from-slate-950 to-primary p-6 text-primary-foreground shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <Badge className="border-white/25 bg-white/10 text-white">Admin overview</Badge>
              <h1 className="font-display text-3xl font-semibold tracking-tight">Run your church from one operating console</h1>
              <p className="max-w-2xl text-sm text-white/80">
                Daily priorities, setup state, and operational controls in one place. Use this page as your command center.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/members">
                <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                  Manage members
                </Button>
              </Link>
              <Link href="/events">
                <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                  Schedule event
                </Button>
              </Link>
              <Link href="/operations/health">
                <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                  Open go-live checks
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="ff-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Members</p>
            <p className="mt-2 text-3xl font-semibold">{memberAnalytics?.totalMembers ?? 0}</p>
            <p className="mt-1 text-sm text-muted">
              {memberAnalytics?.activeMembers ?? 0} active · {memberAnalytics?.newMembers ?? 0} new in 90d
            </p>
          </Card>
          <Card className="ff-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Giving records</p>
            <p className="mt-2 text-3xl font-semibold">{financeSummary.donationCount}</p>
            <p className="mt-1 text-sm text-muted">
              Amount tracked: {financeSummary.donationAmount.toLocaleString()} · Expenses: {financeSummary.expenseCount}
            </p>
          </Card>
          <Card className="ff-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Readiness</p>
            <p className="mt-2 text-3xl font-semibold">{readinessPct}%</p>
            <p className="mt-1 text-sm text-muted">
              {checklistSummary.ok} OK · {checklistSummary.warn} warn · {checklistSummary.missing} missing
            </p>
          </Card>
          <Card className="ff-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Upcoming events</p>
            <p className="mt-2 text-3xl font-semibold">{recentEvents?.length ?? 0}</p>
            <p className="mt-1 text-sm text-muted">Latest ministry schedule and attendance surface</p>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <Card className="ff-surface p-6">
            <h2 className="font-display text-xl font-semibold">Organizations</h2>
            <p className="mt-1 text-sm text-muted">Each tenant can run one or more church organizations.</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {organizations?.map((org) => (
                <button
                  key={org.id}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    (organizationId ?? organizations?.[0]?.id) === org.id
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border bg-white text-muted hover:text-foreground'
                  }`}
                  onClick={() => setOrganizationId(org.id)}
                  type="button"
                >
                  {org.name}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Organization name *</label>
                <Input
                  placeholder="Organization name"
                  value={orgName}
                  onChange={(event) => {
                    setOrgError(null);
                    setOrgName(event.target.value);
                  }}
                />
              </div>
              <Button
                className="self-end"
                onClick={() => {
                  if (!orgName.trim()) {
                    setOrgError('Organization name is required.');
                    return;
                  }
                  createOrganization({ name: orgName.trim() });
                }}
                disabled={!orgName || isCreatingOrg}
              >
                {isCreatingOrg ? 'Creating...' : 'Create organization'}
              </Button>
            </div>
            {orgError ? <p className="mt-2 text-xs text-destructive">{orgError}</p> : null}
          </Card>

          <Card className="ff-surface p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-semibold">Go-live checklist</h2>
              <Link href="/operations/health" className="text-sm font-medium text-primary hover:underline">
                Open full view
              </Link>
            </div>
            <p className="mt-1 text-sm text-muted">Configuration checks for alpha and beta readiness.</p>

            <div className="mt-4 space-y-2">
              {checklistSummary.items.slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                      item.status === 'OK'
                        ? 'bg-emerald-100 text-emerald-700'
                        : item.status === 'WARN'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
              {checklistSummary.items.length === 0 ? (
                <p className="text-sm text-muted">No checklist data yet.</p>
              ) : null}
            </div>
          </Card>
        </div>

        <Card className="ff-surface p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-semibold">Churches</h2>
              <p className="mt-1 text-sm text-muted">Create churches under the selected organization and keep geo metadata accurate.</p>
            </div>
            <div className="text-xs text-muted">
              {churches?.length ?? 0} church{(churches?.length ?? 0) === 1 ? '' : 'es'} in this organization
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {churches?.map((church) => (
              <button
                key={church.id}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  (selectedChurchId ?? churches?.[0]?.id) === church.id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-white text-muted hover:text-foreground'
                }`}
                onClick={() => {
                  setSelectedChurchId(church.id);
                  setUpdateCountry(church.countryCode ?? '');
                }}
                type="button"
              >
                {church.name}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Church name *</label>
              <Input
                placeholder="Church name"
                value={churchName}
                onChange={(event) => {
                  setChurchError(null);
                  setChurchName(event.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Slug *</label>
              <Input
                placeholder="faith-center-main"
                value={churchSlug}
                onChange={(event) => {
                  setChurchError(null);
                  setChurchSlug(event.target.value.toLowerCase().replace(/\s+/g, '-'));
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Country (ISO 2) *</label>
              <Input
                placeholder="US"
                value={churchCountry}
                onChange={(event) => {
                  setChurchError(null);
                  setChurchCountry(event.target.value.toUpperCase());
                }}
              />
            </div>
            <Button
              className="self-end"
              onClick={() => {
                const name = churchName.trim();
                const slug = churchSlug.trim();
                const country = churchCountry.trim().toUpperCase();
                if (!name || !slug || !selectedOrg) {
                  setChurchError('Church name, slug, and organization are required.');
                  return;
                }
                if (!slugRegex.test(slug)) {
                  setChurchError('Slug must use lowercase letters, numbers, and hyphens only.');
                  return;
                }
                if (country && !countryRegex.test(country)) {
                  setChurchError('Country must be a valid 2-letter ISO code.');
                  return;
                }
                createChurch({
                  name,
                  slug,
                  organizationId: selectedOrg,
                  countryCode: country || undefined,
                });
              }}
              disabled={!churchName || !churchSlug || !selectedOrg || isCreatingChurch}
            >
              {isCreatingChurch ? 'Creating...' : 'Create church'}
            </Button>
          </div>
          {churchError ? <p className="mt-2 text-xs text-destructive">{churchError}</p> : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Update country (ISO 2) *</label>
              <Input
                placeholder="US"
                value={updateCountry}
                onChange={(event) => {
                  setUpdateError(null);
                  setUpdateCountry(event.target.value.toUpperCase());
                }}
              />
            </div>
            <Button
              variant="outline"
              className="self-end"
              onClick={() => {
                const country = updateCountry.trim().toUpperCase();
                if (!selectedChurchId) {
                  setUpdateError('Select a church first.');
                  return;
                }
                if (country && !countryRegex.test(country)) {
                  setUpdateError('Country must be a valid 2-letter ISO code.');
                  return;
                }
                updateChurch({
                  id: selectedChurchId,
                  countryCode: country || undefined,
                });
              }}
              disabled={!selectedChurchId || isUpdatingChurch}
            >
              {isUpdatingChurch ? 'Updating...' : 'Update country'}
            </Button>
          </div>
          {updateError ? <p className="mt-2 text-xs text-destructive">{updateError}</p> : null}
        </Card>

        <Card className="ff-surface p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">Recent events</h2>
            <Link href="/events" className="text-sm font-medium text-primary hover:underline">
              Manage events
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {recentEvents?.map((event) => (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{event.title}</p>
                  <p className="text-xs text-muted">
                    {event.type} · {event.format}
                  </p>
                </div>
                <p className="text-xs text-muted">{formatWhen(event.startAt)}</p>
              </div>
            ))}
            {!recentEvents?.length ? <p className="text-sm text-muted">No events yet. Create your first event to begin scheduling.</p> : null}
          </div>
        </Card>
      </div>
    </Shell>
  );
}
