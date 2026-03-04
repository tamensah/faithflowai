import {
	AdminSecurityPolicyError,
	coerceAdminSecurityPolicy,
	enforceAdminSecurityPolicy,
	type AdminSecurityPolicy,
} from '../apps/admin/src/lib/admin-security-policy';

function buildPolicy(overrides: Partial<AdminSecurityPolicy> = {}): Partial<AdminSecurityPolicy> {
	return {
		requireVerifiedEmail: false,
		requireMfaForPrivilegedRoles: false,
		maxSessionAgeMinutes: null,
		allowedEmailDomains: [],
		privilegedRoles: ['ORG_ADMIN'],
		...overrides,
	};
}

function expectGuardrailViolation(
	label: string,
	execute: () => void,
	expectedCode: AdminSecurityPolicyError['code']
) {
	try {
		execute();
		throw new Error(`${label}: expected ${expectedCode} but no error was thrown`);
	} catch (error) {
		if (!(error instanceof AdminSecurityPolicyError)) {
			throw new Error(`${label}: expected AdminSecurityPolicyError, got ${String(error)}`);
		}
		if (error.code !== expectedCode) {
			throw new Error(`${label}: expected ${expectedCode}, got ${error.code}`);
		}
	}
}

function expectPass(label: string, execute: () => void) {
	try {
		execute();
	} catch (error) {
		throw new Error(`${label}: expected pass, got ${String(error)}`);
	}
}

function runSuite() {
	const nowSeconds = Math.floor(Date.now() / 1000);

	expectPass('non-privileged actors bypass guardrails', () => {
		enforceAdminSecurityPolicy({
			roles: ['MEMBER'],
			sessionClaims: { email_verified: false },
			policyOverride: buildPolicy({ requireVerifiedEmail: true }),
		});
	});

	expectGuardrailViolation(
		'verified email required for privileged actor',
		() =>
			enforceAdminSecurityPolicy({
				roles: ['ORG_ADMIN'],
				sessionClaims: { email_verified: false },
				policyOverride: buildPolicy({ requireVerifiedEmail: true }),
			}),
		'EMAIL_NOT_VERIFIED'
	);

	expectGuardrailViolation(
		'mfa required for privileged actor',
		() =>
			enforceAdminSecurityPolicy({
				roles: ['ORG_ADMIN'],
				sessionClaims: { email_verified: true, amr: ['pwd'] },
				policyOverride: buildPolicy({ requireMfaForPrivilegedRoles: true }),
			}),
		'MFA_REQUIRED'
	);

	expectGuardrailViolation(
		'session age must stay within policy limit',
		() =>
			enforceAdminSecurityPolicy({
				roles: ['ORG_ADMIN'],
				sessionClaims: { email_verified: true, iat: nowSeconds - 60 * 16 },
				policyOverride: buildPolicy({ maxSessionAgeMinutes: 15 }),
			}),
		'SESSION_AGE_EXCEEDED'
	);

	expectGuardrailViolation(
		'email domain must be allowlisted',
		() =>
			enforceAdminSecurityPolicy({
				roles: ['ORG_ADMIN'],
				sessionClaims: { email_verified: true, email: 'leader@example.com' },
				policyOverride: buildPolicy({ allowedEmailDomains: ['winnerschapelgh.org'] }),
			}),
		'EMAIL_DOMAIN_NOT_ALLOWED'
	);

	expectPass('privileged actor passes when all checks are met', () => {
		enforceAdminSecurityPolicy({
			roles: ['ORG_ADMIN'],
			sessionClaims: {
				email_verified: true,
				email: 'leader@winnerschapelgh.org',
				amr: ['pwd', 'mfa'],
				iat: nowSeconds - 60 * 3,
			},
			policyOverride: buildPolicy({
				requireVerifiedEmail: true,
				requireMfaForPrivilegedRoles: true,
				maxSessionAgeMinutes: 15,
				allowedEmailDomains: ['winnerschapelgh.org'],
			}),
		});
	});

	expectPass('organization policy coercion keeps only valid values', () => {
		const coerced = coerceAdminSecurityPolicy({
			requireVerifiedEmail: true,
			requireMfaForPrivilegedRoles: true,
			maxSessionAgeMinutes: '30',
			allowedEmailDomains: ['WinnersChapelGh.ORG', 123, ''],
			privilegedRoles: ['org_admin', null, 'finance_admin'],
		});
		if (!coerced) {
			throw new Error('expected non-null policy coercion');
		}
		if (coerced.maxSessionAgeMinutes !== 30) {
			throw new Error(`expected maxSessionAgeMinutes=30, got ${String(coerced.maxSessionAgeMinutes)}`);
		}
		if ((coerced.allowedEmailDomains ?? []).join(',') !== 'winnerschapelgh.org') {
			throw new Error('expected allowedEmailDomains normalization');
		}
		if ((coerced.privilegedRoles ?? []).join(',') !== 'ORG_ADMIN,FINANCE_ADMIN') {
			throw new Error('expected privileged role normalization');
		}
	});
}

function main() {
	runSuite();
	console.log('Auth guardrails smoke passed.');
}

main();
