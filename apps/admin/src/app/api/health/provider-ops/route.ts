import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@faithflow/database';
import { requireDatabaseForHealth } from '@/lib/database-guard';
import { authorizeHealthCheck } from '@/lib/health-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Provider = 'STRIPE' | 'PAYSTACK' | 'RESEND' | 'TWILIO';

const DEAD_LETTER_PREFIX = 'DEAD_LETTER:';
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function hasEnv(name: string): boolean {
	return Boolean(process.env[name]?.trim());
}

function parsePositiveInt(value: string | null | undefined, fallback: number): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return Math.floor(parsed);
}

function asRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
}

function parseProvider(payloadValue: unknown): Provider | null {
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

	if (
		providerValue === 'STRIPE' ||
		providerValue === 'PAYSTACK' ||
		providerValue === 'RESEND' ||
		providerValue === 'TWILIO'
	) {
		return providerValue;
	}
	return null;
}

function providerConfigurations() {
	return [
		{
			provider: 'STRIPE' as Provider,
			endpoint: '/api/webhooks/stripe',
			configured: hasEnv('STRIPE_WEBHOOK_SECRET') && hasEnv('STRIPE_SECRET_KEY'),
		},
		{
			provider: 'PAYSTACK' as Provider,
			endpoint: '/api/webhooks/paystack',
			configured: hasEnv('PAYSTACK_SECRET_KEY'),
		},
		{
			provider: 'RESEND' as Provider,
			endpoint: '/api/webhooks/resend',
			configured: hasEnv('RESEND_WEBHOOK_SECRET') && hasEnv('RESEND_API_KEY'),
		},
		{
			provider: 'TWILIO' as Provider,
			endpoint: '/api/webhooks/twilio',
			configured:
				hasEnv('TWILIO_ACCOUNT_SID') && hasEnv('TWILIO_AUTH_TOKEN') && hasEnv('TWILIO_PHONE_NUMBER'),
		},
	];
}

async function queueStats(prefix: 'payment.' | 'comms.', now: Date) {
	const baseWhere = { eventType: { startsWith: prefix } };
	const processableWhere = {
		...baseWhere,
		availableAt: { lte: now },
		OR: [
			{ status: 'PENDING' as const },
			{ status: 'FAILED' as const, NOT: { lastError: { startsWith: DEAD_LETTER_PREFIX } } },
		],
	};

	const [pendingCount, processingCount, failedCount, deadLetterCount, processableCount, oldestProcessable] =
		await Promise.all([
			prisma.outboxEvent.count({ where: { ...baseWhere, status: 'PENDING' } }),
			prisma.outboxEvent.count({ where: { ...baseWhere, status: 'PROCESSING' } }),
			prisma.outboxEvent.count({ where: { ...baseWhere, status: 'FAILED' } }),
			prisma.outboxEvent.count({
				where: {
					...baseWhere,
					status: 'FAILED',
					lastError: { startsWith: DEAD_LETTER_PREFIX },
				},
			}),
			prisma.outboxEvent.count({ where: processableWhere }),
			prisma.outboxEvent.findFirst({
				where: processableWhere,
				orderBy: { availableAt: 'asc' },
				select: { availableAt: true },
			}),
		]);

	return {
		pendingCount,
		processingCount,
		failedCount,
		deadLetterCount,
		processableCount,
		oldestProcessableAt: oldestProcessable?.availableAt.toISOString() ?? null,
	};
}

export async function GET(request: NextRequest) {
	const authFailure = authorizeHealthCheck(request);
	if (authFailure) return authFailure;
	const dbUnavailable = requireDatabaseForHealth('provider-ops');
	if (dbUnavailable) return dbUnavailable;

	const strictConfigHealth =
		request.nextUrl.searchParams.get('strict') === 'true' ||
		process.env.FAITHFLOW_PROVIDER_OPS_STRICT_HEALTH === 'true';
	const processableThreshold = parsePositiveInt(
		request.nextUrl.searchParams.get('processableThreshold'),
		parsePositiveInt(process.env.FAITHFLOW_PROVIDER_OPS_PROCESSABLE_THRESHOLD, 500)
	);
	const now = new Date();

	try {
		const [paymentQueue, commsQueue, recentEvents] = await Promise.all([
			queueStats('payment.', now),
			queueStats('comms.', now),
			prisma.outboxEvent.findMany({
				where: {
					status: { in: ['PROCESSED', 'FAILED'] },
					OR: [{ eventType: { startsWith: 'payment.' } }, { eventType: { startsWith: 'comms.' } }],
				},
				orderBy: { updatedAt: 'desc' },
				take: 200,
				select: {
					updatedAt: true,
					payload: true,
				},
			}),
		]);

		const providerEvents = recentEvents
			.map((event) => ({
				provider: parseProvider(event.payload),
				updatedAt: event.updatedAt.toISOString(),
			}))
			.filter((event) => event.provider !== null) as Array<{ provider: Provider; updatedAt: string }>;

		const since24Hours = new Date(now.getTime() - DAY_IN_MS).toISOString();
		const providers = providerConfigurations().map((entry) => {
			const events = providerEvents.filter((event) => event.provider === entry.provider);
			return {
				provider: entry.provider,
				endpoint: entry.endpoint,
				configured: entry.configured,
				lastSeenAt: events[0]?.updatedAt ?? null,
				recentEvents24h: events.filter((event) => event.updatedAt >= since24Hours).length,
			};
		});

		const reasons: string[] = [];
		const missingProviders = providers.filter((provider) => !provider.configured).map((provider) => provider.provider);
		if (strictConfigHealth && missingProviders.length > 0) {
			reasons.push(`Missing provider config: ${missingProviders.join(', ')}`);
		}
		if (paymentQueue.processableCount > processableThreshold) {
			reasons.push(
				`PAYMENT processable backlog ${paymentQueue.processableCount} exceeds threshold ${processableThreshold}`
			);
		}
		if (commsQueue.processableCount > processableThreshold) {
			reasons.push(`COMMS processable backlog ${commsQueue.processableCount} exceeds threshold ${processableThreshold}`);
		}

		const status = reasons.length > 0 ? 'degraded' : 'ok';
		const httpStatus = status === 'ok' ? 200 : 503;

		return NextResponse.json(
			{
				status,
				checkedAt: now.toISOString(),
				strictConfigHealth,
				processableThreshold,
				queues: {
					PAYMENT: paymentQueue,
					COMMS: commsQueue,
				},
				providers,
				reasons,
			},
			{
				status: httpStatus,
				headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
			}
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Provider ops health check failed';
		return NextResponse.json(
			{
				status: 'down',
				checkedAt: now.toISOString(),
				reasons: [message],
			},
			{
				status: 503,
				headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
			}
		);
	}
}
