import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@faithflow/database';
import { requireDatabaseForHealth } from '@/lib/database-guard';
import { authorizeHealthCheck } from '@/lib/health-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEAD_LETTER_PREFIX = 'DEAD_LETTER:';

function parsePositiveInt(value: string | null | undefined, fallback: number): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return Math.floor(parsed);
}

function ageSeconds(base: Date, value: Date | null): number | null {
	if (!value) return null;
	return Math.floor((base.getTime() - value.getTime()) / 1000);
}

export async function GET(request: NextRequest) {
	const authFailure = authorizeHealthCheck(request);
	if (authFailure) return authFailure;
	const dbUnavailable = requireDatabaseForHealth('reconciliation');
	if (dbUnavailable) return dbUnavailable;

	const staleThresholdSeconds = parsePositiveInt(
		request.nextUrl.searchParams.get('staleSeconds'),
		parsePositiveInt(process.env.FAITHFLOW_RECONCILIATION_STALE_SECONDS, 900)
	);
	const now = new Date();

	try {
		const processableWhere = {
			eventType: 'payment.provider.reconciled',
			availableAt: { lte: now },
			OR: [
				{ status: 'PENDING' as const },
				{ status: 'FAILED' as const, NOT: { lastError: { startsWith: DEAD_LETTER_PREFIX } } },
			],
		};

		const [processableCount, processingCount, deadLetterCount, failedCount, oldestProcessable, latestProcessed] =
			await Promise.all([
				prisma.outboxEvent.count({ where: processableWhere }),
				prisma.outboxEvent.count({
					where: { eventType: 'payment.provider.reconciled', status: 'PROCESSING' },
				}),
				prisma.outboxEvent.count({
					where: {
						eventType: 'payment.provider.reconciled',
						status: 'FAILED',
						lastError: { startsWith: DEAD_LETTER_PREFIX },
					},
				}),
				prisma.outboxEvent.count({
					where: {
						eventType: 'payment.provider.reconciled',
						status: 'FAILED',
					},
				}),
				prisma.outboxEvent.findFirst({
					where: processableWhere,
					orderBy: { availableAt: 'asc' },
					select: { id: true, availableAt: true, organizationId: true },
				}),
				prisma.outboxEvent.findFirst({
					where: {
						eventType: 'payment.provider.reconciled',
						status: 'PROCESSED',
					},
					orderBy: { updatedAt: 'desc' },
					select: { id: true, updatedAt: true, organizationId: true },
				}),
			]);

		const oldestLagSeconds = ageSeconds(now, oldestProcessable?.availableAt ?? null);
		const staleBacklog =
			processableCount > 0 && oldestLagSeconds !== null && oldestLagSeconds > staleThresholdSeconds;
		const status = staleBacklog ? 'degraded' : 'ok';
		const reasons: string[] = [];
		if (staleBacklog) {
			reasons.push(
				`Reconciliation backlog is stale (oldest ${oldestLagSeconds}s > ${staleThresholdSeconds}s).`
			);
		}
		if (deadLetterCount > 0) {
			reasons.push('Reconciliation dead-letter items present.');
		}

		return NextResponse.json(
			{
				status,
				checkedAt: now.toISOString(),
				thresholds: {
					staleSeconds: staleThresholdSeconds,
				},
				metrics: {
					processableCount,
					processingCount,
					failedCount,
					deadLetterCount,
				},
				oldestProcessable: oldestProcessable
					? {
							id: oldestProcessable.id,
							organizationId: oldestProcessable.organizationId,
							availableAt: oldestProcessable.availableAt.toISOString(),
							lagSeconds: oldestLagSeconds,
					  }
					: null,
				lastProcessed: latestProcessed
					? {
							id: latestProcessed.id,
							organizationId: latestProcessed.organizationId,
							updatedAt: latestProcessed.updatedAt.toISOString(),
							lagSeconds: ageSeconds(now, latestProcessed.updatedAt),
					  }
					: null,
				reasons,
			},
			{
				status: status === 'ok' ? 200 : 503,
				headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
			}
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Reconciliation health check failed';
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
