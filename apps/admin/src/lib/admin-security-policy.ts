export type AdminSecurityPolicy = {
	requireMfaForPrivilegedRoles: boolean;
	requireVerifiedEmail: boolean;
	maxSessionAgeMinutes: number | null;
	allowedEmailDomains: string[];
	privilegedRoles: string[];
};

export type AdminSecurityPolicyViolationCode =
	| 'EMAIL_NOT_VERIFIED'
	| 'MFA_REQUIRED'
	| 'SESSION_AGE_EXCEEDED'
	| 'EMAIL_DOMAIN_NOT_ALLOWED';

export class AdminSecurityPolicyError extends Error {
	code: AdminSecurityPolicyViolationCode;
	details: Record<string, unknown>;

	constructor(
		code: AdminSecurityPolicyViolationCode,
		message: string,
		details: Record<string, unknown> = {}
	) {
		super(message);
		this.name = 'AdminSecurityPolicyError';
		this.code = code;
		this.details = details;
	}
}

type SecurityClaims = Record<string, unknown> & {
	email?: string;
	email_verified?: boolean;
	iat?: number;
	amr?: string[] | string;
	fva?: [number, number] | number[];
};

const DEFAULT_PRIVILEGED_ROLES = [
	'PLATFORM_SUPER_ADMIN',
	'PLATFORM_SUPPORT',
	'CHURCH_ADMIN',
	'ORG_ADMIN',
	'FINANCE_ADMIN',
	'HR_ADMIN',
	'COMMS_ADMIN',
	'STAFF',
];

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

function parseBooleanEnv(name: string, fallback: boolean): boolean {
	const value = process.env[name];
	if (!value) return fallback;
	const normalized = value.trim().toLowerCase();
	if (TRUE_VALUES.has(normalized)) return true;
	if (FALSE_VALUES.has(normalized)) return false;
	return fallback;
}

function parseIntegerEnv(name: string): number | null {
	const raw = process.env[name];
	if (!raw) return null;
	const parsed = Number.parseInt(raw, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseCsvEnv(name: string, fallback: string[]): string[] {
	const raw = process.env[name];
	if (!raw) return fallback;
	const values = raw
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean)
		.map((value) => value.toUpperCase());
	return values.length ? Array.from(new Set(values)) : fallback;
}

function parseDomainCsvEnv(name: string): string[] {
	const raw = process.env[name];
	if (!raw) return [];
	const values = raw
		.split(',')
		.map((value) => value.trim().toLowerCase())
		.filter(Boolean);
	return Array.from(new Set(values));
}

function normalizeRoleList(values: unknown): string[] {
	if (!Array.isArray(values)) return [];
	return Array.from(
		new Set(
			values
				.map((value) => (typeof value === 'string' ? value.trim().toUpperCase() : ''))
				.filter(Boolean)
		)
	);
}

function normalizeDomainList(values: unknown): string[] {
	if (!Array.isArray(values)) return [];
	return Array.from(
		new Set(
			values
				.map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
				.filter(Boolean)
		)
	);
}

function normalizeSessionAge(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
	if (!Number.isFinite(parsed) || parsed <= 0) return null;
	return Math.floor(parsed);
}

function normalizeClaims(sessionClaims?: Record<string, unknown> | null): SecurityClaims {
	return { ...(sessionClaims ?? {}) } as SecurityClaims;
}

function hasMfa(claims: SecurityClaims): boolean {
	if (Array.isArray(claims.amr)) {
		if (claims.amr.some((method) => typeof method === 'string' && method.toLowerCase() === 'mfa')) {
			return true;
		}
	}

	if (typeof claims.amr === 'string' && claims.amr.toLowerCase() === 'mfa') {
		return true;
	}

	if (Array.isArray(claims.fva) && claims.fva.length > 1) {
		const secondFactorAge = claims.fva[1];
		return typeof secondFactorAge === 'number' && secondFactorAge >= 0;
	}

	return false;
}

function getSessionAgeMinutes(claims: SecurityClaims): number | null {
	if (typeof claims.iat !== 'number' || !Number.isFinite(claims.iat)) return null;
	const issuedAtMs = claims.iat * 1000;
	const ageMs = Date.now() - issuedAtMs;
	return Math.max(0, Math.floor(ageMs / 60000));
}

function getEmailDomain(claims: SecurityClaims): string | null {
	if (typeof claims.email !== 'string') return null;
	const [, domain] = claims.email.toLowerCase().split('@');
	return domain || null;
}

function isPrivilegedRole(roles: string[], policy: AdminSecurityPolicy): boolean {
	const normalizedRoles = roles.map((role) => role.toUpperCase());
	return normalizedRoles.some((role) => policy.privilegedRoles.includes(role));
}

export function getAdminSecurityPolicy(): AdminSecurityPolicy {
	return {
		requireMfaForPrivilegedRoles: parseBooleanEnv('FAITHFLOW_REQUIRE_ADMIN_MFA', false),
		requireVerifiedEmail: parseBooleanEnv('FAITHFLOW_REQUIRE_VERIFIED_EMAIL', false),
		maxSessionAgeMinutes: parseIntegerEnv('FAITHFLOW_MAX_ADMIN_SESSION_AGE_MINUTES'),
		allowedEmailDomains: parseDomainCsvEnv('FAITHFLOW_ALLOWED_ADMIN_EMAIL_DOMAINS'),
		privilegedRoles: parseCsvEnv('FAITHFLOW_PRIVILEGED_ROLES', DEFAULT_PRIVILEGED_ROLES),
	};
}

export function coerceAdminSecurityPolicy(
	value: unknown
): Partial<AdminSecurityPolicy> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const candidate = value as Record<string, unknown>;

	return {
		requireMfaForPrivilegedRoles:
			typeof candidate.requireMfaForPrivilegedRoles === 'boolean'
				? candidate.requireMfaForPrivilegedRoles
				: undefined,
		requireVerifiedEmail:
			typeof candidate.requireVerifiedEmail === 'boolean'
				? candidate.requireVerifiedEmail
				: undefined,
		maxSessionAgeMinutes: normalizeSessionAge(candidate.maxSessionAgeMinutes),
		allowedEmailDomains: Array.isArray(candidate.allowedEmailDomains)
			? normalizeDomainList(candidate.allowedEmailDomains)
			: undefined,
		privilegedRoles: Array.isArray(candidate.privilegedRoles)
			? normalizeRoleList(candidate.privilegedRoles)
			: undefined,
	};
}

