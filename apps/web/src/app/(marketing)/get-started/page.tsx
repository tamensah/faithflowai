'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  OrganizationSwitcher,
  SignInButton,
  SignUpButton,
  useAuth,
  useUser,
} from '@clerk/nextjs';
import { Badge, Button, Card } from '@faithflow-ai/ui';
import { trpc } from '../../../lib/trpc';

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

// ─── Step indicator ────────────────────────────────────────────────────────────

type StepState = 'done' | 'active' | 'locked';

function StepDot({ state, n }: { state: StepState; n: number }) {
  if (state === 'done') {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <path d="M3 8l3.5 3.5L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (state === 'active') {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {n}
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-border text-sm font-semibold text-muted">
      {n}
    </span>
  );
}

function StepRow({
  n,
  state,
  title,
  children,
  isLast = false,
}: {
  n: number;
  state: StepState;
  title: string;
  children: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <div className="flex gap-5">
      <div className="flex flex-col items-center">
        <StepDot state={state} n={n} />
        {!isLast && <div className="mt-1 w-px flex-1 bg-border" />}
      </div>
      <div className={`w-full pb-8 pt-1 ${state === 'locked' ? 'opacity-40 select-none pointer-events-none' : ''}`}>
        <p className={`text-base font-semibold ${state === 'active' ? 'text-foreground' : 'text-muted'}`}>
          {title}
        </p>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function GetStartedPage() {
  const utils = trpc.useUtils();
  const { isSignedIn, orgId } = useAuth();
  const { user } = useUser();
  const [provider, setProvider] = useState<(typeof providers)[number]>('STRIPE');
  const [selectedPlanCode, setSelectedPlanCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const adminBaseUrl = (process.env.NEXT_PUBLIC_ADMIN_URL ?? 'https://admin-gamma-beryl.vercel.app').replace(/\/+$/, '');

  const { data: authSelf } = trpc.auth.self.useQuery(undefined, {
    enabled: Boolean(orgId),
    // Poll every 3s until staff is confirmed — guards against stale-cache race after bootstrap.
    // Once isStaff is true the step transitions and polling becomes a no-op.
    refetchInterval: (query) => (query.state.data?.isStaff ? false : orgId ? 3000 : false),
  });
  const { data: plans, isLoading: isPlansLoading } = trpc.billing.catalog.useQuery(undefined, { enabled: Boolean(orgId) });

  const { mutate: bootstrap, isPending: isBootstrapping } = trpc.auth.bootstrap.useMutation({
    onSuccess: async () => {
      setBootstrapError(null);
      await utils.auth.self.invalidate();
      await utils.billing.plans.invalidate();
    },
    onError: (err) => {
      setBootstrapError(err.message ?? 'Setup failed. Please try again.');
    },
  });

  const { mutate: startCheckout, isPending: isStartingCheckout } = trpc.billing.startCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    },
  });

  // Auto-bootstrap: silently claims admin for the first user in a new org.
  // No user action required — the button in the old design was misleading.
  useEffect(() => {
    if (!orgId || !authSelf?.bootstrapAllowed || authSelf?.isStaff || isBootstrapping || bootstrapError) return;
    setBootstrapError(null);
    bootstrap();
  }, [authSelf?.bootstrapAllowed, authSelf?.isStaff, bootstrap, bootstrapError, isBootstrapping, orgId]);

  useEffect(() => {
    if (!plans?.length) return;
    if (!selectedPlanCode) {
      const initial = plans.find((plan) => plan.isDefault) ?? plans[0];
      setSelectedPlanCode(initial.code);
      return;
    }
    if (!plans.some((plan) => plan.code === selectedPlanCode)) {
      const fallback = plans.find((plan) => plan.isDefault) ?? plans[0];
      setSelectedPlanCode(fallback.code);
    }
  }, [plans, selectedPlanCode]);

  const selectedPlan = useMemo(
    () => plans?.find((plan) => plan.code === selectedPlanCode) ?? null,
    [plans, selectedPlanCode]
  );

  // Derive step states
  const step1: StepState = isSignedIn ? 'done' : 'active';
  const step2: StepState = !isSignedIn ? 'locked' : orgId && authSelf?.isStaff ? 'done' : 'active';
  const step3: StepState = !isSignedIn || !orgId || !authSelf?.isStaff ? 'locked' : 'active';

  const trialDays = getTrialDays(selectedPlan?.metadata);

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-16">
      {/* Header */}
      <div className="mb-12">
        <Badge variant="default">Church onboarding</Badge>
        <h1 className="mt-4 text-4xl font-semibold leading-tight text-foreground">
          Set up your church in minutes.
        </h1>
        <p className="mt-3 text-base text-muted">
          Three steps and you'll have a fully configured admin workspace for your congregation.
        </p>
      </div>

      {/* Wizard */}
      <div>
        {/* ── Step 1: Create account ── */}
        <StepRow n={1} state={step1} title="Create your account">
          {step1 === 'done' ? (
            <p className="text-sm text-emerald-700">
              Signed in as <span className="font-medium">{user?.primaryEmailAddress?.emailAddress}</span>
            </p>
          ) : (
            <Card className="p-5">
              <p className="text-sm text-muted">
                Your account is the admin login for your church. Use a work email — not a personal one you might lose access to.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {/* forceRedirectUrl ensures Clerk always comes back here after OAuth or email auth */}
                <SignUpButton mode="modal" forceRedirectUrl="/get-started">
                  <Button>Create free account</Button>
                </SignUpButton>
                <SignInButton mode="modal" forceRedirectUrl="/get-started">
                  <Button variant="outline">Sign in</Button>
                </SignInButton>
              </div>
              <p className="mt-3 text-xs text-muted">14-day free trial · No credit card required</p>
            </Card>
          )}
        </StepRow>

        {/* ── Step 2: Set up your church ── */}
        <StepRow n={2} state={step2} title="Set up your church">
          {step2 === 'done' ? (
            <p className="text-sm text-emerald-700">
              Church organisation ready. Admin access active.
            </p>
          ) : (
            <Card className="p-5">
              <p className="text-sm text-muted">
                Create your church organisation. This groups your members, events, and billing together under one workspace.
              </p>
              <div className="mt-4">
                <OrganizationSwitcher
                  hidePersonal
                  afterSelectOrganizationUrl="/get-started"
                  afterCreateOrganizationUrl="/get-started"
                />
              </div>
              {!orgId ? (
                <p className="mt-3 text-xs text-muted">
                  Click the switcher above and choose <strong>Create organisation</strong> — name it after your church.
                </p>
              ) : bootstrapError ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-destructive">{bootstrapError}</p>
                  <button
                    type="button"
                    className="text-xs font-medium underline underline-offset-2 hover:text-foreground"
                    onClick={() => { setBootstrapError(null); bootstrap(); }}
                  >
                    Retry setup
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  {isBootstrapping ? 'Setting up your admin access…' : 'Organisation selected. Finalising access…'}
                </p>
              )}
              {authSelf?.bootstrapAllowed === false && orgId ? (
                <p className="mt-2 text-xs text-amber-700">
                  This organisation already has an admin configured. Ask them to invite you from the Staff page.
                </p>
              ) : null}
            </Card>
          )}
        </StepRow>

        {/* ── Step 3: Choose plan ── */}
        <StepRow n={3} state={step3} title="Choose your plan" isLast>
          <Card className="p-5">
            <p className="text-sm text-muted">
              Your subscription activates all features for your church. Start with a 14-day free trial — upgrade or cancel any time.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Plan</label>
                <select
                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  value={selectedPlanCode}
                  onChange={(e) => { setLocalError(null); setSelectedPlanCode(e.target.value); }}
                  disabled={isPlansLoading || !plans?.length}
                >
                  <option value="">{isPlansLoading ? 'Loading plans…' : 'Select a plan'}</option>
                  {plans?.map((plan) => (
                    <option key={plan.id} value={plan.code}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Payment provider</label>
                <select
                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as (typeof providers)[number])}
                >
                  <option value="STRIPE">Stripe — card / international</option>
                  <option value="PAYSTACK">Paystack — Africa / local currency</option>
                </select>
              </div>
            </div>

            {selectedPlan ? (
              <div className="mt-3 rounded-lg bg-muted/5 p-3 text-sm">
                <p className="font-medium text-foreground">{selectedPlan.name}</p>
                <p className="mt-0.5 text-muted">
                  {selectedPlan.description || 'Full feature access'} ·{' '}
                  {formatPlan(selectedPlan.amountMinor, selectedPlan.currency, selectedPlan.interval)}
                  {trialDays ? (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      {trialDays}-day free trial
                    </span>
                  ) : null}
                </p>
              </div>
            ) : null}

            {!isPlansLoading && !plans?.length ? (
              <p className="mt-3 text-xs text-muted">
                No plans configured yet. Contact platform support to set up the plan catalogue.
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                disabled={!selectedPlanCode || isStartingCheckout || !plans?.length}
                onClick={() => {
                  if (!selectedPlanCode) { setLocalError('Select a plan first.'); return; }
                  setLocalError(null);
                  startCheckout({
                    planCode: selectedPlanCode,
                    provider,
                    successUrl: `${adminBaseUrl}/billing?checkout=success`,
                    cancelUrl: `${adminBaseUrl}/billing?checkout=cancelled`,
                  });
                }}
              >
                {isStartingCheckout ? 'Redirecting to checkout…' : 'Start free trial'}
              </Button>
            </div>

            {localError ? <p className="mt-2 text-xs text-destructive">{localError}</p> : null}
          </Card>
        </StepRow>
      </div>

      {/* Footer links */}
      <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted">
        <span>
          Already set up?{' '}
          <a href={adminBaseUrl} className="underline hover:text-foreground">
            Go to admin console
          </a>
        </span>
        <span>
          Member of a church?{' '}
          <Link href="/portal" className="underline hover:text-foreground">
            Go to member portal
          </Link>
        </span>
        <span>
          <Link href="/guide" className="underline hover:text-foreground">
            Read the setup guide
          </Link>
        </span>
      </div>
    </main>
  );
}
