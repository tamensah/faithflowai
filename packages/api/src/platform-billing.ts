import crypto from 'crypto';
import Stripe from 'stripe';
import {
  prisma,
  Prisma,
  AuditActorType,
  CommunicationChannel,
  CommunicationProvider,
  CommunicationScheduleStatus,
  SubscriptionProvider,
  TenantSubscriptionStatus,
  UserRole,
  WebhookProvider,
} from '@faithflow-ai/database';
import { recordAuditLog } from './audit';
import { renderWelcomeOrgEmail } from './email-templates';
import {
  beginWebhookProcessing,
  buildWebhookExternalEventId,
  hashWebhookPayload,
  markWebhookFailed,
  markWebhookProcessed,
} from './webhook-idempotency';

const stripeStatusMap: Record<string, TenantSubscriptionStatus> = {
  trialing: TenantSubscriptionStatus.TRIALING,
  active: TenantSubscriptionStatus.ACTIVE,
  past_due: TenantSubscriptionStatus.PAST_DUE,
  unpaid: TenantSubscriptionStatus.PAST_DUE,
  paused: TenantSubscriptionStatus.PAUSED,
  canceled: TenantSubscriptionStatus.CANCELED,
  incomplete_expired: TenantSubscriptionStatus.EXPIRED,
  incomplete: TenantSubscriptionStatus.PAST_DUE,
};

function mapStripeStatus(status?: string | null) {
  if (!status) return TenantSubscriptionStatus.ACTIVE;
  return stripeStatusMap[status] ?? TenantSubscriptionStatus.ACTIVE;
}

function mapPaystackStatus(status?: string | null) {
  if (!status) return TenantSubscriptionStatus.ACTIVE;
  if (status === 'active') return TenantSubscriptionStatus.ACTIVE;
  if (status === 'non-renewing') return TenantSubscriptionStatus.PAUSED;
  if (status === 'attention') return TenantSubscriptionStatus.PAST_DUE;
  if (status === 'complete' || status === 'cancelled' || status === 'canceled') return TenantSubscriptionStatus.CANCELED;
  return TenantSubscriptionStatus.ACTIVE;
}

function normalizeStripeSubscriptionMetadata(subscription: Stripe.Subscription) {
  const primaryItem = subscription.items.data[0];
  const priceId =
    primaryItem?.price && typeof primaryItem.price !== 'string'
      ? primaryItem.price.id
      : null;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? null;
  return {
    ...(subscription as unknown as Record<string, unknown>),
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId,
    ...(priceId ? { stripePriceId: priceId } : {}),
  } as Prisma.InputJsonValue;
}

function normalizeStripeInvoiceMetadata(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;
  const subscriptionId =
    (invoice as Stripe.Invoice & { subscription?: string | null }).subscription ?? null;
  return {
    ...(invoice as unknown as Record<string, unknown>),
    ...(customerId ? { stripeCustomerId: customerId } : {}),
    ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
  } as Prisma.InputJsonValue;
}

async function queueTenantWelcomeEmail(tenantId: string) {
  // Avoid queueing messages that will inevitably fail when email isn't configured.
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;

  const admins = await prisma.staffMembership.findMany({
    where: {
      role: UserRole.ADMIN,
      church: { organization: { tenantId } },
      user: { email: { not: '' } },
    },
    include: {
      church: true,
      user: true,
    },
    take: 50,
  });

  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3001';

  for (const admin of admins) {
    const to = admin.user.email?.toLowerCase();
    if (!to) continue;
    const dedupeKey = `welcome:${tenantId}:${to}`;

    const existing = await prisma.communicationSchedule.findFirst({
      where: {
        churchId: admin.churchId,
        to,
        status: { in: [CommunicationScheduleStatus.QUEUED, CommunicationScheduleStatus.SENT] },
        metadata: { path: ['dedupeKey'], equals: dedupeKey },
      },
    });
    if (existing) continue;

    await prisma.communicationSchedule.create({
      data: {
        churchId: admin.churchId,
        channel: CommunicationChannel.EMAIL,
        provider: CommunicationProvider.RESEND,
        to,
        subject: 'Welcome to FaithFlow AI',
        body: renderWelcomeOrgEmail({ churchName: admin.church.name, adminUrl }),
        sendAt: new Date(),
        status: CommunicationScheduleStatus.QUEUED,
        metadata: {
          dedupeKey,
          tenantId,
          reason: 'tenant_welcome',
        } as Prisma.InputJsonValue,
      },
    });
  }
}

