import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { prisma } from '@faithflow/database';
import type { Prisma } from '@faithflow/database';
import { TRPCError } from '@trpc/server';

const createGroupSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  churchId: z.string(),
  leaderId: z.string(),
});

const updateGroupSchema = createGroupSchema.partial();

function toCreateData(input: z.infer<typeof createGroupSchema>): Prisma.SmallGroupUncheckedCreateInput {
	return {
		name: input.name,
		description: input.description,
		churchId: input.churchId,
		leaderId: input.leaderId,
	};
}

function toUpdateData(input: z.infer<typeof updateGroupSchema>): Prisma.SmallGroupUncheckedUpdateInput {
	const data: Prisma.SmallGroupUncheckedUpdateInput = {};
	if (typeof input.name === 'string') data.name = input.name;
	if (typeof input.description === 'string') data.description = input.description;
	if (typeof input.churchId === 'string') data.churchId = input.churchId;
	if (typeof input.leaderId === 'string') data.leaderId = input.leaderId;
	return data;
}

export const groupRouter = router({
  create: publicProcedure
    .input(createGroupSchema)
    .mutation(async ({ input }) => {
      try {
        return await prisma.smallGroup.create({
          data: toCreateData(input),
          include: {
            leader: true,
            members: true,
          },
        });
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create group',
          cause: error,
        });
      }
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string(),
      data: updateGroupSchema,
    }))
    .mutation(async ({ input }) => {
      try {
        return await prisma.smallGroup.update({
          where: { id: input.id },
          data: toUpdateData(input.data),
          include: {
            leader: true,
            members: true,
          },
        });
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update group',
          cause: error,
        });
      }
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      try {
        return await prisma.smallGroup.delete({
          where: { id: input.id },
        });
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete group',
          cause: error,
        });
      }
    }),

  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(10),
      cursor: z.string().optional(),
      churchId: z.string().optional(),
    }))
    .query(async ({ input }) => {
      try {
        const items = await prisma.smallGroup.findMany({
          take: input.limit + 1,
          cursor: input.cursor ? { id: input.cursor } : undefined,
          where: input.churchId ? { churchId: input.churchId } : undefined,
          orderBy: { createdAt: 'desc' },
          include: {
            leader: true,
            members: true,
            _count: {
              select: { members: true },
            },
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
          message: 'Failed to fetch groups',
          cause: error,
        });
      }
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      try {
        const group = await prisma.smallGroup.findUnique({
          where: { id: input.id },
          include: {
            leader: true,
            members: true,
          },
        });

        if (!group) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Group not found',
          });
        }

        return group;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch group',
          cause: error,
        });
      }
    }),

  addMember: publicProcedure
    .input(z.object({
      groupId: z.string(),
      memberId: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        return await prisma.smallGroup.update({
          where: { id: input.groupId },
          data: {
            members: {
              connect: { id: input.memberId },
            },
          },
          include: {
            members: true,
          },
        });
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add member to group',
          cause: error,
        });
      }
    }),

  removeMember: publicProcedure
    .input(z.object({
      groupId: z.string(),
      memberId: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        return await prisma.smallGroup.update({
          where: { id: input.groupId },
          data: {
            members: {
              disconnect: { id: input.memberId },
            },
          },
          include: {
            members: true,
          },
        });
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to remove member from group',
          cause: error,
        });
      }
    }),
});
