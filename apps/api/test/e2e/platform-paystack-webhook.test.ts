import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { handlePlatformPaystackWebhook } from '@faithflow-ai/api';
import {
  SubscriptionProvider,
  TenantSubscriptionStatus,
  WebhookProvider,
  prisma,
} from '@faithflow-ai/database';

function uniqueSuffix() {
  return `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

test('platform paystack webhook reconciliation remains tenant-scoped and upgrades providerRef to subscription code', async () => {
  const suffix = uniqueSuffix();
  const startedAt = new Date();
  const webhookSecret = `paystack_secret_${suffix}`;
  const reference = `trx_${suffix}`;
  const planCode = `PLN_${suffix}`;
  const subscriptionCode = `SUB_${suffix}`;

  const tenantA = await prisma.tenant.create({
    data: {
      name: `Tenant A ${suffix}`,
      slug: `tenant-a-${suffix}`,
      clerkOrgId: `org_a_${suffix}`,
    },
  });
  const tenantB = await prisma.tenant.create({
    data: {
      name: `Tenant B ${suffix}`,
      slug: `tenant-b-${suffix}`,
      clerkOrgId: `org_b_${suffix}`,
    },
  });

  const plan = await prisma.subscriptionPlan.create({
    data: {
      code: `growth-${suffix}`,
      name: `Growth ${suffix}`,
      currency: 'USD',
      interval: 'MONTHLY',
      amountMinor: 14900,
      isActive: true,
      isDefault: false,
      metadata: {
        paystackPlanCode: `LEGACY_${suffix}`,
        paystackTrialPlanCode: planCode,
      },
    },
  });

  const tenantBExisting = await prisma.tenantSubscription.create({
    data: {
      tenantId: tenantB.id,
      planId: plan.id,
      provider: SubscriptionProvider.PAYSTACK,
      providerRef: planCode,
      status: TenantSubscriptionStatus.ACTIVE,
      startsAt: new Date(),
    },
  });

  try {
    const successPayload = JSON.stringify({
      event: 'charge.success',
      data: {
        id: `evt_success_${suffix}`,
        reference,
        status: 'success',
        amount: 14900,
        currency: 'USD',
        metadata: {
          tenantId: tenantA.id,
          clerkOrgId: tenantA.clerkOrgId,
          planCode: plan.code,
        },
        plan: { plan_code: planCode },
        customer: { customer_code: `CUS_${suffix}` },
      },
    });
    const successSignature = crypto.createHmac('sha512', webhookSecret).update(successPayload).digest('hex');

    const successResult = await handlePlatformPaystackWebhook(successPayload, successSignature, webhookSecret);
    assert.equal((successResult as { ok: boolean }).ok, true);

    const tenantAAfterSuccess = await prisma.tenantSubscription.findMany({
      where: { tenantId: tenantA.id, provider: SubscriptionProvider.PAYSTACK },
      orderBy: { createdAt: 'asc' },
    });
    assert.equal(tenantAAfterSuccess.length, 1);
    assert.equal(tenantAAfterSuccess[0].providerRef, reference);
    assert.equal(tenantAAfterSuccess[0].planId, plan.id);

    const tenantBAfterSuccess = await prisma.tenantSubscription.findUniqueOrThrow({ where: { id: tenantBExisting.id } });
    assert.equal(tenantBAfterSuccess.providerRef, planCode);
    assert.equal(tenantBAfterSuccess.status, TenantSubscriptionStatus.ACTIVE);

    const createPayload = JSON.stringify({
      event: 'subscription.create',
      data: {
        id: `evt_create_${suffix}`,
        reference,
        status: 'active',
        metadata: {
          tenantId: tenantA.id,
          clerkOrgId: tenantA.clerkOrgId,
          planCode: plan.code,
        },
        plan: { plan_code: planCode },
        subscription: { subscription_code: subscriptionCode, next_payment_date: new Date(Date.now() + 86400000).toISOString() },
        customer: { customer_code: `CUS_${suffix}` },
      },
    });
    const createSignature = crypto.createHmac('sha512', webhookSecret).update(createPayload).digest('hex');

    const createResult = await handlePlatformPaystackWebhook(createPayload, createSignature, webhookSecret);
    assert.equal((createResult as { ok: boolean }).ok, true);

    const tenantAAfterCreate = await prisma.tenantSubscription.findMany({
      where: { tenantId: tenantA.id, provider: SubscriptionProvider.PAYSTACK },
      orderBy: { createdAt: 'asc' },
    });
    assert.equal(tenantAAfterCreate.length, 1);
    assert.equal(tenantAAfterCreate[0].providerRef, subscriptionCode);
    assert.equal(tenantAAfterCreate[0].status, TenantSubscriptionStatus.ACTIVE);

    const resultMeta = (tenantAAfterCreate[0].metadata ?? {}) as Record<string, unknown>;
    assert.equal(resultMeta.paystackReference, reference);
    assert.equal(resultMeta.paystackSubscriptionCode, subscriptionCode);
  } finally {
    await prisma.webhookEvent.deleteMany({
      where: {
        provider: WebhookProvider.PAYSTACK_PLATFORM,
        receivedAt: { gte: startedAt },
        eventType: { in: ['charge.success', 'subscription.create'] },
      },
    });
    await prisma.tenantSubscription.deleteMany({
      where: {
        OR: [{ id: tenantBExisting.id }, { tenantId: { in: [tenantA.id, tenantB.id] } }],
      },
    });
    await prisma.subscriptionPlan.deleteMany({ where: { id: plan.id } });
    await prisma.organization.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
  }
});
