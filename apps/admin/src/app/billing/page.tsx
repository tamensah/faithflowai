'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, Card } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { trpc } from '../../lib/trpc';

const checkoutProviders = ['STRIPE', 'PAYSTACK'] as const;

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

export default function BillingPage() {
  const utils = trpc.useUtils();
  const [provider, setProvider] = useState<(typeof checkoutProviders)[number]>('STRIPE');
  const [selectedPlanCode, setSelectedPlanCode] = useState('');

  const { data: plans } = trpc.billing.plans.useQuery();
  const { data: current } = trpc.billing.currentSubscription.useQuery();
  const { data: entitlementsStatus } = trpc.billing.entitlements.useQuery();
  const { data: invoices } = trpc.billing.invoices.useQuery({ provider, limit: 20 });

  const selectedPlan = useMemo(
    () => plans?.find((plan) => plan.code === selectedPlanCode) ?? null,
    [plans, selectedPlanCode]
  );

  const { mutate: startCheckout, isPending: isStartingCheckout } = trpc.billing.startCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    },
  });

  const { mutate: createPortalSession, isPending: isOpeningPortal } = trpc.billing.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const lockedModules = useMemo(() => {
    const ent = entitlementsStatus?.entitlements?.entitlements ?? {};
    const keys = ['membership_enabled', 'events_enabled', 'finance_enabled', 'communications_enabled', 'support_center_enabled'];
    return keys
      .filter((key) => Boolean(ent[key]))
      .map((key) => ({ key, enabled: Boolean(ent[key]?.enabled) }))
      .filter((entry) => entry.enabled === false);
  }, [entitlementsStatus?.entitlements?.entitlements]);

  return (
    <Shell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Billing</h1>
          <p className="mt-2 text-sm text-muted">Self-serve subscription upgrades, payment method updates, and invoice visibility.</p>
        </div>

        {entitlementsStatus?.entitlements?.source === 'inactive_subscription' ? (
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

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Current Subscription</h2>
          {current ? (
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
                  onClick={() => createPortalSession({})}
                  disabled={isOpeningPortal || current.provider !== 'STRIPE'}
                >
                  {current.provider !== 'STRIPE'
                    ? 'Stripe portal unavailable'
                    : isOpeningPortal
                      ? 'Opening...'
                      : 'Open Stripe billing portal'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">No active subscription found.</p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Change Plan</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={selectedPlanCode}
              onChange={(event) => setSelectedPlanCode(event.target.value)}
            >
              <option value="">Select plan</option>
              {plans?.map((plan) => (
                <option key={plan.id} value={plan.code}>
                  {plan.name} ({plan.code})
                </option>
              ))}
            </select>
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
          </div>
            {selectedPlan ? (
            <p className="mt-3 text-sm text-muted">
              {selectedPlan.description || 'No description'} ·{' '}
              {formatPlanPrice(selectedPlan.amountMinor, selectedPlan.currency, selectedPlan.interval)}
              {getTrialDays(selectedPlan.metadata) ? ` · ${getTrialDays(selectedPlan.metadata)}-day free trial` : ''}
            </p>
          ) : null}
          <div className="mt-4">
            <Button
              disabled={!selectedPlanCode || isStartingCheckout || (Boolean(current) && provider === 'STRIPE')}
              onClick={() => startCheckout({ planCode: selectedPlanCode, provider })}
            >
              {Boolean(current) && provider === 'STRIPE'
                ? 'Use Stripe portal to change plan'
                : isStartingCheckout
                  ? 'Redirecting...'
                  : 'Continue to checkout'}
            </Button>
            {Boolean(current) && provider === 'STRIPE' ? (
              <p className="mt-2 text-xs text-muted">
                For existing Stripe subscriptions, use the Stripe billing portal to avoid duplicate subscriptions.
              </p>
            ) : null}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Invoices</h2>
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
      </div>
    </Shell>
  );
}
