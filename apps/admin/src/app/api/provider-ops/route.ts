import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@faithflow/database';
import { createAppCaller } from '@/lib/app-caller';

export const runtime = 'nodejs';

type Domain = 'PAYMENT' | 'COMMS';
type Provider = 'STRIPE' | 'PAYSTACK' | 'RESEND' | 'TWILIO';

function isDomain(value: string): value is Domain {
	return value === 'PAYMENT' || value === 'COMMS';
}

function hasEnv(name: string): boolean {
	return Boolean(process.env[name]?.trim());
}

function asRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
}

function parseProviderFromEvent(
	eventType: string,
	payloadValue: unknown
): { provider: Provider | null; mode: 'LIVE' | 'SIMULATED' | 'INTERNAL' | null; deliveryState: string | null; providerMessageId: string | null } {
	const payload = asRecord(payloadValue);
	const dispatch = asRecord(payload._dispatch);
	const delivery = asRecord(payload._delivery);

	const providerValue =
		typeof delivery.provider === 'string'
			? delivery.provider
			: typeof dispatch.provider === 'string'
				? dispatch.provider
				: typeof payload.provider === 'string'
					? payload.provider
					: null;
	const provider = providerValue && ['STRIPE', 'PAYSTACK', 'RESEND', 'TWILIO'].includes(providerValue)
		? (providerValue as Provider)
		: null;

	const modeValue = typeof dispatch.mode === 'string' ? dispatch.mode : null;
	const mode = modeValue && ['LIVE', 'SIMULATED', 'INTERNAL'].includes(modeValue)
		? (modeValue as 'LIVE' | 'SIMULATED' | 'INTERNAL')
		: null;

	const deliveryState =
		typeof delivery.state === 'string'
			? delivery.state
			: eventType === 'payment.provider.reconciled'
				? 'RECONCILED'
				: null;

	const providerMessageId =
		typeof delivery.providerMessageId === 'string'
			? delivery.providerMessageId
			: typeof dispatch.providerMessageId === 'string'
				? dispatch.providerMessageId
				: typeof payload.providerEventId === 'string'
					? payload.providerEventId
					: null;

	return { provider, mode, deliveryState, providerMessageId };
}

function resolveWebhookHealth(
	outcomes: Array<{
		provider: Provider | null;
		updatedAt: string;
	}>
) {
	const providers: Array<{
		provider: Provider;
		endpoint: string;
		configured: boolean;
	}> = [
		{
			provider: 'STRIPE',
			endpoint: '/api/webhooks/stripe',
			configured: hasEnv('STRIPE_WEBHOOK_SECRET') && hasEnv('STRIPE_SECRET_KEY'),
		},
		{
			provider: 'PAYSTACK',
			endpoint: '/api/webhooks/paystack',
			configured: hasEnv('PAYSTACK_SECRET_KEY'),
		},
		{
			provider: 'RESEND',
			endpoint: '/api/webhooks/resend',
			configured: hasEnv('RESEND_WEBHOOK_SECRET') && hasEnv('RESEND_API_KEY'),
		},
		{
			provider: 'TWILIO',
			endpoint: '/api/webhooks/twilio',
			configured:
				hasEnv('TWILIO_ACCOUNT_SID') && hasEnv('TWILIO_AUTH_TOKEN') && hasEnv('TWILIO_PHONE_NUMBER'),
		},
	];

	return providers.map((entry) => {
		const providerEvents = outcomes.filter((outcome) => outcome.provider === entry.provider);
		return {
			provider: entry.provider,
			endpoint: entry.endpoint,
			configured: entry.configured,
			lastSeenAt: providerEvents[0]?.updatedAt ?? null,
			recentEvents: providerEvents.length,
		};
	});
}