function normalizePaystackMetadata(event: { event: string; data?: Record<string, any> }) {
  const data = event.data ?? {};
  const customerCode = (data.customer as { customer_code?: string } | undefined)?.customer_code;
  const emailToken =
    typeof data.email_token === 'string'
      ? data.email_token
      : (data.subscription as { email_token?: string } | undefined)?.email_token;
  const subscriptionCode =
    typeof data.subscription === 'string'
      ? data.subscription
      : (data.subscription as { subscription_code?: string } | undefined)?.subscription_code;
  const planCode =
    typeof data.plan === 'string' ? data.plan : (data.plan as { plan_code?: string } | undefined)?.plan_code;

  const normalizedSubscriptionCode =
    typeof subscriptionCode === 'string' && /^SUB_[A-Za-z0-9]+$/.test(subscriptionCode) ? subscriptionCode : null;

  return {
    ...event,
    ...(normalizedSubscriptionCode ? { paystackSubscriptionCode: normalizedSubscriptionCode } : {}),
    ...(customerCode ? { paystackCustomerCode: customerCode } : {}),
    ...(planCode ? { paystackPlanCode: planCode } : {}),
    ...(emailToken ? { paystackEmailToken: emailToken } : {}),
  } as Prisma.InputJsonValue;
}

async function resolveTenantAndPlan(options: {
  tenantId?: string | null;
  clerkOrgId?: string | null;
  planCode?: string | null;
  stripePriceId?: string | null;
  paystackPlanCode?: string | null;
}) {
  const tenant = options.tenantId
    ? await prisma.tenant.findUnique({ where: { id: options.tenantId } })
    : options.clerkOrgId
      ? await prisma.tenant.findUnique({ where: { clerkOrgId: options.clerkOrgId } })
      : null;
  if (!tenant) return { tenant: null, plan: null };

  let plan = null as Awaited<ReturnType<typeof prisma.subscriptionPlan.findFirst>>;
  if (options.planCode) {
    plan = await prisma.subscriptionPlan.findUnique({ where: { code: options.planCode } });
  }
  if (!plan && options.stripePriceId) {
    plan = await prisma.subscriptionPlan.findFirst({
      where: { metadata: { path: ['stripePriceId'], equals: options.stripePriceId } },
    });
  }
  if (!plan && options.paystackPlanCode) {
    plan = await prisma.subscriptionPlan.findFirst({
      where: { metadata: { path: ['paystackPlanCode'], equals: options.paystackPlanCode } },
    });
  }
  if (!plan) {
    plan = await prisma.subscriptionPlan.findFirst({
      where: { isDefault: true, isActive: true },
    });
  }

  return { tenant, plan };
}

