'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { PageSectionLayout } from '../../components/PageSectionLayout';
import { trpc } from '../../lib/trpc';

const checkoutProviders = ['STRIPE', 'PAYSTACK'] as const;
const changeEffectiveOptions = ['NEXT_CYCLE', 'IMMEDIATE'] as const;
const billingSectionOptions = [
  { key: 'overview', label: 'Overview' },
  { key: 'plan-change', label: 'Plan change' },
  { key: 'invoices', label: 'Invoices' },
] as const;
type BillingSectionKey = (typeof billingSectionOptions)[number]['key'];
type PlanChangeKind = 'UPGRADE' | 'DOWNGRADE' | 'LATERAL';

function formatPlanPrice(amountMinor: number, currency: string, interval: string) {
  return `${currency} ${(amountMinor / 100).toFixed(2)} / ${interval.toLowerCase()}`;
}

function getTrialDays(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, unknown>).trialDays;
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) return raw;
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function formatTrialDaysLeft(value?: string | Date | null) {
  if (!value) return null;
  const end = typeof value === 'string' ? new Date(value) : value;
  const diffMs = end.getTime() - Date.now();
  const days = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  return `${days} day${days === 1 ? '' : 's'} left`;
}

function classifyPlanChange(
  current?: { amountMinor?: number | null; interval?: string | null } | null,
  target?: { amountMinor?: number | null; interval?: string | null } | null
) {
  if (
    !current ||
    !target ||
    typeof current.amountMinor !== 'number' ||
    typeof target.amountMinor !== 'number' ||
    !current.interval ||
    !target.interval
  ) {
    return null;
  }
  if (target.amountMinor > current.amountMinor) return 'UPGRADE' as const;
  if (target.amountMinor < current.amountMinor) return 'DOWNGRADE' as const;
  if (target.interval !== current.interval) return 'LATERAL' as const;
  return 'LATERAL' as const;
}

