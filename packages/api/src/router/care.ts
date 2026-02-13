import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { prisma, AuditActorType, CareRequestChannel, CareRequestPriority, CareRequestStatus } from '@faithflow-ai/database';
import { router, protectedProcedure } from '../trpc';
import { ensureFeatureReadAccess, ensureFeatureWriteAccess } from '../entitlements';
import { recordAuditLog } from '../audit';

const careRequestInput = z.object({
  churchId: z.string(),
  campusId: z.string().optional(),
  memberId: z.string().optional(),
  requestedByMemberId: z.string().optional(),
  title: z.string().min(2),
  details: z.string().optional(),
  priority: z.nativeEnum(CareRequestPriority).optional(),
  channel: z.nativeEnum(CareRequestChannel).optional(),
  dueAt: z.coerce.date().optional(),
});

export const careRouter = router({
  createRequest: protectedProcedure
    .input(careRequestInput)
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureWriteAccess(ctx.tenantId!, 'pastoral_care_enabled', 'Your subscription does not include pastoral care.');

      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });

      if (input.campusId) {
        const campus = await prisma.campus.findFirst({ where: { id: input.campusId, churchId: input.churchId } });
        if (!campus) throw new TRPCError({ code: 'NOT_FOUND', message: 'Campus not found' });
      }
      if (input.memberId) {
        const member = await prisma.member.findFirst({ where: { id: input.memberId, churchId: input.churchId } });
        if (!member) throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      const careRequest = await prisma.careRequest.create({
        data: {
          churchId: input.churchId,
          campusId: input.campusId,
          memberId: input.memberId,
          requestedByMemberId: input.requestedByMemberId,
          title: input.title,
          details: input.details,
          priority: input.priority ?? CareRequestPriority.NORMAL,
          channel: input.channel ?? CareRequestChannel.STAFF,
          dueAt: input.dueAt,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: careRequest.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'care.request_created',
        targetType: 'CareRequest',
        targetId: careRequest.id,
        metadata: {
          title: careRequest.title,
          priority: careRequest.priority,
          channel: careRequest.channel,
          memberId: careRequest.memberId,
        },
      });

      return careRequest;
    }),

  listRequests: protectedProcedure
    .input(
      z
        .object({
          churchId: z.string().optional(),
          campusId: z.string().optional(),
          status: z.nativeEnum(CareRequestStatus).optional(),
          priority: z.nativeEnum(CareRequestPriority).optional(),
          limit: z.number().int().min(1).max(200).default(100),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      await ensureFeatureReadAccess(ctx.tenantId!, 'pastoral_care_enabled', 'Your subscription does not include pastoral care.');

      return prisma.careRequest.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input?.churchId ? { churchId: input.churchId } : {}),
          ...(input?.campusId ? { campusId: input.campusId } : {}),
          ...(input?.status ? { status: input.status } : {}),
          ...(input?.priority ? { priority: input.priority } : {}),
        },
        include: {
          member: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          requestedByMember: { select: { id: true, firstName: true, lastName: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          notes: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: input?.limit ?? 100,
      });
    }),

  assignRequest: protectedProcedure
    .input(z.object({ id: z.string(), assignedToUserId: z.string().optional(), status: z.nativeEnum(CareRequestStatus).optional() }))
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureWriteAccess(ctx.tenantId!, 'pastoral_care_enabled', 'Your subscription does not include pastoral care.');

      const request = await prisma.careRequest.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Care request not found' });

      if (input.assignedToUserId) {
        const user = await prisma.user.findFirst({
          where: {
            id: input.assignedToUserId,
            memberships: { some: { church: { organization: { tenantId: ctx.tenantId! } } } },
          },
        });
        if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'Assignee not found' });
      }

      const nextStatus =
        input.status ??
        (input.assignedToUserId
          ? CareRequestStatus.ASSIGNED
          : request.status);

      const updated = await prisma.careRequest.update({
        where: { id: request.id },
        data: {
          assignedToUserId: input.assignedToUserId,
          assignedAt: input.assignedToUserId ? new Date() : request.assignedAt,
          status: nextStatus,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: updated.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'care.request_assigned',
        targetType: 'CareRequest',
        targetId: updated.id,
        metadata: { assignedToUserId: updated.assignedToUserId, status: updated.status },
      });

      return updated;
    }),

  addNote: protectedProcedure
    .input(z.object({ careRequestId: z.string(), note: z.string().min(1), isPrivate: z.boolean().optional() }))
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureWriteAccess(ctx.tenantId!, 'pastoral_care_enabled', 'Your subscription does not include pastoral care.');

      const request = await prisma.careRequest.findFirst({
        where: { id: input.careRequestId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Care request not found' });

      const authorUser = ctx.userId ? await prisma.user.findUnique({ where: { clerkUserId: ctx.userId } }) : null;

      const note = await prisma.careNote.create({
        data: {
          careRequestId: input.careRequestId,
          authorUserId: authorUser?.id,
          note: input.note,
          isPrivate: input.isPrivate ?? true,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: request.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'care.note_added',
        targetType: 'CareNote',
        targetId: note.id,
        metadata: { careRequestId: request.id, isPrivate: note.isPrivate },
      });

      return note;
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: z.nativeEnum(CareRequestStatus) }))
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureWriteAccess(ctx.tenantId!, 'pastoral_care_enabled', 'Your subscription does not include pastoral care.');

      const request = await prisma.careRequest.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Care request not found' });
      const isClosedStatus =
        input.status === CareRequestStatus.CLOSED || input.status === CareRequestStatus.ARCHIVED;

      const updated = await prisma.careRequest.update({
        where: { id: request.id },
        data: {
          status: input.status,
          closedAt: isClosedStatus ? new Date() : null,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: updated.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'care.status_updated',
        targetType: 'CareRequest',
        targetId: updated.id,
        metadata: { status: updated.status },
      });

      return updated;
    }),

  dashboard: protectedProcedure
    .input(z.object({ churchId: z.string().optional(), campusId: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      await ensureFeatureReadAccess(ctx.tenantId!, 'pastoral_care_enabled', 'Your subscription does not include pastoral care.');

      const where = {
        church: { organization: { tenantId: ctx.tenantId! } },
        ...(input?.churchId ? { churchId: input.churchId } : {}),
        ...(input?.campusId ? { campusId: input.campusId } : {}),
      };

      const [byStatus, byPriority, overdue, activeCases] = await Promise.all([
        prisma.careRequest.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        }),
        prisma.careRequest.groupBy({
          by: ['priority'],
          where,
          _count: { _all: true },
        }),
        prisma.careRequest.count({
          where: { ...where, dueAt: { lt: new Date() }, status: { in: [CareRequestStatus.OPEN, CareRequestStatus.ASSIGNED, CareRequestStatus.IN_PROGRESS] } },
        }),
        prisma.careRequest.count({
          where: { ...where, status: { in: [CareRequestStatus.OPEN, CareRequestStatus.ASSIGNED, CareRequestStatus.IN_PROGRESS] } },
        }),
      ]);

      return { byStatus, byPriority, overdue, activeCases };
    }),
});
