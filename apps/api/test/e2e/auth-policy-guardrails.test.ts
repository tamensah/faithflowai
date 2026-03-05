import assert from 'node:assert/strict';
import test from 'node:test';
import { appRouter } from '@faithflow-ai/api';
import { UserRole, prisma } from '@faithflow-ai/database';

function uniqueSuffix() {
  return `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

test('tenant security policy blocks staff requests without required MFA and session freshness', async () => {
  const suffix = uniqueSuffix();
  const clerkUserId = `clerk_guardrail_${suffix}`;

  const tenant = await prisma.tenant.create({
    data: {
      name: `Guardrail Tenant ${suffix}`,
      slug: `guardrail-${suffix}`,
      clerkOrgId: `org_guardrail_${suffix}`,
    },
  });
  const organization = await prisma.organization.create({
    data: {
      tenantId: tenant.id,
      name: `Org ${suffix}`,
    },
  });
  const church = await prisma.church.create({
    data: {
      organizationId: organization.id,
      name: `Church ${suffix}`,
      slug: `church-${suffix}`,
      countryCode: 'US',
      timezone: 'UTC',
    },
  });
  const user = await prisma.user.create({
    data: {
      clerkUserId,
      email: `guardrail-${suffix}@example.com`,
      name: 'Guardrail Admin',
      role: UserRole.ADMIN,
    },
  });
  await prisma.staffMembership.create({
    data: {
      userId: user.id,
      churchId: church.id,
      role: UserRole.ADMIN,
    },
  });
  await prisma.tenantSecurityPolicy.create({
    data: {
      tenantId: tenant.id,
      requireMfaForStaff: true,
      enforceSso: false,
      sessionTimeoutMinutes: 30,
      dataRetentionDays: 3650,
    },
  });

  try {
    const blockedCaller = appRouter.createCaller({
      userId: clerkUserId,
      clerkOrgId: tenant.clerkOrgId,
      tenantId: tenant.id,
      tenantStatus: 'ACTIVE',
      requestIp: '127.0.0.1',
      authSignals: {
        sessionIssuedAtMs: Date.now() - 90 * 60 * 1000,
        secondFactorVerified: false,
        authMethods: ['pwd'],
      },
    });

    await assert.rejects(
      () => blockedCaller.auth.self(),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes('Security policy blocked request') &&
        error.message.includes('MFA_REQUIRED') &&
        error.message.includes('SESSION_TIMEOUT')
    );

    const passingCaller = appRouter.createCaller({
      userId: clerkUserId,
      clerkOrgId: tenant.clerkOrgId,
      tenantId: tenant.id,
      tenantStatus: 'ACTIVE',
      requestIp: '127.0.0.1',
      authSignals: {
        sessionIssuedAtMs: Date.now() - 5 * 60 * 1000,
        secondFactorVerified: true,
        authMethods: ['pwd', 'mfa'],
      },
    });

    const response = await passingCaller.auth.self();
    assert.equal(response.isStaff, true);
    assert.equal(response.role, UserRole.ADMIN);
  } finally {
    await prisma.auditLog.deleteMany({
      where: {
        tenantId: tenant.id,
        action: { in: ['AUTH_GUARDRAIL_BLOCKED', 'AUTH_GUARDRAIL_WARNING'] },
      },
    });
    await prisma.staffMembership.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.church.deleteMany({ where: { id: church.id } });
    await prisma.organization.deleteMany({ where: { id: organization.id } });
    await prisma.tenantSecurityPolicy.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.deleteMany({ where: { id: tenant.id } });
  }
});
