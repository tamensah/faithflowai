import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '@faithflow/database';
import type { Prisma } from '@faithflow/database';
import { protectedProcedure, router } from '../trpc';
import { executeGuardedMutation } from '../security/audit';
import { ensurePolicyAllowed } from '../security/policy';
import { executeIdempotentMutation } from '../reliability/idempotency';
import { processOutboxBatch } from '../reliability/outbox-processor';

const idempotencyKeySchema = z.string().min(8).max(120).optional();
const domainSchema = z.enum(['PAYMENT', 'COMMS']);
const outboxStatusSchema = z.enum(['PENDING', 'PROCESSING', 'PROCESSED', 'FAILED']);
const deadLetterPrefix = 'DEAD_LETTER:';

const listOutboxSchema = z.object({
	organizationId: z.string().min(1),
	domain: domainSchema,
	status: outboxStatusSchema.optional(),
	query: z.string().max(120).optional(),
	deadLetterOnly: z.boolean().default(false),
	limit: z.number().min(1).max(200).default(50),
	cursor: z.string().optional(),
});

const retryOutboxSchema = z.object({
	organizationId: z.string().min(1),
	idempotencyKey: idempotencyKeySchema,
	domain: domainSchema,
	eventId: z.string().min(1),
	delaySeconds: z.number().int().min(0).max(3600).default(0),
});

const deadLetterOutboxSchema = z.object({
	organizationId: z.string().min(1),
	idempotencyKey: idempotencyKeySchema,
	domain: domainSchema,
	eventId: z.string().min(1),
	reason: z.string().min(3).max(300).default('Manually moved to dead letter queue'),
});

const processOutboxSchema = z.object({
	organizationId: z.string().min(1),
	domain: domainSchema,
	maxEvents: z.number().int().min(1).max(100).default(25),
});

function domainPrefix(domain: z.infer<typeof domainSchema>): string {
	return domain === 'PAYMENT' ? 'payment.' : 'comms.';
}

function resolvePolicyAction(
	domain: z.infer<typeof domainSchema>,
	access: 'READ' | 'WRITE'
): 'PAYMENT_READ' | 'PAYMENT_WRITE' | 'COMMS_READ' | 'COMMS_WRITE' {
	if (domain === 'PAYMENT') {
		return access === 'READ' ? 'PAYMENT_READ' : 'PAYMENT_WRITE';
	}
	return access === 'READ' ? 'COMMS_READ' : 'COMMS_WRITE';
}

function ensureScopedOutboxEvent(
	event: {
		id: string;
		organizationId: string;
		eventType: string;
		status: 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
		attempts: number;
		availableAt: Date;
		lastError: string | null;
	},
	input: { organizationId: string; domain: z.infer<typeof domainSchema> }
): void {
	if (event.organizationId !== input.organizationId) {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'Outbox event not found for this organization.',
		});
	}

	if (!event.eventType.startsWith(domainPrefix(input.domain))) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: `Outbox event does not belong to the ${input.domain.toLowerCase()} domain.`,
		});
	}
}

