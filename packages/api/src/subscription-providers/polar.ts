import { Polar } from '@polar-sh/sdk';
import type { Subscription } from '@polar-sh/sdk/models/components/subscription';
import { TenantSubscriptionStatus, type Prisma } from '@faithflow-ai/database';

export type PolarServer = 'sandbox' | 'production';

export function getPolarServer(): PolarServer {
  return process.env.POLAR_SERVER === 'production' ? 'production' : 'sandbox';
}

export function createPolarClient(accessToken = process.env.POLAR_ACCESS_TOKEN) {
  if (!accessToken?.trim()) {
    throw new Error('Polar is not configured');
  }
  return new Polar({ accessToken: accessToken.trim(), server: getPolarServer() });
}

export function mapPolarStatus(status?: string | null) {
  switch (status) {
    case 'trialing':
      return TenantSubscriptionStatus.TRIALING;
    case 'active':
      return TenantSubscriptionStatus.ACTIVE;
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
      return TenantSubscriptionStatus.PAST_DUE;
    case 'paused':
      return TenantSubscriptionStatus.PAUSED;
    case 'canceled':
      return TenantSubscriptionStatus.CANCELED;
    case 'incomplete_expired':
      return TenantSubscriptionStatus.EXPIRED;
    default:
      // Fail closed if Polar adds a status that this adapter does not yet know.
      // Unknown provider states must never grant paid entitlements.
      return TenantSubscriptionStatus.PAUSED;
  }
}

export function normalizePolarSubscription(subscription: Subscription) {
  return {
    polarSubscriptionId: subscription.id,
    polarCustomerId: subscription.customerId,
    polarProductId: subscription.productId,
    polarCheckoutId: subscription.checkoutId,
    status: subscription.status,
    metadata: subscription.metadata,
    pendingUpdate: subscription.pendingUpdate ? JSON.parse(JSON.stringify(subscription.pendingUpdate)) : null,
  } as Prisma.InputJsonValue;
}

export async function createPolarCheckout(input: {
  productId: string;
  tenantId: string;
  clerkOrgId?: string | null;
  planCode: string;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number | null;
}) {
  const checkout = await createPolarClient().checkouts.create({
    products: [input.productId],
    externalCustomerId: input.tenantId,
    customerEmail: input.customerEmail ?? undefined,
    successUrl: input.successUrl,
    returnUrl: input.cancelUrl,
    allowTrial: Boolean(input.trialDays),
    ...(input.trialDays
      ? { trialInterval: 'day' as const, trialIntervalCount: input.trialDays }
      : {}),
    metadata: {
      tenantId: input.tenantId,
      clerkOrgId: input.clerkOrgId ?? '',
      planCode: input.planCode,
    },
  });

  return { id: checkout.id, url: checkout.url };
}
