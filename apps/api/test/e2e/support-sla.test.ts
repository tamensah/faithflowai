import assert from 'node:assert/strict';
import test from 'node:test';
import { appRouter, runSupportSlaAutomation } from '@faithflow-ai/api';
import {
  PlatformRole,
  PlatformUserStatus,
  SupportTicketPriority,
  SupportTicketStatus,
  TenantStatus,
  prisma,
} from '@faithflow-ai/database';

function uniqueSuffix() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function createTenantFixture(suffix: string) {
  const tenant = await prisma.tenant.create({
    data: {
      name: `Support Tenant ${suffix}`,
      slug: `support-tenant-${suffix}`,
      clerkOrgId: `org_support_${suffix}`,
      status: TenantStatus.ACTIVE,
    },
  });
  const organization = await prisma.organization.create({
    data: {
      tenantId: tenant.id,
      name: `Support Org ${suffix}`,
    },
  });
  const church = await prisma.church.create({
    data: {
      organizationId: organization.id,
      name: `Support Church ${suffix}`,
      slug: `support-church-${suffix}`,
      countryCode: 'US',
      timezone: 'UTC',
    },
  });

  return { tenant, organization, church };
}

async function createPlatformSupportUser(suffix: string) {
  const clerkUserId = `clerk_support_${suffix}`;
  const platformUser = await prisma.platformUser.create({
    data: {
      clerkUserId,
      email: `support_${suffix}@faithflow.test`,
      name: `Support ${suffix}`,
      status: PlatformUserStatus.ACTIVE,
    },
  });
  await prisma.platformUserRole.create({
    data: {
      platformUserId: platformUser.id,
      role: PlatformRole.SUPPORT_MANAGER,
    },
  });
  return { platformUser, clerkUserId };
}

test('support SLA automation marks overdue first-response and resolution breaches', async () => {
  const suffix = uniqueSuffix();
  const { tenant, organization, church } = await createTenantFixture(suffix);

  const ticket = await prisma.supportTicket.create({
    data: {
      tenantId: tenant.id,
      churchId: church.id,
      requesterEmail: `requester_${suffix}@faithflow.test`,
      requesterName: 'Requester',
      subject: 'SLA breach test',
      description: 'Validate SLA breach marker automation.',
      priority: SupportTicketPriority.HIGH,
      status: SupportTicketStatus.OPEN,
      firstResponseDueAt: new Date(Date.now() - 60 * 60 * 1000),
      resolutionDueAt: new Date(Date.now() - 30 * 60 * 1000),
    },
  });

  try {
    const result = await runSupportSlaAutomation({ tenantId: tenant.id, limit: 100, dryRun: false });
    assert.equal(result.scanned >= 1, true);
    assert.equal(result.firstResponseBreaches >= 1, true);
    assert.equal(result.resolutionBreaches >= 1, true);

    const updated = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
    assert.notEqual(updated.firstResponseBreachedAt, null);
    assert.notEqual(updated.resolutionBreachedAt, null);
  } finally {
    await prisma.supportTicketMessage.deleteMany({ where: { ticketId: ticket.id } });
    await prisma.supportTicket.deleteMany({ where: { id: ticket.id } });
    await prisma.church.deleteMany({ where: { id: church.id } });
    await prisma.organization.deleteMany({ where: { id: organization.id } });
    await prisma.tenant.deleteMany({ where: { id: tenant.id } });
  }
});

test('support route transitions set first response and reopen count', async () => {
  const suffix = uniqueSuffix();
  const { tenant, organization, church } = await createTenantFixture(suffix);
  const { platformUser, clerkUserId } = await createPlatformSupportUser(suffix);

  const ticket = await prisma.supportTicket.create({
    data: {
      tenantId: tenant.id,
      churchId: church.id,
      requesterEmail: `requester_${suffix}@faithflow.test`,
      requesterName: 'Requester',
      subject: 'SLA transition test',
      description: 'Validate first response and reopen transition handling.',
      priority: SupportTicketPriority.NORMAL,
      status: SupportTicketStatus.RESOLVED,
      resolvedAt: new Date(),
      firstResponseDueAt: new Date(Date.now() + 60 * 60 * 1000),
      resolutionDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const caller = appRouter.createCaller({
    userId: clerkUserId,
    clerkOrgId: null,
    tenantId: null,
    tenantStatus: null,
  });

  try {
    await caller.support.updatePlatformTicket({
      ticketId: ticket.id,
      status: SupportTicketStatus.OPEN,
    });

    const reopened = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
    assert.equal(reopened.reopenedCount, 1);

    await caller.support.addPlatformMessage({
      ticketId: ticket.id,
      body: 'Initial support response to customer.',
      isInternal: false,
    });

    const responded = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
    assert.notEqual(responded.firstRespondedAt, null);
    assert.equal(responded.status, SupportTicketStatus.WAITING_CUSTOMER);
  } finally {
    await prisma.supportTicketMessage.deleteMany({ where: { ticketId: ticket.id } });
    await prisma.supportTicket.deleteMany({ where: { id: ticket.id } });
    await prisma.platformUserRole.deleteMany({ where: { platformUserId: platformUser.id } });
    await prisma.platformUser.deleteMany({ where: { id: platformUser.id } });
    await prisma.church.deleteMany({ where: { id: church.id } });
    await prisma.organization.deleteMany({ where: { id: organization.id } });
    await prisma.tenant.deleteMany({ where: { id: tenant.id } });
  }
});