export const outboxRouter = router({
	list: protectedProcedure.input(listOutboxSchema).query(async ({ ctx, input }) => {
		ensurePolicyAllowed(ctx.actor, resolvePolicyAction(input.domain, 'READ'), {
			organizationId: input.organizationId,
		});

		const prefix = domainPrefix(input.domain);
		const normalizedQuery = input.query?.trim();
		const andFilters: Prisma.OutboxEventWhereInput[] = [
			{ organizationId: input.organizationId },
			{ eventType: { startsWith: prefix } },
		];

		if (input.status) {
			andFilters.push({ status: input.status });
		}
		if (input.deadLetterOnly) {
			andFilters.push({ lastError: { startsWith: deadLetterPrefix } });
		}
		if (normalizedQuery) {
			andFilters.push({
				OR: [
					{ eventType: { contains: normalizedQuery, mode: 'insensitive' } },
					{ aggregateType: { contains: normalizedQuery, mode: 'insensitive' } },
					{ aggregateId: { contains: normalizedQuery, mode: 'insensitive' } },
					{ lastError: { contains: normalizedQuery, mode: 'insensitive' } },
				],
			});
		}

		const where: Prisma.OutboxEventWhereInput = { AND: andFilters };
		const summaryWhere: Prisma.OutboxEventWhereInput = {
			organizationId: input.organizationId,
			eventType: { startsWith: prefix },
		};

		const [items, pendingCount, processingCount, processedCount, failedCount, deadLetterCount] =
			await Promise.all([
				prisma.outboxEvent.findMany({
					where,
					orderBy: { createdAt: 'desc' },
					take: input.limit + 1,
					cursor: input.cursor ? { id: input.cursor } : undefined,
				}),
				prisma.outboxEvent.count({
					where: { ...summaryWhere, status: 'PENDING' },
				}),
				prisma.outboxEvent.count({
					where: { ...summaryWhere, status: 'PROCESSING' },
				}),
				prisma.outboxEvent.count({
					where: { ...summaryWhere, status: 'PROCESSED' },
				}),
				prisma.outboxEvent.count({
					where: { ...summaryWhere, status: 'FAILED' },
				}),
				prisma.outboxEvent.count({
					where: {
						...summaryWhere,
						status: 'FAILED',
						lastError: { startsWith: deadLetterPrefix },
					},
				}),
			]);

		let nextCursor: string | undefined;
		if (items.length > input.limit) {
			const next = items.pop();
			nextCursor = next?.id;
		}

		return {
			items,
			nextCursor,
			summary: {
				pendingCount,
				processingCount,
				processedCount,
				failedCount,
				deadLetterCount,
			},
		};
	}),

	retry: protectedProcedure.input(retryOutboxSchema).mutation(async ({ ctx, input }) =>
		executeGuardedMutation({
			actor: ctx.actor,
			action: resolvePolicyAction(input.domain, 'WRITE'),
			scope: { organizationId: input.organizationId },
			entityType: 'OutboxEvent',
			entityId: input.eventId,
			metadata: { operation: 'RETRY', domain: input.domain },
			execute: async () =>
				executeIdempotentMutation({
					organizationId: input.organizationId,
					actor: ctx.actor,
					action: 'OUTBOX_RETRY_EVENT',
					idempotencyKey: input.idempotencyKey,
					requestFingerprint: input,
					execute: async (tx) => {
						const event = await tx.outboxEvent.findUnique({
							where: { id: input.eventId },
							select: {
								id: true,
								organizationId: true,
								eventType: true,
								status: true,
								attempts: true,
								availableAt: true,
								lastError: true,
							},
						});
						if (!event) {
							throw new TRPCError({
								code: 'NOT_FOUND',
								message: 'Outbox event not found.',
							});
						}
							ensureScopedOutboxEvent(event, {
								organizationId: input.organizationId,
								domain: input.domain,
							});
						if (event.status === 'PROCESSED') {
							throw new TRPCError({
								code: 'BAD_REQUEST',
								message: 'Processed outbox events cannot be retried.',
							});
						}

						const availableAt = new Date(Date.now() + input.delaySeconds * 1000);
						const updated = await tx.outboxEvent.update({
							where: { id: input.eventId },
							data: {
								status: 'PENDING',
								availableAt,
								lastError: null,
							},
						});
						return { result: updated };
					},
				}),
		})
	),

	deadLetter: protectedProcedure.input(deadLetterOutboxSchema).mutation(async ({ ctx, input }) =>
		executeGuardedMutation({
			actor: ctx.actor,
			action: resolvePolicyAction(input.domain, 'WRITE'),
			scope: { organizationId: input.organizationId },
			entityType: 'OutboxEvent',
			entityId: input.eventId,
			metadata: { operation: 'DEAD_LETTER', domain: input.domain },
			execute: async () =>
				executeIdempotentMutation({
					organizationId: input.organizationId,
					actor: ctx.actor,
					action: 'OUTBOX_DEAD_LETTER_EVENT',
					idempotencyKey: input.idempotencyKey,
					requestFingerprint: input,
					execute: async (tx) => {
						const event = await tx.outboxEvent.findUnique({
							where: { id: input.eventId },
							select: {
								id: true,
								organizationId: true,
								eventType: true,
								status: true,
								attempts: true,
								availableAt: true,
								lastError: true,
							},
						});
						if (!event) {
							throw new TRPCError({
								code: 'NOT_FOUND',
								message: 'Outbox event not found.',
							});
						}
							ensureScopedOutboxEvent(event, {
								organizationId: input.organizationId,
								domain: input.domain,
							});

						const updated = await tx.outboxEvent.update({
							where: { id: input.eventId },
							data: {
								status: 'FAILED',
								availableAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10),
								lastError: `${deadLetterPrefix} ${input.reason}`,
							},
						});
						return { result: updated };
					},
				}),
		})
	),

	process: protectedProcedure.input(processOutboxSchema).mutation(async ({ ctx, input }) =>
		executeGuardedMutation({
			actor: ctx.actor,
			action: resolvePolicyAction(input.domain, 'WRITE'),
			scope: { organizationId: input.organizationId },
			entityType: 'OutboxEvent',
			metadata: { operation: 'PROCESS', domain: input.domain, maxEvents: input.maxEvents },
			execute: async () =>
				processOutboxBatch({
					organizationId: input.organizationId,
					domain: input.domain,
					maxEvents: input.maxEvents,
				}),
		})
	),
});
