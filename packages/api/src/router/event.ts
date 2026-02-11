import crypto from 'crypto';
import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import {
  CommunicationChannel,
  CommunicationProvider,
  CommunicationScheduleStatus,
  EventBadgeStatus,
  EventRecurrenceFrequency,
  EventRsvpStatus,
  EventType,
  EventFormat,
  EventVisibility,
  EventRegistrationStatus,
  EventAssignmentRole,
  EventMediaType,
  PaymentProvider,
  TicketOrderStatus,
  Weekday,
  prisma,
  Prisma,
} from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { createTicketCheckout } from '../payments';
import { ensureFeatureEnabled, ensureFeatureLimit } from '../entitlements';

const createEventSchemaBase = z.object({
  churchId: z.string(),
  campusId: z.string().optional(),
  groupId: z.string().optional(),
  eventSeriesId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.nativeEnum(EventType).optional(),
  format: z.nativeEnum(EventFormat).optional(),
  visibility: z.nativeEnum(EventVisibility).optional(),
  startAt: z.string().transform((value) => new Date(value)),
  endAt: z.string().transform((value) => new Date(value)),
  location: z.string().optional(),
  meetingUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  capacity: z.number().int().positive().optional(),
  requiresRsvp: z.boolean().optional(),
  registrationEnabled: z.boolean().optional(),
  registrationLimit: z.number().int().positive().optional(),
  waitlistEnabled: z.boolean().optional(),
  registrationFields: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().min(1),
        type: z.enum(['TEXT', 'EMAIL', 'PHONE', 'NUMBER', 'SELECT', 'MULTI_SELECT', 'CHECKBOX', 'DATE']),
        required: z.boolean().optional(),
        options: z.array(z.string()).optional(),
      })
    )
    .optional(),
  allowGuestRegistration: z.boolean().optional(),
});

const createEventSchema = createEventSchemaBase.refine((data) => data.endAt > data.startAt, {
  message: 'endAt must be after startAt',
  path: ['endAt'],
});

const updateEventSchema = createEventSchemaBase.partial();