async function upsertSubscription(input: {
  tenantId: string;
  planId: string;
  provider: SubscriptionProvider;
  providerRef: string;
  status: TenantSubscriptionStatus;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  trialEndsAt?: Date | null;
  canceledAt?: Date | null;
  cancelAtPeriodEnd?: boolean | null;
  metadata?: Prisma.InputJsonValue;
}) {
  const existing = await prisma.tenantSubscription.findFirst({
    where: { provider: input.provider, providerRef: input.providerRef },
  });

  if (existing) {
    return prisma.tenantSubscription.update({
      where: { id: existing.id },
      data: {
        planId: input.planId,
        status: input.status,
        currentPeriodStart: input.currentPeriodStart ?? undefined,
        currentPeriodEnd: input.currentPeriodEnd ?? undefined,
        trialEndsAt: input.trialEndsAt ?? undefined,
        canceledAt: input.canceledAt ?? undefined,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? undefined,
        metadata: input.metadata,
      },
    });
  }

  return prisma.tenantSubscription.create({
    data: {
      tenantId: input.tenantId,
      planId: input.planId,
      status: input.status,
      provider: input.provider,
      providerRef: input.providerRef,
      startsAt: input.currentPeriodStart ?? new Date(),
      currentPeriodStart: input.currentPeriodStart ?? undefined,
      currentPeriodEnd: input.currentPeriodEnd ?? undefined,
      trialEndsAt: input.trialEndsAt ?? undefined,
      canceledAt: input.canceledAt ?? undefined,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      metadata: input.metadata,
    },
  });
}

export async function handlePlatformStripeWebhook(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string,
  stripeSecretKey: string
) {
  const stripe = new Stripe(stripeSecretKey);
  const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  const idempotency = await beginWebhookProcessing({
    provider: WebhookProvider.STRIPE_PLATFORM,
    externalEventId: event.id,
    eventType: event.type,
    payload,
  });
  if (idempotency.duplicate) {
    return { ok: true, duplicate: true, event: event.type };
  }

  try {
    let result:
      | { ok: true; skipped: true; reason: string }
      | { ok: true; provider: 'stripe'; event: string; subscriptionId: string }
      | { ok: true; ignored: true; event: string };

    if (event.type.startsWith('customer.subscription.')) {
      const subscription = event.data.object as Stripe.Subscription;
      const metadata = subscription.metadata ?? {};
      const primaryItem = subscription.items.data[0];
      const priceId =
        primaryItem?.price && typeof primaryItem.price !== 'string'
          ? primaryItem.price.id
          : null;
      const currentPeriodStart = primaryItem?.current_period_start ?? null;
      const currentPeriodEnd = primaryItem?.current_period_end ?? null;

      const { tenant, plan } = await resolveTenantAndPlan({
        tenantId: metadata.tenantId ?? null,
        clerkOrgId: metadata.clerkOrgId ?? null,
        planCode: metadata.planCode ?? null,
        stripePriceId: priceId,
      });

      if (!tenant || !plan) {
        result = { ok: true, skipped: true, reason: 'tenant_or_plan_not_found' };
      } else {
        const status = mapStripeStatus(subscription.status);
        const record = await upsertSubscription({
          tenantId: tenant.id,
          planId: plan.id,
          provider: SubscriptionProvider.STRIPE,
          providerRef: subscription.id,
          status,
          currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart * 1000) : null,
          currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
          trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
          canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
          cancelAtPeriodEnd: subscription.cancel_at_period_end ?? null,
          metadata: normalizeStripeSubscriptionMetadata(subscription),
        });

        await recordAuditLog({
          tenantId: tenant.id,
          actorType: AuditActorType.WEBHOOK,
          action: 'platform.subscription.synced_stripe',
          targetType: 'TenantSubscription',
          targetId: record.id,
          metadata: { eventType: event.type, stripeSubscriptionId: subscription.id, status: record.status },
        });

        if (record.status === TenantSubscriptionStatus.ACTIVE || record.status === TenantSubscriptionStatus.TRIALING) {
          await queueTenantWelcomeEmail(tenant.id);
        }

        result = { ok: true, provider: 'stripe', event: event.type, subscriptionId: record.id };
      }
    } else if (event.type === 'invoice.payment_failed' || event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null };
      const subscriptionRef = invoice.subscription ?? null;
      if (!subscriptionRef) {
        result = { ok: true, skipped: true, reason: 'missing_subscription' };
      } else {
        const current = await prisma.tenantSubscription.findFirst({
          where: { provider: SubscriptionProvider.STRIPE, providerRef: subscriptionRef },
        });
        if (!current) {
          result = { ok: true, skipped: true, reason: 'subscription_not_found' };
        } else {
          const nextStatus =
            event.type === 'invoice.payment_failed' ? TenantSubscriptionStatus.PAST_DUE : TenantSubscriptionStatus.ACTIVE;

          const updated = await prisma.tenantSubscription.update({
            where: { id: current.id },
            data: {
              status: nextStatus,
              metadata: normalizeStripeInvoiceMetadata(invoice),
            },
          });

          await recordAuditLog({
            tenantId: updated.tenantId,
            actorType: AuditActorType.WEBHOOK,
            action: 'platform.subscription.invoice_update',
            targetType: 'TenantSubscription',
            targetId: updated.id,
            metadata: { eventType: event.type, status: updated.status, stripeSubscriptionId: subscriptionRef },
          });

          result = { ok: true, provider: 'stripe', event: event.type, subscriptionId: updated.id };
        }
      }
    } else {
      result = { ok: true, ignored: true, event: event.type };
    }

    await markWebhookProcessed({
      recordId: idempotency.recordId!,
      ...(result && 'subscriptionId' in result
        ? {
            result: {
              event: result.event,
              subscriptionId: result.subscriptionId,
              provider: 'stripe',
            } as Prisma.InputJsonValue,
          }
        : { result: { event: event.type } as Prisma.InputJsonValue }),
    });

    return result;
  } catch (error) {
    await markWebhookFailed({ recordId: idempotency.recordId!, error, result: { event: event.type } as Prisma.InputJsonValue });
    throw error;
  }
}

