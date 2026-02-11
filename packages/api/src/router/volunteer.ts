import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import {
  VolunteerAssignmentStatus,
  VolunteerRoleStatus,
  VolunteerShiftAssignmentStatus,
  Weekday,
  prisma,
} from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';

const createRoleSchema = z.object({
  churchId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.nativeEnum(VolunteerRoleStatus).optional(),
});

const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.nativeEnum(VolunteerRoleStatus).optional(),
});

const shiftSchemaBase = z.object({
  churchId: z.string(),
  roleId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  startAt: z.string().transform((value) => new Date(value)),
  endAt: z.string().transform((value) => new Date(value)),
  capacity: z.number().int().positive().optional(),
});

const createShiftSchema = shiftSchemaBase.refine((data) => data.endAt > data.startAt, {
  message: 'endAt must be after startAt',
  path: ['endAt'],
});

const updateShiftSchema = shiftSchemaBase.partial().refine(
  (data) => {
    if (data.startAt && data.endAt) {
      return data.endAt > data.startAt;
    }
    return true;
  },
  { message: 'endAt must be after startAt', path: ['endAt'] }
);

const availabilitySchemaBase = z.object({
  churchId: z.string(),
  memberId: z.string(),
  roleId: z.string().optional(),
  dayOfWeek: z.nativeEnum(Weekday),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().optional(),
  notes: z.string().optional(),
});

const availabilitySchema = availabilitySchemaBase.refine(
  (data) => {
    const [startHour, startMinute] = data.startTime.split(':').map(Number);
    const [endHour, endMinute] = data.endTime.split(':').map(Number);
    return endHour * 60 + endMinute > startHour * 60 + startMinute;
  },
  { message: 'endTime must be after startTime', path: ['endTime'] }
);

