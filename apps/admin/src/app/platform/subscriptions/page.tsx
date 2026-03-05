'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../../components/Shell';
import { PageSectionLayout } from '../../../components/PageSectionLayout';
import { trpc } from '../../../lib/trpc';
import { useWriteAccess } from '../../../lib/entitlements';
import { ReadOnlyNotice } from '../../../components/ReadOnlyNotice';

const intervalOptions = ['MONTHLY', 'YEARLY', 'CUSTOM'] as const;
const subscriptionStatusOptions = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELED', 'EXPIRED'] as const;
const providerOptions = ['MANUAL', 'STRIPE', 'PAYSTACK'] as const;
const sectionOptions = [
  { key: 'plan-form', label: 'Plan editor' },
  { key: 'assign-plan', label: 'Tenant assignment' },
  { key: 'dunning', label: 'Dunning' },
  { key: 'metadata', label: 'Provider metadata' },
  { key: 'catalog', label: 'Plan catalog' },
  { key: 'snapshot', label: 'Tenant snapshot' },
] as const;
type SectionKey = (typeof sectionOptions)[number]['key'];

type ParsedFeature = { key: string; enabled: boolean; limit?: number | null };

function parseFeaturesInput(raw: string): ParsedFeature[] {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const features: ParsedFeature[] = [];
  for (const line of lines) {
    const [keyRaw, enabledRaw, limitRaw] = line.split(',').map((part) => part.trim());
    if (!keyRaw) continue;
    const enabled =
      enabledRaw === undefined || enabledRaw === ''
        ? true
        : ['1', 'true', 'yes', 'on'].includes(enabledRaw.toLowerCase());
    const limit =
      limitRaw === undefined || limitRaw === ''
        ? undefined
        : limitRaw.toLowerCase() === 'null'
          ? null
          : Number.isFinite(Number(limitRaw))
            ? Number(limitRaw)
            : undefined;
    features.push({ key: keyRaw, enabled, limit });
  }
  return features;
}

function formatCurrencyMinor(amountMinor: number, currency: string) {
  return `${currency} ${(amountMinor / 100).toFixed(2)}`;
}

function getTrialDays(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, unknown>).trialDays;
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0) return raw;
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

