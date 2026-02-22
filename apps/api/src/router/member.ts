import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { prisma } from '@faithflow/database';
import type { Prisma } from '@faithflow/database';
import { TRPCError } from '@trpc/server';

const createMemberSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  email: z.string().email().optional(),
  churchId: z.string(),
});

const updateMemberSchema = createMemberSchema.partial();

function toCreateData(input: z.infer<typeof createMemberSchema>): Prisma.MemberUncheckedCreateInput {
	return {
		firstName: input.firstName,
		lastName: input.lastName,
		email: input.email,
		churchId: input.churchId,
	};
}

function toUpdateData(input: z.infer<typeof updateMemberSchema>): Prisma.MemberUncheckedUpdateInput {
	const data: Prisma.MemberUncheckedUpdateInput = {};
	if (typeof input.firstName === 'string') data.firstName = input.firstName;
	if (typeof input.lastName === 'string') data.lastName = input.lastName;
	if (typeof input.email === 'string') data.email = input.email;
	if (typeof input.churchId === 'string') data.churchId = input.churchId;
	return data;
}

export const memberRouter = router({
  create: publicProcedure
    .input(createMemberSchema)
    .mutation(async ({ input }) => {
      try {
        return await prisma.member.create({
          data: toCreateData(input),
        });
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create member',
          cause: error,
        });
      }
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string(),
      data: updateMemberSchema,
    }))
    .mutation(async ({ input }) => {
      try {
        return await prisma.member.update({
          where: { id: input.id },
          data: toUpdateData(input.data),
        });
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update member',
          cause: error,
        });
      }
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      try {
        return await prisma.member.delete({
          where: { id: input.id },
        });
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete member',
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
        const items = await prisma.member.findMany({
          take: input.limit + 1,
          cursor: input.cursor ? { id: input.cursor } : undefined,
          where: input.churchId ? { churchId: input.churchId } : undefined,
          orderBy: { createdAt: 'desc' },
          include: {
            groups: true,
            events: true,
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
          message: 'Failed to fetch members',
          cause: error,
        });
      }
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      try {
        const member = await prisma.member.findUnique({
          where: { id: input.id },
          include: {
            groups: true,
            events: true,
          },
        });

        if (!member) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Member not found',
          });
        }

        return member;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch member',
          cause: error,
        });
      }
    }),
});