export default function BillingPage() {
  const utils = trpc.useUtils();
  const [provider, setProvider] = useState<(typeof checkoutProviders)[number]>('STRIPE');
  const [selectedPlanCode, setSelectedPlanCode] = useState('');
  const [effective, setEffective] = useState<(typeof changeEffectiveOptions)[number]>('NEXT_CYCLE');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [checkoutReferenceHandled, setCheckoutReferenceHandled] = useState(false);
  const [activeSection, setActiveSection] = useState<BillingSectionKey>('overview');

  const { data: plans, isLoading: isLoadingPlans } = trpc.billing.plans.useQuery();
  const { data: current, isLoading: isLoadingCurrent } = trpc.billing.currentSubscription.useQuery();
  const { data: entitlementsStatus } = trpc.billing.entitlements.useQuery();
  const { data: invoices, isLoading: isLoadingInvoices } = trpc.billing.invoices.useQuery({ provider, limit: 20 });

  useEffect(() => {
    if (!current?.provider) return;
    if (current.provider === 'STRIPE' || current.provider === 'PAYSTACK') {
      setProvider(current.provider);
    }
  }, [current?.provider]);

  const selectedPlan = useMemo(
    () => plans?.find((plan) => plan.code === selectedPlanCode) ?? null,
    [plans, selectedPlanCode]
  );

  const { mutate: startCheckout, isPending: isStartingCheckout } = trpc.billing.startCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    },
  });

  const { mutate: changePlan, isPending: isChangingPlan } = trpc.billing.changePlan.useMutation({
    onSuccess: async (data) => {
      if (data?.noop) {
        setActionMessage(data.message ?? 'No changes applied.');
        return;
      }
      if (data?.mode === 'checkout' && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      if (data?.mode === 'scheduled') {
        setActionMessage(`Plan change scheduled for ${data.effectiveAt ? new Date(data.effectiveAt).toLocaleString() : 'next cycle'}.`);
      } else {
        setActionMessage('Plan updated.');
      }
      await Promise.all([utils.billing.currentSubscription.invalidate(), utils.billing.entitlements.invalidate()]);
    },
    onError: (error) => setActionMessage(error.message),
  });

  const { mutate: createPortalSession, isPending: isOpeningPortal } = trpc.billing.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const { mutate: cancelSubscription, isPending: isCanceling } = trpc.billing.cancelSubscription.useMutation({
    onSuccess: async () => {
      setActionMessage('Cancellation requested.');
      await Promise.all([utils.billing.currentSubscription.invalidate(), utils.billing.entitlements.invalidate()]);
    },
    onError: (error) => setActionMessage(error.message),
  });

  const { mutate: resumeSubscription, isPending: isResuming } = trpc.billing.resumeSubscription.useMutation({
    onSuccess: async () => {
      setActionMessage('Subscription resumed.');
      await Promise.all([utils.billing.currentSubscription.invalidate(), utils.billing.entitlements.invalidate()]);
    },
    onError: (error) => setActionMessage(error.message),
  });

  const { mutate: refreshCurrentSubscription, isPending: isRefreshingSubscription } =
    trpc.billing.refreshCurrentSubscription.useMutation({
      onSuccess: async (data) => {
        setActionMessage(`Provider state refreshed (${data.provider} · ${data.status}).`);
        await Promise.all([
          utils.billing.currentSubscription.invalidate(),
          utils.billing.entitlements.invalidate(),
          utils.billing.invoices.invalidate({ provider, limit: 20 }),
        ]);
      },
      onError: (error) => setActionMessage(error.message),
    });

  const { mutate: verifyPaystackCheckout, isPending: isVerifyingPaystackCheckout } =
    trpc.billing.verifyPaystackCheckout.useMutation({
      onSuccess: async (data) => {
        setProvider('PAYSTACK');
        setActionMessage(`Paystack checkout verified (${data.status}).`);
        await Promise.all([
          utils.billing.currentSubscription.invalidate(),
          utils.billing.entitlements.invalidate(),
          utils.billing.invoices.invalidate({ provider: 'PAYSTACK', limit: 20 }),
        ]);
      },
      onError: (error) => setActionMessage(error.message),
    });

  useEffect(() => {
    if (checkoutReferenceHandled || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const status = (url.searchParams.get('status') ?? '').toLowerCase();
    const reference = url.searchParams.get('reference') ?? url.searchParams.get('trxref');
    setCheckoutReferenceHandled(true);
    if (!reference || status === 'cancel') return;
    verifyPaystackCheckout({ reference });
    url.searchParams.delete('reference');
    url.searchParams.delete('trxref');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [checkoutReferenceHandled, verifyPaystackCheckout]);

  const lockedModules = useMemo(() => {
    const ent = entitlementsStatus?.entitlements?.entitlements ?? {};
    const keys = ['membership_enabled', 'events_enabled', 'finance_enabled', 'communications_enabled', 'support_center_enabled'];
    return keys
      .map((key) => ({ key, enabled: ent[key]?.enabled ?? true }))
      .filter((entry) => entry.enabled === false);
  }, [entitlementsStatus?.entitlements?.entitlements]);

  const selectedPlanIsUpgrade = useMemo(() => {
    if (!selectedPlan || !current) return false;
    return selectedPlan.amountMinor > current.plan.amountMinor;
  }, [current, selectedPlan]);
  const selectedPlanChangeKind = useMemo<PlanChangeKind | null>(
    () => classifyPlanChange(current?.plan ?? null, selectedPlan),
    [current?.plan, selectedPlan]
  );
  const paystackDisableReady = useMemo(() => {
    const metadata = current?.metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return Boolean(current?.providerRef && /^SUB_[A-Za-z0-9]+$/.test(current.providerRef));
    }
    const record = metadata as Record<string, unknown>;
    const subscriptionCode =
      typeof record.paystackSubscriptionCode === 'string' ? record.paystackSubscriptionCode : null;
    const emailToken = typeof record.paystackEmailToken === 'string' ? record.paystackEmailToken : null;
    return Boolean(
      (subscriptionCode && emailToken) || (current?.providerRef && /^SUB_[A-Za-z0-9]+$/.test(current.providerRef))
    );
  }, [current?.metadata, current?.providerRef]);
  const selectedPlanGuidance = useMemo(() => {
    if (!current || !selectedPlanChangeKind) return null;
    if (current.provider === 'STRIPE') {
      if (selectedPlanChangeKind === 'UPGRADE') {
        return effective === 'IMMEDIATE'
          ? 'Stripe will switch the tenant immediately and start a fresh billing cycle now.'
          : 'Stripe will keep the current plan active until the next billing cycle, then move to the selected tier.';
      }
      return 'Downgrades and lateral Stripe changes are scheduled for the next billing cycle to avoid proration ambiguity.';
    }
    if (current.provider === 'PAYSTACK') {
      if (selectedPlanChangeKind === 'UPGRADE') {
        return paystackDisableReady
          ? 'Paystack upgrades open a new checkout immediately. FaithFlow can disable the older Paystack subscription after the replacement activates.'
          : 'Paystack upgrades open a new checkout immediately. If current subscription tokens are missing, finance ops may need to cancel the older Paystack subscription manually.';
      }
      return paystackDisableReady
        ? 'For downgrades or lateral changes, complete checkout close to renewal time to minimize overlap. FaithFlow can disable the older subscription after the new one activates.'
        : 'For downgrades or lateral changes, complete checkout close to renewal time to minimize overlap. Manual Paystack dashboard cancellation may still be required.';
    }
    return null;
  }, [current, effective, paystackDisableReady, selectedPlanChangeKind]);

  return (
    <Shell>
      <PageSectionLayout rootId="billing-page-sections" title="Billing sections" className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Billing</h1>
          <p className="mt-2 text-sm text-muted">Self-serve subscription upgrades, payment method updates, and invoice visibility.</p>
        </div>

        {actionMessage ? (
          <Card className="border-border bg-white p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <p>{actionMessage}</p>
              <button
                className="text-xs text-muted underline-offset-4 hover:underline"
                onClick={() => setActionMessage(null)}
                type="button"
              >
                Dismiss
              </button>
            </div>
          </Card>
        ) : null}

        <Card className="p-4">
          <h2 className="text-base font-semibold">Billing workspace</h2>
          <p className="mt-1 text-xs text-muted">Use focused tabs to manage billing without one long page.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {billingSectionOptions.map((section) => (
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

        {activeSection === 'overview' && entitlementsStatus?.entitlements?.source === 'inactive_subscription' ? (
          <Card className="border-destructive/30 bg-white p-6">
            <h2 className="text-lg font-semibold">Subscription inactive</h2>
            <p className="mt-2 text-sm text-muted">
              This tenant has a previous subscription but no active billing right now. Choose a plan below to restore access.
            </p>
            {lockedModules.length ? (
              <div className="mt-3 text-sm text-muted">
                Locked modules:{' '}
                <span className="text-foreground">
                  {lockedModules
                    .map((entry) => entry.key.replace(/_enabled$/, '').replace(/_/g, ' '))
                    .join(', ')}
                </span>
              </div>
            ) : null}
          </Card>
        ) : null}

        {activeSection === 'overview' ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Current Subscription</h2>
          {isLoadingCurrent ? (
            <p className="mt-4 text-sm text-muted">Loading subscription...</p>
          ) : current ? (
            <div className="mt-4 space-y-2 text-sm">
              <p>
                <span className="font-medium">{current.plan.name}</span> ({current.plan.code})
              </p>
              <p className="text-muted">
                {current.status} · {current.provider}
              </p>
              {current.status === 'TRIALING' ? (
                <p className="text-muted">
                  Trial: {formatTrialDaysLeft(current.trialEndsAt) ?? 'active'}
                </p>
              ) : null}
              <p className="text-muted">
                Current period end:{' '}
                {current.currentPeriodEnd ? new Date(current.currentPeriodEnd).toLocaleDateString() : 'N/A'}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isRefreshingSubscription || isVerifyingPaystackCheckout}
                  onClick={() => refreshCurrentSubscription()}
                >
                  {isRefreshingSubscription ? 'Refreshing...' : 'Refresh provider status'}
                </Button>
                <Button
                  size="sm"
                  onClick={() => createPortalSession({})}
                  disabled={isOpeningPortal || current.provider !== 'STRIPE'}
                >
                  {current.provider !== 'STRIPE'
                    ? 'Stripe portal unavailable'
                    : isOpeningPortal
                      ? 'Opening...'
                      : 'Open Stripe billing portal'}
                </Button>
                {current.provider === 'STRIPE' ? (
                  current.cancelAtPeriodEnd ? (
                    <Button size="sm" variant="outline" disabled={isResuming} onClick={() => resumeSubscription()}>
                      {isResuming ? 'Resuming...' : 'Resume'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isCanceling}
                      onClick={() => cancelSubscription({ atPeriodEnd: true })}
                    >
                      {isCanceling ? 'Canceling...' : 'Cancel at period end'}
                    </Button>
                  )
                ) : current.provider === 'PAYSTACK' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isCanceling}
                    onClick={() => cancelSubscription({ atPeriodEnd: false })}
                  >
                    {isCanceling ? 'Canceling...' : 'Cancel Paystack subscription'}
                  </Button>
                ) : null}
              </div>
              {current.provider === 'PAYSTACK' ? (
                <p className="mt-2 text-xs text-muted">
                  Paystack cancellation requires Paystack to have issued a subscription. If this button fails, cancel the
                  subscription from your Paystack dashboard, then refresh this page.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">No active subscription found.</p>
          )}
        </Card>
        ) : null}

        {activeSection === 'plan-change' ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Change Plan</h2>
          <p className="mt-1 text-xs text-muted">Required fields are marked with *.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={selectedPlanCode}
              onChange={(event) => setSelectedPlanCode(event.target.value)}
            >
              <option value="">{isLoadingPlans ? 'Loading plans...' : 'Select plan *'}</option>
              {plans?.map((plan) => (
                <option key={plan.id} value={plan.code}>
                  {plan.name} ({plan.code})
                </option>
              ))}
            </select>
            {current ? (
              current.provider === 'STRIPE' ? (
                <select
                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  value={effective}
                  onChange={(event) => setEffective(event.target.value as (typeof changeEffectiveOptions)[number])}
                >
                  <option value="NEXT_CYCLE">Effective next cycle</option>
                  <option value="IMMEDIATE" disabled={!selectedPlanIsUpgrade}>
                    Immediate (upgrade only)
                  </option>
                </select>
              ) : (
                <div className="flex h-10 items-center rounded-md border border-border bg-white px-3 text-sm text-muted">
                  Paystack change via checkout
                </div>
              )
            ) : (
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={provider}
                onChange={(event) => setProvider(event.target.value as (typeof checkoutProviders)[number])}
              >
                {checkoutProviders.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            )}
          </div>
          {selectedPlan ? (
            <p className="mt-3 text-sm text-muted">
              {selectedPlan.description || 'No description'} ·{' '}
              {formatPlanPrice(selectedPlan.amountMinor, selectedPlan.currency, selectedPlan.interval)}
              {getTrialDays(selectedPlan.metadata) ? ` · ${getTrialDays(selectedPlan.metadata)}-day free trial` : ''}
            </p>
          ) : null}
          {current && selectedPlan && selectedPlanChangeKind ? (
            <div className="mt-4 rounded-lg border border-border bg-muted/10 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">Transition:</span>
                <Badge variant={selectedPlanChangeKind === 'UPGRADE' ? 'success' : 'default'}>
                  {selectedPlanChangeKind.toLowerCase()}
                </Badge>
                <span className="text-muted">
                  {current.plan.name} ({current.plan.interval.toLowerCase()}) to {selectedPlan.name} (
                  {selectedPlan.interval.toLowerCase()})
                </span>
              </div>
              {selectedPlanGuidance ? <p className="mt-2 text-muted">{selectedPlanGuidance}</p> : null}
              {current.provider === 'PAYSTACK' ? (
                <p className="mt-2 text-xs text-muted">
                  Auto-disable path: {paystackDisableReady ? 'ready from current subscription metadata' : 'manual dashboard fallback may be required'}
                  {current.currentPeriodEnd ? ` · current cycle ends ${new Date(current.currentPeriodEnd).toLocaleString()}` : ''}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="mt-4">
            <Button
              disabled={!selectedPlanCode || isStartingCheckout || isChangingPlan}
              onClick={() => {
                if (current) {
                  changePlan({
                    planCode: selectedPlanCode,
                    effective: current.provider === 'STRIPE' ? effective : 'NEXT_CYCLE',
                  });
                } else {
                  startCheckout({ planCode: selectedPlanCode, provider });
                }
              }}
            >
              {current
                ? isChangingPlan
                  ? 'Applying...'
                  : current.provider === 'STRIPE'
                    ? effective === 'NEXT_CYCLE'
                      ? 'Schedule plan change'
                      : 'Upgrade now'
                    : 'Continue to Paystack checkout'
                : isStartingCheckout
                  ? 'Redirecting...'
                  : 'Continue to checkout'}
            </Button>
            {current?.provider === 'PAYSTACK' ? (
              <p className="mt-2 text-xs text-muted">
                Paystack tier changes start a new checkout. After the new subscription activates, FaithFlow will attempt
                to disable the previous Paystack subscription when subscription tokens are available; otherwise finance
                ops must cancel it in Paystack.
              </p>
            ) : null}
          </div>
        </Card>
        ) : null}

        {activeSection === 'invoices' ? (
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Invoices</h2>
              <select
                className="h-8 rounded-md border border-border bg-white px-2 text-xs"
                value={provider}
                onChange={(event) => setProvider(event.target.value as (typeof checkoutProviders)[number])}
              >
                {checkoutProviders.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await utils.billing.invoices.invalidate({ provider, limit: 20 });
              }}
            >
              Refresh
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {isLoadingInvoices ? <p className="text-sm text-muted">Loading invoices...</p> : null}
            {invoices?.invoices.map((invoice) => (
              <div key={invoice.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{invoice.number || invoice.id}</p>
                  <Badge variant="default">{invoice.status || 'unknown'}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {invoice.currency} {(invoice.amountPaid / 100).toFixed(2)} paid / {(invoice.amountDue / 100).toFixed(2)} due
                </p>
                <p className="text-xs text-muted">
                  Created: {invoice.createdAt ? new Date(invoice.createdAt).toLocaleString() : 'N/A'}
                </p>
                {invoice.hostedInvoiceUrl ? (
                  <a
                    className="mt-2 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
                    href={invoice.hostedInvoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open invoice
                  </a>
                ) : null}
              </div>
            ))}
            {!invoices?.invoices.length ? <p className="text-sm text-muted">No invoices available.</p> : null}
          </div>
        </Card>
        ) : null}
      </PageSectionLayout>
    </Shell>
  );
}
