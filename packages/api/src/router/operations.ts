import { z } from 'zod';
import { Prisma, prisma, CareRequestStatus, SermonStatus } from '@faithflow-ai/database';
import { router, protectedProcedure } from '../trpc';
import { ensureFeatureEnabled } from '../entitlements';

const rangeInput = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    churchId: z.string().optional(),
  })
  .optional();

const defaultFrom = () => new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
const defaultTo = () => new Date();
const activeCareStatuses: CareRequestStatus[] = [
  CareRequestStatus.OPEN,
  CareRequestStatus.ASSIGNED,
  CareRequestStatus.IN_PROGRESS,
];

export const operationsRouter = router({
  headquartersSummary: protectedProcedure.input(rangeInput).query(async ({ input, ctx }) => {
    await ensureFeatureEnabled(
      ctx.tenantId!,
      'multi_campus_enabled',
      'Your subscription does not include multi-campus operations.'
    );

    const from = input?.from ?? defaultFrom();
    const to = input?.to ?? defaultTo();
    const churchFilter = input?.churchId ? { churchId: input.churchId } : {};
    const tenantChurchWhere = { organization: { tenantId: ctx.tenantId! } };

    const [organizations, churches, campuses, members, events, attendance, donations, facilities, bookings, careRequests, sermons] =
      await Promise.all([
        prisma.organization.count({ where: { tenantId: ctx.tenantId! } }),
        prisma.church.count({ where: tenantChurchWhere }),
        prisma.campus.count({ where: { church: tenantChurchWhere } }),
        prisma.member.count({ where: { church: tenantChurchWhere } }),
        prisma.event.count({
          where: {
            church: tenantChurchWhere,
            ...churchFilter,
            startAt: { gte: from, lte: to },
          },
        }),
        prisma.attendance.count({
          where: {
            event: {
              church: tenantChurchWhere,
              ...churchFilter,
              startAt: { gte: from, lte: to },
            },
          },
        }),
        prisma.donation.aggregate({
          where: {
            church: tenantChurchWhere,
            ...churchFilter,
            status: 'COMPLETED',
            createdAt: { gte: from, lte: to },
          },
          _count: { _all: true },
          _sum: { amount: true },
        }),
        prisma.facility.count({ where: { church: tenantChurchWhere, ...(input?.churchId ? { churchId: input.churchId } : {}) } }),
        prisma.facilityBooking.count({
          where: {
            church: tenantChurchWhere,
            ...(input?.churchId ? { churchId: input.churchId } : {}),
            startAt: { gte: from, lte: to },
          },
        }),
        prisma.careRequest.count({
          where: {
            church: tenantChurchWhere,
            ...(input?.churchId ? { churchId: input.churchId } : {}),
            createdAt: { gte: from, lte: to },
          },
        }),
        prisma.sermon.count({
          where: {
            church: tenantChurchWhere,
            ...(input?.churchId ? { churchId: input.churchId } : {}),
            status: SermonStatus.PUBLISHED,
            createdAt: { gte: from, lte: to },
          },
        }),
      ]);

    return {
      from,
      to,
      totals: {
        organizations,
        churches,
        campuses,
        members,
        events,
        attendance,
        donationCount: donations._count._all,
        donationAmount: donations._sum.amount ?? new Prisma.Decimal(0),
        facilities,
        facilityBookings: bookings,
        careRequests,
        publishedSermons: sermons,
      },
    };
  }),

  campusPerformance: protectedProcedure.input(rangeInput).query(async ({ input, ctx }) => {
    await ensureFeatureEnabled(
      ctx.tenantId!,
      'multi_campus_enabled',
      'Your subscription does not include multi-campus operations.'
    );

    const from = input?.from ?? defaultFrom();
    const to = input?.to ?? defaultTo();

    const campuses = await prisma.campus.findMany({
      where: {
        church: { organization: { tenantId: ctx.tenantId! } },
        ...(input?.churchId ? { churchId: input.churchId } : {}),
      },
      include: {
        events: {
          where: { startAt: { gte: from, lte: to } },
          select: { id: true },
        },
        facilities: {
          include: {
            bookings: {
              where: {
                startAt: { gte: from, lte: to },
              },
              select: { id: true, startAt: true, endAt: true, status: true },
            },
          },
        },
        careRequests: {
          where: { createdAt: { gte: from, lte: to } },
          select: { id: true, status: true, priority: true },
        },
        sermons: {
          where: { createdAt: { gte: from, lte: to } },
          select: { id: true, status: true, viewCount: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const eventIds = campuses.flatMap((campus) => campus.events.map((event) => event.id));
    const attendanceByEvent = eventIds.length
      ? await prisma.attendance.groupBy({
          by: ['eventId'],
          where: { eventId: { in: eventIds } },
          _count: { _all: true },
        })
      : [];
    const attendanceMap = new Map(attendanceByEvent.map((entry) => [entry.eventId, entry._count._all]));

    return campuses.map((campus) => {
      const eventCount = campus.events.length;
      const attendanceCount = campus.events.reduce((sum, event) => sum + (attendanceMap.get(event.id) ?? 0), 0);
      const bookedHours = campus.facilities.reduce((sum, facility) => {
        return (
          sum +
          facility.bookings.reduce((facilityTotal, booking) => {
            if (booking.endAt <= booking.startAt) return facilityTotal;
            return facilityTotal + (booking.endAt.getTime() - booking.startAt.getTime()) / (1000 * 60 * 60);
          }, 0)
        );
      }, 0);
      const openCareRequests = campus.careRequests.filter((request) =>
        activeCareStatuses.includes(request.status)
      ).length;
      const publishedSermons = campus.sermons.filter((sermon) => sermon.status === SermonStatus.PUBLISHED).length;
      const sermonViews = campus.sermons.reduce((sum, sermon) => sum + sermon.viewCount, 0);

      return {
        campusId: campus.id,
        campusName: campus.name,
        churchId: campus.churchId,
        eventCount,
        attendanceCount,
        facilityCount: campus.facilities.length,
        bookedHours,
        careRequestCount: campus.careRequests.length,
        openCareRequests,
        publishedSermons,
        sermonViews,
      };
    });
  }),
});
