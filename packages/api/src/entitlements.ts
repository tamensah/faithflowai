import { prisma, TenantSubscriptionStatus } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';

const activeStatuses = [
  TenantSubscriptionStatus.TRIALING,
  TenantSubscriptionStatus.ACTIVE,
  TenantSubscriptionStatus.PAST_DUE,
  TenantSubscriptionStatus.PAUSED,
] as const;

export type TenantEntitlement = {
  enabled: boolean;
  limit: number | null;
  planCode: string;
};

type FeatureKeyCache = { keys: string[]; fetchedAt: number };
let featureKeyCache: FeatureKeyCache | null = null;
const FEATURE_KEY_CACHE_TTL_MS = 5 * 60 * 1000;

async function listFeatureKeys() {
  if (featureKeyCache && Date.now() - featureKeyCache.fetchedAt < FEATURE_KEY_CACHE_TTL_MS) {
    return featureKeyCache.keys;
  }

  // Distinct list of known feature keys from plans. Used to build "locked" entitlements
  // when a tenant has a subscription history but no active subscription.
  const rows = await prisma.subscriptionPlanFeature.findMany({
    select: { key: true },
    distinct: ['key'],
  });
  const keys = rows.map((row) => row.key).sort();
  featureKeyCache = { keys, fetchedAt: Date.now() };
  return keys;
}

export async function resolveTenantPlan(tenantId: string) {
  const subscription = await prisma.tenantSubscription.findFirst({
    where: { tenantId, status: { in: activeStatuses as unknown as TenantSubscriptionStatus[] } },
    include: { plan: { include: { features: { orderBy: { key: 'asc' } } } } },
    orderBy: { createdAt: 'desc' },
  });

  if (subscription?.plan) {
    return { source: 'subscription' as const, subscription, plan: subscription.plan };
  }

  const subscriptionHistoryCount = await prisma.tenantSubscription.count({ where: { tenantId } });
  if (subscriptionHistoryCount > 0) {
    // Important: do NOT fall back to the default plan when a tenant has an inactive/canceled/expired
    // subscription history. This prevents non-paying tenants from continuing to receive paid entitlements.
    return { source: 'inactive_subscription' as const, subscription: null, plan: null };
  }

  const defaultPlan = await prisma.subscriptionPlan.findFirst({
    where: { isDefault: true, isActive: true },
    include: { features: { orderBy: { key: 'asc' } } },
  });

  if (!defaultPlan) {
    return { source: 'none' as const, subscription: null, plan: null };
  }
  return { source: 'default_plan' as const, subscription: null, plan: defaultPlan };
}

export async function resolveTenantEntitlements(tenantId: string) {
  const resolved = await resolveTenantPlan(tenantId);
  if (!resolved.plan) {
    if (resolved.source === 'inactive_subscription') {
      const keys = await listFeatureKeys();
      const entitlements = Object.fromEntries(
        keys.map((key) => [
          key,
          {
            enabled: false,
            limit: 0,
            planCode: 'inactive',
          } satisfies TenantEntitlement,
        ])
      ) as Record<string, TenantEntitlement>;

      return {
        source: resolved.source,
        subscriptionId: null,
        plan: null,
        entitlements,
      };
    }

    return {
      source: resolved.source,
      subscriptionId: null,
      plan: null,
      entitlements: {} as Record<string, TenantEntitlement>,
    };
  }

  const entitlements = Object.fromEntries(
    resolved.plan.features.map((feature) => [
      feature.key,
      {
        enabled: feature.enabled,
        limit: feature.limit,
        planCode: resolved.plan.code,
      },
    ])
  ) as Record<string, TenantEntitlement>;

  return {
    source: resolved.source,
    subscriptionId: resolved.subscription?.id ?? null,
    plan: resolved.plan,
    entitlements,
  };
}

export async function getFeatureEntitlement(tenantId: string, key: string) {
  const result = await resolveTenantEntitlements(tenantId);
  const entitlement = result.entitlements[key];
  return { ...result, entitlement };
}

export async function ensureFeatureEnabled(tenantId: string, key: string, errorMessage: string) {
  const { entitlement } = await getFeatureEntitlement(tenantId, key);
  if (!entitlement) {
    return;
  }
  if (!entitlement.enabled) {
    throw new TRPCError({ code: 'FORBIDDEN', message: errorMessage });
  }
}

export async function ensureFeatureLimit(
  tenantId: string,
  key: string,
  currentUsage: number,
  increment: number,
  errorMessage: string
) {
  const { entitlement } = await getFeatureEntitlement(tenantId, key);
  if (!entitlement || entitlement.limit === null) {
    return;
  }
  if (!entitlement.enabled) {
    throw new TRPCError({ code: 'FORBIDDEN', message: errorMessage });
  }
  if (currentUsage + increment > entitlement.limit) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `${errorMessage} (plan limit: ${entitlement.limit})`,
    });
  }
}

export async function getTenantUsageSnapshot(tenantId: string) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));

  const [members, campuses, eventsThisMonth, expensesThisMonth, churches] = await Promise.all([
    prisma.member.count({
      where: { church: { organization: { tenantId } }, status: 'ACTIVE' },
    }),
    prisma.campus.count({
      where: { church: { organization: { tenantId } } },
    }),
    prisma.event.count({
      where: { church: { organization: { tenantId } }, createdAt: { gte: monthStart } },
    }),
    prisma.expense.count({
      where: { church: { organization: { tenantId } }, createdAt: { gte: monthStart } },
    }),
    prisma.church.count({
      where: { organization: { tenantId } },
    }),
  ]);

  return {
    asOf: now,
    monthStart,
    members,
    campuses,
    churches,
    eventsThisMonth,
    expensesThisMonth,
  };
}
