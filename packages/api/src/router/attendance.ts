import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { emitRealtimeEvent } from '../realtime';

export const attendanceRouter = router({
  checkIn: protectedProcedure
    .input(z.object({ eventId: z.string(), memberId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: {
          id: input.eventId,
          church: { organization: { tenantId: ctx.tenantId! } },
        },
      });

      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      const member = await prisma.member.findFirst({
        where: {
          id: input.memberId,
          church: { organization: { tenantId: ctx.tenantId! } },
        },
      });

      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      const existing = await prisma.attendance.findFirst({
        where: { eventId: input.eventId, memberId: input.memberId },
      });

      const attendance = existing
        ? await prisma.attendance.update({
            where: { id: existing.id },
            data: { status: 'CHECKED_IN', checkInAt: new Date() },
          })
        : await prisma.attendance.create({
            data: {
              eventId: input.eventId,
              memberId: input.memberId,
              status: 'CHECKED_IN',
              checkInAt: new Date(),
            },
          });

      emitRealtimeEvent({
        type: 'attendance.checked_in',
        data: {
          eventId: input.eventId,
          memberId: input.memberId,
          churchId: event.churchId,
          tenantId: ctx.tenantId,
        },
      });

      return attendance;
    }),

  checkOut: protectedProcedure
    .input(z.object({ eventId: z.string(), memberId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: {
          id: input.eventId,
          church: { organization: { tenantId: ctx.tenantId! } },
        },
      });

      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      const attendance = await prisma.attendance.findFirst({
        where: { eventId: input.eventId, memberId: input.memberId },
      });

      if (!attendance) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Attendance record not found' });
      }

      return prisma.attendance.update({
        where: { id: attendance.id },
        data: { status: 'CHECKED_OUT', checkOutAt: new Date() },
      });
    }),

  bulkCheckIn: protectedProcedure
    .input(z.object({ eventId: z.string(), memberIds: z.array(z.string()).min(1) }))
    .mutation(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: {
          id: input.eventId,
          church: { organization: { tenantId: ctx.tenantId! } },
        },
      });

      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      const members = await prisma.member.findMany({
        where: {
          id: { in: input.memberIds },
          churchId: event.churchId,
        },
      });

      if (!members.length) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No valid members found' });
      }

      const results = await prisma.$transaction(
        members.map((member) =>
          prisma.attendance.upsert({
            where: { eventId_memberId: { eventId: event.id, memberId: member.id } },
            update: { status: 'CHECKED_IN', checkInAt: new Date(), checkOutAt: null },
            create: {
              eventId: event.id,
              memberId: member.id,
              status: 'CHECKED_IN',
              checkInAt: new Date(),
            },
          })
        )
      );

      emitRealtimeEvent({
        type: 'attendance.checked_in',
        data: {
          eventId: input.eventId,
          memberId: null,
          churchId: event.churchId,
          tenantId: ctx.tenantId,
        },
      });

      return { count: results.length };
    }),

  listByEvent: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input, ctx }) => {
      return prisma.attendance.findMany({
        where: {
          eventId: input.eventId,
          event: { church: { organization: { tenantId: ctx.tenantId! } } },
        },
        include: { member: true },
      });
    }),

  eventRoster: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        query: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: {
          id: input.eventId,
          church: { organization: { tenantId: ctx.tenantId! } },
        },
      });

      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      const attendance = await prisma.attendance.findMany({
        where: { eventId: event.id },
      });
      const attendanceMap = new Map(attendance.map((entry) => [entry.memberId, entry]));
      const rsvpTotals = await prisma.eventRsvp.aggregate({
        where: { eventId: event.id, status: 'GOING' },
        _count: { _all: true },
        _sum: { guestCount: true },
      });

      const query = input.query?.trim();
      const members = await prisma.member.findMany({
        where: {
          churchId: event.churchId,
          ...(query
            ? {
                OR: [
                  { firstName: { contains: query, mode: 'insensitive' } },
                  { lastName: { contains: query, mode: 'insensitive' } },
                  { preferredName: { contains: query, mode: 'insensitive' } },
                  { email: { contains: query, mode: 'insensitive' } },
                  { phone: { contains: query, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        take: input.limit,
      });

      const roster = members.map((member) => {
        const entry = attendanceMap.get(member.id);
        return {
          member,
          status: entry?.status ?? 'NOT_CHECKED_IN',
          checkInAt: entry?.checkInAt ?? null,
          checkOutAt: entry?.checkOutAt ?? null,
        };
      });

      return {
        event,
        roster,
        checkedInCount: attendance.filter((entry) => entry.status === 'CHECKED_IN').length,
        rsvpGoingCount: (rsvpTotals._count._all ?? 0) + (rsvpTotals._sum.guestCount ?? 0),
      };
    }),

  kioskRoster: publicProcedure
    .input(
      z.object({
        eventId: z.string(),
        code: z.string(),
        query: z.string().optional(),
        limit: z.number().min(1).max(500).default(200),
      })
    )
    .query(async ({ input }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, checkInEnabled: true, checkInCode: input.code },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Kiosk access denied' });
      }

      const attendance = await prisma.attendance.findMany({
        where: { eventId: event.id },
      });
      const attendanceMap = new Map(attendance.map((entry) => [entry.memberId, entry]));

      const query = input.query?.trim();
      const members = await prisma.member.findMany({
        where: {
          churchId: event.churchId,
          ...(query
            ? {
                OR: [
                  { firstName: { contains: query, mode: 'insensitive' } },
                  { lastName: { contains: query, mode: 'insensitive' } },
                  { preferredName: { contains: query, mode: 'insensitive' } },
                  { email: { contains: query, mode: 'insensitive' } },
                  { phone: { contains: query, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        take: input.limit,
      });

      const roster = members.map((member) => {
        const entry = attendanceMap.get(member.id);
        return {
          member,
          status: entry?.status ?? 'NOT_CHECKED_IN',
          checkInAt: entry?.checkInAt ?? null,
          checkOutAt: entry?.checkOutAt ?? null,
        };
      });

      const totalCount = await prisma.member.count({
        where: {
          churchId: event.churchId,
          ...(query
            ? {
                OR: [
                  { firstName: { contains: query, mode: 'insensitive' } },
                  { lastName: { contains: query, mode: 'insensitive' } },
                  { preferredName: { contains: query, mode: 'insensitive' } },
                  { email: { contains: query, mode: 'insensitive' } },
                  { phone: { contains: query, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
      });

      return { event, roster, totalCount };
    }),

  kioskCheckIn: publicProcedure
    .input(z.object({ eventId: z.string(), code: z.string(), memberId: z.string() }))
    .mutation(async ({ input }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, checkInEnabled: true, checkInCode: input.code },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Kiosk access denied' });
      }

      const member = await prisma.member.findFirst({
        where: { id: input.memberId, churchId: event.churchId },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      const attendance = await prisma.attendance.upsert({
        where: { eventId_memberId: { eventId: event.id, memberId: member.id } },
        update: { status: 'CHECKED_IN', checkInAt: new Date(), checkOutAt: null },
        create: {
          eventId: event.id,
          memberId: member.id,
          status: 'CHECKED_IN',
          checkInAt: new Date(),
        },
      });

      emitRealtimeEvent({
        type: 'attendance.checked_in',
        data: {
          eventId: event.id,
          memberId: member.id,
          churchId: event.churchId,
          tenantId: null,
        },
      });

      return attendance;
    }),

  kioskCheckOut: publicProcedure
    .input(z.object({ eventId: z.string(), code: z.string(), memberId: z.string() }))
    .mutation(async ({ input }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, checkInEnabled: true, checkInCode: input.code },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Kiosk access denied' });
      }

      const attendance = await prisma.attendance.findFirst({
        where: { eventId: event.id, memberId: input.memberId },
      });
      if (!attendance) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Attendance record not found' });
      }

      return prisma.attendance.update({
        where: { id: attendance.id },
        data: { status: 'CHECKED_OUT', checkOutAt: new Date() },
      });
    }),

  checkInBadge: protectedProcedure
    .input(z.object({ badgeCode: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const badge = await prisma.eventBadge.findFirst({
        where: { badgeCode: input.badgeCode, event: { church: { organization: { tenantId: ctx.tenantId! } } } },
        include: { event: true },
      });
      if (!badge) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Badge not found' });
      }

      if (badge.status === 'REVOKED') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Badge revoked' });
      }

      if (badge.memberId) {
        await prisma.attendance.upsert({
          where: { eventId_memberId: { eventId: badge.eventId, memberId: badge.memberId } },
          update: { status: 'CHECKED_IN', checkInAt: new Date(), checkOutAt: null },
          create: {
            eventId: badge.eventId,
            memberId: badge.memberId,
            status: 'CHECKED_IN',
            checkInAt: new Date(),
          },
        });
      }

      await prisma.eventBadge.update({
        where: { id: badge.id },
        data: { status: 'USED', usedAt: new Date() },
      });

      emitRealtimeEvent({
        type: 'attendance.checked_in',
        data: {
          eventId: badge.eventId,
          memberId: badge.memberId ?? null,
          churchId: badge.event.churchId,
          tenantId: ctx.tenantId,
        },
      });

      return { badgeId: badge.id, memberId: badge.memberId };
    }),

  kioskCheckInBadge: publicProcedure
    .input(z.object({ eventId: z.string(), code: z.string(), badgeCode: z.string() }))
    .mutation(async ({ input }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, checkInEnabled: true, checkInCode: input.code },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Kiosk access denied' });
      }

      const badge = await prisma.eventBadge.findFirst({
        where: { badgeCode: input.badgeCode, eventId: event.id },
      });
      if (!badge) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Badge not found' });
      }

      if (badge.status === 'REVOKED') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Badge revoked' });
      }

      if (badge.memberId) {
        await prisma.attendance.upsert({
          where: { eventId_memberId: { eventId: event.id, memberId: badge.memberId } },
          update: { status: 'CHECKED_IN', checkInAt: new Date(), checkOutAt: null },
          create: {
            eventId: event.id,
            memberId: badge.memberId,
            status: 'CHECKED_IN',
            checkInAt: new Date(),
          },
        });
      }

      await prisma.eventBadge.update({
        where: { id: badge.id },
        data: { status: 'USED', usedAt: new Date() },
      });

      emitRealtimeEvent({
        type: 'attendance.checked_in',
        data: {
          eventId: event.id,
          memberId: badge.memberId ?? null,
          churchId: event.churchId,
          tenantId: null,
        },
      });

      return { badgeId: badge.id, memberId: badge.memberId };
    }),
});
