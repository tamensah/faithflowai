import Stripe from 'stripe';
import { TRPCError } from '@trpc/server';
import { createClerkClient } from '@clerk/backend';
import {
  AuditActorType,
  PaymentProvider,
  Prisma,
  TenantSubscriptionStatus,
  UserRole,
  prisma,
} from '@faithflow-ai/database';
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { recordAuditLog } from '../audit';

const clerk = process.env.CLERK_SECRET_KEY ? createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }) : null;

const activeStatuses = [
  TenantSubscriptionStatus.TRIALING,
  TenantSubscriptionStatus.ACTIVE,
  TenantSubscriptionStatus.PAST_DUE,
  TenantSubscriptionStatus.PAUSED,
] as const;

const baselinePlans = [
  {
    code: 'starter',
    name: 'Starter',
    description: 'For small churches getting started with digital operations.',
    currency: 'USD',
    interval: 'MONTHLY' as const,
    amountMinor: 4900,
    isDefault: true,
    metadata: {
      target: 'small churches',
      trialDays: 14,
    },
    features: [
      { key: 'max_members', enabled: true, limit: 500 },
      { key: 'max_campuses', enabled: true, limit: 1 },
      { key: 'ai_insights', enabled: false, limit: null },
      { key: 'membership_enabled', enabled: true, limit: null },
      { key: 'events_enabled', enabled: true, limit: null },
      { key: 'finance_enabled', enabled: true, limit: null },
      { key: 'multi_campus_enabled', enabled: true, limit: null },
      { key: 'facility_management_enabled', enabled: false, limit: null },
      { key: 'pastoral_care_enabled', enabled: false, limit: null },
      { key: 'content_library_enabled', enabled: true, limit: null },
      { key: 'streaming_enabled', enabled: false, limit: null },
      { key: 'support_center_enabled', enabled: true, limit: null },
      { key: 'custom_domain_enabled', enabled: false, limit: null },
      { key: 'max_events_monthly', enabled: true, limit: 30 },
      { key: 'max_expenses_monthly', enabled: true, limit: 80 },
    ],
  },
  {
    code: 'growth',
    name: 'Growth',
    description: 'For growing churches with multiple teams and workflows.',
    currency: 'USD',
    interval: 'MONTHLY' as const,
    amountMinor: 14900,
    isDefault: false,
    metadata: {
      target: 'growing churches',
      trialDays: 14,
    },
    features: [
      { key: 'max_members', enabled: true, limit: 5000 },
      { key: 'max_campuses', enabled: true, limit: 5 },
      { key: 'ai_insights', enabled: true, limit: null },
      { key: 'membership_enabled', enabled: true, limit: null },
      { key: 'events_enabled', enabled: true, limit: null },
      { key: 'finance_enabled', enabled: true, limit: null },
      { key: 'multi_campus_enabled', enabled: true, limit: null },
      { key: 'facility_management_enabled', enabled: true, limit: null },
      { key: 'pastoral_care_enabled', enabled: true, limit: null },
      { key: 'content_library_enabled', enabled: true, limit: null },
      { key: 'streaming_enabled', enabled: true, limit: null },
      { key: 'support_center_enabled', enabled: true, limit: null },
      { key: 'custom_domain_enabled', enabled: true, limit: null },
      { key: 'max_events_monthly', enabled: true, limit: 200 },
      { key: 'max_expenses_monthly', enabled: true, limit: 500 },
    ],
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    description: 'For multi-campus and diaspora networks with advanced controls.',
    currency: 'USD',
    interval: 'MONTHLY' as const,
    amountMinor: 0,
    isDefault: false,
    metadata: {
      target: 'multi-campus and diaspora networks',
      trialDays: 0,
    },
    features: [
      { key: 'max_members', enabled: true, limit: null },
      { key: 'max_campuses', enabled: true, limit: null },
      { key: 'ai_insights', enabled: true, limit: null },
      { key: 'membership_enabled', enabled: true, limit: null },
      { key: 'events_enabled', enabled: true, limit: null },
      { key: 'finance_enabled', enabled: true, limit: null },
      { key: 'multi_campus_enabled', enabled: true, limit: null },
      { key: 'facility_management_enabled', enabled: true, limit: null },
      { key: 'pastoral_care_enabled', enabled: true, limit: null },
      { key: 'content_library_enabled', enabled: true, limit: null },
      { key: 'streaming_enabled', enabled: true, limit: null },
      { key: 'support_center_enabled', enabled: true, limit: null },
      { key: 'custom_domain_enabled', enabled: true, limit: null },
      { key: 'max_events_monthly', enabled: true, limit: null },
      { key: 'max_expenses_monthly', enabled: true, limit: null },
    ],
  },
];

