import Stripe from 'stripe';
import { Prisma, SubscriptionProvider, prisma } from '@faithflow-ai/database';

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function readStringFromPaths(source: unknown, paths: string[][]) {
  for (const path of paths) {
    let cursor: unknown = source;
    for (const key of path) {
      if (!cursor || typeof cursor !== 'object') {
        cursor = undefined;
        break;
      }
      if (Array.isArray(cursor)) {
        const index = Number(key);
        cursor = Number.isInteger(index) ? cursor[index] : undefined;
      } else {
        cursor = (cursor as JsonRecord)[key];
      }
    }
    if (typeof cursor === 'string' && cursor.trim().length > 0) {
      return cursor.trim();
    }
  }
  return null;
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function hasMetadataChanged(before: JsonRecord, after: JsonRecord) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

let stripeClient: Stripe | null = null;
let stripeKey: string | null = null;

function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeClient || stripeKey !== key) {
    stripeClient = new Stripe(key);
    stripeKey = key;
  }
  return stripeClient;
}

async function fetchPaystackSubscription(subscriptionRef: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return null;
  const response = await fetch(`https://api.paystack.co/subscription/${encodeURIComponent(subscriptionRef)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { status?: boolean; data?: unknown };
  if (!payload.status || !payload.data) return null;
  return payload.data as JsonRecord;
}

function normalizeStripeMetadata(rawMetadata: unknown, providerRef?: string | null) {
  const metadata = asRecord(rawMetadata);
  const normalized = { ...metadata };

  const stripeSubscriptionId =
    readStringFromPaths(metadata, [['stripeSubscriptionId'], ['id'], ['subscription'], ['data', 'subscription']]) ??
    (providerRef ?? null);
  const stripeCustomerId = readStringFromPaths(metadata, [
    ['stripeCustomerId'],
    ['customer'],
    ['data', 'object', 'customer'],
    ['data', 'customer'],
  ]);
  const stripePriceId = readStringFromPaths(metadata, [
    ['stripePriceId'],
    ['items', 'data', '0', 'price', 'id'],
    ['data', 'object', 'items', 'data', '0', 'price', 'id'],
    ['plan', 'id'],
  ]);

  if (stripeSubscriptionId) normalized.stripeSubscriptionId = stripeSubscriptionId;
  if (stripeCustomerId) normalized.stripeCustomerId = stripeCustomerId;
  if (stripePriceId) normalized.stripePriceId = stripePriceId;
  return normalized;
}

function normalizePaystackMetadata(rawMetadata: unknown, providerRef?: string | null) {
  const metadata = asRecord(rawMetadata);
  const normalized = { ...metadata };

  const subscriptionCode =
    readStringFromPaths(metadata, [
      ['paystackSubscriptionCode'],
      ['subscription_code'],
      ['data', 'subscription', 'subscription_code'],
      ['data', 'subscription_code'],
    ]) ?? (providerRef ?? null);
  const customerCode = readStringFromPaths(metadata, [
    ['paystackCustomerCode'],
    ['customer_code'],
    ['data', 'customer', 'customer_code'],
    ['customer', 'customer_code'],
  ]);
  const planCode = readStringFromPaths(metadata, [
    ['paystackPlanCode'],
    ['plan_code'],
    ['data', 'plan', 'plan_code'],
    ['plan', 'plan_code'],
  ]);
  const emailToken = readStringFromPaths(metadata, [['paystackEmailToken'], ['email_token'], ['data', 'email_token']]);

  if (subscriptionCode) normalized.paystackSubscriptionCode = subscriptionCode;
  if (customerCode) normalized.paystackCustomerCode = customerCode;
  if (planCode) normalized.paystackPlanCode = planCode;
  if (emailToken) normalized.paystackEmailToken = emailToken;
  return normalized;
}

export async function runSubscriptionMetadataBackfill(options?: {
  tenantIds?: string[];
  subscriptionIds?: string[];
  limit?: number;
  dryRun?: boolean;
}) {
  const limit = options?.limit ?? 250;
  const stripe = getStripeClient();
  const records = await prisma.tenantSubscription.findMany({
    where: {
      provider: { in: [SubscriptionProvider.STRIPE, SubscriptionProvider.PAYSTACK] },
      ...(options?.tenantIds?.length ? { tenantId: { in: options.tenantIds } } : {}),
      ...(options?.subscriptionIds?.length ? { id: { in: options.subscriptionIds } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let updated = 0;
  let skipped = 0;
  const errors: Array<{ subscriptionId: string; message: string }> = [];
  const changedIds: string[] = [];

  for (const record of records) {
    try {
      const metadata = asRecord(record.metadata);
      let normalized = metadata;

      if (record.provider === SubscriptionProvider.STRIPE) {
        normalized = normalizeStripeMetadata(metadata, record.providerRef);
        const hasCustomerId = typeof normalized.stripeCustomerId === 'string' && normalized.stripeCustomerId.length > 0;
        if (!hasCustomerId && stripe && record.providerRef?.startsWith('sub_')) {
          const providerSub = await stripe.subscriptions.retrieve(record.providerRef);
          const customerId =
            typeof providerSub.customer === 'string' ? providerSub.customer : providerSub.customer?.id ?? null;
          const item = providerSub.items.data[0];
          if (customerId) normalized.stripeCustomerId = customerId;
          if (providerSub.id) normalized.stripeSubscriptionId = providerSub.id;
          const priceId = item?.price?.id ?? null;
          if (priceId) normalized.stripePriceId = priceId;
        }
      } else if (record.provider === SubscriptionProvider.PAYSTACK) {
        normalized = normalizePaystackMetadata(metadata, record.providerRef);
        const hasCustomerCode =
          typeof normalized.paystackCustomerCode === 'string' && normalized.paystackCustomerCode.length > 0;
        if (!hasCustomerCode && record.providerRef) {
          const paystackSub = await fetchPaystackSubscription(record.providerRef);
          if (paystackSub) {
            const customerCode = readStringFromPaths(paystackSub, [['customer', 'customer_code']]);
            const planCode = readStringFromPaths(paystackSub, [['plan', 'plan_code']]);
            const subscriptionCode = readStringFromPaths(paystackSub, [['subscription_code']]);
            const emailToken = readStringFromPaths(paystackSub, [['email_token']]);
            if (customerCode) normalized.paystackCustomerCode = customerCode;
            if (planCode) normalized.paystackPlanCode = planCode;
            if (subscriptionCode) normalized.paystackSubscriptionCode = subscriptionCode;
            if (emailToken) normalized.paystackEmailToken = emailToken;
          }
        }
      }

      if (!hasMetadataChanged(metadata, normalized)) {
        skipped += 1;
        continue;
      }

      if (!options?.dryRun) {
        await prisma.tenantSubscription.update({
          where: { id: record.id },
          data: { metadata: toInputJson(normalized) },
        });
      }

      changedIds.push(record.id);
      updated += 1;
    } catch (error) {
      errors.push({
        subscriptionId: record.id,
        message: error instanceof Error ? error.message : 'Backfill failed',
      });
    }
  }

  return {
    scanned: records.length,
    updated,
    skipped,
    failed: errors.length,
    changedIds,
    errors,
    dryRun: Boolean(options?.dryRun),
  };
}
