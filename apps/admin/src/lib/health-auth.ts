import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

function getTokenFromRequest(request: NextRequest): string | null {
	const bearer = request.headers.get('authorization');
	if (bearer && bearer.startsWith('Bearer ')) {
		return bearer.slice(7).trim();
	}

	const headerToken = request.headers.get('x-healthcheck-token');
	if (headerToken) return headerToken.trim();
	return null;
}

function safeCompare(left: string, right: string): boolean {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);
	if (leftBuffer.length !== rightBuffer.length) return false;
	return timingSafeEqual(leftBuffer, rightBuffer);
}

export function authorizeHealthCheck(request: NextRequest): NextResponse | null {
	const expectedToken = process.env.FAITHFLOW_HEALTHCHECK_TOKEN?.trim();

	if (!expectedToken) {
		if (process.env.NODE_ENV === 'production') {
			return NextResponse.json(
				{
					error: 'Health check token is not configured.',
					code: 'HEALTHCHECK_TOKEN_MISSING',
				},
				{ status: 503 }
			);
		}
		return null;
	}

	const providedToken = getTokenFromRequest(request);
	if (!providedToken || !safeCompare(providedToken, expectedToken)) {
		return NextResponse.json(
			{
				error: 'Unauthorized health check request.',
				code: 'HEALTHCHECK_UNAUTHORIZED',
			},
			{ status: 401 }
		);
	}

	return null;
}