const checkoutInput = z.object({
  planCode: z.string().trim().min(2).max(64),
  provider: z.nativeEnum(PaymentProvider),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

function readPlanMetaString(meta: Record<string, unknown>, key: string) {
  const value = meta[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readPlanMetaInt(meta: Record<string, unknown>, key: string) {
  const value = meta[key];
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function metadataValue(meta: Prisma.JsonValue | null | undefined, key: string) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const value = (meta as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

function extractStripeCustomerId(meta: Prisma.JsonValue | null | undefined) {
  const direct = metadataValue(meta, 'stripeCustomerId');
  if (direct) return direct;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const customer = (meta as Record<string, unknown>).customer;
  if (typeof customer === 'string') return customer;
  if (customer && typeof customer === 'object' && !Array.isArray(customer)) {
    const id = (customer as Record<string, unknown>).id;
    if (typeof id === 'string') return id;
  }
  return null;
}

function extractPaystackCustomerCode(meta: Prisma.JsonValue | null | undefined) {
  const direct = metadataValue(meta, 'paystackCustomerCode') ?? metadataValue(meta, 'customer_code');
  if (direct) return direct;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const customer = (meta as Record<string, unknown>).customer;
  if (customer && typeof customer === 'object' && !Array.isArray(customer)) {
    const code = (customer as Record<string, unknown>).customer_code;
    if (typeof code === 'string') return code;
  }
  return null;
}

async function requireTenantAdmin(tenantId: string, clerkUserId: string) {
  const existingMembership = await prisma.staffMembership.findFirst({
    where: {
      role: UserRole.ADMIN,
      user: { clerkUserId },
      church: { organization: { tenantId } },
    },
    include: { church: true, user: true },
  });

  if (existingMembership) {
    return existingMembership;
  }

  const staffCount = await prisma.staffMembership.count({
    where: { church: { organization: { tenantId } } },
  });
  if (staffCount > 0) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Tenant admin access required' });
  }

  const defaultChurch = await prisma.church.findFirst({
    where: { organization: { tenantId } },
    orderBy: { createdAt: 'asc' },
  });
  if (!defaultChurch) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'No church found for tenant' });
  }

  const email = (await getClerkPrimaryEmail(clerkUserId)) ?? `unknown+${clerkUserId}@faithflow.local`;
  const user = await prisma.user.upsert({
    where: { clerkUserId },
    update: {
      email,
      role: UserRole.ADMIN,
      name: email.split('@')[0],
    },
    create: {
      clerkUserId,
      email,
      role: UserRole.ADMIN,
      name: email.split('@')[0],
    },
  });

  const membership = await prisma.staffMembership.upsert({
    where: { userId_churchId: { userId: user.id, churchId: defaultChurch.id } },
    update: { role: UserRole.ADMIN },
    create: {
      userId: user.id,
      churchId: defaultChurch.id,
      role: UserRole.ADMIN,
    },
    include: { church: true, user: true },
  });

  await recordAuditLog({
    tenantId,
    actorType: AuditActorType.USER,
    actorId: clerkUserId,
    action: 'billing.self_serve.bootstrap_admin',
    targetType: 'StaffMembership',
    targetId: membership.id,
    metadata: { churchId: defaultChurch.id },
  });

  return membership;
}

async function getClerkPrimaryEmail(clerkUserId: string) {
  if (!clerk) return null;
  const user = await clerk.users.getUser(clerkUserId);
  const primary = user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId);
  return primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
}

async function getActiveSubscription(tenantId: string) {
  return prisma.tenantSubscription.findFirst({
    where: {
      tenantId,
      status: { in: activeStatuses as unknown as TenantSubscriptionStatus[] },
    },
    include: { plan: { include: { features: { orderBy: { key: 'asc' } } } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function ensureBaselinePlans() {
  const hasDefault = (await prisma.subscriptionPlan.count({ where: { isDefault: true } })) > 0;
  const existingCodes = await prisma.subscriptionPlan.findMany({
    where: { code: { in: baselinePlans.map((plan) => plan.code) } },
    select: { code: true },
  });
  const codeSet = new Set(existingCodes.map((plan) => plan.code));
  const missingPlans = baselinePlans.filter((plan) => !codeSet.has(plan.code));
  if (!missingPlans.length) return;

  await prisma.$transaction(async (tx) => {
    let defaultAssigned = hasDefault;
    for (const plan of missingPlans) {
      const shouldBeDefault = plan.isDefault && !defaultAssigned;
      const created = await tx.subscriptionPlan.create({
        data: {
          code: plan.code,
          name: plan.name,
          description: plan.description,
          currency: plan.currency,
          interval: plan.interval,
          amountMinor: plan.amountMinor,
          isActive: true,
          isDefault: shouldBeDefault,
          metadata: plan.metadata as Prisma.InputJsonValue,
        },
      });
      if (shouldBeDefault) defaultAssigned = true;

      await tx.subscriptionPlanFeature.createMany({
        data: plan.features.map((feature) => ({
          planId: created.id,
          key: feature.key,
          enabled: feature.enabled,
          limit: feature.limit,
        })),
      });
    }
  });
}

async function listActivePlans() {
  await ensureBaselinePlans();
  return prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    include: { features: { orderBy: { key: 'asc' } } },
    orderBy: [{ amountMinor: 'asc' }, { createdAt: 'asc' }],
  });
}

export const billingRouter = router({
  catalog: protectedProcedure.query(async () => listActivePlans()),

  plans: protectedProcedure.query(async ({ ctx }) => {
    await requireTenantAdmin(ctx.tenantId!, ctx.userId!);
    return listActivePlans();
  }),

  currentSubscription: protectedProcedure.query(async ({ ctx }) => {
    await requireTenantAdmin(ctx.tenantId!, ctx.userId!);
    return getActiveSubscription(ctx.tenantId!);
  }),

  startCheckout: protectedProcedure.input(checkoutInput).mutation(async ({ ctx, input }) => {
    await requireTenantAdmin(ctx.tenantId!, ctx.userId!);
    if (input.provider === PaymentProvider.MANUAL) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Manual provider is not supported for billing checkout' });
    }

    await ensureBaselinePlans();
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { code: input.planCode },
    });
    if (!plan || !plan.isActive) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found or inactive' });
    }

    const email = await getClerkPrimaryEmail(ctx.userId!);
    const successUrl = input.successUrl ?? `${process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001'}/billing`;
    const cancelUrl = input.cancelUrl ?? successUrl;
    const planMeta = (plan.metadata ?? {}) as Record<string, unknown>;
    const trialDays = readPlanMetaInt(planMeta, 'trialDays');

    if (input.provider === PaymentProvider.STRIPE) {
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Stripe is not configured' });
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const stripePriceId = typeof planMeta.stripePriceId === 'string' ? planMeta.stripePriceId : null;

      const lineItem = stripePriceId
        ? ({ price: stripePriceId, quantity: 1 } satisfies Stripe.Checkout.SessionCreateParams.LineItem)
        : ({
            quantity: 1,
            price_data: {
              currency: plan.currency.toLowerCase(),
              unit_amount: plan.amountMinor,
              recurring: {
                interval: plan.interval === 'YEARLY' ? 'year' : 'month',
              },
              product_data: {
                name: `FaithFlow ${plan.name}`,
                description: plan.description ?? undefined,
              },
            },
          } satisfies Stripe.Checkout.SessionCreateParams.LineItem);

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: email ?? undefined,
        line_items: [lineItem],
        subscription_data: {
          ...(trialDays ? { trial_period_days: trialDays } : {}),
          metadata: {
            tenantId: ctx.tenantId!,
            clerkOrgId: ctx.clerkOrgId ?? '',
            planCode: plan.code,
            ...(trialDays ? { trialDays: String(trialDays) } : {}),
          },
        },
        metadata: {
          tenantId: ctx.tenantId!,
          clerkOrgId: ctx.clerkOrgId ?? '',
          planCode: plan.code,
          ...(trialDays ? { trialDays: String(trialDays) } : {}),
        },
      });

      if (!session.url) {
        throw new TRPCError({ code: 'BAD_GATEWAY', message: 'Stripe checkout URL missing' });
      }

      await recordAuditLog({
        tenantId: ctx.tenantId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'billing.self_serve.checkout_started',
        targetType: 'SubscriptionPlan',
        targetId: plan.id,
        metadata: { provider: input.provider, planCode: plan.code, sessionId: session.id },
      });

      return {
        provider: PaymentProvider.STRIPE,
        checkoutUrl: session.url,
        reference: session.id,
      };
    }

    if (!process.env.PAYSTACK_SECRET_KEY) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Paystack is not configured' });
    }
    if (!email) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Primary email is required for Paystack checkout' });
    }
    const paystackPlanCode =
      (trialDays ? readPlanMetaString(planMeta, 'paystackTrialPlanCode') : null) ??
      readPlanMetaString(planMeta, 'paystackPlanCode');
    if (!paystackPlanCode) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: trialDays
          ? 'Plan is missing paystackPlanCode/paystackTrialPlanCode metadata'
          : 'Plan is missing paystackPlanCode metadata',
      });
    }

    const reference = `sub_${ctx.tenantId}_${Date.now()}`;
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        plan: paystackPlanCode,
        reference,
        callback_url: successUrl,
        metadata: {
          tenantId: ctx.tenantId,
          clerkOrgId: ctx.clerkOrgId,
          planCode: plan.code,
          ...(trialDays ? { trialDays, paystackTrial: true } : {}),
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new TRPCError({ code: 'BAD_GATEWAY', message: `Paystack checkout failed: ${text}` });
    }

    const payload = (await response.json()) as {
      status: boolean;
      message: string;
      data?: { authorization_url?: string; reference?: string };
    };
    if (!payload.status || !payload.data?.authorization_url) {
      throw new TRPCError({ code: 'BAD_GATEWAY', message: payload.message || 'Paystack checkout failed' });
    }

    await recordAuditLog({
      tenantId: ctx.tenantId,
      actorType: AuditActorType.USER,
      actorId: ctx.userId,
      action: 'billing.self_serve.checkout_started',
      targetType: 'SubscriptionPlan',
      targetId: plan.id,
      metadata: { provider: input.provider, planCode: plan.code, reference: payload.data.reference ?? reference },
    });

    return {
      provider: PaymentProvider.PAYSTACK,
      checkoutUrl: payload.data.authorization_url,
      reference: payload.data.reference ?? reference,
    };
  }),

  createPortalSession: protectedProcedure
    .input(z.object({ returnUrl: z.string().url().optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.tenantId!, ctx.userId!);
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Stripe is not configured' });
      }

      const subscription = await prisma.tenantSubscription.findFirst({
        where: {
          tenantId: ctx.tenantId!,
          provider: 'STRIPE',
          status: { in: activeStatuses as unknown as TenantSubscriptionStatus[] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!subscription) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No Stripe subscription found for tenant' });
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      let customerId = extractStripeCustomerId(subscription.metadata);

      if (!customerId && subscription.providerRef) {
        const providerSub = await stripe.subscriptions.retrieve(subscription.providerRef);
        customerId = typeof providerSub.customer === 'string' ? providerSub.customer : providerSub.customer?.id ?? null;
      }
      if (!customerId) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Stripe customer could not be resolved. Sync webhooks first.',
        });
      }

      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: input.returnUrl ?? `${process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001'}/billing`,
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'billing.self_serve.portal_opened',
        targetType: 'TenantSubscription',
        targetId: subscription.id,
        metadata: { customerId },
      });

      return {
        provider: PaymentProvider.STRIPE,
        url: portal.url,
      };
    }),

  invoices: protectedProcedure
    .input(
      z
        .object({
          provider: z.nativeEnum(PaymentProvider).optional(),
          limit: z.number().int().min(1).max(50).default(20),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.tenantId!, ctx.userId!);
      const selectedProvider = input?.provider;
      const limit = input?.limit ?? 20;

      const activeSub = await getActiveSubscription(ctx.tenantId!);
      const provider = selectedProvider ?? activeSub?.provider ?? PaymentProvider.STRIPE;

      if (provider === PaymentProvider.STRIPE) {
        if (!process.env.STRIPE_SECRET_KEY) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Stripe is not configured' });
        }
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const stripeSub = await prisma.tenantSubscription.findFirst({
          where: { tenantId: ctx.tenantId!, provider: PaymentProvider.STRIPE },
          orderBy: { createdAt: 'desc' },
        });
        const customerId = extractStripeCustomerId(stripeSub?.metadata);
        if (!customerId) return { provider, invoices: [] };

        const invoices = await stripe.invoices.list({ customer: customerId, limit });
        return {
          provider,
          invoices: invoices.data.map((invoice) => ({
            id: invoice.id,
            number: invoice.number,
            status: invoice.status,
            currency: invoice.currency?.toUpperCase() ?? 'USD',
            amountDue: invoice.amount_due,
            amountPaid: invoice.amount_paid,
            hostedInvoiceUrl: invoice.hosted_invoice_url,
            invoicePdf: invoice.invoice_pdf,
            periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
            periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
            dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
            createdAt: new Date(invoice.created * 1000),
          })),
        };
      }

      if (provider === PaymentProvider.PAYSTACK) {
        if (!process.env.PAYSTACK_SECRET_KEY) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Paystack is not configured' });
        }
        const paystackSub = await prisma.tenantSubscription.findFirst({
          where: { tenantId: ctx.tenantId!, provider: PaymentProvider.PAYSTACK },
          orderBy: { createdAt: 'desc' },
        });
        const customerCode = extractPaystackCustomerCode(paystackSub?.metadata);
        if (!customerCode) return { provider, invoices: [] };

        const response = await fetch(
          `https://api.paystack.co/transaction?customer=${encodeURIComponent(customerCode)}&perPage=${limit}&page=1`,
          {
            headers: {
              Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            },
          }
        );
        if (!response.ok) {
          const text = await response.text();
          throw new TRPCError({ code: 'BAD_GATEWAY', message: `Paystack invoice query failed: ${text}` });
        }
        const payload = (await response.json()) as {
          status: boolean;
          data?: Array<Record<string, unknown>>;
        };

        const invoices = (payload.data ?? []).map((entry) => {
          const amount = typeof entry.amount === 'number' ? entry.amount : Number(entry.amount ?? 0);
          const createdAt = typeof entry.paid_at === 'string' ? entry.paid_at : entry.created_at;
          return {
            id: String(entry.id ?? entry.reference ?? ''),
            number: String(entry.reference ?? entry.id ?? ''),
            status: String(entry.status ?? 'unknown'),
            currency: String(entry.currency ?? 'NGN').toUpperCase(),
            amountDue: amount,
            amountPaid: amount,
            hostedInvoiceUrl: null,
            invoicePdf: null,
            periodStart: null,
            periodEnd: null,
            dueDate: null,
            createdAt: createdAt ? new Date(String(createdAt)) : null,
          };
        });

        return { provider, invoices };
      }

      return { provider, invoices: [] };
    }),
});
