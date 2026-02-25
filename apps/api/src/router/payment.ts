import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '@faithflow/database';
import type { Prisma } from '@faithflow/database';
import { protectedProcedure, router } from '../trpc';
import { executeGuardedMutation } from '../security/audit';
import { ensurePolicyAllowed } from '../security/policy';
import { executeIdempotentMutation } from '../reliability/idempotency';
import { deriveAddonFromBillingContext } from '../reliability/addon-entitlements';

const idempotencyKeySchema = z.string().min(8).max(120).optional();
const paymentStatusSchema = z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']);
const paymentMethodSchema = z.enum(['CARD', 'BANK_TRANSFER', 'MOBILE_MONEY']);

const createPaymentSchema = z.object({
	organizationId: z.string().min(1),
	idempotencyKey: idempotencyKeySchema,
	churchId: z.string().min(1),
	memberId: z.string().min(1).optional(),
	amount: z.coerce.number().positive(),
	currency: z.string().length(3).default('USD'),
	paymentMethod: paymentMethodSchema,
	reference: z.string().min(3).max(160),
	description: z.string().max(500).optional(),
	status: paymentStatusSchema.default('PENDING'),
	metadata: z.record(z.unknown()).optional(),
});

const updatePaymentStatusSchema = z.object({
	organizationId: z.string().min(1),
	idempotencyKey: idempotencyKeySchema,
	paymentId: z.string().min(1),
	status: paymentStatusSchema,
	metadata: z.record(z.unknown()).optional(),
});

const refundPaymentSchema = z.object({
	organizationId: z.string().min(1),
	idempotencyKey: idempotencyKeySchema,
	paymentId: z.string().min(1),
	reason: z.string().min(3).max(500),
	metadata: z.record(z.unknown()).optional(),
});

const listPaymentsSchema = z.object({
	organizationId: z.string().min(1),
	churchId: z.string().optional(),
	status: paymentStatusSchema.optional(),
	addonCode: z.string().min(1).max(120).optional(),
	limit: z.number().min(1).max(200).default(50),
	cursor: z.string().optional(),
});

const paymentSummarySchema = z.object({
	organizationId: z.string().min(1),
	churchId: z.string().optional(),
	addonCode: z.string().min(1).max(120).optional(),
});

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return value as JsonRecord;
}

function resolveBillingProvider(value: unknown): 'STRIPE' | 'PAYSTACK' | null {
	if (typeof value !== 'string') return null;
	const normalized = value.trim().toUpperCase();
	if (normalized === 'STRIPE' || normalized === 'PAYSTACK') return normalized;
	return null;
}

function resolveProviderReference(input: {
	metadata: JsonRecord;
	fallbackReference: string;
}): string {
	const providerReference = input.metadata.providerReference;
	if (typeof providerReference === 'string' && providerReference.trim()) {
		return providerReference.trim();
	}
	const nestedProvider = asRecord(input.metadata.provider);
	const nestedReference = nestedProvider.reference;
	if (typeof nestedReference === 'string' && nestedReference.trim()) {
		return nestedReference.trim();
	}
	return input.fallbackReference;
}

async function ensureChurchInOrganization(
	tx: Prisma.TransactionClient,
	churchId: string,
	organizationId: string
): Promise<void> {
	const church = await tx.church.findUnique({
		where: { id: churchId },
		select: { id: true, organizationId: true },
	});
	if (!church || church.organizationId !== organizationId) {
		throw new TRPCError({
			code: 'BAD_REQUEST',
			message: 'Church must belong to the target organization.',
		});
	}
}