export async function GET(request: NextRequest) {
	const limitRaw = Number(request.nextUrl.searchParams.get('limit') ?? '40');
	const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 10), 100) : 40;

	try {
		const { caller, actor } = await createAppCaller();
		const organizationId = actor.organizationId;

		const [paymentQueue, commsQueue, events] = await Promise.all([
			caller.outbox.list({
				organizationId,
				domain: 'PAYMENT',
				limit: 10,
			}),
			caller.outbox.list({
				organizationId,
				domain: 'COMMS',
				limit: 10,
			}),
			prisma.outboxEvent.findMany({
				where: {
					organizationId,
					status: { in: ['PROCESSED', 'FAILED'] },
					OR: [{ eventType: { startsWith: 'payment.' } }, { eventType: { startsWith: 'comms.' } }],
				},
				orderBy: { updatedAt: 'desc' },
				take: limit,
				select: {
					id: true,
					eventType: true,
					status: true,
					attempts: true,
					availableAt: true,
					updatedAt: true,
					lastError: true,
					aggregateType: true,
					aggregateId: true,
					payload: true,
				},
			}),
		]);

		const recentOutcomes = events.map((event) => {
			const domain: Domain = event.eventType.startsWith('payment.') ? 'PAYMENT' : 'COMMS';
			const providerInfo = parseProviderFromEvent(event.eventType, event.payload);
			return {
				id: event.id,
				domain,
				eventType: event.eventType,
				status: event.status,
				attempts: event.attempts,
				availableAt: event.availableAt.toISOString(),
				updatedAt: event.updatedAt.toISOString(),
				lastError: event.lastError,
				aggregateType: event.aggregateType,
				aggregateId: event.aggregateId,
				...providerInfo,
			};
		});

		return NextResponse.json({
			queues: {
				PAYMENT: paymentQueue.summary,
				COMMS: commsQueue.summary,
			},
			webhookHealth: resolveWebhookHealth(
				recentOutcomes.map((outcome) => ({
					provider: outcome.provider,
					updatedAt: outcome.updatedAt,
				}))
			),
			recentOutcomes,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to load provider operations';
		const status = message.toLowerCase().includes('unauthorized') ? 401 : 403;
		return NextResponse.json({ error: message }, { status });
	}
}

export async function POST(request: NextRequest) {
	const payload = (await request.json().catch(() => ({}))) as {
		action?: 'processDomain' | 'replayEvent';
		domain?: Domain;
		eventId?: string;
		maxEvents?: number;
		processNow?: boolean;
		idempotencyKey?: string;
	};

	if (!payload.action) {
		return NextResponse.json({ error: 'action is required' }, { status: 400 });
	}
	if (!payload.domain || !isDomain(payload.domain)) {
		return NextResponse.json({ error: 'domain is required (PAYMENT | COMMS)' }, { status: 400 });
	}

	const maxEventsRaw = Number(payload.maxEvents ?? 25);
	const maxEvents = Number.isFinite(maxEventsRaw) ? Math.min(Math.max(maxEventsRaw, 1), 100) : 25;

	try {
		const { caller, actor } = await createAppCaller();
		const organizationId = actor.organizationId;

		if (payload.action === 'processDomain') {
			const result = await caller.outbox.process({
				organizationId,
				domain: payload.domain,
				maxEvents,
			});
			return NextResponse.json({ result });
		}

		if (!payload.eventId) {
			return NextResponse.json({ error: 'eventId is required for replay action' }, { status: 400 });
		}

		const replay = await caller.outbox.retry({
			organizationId,
			domain: payload.domain,
			eventId: payload.eventId,
			idempotencyKey: payload.idempotencyKey ?? `provider-ops-replay-${randomUUID()}`,
			delaySeconds: 0,
		});

		if (payload.processNow) {
			const process = await caller.outbox.process({
				organizationId,
				domain: payload.domain,
				maxEvents,
			});
			return NextResponse.json({ replay, process });
		}

		return NextResponse.json({ replay });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Provider action failed';
		const lower = message.toLowerCase();
		const status = lower.includes('unauthorized')
			? 401
			: lower.includes('forbidden')
				? 403
				: lower.includes('not found')
					? 404
					: 400;
		return NextResponse.json({ error: message }, { status });
	}
}
