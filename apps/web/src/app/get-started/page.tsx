'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  OrganizationSwitcher,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  useAuth,
  useUser,
} from '@clerk/nextjs';
import { Badge, Button, Card } from '@faithflow-ai/ui';
import { trpc } from '../../lib/trpc';

const providers = ['STRIPE', 'PAYSTACK'] as const;

function formatPlan(amountMinor: number, currency: string, interval: string) {
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

export default function GetStartedPage() {
  const utils = trpc.useUtils();
  const { orgId } = useAuth();
  const { user } = useUser();
  const [provider, setProvider] = useState<(typeof providers)[number]>('STRIPE');
  const [selectedPlanCode, setSelectedPlanCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const adminBaseUrl = (process.env.NEXT_PUBLIC_ADMIN_URL ?? 'https://admin-gamma-beryl.vercel.app').replace(/\/+$/, '');

  const { data: authSelf } = trpc.auth.self.useQuery(undefined, { enabled: Boolean(orgId) });
  const { data: plans } = trpc.billing.plans.useQuery(undefined, { enabled: Boolean(orgId && authSelf?.isStaff) });

  const { mutate: bootstrap, isPending: isBootstrapping } = trpc.auth.bootstrap.useMutation({
    onSuccess: async () => {
      await utils.auth.self.invalidate();
      await utils.billing.plans.invalidate();
    },
  });

  const { mutate: startCheckout, isPending: isStartingCheckout } = trpc.billing.startCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    },
  });

  useEffect(() => {
    if (!orgId || !authSelf?.bootstrapAllowed || authSelf?.isStaff || isBootstrapping) return;
    bootstrap();
  }, [authSelf?.bootstrapAllowed, authSelf?.isStaff, bootstrap, isBootstrapping, orgId]);

  const selectedPlan = useMemo(
    () => plans?.find((plan) => plan.code === selectedPlanCode) ?? null,
    [plans, selectedPlanCode]
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-8">
      <div className="space-y-6">
        <div>
          <Badge variant="default">Church onboarding</Badge>
          <h1 className="mt-3 text-3xl font-semibold">Set up your church and launch admin</h1>
          <p className="mt-2 text-sm text-muted">
            Flow: account → organization → admin claim → plan checkout → admin workspace.
          </p>
        </div>

        <SignedOut>
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Create your account</h2>
            <p className="mt-2 text-sm text-muted">Use an admin account for your church onboarding.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <SignInButton mode="modal">
                <Button>Sign in</Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button variant="outline">Create account</Button>
              </SignUpButton>
            </div>
          </Card>
        </SignedOut>

        <SignedIn>
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Step 1: Select or create organization</h2>
            <p className="mt-2 text-sm text-muted">
              Choose the church organization this subscription will belong to.
            </p>
            <div className="mt-4">
              <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/get-started" afterCreateOrganizationUrl="/get-started" />
            </div>
            {!orgId ? (
              <p className="mt-3 text-xs text-muted">Select or create an organization to continue.</p>
            ) : (
              <p className="mt-3 text-xs text-emerald-700">Organization selected.</p>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold">Step 2: Claim church admin access</h2>
            <p className="mt-2 text-sm text-muted">First user in a new church organization is auto-assigned as admin.</p>
            {authSelf?.isStaff ? (
              <p className="mt-3 text-xs text-emerald-700">Admin access active for {user?.primaryEmailAddress?.emailAddress}.</p>
            ) : (
              <div className="mt-4">
                <Button
                  onClick={() => bootstrap()}
                  disabled={!orgId || isBootstrapping || !authSelf?.bootstrapAllowed}
                >
                  {isBootstrapping ? 'Claiming access…' : 'Claim admin access'}
                </Button>
                {!authSelf?.bootstrapAllowed && orgId ? (
                  <p className="mt-2 text-xs text-muted">
                    This org already has staff configured. Ask an existing admin to grant access.
                  </p>
                ) : null}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold">Step 3: Choose plan and checkout</h2>
            <p className="mt-2 text-sm text-muted">Subscription activates billing and feature entitlements for your organization.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={selectedPlanCode}
                onChange={(event) => {
                  setLocalError(null);
                  setSelectedPlanCode(event.target.value);
                }}
                disabled={!authSelf?.isStaff}
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
                onChange={(event) => setProvider(event.target.value as (typeof providers)[number])}
                disabled={!authSelf?.isStaff}
              >
                {providers.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>
            {selectedPlan ? (
              <p className="mt-3 text-sm text-muted">
                {selectedPlan.description || 'No description'} ·{' '}
                {formatPlan(selectedPlan.amountMinor, selectedPlan.currency, selectedPlan.interval)}
                {getTrialDays(selectedPlan.metadata) ? ` · ${getTrialDays(selectedPlan.metadata)}-day free trial` : ''}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                disabled={!orgId || !authSelf?.isStaff || !selectedPlanCode || isStartingCheckout}
                onClick={() => {
                  if (!selectedPlanCode) {
                    setLocalError('Select a plan first.');
                    return;
                  }
                  setLocalError(null);
                  startCheckout({
                    planCode: selectedPlanCode,
                    provider,
                    successUrl: `${adminBaseUrl}/billing?checkout=success`,
                    cancelUrl: `${adminBaseUrl}/billing?checkout=cancelled`,
                  });
                }}
              >
                {isStartingCheckout ? 'Redirecting…' : 'Continue to checkout'}
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = adminBaseUrl)}>
                Go to admin
              </Button>
            </div>
            {localError ? <p className="mt-2 text-xs text-destructive">{localError}</p> : null}
            {!authSelf?.isStaff ? (
              <p className="mt-2 text-xs text-muted">Claim admin access to unlock plan checkout.</p>
            ) : null}
          </Card>
        </SignedIn>

        <div className="text-sm text-muted">
          Need member access instead? <Link className="underline" href="/portal">Go to member portal</Link>.
        </div>
      </div>
    </main>
  );
}