export const volunteerRouter = router({
  createRole: protectedProcedure
    .input(createRoleSchema)
    .mutation(async ({ input, ctx }) => {
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      return prisma.volunteerRole.create({
        data: {
          churchId: input.churchId,
          name: input.name,
          description: input.description,
          status: input.status ?? VolunteerRoleStatus.OPEN,
        },
      });
    }),

  listRoles: protectedProcedure
    .input(z.object({ churchId: z.string().optional(), limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ input, ctx }) => {
      return prisma.volunteerRole.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        include: {
          assignments: { include: { member: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });
    }),

  updateRole: protectedProcedure
    .input(z.object({ id: z.string(), data: updateRoleSchema }))
    .mutation(async ({ input, ctx }) => {
      const role = await prisma.volunteerRole.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!role) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Volunteer role not found' });
      }

      return prisma.volunteerRole.update({
        where: { id: input.id },
        data: input.data,
      });
    }),

  deleteRole: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const role = await prisma.volunteerRole.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!role) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Volunteer role not found' });
      }

      return prisma.volunteerRole.delete({ where: { id: input.id } });
    }),

  assignMember: protectedProcedure
    .input(z.object({ roleId: z.string(), memberId: z.string(), status: z.nativeEnum(VolunteerAssignmentStatus).optional(), notes: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const role = await prisma.volunteerRole.findFirst({
        where: { id: input.roleId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!role) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Volunteer role not found' });
      }

      const member = await prisma.member.findFirst({
        where: { id: input.memberId, churchId: role.churchId },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      return prisma.volunteerAssignment.upsert({
        where: { roleId_memberId: { roleId: role.id, memberId: member.id } },
        update: {
          status: input.status ?? VolunteerAssignmentStatus.ACTIVE,
          notes: input.notes,
        },
        create: {
          roleId: role.id,
          memberId: member.id,
          status: input.status ?? VolunteerAssignmentStatus.ACTIVE,
          notes: input.notes,
        },
      });
    }),

  removeMember: protectedProcedure
    .input(z.object({ roleId: z.string(), memberId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const role = await prisma.volunteerRole.findFirst({
        where: { id: input.roleId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!role) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Volunteer role not found' });
      }

      return prisma.volunteerAssignment.deleteMany({
        where: { roleId: role.id, memberId: input.memberId },
      });
    }),

  createShift: protectedProcedure
    .input(createShiftSchema)
    .mutation(async ({ input, ctx }) => {
      const role = await prisma.volunteerRole.findFirst({
        where: { id: input.roleId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!role) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Volunteer role not found' });
      }

      return prisma.volunteerShift.create({
        data: {
          churchId: input.churchId,
          roleId: input.roleId,
          title: input.title,
          description: input.description,
          startAt: input.startAt,
          endAt: input.endAt,
          capacity: input.capacity,
        },
      });
    }),

  listShifts: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
        roleId: z.string().optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      return prisma.volunteerShift.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
          ...(input.roleId ? { roleId: input.roleId } : {}),
          ...(input.from || input.to
            ? {
                startAt: {
                  ...(input.from ? { gte: input.from } : {}),
                  ...(input.to ? { lte: input.to } : {}),
                },
              }
            : {}),
        },
        include: {
          role: true,
          assignments: true,
        },
        orderBy: { startAt: 'asc' },
        take: input.limit,
      });
    }),

  updateShift: protectedProcedure
    .input(z.object({ id: z.string(), data: updateShiftSchema }))
    .mutation(async ({ input, ctx }) => {
      const shift = await prisma.volunteerShift.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!shift) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Volunteer shift not found' });
      }

      return prisma.volunteerShift.update({
        where: { id: input.id },
        data: {
          ...input.data,
          ...(input.data.startAt ? { startAt: new Date(input.data.startAt) } : {}),
          ...(input.data.endAt ? { endAt: new Date(input.data.endAt) } : {}),
        },
      });
    }),

  deleteShift: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const shift = await prisma.volunteerShift.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!shift) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Volunteer shift not found' });
      }

      return prisma.volunteerShift.delete({ where: { id: input.id } });
    }),

  assignShift: protectedProcedure
    .input(z.object({ shiftId: z.string(), memberId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const shift = await prisma.volunteerShift.findFirst({
        where: { id: input.shiftId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!shift) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Volunteer shift not found' });
      }

      const member = await prisma.member.findFirst({
        where: { id: input.memberId, churchId: shift.churchId },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      if (shift.capacity) {
        const assignedCount = await prisma.volunteerShiftAssignment.count({
          where: { shiftId: shift.id, status: { not: VolunteerShiftAssignmentStatus.CANCELED } },
        });
        if (assignedCount >= shift.capacity) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Shift is at capacity' });
        }
      }

      return prisma.volunteerShiftAssignment.upsert({
        where: { shiftId_memberId: { shiftId: shift.id, memberId: member.id } },
        update: { status: VolunteerShiftAssignmentStatus.SCHEDULED },
        create: {
          shiftId: shift.id,
          memberId: member.id,
          status: VolunteerShiftAssignmentStatus.SCHEDULED,
        },
      });
    }),

  updateShiftAssignment: protectedProcedure
    .input(z.object({ assignmentId: z.string(), status: z.nativeEnum(VolunteerShiftAssignmentStatus), notes: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const assignment = await prisma.volunteerShiftAssignment.findFirst({
        where: { id: input.assignmentId, shift: { church: { organization: { tenantId: ctx.tenantId! } } } },
      });
      if (!assignment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Assignment not found' });
      }

      return prisma.volunteerShiftAssignment.update({
        where: { id: input.assignmentId },
        data: { status: input.status, notes: input.notes },
      });
    }),

  selfAssignments: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId || !ctx.tenantId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const member = await prisma.member.findFirst({
      where: { clerkUserId: ctx.userId, church: { organization: { tenantId: ctx.tenantId } } },
    });
    if (!member) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
    }

    return prisma.volunteerShiftAssignment.findMany({
      where: { memberId: member.id },
      include: { shift: { include: { role: true } } },
      orderBy: { assignedAt: 'desc' },
    });
  }),

  selfAssignShift: protectedProcedure
    .input(z.object({ shiftId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.userId || !ctx.tenantId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }

      const member = await prisma.member.findFirst({
        where: { clerkUserId: ctx.userId, church: { organization: { tenantId: ctx.tenantId } } },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
      }

      const shift = await prisma.volunteerShift.findFirst({
        where: { id: input.shiftId, churchId: member.churchId },
      });
      if (!shift) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Volunteer shift not found' });
      }

      if (shift.capacity) {
        const assignedCount = await prisma.volunteerShiftAssignment.count({
          where: { shiftId: shift.id, status: { not: VolunteerShiftAssignmentStatus.CANCELED } },
        });
        if (assignedCount >= shift.capacity) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Shift is at capacity' });
        }
      }

      return prisma.volunteerShiftAssignment.upsert({
        where: { shiftId_memberId: { shiftId: shift.id, memberId: member.id } },
        update: { status: VolunteerShiftAssignmentStatus.SCHEDULED },
        create: {
          shiftId: shift.id,
          memberId: member.id,
          status: VolunteerShiftAssignmentStatus.SCHEDULED,
        },
      });
    }),

  selfCancelShift: protectedProcedure
    .input(z.object({ assignmentId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.userId || !ctx.tenantId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }

      const member = await prisma.member.findFirst({
        where: { clerkUserId: ctx.userId, church: { organization: { tenantId: ctx.tenantId } } },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
      }

      const assignment = await prisma.volunteerShiftAssignment.findFirst({
        where: { id: input.assignmentId, memberId: member.id },
      });
      if (!assignment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Assignment not found' });
      }

      return prisma.volunteerShiftAssignment.update({
        where: { id: input.assignmentId },
        data: { status: VolunteerShiftAssignmentStatus.CANCELED },
      });
    }),

  setAvailability: protectedProcedure
    .input(availabilitySchema)
    .mutation(async ({ input, ctx }) => {
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      const member = await prisma.member.findFirst({
        where: { id: input.memberId, churchId: church.id },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      if (input.roleId) {
        const role = await prisma.volunteerRole.findFirst({
          where: { id: input.roleId, churchId: church.id },
        });
        if (!role) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Volunteer role not found' });
        }
      }

      const existing = await prisma.volunteerAvailability.findFirst({
        where: {
          memberId: input.memberId,
          roleId: input.roleId ?? null,
          dayOfWeek: input.dayOfWeek,
          startTime: input.startTime,
          endTime: input.endTime,
        },
      });

      if (existing) {
        return prisma.volunteerAvailability.update({
          where: { id: existing.id },
          data: {
            timezone: input.timezone,
            notes: input.notes,
          },
        });
      }

      return prisma.volunteerAvailability.create({
        data: {
          churchId: church.id,
          memberId: input.memberId,
          roleId: input.roleId ?? null,
          dayOfWeek: input.dayOfWeek,
          startTime: input.startTime,
          endTime: input.endTime,
          timezone: input.timezone,
          notes: input.notes,
        },
      });
    }),

  deleteAvailability: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const availability = await prisma.volunteerAvailability.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!availability) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Availability not found' });
      }

      return prisma.volunteerAvailability.delete({ where: { id: availability.id } });
    }),

  listAvailability: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
        memberId: z.string().optional(),
        roleId: z.string().optional(),
        limit: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ input, ctx }) => {
      return prisma.volunteerAvailability.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
          ...(input.memberId ? { memberId: input.memberId } : {}),
          ...(input.roleId ? { roleId: input.roleId } : {}),
        },
        include: { role: true, member: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        take: input.limit,
      });
    }),

  selfAvailability: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId || !ctx.tenantId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const member = await prisma.member.findFirst({
      where: { clerkUserId: ctx.userId, church: { organization: { tenantId: ctx.tenantId } } },
    });
    if (!member) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
    }

    return prisma.volunteerAvailability.findMany({
      where: { memberId: member.id },
      include: { role: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }),

  setSelfAvailability: protectedProcedure
    .input(availabilitySchemaBase.omit({ churchId: true, memberId: true }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.userId || !ctx.tenantId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }

      const member = await prisma.member.findFirst({
        where: { clerkUserId: ctx.userId, church: { organization: { tenantId: ctx.tenantId } } },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
      }

      const [startHour, startMinute] = input.startTime.split(':').map(Number);
      const [endHour, endMinute] = input.endTime.split(':').map(Number);
      if (endHour * 60 + endMinute <= startHour * 60 + startMinute) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'endTime must be after startTime' });
      }

      if (input.roleId) {
        const role = await prisma.volunteerRole.findFirst({
          where: { id: input.roleId, churchId: member.churchId },
        });
        if (!role) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Volunteer role not found' });
        }
      }

      const existing = await prisma.volunteerAvailability.findFirst({
        where: {
          memberId: member.id,
          roleId: input.roleId ?? null,
          dayOfWeek: input.dayOfWeek,
          startTime: input.startTime,
          endTime: input.endTime,
        },
      });

      if (existing) {
        return prisma.volunteerAvailability.update({
          where: { id: existing.id },
          data: {
            timezone: input.timezone,
            notes: input.notes,
          },
        });
      }

      return prisma.volunteerAvailability.create({
        data: {
          churchId: member.churchId,
          memberId: member.id,
          roleId: input.roleId ?? null,
          dayOfWeek: input.dayOfWeek,
          startTime: input.startTime,
          endTime: input.endTime,
          timezone: input.timezone,
          notes: input.notes,
        },
      });
    }),

  shiftGaps: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
        hoursAhead: z.number().min(1).max(168).default(48),
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const now = new Date();
      const horizon = new Date(now.getTime() + input.hoursAhead * 60 * 60 * 1000);

      const shifts = await prisma.volunteerShift.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
          startAt: { gte: now, lte: horizon },
        },
        include: { role: true, assignments: true },
        orderBy: { startAt: 'asc' },
        take: input.limit,
      });

      const gaps = shifts
        .map((shift) => {
          const assigned = shift.assignments.filter((assignment) => assignment.status !== 'CANCELED').length;
          const capacity = shift.capacity ?? 0;
          const remaining = capacity ? Math.max(capacity - assigned, 0) : 0;
          return {
            shift,
            assigned,
            capacity,
            remaining,
          };
        })
        .filter((entry) => entry.capacity > 0 && entry.remaining > 0);

      return {
        horizonHours: input.hoursAhead,
        totalShifts: shifts.length,
        gaps,
      };
    }),
});
