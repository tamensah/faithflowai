'use client';

import { trpc } from './trpc';

export function useFeatureGate(featureKey: string) {
  const { data, isLoading, error } = trpc.billing.entitlements.useQuery(undefined, { retry: false });
  const entitlements = data?.entitlements?.entitlements ?? null;
  const entitlement = entitlements?.[featureKey] ?? null;

  // Missing keys are treated as enabled to avoid surprising locks when a key wasn't seeded.
  const enabled = entitlement ? Boolean(entitlement.enabled) : true;

  return {
    enabled,
    isLoading,
    error,
    source: data?.entitlements?.source ?? null,
    planCode: data?.entitlements?.plan?.code ?? null,
  };
}

