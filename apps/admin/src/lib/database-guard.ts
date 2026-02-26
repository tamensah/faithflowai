import { NextResponse } from 'next/server';

function hasValue(value: string | undefined): boolean {
	return Boolean(value?.trim());
}

export function isDatabaseConfigured(): boolean {
	return hasValue(process.env.DATABASE_URL);
}

export function requireDatabaseForApi(route: string): NextResponse | null {
	if (isDatabaseConfigured()) return null;
	return NextResponse.json(
		{
			error: 'Database is not configured for this environment.',
			code: 'DATABASE_UNCONFIGURED',
			route,
			nextStep: 'Set DATABASE_URL in environment variables and redeploy.',
		},
		{ status: 503 }
	);
}

export function requireDatabaseForHealth(check: string): NextResponse | null {
	if (isDatabaseConfigured()) return null;
	return NextResponse.json(
		{
			status: 'down',
			checkedAt: new Date().toISOString(),
			check,
			reasons: ['Database is not configured for this environment. Set DATABASE_URL and redeploy.'],
			code: 'DATABASE_UNCONFIGURED',
		},
		{
			status: 503,
			headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
		}
	);
}
