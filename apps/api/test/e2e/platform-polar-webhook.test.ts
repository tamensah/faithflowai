import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { Webhook } from 'standardwebhooks';
import { handlePlatformPolarWebhook, mapPolarStatus } from '@faithflow-ai/api';
import {
  SubscriptionProvider,
  TenantSubscriptionStatus,
  WebhookProvider,
  prisma,
} from '@faithflow-ai/database';

function webhookHeaders(body: string, secret: string, webhookId: string) {
  const timestamp = new Date();
  const encodedSecret = Buffer.from(secret, 'utf8').toString('base64');
  return {
    'webhook-id': webhookId,
    'webhook-timestamp': Math.floor(timestamp.getTime() / 1000).toString(),
    'webhook-signature': new Webhook(encodedSecret).sign(webhookId, timestamp, body),
  };
}

test('signed Polar subscription webhook activates the matching tenant once', async () => {
  const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const webhookSecret = `polar_whs_${suffix}`;
  const webhookId = `polar_event_${suffix}`;
  const organizationId = randomUUID();
  const productId = randomUUID();
  const priceId = randomUUID();
  const customerId = randomUUID();
  const subscriptionId = randomUUID();

  const tenant = await prisma.tenant.create({
    data: { name: `Polar Tenant ${suffix}`, slug: `polar-tenant-${suffix}`, clerkOrgId: `org_${suffix}` },
  });
  const plan = await prisma.subscriptionPlan.create({
    data: {
      code: `polar-growth-${suffix}`,
      name: `Polar Growth ${suffix}`,
      currency: 'USD',
      interval: 'MONTHLY',
      amountMinor: 14900,
      isActive: true,
      isDefault: false,
      metadata: { polarProductId: productId },
    },
  });

  const price = {
    created_at: now.toISOString(),
    modified_at: null,
    id: priceId,
    source: 'catalog',
    amount_type: 'fixed',
    price_currency: 'usd',
    tax_behavior: null,
    is_archived: false,
    product_id: productId,
    price_amount: 14900,
  };
  const product = {
    id: productId,
    created_at: now.toISOString(),
    modified_at: null,
    trial_interval: 'day',
    trial_interval_count: 14,
    name: 'Growth',
    description: 'ChurchTrack growth plan',
    visibility: 'private',
    recurring_interval: 'month',
    recurring_interval_count: 1,
    meter_interval: null,
    meter_interval_count: null,
    is_recurring: true,
    is_archived: false,
    organization_id: organizationId,
    metadata: {},
    prices: [price],
    benefits: [],
    medias: [],
    attached_custom_fields: [],
  };
  const payload = JSON.stringify({
    type: 'subscription.active',
    timestamp: now.toISOString(),
    data: {
      created_at: now.toISOString(),
      modified_at: now.toISOString(),
      id: subscriptionId,
      amount: 14900,
      currency: 'usd',
      recurring_interval: 'month',
      recurring_interval_count: 1,
      status: 'active',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      current_meter_period_start: null,
      current_meter_period_end: null,
      trial_start: null,
      trial_end: null,
      cancel_at_period_end: false,
      canceled_at: null,
      started_at: now.toISOString(),
      ends_at: null,
      ended_at: null,
      past_due_at: null,
      pause_at_period_end: false,
      paused_at: null,
      resumes_at: null,
      customer_id: customerId,
      product_id: productId,
      discount_id: null,
      checkout_id: randomUUID(),
      customer_cancellation_reason: null,
      customer_cancellation_comment: null,
      metadata: { tenantId: tenant.id, clerkOrgId: tenant.clerkOrgId, planCode: plan.code },
      customer: {
        id: customerId,
        created_at: now.toISOString(),
        modified_at: null,
        metadata: {},
        external_id: tenant.id,
        email: 'polar-test@example.com',
        email_verified: true,
        type: 'individual',
        name: 'Polar Test',
        billing_name: null,
        billing_address: null,
        tax_id: null,
        locale: 'en',
        organization_id: organizationId,
        default_payment_method_id: null,
        deleted_at: null,
        avatar_url: null,
      },
      product,
      discount: null,
      prices: [price],
      meters: [],
      pending_update: null,
    },
  });
  const headers = webhookHeaders(payload, webhookSecret, webhookId);

  try {
    const first = await handlePlatformPolarWebhook(payload, headers, webhookSecret);
    assert.equal(first.ok, true);
    assert.equal('provider' in first ? first.provider : null, 'polar');

    const subscription = await prisma.tenantSubscription.findFirstOrThrow({
      where: { tenantId: tenant.id, provider: SubscriptionProvider.POLAR },
    });
    assert.equal(subscription.providerRef, subscriptionId);
    assert.equal(subscription.planId, plan.id);
    assert.equal(subscription.status, TenantSubscriptionStatus.ACTIVE);

    const duplicate = await handlePlatformPolarWebhook(payload, headers, webhookSecret);
    assert.equal(duplicate.ok, true);
    assert.equal('duplicate' in duplicate ? duplicate.duplicate : false, true);
    assert.equal(
      await prisma.tenantSubscription.count({ where: { tenantId: tenant.id, provider: SubscriptionProvider.POLAR } }),
      1
    );
  } finally {
    await prisma.webhookEvent.deleteMany({
      where: { provider: WebhookProvider.POLAR_PLATFORM, externalEventId: webhookId },
    });
    await prisma.tenantSubscription.deleteMany({
      where: { OR: [{ tenantId: tenant.id }, { planId: plan.id }] },
    });
    await prisma.subscriptionPlan.delete({ where: { id: plan.id } });
    await prisma.organization.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  }
});

test('Polar webhook rejects an invalid signature before persistence', async () => {
  await assert.rejects(
    () =>
      handlePlatformPolarWebhook(
        JSON.stringify({ type: 'subscription.active' }),
        {
          'webhook-id': 'invalid-event',
          'webhook-timestamp': Math.floor(Date.now() / 1000).toString(),
          'webhook-signature': 'v1,invalid',
        },
        'polar_whs_invalid'
      ),
    /signature|base64|verify/i
  );
});

test('unknown Polar subscription states fail closed', () => {
  assert.equal(mapPolarStatus('future_provider_state'), TenantSubscriptionStatus.PAUSED);
});
