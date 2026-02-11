import {
  AuditActorType,
  CommunicationChannel,
  CommunicationProvider,
  CommunicationScheduleStatus,
  Prisma,
  TenantSubscriptionStatus,
  UserRole,
  prisma,
} from '@faithflow-ai/database';
import { recordAuditLog } from './audit';

type RunSubscriptionDunningInput = {
  tenantIds?: string[];
  graceDays?: number;
  limit?: number;
  dryRun?: boolean;
};

type DunningTarget = {
  tenantId: string;
  subscriptionId: string;
  planCode: string;
  planName: string;
  currentPeriodEnd: Date | null;
  recipients: Array<{ churchId: string; email: string }>;
};

function uniqueRecipients(entries: Array<{ churchId: string; email: string }>) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.churchId}:${entry.email.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildDunningBody(input: { tenantName: string; planName: string; periodEnd: Date | null; billingUrl: string }) {
  const dueText = input.periodEnd ? input.periodEnd.toISOString().slice(0, 10) : 'the current billing cycle';
  return [
    `Hello ${input.tenantName} team,`,
    '',
    `Your FaithFlow ${input.planName} subscription is currently past due as of ${dueText}.`,
    'Please update your payment method or change plan to avoid service suspension.',
    '',
    `Manage billing: ${input.billingUrl}`,
    '',
    'If payment has already been completed, you can ignore this notice.',
    '',
    'FaithFlow Billing Operations',
  ].join('\n');
}

export async function runSubscriptionDunning(input: RunSubscriptionDunningInput = {}) {
  const graceDays = input.graceDays ?? 3;
  const limit = input.limit ?? 200;
  const dryRun = input.dryRun ?? false;
  const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000);
  const billingBaseUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3001';

  const subscriptions = await prisma.tenantSubscription.findMany({
    where: {
      status: TenantSubscriptionStatus.PAST_DUE,
      ...(input.tenantIds?.length ? { tenantId: { in: input.tenantIds } } : {}),
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { lte: cutoff } }],
    },
    include: {
      plan: true,
      tenant: true,
    },
    orderBy: [{ currentPeriodEnd: 'asc' }, { updatedAt: 'asc' }],
    take: limit,
  });

  const targets: DunningTarget[] = [];
  for (const subscription of subscriptions) {
    const admins = await prisma.staffMembership.findMany({
      where: {
        role: UserRole.ADMIN,
        church: { organization: { tenantId: subscription.tenantId } },
        user: { email: { not: '' } },
      },
      include: {
        church: true,
        user: true,
      },
      take: 50,
    });

    const recipients = uniqueRecipients(
      admins
        .filter((entry) => Boolean(entry.user.email))
        .map((entry) => ({ churchId: entry.churchId, email: entry.user.email }))
    );

    targets.push({
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      planCode: subscription.plan.code,
      planName: subscription.plan.name,
      currentPeriodEnd: subscription.currentPeriodEnd,
      recipients,
    });
  }

  if (dryRun) {
    return {
      dryRun: true,
      graceDays,
      inspected: subscriptions.length,
      queued: 0,
      targets: targets.map((target) => ({
        tenantId: target.tenantId,
        subscriptionId: target.subscriptionId,
        planCode: target.planCode,
        recipientCount: target.recipients.length,
      })),
    };
  }

  let queued = 0;
  for (const target of targets) {
    const subject = `Action required: FaithFlow subscription payment issue (${target.planCode})`;
    const body = buildDunningBody({
      tenantName: target.tenantId,
      planName: target.planName,
      periodEnd: target.currentPeriodEnd,
      billingUrl: `${billingBaseUrl}/billing`,
    });

    for (const recipient of target.recipients) {
      const dedupeKey = `dunning:${target.subscriptionId}:${recipient.email.toLowerCase()}`;
      const existing = await prisma.communicationSchedule.findFirst({
        where: {
          churchId: recipient.churchId,
          to: recipient.email,
          status: CommunicationScheduleStatus.QUEUED,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          metadata: { path: ['dedupeKey'], equals: dedupeKey },
        },
      });
      if (existing) continue;

      await prisma.communicationSchedule.create({
        data: {
          churchId: recipient.churchId,
          channel: CommunicationChannel.EMAIL,
          provider: CommunicationProvider.RESEND,
          to: recipient.email,
          subject,
          body,
          sendAt: new Date(),
          status: CommunicationScheduleStatus.QUEUED,
          metadata: {
            dedupeKey,
            tenantId: target.tenantId,
            subscriptionId: target.subscriptionId,
            reason: 'subscription_past_due',
          } as Prisma.InputJsonValue,
        },
      });
      queued += 1;
    }

    await recordAuditLog({
      tenantId: target.tenantId,
      actorType: AuditActorType.SYSTEM,
      action: 'billing.dunning_queued',
      targetType: 'TenantSubscription',
      targetId: target.subscriptionId,
      metadata: {
        recipientCount: target.recipients.length,
        graceDays,
      },
    });
  }

  return {
    dryRun: false,
    graceDays,
    inspected: subscriptions.length,
    queued,
    targets: targets.map((target) => ({
      tenantId: target.tenantId,
      subscriptionId: target.subscriptionId,
      planCode: target.planCode,
      recipientCount: target.recipients.length,
    })),
  };
}
