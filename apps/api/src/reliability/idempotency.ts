import { createHash } from 'crypto';
import { TRPCError } from '@trpc/server';
import { prisma } from '@faithflow/database';
import type { Prisma, IdempotencyKey } from '@faithflow/database';
import type { PolicyActor } from '../security/policy';
import { enqueueOutboxEvents, type OutboxMutationEvent } from './outbox';

type MutationResult<TResult> = {
	result: TResult;
	outboxEvents?: OutboxMutationEvent[];
};

type IdempotentMutationInput<TResult> = {
	organizationId: string;
	actor: PolicyActor;
	action: string;
	idempotencyKey?: string;
	requestFingerprint: unknown;
	execute: (tx: Prisma.TransactionClient) => Promise<MutationResult<TResult>>;
};

function stableStringify(value: unknown): string {
	if (value === null || typeof value !== 'object') {
		return JSON.stringify(value);
	}

	if (Array.isArray(value)) {
		return `[${value.map(stableStringify).join(',')}]`;
	}

	const record = value as Record<string, unknown>;
	const sortedKeys = Object.keys(record).sort();
	return `{${sortedKeys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function fingerprintHash(value: unknown): string {
	return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function isUniqueConstraint(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as { code?: string }).code === 'P2002'
	);
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function ensureFingerprintMatch(
	record: Pick<IdempotencyKey, 'requestHash'>,
	requestHash: string
): void {
	if (record.requestHash !== requestHash) {
		throw new TRPCError({
			code: 'CONFLICT',
			message:
				'Idempotency key was reused with a different request payload. Use a new idempotency key.',
		});
	}
}

function handleExistingIdempotentRecord<TResult>(
	record: Pick<IdempotencyKey, 'status' | 'requestHash' | 'response'>,
	requestHash: string
): TResult | null {
	ensureFingerprintMatch(record, requestHash);

	if (record.status === 'COMPLETED') {
		return record.response as TResult;
	}

	if (record.status === 'PROCESSING') {
		throw new TRPCError({
			code: 'CONFLICT',
			message: 'A request with this idempotency key is still processing.',
		});
	}

	return null;
}

export async function executeIdempotentMutation<TResult>(
	input: IdempotentMutationInput<TResult>
): Promise<TResult> {
	const requestHash = fingerprintHash(input.requestFingerprint);
	const normalizedKey = input.idempotencyKey?.trim();

	if (!normalizedKey) {
		const outcome = await prisma.$transaction(async (tx) => {
			const executed = await input.execute(tx);
			await enqueueOutboxEvents(tx, input.organizationId, executed.outboxEvents);
			return executed.result;
		});
		return outcome;
	}

	const lookupWhere = {
		organizationId_actorId_action_key: {
			organizationId: input.organizationId,
			actorId: input.actor.id,
			action: input.action,
			key: normalizedKey,
		},
	} as const;

	let keyRecord = await prisma.idempotencyKey.findUnique({
		where: lookupWhere,
		select: { id: true, status: true, requestHash: true, response: true },
	});

	if (keyRecord) {
		const prior = handleExistingIdempotentRecord<TResult>(keyRecord, requestHash);
		if (prior !== null) return prior;
	}

	if (!keyRecord) {
		try {
			keyRecord = await prisma.idempotencyKey.create({
				data: {
					organizationId: input.organizationId,
					actorId: input.actor.id,
					action: input.action,
					key: normalizedKey,
					requestHash,
					status: 'PROCESSING',
				},
				select: { id: true, status: true, requestHash: true, response: true },
			});
		} catch (error) {
			if (!isUniqueConstraint(error)) throw error;
			keyRecord = await prisma.idempotencyKey.findUnique({
				where: lookupWhere,
				select: { id: true, status: true, requestHash: true, response: true },
			});
			if (!keyRecord) {
				throw new TRPCError({
					code: 'CONFLICT',
					message: 'Idempotency key conflict. Please retry.',
				});
			}
			const prior = handleExistingIdempotentRecord<TResult>(keyRecord, requestHash);
			if (prior !== null) return prior;
		}
	} else if (keyRecord.status === 'FAILED') {
		await prisma.idempotencyKey.update({
			where: { id: keyRecord.id },
			data: {
				status: 'PROCESSING',
				error: null,
				response: null,
				requestHash,
			},
		});
	}

	try {
		const outcome = await prisma.$transaction(async (tx) => {
			const executed = await input.execute(tx);
			await enqueueOutboxEvents(tx, input.organizationId, executed.outboxEvents);
			await tx.idempotencyKey.update({
				where: { id: keyRecord!.id },
				data: {
					status: 'COMPLETED',
					response: toJsonValue(executed.result),
					error: null,
				},
			});
			return executed.result;
		});

		return outcome;
	} catch (error) {
		await prisma.idempotencyKey.update({
			where: { id: keyRecord!.id },
			data: {
				status: 'FAILED',
				error: error instanceof Error ? error.message : 'Unknown error',
			},
		});
		throw error;
	}
}
