import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@faithflow/database';
import { getAdminSecurityPolicy } from '@/lib/admin-security-policy';
import { authorizeHealthCheck } from '@/lib/health-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parsePositiveInt(value: string | null | undefined, fallback: number): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return Math.floor(parsed);
}

export async function GET(request: NextRequest) {
	const authFailure = authorizeHealthCheck(request);
	if (authFailure) return authFailure;

	const now = new Date();
	const windowHours = parsePositiveInt(
		request.nextUrl.searchParams.get('windowHours'),
		parsePositiveInt(process.env.FAITHFLOW_GUARDRAIL_WINDOW_HOURS, 24)
	);
	const blockedThreshold = parsePositiveInt(
		request.nextUrl.searchParams.get('blockedThreshold'),
		parsePositiveInt(process.env.FAITHFLOW_GUARDRAIL_BLOCKED_THRESHOLD, 25)
	);
	const since = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

	try {
		const [blockedEvents, latestBlock] = await Promise.all([
			prisma.auditEvent.findMany({
				where: {
					action: 'AUTH_GUARDRAIL_BLOCKED',
					createdAt: { gte: since },
				},
				orderBy: { createdAt: 'desc' },
				take: 200,
				select: {
					id: true,
					organizationId: true,
					actorId: true,
					reason: true,
					createdAt: true,
				},
			}),
			prisma.auditEvent.findFirst({
				where: { action: 'AUTH_GUARDRAIL_BLOCKED' },
				orderBy: { createdAt: 'desc' },
				select: {
					id: true,
					organizationId: true,
					actorId: true,
					reason: true,
					createdAt: true,
				},
			}),
		]);

		const reasonCounts: Record<string, number> = {};
		const organizationIds = new Set<string>();
		for (const event of blockedEvents) {
			const reason = event.reason ?? 'UNKNOWN';
			reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
			organizationIds.add(event.organizationId);
		}

		const policy = getAdminSecurityPolicy();
		const reasons: string[] = [];
		if (blockedEvents.length > blockedThreshold) {
			reasons.push(
				`Guardrail denials ${blockedEvents.length} exceeded threshold ${blockedThreshold} in last ${windowHours}h.`
			);
		}

		const status = reasons.length > 0 ? 'degraded' : 'ok';
		const statusCode = status === 'ok' ? 200 : 503;

		return NextResponse.json(
			{
				status,
				checkedAt: now.toISOString(),
				windowHours,
				blockedThreshold,
				policy,
				metrics: {
					blockedCount: blockedEvents.length,
					organizationsAffected: organizationIds.size,
					reasonCounts,
				},
				latestBlockedEvent: latestBlock
					? {
							id: latestBlock.id,
							organizationId: latestBlock.organizationId,
							actorId: latestBlock.actorId,
							reason: latestBlock.reason,
							createdAt: latestBlock.createdAt.toISOString(),
					  }
					: null,
				reasons,
			},
			{
				status: statusCode,
				headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
			}
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Auth guardrail health check failed';
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
