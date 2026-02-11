import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { GroupMemberRole, GroupStatus, GroupType, prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';

const createGroupSchema = z.object({
  churchId: z.string(),
  name: z.string().min(1),
  type: z.nativeEnum(GroupType).optional(),
  status: z.nativeEnum(GroupStatus).optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  meetingSchedule: z.string().optional(),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.nativeEnum(GroupType).optional(),
  status: z.nativeEnum(GroupStatus).optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  meetingSchedule: z.string().optional(),
});

export const groupRouter = router({
  create: protectedProcedure
    .input(createGroupSchema)
    .mutation(async ({ input, ctx }) => {
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      return prisma.group.create({
        data: {
          churchId: input.churchId,
          name: input.name,
          type: input.type ?? GroupType.SMALL_GROUP,
          status: input.status ?? GroupStatus.ACTIVE,
          description: input.description,
          location: input.location,
          meetingSchedule: input.meetingSchedule,
        },
      });
    }),

  list: protectedProcedure
    .input(z.object({ churchId: z.string().optional(), limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ input, ctx }) => {
      return prisma.group.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        include: {
          members: { include: { member: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: updateGroupSchema }))
    .mutation(async ({ input, ctx }) => {
      const group = await prisma.group.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
      }

      return prisma.group.update({
        where: { id: input.id },
        data: input.data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const group = await prisma.group.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
      }

      return prisma.group.delete({ where: { id: input.id } });
    }),

  addMember: protectedProcedure
    .input(z.object({ groupId: z.string(), memberId: z.string(), role: z.nativeEnum(GroupMemberRole).optional() }))
    .mutation(async ({ input, ctx }) => {
      const group = await prisma.group.findFirst({
        where: { id: input.groupId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
      }

      const member = await prisma.member.findFirst({
        where: { id: input.memberId, churchId: group.churchId },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      return prisma.groupMember.upsert({
        where: { groupId_memberId: { groupId: group.id, memberId: member.id } },
        update: { role: input.role ?? GroupMemberRole.MEMBER },
        create: {
          groupId: group.id,
          memberId: member.id,
          role: input.role ?? GroupMemberRole.MEMBER,
        },
      });
    }),

  removeMember: protectedProcedure
    .input(z.object({ groupId: z.string(), memberId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const group = await prisma.group.findFirst({
        where: { id: input.groupId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
      }

      return prisma.groupMember.deleteMany({
        where: { groupId: input.groupId, memberId: input.memberId },
      });
    }),

  events: protectedProcedure
    .input(z.object({ groupId: z.string(), limit: z.number().min(1).max(200).default(25) }))
    .query(async ({ input, ctx }) => {
      const group = await prisma.group.findFirst({
        where: { id: input.groupId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
      }

      return prisma.event.findMany({
        where: { groupId: input.groupId },
        orderBy: { startAt: 'desc' },
        take: input.limit,
      });
    }),

  engagementSummary: protectedProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ input, ctx }) => {
      const group = await prisma.group.findFirst({
        where: { id: input.groupId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
      }

      const memberCount = await prisma.groupMember.count({
        where: { groupId: input.groupId },
      });

      const events = await prisma.event.findMany({
        where: { groupId: input.groupId },
        orderBy: { startAt: 'desc' },
        take: 10,
        select: { id: true, startAt: true, endAt: true, title: true },
      });

      const eventIds = events.map((event) => event.id);
      const attendanceCount = eventIds.length
        ? await prisma.attendance.count({
            where: { eventId: { in: eventIds } },
          })
        : 0;

      const lastEvent = events[0] ?? null;

      return {
        memberCount,
        recentEvents: events,
        lastEvent,
        attendanceCount,
      };
    }),
});
