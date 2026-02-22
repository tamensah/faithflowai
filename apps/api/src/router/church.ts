import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { prisma } from '@faithflow/database';
import type { Prisma } from '@faithflow/database';
import { TRPCError } from '@trpc/server';

const createChurchSchema = z.object({
	name: z.string().min(2).max(100),
	slug: z.string().min(2).max(100),
	domain: z.string().optional(),
	timezone: z.string().default('UTC'),
});

const updateChurchSchema = createChurchSchema.partial();

function toCreateData(input: z.infer<typeof createChurchSchema>): Prisma.ChurchCreateInput {
	return {
		name: input.name,
		slug: input.slug,
		domain: input.domain,
		timezone: input.timezone,
	};
}

function toUpdateData(input: z.infer<typeof updateChurchSchema>): Prisma.ChurchUpdateInput {
	const data: Prisma.ChurchUpdateInput = {};
	if (typeof input.name === 'string') data.name = input.name;
	if (typeof input.slug === 'string') data.slug = input.slug;
	if (typeof input.domain === 'string') data.domain = input.domain;
	if (typeof input.timezone === 'string') data.timezone = input.timezone;
	return data;
}

export const churchRouter = router({
	create: publicProcedure
		.input(createChurchSchema)
		.mutation(async ({ input }) => {
			try {
				return await prisma.church.create({
					data: toCreateData(input),
				});
			} catch (error) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to create church',
					cause: error,
				});
			}
		}),

	update: publicProcedure
		.input(z.object({
			id: z.string(),
			data: updateChurchSchema,
		}))
		.mutation(async ({ input }) => {
			try {
				return await prisma.church.update({
					where: { id: input.id },
					data: toUpdateData(input.data),
				});
			} catch (error) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to update church',
					cause: error,
				});
			}
		}),

	delete: publicProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input }) => {
			try {
				return await prisma.church.delete({
					where: { id: input.id },
				});
			} catch (error) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to delete church',
					cause: error,
				});
			}
		}),

	list: publicProcedure
		.input(z.object({
			limit: z.number().min(1).max(100).default(10),
			cursor: z.string().optional(),
		}))
		.query(async ({ input }) => {
			try {
				const items = await prisma.church.findMany({
					take: input.limit + 1,
					cursor: input.cursor ? { id: input.cursor } : undefined,
					orderBy: { createdAt: 'desc' },
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
					message: 'Failed to fetch churches',
					cause: error,
				});
			}
		}),

	byId: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ input }) => {
			try {
				const church = await prisma.church.findUnique({
					where: { id: input.id },
					include: {
						members: true,
						events: true,
					},
				});

				if (!church) {
					throw new TRPCError({
						code: 'NOT_FOUND',
						message: 'Church not found',
					});
				}

				return church;
			} catch (error) {
				if (error instanceof TRPCError) throw error;
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to fetch church',
					cause: error,
				});
			}
		}),
});
