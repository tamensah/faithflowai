import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '@faithflow/database';
import type { Prisma, UserRole } from '@faithflow/database';
import { protectedProcedure, router } from '../trpc';
import { executeGuardedMutation } from '../security/audit';
import { ensurePolicyAllowed } from '../security/policy';
import { executeIdempotentMutation } from '../reliability/idempotency';

const idempotencyKeySchema = z.string().min(8).max(120).optional();

const createRoomSchema = z.object({
	organizationId: z.string().min(1),
	idempotencyKey: idempotencyKeySchema,
	name: z.string().min(2).max(160),
	type: z.string().min(2).max(80).default('THREAD'),
	churchId: z.string().optional(),
	participantUserIds: z.array(z.string().min(1)).max(100).default([]),
	metadata: z.record(z.unknown()).optional(),
});

const sendMessageSchema = z.object({
	organizationId: z.string().min(1),
	idempotencyKey: idempotencyKeySchema,
	roomId: z.string().min(1),
	content: z.string().min(1).max(4000),
	type: z.string().min(2).max(80).default('TEXT'),
	metadata: z.record(z.unknown()).optional(),
});

const dispatchSchema = z.object({
	organizationId: z.string().min(1),
	idempotencyKey: idempotencyKeySchema,
	churchId: z.string().optional(),
	channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH']),
	recipient: z.string().min(3).max(255),
	subject: z.string().max(200).optional(),
	body: z.string().min(1).max(4000),
	templateKey: z.string().max(120).optional(),
	metadata: z.record(z.unknown()).optional(),
});

const listMessagesSchema = z.object({
	organizationId: z.string().min(1),
	roomId: z.string().min(1),
	limit: z.number().min(1).max(200).default(50),
	cursor: z.string().optional(),
});

const listRoomsSchema = z.object({
	organizationId: z.string().min(1),
	limit: z.number().min(1).max(200).default(50),
	cursor: z.string().optional(),
});

function getOrganizationIdFromRoomMetadata(metadata: unknown): string | null {
	if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
	const organizationId = (metadata as Record<string, unknown>).organizationId;
	return typeof organizationId === 'string' && organizationId ? organizationId : null;
}

function actorRoleToUserRole(roles: string[]): UserRole {
	const normalized = roles.map((role) => role.toUpperCase());
	if (normalized.some((role) => role.includes('ADMIN'))) return 'ADMIN';
	if (normalized.some((role) => role.includes('STAFF') || role.includes('COMMS'))) return 'STAFF';
	return 'USER';
}

async function ensureActorUser(
	tx: Prisma.TransactionClient,
	actor: { id?: string; roles?: string[] }
) {
	if (!actor.id) {
		throw new TRPCError({
			code: 'UNAUTHORIZED',
			message: 'Actor context is required for comms mutations.',
		});
	}

	const roles = Array.isArray(actor.roles) ? actor.roles : [];

	return tx.user.upsert({
		where: { id: actor.id },
		update: {
			role: actorRoleToUserRole(roles),
		},
		create: {
			id: actor.id,
			role: actorRoleToUserRole(roles),
		},
		select: { id: true },
	});
}

