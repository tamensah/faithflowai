import {
  prisma,
  AuditActorType,
  CommunicationChannel,
  CommunicationProvider,
  CommunicationScheduleStatus,
  TenantSubscriptionStatus,
  UserRole,
} from '@faithflow-ai/database';
import { recordAuditLog } from './audit';
import { getTenantUsageSnapshot, resolveTenantEntitlements } from './entitlements';
import { renderTrialEndingEmail } from './email-templates';

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
  action: 'expired_for_past_due';
  subscriptionId: string;
};

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function isoDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : 'N/A';
}

export async function runSubscriptionAutomation(options?: {
  expirePastDueAfterDays?: number;
  limitTenants?: number;
  trialReminderDaysBeforeEnd?: number;
}) {
  const expirePastDueAfterDays = options?.expirePastDueAfterDays ?? 7;
  const trialReminderDaysBeforeEnd = options?.trialReminderDaysBeforeEnd ?? 3;
  const tenants = await prisma.tenant.findMany({
    where: {},
    orderBy: { createdAt: 'asc' },
    take: options?.limitTenants ?? 500,
  });

  const quotaAlerts: QuotaAlert[] = [];
  const billingActions: BillingAction[] = [];
  const cutoff = new Date(Date.now() - expirePastDueAfterDays * 24 * 60 * 60 * 1000);
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

    if (currentSubscription?.status === TenantSubscriptionStatus.TRIALING) {
      const trialEndsAt = currentSubscription.trialEndsAt;
      if (trialEndsAt && trialEndsAt <= new Date()) {
        // Trial is over, but provider webhooks may not have updated status yet. Move to PAST_DUE to
        // start dunning/suspension policies; provider webhooks can still override with ACTIVE.
        await prisma.tenantSubscription.update({
          where: { id: currentSubscription.id },
          data: {
            status: TenantSubscriptionStatus.PAST_DUE,
            currentPeriodEnd: trialEndsAt,
          },
        });

        await recordAuditLog({
          tenantId: tenant.id,
          actorType: AuditActorType.SYSTEM,
          action: 'subscription.trial_ended_marked_past_due',
          targetType: 'TenantSubscription',
          targetId: currentSubscription.id,
          metadata: {
            trialEndsAt,
          },
        });
      }

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
          const body = renderTrialEndingEmail({ trialEndsAtIso: trialEndsAt.toISOString(), billingUrl });

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
      currentSubscription?.status === TenantSubscriptionStatus.PAST_DUE &&
      (currentSubscription.currentPeriodEnd ?? currentSubscription.updatedAt) < cutoff
    ) {
      // Important: do not suspend the Tenant record for billing issues. Tenants must be able to
      // access the admin billing page to resolve payment and re-activate.
      await prisma.tenantSubscription.update({
        where: { id: currentSubscription.id },
        data: {
          status: TenantSubscriptionStatus.EXPIRED,
          canceledAt: currentSubscription.canceledAt ?? new Date(),
          cancelAtPeriodEnd: false,
        },
      });

      await recordAuditLog({
        tenantId: tenant.id,
        actorType: AuditActorType.SYSTEM,
        action: 'subscription.past_due_expired',
        targetType: 'Tenant',
        targetId: tenant.id,
        metadata: {
          reason: 'past_due_grace_expired',
          expirePastDueAfterDays,
          subscriptionId: currentSubscription.id,
          subscriptionStatus: currentSubscription.status,
          periodEnd: currentSubscription.currentPeriodEnd,
        },
      });

      billingActions.push({
        tenantId: tenant.id,
        action: 'expired_for_past_due',
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
