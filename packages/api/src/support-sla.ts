import {
  AuditActorType,
  PlatformRole,
  SupportTicketPriority,
  SupportTicketStatus,
  prisma,
} from '@faithflow-ai/database';
import { recordAuditLog } from './audit';

const openStatuses = [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS, SupportTicketStatus.WAITING_CUSTOMER] as const;

const slaPolicy: Record<SupportTicketPriority, { firstResponseHours: number; resolutionHours: number }> = {
  LOW: { firstResponseHours: 24, resolutionHours: 120 },
  NORMAL: { firstResponseHours: 8, resolutionHours: 72 },
  HIGH: { firstResponseHours: 4, resolutionHours: 24 },
  URGENT: { firstResponseHours: 1, resolutionHours: 8 },
};

export function getSlaPolicy(priority: SupportTicketPriority) {
  return slaPolicy[priority];
}

export function computeSlaDeadlines(priority: SupportTicketPriority, from = new Date()) {
  const policy = getSlaPolicy(priority);
  return {
    firstResponseDueAt: new Date(from.getTime() + policy.firstResponseHours * 60 * 60 * 1000),
    resolutionDueAt: new Date(from.getTime() + policy.resolutionHours * 60 * 60 * 1000),
  };
}

function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export async function runSupportSlaAutomation(options?: {
  tenantId?: string;
  limit?: number;
  dryRun?: boolean;
}) {
  const now = new Date();
  const tickets = await prisma.supportTicket.findMany({
    where: {
      ...(options?.tenantId ? { tenantId: options.tenantId } : {}),
      status: { in: openStatuses as unknown as SupportTicketStatus[] },
    },
    orderBy: { updatedAt: 'asc' },
    take: options?.limit ?? 500,
  });

  let firstResponseBreaches = 0;
  let resolutionBreaches = 0;
  let touched = 0;
  const breachedTicketIds: string[] = [];

  for (const ticket of tickets) {
    const firstResponseBreached =
      !ticket.firstRespondedAt &&
      !!ticket.firstResponseDueAt &&
      ticket.firstResponseDueAt <= now &&
      !ticket.firstResponseBreachedAt;
    const resolutionBreached =
      !!ticket.resolutionDueAt && ticket.resolutionDueAt <= now && !ticket.resolutionBreachedAt;

    if (!firstResponseBreached && !resolutionBreached) {
      if (!options?.dryRun) {
        await prisma.supportTicket.update({
          where: { id: ticket.id },
          data: { lastSlaCheckAt: now },
        });
      }
      continue;
    }

    firstResponseBreaches += firstResponseBreached ? 1 : 0;
    resolutionBreaches += resolutionBreached ? 1 : 0;
    breachedTicketIds.push(ticket.id);
    touched += 1;

    if (!options?.dryRun) {
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          ...(firstResponseBreached ? { firstResponseBreachedAt: now } : {}),
          ...(resolutionBreached ? { resolutionBreachedAt: now } : {}),
          lastSlaCheckAt: now,
        },
      });

      await recordAuditLog({
        tenantId: ticket.tenantId,
        churchId: ticket.churchId ?? undefined,
        actorType: AuditActorType.SYSTEM,
        action: 'support.ticket.sla_breached',
        targetType: 'SupportTicket',
        targetId: ticket.id,
        metadata: {
          firstResponseBreached,
          resolutionBreached,
          priority: ticket.priority,
          status: ticket.status,
        },
      });
    }
  }

  return {
    scanned: tickets.length,
    touched,
    firstResponseBreaches,
    resolutionBreaches,
    breachedTicketIds,
    dryRun: Boolean(options?.dryRun),
  };
}

export async function getSupportSlaAnalytics(options?: { tenantId?: string; lookbackDays?: number }) {
  const now = new Date();
  const lookbackDays = options?.lookbackDays ?? 30;
  const from = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  const tickets = await prisma.supportTicket.findMany({
    where: {
      ...(options?.tenantId ? { tenantId: options.tenantId } : {}),
      createdAt: { gte: from },
    },
    select: {
      id: true,
      status: true,
      priority: true,
      createdAt: true,
      firstRespondedAt: true,
      resolvedAt: true,
      firstResponseBreachedAt: true,
      resolutionBreachedAt: true,
      reopenedCount: true,
    },
  });

  const openTickets = tickets.filter((ticket) => openStatuses.includes(ticket.status as (typeof openStatuses)[number]));
  const firstResponseSamples = tickets
    .filter((ticket) => ticket.firstRespondedAt)
    .map((ticket) => minutesBetween(ticket.createdAt, ticket.firstRespondedAt!));
  const resolutionSamples = tickets
    .filter((ticket) => ticket.resolvedAt)
    .map((ticket) => minutesBetween(ticket.createdAt, ticket.resolvedAt!));

  const priorityQueue = (Object.keys(slaPolicy) as Array<keyof typeof slaPolicy>).map((priority) => {
    const queue = openTickets.filter((ticket) => ticket.priority === priority);
    const oldestMinutes = queue.length ? minutesBetween(queue.reduce((oldest, item) => (item.createdAt < oldest ? item.createdAt : oldest), queue[0].createdAt), now) : 0;
    return {
      priority,
      openCount: queue.length,
      oldestMinutes,
    };
  });

  return {
    lookbackDays,
    totals: {
      created: tickets.length,
      open: openTickets.length,
      resolved: tickets.filter((ticket) => ticket.status === SupportTicketStatus.RESOLVED || ticket.status === SupportTicketStatus.CLOSED)
        .length,
      breachedFirstResponse: tickets.filter((ticket) => ticket.firstResponseBreachedAt !== null).length,
      breachedResolution: tickets.filter((ticket) => ticket.resolutionBreachedAt !== null).length,
      reopened: tickets.filter((ticket) => ticket.reopenedCount > 0).length,
    },
    averages: {
      firstResponseMinutes: firstResponseSamples.length
        ? Math.round(firstResponseSamples.reduce((sum, value) => sum + value, 0) / firstResponseSamples.length)
        : null,
      resolutionMinutes: resolutionSamples.length
        ? Math.round(resolutionSamples.reduce((sum, value) => sum + value, 0) / resolutionSamples.length)
        : null,
    },
    priorityQueue,
  };
}

export const supportPlatformRoles = [
  PlatformRole.SUPER_ADMIN,
  PlatformRole.PLATFORM_ADMIN,
  PlatformRole.SUPPORT_MANAGER,
  PlatformRole.SUPPORT_AGENT,
  PlatformRole.OPERATIONS_MANAGER,
] as const;