export async function handlePlatformPaystackWebhook(payload: string, signature: string, paystackSecret: string) {
  const digest = crypto.createHmac('sha512', paystackSecret).update(payload).digest('hex');
  if (digest !== signature) {
    throw new Error('Invalid Paystack signature');
  }

  const event = JSON.parse(payload) as {
    event: string;
    data?: Record<string, any>;
  };

  const data = event.data ?? {};
  const metadata = (data.metadata as Record<string, any> | undefined) ?? {};
  const subscriptionCode =
    typeof data.subscription === 'string'
      ? data.subscription
      : (data.subscription as { subscription_code?: string } | undefined)?.subscription_code;
  const planCode =
    typeof data.plan === 'string' ? data.plan : (data.plan as { plan_code?: string } | undefined)?.plan_code;
  const eventId = buildWebhookExternalEventId([
    event.event,
    data.id,
    data.reference,
    subscriptionCode,
    planCode,
    hashWebhookPayload(payload).slice(0, 16),
  ]);
  const idempotency = await beginWebhookProcessing({
    provider: WebhookProvider.PAYSTACK_PLATFORM,
    externalEventId: eventId,
    eventType: event.event,
    payload,
  });
  if (idempotency.duplicate) {
    return { ok: true, duplicate: true, event: event.event };
  }

  try {
    let result:
      | { ok: true; skipped: true; reason: string }
      | { ok: true; provider: 'paystack'; event: string; subscriptionId: string };

    if (!subscriptionCode && !planCode) {
      result = { ok: true, skipped: true, reason: 'missing_subscription_refs' };
    } else {
      const { tenant, plan } = await resolveTenantAndPlan({
        tenantId: metadata.tenantId ?? null,
        clerkOrgId: metadata.clerkOrgId ?? null,
        planCode: metadata.planCode ?? null,
        paystackPlanCode: planCode ?? null,
      });
      if (!tenant || !plan) {
        result = { ok: true, skipped: true, reason: 'tenant_or_plan_not_found' };
      } else {
        const status =
          event.event === 'subscription.disable'
            ? TenantSubscriptionStatus.CANCELED
            : mapPaystackStatus((data.status as string | undefined) ?? 'active');

        const providerRef = subscriptionCode ?? planCode!;
        const record = await upsertSubscription({
          tenantId: tenant.id,
          planId: plan.id,
          provider: SubscriptionProvider.PAYSTACK,
          providerRef,
          status,
          currentPeriodEnd: data.next_payment_date ? new Date(data.next_payment_date as string) : null,
          canceledAt: event.event === 'subscription.disable' ? new Date() : null,
          metadata: normalizePaystackMetadata(event),
        });

        const planChangeFrom =
          typeof metadata.planChangeFrom === 'string' && metadata.planChangeFrom.trim().length
            ? metadata.planChangeFrom.trim()
            : null;

        if (planChangeFrom && event.event !== 'subscription.disable') {
          // Best-effort: if this checkout was started as a plan change, disable any older active Paystack
          // subscriptions to prevent double billing. This requires Paystack's email_token.
          const previousSubs = await prisma.tenantSubscription.findMany({
            where: {
              tenantId: tenant.id,
              provider: SubscriptionProvider.PAYSTACK,
              status: { in: [TenantSubscriptionStatus.TRIALING, TenantSubscriptionStatus.ACTIVE, TenantSubscriptionStatus.PAST_DUE, TenantSubscriptionStatus.PAUSED] },
              id: { not: record.id },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          });

          for (const previous of previousSubs) {
            const previousMeta = (previous.metadata ?? {}) as Record<string, any>;
            const subscriptionCode = typeof previousMeta.paystackSubscriptionCode === 'string' ? previousMeta.paystackSubscriptionCode : null;
            const emailToken = typeof previousMeta.paystackEmailToken === 'string' ? previousMeta.paystackEmailToken : null;
            if (!subscriptionCode || !emailToken) continue;

            try {
              const response = await fetch('https://api.paystack.co/subscription/disable', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${paystackSecret}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code: subscriptionCode, token: emailToken }),
              });

              if (response.ok) {
                await prisma.tenantSubscription.update({
                  where: { id: previous.id },
                  data: { status: TenantSubscriptionStatus.CANCELED, canceledAt: new Date(), cancelAtPeriodEnd: false },
                });
              }

              await recordAuditLog({
                tenantId: tenant.id,
                actorType: AuditActorType.SYSTEM,
                action: 'platform.subscription.plan_change_paystack_disable_attempt',
                targetType: 'TenantSubscription',
                targetId: previous.id,
                metadata: {
                  fromPlan: planChangeFrom,
                  toPlan: plan.code,
                  subscriptionCode,
                  ok: response.ok,
                },
              });
            } catch (error) {
              await recordAuditLog({
                tenantId: tenant.id,
                actorType: AuditActorType.SYSTEM,
                action: 'platform.subscription.plan_change_paystack_disable_attempt',
                targetType: 'TenantSubscription',
                targetId: previous.id,
                metadata: {
                  fromPlan: planChangeFrom,
                  toPlan: plan.code,
                  subscriptionCode,
                  ok: false,
                  error: error instanceof Error ? error.message : 'disable_failed',
                },
              });
            }
          }
        }

        await recordAuditLog({
          tenantId: tenant.id,
          actorType: AuditActorType.WEBHOOK,
          action: 'platform.subscription.synced_paystack',
          targetType: 'TenantSubscription',
          targetId: record.id,
          metadata: { eventType: event.event, status: record.status, reference: record.providerRef },
        });

        if (record.status === TenantSubscriptionStatus.ACTIVE || record.status === TenantSubscriptionStatus.TRIALING) {
          await queueTenantWelcomeEmail(tenant.id);
        }

        result = { ok: true, provider: 'paystack', event: event.event, subscriptionId: record.id };
      }
    }

    await markWebhookProcessed({
      recordId: idempotency.recordId!,
      result:
        'subscriptionId' in result
          ? ({
              event: result.event,
              provider: 'paystack',
              subscriptionId: result.subscriptionId,
            } as Prisma.InputJsonValue)
          : ({ event: event.event, reason: result.reason } as Prisma.InputJsonValue),
    });
    return result;
  } catch (error) {
    await markWebhookFailed({
      recordId: idempotency.recordId!,
      error,
      result: { event: event.event } as Prisma.InputJsonValue,
    });
    throw error;
  }
}
