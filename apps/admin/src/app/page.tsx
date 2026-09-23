'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, Input } from '@faithflow-ai/ui';
import { trpc } from '../lib/trpc';
import { Shell } from '../components/Shell';
import { PageSectionLayout } from '../components/PageSectionLayout';
import { useWriteAccess } from '../lib/entitlements';
import { ReadOnlyNotice } from '../components/ReadOnlyNotice';

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

function slugifyChurchName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

export default function AdminHome() {
  const writeGate = useWriteAccess();
  const utils = trpc.useUtils();
  const canWrite = writeGate.canWrite;
  const [orgName, setOrgName] = useState('');
  const [orgNameDraft, setOrgNameDraft] = useState<{ id: string; name: string } | null>(null);
  const [churchName, setChurchName] = useState('');
  const [churchSlug, setChurchSlug] = useState('');
  const [churchCountry, setChurchCountry] = useState('');
  const [selectedChurchId, setSelectedChurchId] = useState<string | null>(null);
  const [churchDraft, setChurchDraft] = useState<{ id: string; name: string; slug: string; country: string } | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [churchError, setChurchError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const countryRegex = /^[A-Z]{2}$/;

  const { data: organizations } = trpc.organization.list.useQuery();

  const selectedOrganization = organizations?.find((org) => org.id === organizationId) ?? organizations?.[0];
  const updatedOrgName = orgNameDraft && orgNameDraft.id === selectedOrganization?.id ? orgNameDraft.name : selectedOrganization?.name ?? '';

  const { mutate: createOrganization, isPending: isCreatingOrg } = trpc.organization.create.useMutation({
    onSuccess: async (org) => {
      setOrgError(null);
      setOrgName('');
      setOrganizationId(org.id);
      await utils.organization.list.invalidate();
    },
  });

  const { mutate: updateOrganization, isPending: isUpdatingOrg } = trpc.organization.update.useMutation({
    onSuccess: async () => {
      setOrgError(null);
      setOrgNameDraft(null);
      await utils.organization.list.invalidate();
    },
    onError: (error) => setOrgError(error.message),
  });

  const { data: churches } = trpc.church.list.useQuery({
    organizationId: selectedOrganization?.id,
  }, { enabled: Boolean(selectedOrganization?.id) });

  const selectedChurch = churches?.find((church) => church.id === selectedChurchId) ?? churches?.[0];
  const churchForm = churchDraft && churchDraft.id === selectedChurch?.id ? churchDraft : {
    id: selectedChurch?.id ?? '',
    name: selectedChurch?.name ?? '',
    slug: selectedChurch?.slug ?? '',
    country: selectedChurch?.countryCode ?? '',
  };

  const { mutate: createChurch, isPending: isCreatingChurch } = trpc.church.create.useMutation({
    onSuccess: async () => {
      setChurchError(null);
      setChurchName('');
      setChurchSlug('');
      setChurchCountry('');
      await utils.church.list.invalidate();
    },
    onError: (error) => setChurchError(error.message),
  });

  const { mutate: updateChurch, isPending: isUpdatingChurch } = trpc.church.update.useMutation({
    onSuccess: async () => {
      setUpdateError(null);
      setChurchDraft(null);
      await utils.church.list.invalidate();
    },
    onError: (error) => setUpdateError(error.message),
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

  const selectedOrg = selectedOrganization?.id ?? null;
  const suggestedChurchSlug = slugifyChurchName(`${selectedOrganization?.name ?? ''} ${churchForm.name}`);

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
      <PageSectionLayout rootId="overview-page-sections" title="Overview sections" className="space-y-6">
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
              <a
                href={`${(process.env.NEXT_PUBLIC_WEB_URL ?? 'https://churchtrack-web-git-develop-tamensahs-projects.vercel.app').replace(/\/+$/, '')}/guide`}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                  Admin guide ↗
                </Button>
              </a>
            </div>
          </div>
        </Card>

        {writeGate.readOnly ? <ReadOnlyNotice /> : null}

        {(selectedOrganization?.name === 'Default Organization' || selectedChurch?.name === 'Default Church' || (selectedChurch && !selectedChurch.countryCode)) ? (
          <Card className="border-amber-200 bg-amber-50 p-5">
            <h2 className="font-display text-base font-semibold text-amber-900">Finish your church setup</h2>
            <p className="mt-1 text-sm text-amber-800">
              Your workspace is ready. Save your organization and church names in the panels below, review the generated church slug, and set its country. You do not need to create another church.
            </p>
          </Card>
        ) : null}

        {/* First-time setup wizard — shown until a church exists */}
        {churches !== undefined && churches.length === 0 ? (
          <Card className="border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-white">!</span>
              <div className="flex-1">
                <h2 className="font-display text-base font-semibold text-amber-900">Complete your workspace setup</h2>
                <p className="mt-1 text-sm text-amber-800">
                  Your admin account is active. Follow these steps to configure your church and start using all modules.
                </p>
                <ol className="mt-4 space-y-3">
                  {[
                    {
                      n: 1,
                      title: organizations && organizations.length > 0 ? '✓ Create your organization' : 'Create your organization',
                      desc: 'Add your church organization in the panel below. This is the top-level entity that owns your churches.',
                      done: Boolean(organizations && organizations.length > 0),
                      action: null,
                    },
                    {
                      n: 2,
                      title: 'Create your first church',
                      desc: 'Once an organization exists, use the Churches panel below to add your first church with a name, slug, and country.',
                      done: false,
                      action: null,
                    },
                    {
                      n: 3,
                      title: 'Invite your staff team',
                      desc: 'Add staff accounts and assign roles. Staff members sign in to this console.',
                      done: false,
                      action: '/staff',
                    },
                    {
                      n: 4,
                      title: 'Import or add members',
                      desc: 'Upload a CSV or add members individually. Members use the member portal.',
                      done: false,
                      action: '/members',
                    },
                    {
                      n: 5,
                      title: 'Check go-live readiness',
                      desc: 'Run the go-live checklist to verify your configuration before inviting your congregation.',
                      done: false,
                      action: '/operations/health',
                    },
                  ].map((step) => (
                    <li key={step.n} className="flex items-start gap-3">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${step.done ? 'bg-emerald-500 text-white' : 'bg-amber-200 text-amber-800'}`}>
                        {step.done ? '✓' : step.n}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${step.done ? 'text-emerald-700' : 'text-amber-900'}`}>{step.title}</p>
                        <p className="mt-0.5 text-xs text-amber-700">{step.desc}</p>
                        {step.action ? (
                          <Link href={step.action} className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                            Go to {step.title.toLowerCase()} →
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </Card>
        ) : null}

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
            <p className="mt-1 text-sm text-muted">Your first organization is ready. Name it for your church or network; add another only if you run a separate organization.</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {organizations?.map((org) => (
                <button
                  key={org.id}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    selectedOrganization?.id === org.id
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

            {selectedOrganization ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">Selected organization name *</label>
                  <Input
                    value={updatedOrgName}
                    onChange={(event) => {
                      setOrgError(null);
                      setOrgNameDraft({ id: selectedOrganization.id, name: event.target.value });
                    }}
                  />
                </div>
                <Button
                  className="self-end"
                  onClick={() => updateOrganization({ id: selectedOrganization.id, name: updatedOrgName.trim() })}
                  disabled={!canWrite || updatedOrgName.trim().length < 2 || updatedOrgName.trim() === selectedOrganization.name || isUpdatingOrg}
                >
                  {isUpdatingOrg ? 'Saving...' : 'Save name'}
                </Button>
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Another organization name</label>
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
                  if (!canWrite) return;
                  if (!orgName.trim()) {
                    setOrgError('Organization name is required.');
                    return;
                  }
                  createOrganization({ name: orgName.trim() });
                }}
                disabled={!canWrite || !orgName || isCreatingOrg}
              >
                {isCreatingOrg ? 'Creating...' : 'Create organization'}
              </Button>
            </div>
            {orgError ? <p className="mt-2 text-xs text-destructive">{orgError}</p> : null}
            {writeGate.readOnly ? (
              <p className="mt-2 text-xs text-muted">Organization creation is disabled in view-only mode.</p>
            ) : null}
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
              <p className="mt-1 text-sm text-muted">Your first church is ready. Name it, review its generated slug, and set its country before adding members.</p>
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
                  selectedChurch?.id === church.id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-white text-muted hover:text-foreground'
                }`}
                onClick={() => {
                  setSelectedChurchId(church.id);
                  setChurchDraft(null);
                }}
                type="button"
              >
                {church.name}
              </button>
            ))}
          </div>

          {selectedChurch ? <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.5fr)_auto]">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Selected church name *</label>
              <Input value={churchForm.name} onChange={(event) => {
                setUpdateError(null);
                const previousSuggestion = slugifyChurchName(`${selectedOrganization?.name ?? ''} ${churchForm.name}`);
                const keepSuggestedSlug = selectedChurch.name === 'Default Church' &&
                  (churchForm.slug === selectedChurch.slug || churchForm.slug === previousSuggestion);
                setChurchDraft({
                  ...churchForm,
                  name: event.target.value,
                  slug: keepSuggestedSlug
                    ? slugifyChurchName(`${selectedOrganization?.name ?? ''} ${event.target.value}`)
                    : churchForm.slug,
                });
              }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Church slug *</label>
              <Input value={churchForm.slug} onChange={(event) => { setUpdateError(null); setChurchDraft({ ...churchForm, slug: event.target.value.toLowerCase().replace(/\s+/g, '-') }); }} />
              <p className="text-xs text-muted">Suggested from the organization and church names. This value is used in public links.</p>
              {suggestedChurchSlug.length >= 2 && churchForm.slug !== suggestedChurchSlug ? (
                <button
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => { setUpdateError(null); setChurchDraft({ ...churchForm, slug: suggestedChurchSlug }); }}
                  type="button"
                >
                  Use {suggestedChurchSlug}
                </button>
              ) : null}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Country (ISO 2) *</label>
              <Input
                placeholder="GH"
                value={churchForm.country}
                onChange={(event) => {
                  setUpdateError(null);
                  setChurchDraft({ ...churchForm, country: event.target.value.toUpperCase() });
                }}
              />
            </div>
            <Button
              variant="outline"
              className="self-end"
              onClick={() => {
                if (!canWrite) return;
                const country = churchForm.country.trim().toUpperCase();
                if (!selectedChurch) {
                  setUpdateError('Select a church first.');
                  return;
                }
                if (churchForm.name.trim().length < 2) {
                  setUpdateError('Church name must have at least two characters.');
                  return;
                }
                if (!slugRegex.test(churchForm.slug.trim()) || churchForm.slug.trim().length < 2) {
                  setUpdateError('Slug must use lowercase letters, numbers, and hyphens only.');
                  return;
                }
                if (!countryRegex.test(country)) {
                  setUpdateError('Country must be a valid 2-letter ISO code.');
                  return;
                }
                updateChurch({
                  id: selectedChurch.id,
                  name: churchForm.name.trim(),
                  slug: churchForm.slug.trim(),
                  countryCode: country,
                });
              }}
              disabled={!canWrite || isUpdatingChurch || (
                churchForm.name.trim() === selectedChurch.name &&
                churchForm.slug.trim() === selectedChurch.slug &&
                churchForm.country.trim() === (selectedChurch.countryCode ?? '')
              )}
            >
              {isUpdatingChurch ? 'Saving...' : 'Save church'}
            </Button>
          </div> : null}
          {updateError ? <p className="mt-2 text-xs text-destructive">{updateError}</p> : null}
          <h3 className="mt-6 text-sm font-semibold">Add another church</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Church name *</label>
              <Input
                placeholder="Church name"
                value={churchName}
                onChange={(event) => {
                  setChurchError(null);
                  const previousSuggestion = slugifyChurchName(`${selectedOrganization?.name ?? ''} ${churchName}`);
                  const nextSuggestion = slugifyChurchName(`${selectedOrganization?.name ?? ''} ${event.target.value}`);
                  if (!churchSlug || churchSlug === previousSuggestion) setChurchSlug(nextSuggestion);
                  setChurchName(event.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Slug *</label>
              <Input
                placeholder="organisation-branch-name"
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
                placeholder="GH, US, CH…"
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
                if (!canWrite) return;
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
                if (!countryRegex.test(country)) {
                  setChurchError('Country must be a valid 2-letter ISO code.');
                  return;
                }
                createChurch({
                  name,
                  slug,
                  organizationId: selectedOrg,
                  countryCode: country,
                });
              }}
              disabled={!canWrite || !churchName || !churchSlug || !churchCountry || !selectedOrg || isCreatingChurch}
            >
              {isCreatingChurch ? 'Creating...' : 'Create church'}
            </Button>
          </div>
          {churchError ? <p className="mt-2 text-xs text-destructive">{churchError}</p> : null}
          {writeGate.readOnly ? (
            <p className="mt-2 text-xs text-muted">Church setup actions are disabled in view-only mode.</p>
          ) : null}
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
      </PageSectionLayout>
    </Shell>
  );
}
