import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@faithflow/database';
import { authorizeHealthCheck } from '@/lib/health-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Domain = 'PAYMENT' | 'COMMS';

const DEAD_LETTER_PREFIX = 'DEAD_LETTER:';

function parsePositiveInt(value: string | null | undefined, fallback: number): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return Math.floor(parsed);
}

function domainPrefix(domain: Domain): 'payment.' | 'comms.' {
	return domain === 'PAYMENT' ? 'payment.' : 'comms.';
}

function computeAgeSeconds(base: Date, target: Date | null): number | null {
	if (!target) return null;
	return Math.floor((base.getTime() - target.getTime()) / 1000);
}

async function resolveDomainReadiness(input: {
	domain: Domain;
	now: Date;
	staleThresholdSeconds: number;
	activityGraceSeconds: number;
}) {
	const prefix = domainPrefix(input.domain);
	const processableWhere = {
		eventType: { startsWith: prefix },
		availableAt: { lte: input.now },
		OR: [
			{ status: 'PENDING' as const },
			{ status: 'FAILED' as const, NOT: { lastError: { startsWith: DEAD_LETTER_PREFIX } } },
		],
	};

	const [processableCount, processingCount, deadLetterCount, oldestProcessable, latestActivity] =
		await Promise.all([
			prisma.outboxEvent.count({ where: processableWhere }),
			prisma.outboxEvent.count({ where: { eventType: { startsWith: prefix }, status: 'PROCESSING' } }),
			prisma.outboxEvent.count({
				where: {
					eventType: { startsWith: prefix },
					status: 'FAILED',
					lastError: { startsWith: DEAD_LETTER_PREFIX },
				},
			}),
			prisma.outboxEvent.findFirst({
				where: processableWhere,
				orderBy: { availableAt: 'asc' },
				select: { id: true, availableAt: true, eventType: true },
			}),
			prisma.outboxEvent.findFirst({
				where: { eventType: { startsWith: prefix } },
				orderBy: { updatedAt: 'desc' },
				select: { id: true, status: true, updatedAt: true, eventType: true },
			}),
		]);

	const oldestLagSeconds = computeAgeSeconds(input.now, oldestProcessable?.availableAt ?? null);
	const activityLagSeconds = computeAgeSeconds(input.now, latestActivity?.updatedAt ?? null);

	let ready = true;
	let reason = 'Queue healthy.';
	if (processableCount > 0 && oldestLagSeconds !== null && oldestLagSeconds > input.staleThresholdSeconds) {
		const hasFreshActivity =
			activityLagSeconds !== null && activityLagSeconds <= input.activityGraceSeconds;
		if (!(processingCount > 0 && hasFreshActivity)) {
			ready = false;
			reason = `Stale processable backlog detected (oldest age ${oldestLagSeconds}s, threshold ${input.staleThresholdSeconds}s).`;
		}
	}

	return {
		domain: input.domain,
		ready,
		reason,
		processableCount,
		processingCount,
		deadLetterCount,
		oldestProcessableEvent: oldestProcessable
			? {
					id: oldestProcessable.id,
					eventType: oldestProcessable.eventType,
					availableAt: oldestProcessable.availableAt.toISOString(),
					lagSeconds: oldestLagSeconds,
			  }
			: null,
		latestActivity: latestActivity
			? {
					id: latestActivity.id,
					status: latestActivity.status,
					eventType: latestActivity.eventType,
					updatedAt: latestActivity.updatedAt.toISOString(),
					lagSeconds: activityLagSeconds,
			  }
			: null,
	};
}

export async function GET(request: NextRequest) {
	const authFailure = authorizeHealthCheck(request);
	if (authFailure) return authFailure;

	const staleThresholdSeconds = parsePositiveInt(
		request.nextUrl.searchParams.get('staleSeconds'),
		parsePositiveInt(process.env.FAITHFLOW_OUTBOX_STALE_SECONDS, 900)
	);
	const activityGraceSeconds = parsePositiveInt(
		request.nextUrl.searchParams.get('activityGraceSeconds'),
		parsePositiveInt(process.env.FAITHFLOW_OUTBOX_ACTIVITY_GRACE_SECONDS, 180)
	);
	const now = new Date();

	try {
		const domains = await Promise.all([
			resolveDomainReadiness({
				domain: 'PAYMENT',
				now,
				staleThresholdSeconds,
				activityGraceSeconds,
			}),
			resolveDomainReadiness({
				domain: 'COMMS',
				now,
				staleThresholdSeconds,
				activityGraceSeconds,
			}),
		]);

		const ready = domains.every((domain) => domain.ready);
		const statusCode = ready ? 200 : 503;

		return NextResponse.json(
			{
				status: ready ? 'ready' : 'degraded',
				checkedAt: now.toISOString(),
				thresholds: {
					staleSeconds: staleThresholdSeconds,
					activityGraceSeconds,
				},
				domains,
				reasons: domains.filter((domain) => !domain.ready).map((domain) => `${domain.domain}: ${domain.reason}`),
			},
			{
				status: statusCode,
				headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
			}
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Outbox worker readiness check failed';
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
