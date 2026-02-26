import { NextRequest, NextResponse } from 'next/server';
import { createAppCaller } from '@/lib/app-caller';
import { requireDatabaseForApi } from '@/lib/database-guard';

type Domain = 'PAYMENT' | 'COMMS';
type OutboxStatus = 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED';

const domainValues = new Set<Domain>(['PAYMENT', 'COMMS']);
const statusValues = new Set<OutboxStatus>(['PENDING', 'PROCESSING', 'PROCESSED', 'FAILED']);

function isDomain(value: string | null): value is Domain {
	return value !== null && domainValues.has(value as Domain);
}

function isStatus(value: string | null): value is OutboxStatus {
	return value !== null && statusValues.has(value as OutboxStatus);
}

function resolveHttpStatus(error: unknown): number {
	const message = error instanceof Error ? error.message : '';
	if (message.toLowerCase().includes('unauthorized')) return 401;
	if (message.toLowerCase().includes('forbidden')) return 403;
	if (message.toLowerCase().includes('not found')) return 404;
	if (message.toLowerCase().includes('invalid') || message.toLowerCase().includes('required')) return 400;
	return 500;
}

export async function GET(request: NextRequest) {
	const dbUnavailable = requireDatabaseForApi('outbox.get');
	if (dbUnavailable) return dbUnavailable;

	const domainParam = request.nextUrl.searchParams.get('domain');
	if (!isDomain(domainParam)) {
		return NextResponse.json({ error: 'domain is required (PAYMENT | COMMS)' }, { status: 400 });
	}

	const statusParam = request.nextUrl.searchParams.get('status');
	const status = isStatus(statusParam) ? statusParam : undefined;
	const query = request.nextUrl.searchParams.get('query') ?? undefined;
	const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined;
	const deadLetterOnly = request.nextUrl.searchParams.get('deadLetterOnly') === 'true';
	const limitRaw = Number(request.nextUrl.searchParams.get('limit') ?? '50');
	const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

	try {
		const { caller, actor } = await createAppCaller();
		const payload = await caller.outbox.list({
			organizationId: actor.organizationId,
			domain: domainParam,
			status,
			query,
			deadLetterOnly,
			limit,
			cursor,
		});
		return NextResponse.json(payload);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to load outbox events';
		return NextResponse.json({ error: message }, { status: resolveHttpStatus(error) });
	}
}

export async function PATCH(request: NextRequest) {
	const dbUnavailable = requireDatabaseForApi('outbox.patch');
	if (dbUnavailable) return dbUnavailable;

	const payload = (await request.json()) as {
		domain?: Domain;
		action?: 'retry' | 'deadLetter';
		eventId?: string;
		reason?: string;
		delaySeconds?: number;
		idempotencyKey?: string;
	};

	if (!payload.domain || !domainValues.has(payload.domain)) {
		return NextResponse.json({ error: 'domain is required (PAYMENT | COMMS)' }, { status: 400 });
	}
	if (!payload.eventId || !payload.action) {
		return NextResponse.json({ error: 'eventId and action are required' }, { status: 400 });
	}

	try {
		const { caller, actor } = await createAppCaller();
		const organizationId = actor.organizationId;
		const idempotencyKey =
			payload.idempotencyKey ?? request.headers.get('x-idempotency-key') ?? undefined;

		if (payload.action === 'retry') {
			const event = await caller.outbox.retry({
				organizationId,
				domain: payload.domain,
				eventId: payload.eventId,
				delaySeconds: payload.delaySeconds ?? 0,
				idempotencyKey,
			});
			return NextResponse.json({ event });
		}

		const event = await caller.outbox.deadLetter({
			organizationId,
			domain: payload.domain,
			eventId: payload.eventId,
			reason: payload.reason ?? 'Manual dead-letter action from admin console',
			idempotencyKey,
		});
		return NextResponse.json({ event });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to update outbox event';
		return NextResponse.json({ error: message }, { status: resolveHttpStatus(error) });
	}
}

export async function POST(request: NextRequest) {
	const dbUnavailable = requireDatabaseForApi('outbox.post');
	if (dbUnavailable) return dbUnavailable;

	const payload = (await request.json().catch(() => ({}))) as {
		domain?: Domain;
		maxEvents?: number;
	};

	if (!payload.domain || !domainValues.has(payload.domain)) {
		return NextResponse.json({ error: 'domain is required (PAYMENT | COMMS)' }, { status: 400 });
	}

	const maxEventsRaw = Number(payload.maxEvents ?? 25);
	const maxEvents = Number.isFinite(maxEventsRaw) ? Math.min(Math.max(maxEventsRaw, 1), 100) : 25;

	try {
		const { caller, actor } = await createAppCaller();
		const result = await caller.outbox.process({
			organizationId: actor.organizationId,
			domain: payload.domain,
			maxEvents,
		});
		return NextResponse.json({ result });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to process outbox';
		return NextResponse.json({ error: message }, { status: resolveHttpStatus(error) });
	}
}