const ticketTypeSchema = z.object({
  eventId: z.string(),
  name: z.string().min(1),
  price: z.number().positive(),
  currency: z.string().default('USD'),
  capacity: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

const registrationSchema = z.object({
  eventId: z.string(),
  responses: z.record(z.string(), z.any()).optional(),
});

const publicRegistrationSchema = z.object({
  eventId: z.string(),
  guestName: z.string().min(1),
  guestEmail: z.string().email(),
  guestPhone: z.string().optional(),
  responses: z.record(z.string(), z.any()).optional(),
});

const assignmentSchema = z.object({
  eventId: z.string(),
  role: z.nativeEnum(EventAssignmentRole),
  memberId: z.string().optional(),
  displayName: z.string().optional(),
  notes: z.string().optional(),
});

const mediaSchema = z.object({
  eventId: z.string(),
  assetId: z.string(),
  type: z.nativeEnum(EventMediaType).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

const badgeSchema = z.object({
  eventId: z.string(),
  includeRegistrations: z.boolean().optional(),
  includeTickets: z.boolean().optional(),
});

const playbookSchema = z.object({
  eventId: z.string(),
  channels: z.array(z.nativeEnum(CommunicationChannel)).optional(),
});

const ticketCheckoutSchema = z.object({
  eventId: z.string(),
  ticketTypeId: z.string(),
  quantity: z.number().int().min(1).max(20).default(1),
  provider: z.nativeEnum(PaymentProvider),
  purchaserName: z.string().optional(),
  purchaserEmail: z.string().email().optional(),
  purchaserPhone: z.string().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  memberId: z.string().optional(),
});

const checkInCodeSchema = z.object({ eventId: z.string() });

const createSeriesSchema = z.object({
  churchId: z.string(),
  campusId: z.string().optional(),
  groupId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.nativeEnum(EventType).optional(),
  format: z.nativeEnum(EventFormat).optional(),
  visibility: z.nativeEnum(EventVisibility).optional(),
  location: z.string().optional(),
  meetingUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().optional(),
  frequency: z.nativeEnum(EventRecurrenceFrequency),
  interval: z.number().int().min(1).default(1),
  weekdays: z.array(z.nativeEnum(Weekday)).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  occurrences: z.number().int().min(1).max(52).default(12),
  requiresRsvp: z.boolean().optional(),
  registrationEnabled: z.boolean().optional(),
  registrationLimit: z.number().int().positive().optional(),
  waitlistEnabled: z.boolean().optional(),
  registrationFields: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().min(1),
        type: z.enum(['TEXT', 'EMAIL', 'PHONE', 'NUMBER', 'SELECT', 'MULTI_SELECT', 'CHECKBOX', 'DATE']),
        required: z.boolean().optional(),
        options: z.array(z.string()).optional(),
      })
    )
    .optional(),
  allowGuestRegistration: z.boolean().optional(),
  capacity: z.number().int().positive().optional(),
});

function buildDateWithTime(date: Date, time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function normalizeDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function weekdayFromDate(date: Date): Weekday {
  const day = date.getDay();
  return [Weekday.SUNDAY, Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY, Weekday.THURSDAY, Weekday.FRIDAY, Weekday.SATURDAY][day];
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function generateOccurrences(input: z.infer<typeof createSeriesSchema>) {
  const occurrences: Date[] = [];
  const startDate = normalizeDay(input.startDate);
  const endDate = input.endDate ? normalizeDay(input.endDate) : null;
  const interval = input.interval ?? 1;

  if (input.frequency === EventRecurrenceFrequency.WEEKLY) {
    const weekdays = input.weekdays?.length ? input.weekdays : [weekdayFromDate(startDate)];
    let cursor = new Date(startDate);
    while (occurrences.length < input.occurrences) {
      if (endDate && cursor > endDate) break;
      const weeksSinceStart = Math.floor((cursor.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (weeksSinceStart % interval === 0 && weekdays.includes(weekdayFromDate(cursor))) {
        occurrences.push(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    const dayOfMonth = input.dayOfMonth ?? startDate.getDate();
    let current = new Date(startDate);
    let count = 0;
    while (count < input.occurrences) {
      const year = current.getFullYear();
      const month = current.getMonth();
      const day = Math.min(dayOfMonth, lastDayOfMonth(year, month));
      const occurrence = new Date(year, month, day);
      if (occurrence >= startDate) {
        if (endDate && occurrence > endDate) break;
        occurrences.push(occurrence);
        count += 1;
      }
      current = new Date(year, month + interval, 1);
    }
  }

  return occurrences;
}

async function resolveRegistrationStatus(eventId: string, limit?: number | null, waitlistEnabled?: boolean, existingStatus?: EventRegistrationStatus | null) {
  if (!limit) {
    return EventRegistrationStatus.REGISTERED;
  }

  const totals = await prisma.eventRegistration.aggregate({
    where: {
      eventId,
      status: EventRegistrationStatus.REGISTERED,
    },
    _count: { _all: true },
  });

  const current = totals._count._all ?? 0;
  const existingCount = existingStatus === EventRegistrationStatus.REGISTERED ? 1 : 0;
  const next = current - existingCount + 1;

  if (next > limit) {
    if (waitlistEnabled) return EventRegistrationStatus.WAITLISTED;
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Registration limit reached' });
  }

  return EventRegistrationStatus.REGISTERED;
}

function renderTemplate(text: string, context: Record<string, string | undefined>) {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => context[key] ?? '');
}

function defaultPlaybookSteps(eventTitle: string) {
  return [
    {
      offsetHours: -168,
      channel: CommunicationChannel.EMAIL,
      subject: `You're invited: ${eventTitle}`,
      body: `Hi {{firstName}},\n\nJust a reminder about ${eventTitle}. We look forward to seeing you!\n\nFaithFlow Team`,
    },
    {
      offsetHours: -24,
      channel: CommunicationChannel.EMAIL,
      subject: `Event reminder: ${eventTitle} is tomorrow`,
      body: `Hi {{firstName}},\n\nReminder: ${eventTitle} is tomorrow. See you there!`,
    },
    {
      offsetHours: -1,
      channel: CommunicationChannel.SMS,
      subject: undefined,
      body: `Reminder: ${eventTitle} starts in about 1 hour. See you soon!`,
    },
    {
      offsetHours: 24,
      channel: CommunicationChannel.EMAIL,
      subject: `Thanks for joining ${eventTitle}`,
      body: `Hi {{firstName}},\n\nThank you for joining ${eventTitle}. We'd love to hear your feedback.`,
    },
  ];
}

export const eventRouter = router({
  create: protectedProcedure
    .input(createEventSchema)
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureEnabled(ctx.tenantId!, 'events_enabled', 'Your subscription does not include event management.');
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const currentEventCount = await prisma.event.count({
        where: { church: { organization: { tenantId: ctx.tenantId! } }, createdAt: { gte: monthStart } },
      });
      await ensureFeatureLimit(
        ctx.tenantId!,
        'max_events_monthly',
        currentEventCount,
        1,
        'Monthly event creation limit reached for your subscription.'
      );
      const church = await prisma.church.findFirst({
        where: {
          id: input.churchId,
          organization: { tenantId: ctx.tenantId! },
        },
      });

      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      return prisma.event.create({
        data: {
          ...input,
          startAt: input.startAt,
          endAt: input.endAt,
          requiresRsvp: input.requiresRsvp ?? false,
          type: input.type ?? EventType.SERVICE,
          format: input.format ?? EventFormat.IN_PERSON,
          visibility: input.visibility ?? EventVisibility.PUBLIC,
          registrationEnabled: input.registrationEnabled ?? false,
          waitlistEnabled: input.waitlistEnabled ?? false,
          registrationFields: input.registrationFields ?? undefined,
          allowGuestRegistration: input.allowGuestRegistration ?? true,
        },
      });
    }),

  list: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
        groupId: z.string().optional(),
        seriesId: z.string().optional(),
        limit: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ input, ctx }) => {
      return prisma.event.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
          ...(input.groupId ? { groupId: input.groupId } : {}),
          ...(input.seriesId ? { eventSeriesId: input.seriesId } : {}),
        },
        orderBy: { startAt: 'desc' },
        take: input.limit,
        include: {
          _count: { select: { rsvps: true, attendance: true, registrations: true } },
          ticketTypes: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
        },
      });
    }),

  detail: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, church: { organization: { tenantId: ctx.tenantId! } } },
        include: { church: true },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      return event;
    }),

  enableCheckIn: protectedProcedure
    .input(checkInCodeSchema)
    .mutation(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      const code = crypto.randomBytes(8).toString('hex');
      const updated = await prisma.event.update({
        where: { id: event.id },
        data: { checkInEnabled: true, checkInCode: code },
      });
      return { eventId: updated.id, code: updated.checkInCode, enabled: updated.checkInEnabled };
    }),

  disableCheckIn: protectedProcedure
    .input(checkInCodeSchema)
    .mutation(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      const updated = await prisma.event.update({
        where: { id: event.id },
        data: { checkInEnabled: false, checkInCode: null },
      });
      return { eventId: updated.id, code: updated.checkInCode, enabled: updated.checkInEnabled };
    }),

  checkInInfo: protectedProcedure
    .input(checkInCodeSchema)
    .query(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, church: { organization: { tenantId: ctx.tenantId! } } },
        select: { id: true, checkInEnabled: true, checkInCode: true },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }
      return { eventId: event.id, enabled: event.checkInEnabled, code: event.checkInCode };
    }),

  createTicketType: protectedProcedure
    .input(ticketTypeSchema)
    .mutation(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      return prisma.eventTicketType.create({
        data: {
          eventId: event.id,
          name: input.name,
          price: new Prisma.Decimal(input.price),
          currency: input.currency.toUpperCase(),
          capacity: input.capacity,
          isActive: input.isActive ?? true,
        },
      });
    }),

  updateTicketType: protectedProcedure
    .input(z.object({ id: z.string(), data: ticketTypeSchema.partial().omit({ eventId: true }) }))
    .mutation(async ({ input, ctx }) => {
      const ticketType = await prisma.eventTicketType.findFirst({
        where: { id: input.id, event: { church: { organization: { tenantId: ctx.tenantId! } } } },
      });
      if (!ticketType) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket type not found' });
      }

      return prisma.eventTicketType.update({
        where: { id: input.id },
        data: {
          ...(input.data.name ? { name: input.data.name } : {}),
          ...(input.data.price ? { price: new Prisma.Decimal(input.data.price) } : {}),
          ...(input.data.currency ? { currency: input.data.currency.toUpperCase() } : {}),
          ...(input.data.capacity !== undefined ? { capacity: input.data.capacity } : {}),
          ...(input.data.isActive !== undefined ? { isActive: input.data.isActive } : {}),
        },
      });
    }),

  listTicketTypes: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      return prisma.eventTicketType.findMany({
        where: { eventId: event.id, isActive: true },
        orderBy: { createdAt: 'asc' },
      });
    }),

  ticketCheckout: protectedProcedure
    .input(ticketCheckoutSchema)
    .mutation(async ({ input, ctx }) => {
      const memberId = input.memberId ?? (await (async () => {
        if (!ctx.userId || !ctx.tenantId) return undefined;
        const member = await prisma.member.findFirst({
          where: { clerkUserId: ctx.userId, church: { organization: { tenantId: ctx.tenantId } } },
        });
        return member?.id;
      })());

      return createTicketCheckout({
        eventId: input.eventId,
        ticketTypeId: input.ticketTypeId,
        quantity: input.quantity,
        provider: input.provider,
        memberId,
        purchaserName: input.purchaserName,
        purchaserEmail: input.purchaserEmail,
        purchaserPhone: input.purchaserPhone,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
      });
    }),

  listTicketOrders: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      return prisma.eventTicketOrder.findMany({
        where: { eventId: event.id },
        include: { member: true, ticketType: true },
        orderBy: { createdAt: 'desc' },
      });
    }),

  myTicketOrders: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId || !ctx.tenantId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const member = await prisma.member.findFirst({
      where: { clerkUserId: ctx.userId, church: { organization: { tenantId: ctx.tenantId } } },
    });
    if (!member) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
    }

    return prisma.eventTicketOrder.findMany({
      where: { memberId: member.id },
      include: { event: true, ticketType: true },
      orderBy: { createdAt: 'desc' },
    });
  }),

  createSeries: protectedProcedure
    .input(createSeriesSchema)
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureEnabled(ctx.tenantId!, 'events_enabled', 'Your subscription does not include event management.');
      const occurrences = generateOccurrences(input);
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const currentEventCount = await prisma.event.count({
        where: { church: { organization: { tenantId: ctx.tenantId! } }, createdAt: { gte: monthStart } },
      });
      await ensureFeatureLimit(
        ctx.tenantId!,
        'max_events_monthly',
        currentEventCount,
        Math.max(occurrences.length, 1),
        'Monthly event creation limit reached for your subscription.'
      );
      const church = await prisma.church.findFirst({
        where: {
          id: input.churchId,
          organization: { tenantId: ctx.tenantId! },
        },
      });

      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      const series = await prisma.eventSeries.create({
        data: {
          churchId: input.churchId,
          campusId: input.campusId,
          groupId: input.groupId,
          title: input.title,
          description: input.description,
          type: input.type ?? EventType.SERVICE,
          format: input.format ?? EventFormat.IN_PERSON,
          visibility: input.visibility ?? EventVisibility.PUBLIC,
          location: input.location,
          meetingUrl: input.meetingUrl,
          coverImageUrl: input.coverImageUrl,
          startDate: input.startDate,
          endDate: input.endDate,
          startTime: input.startTime,
          endTime: input.endTime,
          timezone: input.timezone,
          frequency: input.frequency,
          interval: input.interval ?? 1,
          weekdays: input.weekdays ?? [],
          dayOfMonth: input.dayOfMonth,
          requiresRsvp: input.requiresRsvp ?? false,
          registrationEnabled: input.registrationEnabled ?? false,
          registrationLimit: input.registrationLimit,
          waitlistEnabled: input.waitlistEnabled ?? false,
          registrationFields: input.registrationFields ?? undefined,
          allowGuestRegistration: input.allowGuestRegistration ?? true,
          capacity: input.capacity,
        },
      });

      if (!occurrences.length) {
        return { series, events: [] };
      }

      const events = await prisma.$transaction(
        occurrences.map((date) => {
          const startAt = buildDateWithTime(date, input.startTime);
          const endAt = buildDateWithTime(date, input.endTime);
          return prisma.event.create({
            data: {
              churchId: input.churchId,
              campusId: input.campusId,
              groupId: input.groupId,
              eventSeriesId: series.id,
              title: input.title,
              description: input.description,
              type: input.type ?? EventType.SERVICE,
              format: input.format ?? EventFormat.IN_PERSON,
              visibility: input.visibility ?? EventVisibility.PUBLIC,
              startAt,
              endAt,
              location: input.location,
              meetingUrl: input.meetingUrl,
              coverImageUrl: input.coverImageUrl,
              capacity: input.capacity,
              requiresRsvp: input.requiresRsvp ?? false,
              registrationEnabled: input.registrationEnabled ?? false,
              registrationLimit: input.registrationLimit,
              waitlistEnabled: input.waitlistEnabled ?? false,
              registrationFields: input.registrationFields ?? undefined,
              allowGuestRegistration: input.allowGuestRegistration ?? true,
            },
          });
        })
      );

      return { series, events };
    }),

  listSeries: protectedProcedure
    .input(z.object({ churchId: z.string().optional(), limit: z.number().min(1).max(100).default(25) }))
    .query(async ({ input, ctx }) => {
      return prisma.eventSeries.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        include: { events: { orderBy: { startAt: 'asc' }, take: 3 } },
      });
    }),

  publicList: publicProcedure
    .input(z.object({ churchSlug: z.string(), limit: z.number().min(1).max(50).default(12) }))
    .query(async ({ input }) => {
      const church = await prisma.church.findFirst({
        where: { slug: input.churchSlug },
        select: { id: true, name: true, slug: true, timezone: true },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const events = await prisma.event.findMany({
        where: {
          churchId: church.id,
          visibility: EventVisibility.PUBLIC,
          endAt: { gte: from },
        },
        orderBy: { startAt: 'asc' },
        take: input.limit,
        include: {
          ticketTypes: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
          _count: { select: { rsvps: true, registrations: true } },
        },
      });

      return { church, events };
    }),

  publicDetail: publicProcedure
    .input(z.object({ churchSlug: z.string(), eventId: z.string() }))
    .query(async ({ input }) => {
      const church = await prisma.church.findFirst({
        where: { slug: input.churchSlug },
        select: { id: true, name: true, slug: true, timezone: true },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      const event = await prisma.event.findFirst({
        where: { id: input.eventId, churchId: church.id, visibility: EventVisibility.PUBLIC },
        include: {
          ticketTypes: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
          assignments: { include: { member: true } },
          media: { where: { isPublic: true }, include: { asset: true }, orderBy: { createdAt: 'desc' } },
          _count: { select: { rsvps: true, registrations: true } },
        },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      return { church, event };
    }),

  register: protectedProcedure
    .input(registrationSchema)
    .mutation(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }
      if (!event.registrationEnabled) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Registration is closed' });
      }

      const member = await prisma.member.findFirst({
        where: { clerkUserId: ctx.userId ?? '', churchId: event.churchId },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
      }

      const existing = await prisma.eventRegistration.findFirst({
        where: { eventId: event.id, memberId: member.id },
      });

      const status = await resolveRegistrationStatus(
        event.id,
        event.registrationLimit,
        event.waitlistEnabled,
        existing?.status ?? null
      );

      return prisma.eventRegistration.upsert({
        where: { eventId_memberId: { eventId: event.id, memberId: member.id } },
        update: {
          status,
          responses: (input.responses ?? undefined) as Prisma.InputJsonValue | undefined,
        },
        create: {
          eventId: event.id,
          memberId: member.id,
          status,
          responses: (input.responses ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    }),

  cancelRegistration: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      const member = await prisma.member.findFirst({
        where: { clerkUserId: ctx.userId ?? '', churchId: event.churchId },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
      }

      const registration = await prisma.eventRegistration.findFirst({
        where: { eventId: event.id, memberId: member.id },
      });
      if (!registration) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Registration not found' });
      }

      return prisma.eventRegistration.update({
        where: { id: registration.id },
        data: { status: EventRegistrationStatus.CANCELED },
      });
    }),

  publicRegister: publicProcedure
    .input(publicRegistrationSchema)
    .mutation(async ({ input }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, visibility: EventVisibility.PUBLIC },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }
      if (!event.registrationEnabled) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Registration is closed' });
      }
      if (!event.allowGuestRegistration) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Guest registration disabled' });
      }

      const existing = await prisma.eventRegistration.findFirst({
        where: { eventId: event.id, guestEmail: input.guestEmail },
      });

      const status = await resolveRegistrationStatus(
        event.id,
        event.registrationLimit,
        event.waitlistEnabled,
        existing?.status ?? null
      );

      if (existing) {
        return prisma.eventRegistration.update({
          where: { id: existing.id },
          data: {
            status,
            guestName: input.guestName,
            guestEmail: input.guestEmail,
            guestPhone: input.guestPhone,
            responses: (input.responses ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        });
      }

      return prisma.eventRegistration.create({
        data: {
          eventId: event.id,
          status,
          guestName: input.guestName,
          guestEmail: input.guestEmail,
          guestPhone: input.guestPhone,
          responses: (input.responses ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    }),

  listRegistrations: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      return prisma.eventRegistration.findMany({
        where: { eventId: event.id },
        include: { member: true },
        orderBy: { createdAt: 'desc' },
      });
    }),

  myRegistrations: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId || !ctx.tenantId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const member = await prisma.member.findFirst({
      where: { clerkUserId: ctx.userId, church: { organization: { tenantId: ctx.tenantId } } },
    });
    if (!member) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
    }

    return prisma.eventRegistration.findMany({
      where: { memberId: member.id },
      include: { event: true },
      orderBy: { createdAt: 'desc' },
    });
  }),

  addAssignment: protectedProcedure
    .input(assignmentSchema)
    .mutation(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      if (!input.memberId && !input.displayName) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Display name is required for external assignments' });
      }

      if (input.memberId) {
        const member = await prisma.member.findFirst({
          where: { id: input.memberId, churchId: event.churchId },
        });
        if (!member) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
        }
      }

      return prisma.eventAssignment.create({
        data: {
          eventId: event.id,
          memberId: input.memberId,
          role: input.role,
          displayName: input.displayName,
          notes: input.notes,
        },
      });
    }),

  listAssignments: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      return prisma.eventAssignment.findMany({
        where: { eventId: event.id },
        include: { member: true },
        orderBy: { createdAt: 'desc' },
      });
    }),

  removeAssignment: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const assignment = await prisma.eventAssignment.findFirst({
        where: { id: input.id, event: { church: { organization: { tenantId: ctx.tenantId! } } } },
      });
      if (!assignment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Assignment not found' });
      }

      return prisma.eventAssignment.delete({ where: { id: assignment.id } });
    }),

  addMedia: protectedProcedure
    .input(mediaSchema)
    .mutation(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      const asset = await prisma.mediaAsset.findFirst({
        where: { id: input.assetId, churchId: event.churchId },
      });
      if (!asset) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Asset not found' });
      }

      return prisma.eventMedia.create({
        data: {
          churchId: event.churchId,
          eventId: event.id,
          assetId: asset.id,
          type: input.type ?? EventMediaType.PHOTO,
          title: input.title,
          description: input.description,
          isPublic: input.isPublic ?? true,
        },
      });
    }),

  listMedia: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      return prisma.eventMedia.findMany({
        where: { eventId: event.id },
        include: { asset: true },
        orderBy: { createdAt: 'desc' },
      });
    }),

  removeMedia: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const media = await prisma.eventMedia.findFirst({
        where: { id: input.id, event: { church: { organization: { tenantId: ctx.tenantId! } } } },
      });
      if (!media) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Media not found' });
      }

      return prisma.eventMedia.delete({ where: { id: media.id } });
    }),

  analytics: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      const [registrationTotals, rsvpTotals, attendanceTotals, ticketTotals] = await Promise.all([
        prisma.eventRegistration.groupBy({
          by: ['status'],
          where: { eventId: event.id },
          _count: { _all: true },
        }),
        prisma.eventRsvp.groupBy({
          by: ['status'],
          where: { eventId: event.id },
          _count: { _all: true },
          _sum: { guestCount: true },
        }),
        prisma.attendance.aggregate({
          where: { eventId: event.id },
          _count: { _all: true },
        }),
        prisma.eventTicketOrder.aggregate({
          where: { eventId: event.id, status: TicketOrderStatus.PAID },
          _sum: { amount: true },
          _count: { _all: true },
        }),
      ]);

      return {
        registrations: registrationTotals,
        rsvps: rsvpTotals,
        attendanceCount: attendanceTotals._count._all ?? 0,
        ticketSales: {
          count: ticketTotals._count._all ?? 0,
          totalAmount: ticketTotals._sum.amount ?? new Prisma.Decimal(0),
        },
      };
    }),

  generateBadges: protectedProcedure
    .input(badgeSchema)
    .mutation(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      const includeRegistrations = input.includeRegistrations ?? true;
      const includeTickets = input.includeTickets ?? true;

      const badgeCreates: Prisma.EventBadgeCreateManyInput[] = [];

      if (includeRegistrations) {
        const registrations = await prisma.eventRegistration.findMany({
          where: { eventId: event.id },
        });
        const registrationIds = registrations.map((reg) => reg.id);
        const existing = await prisma.eventBadge.findMany({
          where: { registrationId: { in: registrationIds } },
          select: { registrationId: true },
        });
        const existingSet = new Set(existing.map((entry) => entry.registrationId).filter(Boolean) as string[]);

        for (const registration of registrations) {
          if (existingSet.has(registration.id)) continue;
          badgeCreates.push({
            eventId: event.id,
            memberId: registration.memberId ?? undefined,
            registrationId: registration.id,
            badgeCode: crypto.randomBytes(6).toString('hex'),
            status: EventBadgeStatus.ACTIVE,
          });
        }
      }

      if (includeTickets) {
        const orders = await prisma.eventTicketOrder.findMany({
          where: { eventId: event.id, status: TicketOrderStatus.PAID },
        });
        const orderIds = orders.map((order) => order.id);
        const existingCounts = await prisma.eventBadge.groupBy({
          by: ['ticketOrderId'],
          where: { ticketOrderId: { in: orderIds } },
          _count: { _all: true },
        });
        const orderCountMap = new Map(existingCounts.map((entry) => [entry.ticketOrderId!, entry._count._all ?? 0]));

        for (const order of orders) {
          const existingCount = orderCountMap.get(order.id) ?? 0;
          const missing = Math.max(order.quantity - existingCount, 0);
          for (let i = 0; i < missing; i += 1) {
            badgeCreates.push({
              eventId: event.id,
              memberId: order.memberId ?? undefined,
              ticketOrderId: order.id,
              badgeCode: crypto.randomBytes(6).toString('hex'),
              sequence: existingCount + i + 1,
              status: EventBadgeStatus.ACTIVE,
            });
          }
        }
      }

      if (!badgeCreates.length) {
        return { created: 0 };
      }

      await prisma.eventBadge.createMany({ data: badgeCreates });
      return { created: badgeCreates.length };
    }),

  listBadges: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      return prisma.eventBadge.findMany({
        where: { eventId: event.id },
        include: { member: true, registration: true, ticketOrder: true },
        orderBy: { issuedAt: 'desc' },
      });
    }),

  revokeBadge: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const badge = await prisma.eventBadge.findFirst({
        where: { id: input.id, event: { church: { organization: { tenantId: ctx.tenantId! } } } },
      });
      if (!badge) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Badge not found' });
      }

      return prisma.eventBadge.update({
        where: { id: badge.id },
        data: { status: EventBadgeStatus.REVOKED },
      });
    }),

  createCommsPlaybook: protectedProcedure
    .input(playbookSchema)
    .mutation(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, church: { organization: { tenantId: ctx.tenantId! } } },
        include: { church: true },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      const channels = input.channels?.length ? input.channels : [CommunicationChannel.EMAIL, CommunicationChannel.SMS];
      const steps = defaultPlaybookSteps(event.title).filter((step) => channels.includes(step.channel));

      const registrations = await prisma.eventRegistration.findMany({
        where: { eventId: event.id, status: { not: EventRegistrationStatus.CANCELED } },
        include: { member: true },
      });
      const rsvps = await prisma.eventRsvp.findMany({
        where: { eventId: event.id, status: EventRsvpStatus.GOING },
        include: { member: true },
      });

      const recipients = new Map<string, { firstName?: string; lastName?: string; email?: string; phone?: string }>();

      const addRecipient = (email?: string | null, phone?: string | null, context?: { firstName?: string; lastName?: string }) => {
        if (email) {
          recipients.set(`email:${email}`, { email, ...context });
        }
        if (phone) {
          recipients.set(`phone:${phone}`, { phone, ...context });
        }
      };

      for (const registration of registrations) {
        if (registration.member) {
          addRecipient(registration.member.email, registration.member.phone, {
            firstName: registration.member.firstName,
            lastName: registration.member.lastName,
          });
        } else {
          addRecipient(registration.guestEmail, registration.guestPhone, {
            firstName: registration.guestName ?? undefined,
          });
        }
      }

      for (const rsvp of rsvps) {
        addRecipient(rsvp.member.email, rsvp.member.phone, {
          firstName: rsvp.member.firstName,
          lastName: rsvp.member.lastName,
        });
      }

      const schedules: Prisma.CommunicationScheduleCreateManyInput[] = [];
      const now = new Date();

      for (const step of steps) {
        const sendAt = new Date(event.startAt.getTime() + step.offsetHours * 60 * 60 * 1000);
        for (const recipient of recipients.values()) {
          const to = step.channel === CommunicationChannel.EMAIL ? recipient.email : recipient.phone;
          if (!to) continue;
          const context = {
            firstName: recipient.firstName,
            lastName: recipient.lastName,
            churchName: event.church.name,
            eventTitle: event.title,
          };
          schedules.push({
            churchId: event.churchId,
            channel: step.channel,
            provider: step.channel === CommunicationChannel.EMAIL ? CommunicationProvider.RESEND : CommunicationProvider.TWILIO,
            to,
            subject: step.subject ? renderTemplate(step.subject, context) : undefined,
            body: renderTemplate(step.body, context),
            sendAt: sendAt < now ? now : sendAt,
            status: CommunicationScheduleStatus.QUEUED,
            metadata: { eventId: event.id, playbook: 'default' } as Prisma.InputJsonValue,
          });
        }
      }

      if (!schedules.length) {
        return { scheduled: 0 };
      }

      await prisma.communicationSchedule.createMany({ data: schedules });
      return { scheduled: schedules.length };
    }),

  rsvp: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        status: z.nativeEnum(EventRsvpStatus),
        guestCount: z.number().int().min(0).max(20).default(0),
        notes: z.string().optional(),
        memberId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      let memberId = input.memberId;
      if (!memberId) {
        if (!ctx.userId || !ctx.tenantId) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
        }
        const member = await prisma.member.findFirst({
          where: { clerkUserId: ctx.userId, church: { organization: { tenantId: ctx.tenantId } } },
        });
        if (!member) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
        }
        memberId = member.id;
      }

      const existing = await prisma.eventRsvp.findFirst({
        where: { eventId: event.id, memberId },
      });

      if (event.capacity && input.status === EventRsvpStatus.GOING) {
        const aggregate = await prisma.eventRsvp.aggregate({
          where: { eventId: event.id, status: EventRsvpStatus.GOING },
          _count: { _all: true },
          _sum: { guestCount: true },
        });
        const currentTotal = (aggregate._count._all ?? 0) + (aggregate._sum.guestCount ?? 0);
        const existingTotal =
          existing && existing.status === EventRsvpStatus.GOING ? 1 + existing.guestCount : 0;
        const nextTotal = currentTotal - existingTotal + 1 + input.guestCount;
        if (nextTotal > event.capacity) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Event is at capacity' });
        }
      }

      return prisma.eventRsvp.upsert({
        where: { eventId_memberId: { eventId: event.id, memberId } },
        update: {
          status: input.status,
          guestCount: input.guestCount,
          notes: input.notes,
        },
        create: {
          eventId: event.id,
          memberId,
          status: input.status,
          guestCount: input.guestCount,
          notes: input.notes,
        },
      });
    }),

  listRsvps: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      return prisma.eventRsvp.findMany({
        where: { eventId: event.id },
        include: { member: true },
        orderBy: { createdAt: 'desc' },
      });
    }),

  myRsvps: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId || !ctx.tenantId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const member = await prisma.member.findFirst({
      where: { clerkUserId: ctx.userId, church: { organization: { tenantId: ctx.tenantId } } },
    });
    if (!member) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
    }

    return prisma.eventRsvp.findMany({
      where: { memberId: member.id },
      include: { event: true },
      orderBy: { createdAt: 'desc' },
    });
  }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: updateEventSchema }))
    .mutation(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: {
          id: input.id,
          church: { organization: { tenantId: ctx.tenantId! } },
        },
      });

      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      return prisma.event.update({
        where: { id: input.id },
        data: {
          ...input.data,
          ...(input.data.startAt ? { startAt: new Date(input.data.startAt) } : {}),
          ...(input.data.endAt ? { endAt: new Date(input.data.endAt) } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const event = await prisma.event.findFirst({
        where: {
          id: input.id,
          church: { organization: { tenantId: ctx.tenantId! } },
        },
      });

      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      return prisma.event.delete({ where: { id: input.id } });
    }),
});
