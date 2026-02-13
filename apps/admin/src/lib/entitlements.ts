'use client';

import { trpc } from './trpc';

export function useFeatureGate(featureKey: string) {
  const { data, isLoading, error } = trpc.billing.entitlements.useQuery(undefined, { retry: false });
  const entitlements = data?.entitlements?.entitlements ?? null;
  const entitlement = entitlements?.[featureKey] ?? null;
  const source = data?.entitlements?.source ?? null;

  // Missing keys are treated as enabled to avoid surprising locks when a key wasn't seeded.
  const enabled = entitlement ? Boolean(entitlement.enabled) : true;
  const readOnly = source === 'inactive_subscription';
  const access = readOnly ? ('read_only' as const) : enabled ? ('enabled' as const) : ('locked' as const);

  return {
    enabled,
    isLoading,
    error,
    access,
    canWrite: access === 'enabled',
    readOnly,
    source,
    planCode: data?.entitlements?.plan?.code ?? null,
  };
}
