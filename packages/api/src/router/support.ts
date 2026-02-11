import { TRPCError } from '@trpc/server';
import { createClerkClient } from '@clerk/backend';
import {
  AuditActorType,
  PlatformRole,
  SupportMessageAuthorType,
  SupportTicketPriority,
  SupportTicketSource,
  SupportTicketStatus,
  prisma,
} from '@faithflow-ai/database';
import { z } from 'zod';
import { router, protectedProcedure, userProcedure } from '../trpc';
import { recordAuditLog } from '../audit';
import { computeSlaDeadlines, getSupportSlaAnalytics, runSupportSlaAutomation, supportPlatformRoles } from '../support-sla';

const clerk = process.env.CLERK_SECRET_KEY ? createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }) : null;

async function requirePlatformRole(clerkUserId: string, roles: PlatformRole[]) {
  const platformUser = await prisma.platformUser.findFirst({
    where: { clerkUserId },
    include: { roles: true },
  });
  if (!platformUser) throw new TRPCError({ code: 'FORBIDDEN', message: 'Platform access required' });
  const roleSet = new Set(platformUser.roles.map((entry) => entry.role));
  if (!roles.some((role) => roleSet.has(role))) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Platform role required' });
  }
  return platformUser;
}

async function getClerkPrimaryEmail(clerkUserId: string) {
  if (!clerk) return null;
  const user = await clerk.users.getUser(clerkUserId);
  const primary = user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId);
  return primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
}

