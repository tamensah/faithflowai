import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { handlePaystackWebhook } from '@faithflow-ai/api';
import { PaymentProvider, RecurringStatus, WebhookProvider, prisma } from '@faithflow-ai/database';

function uniqueSuffix() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function eventIdFromPayload(payload: string, event: string, id: string, reference: string, subscriptionCode: string, planCode: string) {
  const hashPrefix = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
  return [event, id, reference, subscriptionCode, planCode, hashPrefix].filter(Boolean).join(':');
}

test('paystack webhook processing is idempotent for repeated delivery', async () => {
  const suffix = uniqueSuffix();
  const secret = 'paystack_test_secret';
  const eventName = 'subscription.disable';
  const eventDataId = `evt_paystack_${suffix}`;
  const reference = `ref_${suffix}`;
  const subscriptionCode = `SUB_${suffix}`;
  const planCode = `PLAN_${suffix}`;

  const tenant = await prisma.tenant.create({
    data: {
      name: `Paystack Tenant ${suffix}`,
      slug: `paystack-tenant-${suffix}`,
      clerkOrgId: `org_paystack_${suffix}`,
    },
  });
  const organization = await prisma.organization.create({
    data: {
      tenantId: tenant.id,
      name: `Paystack Org ${suffix}`,
    },
  });
  const church = await prisma.church.create({
    data: {
      organizationId: organization.id,
      name: `Paystack Church ${suffix}`,
      slug: `paystack-church-${suffix}`,
      countryCode: 'GH',
      timezone: 'UTC',
    },
  });
  const recurring = await prisma.recurringDonation.create({
    data: {
      churchId: church.id,
      amount: 20,
      currency: 'GHS',
      interval: 'MONTHLY',
      provider: PaymentProvider.PAYSTACK,
      providerRef: subscriptionCode,
      status: RecurringStatus.ACTIVE,
      startAt: new Date(),
    },
  });

  const payload = JSON.stringify({
    event: eventName,
    data: {
      id: eventDataId,
      reference,
      status: 'cancelled',
      subscription: { subscription_code: subscriptionCode },
      plan: { plan_code: planCode },
      customer: { customer_code: `CUS_${suffix}` },
    },
  });
  const signature = crypto.createHmac('sha512', secret).update(payload).digest('hex');
  const webhookEventId = eventIdFromPayload(payload, eventName, eventDataId, reference, subscriptionCode, planCode);

  try {
    const first = await handlePaystackWebhook(payload, signature, secret);
    assert.equal((first as { duplicate?: boolean }).duplicate, undefined);

    const afterFirst = await prisma.recurringDonation.findUniqueOrThrow({ where: { id: recurring.id } });
    assert.equal(afterFirst.status, RecurringStatus.CANCELED);

    const second = await handlePaystackWebhook(payload, signature, secret);
    assert.equal((second as { duplicate?: boolean }).duplicate, true);

    const events = await prisma.webhookEvent.findMany({
      where: {
        provider: WebhookProvider.PAYSTACK,
        externalEventId: webhookEventId,
      },
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].status, 'PROCESSED');
  } finally {
    await prisma.webhookEvent.deleteMany({
      where: {
        provider: WebhookProvider.PAYSTACK,
        externalEventId: webhookEventId,
      },
    });
    await prisma.recurringDonation.deleteMany({ where: { id: recurring.id } });
    await prisma.church.deleteMany({ where: { id: church.id } });
    await prisma.organization.deleteMany({ where: { id: organization.id } });
    await prisma.tenant.deleteMany({ where: { id: tenant.id } });
  }
});
