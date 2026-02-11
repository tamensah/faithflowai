import { prisma, AuditActorType, TenantStatus, TenantSubscriptionStatus } from '@faithflow-ai/database';
import { recordAuditLog } from './audit';
import { getTenantUsageSnapshot, resolveTenantEntitlements } from './entitlements';

const monitoredLimits = [
  { key: 'max_members', usageField: 'members' as const },
  { key: 'max_campuses', usageField: 'campuses' as const },
  { key: 'max_events_monthly', usageField: 'eventsThisMonth' as const },
  { key: 'max_expenses_monthly', usageField: 'expensesThisMonth' as const },
];

type QuotaAlert = {
  tenantId: string;
  key: string;
  usage: number;
  limit: number;
  planCode: string;
};

type BillingAction = {
  tenantId: string;
  action: 'suspended_for_past_due';
  subscriptionId: string;
};

export async function runSubscriptionAutomation(options?: {
  suspendPastDueAfterDays?: number;
  limitTenants?: number;
}) {
  const suspendPastDueAfterDays = options?.suspendPastDueAfterDays ?? 14;
  const tenants = await prisma.tenant.findMany({
    where: { status: { in: [TenantStatus.ACTIVE, TenantStatus.SUSPENDED] } },
    orderBy: { createdAt: 'asc' },
    take: options?.limitTenants ?? 500,
  });

  const quotaAlerts: QuotaAlert[] = [];
  const billingActions: BillingAction[] = [];
  const cutoff = new Date(Date.now() - suspendPastDueAfterDays * 24 * 60 * 60 * 1000);

  for (const tenant of tenants) {
    const [entitlements, usage, currentSubscription] = await Promise.all([
      resolveTenantEntitlements(tenant.id),
      getTenantUsageSnapshot(tenant.id),
      prisma.tenantSubscription.findFirst({
        where: {
          tenantId: tenant.id,
          status: { in: [TenantSubscriptionStatus.TRIALING, TenantSubscriptionStatus.ACTIVE, TenantSubscriptionStatus.PAST_DUE, TenantSubscriptionStatus.PAUSED] },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    for (const limitRule of monitoredLimits) {
      const entitlement = entitlements.entitlements[limitRule.key];
      if (!entitlement || entitlement.limit === null || !entitlement.enabled) continue;
      const usageValue = usage[limitRule.usageField];
      if (usageValue <= entitlement.limit) continue;

      quotaAlerts.push({
        tenantId: tenant.id,
        key: limitRule.key,
        usage: usageValue,
        limit: entitlement.limit,
        planCode: entitlement.planCode,
      });

      await recordAuditLog({
        tenantId: tenant.id,
        actorType: AuditActorType.SYSTEM,
        action: 'subscription.quota_exceeded',
        targetType: 'Tenant',
        targetId: tenant.id,
        metadata: {
          key: limitRule.key,
          usage: usageValue,
          limit: entitlement.limit,
          planCode: entitlement.planCode,
        },
      });
    }

    if (
      tenant.status === TenantStatus.ACTIVE &&
      currentSubscription?.status === TenantSubscriptionStatus.PAST_DUE &&
      (currentSubscription.currentPeriodEnd ?? currentSubscription.updatedAt) < cutoff
    ) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          status: TenantStatus.SUSPENDED,
          suspendedAt: new Date(),
          suspensionReason: `AUTO_PAST_DUE_${suspendPastDueAfterDays}D`,
        },
      });

      await recordAuditLog({
        tenantId: tenant.id,
        actorType: AuditActorType.SYSTEM,
        action: 'subscription.tenant_auto_suspended',
        targetType: 'Tenant',
        targetId: tenant.id,
        metadata: {
          reason: 'past_due_grace_expired',
          suspendPastDueAfterDays,
          subscriptionId: currentSubscription.id,
          subscriptionStatus: currentSubscription.status,
          periodEnd: currentSubscription.currentPeriodEnd,
        },
      });

      billingActions.push({
        tenantId: tenant.id,
        action: 'suspended_for_past_due',
        subscriptionId: currentSubscription.id,
      });
    }
  }

  return {
    scannedTenants: tenants.length,
    quotaAlerts,
    billingActions,
  };
}
