import { auth } from '@clerk/nextjs/server';
import { prisma } from '@faithflow/database';
import type { PolicyActor } from '../../../api/src/security/policy';
import { coerceAdminSecurityPolicy, enforceAdminSecurityPolicy } from './admin-security-policy';

type ClerkClaims = Record<string, unknown> & {
	org_id?: string;
	org_role?: string;
	role?: string;
	roles?: string[] | string;
	organizationId?: string;
};

function normalizeRole(rawRole: string): string {
	const role = rawRole.trim().toUpperCase().replace(':', '_');

	if (role === 'ADMIN') return 'PLATFORM_SUPER_ADMIN';
	if (role === 'ORG_ADMIN' || role === 'CHURCH_ADMIN') return 'ORG_ADMIN';
	if (role === 'ORG_MEMBER' || role === 'MEMBER') return 'STAFF';

	return role;
}

function extractRoles(claims: ClerkClaims): string[] {
	const roles: string[] = [];

	if (typeof claims.role === 'string') roles.push(claims.role);
	if (typeof claims.org_role === 'string') roles.push(claims.org_role);
	if (Array.isArray(claims.roles)) {
		for (const role of claims.roles) {
			if (typeof role === 'string') roles.push(role);
		}
	}
	if (typeof claims.roles === 'string') roles.push(claims.roles);

	return Array.from(new Set(roles.map(normalizeRole).filter(Boolean)));
}

export async function getActorFromClerk(
): Promise<PolicyActor> {
	const { userId, orgId, sessionClaims } = await auth();
	if (!userId) {
		throw new Error('Unauthorized: missing authenticated Clerk session');
	}

	const claims = {
		...(sessionClaims ?? {}),
		org_id: orgId ?? (sessionClaims as ClerkClaims | null)?.org_id,
	} as ClerkClaims;

	const roles = extractRoles(claims);
	if (!roles.length) {
		throw new Error('Forbidden: no role claims found in Clerk session');
	}

	const organizationId =
		(typeof claims.org_id === 'string' && claims.org_id) ||
		(typeof claims.organizationId === 'string' && claims.organizationId);

	if (!organizationId) {
		throw new Error('Forbidden: no organization context in Clerk session');
	}

	const organization = await prisma.organization.findUnique({
		where: { id: organizationId },
		select: { id: true, settings: true },
	});
	if (!organization) {
		throw new Error('Forbidden: organization context was not found in platform data.');
	}

	const settings =
		organization.settings && typeof organization.settings === 'object' && !Array.isArray(organization.settings)
			? (organization.settings as Record<string, unknown>)
			: {};
	const policyOverride = coerceAdminSecurityPolicy(settings.securityPolicy);

	enforceAdminSecurityPolicy({
		roles,
		sessionClaims: claims,
		policyOverride,
	});

	return {
		id: userId,
		organizationId,
		roles,
		type: 'USER',
	};
}
