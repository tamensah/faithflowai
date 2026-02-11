import assert from 'node:assert/strict';
import test from 'node:test';
import Stripe from 'stripe';
import { handlePlatformStripeWebhook } from '@faithflow-ai/api';
import {
  SubscriptionProvider,
  TenantSubscriptionStatus,
  WebhookProvider,
  prisma,
} from '@faithflow-ai/database';

function uniqueSuffix() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

test('platform stripe webhook processing is idempotent by provider event id', async () => {
  const suffix = uniqueSuffix();
  const webhookSecret = 'whsec_test_faithflow';
  const tenant = await prisma.tenant.create({
    data: {
      name: `Webhook Tenant ${suffix}`,
      slug: `webhook-tenant-${suffix}`,
      clerkOrgId: `org_webhook_${suffix}`,
    },
  });
  const plan = await prisma.subscriptionPlan.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
  assert.ok(plan, 'Expected at least one active subscription plan');

  const providerRef = `sub_test_${suffix}`;
  const subscription = await prisma.tenantSubscription.create({
    data: {
      tenantId: tenant.id,
      planId: plan.id,
      status: TenantSubscriptionStatus.ACTIVE,
      provider: SubscriptionProvider.STRIPE,
      providerRef,
      startsAt: new Date(),
    },
  });

  const eventId = `evt_platform_${suffix}`;
  const invoiceId = `in_${suffix}`;
  const payload = JSON.stringify({
    id: eventId,
    object: 'event',
    type: 'invoice.payment_failed',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: invoiceId,
        object: 'invoice',
        subscription: providerRef,
        customer: `cus_${suffix}`,
      },
    },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });

  try {
    const first = await handlePlatformStripeWebhook(payload, signature, webhookSecret, 'sk_test_faithflow');
    assert.equal((first as { duplicate?: boolean }).duplicate, undefined);

    const afterFirst = await prisma.tenantSubscription.findUniqueOrThrow({ where: { id: subscription.id } });
    assert.equal(afterFirst.status, TenantSubscriptionStatus.PAST_DUE);
    const firstMeta = (afterFirst.metadata ?? {}) as Record<string, unknown>;
    assert.equal(firstMeta.stripeCustomerId, `cus_${suffix}`);
    assert.equal(firstMeta.stripeSubscriptionId, providerRef);

    const second = await handlePlatformStripeWebhook(payload, signature, webhookSecret, 'sk_test_faithflow');
    assert.equal((second as { duplicate?: boolean }).duplicate, true);

    const events = await prisma.webhookEvent.findMany({
      where: {
        provider: WebhookProvider.STRIPE_PLATFORM,
        externalEventId: eventId,
      },
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].status, 'PROCESSED');
  } finally {
    await prisma.webhookEvent.deleteMany({
      where: {
        provider: WebhookProvider.STRIPE_PLATFORM,
        externalEventId: eventId,
      },
    });
    await prisma.tenantSubscription.deleteMany({ where: { id: subscription.id } });
    await prisma.organization.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.deleteMany({ where: { id: tenant.id } });
  }
});