export const paymentRouter = router({
	create: protectedProcedure
		.input(createPaymentSchema)
		.mutation(async ({ ctx, input }) =>
			executeGuardedMutation({
				actor: ctx.actor,
				action: 'PAYMENT_WRITE',
				scope: { organizationId: input.organizationId },
				entityType: 'Payment',
				metadata: { reference: input.reference, method: input.paymentMethod },
				execute: async () =>
					executeIdempotentMutation({
						organizationId: input.organizationId,
						actor: ctx.actor,
						action: 'PAYMENT_CREATE',
						idempotencyKey: input.idempotencyKey,
						requestFingerprint: input,
						execute: async (tx) => {
							await ensureChurchInOrganization(tx, input.churchId, input.organizationId);

							if (input.memberId) {
								const member = await tx.member.findFirst({
									where: { id: input.memberId, churchId: input.churchId },
									select: { id: true },
								});
								if (!member) {
									throw new TRPCError({
										code: 'BAD_REQUEST',
										message: 'Member must belong to the provided church.',
									});
								}
							}

							const metadata = asRecord(input.metadata);
							const addonDerivation = await deriveAddonFromBillingContext({
								organizationId: input.organizationId,
								paymentMetadata: metadata,
								provider: resolveBillingProvider(metadata.provider),
								providerReference: resolveProviderReference({
									metadata,
									fallbackReference: input.reference,
								}),
							});

							const payment = await tx.payment.create({
								data: {
									churchId: input.churchId,
									memberId: input.memberId,
									amount: input.amount,
									currency: input.currency.toUpperCase(),
									status: input.status,
									paymentMethod: input.paymentMethod,
									reference: input.reference,
									description: input.description,
									metadata: {
										...metadata,
										organizationId: input.organizationId,
										...(addonDerivation.addonCode
											? { addonCode: addonDerivation.addonCode }
											: {}),
										...(addonDerivation.reference
											? { addonReference: addonDerivation.reference }
											: {}),
										...(addonDerivation.source !== 'NONE'
											? { addonDerivationSource: addonDerivation.source }
											: {}),
									} as Prisma.InputJsonValue,
								},
							});

							await tx.auditEvent.create({
								data: {
									organizationId: input.organizationId,
									actorId: ctx.actor.id,
									actorType: ctx.actor.type,
									actorRoles: ctx.actor.roles.map((role) => role.toUpperCase()),
									action: 'PAYMENT_STATE_CHANGE',
									entityType: 'Payment',
									entityId: payment.id,
									result: 'SUCCESS',
									metadata: {
										operation: 'CREATE',
										status: payment.status,
										reference: payment.reference,
									},
								},
							});

							return {
								result: payment,
								outboxEvents: [
									{
										eventType: 'payment.recorded',
										aggregateType: 'Payment',
										aggregateId: payment.id,
										payload: {
											organizationId: input.organizationId,
											churchId: input.churchId,
											paymentId: payment.id,
											reference: payment.reference,
											status: payment.status,
										},
									},
								],
							};
						},
					}),
			})
		),

	updateStatus: protectedProcedure
		.input(updatePaymentStatusSchema)
		.mutation(async ({ ctx, input }) =>
			executeGuardedMutation({
				actor: ctx.actor,
				action: 'PAYMENT_WRITE',
				scope: { organizationId: input.organizationId },
				entityType: 'Payment',
				entityId: input.paymentId,
				metadata: { status: input.status },
				execute: async () =>
					executeIdempotentMutation({
						organizationId: input.organizationId,
						actor: ctx.actor,
						action: 'PAYMENT_UPDATE_STATUS',
						idempotencyKey: input.idempotencyKey,
						requestFingerprint: input,
						execute: async (tx) => {
							const payment = await tx.payment.findUnique({
								where: { id: input.paymentId },
								select: {
									id: true,
									status: true,
									reference: true,
									church: { select: { organizationId: true } },
								},
							});

							if (!payment || payment.church.organizationId !== input.organizationId) {
								throw new TRPCError({
									code: 'NOT_FOUND',
									message: 'Payment not found for this organization.',
								});
							}

							const updated = await tx.payment.update({
								where: { id: input.paymentId },
								data: {
									status: input.status,
									metadata: input.metadata as Prisma.InputJsonValue,
								},
							});

							await tx.auditEvent.create({
								data: {
									organizationId: input.organizationId,
									actorId: ctx.actor.id,
									actorType: ctx.actor.type,
									actorRoles: ctx.actor.roles.map((role) => role.toUpperCase()),
									action: 'PAYMENT_STATE_CHANGE',
									entityType: 'Payment',
									entityId: updated.id,
									result: 'SUCCESS',
									metadata: {
										operation: 'STATUS_UPDATE',
										fromStatus: payment.status,
										toStatus: input.status,
										reference: payment.reference,
									},
								},
							});

							return {
								result: updated,
								outboxEvents: [
									{
										eventType: 'payment.status.updated',
										aggregateType: 'Payment',
										aggregateId: updated.id,
										payload: {
											organizationId: input.organizationId,
											paymentId: updated.id,
											fromStatus: payment.status,
											toStatus: updated.status,
										},
									},
								],
							};
						},
					}),
			})
		),

	refund: protectedProcedure
		.input(refundPaymentSchema)
		.mutation(async ({ ctx, input }) =>
			executeGuardedMutation({
				actor: ctx.actor,
				action: 'PAYMENT_WRITE',
				scope: { organizationId: input.organizationId },
				entityType: 'Payment',
				entityId: input.paymentId,
				metadata: { operation: 'REFUND' },
				execute: async () =>
					executeIdempotentMutation({
						organizationId: input.organizationId,
						actor: ctx.actor,
						action: 'PAYMENT_REFUND',
						idempotencyKey: input.idempotencyKey,
						requestFingerprint: input,
						execute: async (tx) => {
							const payment = await tx.payment.findUnique({
								where: { id: input.paymentId },
								select: {
									id: true,
									status: true,
									reference: true,
									church: { select: { organizationId: true } },
								},
							});

							if (!payment || payment.church.organizationId !== input.organizationId) {
								throw new TRPCError({
									code: 'NOT_FOUND',
									message: 'Payment not found for this organization.',
								});
							}

							const refunded = await tx.payment.update({
								where: { id: input.paymentId },
								data: {
									status: 'REFUNDED',
									metadata: {
										reason: input.reason,
										...((input.metadata ?? {}) as Record<string, unknown>),
									} as Prisma.InputJsonValue,
								},
							});

							await tx.auditEvent.create({
								data: {
									organizationId: input.organizationId,
									actorId: ctx.actor.id,
									actorType: ctx.actor.type,
									actorRoles: ctx.actor.roles.map((role) => role.toUpperCase()),
									action: 'PAYMENT_STATE_CHANGE',
									entityType: 'Payment',
									entityId: refunded.id,
									result: 'SUCCESS',
									metadata: {
										operation: 'REFUND',
										fromStatus: payment.status,
										toStatus: 'REFUNDED',
										reference: payment.reference,
										reason: input.reason,
									},
								},
							});

							return {
								result: refunded,
								outboxEvents: [
									{
										eventType: 'payment.refunded',
										aggregateType: 'Payment',
										aggregateId: refunded.id,
										payload: {
											organizationId: input.organizationId,
											paymentId: refunded.id,
											reason: input.reason,
										},
									},
								],
							};
						},
					}),
			})
		),

	list: protectedProcedure.input(listPaymentsSchema).query(async ({ ctx, input }) => {
		ensurePolicyAllowed(ctx.actor, 'PAYMENT_READ', {
			organizationId: input.organizationId,
		});

		const addonCode = input.addonCode?.trim().toUpperCase();
		const where: Prisma.PaymentWhereInput = {
			status: input.status,
			church: {
				organizationId: input.organizationId,
				id: input.churchId,
			},
			...(addonCode
				? {
						OR: [
							{
								metadata: {
									path: ['addonCode'],
									equals: addonCode,
								},
							},
							{
								metadata: {
									path: ['providerSync', 'addonCode'],
									equals: addonCode,
								},
							},
						],
					}
				: {}),
		};

		const items = await prisma.payment.findMany({
			where,
			orderBy: { createdAt: 'desc' },
			take: input.limit + 1,
			cursor: input.cursor ? { id: input.cursor } : undefined,
			include: {
				member: {
					select: { firstName: true, lastName: true, email: true },
				},
				church: {
					select: { id: true, name: true, slug: true },
				},
			},
		});

		let nextCursor: string | undefined;
		if (items.length > input.limit) {
			const next = items.pop();
			nextCursor = next?.id;
		}

		return { items, nextCursor };
	}),

	summary: protectedProcedure.input(paymentSummarySchema).query(async ({ ctx, input }) => {
		ensurePolicyAllowed(ctx.actor, 'PAYMENT_READ', {
			organizationId: input.organizationId,
		});

		const addonCode = input.addonCode?.trim().toUpperCase();
		const baseWhere: Prisma.PaymentWhereInput = {
			church: {
				organizationId: input.organizationId,
				id: input.churchId,
			},
			...(addonCode
				? {
						OR: [
							{
								metadata: {
									path: ['addonCode'],
									equals: addonCode,
								},
							},
							{
								metadata: {
									path: ['providerSync', 'addonCode'],
									equals: addonCode,
								},
							},
						],
					}
				: {}),
		};

		const [totalCount, completedCount, refundedCount, failedCount, completedAmountRows] =
			await Promise.all([
				prisma.payment.count({ where: baseWhere }),
				prisma.payment.count({ where: { ...baseWhere, status: 'COMPLETED' } }),
				prisma.payment.count({ where: { ...baseWhere, status: 'REFUNDED' } }),
				prisma.payment.count({ where: { ...baseWhere, status: 'FAILED' } }),
				prisma.payment.groupBy({
					by: ['currency'],
					where: { ...baseWhere, status: 'COMPLETED' },
					_sum: { amount: true },
				}),
			]);

		return {
			totalCount,
			completedCount,
			refundedCount,
			failedCount,
			completedByCurrency: completedAmountRows.map((row) => ({
				currency: row.currency,
				amount: row._sum.amount ?? 0,
			})),
		};
	}),
});
