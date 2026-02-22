import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { prisma } from '@faithflow/database';
import type { Prisma } from '@faithflow/database';
import { TRPCError } from '@trpc/server';

const createEventSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().optional(),
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)),
  location: z.string().optional(),
  capacity: z.number().optional(),
  churchId: z.string(),
});

const updateEventSchema = createEventSchema.partial();

function toCreateData(input: z.infer<typeof createEventSchema>): Prisma.EventUncheckedCreateInput {
	return {
		title: input.title,
		description: input.description,
		startDate: input.startDate,
		endDate: input.endDate,
		location: input.location,
		capacity: input.capacity,
		churchId: input.churchId,
	};
}

function toUpdateData(input: z.infer<typeof updateEventSchema>): Prisma.EventUncheckedUpdateInput {
	const data: Prisma.EventUncheckedUpdateInput = {};
	if (typeof input.title === 'string') data.title = input.title;
	if (typeof input.description === 'string') data.description = input.description;
	if (input.startDate instanceof Date) data.startDate = input.startDate;
	if (input.endDate instanceof Date) data.endDate = input.endDate;
	if (typeof input.location === 'string') data.location = input.location;
	if (typeof input.capacity === 'number') data.capacity = input.capacity;
	if (typeof input.churchId === 'string') data.churchId = input.churchId;
	return data;
}

export const eventRouter = router({
  create: publicProcedure
    .input(createEventSchema)
    .mutation(async ({ input }) => {
      try {
        return await prisma.event.create({
          data: toCreateData(input),
        });
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create event',
          cause: error,
        });
      }
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string(),
      data: updateEventSchema,
    }))
    .mutation(async ({ input }) => {
      try {
        return await prisma.event.update({
          where: { id: input.id },
          data: toUpdateData(input.data),
        });
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update event',
          cause: error,
        });
      }
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      try {
        return await prisma.event.delete({
          where: { id: input.id },
        });
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete event',
          cause: error,
        });
      }
    }),

  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(10),
      cursor: z.string().optional(),
      churchId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ input }) => {
      try {
        const where: any = {};
        if (input.churchId) where.churchId = input.churchId;
        if (input.startDate) where.startDate = { gte: new Date(input.startDate) };
        if (input.endDate) where.endDate = { lte: new Date(input.endDate) };

        const items = await prisma.event.findMany({
          take: input.limit + 1,
          cursor: input.cursor ? { id: input.cursor } : undefined,
          where,
          orderBy: { startDate: 'asc' },
          include: {
            attendees: true,
          },
        });

        let nextCursor: typeof input.cursor | undefined = undefined;
        if (items.length > input.limit) {
          const nextItem = items.pop();
          nextCursor = nextItem!.id;
        }

        return {
          items,
          nextCursor,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch events',
          cause: error,
        });
      }
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      try {
        const event = await prisma.event.findUnique({
          where: { id: input.id },
          include: {
            attendees: true,
          },
        });

        if (!event) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Event not found',
          });
        }

        return event;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch event',
          cause: error,
        });
      }
    }),

  register: publicProcedure
    .input(z.object({
      eventId: z.string(),
      memberId: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const event = await prisma.event.findUnique({
          where: { id: input.eventId },
          include: { attendees: true },
        });

        if (!event) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Event not found',
          });
        }

        if (event.capacity && event.attendees.length >= event.capacity) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Event is at full capacity',
          });
        }

        return await prisma.event.update({
          where: { id: input.eventId },
          data: {
            attendees: {
              connect: { id: input.memberId },
            },
          },
          include: {
            attendees: true,
          },
        });
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to register for event',
          cause: error,
        });
      }
    }),

  unregister: publicProcedure
    .input(z.object({
      eventId: z.string(),
      memberId: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        return await prisma.event.update({
          where: { id: input.eventId },
          data: {
            attendees: {
              disconnect: { id: input.memberId },
            },
          },
          include: {
            attendees: true,
          },
        });
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to unregister from event',
          cause: error,
        });
      }
    }),
});
