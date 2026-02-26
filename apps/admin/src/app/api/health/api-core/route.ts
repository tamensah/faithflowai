import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@faithflow/database';
import { requireDatabaseForHealth } from '@/lib/database-guard';
import { authorizeHealthCheck } from '@/lib/health-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hasEnv(name: string): boolean {
	return Boolean(process.env[name]?.trim());
}

export async function GET(request: NextRequest) {
	const authFailure = authorizeHealthCheck(request);
	if (authFailure) return authFailure;
	const dbUnavailable = requireDatabaseForHealth('api-core');
	if (dbUnavailable) return dbUnavailable;

	const now = new Date();
	try {
		await prisma.$queryRaw`SELECT 1`;
		const dbTime = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() as now`;

		const checks = {
			database: true,
			authConfig: hasEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY') && hasEnv('CLERK_SECRET_KEY'),
		};
		const reasons: string[] = [];
		if (!checks.authConfig) reasons.push('Missing Clerk environment keys.');

		const status = reasons.length ? 'degraded' : 'ok';
		const statusCode = status === 'ok' ? 200 : 503;

		return NextResponse.json(
			{
				status,
				checkedAt: now.toISOString(),
				checks,
				databaseTime: dbTime[0]?.now?.toISOString?.() ?? null,
				reasons,
			},
			{
				status: statusCode,
				headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
			}
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'API core health check failed';
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