export const supportRouter = router({
  createTicket: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
        requesterName: z.string().optional(),
        requesterEmail: z.string().email().optional(),
        subject: z.string().min(4).max(200),
        description: z.string().min(10).max(5000),
        priority: z.nativeEnum(SupportTicketPriority).default(SupportTicketPriority.NORMAL),
        source: z.nativeEnum(SupportTicketSource).default(SupportTicketSource.IN_APP),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.churchId) {
        const church = await prisma.church.findFirst({
          where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
        });
        if (!church) throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      const requesterEmail = input.requesterEmail ?? (await getClerkPrimaryEmail(ctx.userId!)) ?? undefined;
      const deadlines = computeSlaDeadlines(input.priority, new Date());
      const ticket = await prisma.supportTicket.create({
        data: {
          tenantId: ctx.tenantId!,
          churchId: input.churchId,
          requesterName: input.requesterName,
          requesterEmail,
          subject: input.subject,
          description: input.description,
          priority: input.priority,
          source: input.source,
          firstResponseDueAt: deadlines.firstResponseDueAt,
          resolutionDueAt: deadlines.resolutionDueAt,
        },
      });

      await prisma.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          authorType: SupportMessageAuthorType.TENANT_USER,
          authorTenantUserId: ctx.userId!,
          body: input.description,
          isInternal: false,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: input.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'support.ticket.created',
        targetType: 'SupportTicket',
        targetId: ticket.id,
        metadata: { priority: ticket.priority, source: ticket.source },
      });

      return ticket;
    }),

  tenantTickets: protectedProcedure
    .input(
      z
        .object({
          status: z.nativeEnum(SupportTicketStatus).optional(),
          limit: z.number().int().min(1).max(200).default(100),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      return prisma.supportTicket.findMany({
        where: {
          tenantId: ctx.tenantId!,
          ...(input?.status ? { status: input.status } : {}),
        },
        include: {
          assignedTo: { select: { id: true, email: true, name: true } },
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: input?.limit ?? 100,
      });
    }),

  tenantTicketThread: protectedProcedure.input(z.object({ ticketId: z.string() })).query(async ({ input, ctx }) => {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: input.ticketId, tenantId: ctx.tenantId! },
    });
    if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });
    return prisma.supportTicketMessage.findMany({
      where: { ticketId: ticket.id, isInternal: false },
      include: {
        authorPlatformUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }),

  addTenantMessage: protectedProcedure
    .input(z.object({ ticketId: z.string(), body: z.string().min(1).max(5000) }))
    .mutation(async ({ input, ctx }) => {
      const ticket = await prisma.supportTicket.findFirst({
        where: { id: input.ticketId, tenantId: ctx.tenantId! },
      });
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });

      const message = await prisma.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          authorType: SupportMessageAuthorType.TENANT_USER,
          authorTenantUserId: ctx.userId!,
          body: input.body,
          isInternal: false,
        },
      });

      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status:
            ticket.status === SupportTicketStatus.RESOLVED || ticket.status === SupportTicketStatus.CLOSED
              ? SupportTicketStatus.OPEN
              : ticket.status,
          ...(ticket.status === SupportTicketStatus.RESOLVED || ticket.status === SupportTicketStatus.CLOSED
            ? { reopenedCount: { increment: 1 }, resolvedAt: null }
            : {}),
        },
      });

      return message;
    }),

  platformTickets: userProcedure
    .input(
      z
        .object({
          tenantId: z.string().optional(),
          status: z.nativeEnum(SupportTicketStatus).optional(),
          priority: z.nativeEnum(SupportTicketPriority).optional(),
          limit: z.number().int().min(1).max(300).default(120),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      await requirePlatformRole(ctx.userId!, [
        ...supportPlatformRoles,
      ]);

      return prisma.supportTicket.findMany({
        where: {
          ...(input?.tenantId ? { tenantId: input.tenantId } : {}),
          ...(input?.status ? { status: input.status } : {}),
          ...(input?.priority ? { priority: input.priority } : {}),
        },
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          church: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: input?.limit ?? 120,
      });
    }),

  platformTicketThread: userProcedure.input(z.object({ ticketId: z.string() })).query(async ({ input, ctx }) => {
    await requirePlatformRole(ctx.userId!, [
      ...supportPlatformRoles,
    ]);
    const ticket = await prisma.supportTicket.findUnique({ where: { id: input.ticketId } });
    if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });

    return prisma.supportTicketMessage.findMany({
      where: { ticketId: ticket.id },
      include: {
        authorPlatformUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }),

  assignPlatformTicket: userProcedure
    .input(z.object({ ticketId: z.string(), platformUserId: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const actor = await requirePlatformRole(ctx.userId!, [
        PlatformRole.SUPER_ADMIN,
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.SUPPORT_MANAGER,
      ]);

      const ticket = await prisma.supportTicket.findUnique({ where: { id: input.ticketId } });
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });

      if (input.platformUserId) {
        const assignee = await prisma.platformUser.findUnique({ where: { id: input.platformUserId } });
        if (!assignee) throw new TRPCError({ code: 'NOT_FOUND', message: 'Assignee not found' });
      }

      const updated = await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          assignedToPlatformUserId: input.platformUserId,
          status: input.platformUserId ? SupportTicketStatus.IN_PROGRESS : SupportTicketStatus.OPEN,
        },
      });

      await recordAuditLog({
        tenantId: ticket.tenantId,
        churchId: ticket.churchId ?? undefined,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'support.ticket.assigned',
        targetType: 'SupportTicket',
        targetId: ticket.id,
        metadata: { assignedToPlatformUserId: input.platformUserId ?? null },
      });

      return updated;
    }),

  updatePlatformTicket: userProcedure
    .input(
      z.object({
        ticketId: z.string(),
        status: z.nativeEnum(SupportTicketStatus).optional(),
        priority: z.nativeEnum(SupportTicketPriority).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const actor = await requirePlatformRole(ctx.userId!, [
        PlatformRole.SUPER_ADMIN,
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.SUPPORT_MANAGER,
        PlatformRole.SUPPORT_AGENT,
      ]);

      const ticket = await prisma.supportTicket.findUnique({ where: { id: input.ticketId } });
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });

      const updated = await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          ...(input.status ? { status: input.status } : {}),
          ...(input.priority
            ? {
                priority: input.priority,
                ...(ticket.firstRespondedAt ? {} : { firstResponseDueAt: computeSlaDeadlines(input.priority, ticket.createdAt).firstResponseDueAt }),
                ...(ticket.resolvedAt ? {} : { resolutionDueAt: computeSlaDeadlines(input.priority, ticket.createdAt).resolutionDueAt }),
              }
            : {}),
          ...(input.status === SupportTicketStatus.RESOLVED || input.status === SupportTicketStatus.CLOSED
            ? { resolvedAt: new Date() }
            : {}),
          ...(input.status && (ticket.status === SupportTicketStatus.RESOLVED || ticket.status === SupportTicketStatus.CLOSED) &&
          (input.status === SupportTicketStatus.OPEN ||
            input.status === SupportTicketStatus.IN_PROGRESS ||
            input.status === SupportTicketStatus.WAITING_CUSTOMER)
            ? { reopenedCount: { increment: 1 } }
            : {}),
        },
      });

      await recordAuditLog({
        tenantId: ticket.tenantId,
        churchId: ticket.churchId ?? undefined,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'support.ticket.updated',
        targetType: 'SupportTicket',
        targetId: ticket.id,
        metadata: { status: input.status ?? null, priority: input.priority ?? null },
      });

      return updated;
    }),

  addPlatformMessage: userProcedure
    .input(z.object({ ticketId: z.string(), body: z.string().min(1).max(5000), isInternal: z.boolean().default(false) }))
    .mutation(async ({ input, ctx }) => {
      const actor = await requirePlatformRole(ctx.userId!, [
        PlatformRole.SUPER_ADMIN,
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.SUPPORT_MANAGER,
        PlatformRole.SUPPORT_AGENT,
      ]);

      const ticket = await prisma.supportTicket.findUnique({ where: { id: input.ticketId } });
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });

      const message = await prisma.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          authorType: SupportMessageAuthorType.PLATFORM_USER,
          authorPlatformUserId: actor.id,
          body: input.body,
          isInternal: input.isInternal,
        },
      });

      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: input.isInternal ? ticket.status : SupportTicketStatus.WAITING_CUSTOMER,
          ...(!input.isInternal && !ticket.firstRespondedAt ? { firstRespondedAt: new Date() } : {}),
          ...(!input.isInternal &&
          !ticket.firstResponseBreachedAt &&
          !ticket.firstRespondedAt &&
          ticket.firstResponseDueAt &&
          ticket.firstResponseDueAt <= new Date()
            ? { firstResponseBreachedAt: new Date() }
            : {}),
        },
      });

      return message;
    }),

  slaAnalytics: userProcedure
    .input(
      z
        .object({
          tenantId: z.string().optional(),
          lookbackDays: z.number().int().min(1).max(120).default(30),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      await requirePlatformRole(ctx.userId!, [...supportPlatformRoles]);
      return getSupportSlaAnalytics({
        tenantId: input?.tenantId,
        lookbackDays: input?.lookbackDays ?? 30,
      });
    }),

  slaBreaches: userProcedure
    .input(
      z
        .object({
          tenantId: z.string().optional(),
          unresolvedOnly: z.boolean().default(true),
          limit: z.number().int().min(1).max(300).default(100),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      await requirePlatformRole(ctx.userId!, [...supportPlatformRoles]);
      return prisma.supportTicket.findMany({
        where: {
          ...(input?.tenantId ? { tenantId: input.tenantId } : {}),
          OR: [{ firstResponseBreachedAt: { not: null } }, { resolutionBreachedAt: { not: null } }],
          ...(input?.unresolvedOnly ? { status: { in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS, SupportTicketStatus.WAITING_CUSTOMER] } } : {}),
        },
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: input?.limit ?? 100,
      });
    }),

  runSlaSweep: userProcedure
    .input(
      z
        .object({
          tenantId: z.string().optional(),
          limit: z.number().int().min(1).max(1000).default(500),
          dryRun: z.boolean().default(false),
        })
        .optional()
    )
    .mutation(async ({ input, ctx }) => {
      await requirePlatformRole(ctx.userId!, [PlatformRole.SUPER_ADMIN, PlatformRole.PLATFORM_ADMIN, PlatformRole.SUPPORT_MANAGER]);
      return runSupportSlaAutomation({
        tenantId: input?.tenantId,
        limit: input?.limit ?? 500,
        dryRun: input?.dryRun ?? false,
      });
    }),
});