export function mergeAdminSecurityPolicy(
	base: AdminSecurityPolicy,
	override?: Partial<AdminSecurityPolicy> | null
): AdminSecurityPolicy {
	if (!override) return base;
	return {
		requireMfaForPrivilegedRoles:
			override.requireMfaForPrivilegedRoles ?? base.requireMfaForPrivilegedRoles,
		requireVerifiedEmail: override.requireVerifiedEmail ?? base.requireVerifiedEmail,
		maxSessionAgeMinutes:
			override.maxSessionAgeMinutes === undefined ? base.maxSessionAgeMinutes : override.maxSessionAgeMinutes,
		allowedEmailDomains:
			override.allowedEmailDomains === undefined ? base.allowedEmailDomains : override.allowedEmailDomains,
		privilegedRoles: override.privilegedRoles === undefined ? base.privilegedRoles : override.privilegedRoles,
	};
}

export function enforceAdminSecurityPolicy(input: {
	roles: string[];
	sessionClaims?: Record<string, unknown> | null;
	policyOverride?: Partial<AdminSecurityPolicy> | null;
}): void {
	const policy = mergeAdminSecurityPolicy(getAdminSecurityPolicy(), input.policyOverride);
	if (!isPrivilegedRole(input.roles, policy)) return;

	const claims = normalizeClaims(input.sessionClaims);

	if (policy.requireVerifiedEmail && claims.email_verified !== true) {
		throw new AdminSecurityPolicyError(
			'EMAIL_NOT_VERIFIED',
			'Forbidden: verified email is required for privileged access.'
		);
	}

	if (policy.requireMfaForPrivilegedRoles && !hasMfa(claims)) {
		throw new AdminSecurityPolicyError('MFA_REQUIRED', 'Forbidden: MFA is required for privileged access.');
	}

	if (policy.maxSessionAgeMinutes) {
		const sessionAgeMinutes = getSessionAgeMinutes(claims);
		if (sessionAgeMinutes === null || sessionAgeMinutes > policy.maxSessionAgeMinutes) {
			throw new AdminSecurityPolicyError(
				'SESSION_AGE_EXCEEDED',
				'Forbidden: session expired for privileged access. Please sign in again.',
				{
					maxSessionAgeMinutes: policy.maxSessionAgeMinutes,
					sessionAgeMinutes,
				}
			);
		}
	}

	if (policy.allowedEmailDomains.length) {
		const emailDomain = getEmailDomain(claims);
		if (!emailDomain || !policy.allowedEmailDomains.includes(emailDomain)) {
			throw new AdminSecurityPolicyError(
				'EMAIL_DOMAIN_NOT_ALLOWED',
				'Forbidden: email domain is not allowed for privileged access.',
				{
					emailDomain: emailDomain ?? null,
					allowedEmailDomains: policy.allowedEmailDomains,
				}
			);
		}
	}
}

export function getAdminSecurityPolicySummary(input: {
	roles: string[];
	sessionClaims?: Record<string, unknown> | null;
}) {
	const policy = getAdminSecurityPolicy();
	const claims = normalizeClaims(input.sessionClaims);
	const privileged = isPrivilegedRole(input.roles, policy);
	const sessionAgeMinutes = getSessionAgeMinutes(claims);
	const emailDomain = getEmailDomain(claims);

	return {
		policy,
		privileged,
		claims: {
			emailVerified: claims.email_verified === true,
			mfaSatisfied: hasMfa(claims),
			sessionAgeMinutes,
			emailDomain,
		},
	};
}