export default function PlatformSubscriptionsPage() {
  const writeGate = useWriteAccess();
  const utils = trpc.useUtils();
  const canWrite = writeGate.canWrite;
  const { data: platformSelf } = trpc.platform.self.useQuery();
  const { data: plans, isLoading: isLoadingPlans } = trpc.platform.listPlans.useQuery(
    { includeInactive: true },
    { enabled: Boolean(platformSelf?.platformUser) }
  );
  const { data: tenants, isLoading: isLoadingTenants } = trpc.platform.listTenants.useQuery(
    { limit: 100 },
    { enabled: Boolean(platformSelf?.platformUser) }
  );
  const [activeSection, setActiveSection] = useState<SectionKey>('plan-form');

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [interval, setInterval] = useState<(typeof intervalOptions)[number]>('MONTHLY');
  const [amountMinor, setAmountMinor] = useState('4900');
  const [trialDays, setTrialDays] = useState('14');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [featuresRaw, setFeaturesRaw] = useState('max_members,true,500\nmax_campuses,true,1\nai_insights,false,');

  const [tenantId, setTenantId] = useState('');
  const [planCode, setPlanCode] = useState('');
  const [status, setStatus] = useState<(typeof subscriptionStatusOptions)[number]>('TRIALING');
  const [provider, setProvider] = useState<(typeof providerOptions)[number]>('MANUAL');
  const [seatCount, setSeatCount] = useState('');
  const [reason, setReason] = useState('');
  const [dunningGraceDays, setDunningGraceDays] = useState('3');
  const [dunningLimit, setDunningLimit] = useState('200');
  const [metadataBackfillLimit, setMetadataBackfillLimit] = useState('250');
  const [planFormStatus, setPlanFormStatus] = useState('');
  const [assignmentStatus, setAssignmentStatus] = useState('');
  const [dunningStatus, setDunningStatus] = useState('');
  const [backfillStatus, setBackfillStatus] = useState('');

  const tenantOptions = useMemo(() => tenants ?? [], [tenants]);
  const dunningInput = useMemo(
    () => ({
      graceDays: Number.isFinite(Number(dunningGraceDays)) ? Number(dunningGraceDays) : 3,
      limit: Number.isFinite(Number(dunningLimit)) ? Number(dunningLimit) : 200,
    }),
    [dunningGraceDays, dunningLimit]
  );

  const { data: dunningPreview } = trpc.platform.dunningPreview.useQuery(dunningInput, {
    enabled: Boolean(platformSelf?.platformUser),
  });

  const { mutate: upsertPlan, isPending: isSavingPlan } = trpc.platform.upsertPlan.useMutation({
    onSuccess: async () => {
      setPlanFormStatus('Plan saved.');
      await utils.platform.listPlans.invalidate();
      setCode('');
      setName('');
      setDescription('');
      setCurrency('USD');
      setInterval('MONTHLY');
      setAmountMinor('4900');
      setTrialDays('14');
      setIsDefault(false);
      setIsActive(true);
      setFeaturesRaw('max_members,true,500\nmax_campuses,true,1\nai_insights,false,');
    },
    onError: (error) => setPlanFormStatus(error.message),
  });

  const { mutate: assignTenantPlan, isPending: isAssigningPlan } = trpc.platform.assignTenantPlan.useMutation({
    onSuccess: async () => {
      setAssignmentStatus('Tenant plan updated.');
      await Promise.all([utils.platform.listTenants.invalidate(), utils.platform.tenantSubscription.invalidate()]);
    },
    onError: (error) => setAssignmentStatus(error.message),
  });

  const { mutate: runDunning, isPending: isRunningDunning } = trpc.platform.runDunning.useMutation({
    onSuccess: async () => {
      setDunningStatus('Dunning run queued.');
      await Promise.all([utils.platform.dunningPreview.invalidate(), utils.platform.listTenants.invalidate()]);
    },
    onError: (error) => setDunningStatus(error.message),
  });
  const { mutate: runMetadataBackfill, data: metadataBackfillResult, isPending: isRunningMetadataBackfill } =
    trpc.platform.subscriptionMetadataBackfill.useMutation({
      onSuccess: async () => {
        setBackfillStatus('Metadata normalization completed.');
        await utils.platform.listTenants.invalidate();
      },
      onError: (error) => setBackfillStatus(error.message),
    });

  const handleSavePlan = () => {
    const amount = Number(amountMinor);
    if (!code.trim() || !name.trim()) {
      setPlanFormStatus('Plan code and plan name are required.');
      return;
    }
    if (!currency.trim() || currency.trim().length !== 3) {
      setPlanFormStatus('Currency must be a valid 3-letter code.');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setPlanFormStatus('Amount must be zero or greater.');
      return;
    }

    setPlanFormStatus('');
    upsertPlan({
      code: code.trim(),
      name: name.trim(),
      description: description.trim() || undefined,
      currency: currency.trim() || 'USD',
      interval,
      amountMinor: amount,
      metadata: {
        trialDays: Number.isFinite(Number(trialDays)) ? Math.max(0, Number(trialDays)) : 0,
      },
      isDefault,
      isActive,
      features: parseFeaturesInput(featuresRaw),
    });
  };

  const handleAssignPlan = () => {
    if (!tenantId || !planCode) {
      setAssignmentStatus('Tenant and plan are required.');
      return;
    }

    setAssignmentStatus('');
    assignTenantPlan({
      tenantId,
      planCode,
      status,
      provider,
      seatCount: seatCount ? Number(seatCount) : undefined,
      reason: reason.trim() || undefined,
    });
  };

  const handleRunDunning = () => {
    const graceDays = Number(dunningGraceDays);
    const limit = Number(dunningLimit);
    if (!Number.isFinite(graceDays) || graceDays < 1) {
      setDunningStatus('Grace days must be at least 1.');
      return;
    }
    if (!Number.isFinite(limit) || limit < 1) {
      setDunningStatus('Tenant limit must be at least 1.');
      return;
    }

    setDunningStatus('');
    runDunning({ graceDays, limit });
  };

  const handleRunMetadataBackfill = (dryRun: boolean) => {
    const limit = Number(metadataBackfillLimit);
    if (!Number.isFinite(limit) || limit < 1) {
      setBackfillStatus('Scan limit must be at least 1.');
      return;
    }

    setBackfillStatus('');
    runMetadataBackfill({ limit, dryRun });
  };

  if (!platformSelf?.platformUser) {
    return (
      <Shell>
        <Card className="p-6">
          <h1 className="text-xl font-semibold">Platform subscriptions</h1>
          <p className="mt-2 text-sm text-muted">You do not have platform access.</p>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <PageSectionLayout rootId="platform-subscriptions-page-sections" title="Subscriptions sections" className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Platform subscriptions</h1>
          <p className="mt-2 text-sm text-muted">
            Manage the plan catalog, entitlements, and tenant plan assignments.
          </p>
        </div>

        {writeGate.readOnly ? <ReadOnlyNotice /> : null}

        <Card className="p-4">
          <h2 className="text-base font-semibold">Subscription workspace</h2>
          <p className="mt-1 text-xs text-muted">Switch between focused work areas instead of one long page.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {sectionOptions.map((section) => (
              <Button
                key={section.key}
                size="sm"
                variant={activeSection === section.key ? 'default' : 'outline'}
                onClick={() => setActiveSection(section.key)}
              >
                {section.label}
              </Button>
            ))}
          </div>
        </Card>

        {activeSection === 'plan-form' ? (
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Create or update plan</h2>
            <p className="mt-1 text-xs text-muted">Required fields are marked with *.</p>
            <p className="mt-1 text-xs text-muted">Feature format: one line per feature as key,enabled,limit</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input placeholder="Plan code * (starter)" value={code} onChange={(event) => setCode(event.target.value)} />
              <Input placeholder="Plan name *" value={name} onChange={(event) => setName(event.target.value)} />
              <Input placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
              <Input
                placeholder="Currency * (USD)"
                value={currency}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              />
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={interval}
                onChange={(event) => setInterval(event.target.value as (typeof intervalOptions)[number])}
              >
                {intervalOptions.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Amount in minor units *"
                type="number"
                value={amountMinor}
                onChange={(event) => setAmountMinor(event.target.value)}
              />
              <Input
                placeholder="Trial days (0 = none)"
                type="number"
                value={trialDays}
                onChange={(event) => setTrialDays(event.target.value)}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} />
                Default plan
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
                Active
              </label>
            </div>
            <textarea
              className="mt-4 min-h-[120px] w-full rounded-md border border-border px-3 py-2 text-sm"
              value={featuresRaw}
              onChange={(event) => setFeaturesRaw(event.target.value)}
            />
            <div className="mt-4">
              <Button onClick={handleSavePlan} disabled={!canWrite || isSavingPlan}>
                {isSavingPlan ? 'Saving plan...' : 'Save plan'}
              </Button>
            </div>
            {planFormStatus ? <p className="mt-3 text-xs text-muted">{planFormStatus}</p> : null}
          </Card>
        ) : null}

        {activeSection === 'assign-plan' ? (
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Assign plan to tenant</h2>
            <p className="mt-1 text-xs text-muted">Required fields are marked with *.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={tenantId}
                onChange={(event) => setTenantId(event.target.value)}
              >
                <option value="">{isLoadingTenants ? 'Loading tenants...' : 'Select tenant *'}</option>
                {tenantOptions.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.slug})
                  </option>
                ))}
              </select>
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={planCode}
                onChange={(event) => setPlanCode(event.target.value)}
              >
                <option value="">{isLoadingPlans ? 'Loading plans...' : 'Select plan *'}</option>
                {plans?.filter((plan) => plan.isActive).map((plan) => (
                  <option key={plan.id} value={plan.code}>
                    {plan.name} ({plan.code})
                  </option>
                ))}
              </select>
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={status}
                onChange={(event) => setStatus(event.target.value as (typeof subscriptionStatusOptions)[number])}
              >
                {subscriptionStatusOptions.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={provider}
                onChange={(event) => setProvider(event.target.value as (typeof providerOptions)[number])}
              >
                {providerOptions.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Seat count (optional)"
                type="number"
                value={seatCount}
                onChange={(event) => setSeatCount(event.target.value)}
              />
              <Input placeholder="Reason (optional)" value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
            <div className="mt-4">
              <Button onClick={handleAssignPlan} disabled={!canWrite || isAssigningPlan}>
                {isAssigningPlan ? 'Assigning plan...' : 'Assign plan'}
              </Button>
            </div>
            {assignmentStatus ? <p className="mt-3 text-xs text-muted">{assignmentStatus}</p> : null}
          </Card>
        ) : null}

        {activeSection === 'dunning' ? (
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Dunning workflow</h2>
            <p className="mt-1 text-xs text-muted">Queue billing reminders for past-due tenants after a grace period.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Grace days *"
                type="number"
                value={dunningGraceDays}
                onChange={(event) => setDunningGraceDays(event.target.value)}
              />
              <Input
                placeholder="Tenant limit *"
                type="number"
                value={dunningLimit}
                onChange={(event) => setDunningLimit(event.target.value)}
              />
            </div>
            <p className="mt-3 text-xs text-muted">
              Preview: {dunningPreview?.inspected ?? 0} subscriptions · {dunningPreview?.targets.length ?? 0} tenants.
            </p>
            <div className="mt-4">
              <Button onClick={handleRunDunning} disabled={!canWrite || isRunningDunning}>
                {isRunningDunning ? 'Queuing reminders...' : 'Run dunning now'}
              </Button>
            </div>
            {dunningStatus ? <p className="mt-3 text-xs text-muted">{dunningStatus}</p> : null}
          </Card>
        ) : null}

        {activeSection === 'metadata' ? (
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Provider metadata normalization</h2>
            <p className="mt-1 text-xs text-muted">
              Backfill normalized provider references (`stripeCustomerId`, `paystackCustomerCode`, subscription refs).
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Scan limit *"
                type="number"
                value={metadataBackfillLimit}
                onChange={(event) => setMetadataBackfillLimit(event.target.value)}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!canWrite || isRunningMetadataBackfill}
                onClick={() => handleRunMetadataBackfill(true)}
              >
                {isRunningMetadataBackfill ? 'Running...' : 'Preview backfill'}
              </Button>
              <Button disabled={!canWrite || isRunningMetadataBackfill} onClick={() => handleRunMetadataBackfill(false)}>
                {isRunningMetadataBackfill ? 'Running...' : 'Run backfill'}
              </Button>
            </div>
            {metadataBackfillResult ? (
              <p className="mt-3 text-xs text-muted">
                scanned {metadataBackfillResult.scanned} · updated {metadataBackfillResult.updated} · skipped{' '}
                {metadataBackfillResult.skipped} · failed {metadataBackfillResult.failed} · dryRun{' '}
                {String(metadataBackfillResult.dryRun)}
              </p>
            ) : null}
            {backfillStatus ? <p className="mt-1 text-xs text-muted">{backfillStatus}</p> : null}
          </Card>
        ) : null}

        {activeSection === 'catalog' ? (
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Plan catalog</h2>
            <div className="mt-4 space-y-4">
              {isLoadingPlans ? <p className="text-sm text-muted">Loading plan catalog...</p> : null}
              {plans?.map((plan) => (
                <Card key={plan.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        {plan.name} <span className="text-muted">({plan.code})</span>
                      </p>
                      <p className="text-xs text-muted">
                        {formatCurrencyMinor(plan.amountMinor, plan.currency)} / {plan.interval}
                      </p>
                      <p className="text-xs text-muted">
                        Trial: {getTrialDays(plan.metadata) ?? 0} day{(getTrialDays(plan.metadata) ?? 0) === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {plan.isDefault ? <Badge variant="success">DEFAULT</Badge> : null}
                      <Badge variant={plan.isActive ? 'default' : 'warning'}>{plan.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>
                      <Badge variant="default">{plan._count.tenantSubscriptions} assignments</Badge>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {plan.features.map((feature) => (
                      <Badge key={`${plan.id}-${feature.key}`} variant={feature.enabled ? 'default' : 'warning'}>
                        {feature.key}
                        {feature.limit !== null && feature.limit !== undefined ? `:${feature.limit}` : ''}
                      </Badge>
                    ))}
                    {!plan.features.length ? <p className="text-xs text-muted">No features defined</p> : null}
                  </div>
                </Card>
              ))}
              {!isLoadingPlans && !plans?.length ? <p className="text-sm text-muted">No plans found.</p> : null}
            </div>
          </Card>
        ) : null}

        {activeSection === 'snapshot' ? (
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Tenant subscription snapshot</h2>
            <div className="mt-4 space-y-3">
              {isLoadingTenants ? <p className="text-sm text-muted">Loading tenant snapshot...</p> : null}
              {tenantOptions.map((tenant) => (
                <div key={tenant.id} className="rounded-md border border-border p-3">
                  <p className="text-sm font-semibold">{tenant.name}</p>
                  <p className="text-xs text-muted">
                    {tenant.currentSubscription
                      ? `${tenant.currentSubscription.planName} (${tenant.currentSubscription.planCode}) · ${tenant.currentSubscription.status}`
                      : 'No active subscription'}
                  </p>
                </div>
              ))}
              {!isLoadingTenants && !tenantOptions.length ? <p className="text-sm text-muted">No tenants found.</p> : null}
            </div>
          </Card>
        ) : null}
      </PageSectionLayout>
    </Shell>
  );
}
