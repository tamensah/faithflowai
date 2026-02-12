import {
  prisma,
  AuditActorType,
  CommunicationChannel,
  CommunicationProvider,
  CommunicationScheduleStatus,
  TenantStatus,
  TenantSubscriptionStatus,
  UserRole,
} from '@faithflow-ai/database';
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

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function isoDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : 'N/A';
}

export async function runSubscriptionAutomation(options?: {
  suspendPastDueAfterDays?: number;
  limitTenants?: number;
  trialReminderDaysBeforeEnd?: number;
}) {
  const suspendPastDueAfterDays = options?.suspendPastDueAfterDays ?? 14;
  const trialReminderDaysBeforeEnd = options?.trialReminderDaysBeforeEnd ?? 3;
  const tenants = await prisma.tenant.findMany({
    where: { status: { in: [TenantStatus.ACTIVE, TenantStatus.SUSPENDED] } },
    orderBy: { createdAt: 'asc' },
    take: options?.limitTenants ?? 500,
  });

  const quotaAlerts: QuotaAlert[] = [];
  const billingActions: BillingAction[] = [];
  const cutoff = new Date(Date.now() - suspendPastDueAfterDays * 24 * 60 * 60 * 1000);
  const trialReminderCutoff = daysFromNow(trialReminderDaysBeforeEnd);

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

    if (tenant.status === TenantStatus.ACTIVE && currentSubscription?.status === TenantSubscriptionStatus.TRIALING) {
      const trialEndsAt = currentSubscription.trialEndsAt;
      if (trialEndsAt && trialEndsAt <= trialReminderCutoff && trialEndsAt > new Date()) {
        const admins = await prisma.staffMembership.findMany({
          where: {
            role: UserRole.ADMIN,
            church: { organization: { tenantId: tenant.id } },
            user: { email: { not: '' } },
          },
          include: {
            church: true,
            user: true,
          },
          take: 50,
        });

        // Dedupe per day per recipient per subscription.
        const todayKey = new Date().toISOString().slice(0, 10);
        for (const admin of admins) {
          if (!admin.user.email) continue;
          const dedupeKey = `trial-ending:${currentSubscription.id}:${admin.user.email.toLowerCase()}:${todayKey}`;
          const existing = await prisma.communicationSchedule.findFirst({
            where: {
              churchId: admin.churchId,
              to: admin.user.email,
              createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
              metadata: { path: ['dedupeKey'], equals: dedupeKey },
            },
          });
          if (existing) continue;

          const billingUrl = `${process.env.NEXT_PUBLIC_ADMIN_URL ?? process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3001'}/billing`;
          const subject = 'Your FaithFlow trial is ending soon';
          const body = [
            `Hello,`,
            '',
            `Your FaithFlow trial ends on ${isoDate(trialEndsAt)}.`,
            'To avoid any interruption, choose a plan and complete billing setup.',
            '',
            `Manage billing: ${billingUrl}`,
            '',
            'FaithFlow Billing Operations',
          ].join('\n');

          await prisma.communicationSchedule.create({
            data: {
              churchId: admin.churchId,
              channel: CommunicationChannel.EMAIL,
              provider: CommunicationProvider.RESEND,
              to: admin.user.email,
              subject,
              body,
              sendAt: new Date(),
              status: CommunicationScheduleStatus.QUEUED,
              metadata: {
                dedupeKey,
                tenantId: tenant.id,
                subscriptionId: currentSubscription.id,
                reason: 'trial_ending',
                trialEndsAt: trialEndsAt.toISOString(),
              },
            },
          });
        }

        await recordAuditLog({
          tenantId: tenant.id,
          actorType: AuditActorType.SYSTEM,
          action: 'subscription.trial_reminder_queued',
          targetType: 'TenantSubscription',
          targetId: currentSubscription.id,
          metadata: {
            trialEndsAt,
            daysBeforeEnd: trialReminderDaysBeforeEnd,
          },
        });
      }
    }

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
