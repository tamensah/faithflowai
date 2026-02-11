import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { prisma, AuditActorType, FacilityType, FacilityBookingStatus } from '@faithflow-ai/database';
import { router, protectedProcedure } from '../trpc';
import { ensureFeatureEnabled } from '../entitlements';
import { recordAuditLog } from '../audit';

const facilityInput = z.object({
  churchId: z.string(),
  campusId: z.string().optional(),
  name: z.string().min(2),
  type: z.nativeEnum(FacilityType).optional(),
  description: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  location: z.string().optional(),
  isActive: z.boolean().optional(),
});

const bookingInput = z
  .object({
    churchId: z.string(),
    facilityId: z.string(),
    eventId: z.string().optional(),
    title: z.string().min(2),
    description: z.string().optional(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    notes: z.string().optional(),
    status: z.nativeEnum(FacilityBookingStatus).optional(),
  })
  .refine((input) => input.endAt > input.startAt, {
    path: ['endAt'],
    message: 'endAt must be after startAt',
  });

export const facilityRouter = router({
  list: protectedProcedure
    .input(z.object({ churchId: z.string().optional(), campusId: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      return prisma.facility.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input?.churchId ? { churchId: input.churchId } : {}),
          ...(input?.campusId ? { campusId: input.campusId } : {}),
        },
        orderBy: [{ churchId: 'asc' }, { name: 'asc' }],
      });
    }),

  create: protectedProcedure
    .input(facilityInput)
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureEnabled(
        ctx.tenantId!,
        'facility_management_enabled',
        'Your subscription does not include facility management.'
      );
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });

      if (input.campusId) {
        const campus = await prisma.campus.findFirst({ where: { id: input.campusId, churchId: church.id } });
        if (!campus) throw new TRPCError({ code: 'NOT_FOUND', message: 'Campus not found' });
      }

      const facility = await prisma.facility.create({
        data: {
          churchId: input.churchId,
          campusId: input.campusId,
          name: input.name,
          type: input.type ?? FacilityType.OTHER,
          description: input.description,
          capacity: input.capacity,
          location: input.location,
          isActive: input.isActive ?? true,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: facility.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'facility.created',
        targetType: 'Facility',
        targetId: facility.id,
        metadata: { name: facility.name, type: facility.type, campusId: facility.campusId },
      });

      return facility;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).optional(),
        type: z.nativeEnum(FacilityType).optional(),
        description: z.string().optional(),
        capacity: z.number().int().positive().optional(),
        location: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureEnabled(
        ctx.tenantId!,
        'facility_management_enabled',
        'Your subscription does not include facility management.'
      );
      const facility = await prisma.facility.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!facility) throw new TRPCError({ code: 'NOT_FOUND', message: 'Facility not found' });

      const updated = await prisma.facility.update({
        where: { id: facility.id },
        data: {
          name: input.name,
          type: input.type,
          description: input.description,
          capacity: input.capacity,
          location: input.location,
          isActive: input.isActive,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: updated.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'facility.updated',
        targetType: 'Facility',
        targetId: updated.id,
        metadata: { name: updated.name, type: updated.type, isActive: updated.isActive },
      });

      return updated;
    }),

  listBookings: protectedProcedure
    .input(
      z
        .object({
          churchId: z.string().optional(),
          facilityId: z.string().optional(),
          campusId: z.string().optional(),
          from: z.coerce.date().optional(),
          to: z.coerce.date().optional(),
          limit: z.number().int().min(1).max(300).default(100),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      return prisma.facilityBooking.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input?.churchId ? { churchId: input.churchId } : {}),
          ...(input?.facilityId ? { facilityId: input.facilityId } : {}),
          ...(input?.campusId ? { facility: { campusId: input.campusId } } : {}),
          ...(input?.from ? { endAt: { gte: input.from } } : {}),
          ...(input?.to ? { startAt: { lte: input.to } } : {}),
        },
        include: {
          facility: true,
          event: { select: { id: true, title: true, campusId: true } },
        },
        orderBy: { startAt: 'asc' },
        take: input?.limit ?? 100,
      });
    }),

  createBooking: protectedProcedure
    .input(bookingInput)
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureEnabled(
        ctx.tenantId!,
        'facility_management_enabled',
        'Your subscription does not include facility management.'
      );

      const facility = await prisma.facility.findFirst({
        where: {
          id: input.facilityId,
          churchId: input.churchId,
          church: { organization: { tenantId: ctx.tenantId! } },
        },
      });
      if (!facility) throw new TRPCError({ code: 'NOT_FOUND', message: 'Facility not found' });

      if (input.eventId) {
        const event = await prisma.event.findFirst({
          where: { id: input.eventId, churchId: input.churchId },
        });
        if (!event) throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      const conflicting = await prisma.facilityBooking.findFirst({
        where: {
          facilityId: input.facilityId,
          churchId: input.churchId,
          status: { in: [FacilityBookingStatus.PENDING, FacilityBookingStatus.CONFIRMED] },
          startAt: { lt: input.endAt },
          endAt: { gt: input.startAt },
        },
      });

      if (conflicting) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Facility already booked for that time slot.' });
      }

      const bookedBy = ctx.userId
        ? await prisma.user.findUnique({ where: { clerkUserId: ctx.userId } })
        : null;

      const booking = await prisma.facilityBooking.create({
        data: {
          churchId: input.churchId,
          facilityId: input.facilityId,
          eventId: input.eventId,
          bookedByUserId: bookedBy?.id,
          title: input.title,
          description: input.description,
          startAt: input.startAt,
          endAt: input.endAt,
          notes: input.notes,
          status: input.status ?? FacilityBookingStatus.CONFIRMED,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: booking.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'facility.booking_created',
        targetType: 'FacilityBooking',
        targetId: booking.id,
        metadata: { facilityId: booking.facilityId, startAt: booking.startAt, endAt: booking.endAt },
      });

      return booking;
    }),

  utilization: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
        campusId: z.string().optional(),
        from: z.coerce.date(),
        to: z.coerce.date(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (input.to <= input.from) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid date range.' });
      }

      const facilities = await prisma.facility.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
          ...(input.campusId ? { campusId: input.campusId } : {}),
        },
        include: {
          bookings: {
            where: {
              status: { in: [FacilityBookingStatus.PENDING, FacilityBookingStatus.CONFIRMED, FacilityBookingStatus.COMPLETED] },
              startAt: { lt: input.to },
              endAt: { gt: input.from },
            },
          },
        },
      });

      const totalWindowHours = Math.max((input.to.getTime() - input.from.getTime()) / (1000 * 60 * 60), 0);

      const rows = facilities.map((facility) => {
        const bookedHours = facility.bookings.reduce((total, booking) => {
          const start = Math.max(booking.startAt.getTime(), input.from.getTime());
          const end = Math.min(booking.endAt.getTime(), input.to.getTime());
          if (end <= start) return total;
          return total + (end - start) / (1000 * 60 * 60);
        }, 0);
        const utilizationRate = totalWindowHours > 0 ? bookedHours / totalWindowHours : 0;
        return {
          facilityId: facility.id,
          facilityName: facility.name,
          campusId: facility.campusId,
          bookedHours,
          totalWindowHours,
          utilizationRate,
          bookingCount: facility.bookings.length,
        };
      });

      return {
        from: input.from,
        to: input.to,
        facilities: rows,
        totals: {
          facilities: rows.length,
          bookedHours: rows.reduce((sum, row) => sum + row.bookedHours, 0),
        },
      };
    }),
});
