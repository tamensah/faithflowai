import {
  AuditActorType,
  CommunicationChannel,
  CommunicationProvider,
  prisma,
  UserRole,
} from '@faithflow-ai/database';
import { recordAuditLog } from './audit';

type MonitorResult = {
  scanned: number;
  alerted: number;
  skipped: number;
};

type AlertStage = 'overdue' | 'one_day' | 'three_days' | 'seven_days';

const CLOSED_STATUS_FRAGMENTS = ['won', 'lost', 'closed', 'resolved', 'charge_refunded', 'refunded'];

const ALERT_RULES: { stage: AlertStage; maxDays: number }[] = [
  { stage: 'overdue', maxDays: 0 },
  { stage: 'one_day', maxDays: 1 },
  { stage: 'three_days', maxDays: 3 },
  { stage: 'seven_days', maxDays: 7 },
];

function getAlertStage(daysUntil: number): AlertStage | null {
  for (const rule of ALERT_RULES) {
    if (daysUntil <= rule.maxDays) {
      return rule.stage;
    }
  }
  return null;
}

function formatDueDate(date: Date, timezone?: string | null) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone ?? 'UTC',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function isClosedStatus(status: string) {
  const normalized = status.toLowerCase();
  return CLOSED_STATUS_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

function buildSubject(stage: AlertStage, daysUntil: number) {
  if (stage === 'overdue') {
    return 'Action needed: dispute evidence overdue';
  }
  const label = daysUntil <= 1 ? '1 day' : `${daysUntil} days`;
  return `Dispute evidence due in ${label}`;
}

function buildBody(params: {
  stage: AlertStage;
  daysUntil: number;
  dueDate: string;
  disputeId: string;
  provider: string;
  status: string;
  amount?: string;
  currency?: string | null;
  donorName?: string | null;
  donorEmail?: string | null;
}) {
  const urgency =
    params.stage === 'overdue'
      ? 'Evidence deadline has passed. Please respond immediately.'
      : `Evidence deadline is ${params.dueDate} (${params.daysUntil} day${
          params.daysUntil === 1 ? '' : 's'
        } remaining).`;

  return `
    <p><strong>${urgency}</strong></p>
    <p>Dispute ${params.disputeId} (${params.provider})</p>
    <ul>
      <li>Status: ${params.status}</li>
      <li>Amount: ${params.amount ?? 'N/A'} ${params.currency ?? ''}</li>
      <li>Donor: ${params.donorName ?? 'Unknown'} ${params.donorEmail ? `(${params.donorEmail})` : ''}</li>
      <li>Due by: ${params.dueDate}</li>
    </ul>
    <p>Open FaithFlow Finance → Refunds &amp; disputes to upload evidence.</p>
  `;
}

export async function monitorDisputes(limit = 100): Promise<MonitorResult> {
  const dueDisputes = await prisma.dispute.findMany({
    where: {
      evidenceDueBy: { not: null },
    },
    include: {
      church: { include: { organization: true } },
      donation: true,
    },
    orderBy: { evidenceDueBy: 'asc' },
    take: limit,
  });

  let alerted = 0;
  let skipped = 0;
  const now = new Date();

  for (const dispute of dueDisputes) {
    if (!dispute.evidenceDueBy) {
      skipped += 1;
      continue;
    }
    if (isClosedStatus(dispute.status)) {
      skipped += 1;
      continue;
    }

    const msDiff = dispute.evidenceDueBy.getTime() - now.getTime();
    const daysUntil = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
    const stage = getAlertStage(daysUntil);
    if (!stage) {
      skipped += 1;
      continue;
    }

    const existingAlert = await prisma.auditLog.findFirst({
      where: {
        targetType: 'Dispute',
        targetId: dispute.id,
        action: `dispute.alert.${stage}`,
      },
      select: { id: true },
    });

    if (existingAlert) {
      skipped += 1;
      continue;
    }

    const staff = await prisma.staffMembership.findMany({
      where: {
        churchId: dispute.churchId,
        role: { in: [UserRole.ADMIN, UserRole.STAFF] },
      },
      include: { user: true },
    });

    const recipients = Array.from(
      new Set(
        staff
          .map((membership) => membership.user?.email)
          .filter((email): email is string => Boolean(email)),
      ),
    );

    if (!recipients.length) {
      skipped += 1;
      continue;
    }

    const dueDate = formatDueDate(dispute.evidenceDueBy, dispute.church?.timezone ?? 'UTC');
    const subject = buildSubject(stage, Math.max(daysUntil, 0));
    const body = buildBody({
      stage,
      daysUntil: Math.max(daysUntil, 0),
      dueDate,
      disputeId: dispute.id,
      provider: dispute.provider,
      status: dispute.status,
      amount: dispute.amount?.toString(),
      currency: dispute.currency ?? null,
      donorName: dispute.donation?.donorName ?? null,
      donorEmail: dispute.donation?.donorEmail ?? null,
    });

    await prisma.communicationSchedule.createMany({
      data: recipients.map((to) => ({
        churchId: dispute.churchId,
        channel: CommunicationChannel.EMAIL,
        provider: CommunicationProvider.RESEND,
        to,
        subject,
        body,
        sendAt: now,
        metadata: {
          type: 'dispute.alert',
          stage,
          disputeId: dispute.id,
        },
      })),
    });

    await recordAuditLog({
      tenantId: dispute.church?.organization.tenantId ?? null,
      churchId: dispute.churchId,
      actorType: AuditActorType.SYSTEM,
      action: `dispute.alert.${stage}`,
      targetType: 'Dispute',
      targetId: dispute.id,
      metadata: {
        stage,
        dueBy: dispute.evidenceDueBy.toISOString(),
        recipients: recipients.length,
      },
    });

    alerted += 1;
  }

  return { scanned: dueDisputes.length, alerted, skipped };
}
