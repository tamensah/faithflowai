import { prisma } from '@faithflow/database';
import type { OutboxEvent, OutboxStatus, Prisma } from '@faithflow/database';
import {
	DEAD_LETTER_PREFIX,
	dispatchOutboxEvent,
	type OutboxDomain,
	type DispatchResult,
	type ProviderDispatchError,
} from './provider-dispatch';

type ProcessOutboxInput = {
	organizationId: string;
	domain: OutboxDomain;
	maxEvents?: number;
};

export type OutboxProcessResult = {
	domain: OutboxDomain;
	organizationId: string;
	claimed: number;
	processed: number;
	failed: number;
	deadLettered: number;
	results: Array<{
		eventId: string;
		eventType: string;
		outcome: 'PROCESSED' | 'FAILED' | 'DEAD_LETTERED';
		message?: string;
		provider?: string;
		mode?: 'LIVE' | 'SIMULATED' | 'INTERNAL';
	}>;
};

const DEFAULT_MAX_EVENTS = 25;
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_RETRY_DELAY_SECONDS = 30;
const DEFAULT_RETRY_BACKOFF_MULTIPLIER = 2;

function domainPrefix(domain: OutboxDomain): string {
	return domain === 'PAYMENT' ? 'payment.' : 'comms.';
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function maxRetries(): number {
	return parsePositiveInt(process.env.FAITHFLOW_OUTBOX_MAX_RETRIES, DEFAULT_MAX_RETRIES);
}

function retryDelaySeconds(attempts: number): number {
	const base = parsePositiveInt(
		process.env.FAITHFLOW_OUTBOX_RETRY_DELAY_SECONDS,
		DEFAULT_RETRY_DELAY_SECONDS
	);
	const multiplier = parsePositiveInt(
		process.env.FAITHFLOW_OUTBOX_RETRY_BACKOFF_MULTIPLIER,
		DEFAULT_RETRY_BACKOFF_MULTIPLIER
	);
	const delay = base * Math.pow(multiplier, Math.max(attempts - 1, 0));
	return Math.min(delay, 60 * 60);
}

function isDeadLetter(lastError: string | null): boolean {
	return Boolean(lastError && lastError.startsWith(DEAD_LETTER_PREFIX));
}

function normalizeError(error: unknown): { message: string; retryable: boolean } {
	if (!error) return { message: 'Unknown outbox dispatch error.', retryable: true };
	if (typeof error === 'object' && error !== null && 'retryable' in error) {
		const dispatchError = error as ProviderDispatchError;
		return {
			message: dispatchError.message ?? 'Outbox dispatch error.',
			retryable: typeof dispatchError.retryable === 'boolean' ? dispatchError.retryable : true,
		};
	}
	if (error instanceof Error) {
		return { message: error.message, retryable: true };
	}
	return { message: String(error), retryable: true };
}

async function claimOutboxEvents(input: ProcessOutboxInput): Promise<OutboxEvent[]> {
	const now = new Date();
	const prefix = domainPrefix(input.domain);
	const limit = Math.min(Math.max(input.maxEvents ?? DEFAULT_MAX_EVENTS, 1), 100);
	const candidates = await prisma.outboxEvent.findMany({
		where: {
			organizationId: input.organizationId,
			eventType: { startsWith: prefix },
			availableAt: { lte: now },
			OR: [
				{ status: 'PENDING' },
				{
					status: 'FAILED',
					NOT: { lastError: { startsWith: DEAD_LETTER_PREFIX } },
				},
			],
		},
		orderBy: { createdAt: 'asc' },
		take: limit,
	});

	const claimed: OutboxEvent[] = [];
	for (const candidate of candidates) {
		const updated = await prisma.outboxEvent.updateMany({
			where: {
				id: candidate.id,
				status: candidate.status,
			},
			data: {
				status: 'PROCESSING',
				lastError: null,
			},
		});
		if (updated.count === 1) {
			claimed.push({
				...candidate,
				status: 'PROCESSING',
				lastError: null,
			});
		}
	}

	return claimed;
}

function mergeDispatchMetadata(
	payload: Prisma.JsonValue,
	dispatch: DispatchResult
): Prisma.InputJsonValue {
	const current =
		payload && typeof payload === 'object' && !Array.isArray(payload)
			? (payload as Record<string, unknown>)
			: {};
	return {
		...current,
		_dispatch: {
			provider: dispatch.provider,
			mode: dispatch.mode,
			providerMessageId: dispatch.providerMessageId ?? null,
			details: dispatch.details ?? {},
			processedAt: new Date().toISOString(),
		},
	} as Prisma.InputJsonValue;
}

async function markProcessedWithDispatch(event: OutboxEvent, dispatch: DispatchResult): Promise<void> {
	await prisma.outboxEvent.update({
		where: { id: event.id },
		data: {
			status: 'PROCESSED',
			processedAt: new Date(),
			lastError: null,
			payload: mergeDispatchMetadata(event.payload as Prisma.JsonValue, dispatch),
		},
	});
}

async function markFailed(
	event: Pick<OutboxEvent, 'id' | 'attempts'>,
	input: { message: string; retryable: boolean }
): Promise<'FAILED' | 'DEAD_LETTERED'> {
	const attempts = event.attempts + 1;
	const shouldDeadLetter = !input.retryable || attempts >= maxRetries();

	const data: Prisma.OutboxEventUpdateInput = shouldDeadLetter
		? {
				status: 'FAILED',
				attempts,
				lastError: `${DEAD_LETTER_PREFIX} ${input.message}`,
				availableAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10),
		  }
		: {
				status: 'FAILED',
				attempts,
				lastError: input.message,
				availableAt: new Date(Date.now() + retryDelaySeconds(attempts) * 1000),
		  };

	await prisma.outboxEvent.update({
		where: { id: event.id },
		data,
	});

	return shouldDeadLetter ? 'DEAD_LETTERED' : 'FAILED';
}