export const commsRouter = router({
	createRoom: protectedProcedure
		.input(createRoomSchema)
		.mutation(async ({ ctx, input }) =>
			executeGuardedMutation({
				actor: ctx.actor,
				action: 'COMMS_WRITE',
				scope: { organizationId: input.organizationId },
				entityType: 'SocketRoom',
				metadata: { type: input.type, name: input.name },
				execute: async () =>
					executeIdempotentMutation({
						organizationId: input.organizationId,
						actor: ctx.actor,
						action: 'COMMS_CREATE_ROOM',
						idempotencyKey: input.idempotencyKey,
						requestFingerprint: input,
						execute: async (tx) => {
							if (input.churchId) {
								const church = await tx.church.findUnique({
									where: { id: input.churchId },
									select: { organizationId: true },
								});
								if (!church || church.organizationId !== input.organizationId) {
									throw new TRPCError({
										code: 'BAD_REQUEST',
										message: 'Church must belong to the organization.',
									});
								}
							}

							const actorUser = await ensureActorUser(tx, ctx.actor);
							const participantIds = Array.from(
								new Set([actorUser.id, ...input.participantUserIds])
							);

							const validParticipants = await tx.user.findMany({
								where: { id: { in: participantIds } },
								select: { id: true },
							});

							const room = await tx.socketRoom.create({
								data: {
									name: input.name,
									type: input.type,
									metadata: {
										organizationId: input.organizationId,
										churchId: input.churchId ?? null,
										...((input.metadata ?? {}) as Record<string, unknown>),
									} as Prisma.InputJsonValue,
									participants: {
										connect: validParticipants.map((participant) => ({ id: participant.id })),
									},
								},
								include: {
									participants: {
										select: { id: true, email: true, name: true, role: true },
									},
								},
							});

							await tx.auditEvent.create({
								data: {
									organizationId: input.organizationId,
									actorId: ctx.actor.id,
									actorType: ctx.actor.type,
									actorRoles: ctx.actor.roles.map((role) => role.toUpperCase()),
									action: 'COMMS_ROOM_CHANGE',
									entityType: 'SocketRoom',
									entityId: room.id,
									result: 'SUCCESS',
									metadata: {
										operation: 'CREATE',
										type: input.type,
										participants: validParticipants.length,
									},
								},
							});

							return {
								result: room,
								outboxEvents: [
									{
										eventType: 'comms.room.created',
										aggregateType: 'SocketRoom',
										aggregateId: room.id,
										payload: {
											organizationId: input.organizationId,
											roomId: room.id,
											type: room.type,
										},
									},
								],
							};
						},
					}),
			})
		),

	sendMessage: protectedProcedure
		.input(sendMessageSchema)
		.mutation(async ({ ctx, input }) =>
			executeGuardedMutation({
				actor: ctx.actor,
				action: 'COMMS_WRITE',
				scope: { organizationId: input.organizationId },
				entityType: 'Message',
				metadata: { roomId: input.roomId, type: input.type },
				execute: async () =>
					executeIdempotentMutation({
						organizationId: input.organizationId,
						actor: ctx.actor,
						action: 'COMMS_SEND_MESSAGE',
						idempotencyKey: input.idempotencyKey,
						requestFingerprint: input,
						execute: async (tx) => {
							const room = await tx.socketRoom.findUnique({
								where: { id: input.roomId },
								select: { id: true, metadata: true },
							});

							if (!room) {
								throw new TRPCError({
									code: 'NOT_FOUND',
									message: 'Room not found.',
								});
							}

							const roomOrganizationId = getOrganizationIdFromRoomMetadata(room.metadata);
							if (roomOrganizationId !== input.organizationId) {
								throw new TRPCError({
									code: 'FORBIDDEN',
									message: 'Room does not belong to this organization.',
								});
							}

							const actorUser = await ensureActorUser(tx, ctx.actor);
							const message = await tx.message.create({
								data: {
									roomId: input.roomId,
									senderId: actorUser.id,
									content: input.content,
									type: input.type,
									metadata: input.metadata as Prisma.InputJsonValue,
								},
								include: {
									sender: {
										select: { id: true, email: true, name: true, role: true },
									},
								},
							});

							await tx.auditEvent.create({
								data: {
									organizationId: input.organizationId,
									actorId: ctx.actor.id,
									actorType: ctx.actor.type,
									actorRoles: ctx.actor.roles.map((role) => role.toUpperCase()),
									action: 'COMMS_MESSAGE_SENT',
									entityType: 'Message',
									entityId: message.id,
									result: 'SUCCESS',
									metadata: {
										roomId: message.roomId,
										type: message.type,
									},
								},
							});

							return {
								result: message,
								outboxEvents: [
									{
										eventType: 'comms.message.sent',
										aggregateType: 'Message',
										aggregateId: message.id,
										payload: {
											organizationId: input.organizationId,
											roomId: message.roomId,
											messageId: message.id,
											type: message.type,
										},
									},
								],
							};
						},
					}),
			})
		),

	dispatch: protectedProcedure
		.input(dispatchSchema)
		.mutation(async ({ ctx, input }) =>
			executeGuardedMutation({
				actor: ctx.actor,
				action: 'COMMS_WRITE',
				scope: { organizationId: input.organizationId },
				entityType: 'OutboxEvent',
				metadata: { channel: input.channel, recipient: input.recipient },
				execute: async () =>
					executeIdempotentMutation({
						organizationId: input.organizationId,
						actor: ctx.actor,
						action: 'COMMS_DISPATCH',
						idempotencyKey: input.idempotencyKey,
						requestFingerprint: input,
						execute: async (tx) => {
							if (input.churchId) {
								const church = await tx.church.findUnique({
									where: { id: input.churchId },
									select: { organizationId: true },
								});
								if (!church || church.organizationId !== input.organizationId) {
									throw new TRPCError({
										code: 'BAD_REQUEST',
										message: 'Church must belong to the organization.',
									});
								}
							}

							await tx.auditEvent.create({
								data: {
									organizationId: input.organizationId,
									actorId: ctx.actor.id,
									actorType: ctx.actor.type,
									actorRoles: ctx.actor.roles.map((role) => role.toUpperCase()),
									action: 'COMMS_DISPATCH_REQUEST',
									entityType: 'OutboxEvent',
									result: 'SUCCESS',
									metadata: {
										channel: input.channel,
										recipient: input.recipient,
										templateKey: input.templateKey ?? null,
									},
								},
							});

							return {
								result: {
									queued: true,
									channel: input.channel,
									recipient: input.recipient,
								},
								outboxEvents: [
									{
										eventType: 'comms.dispatch.requested',
										aggregateType: 'CommsDispatch',
										payload: {
											organizationId: input.organizationId,
											churchId: input.churchId ?? null,
											channel: input.channel,
											recipient: input.recipient,
											subject: input.subject ?? null,
											body: input.body,
											templateKey: input.templateKey ?? null,
											metadata: input.metadata ?? {},
										},
									},
								],
							};
						},
					}),
			})
		),

	listRooms: protectedProcedure.input(listRoomsSchema).query(async ({ ctx, input }) => {
		ensurePolicyAllowed(ctx.actor, 'COMMS_READ', {
			organizationId: input.organizationId,
		});

		const rooms = await prisma.socketRoom.findMany({
			orderBy: { updatedAt: 'desc' },
			take: input.limit + 1,
			cursor: input.cursor ? { id: input.cursor } : undefined,
			include: {
				participants: {
					select: { id: true, email: true, name: true, role: true },
				},
				_count: {
					select: { messages: true },
				},
			},
		});

		const scopedRooms = rooms.filter(
			(room) => getOrganizationIdFromRoomMetadata(room.metadata) === input.organizationId
		);
		let nextCursor: string | undefined;
		if (scopedRooms.length > input.limit) {
			const next = scopedRooms.pop();
			nextCursor = next?.id;
		}

		return { items: scopedRooms, nextCursor };
	}),

	listMessages: protectedProcedure.input(listMessagesSchema).query(async ({ ctx, input }) => {
		ensurePolicyAllowed(ctx.actor, 'COMMS_READ', {
			organizationId: input.organizationId,
		});

		const room = await prisma.socketRoom.findUnique({
			where: { id: input.roomId },
			select: { metadata: true },
		});
		if (!room || getOrganizationIdFromRoomMetadata(room.metadata) !== input.organizationId) {
			throw new TRPCError({
				code: 'FORBIDDEN',
				message: 'Room does not belong to this organization.',
			});
		}

		const items = await prisma.message.findMany({
			where: { roomId: input.roomId },
			orderBy: { createdAt: 'desc' },
			take: input.limit + 1,
			cursor: input.cursor ? { id: input.cursor } : undefined,
			include: {
				sender: {
					select: { id: true, email: true, name: true, role: true },
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
});
