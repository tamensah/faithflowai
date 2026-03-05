import assert from 'node:assert/strict';
import test from 'node:test';
import { runTenantDomainAutomation } from '@faithflow-ai/api';
import {
  SupportTicketStatus,
  TenantDomainStatus,
  TenantSslStatus,
  prisma,
} from '@faithflow-ai/database';

function uniqueSuffix() {
  return `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

test('tenant domain automation creates and resolves escalation tickets from runbook state', async () => {
  const suffix = uniqueSuffix();
  const tenant = await prisma.tenant.create({
    data: {
      name: `Domain Ops ${suffix}`,
      slug: `domain-ops-${suffix}`,
      clerkOrgId: `org_domain_${suffix}`,
    },
  });

  const domain = await prisma.tenantDomain.create({
    data: {
      tenantId: tenant.id,
      domain: 'example.com',
      verificationToken: `verify_${suffix}`,
      status: TenantDomainStatus.ACTIVE,
      sslStatus: TenantSslStatus.PROVISIONED,
      sslExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  });

  try {
    const first = await runTenantDomainAutomation({
      tenantId: tenant.id,
      limit: 10,
      sslExpiryWarningDays: 30,
      dryRun: false,
    });
    assert.ok(first.updated >= 1);

    const escalated = await prisma.supportTicket.findMany({
      where: {
        tenantId: tenant.id,
        subject: { contains: `[domain:${domain.id}]` },
      },
      orderBy: { createdAt: 'asc' },
    });
    assert.equal(escalated.length, 1);
    assert.equal(escalated[0].status, SupportTicketStatus.OPEN);

    await prisma.tenantDomain.update({
      where: { id: domain.id },
      data: {
        status: TenantDomainStatus.ACTIVE,
        sslStatus: TenantSslStatus.PROVISIONED,
        sslExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    await runTenantDomainAutomation({
      tenantId: tenant.id,
      limit: 10,
      sslExpiryWarningDays: 30,
      dryRun: false,
    });

    const ticketAfterRecovery = await prisma.supportTicket.findUniqueOrThrow({
      where: { id: escalated[0].id },
    });
    assert.equal(ticketAfterRecovery.status, SupportTicketStatus.RESOLVED);
  } finally {
    await prisma.supportTicketMessage.deleteMany({
      where: {
        ticket: {
          tenantId: tenant.id,
          subject: { contains: `[domain:${domain.id}]` },
        },
      },
    });
    await prisma.supportTicket.deleteMany({
      where: {
        tenantId: tenant.id,
        subject: { contains: `[domain:${domain.id}]` },
      },
    });
    await prisma.tenantHealthCheck.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenantDomain.deleteMany({ where: { id: domain.id } });
    await prisma.organization.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.deleteMany({ where: { id: tenant.id } });
  }
});
