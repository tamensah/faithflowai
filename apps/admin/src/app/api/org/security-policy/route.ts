import { NextRequest, NextResponse } from 'next/server';
import { createOrgCaller } from '@/lib/org-caller';
import {
	coerceAdminSecurityPolicy,
	getAdminSecurityPolicy,
	mergeAdminSecurityPolicy,
} from '@/lib/admin-security-policy';
import { requireDatabaseForApi } from '@/lib/database-guard';

function parseCsv(value: unknown, transform: (item: string) => string): string[] {
	if (!Array.isArray(value)) return [];
	return Array.from(
		new Set(
			value
				.map((item) => (typeof item === 'string' ? transform(item.trim()) : ''))
				.filter(Boolean)
		)
	);
}

export async function GET() {
	const dbUnavailable = requireDatabaseForApi('org.security-policy.get');
	if (dbUnavailable) return dbUnavailable;

	try {
		const { caller, actor } = await createOrgCaller();
		const organizationId = actor.organizationId;
		const response = await caller.org.getSecurityPolicy({ organizationId });
		const storedPolicy = coerceAdminSecurityPolicy(response.policy);
		const effectivePolicy = mergeAdminSecurityPolicy(getAdminSecurityPolicy(), storedPolicy);

		return NextResponse.json({
			organizationId,
			storedPolicy,
			effectivePolicy,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		const status = message.startsWith('Unauthorized') ? 401 : 403;
		return NextResponse.json({ error: message }, { status });
	}
}

export async function PATCH(request: NextRequest) {
	const dbUnavailable = requireDatabaseForApi('org.security-policy.patch');
	if (dbUnavailable) return dbUnavailable;

	const payload = (await request.json()) as {
		idempotencyKey?: string;
		requireVerifiedEmail?: boolean;
		requireMfaForPrivilegedRoles?: boolean;
		maxSessionAgeMinutes?: number | null;
		allowedEmailDomains?: string[];
		privilegedRoles?: string[];
	};

	const requireVerifiedEmail =
		typeof payload.requireVerifiedEmail === 'boolean' ? payload.requireVerifiedEmail : undefined;
	const requireMfaForPrivilegedRoles =
		typeof payload.requireMfaForPrivilegedRoles === 'boolean'
			? payload.requireMfaForPrivilegedRoles
			: undefined;
	const maxSessionAgeMinutes =
		payload.maxSessionAgeMinutes === null || payload.maxSessionAgeMinutes === undefined
			? null
			: Number.isFinite(payload.maxSessionAgeMinutes) && payload.maxSessionAgeMinutes > 0
				? Math.floor(payload.maxSessionAgeMinutes)
				: null;
	const allowedEmailDomains = Array.isArray(payload.allowedEmailDomains)
		? parseCsv(payload.allowedEmailDomains, (item) => item.toLowerCase())
		: undefined;
	const privilegedRoles = Array.isArray(payload.privilegedRoles)
		? parseCsv(payload.privilegedRoles, (item) => item.toUpperCase())
		: undefined;

	if (
		requireVerifiedEmail === undefined ||
		requireMfaForPrivilegedRoles === undefined
	) {
		return NextResponse.json(
			{
				error: 'requireVerifiedEmail and requireMfaForPrivilegedRoles are required booleans.',
			},
			{ status: 400 }
		);
	}

	try {
		const { caller, actor } = await createOrgCaller();
		const organizationId = actor.organizationId;
		const baseline = getAdminSecurityPolicy();

		const policy = {
			requireVerifiedEmail,
			requireMfaForPrivilegedRoles,
			maxSessionAgeMinutes,
			allowedEmailDomains: allowedEmailDomains ?? baseline.allowedEmailDomains,
			privilegedRoles: privilegedRoles ?? baseline.privilegedRoles,
		};

		const result = await caller.org.updateSecurityPolicy({
			organizationId,
			idempotencyKey:
				payload.idempotencyKey ?? request.headers.get('x-idempotency-key') ?? undefined,
			policy,
		});

		return NextResponse.json({
			organizationId,
			policy: result.policy,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		const status = message.startsWith('Unauthorized') ? 401 : 403;
		return NextResponse.json({ error: message }, { status });
	}
}
