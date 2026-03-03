import { router, publicProcedure } from '../trpc';
import { prisma } from '@faithflow/database';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { subMonths, startOfMonth, endOfMonth } from 'date-fns';

export const analyticsRouter = router({
  overview: publicProcedure
    .input(z.object({
      churchId: z.string(),
      months: z.number().min(1).max(12).default(6),
    }))
    .query(async ({ input }) => {
      try {
        // Get current stats
        const [
          totalMembers,
          activeEvents,
          totalGroups,
          totalAttendance,
        ] = await Promise.all([
          prisma.member.count({
            where: { churchId: input.churchId },
          }),
          prisma.event.count({
            where: {
              churchId: input.churchId,
              endDate: { gt: new Date() },
            },
          }),
          prisma.smallGroup.count({
            where: { churchId: input.churchId },
          }),
          prisma.event.findMany({
            where: {
              churchId: input.churchId,
              endDate: { lt: new Date() },
            },
            include: {
              _count: {
                select: { attendees: true },
              },
            },
          }).then(events => {
            const totalEvents = events.length;
            const totalAttendees = events.reduce((sum, event) => sum + event._count.attendees, 0);
            return totalEvents > 0 ? Math.round((totalAttendees / totalEvents) * 100) : 0;
          }),
        ]);

        // Get member growth data
        const memberGrowth = await Promise.all(
          Array.from({ length: input.months }).map(async (_, i) => {
            const date = subMonths(new Date(), i);
            const start = startOfMonth(date);
            const end = endOfMonth(date);

            const count = await prisma.member.count({
              where: {
                churchId: input.churchId,
                createdAt: {
                  gte: start,
                  lte: end,
                },
              },
            });

            return {
              date: start.toISOString().split('T')[0],
              count,
            };
          })
        );

        // Get event attendance data
        const eventAttendance = await prisma.event.findMany({
          where: {
            churchId: input.churchId,
            endDate: { lt: new Date() },
          },
          orderBy: { startDate: 'desc' },
          take: 10,
          include: {
            _count: {
              select: { attendees: true },
            },
          },
        }).then(events =>
          events.map(event => ({
            event: event.title,
            attendance: event._count.attendees,
          }))
        );

        return {
          total_members: totalMembers,
          active_events: activeEvents,
          total_groups: totalGroups,
          attendance_rate: totalAttendance,
          memberGrowth: memberGrowth.reverse(),
          eventAttendance,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch analytics',
          cause: error,
        });
      }
    }),
});