export async function processOutboxBatch(input: ProcessOutboxInput): Promise<OutboxProcessResult> {
	const claimed = await claimOutboxEvents(input);

	const result: OutboxProcessResult = {
		domain: input.domain,
		organizationId: input.organizationId,
		claimed: claimed.length,
		processed: 0,
		failed: 0,
		deadLettered: 0,
		results: [],
	};

	for (const event of claimed) {
		try {
			const dispatch = await dispatchOutboxEvent(event);
			await markProcessedWithDispatch(event, dispatch.result);
			result.processed += 1;
			result.results.push({
				eventId: event.id,
				eventType: event.eventType,
				outcome: 'PROCESSED',
				provider: dispatch.result.provider,
				mode: dispatch.result.mode,
			});
		} catch (error) {
			const normalized = normalizeError(error);
			const outcome = await markFailed(event, normalized);
			if (outcome === 'DEAD_LETTERED') {
				result.deadLettered += 1;
			} else {
				result.failed += 1;
			}
			result.results.push({
				eventId: event.id,
				eventType: event.eventType,
				outcome,
				message: normalized.message,
			});
		}
	}

	return result;
}

export async function listOrganizationsWithPendingOutbox(domain: OutboxDomain): Promise<string[]> {
	const prefix = domainPrefix(domain);
	const rows = await prisma.outboxEvent.findMany({
		where: {
			eventType: { startsWith: prefix },
			availableAt: { lte: new Date() },
			OR: [
				{ status: 'PENDING' as OutboxStatus },
				{
					status: 'FAILED' as OutboxStatus,
					NOT: { lastError: { startsWith: DEAD_LETTER_PREFIX } },
				},
			],
		},
		select: { organizationId: true },
		distinct: ['organizationId'],
	});

	return rows.map((row) => row.organizationId);
}
