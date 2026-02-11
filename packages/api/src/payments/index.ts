import crypto from 'crypto';
import Stripe from 'stripe';
import { TRPCError } from '@trpc/server';
import {
  AuditActorType,
  Prisma,
  prisma,
  PaymentProvider,
  PaymentIntentStatus,
  DonationStatus,
  TicketOrderStatus,
  WebhookProvider,
} from '@faithflow-ai/database';
import { emitRealtimeEvent } from '../realtime';
import { ensureDonationReceipt } from '../receipts';
import { recordAuditLog } from '../audit';
import type { CheckoutInput, RecurringCheckoutInput } from './inputs';
import {
  beginWebhookProcessing,
  buildWebhookExternalEventId,
  hashWebhookPayload,
  markWebhookFailed,
  markWebhookProcessed,
} from '../webhook-idempotency';

type CheckoutResult = {
  checkoutUrl: string;
  paymentIntentId: string;
  donationId: string;
  provider: PaymentProvider;
  providerRef: string;
};

type CreateCheckoutInput = CheckoutInput & { tenantId?: string | null };
type CreateRecurringCheckoutInput = RecurringCheckoutInput & { tenantId?: string | null };
type CreateTicketCheckoutInput = {
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  provider: PaymentProvider;
  memberId?: string;
  purchaserName?: string;
  purchaserEmail?: string;
  purchaserPhone?: string;
  successUrl?: string;
  cancelUrl?: string;
};

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND']);
const PAYSTACK_CURRENCIES = new Set(['NGN', 'USD', 'GHS', 'ZAR', 'KES', 'XOF']);
const PAYSTACK_MINIMUMS: Record<string, number> = {
  NGN: 50,
  USD: 2,
  GHS: 0.1,
  ZAR: 1,
  KES: 3,
  XOF: 1,
};
const PAYSTACK_CURRENCY_COUNTRIES: Record<string, string[]> = {
  NGN: ['NG'],
  USD: ['NG', 'KE'],
  GHS: ['GH'],
  ZAR: ['ZA'],
  KES: ['KE'],
  XOF: ['CI'],
};

let stripeClient: Stripe | null = null;
let stripeKey: string | null = null;

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Stripe is not configured' });
  }
  if (!stripeClient || stripeKey !== key) {
    stripeClient = new Stripe(key);
    stripeKey = key;
  }
  return stripeClient;
}

function toMinorUnits(amount: number, currency: string) {
  const factor = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 100;
  return Math.round(amount * factor);
}

function fromMinorUnits(amount: number, currency: string) {
  const factor = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 100;
  return amount / factor;
}

function nextRecurringChargeAt(interval: RecurringCheckoutInput['interval'], from: Date) {
  const next = new Date(from);
  switch (interval) {
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

function ensurePaystackCurrency(amount: number, currency: string, countryCode?: string | null) {
  if (!PAYSTACK_CURRENCIES.has(currency)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Paystack does not support currency ${currency}`,
    });
  }

  const normalizedCountry = countryCode?.toUpperCase();
  const allowedCountries = PAYSTACK_CURRENCY_COUNTRIES[currency];
  if (normalizedCountry && allowedCountries && !allowedCountries.includes(normalizedCountry)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Paystack ${currency} is only available for ${allowedCountries.join(', ')} businesses`,
    });
  }

  const minimum = PAYSTACK_MINIMUMS[currency];
  if (minimum && amount < minimum) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Paystack minimum for ${currency} is ${minimum}`,
    });
  }
}

async function resolveChurch(input: CreateCheckoutInput) {
  if (!input.churchId && !input.churchSlug) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'churchId or churchSlug is required' });
  }

  const church = await prisma.church.findFirst({
    where: {
      ...(input.churchId ? { id: input.churchId } : {}),
      ...(input.churchSlug ? { slug: input.churchSlug } : {}),
    },
    include: { organization: true },
  });

  if (!church) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
  }

  if (input.tenantId && church.organization.tenantId !== input.tenantId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Church not found' });
  }

  return church;
}

async function createStripeCheckout(input: CreateCheckoutInput, paymentIntentId: string) {
  if (!input.successUrl) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'successUrl is required for Stripe' });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: paymentIntentId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl ?? input.successUrl,
    customer_email: input.donorEmail ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: toMinorUnits(input.amount, input.currency),
          product_data: {
            name: input.fundId ? 'Fund Donation' : 'Donation',
          },
        },
      },
    ],
    payment_intent_data: {
      metadata: {
        paymentIntentId,
        churchId: input.churchId ?? '',
        isAnonymous: String(input.isAnonymous ?? false),
      },
    },
    metadata: {
      paymentIntentId,
      churchId: input.churchId ?? '',
      fundId: input.fundId ?? '',
      campaignId: input.campaignId ?? '',
      fundraiserPageId: input.fundraiserPageId ?? '',
      isAnonymous: String(input.isAnonymous ?? false),
    },
  } as Stripe.Checkout.SessionCreateParams);

  if (!session.url) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Stripe checkout URL missing' });
  }

  return { checkoutUrl: session.url, providerRef: session.id };
}

function mapStripeInterval(interval: RecurringCheckoutInput['interval']) {
  if (interval === 'WEEKLY') return { interval: 'week' as const, interval_count: 1 };
  if (interval === 'MONTHLY') return { interval: 'month' as const, interval_count: 1 };
  if (interval === 'QUARTERLY') return { interval: 'month' as const, interval_count: 3 };
  return { interval: 'year' as const, interval_count: 1 };
}

async function createStripeRecurringCheckout(input: CreateRecurringCheckoutInput, recurringDonationId: string) {
  if (!input.successUrl) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'successUrl is required for Stripe' });
  }

  const stripe = getStripe();
  const recurring = mapStripeInterval(input.interval);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    client_reference_id: recurringDonationId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl ?? input.successUrl,
    customer_email: input.donorEmail ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: toMinorUnits(input.amount, input.currency),
          recurring,
          product_data: {
            name: 'Recurring Donation',
          },
        },
      },
    ],
    subscription_data: {
      metadata: {
        recurringDonationId,
        churchId: input.churchId ?? '',
      },
    },
    metadata: {
      recurringDonationId,
      churchId: input.churchId ?? '',
    },
  } as Stripe.Checkout.SessionCreateParams);

  if (!session.url) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Stripe checkout URL missing' });
  }

  return { checkoutUrl: session.url, providerRef: session.id };
}

async function createPaystackCheckout(input: CreateCheckoutInput, paymentIntentId: string, countryCode?: string | null) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Paystack is not configured' });
  }
  if (!input.donorEmail) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'donorEmail is required for Paystack' });
  }
  if (!input.successUrl) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'successUrl is required for Paystack' });
  }

  ensurePaystackCurrency(input.amount, input.currency, countryCode);

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: toMinorUnits(input.amount, input.currency),
      email: input.donorEmail,
      currency: input.currency.toUpperCase(),
      reference: paymentIntentId,
      callback_url: input.successUrl,
      metadata: {
        paymentIntentId,
        churchId: input.churchId,
        fundId: input.fundId,
        campaignId: input.campaignId,
        fundraiserPageId: input.fundraiserPageId,
        isAnonymous: input.isAnonymous ?? false,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new TRPCError({ code: 'BAD_GATEWAY', message: `Paystack error: ${text}` });
  }

  const payload = (await response.json()) as {
    status: boolean;
    message: string;
    data?: { authorization_url: string; reference: string };
  };

  if (!payload.status || !payload.data?.authorization_url || !payload.data.reference) {
    throw new TRPCError({ code: 'BAD_GATEWAY', message: payload.message || 'Paystack init failed' });
  }

  return { checkoutUrl: payload.data.authorization_url, providerRef: payload.data.reference };
}

function mapPaystackInterval(interval: RecurringCheckoutInput['interval']) {
  switch (interval) {
    case 'WEEKLY':
      return 'weekly';
    case 'MONTHLY':
      return 'monthly';
    case 'QUARTERLY':
      return 'quarterly';
    case 'YEARLY':
      return 'annually';
  }
}

async function createPaystackPlan(input: CreateRecurringCheckoutInput, recurringDonationId: string, countryCode?: string | null) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Paystack is not configured' });
  }

  ensurePaystackCurrency(input.amount, input.currency, countryCode);

  const response = await fetch('https://api.paystack.co/plan', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Recurring Donation ${recurringDonationId}`,
      interval: mapPaystackInterval(input.interval),
      amount: toMinorUnits(input.amount, input.currency),
      currency: input.currency.toUpperCase(),
      description: `FaithFlow recurring donation for church ${input.churchId ?? input.churchSlug ?? ''}`,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new TRPCError({ code: 'BAD_GATEWAY', message: `Paystack plan error: ${text}` });
  }

  const payload = (await response.json()) as {
    status: boolean;
    message: string;
    data?: { plan_code: string };
  };

  if (!payload.status || !payload.data?.plan_code) {
    throw new TRPCError({ code: 'BAD_GATEWAY', message: payload.message || 'Paystack plan failed' });
  }

  return payload.data.plan_code;
}

async function createPaystackRecurringCheckout(
  input: CreateRecurringCheckoutInput,
  recurringDonationId: string,
  countryCode?: string | null
) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Paystack is not configured' });
  }
  if (!input.donorEmail) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'donorEmail is required for Paystack' });
  }
  if (!input.successUrl) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'successUrl is required for Paystack' });
  }

  ensurePaystackCurrency(input.amount, input.currency, countryCode);

  const planCode = await createPaystackPlan(input, recurringDonationId, countryCode);

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: toMinorUnits(input.amount, input.currency),
      email: input.donorEmail,
      currency: input.currency.toUpperCase(),
      reference: recurringDonationId,
      callback_url: input.successUrl,
      plan: planCode,
      metadata: {
        recurringDonationId,
        churchId: input.churchId,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new TRPCError({ code: 'BAD_GATEWAY', message: `Paystack error: ${text}` });
  }

  const payload = (await response.json()) as {
    status: boolean;
    message: string;
    data?: { authorization_url: string; reference: string };
  };

  if (!payload.status || !payload.data?.authorization_url || !payload.data.reference) {
    throw new TRPCError({ code: 'BAD_GATEWAY', message: payload.message || 'Paystack init failed' });
  }

  return {
    checkoutUrl: payload.data.authorization_url,
    providerRef: planCode,
    reference: payload.data.reference,
  };
}

export async function createDonationCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
  if (input.provider === PaymentProvider.MANUAL) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Manual provider is not supported for checkout' });
  }
  const church = await resolveChurch(input);
  const normalizedInput = { ...input, churchId: church.id };
  if (input.provider === PaymentProvider.PAYSTACK) {
    ensurePaystackCurrency(input.amount, input.currency, church.countryCode);
  }

  if (input.memberId) {
    const member = await prisma.member.findFirst({
      where: {
        id: input.memberId,
        churchId: church.id,
      },
    });
    if (!member) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
    }
  }

  if (input.fundId) {
    const fund = await prisma.fund.findFirst({
      where: { id: input.fundId, churchId: church.id },
    });
    if (!fund) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Fund not found' });
    }
  }

  if (input.campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: input.campaignId, churchId: church.id },
    });
    if (!campaign) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
    }
  }

  if (input.fundraiserPageId) {
    const fundraiser = await prisma.fundraiserPage.findFirst({
      where: { id: input.fundraiserPageId, churchId: church.id },
    });
    if (!fundraiser) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Fundraiser page not found' });
    }
  }

  if (input.pledgeId) {
    const pledge = await prisma.pledge.findFirst({
      where: { id: input.pledgeId, churchId: church.id },
    });
    if (!pledge) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Pledge not found' });
    }
  }

  if (input.recurringDonationId) {
    const recurring = await prisma.recurringDonation.findFirst({
      where: { id: input.recurringDonationId, churchId: church.id },
    });
    if (!recurring) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Recurring donation not found' });
    }
  }

  const paymentIntent = await prisma.paymentIntent.create({
    data: {
      churchId: church.id,
      memberId: input.memberId,
      amount: new Prisma.Decimal(input.amount),
      currency: input.currency,
      provider: input.provider,
      providerRef: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: PaymentIntentStatus.REQUIRES_ACTION,
      metadata: {
        donorName: input.donorName,
        donorEmail: input.donorEmail,
        donorPhone: input.donorPhone,
        fundId: input.fundId,
        campaignId: input.campaignId,
        pledgeId: input.pledgeId,
        recurringDonationId: input.recurringDonationId,
        churchId: church.id,
      },
    },
  });

  try {
    const { checkoutUrl, providerRef } =
      input.provider === PaymentProvider.STRIPE
        ? await createStripeCheckout(normalizedInput, paymentIntent.id)
        : await createPaystackCheckout(normalizedInput, paymentIntent.id, church.countryCode);

    const [updatedIntent, donation] = await prisma.$transaction([
      prisma.paymentIntent.update({
        where: { id: paymentIntent.id },
        data: {
          providerRef,
          checkoutUrl,
          status: PaymentIntentStatus.PROCESSING,
        },
      }),
      prisma.donation.create({
        data: {
          churchId: church.id,
          memberId: input.memberId,
          fundId: input.fundId,
          campaignId: input.campaignId,
          fundraiserPageId: input.fundraiserPageId,
          pledgeId: input.pledgeId,
          recurringDonationId: input.recurringDonationId,
          paymentIntentId: paymentIntent.id,
          amount: new Prisma.Decimal(input.amount),
          currency: input.currency,
          status: DonationStatus.PENDING,
          provider: input.provider,
          providerRef,
          isAnonymous: input.isAnonymous ?? false,
          donorName: input.donorName,
          donorEmail: input.donorEmail,
          donorPhone: input.donorPhone,
        },
      }),
    ]);

    return {
      checkoutUrl,
      paymentIntentId: updatedIntent.id,
      donationId: donation.id,
      provider: updatedIntent.provider,
      providerRef,
    };
  } catch (error) {
    await prisma.paymentIntent.update({
      where: { id: paymentIntent.id },
      data: { status: PaymentIntentStatus.FAILED },
    });
    throw error;
  }
}

export async function createTicketCheckout(input: CreateTicketCheckoutInput) {
  if (input.provider === PaymentProvider.MANUAL) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Manual provider is not supported for checkout' });
  }

  const event = await prisma.event.findFirst({
    where: { id: input.eventId },
    include: { church: true },
  });
  if (!event) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
  }

  const ticketType = await prisma.eventTicketType.findFirst({
    where: { id: input.ticketTypeId, eventId: event.id, isActive: true },
  });
  if (!ticketType) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket type not found' });
  }

  const quantity = Math.max(1, Math.min(input.quantity, 20));
  const price = Number(ticketType.price);
  const amount = price * quantity;

  if (ticketType.capacity) {
    const aggregate = await prisma.eventTicketOrder.aggregate({
      where: { ticketTypeId: ticketType.id, status: { in: [TicketOrderStatus.PAID, TicketOrderStatus.PENDING] } },
      _sum: { quantity: true },
    });
    const reserved = aggregate._sum.quantity ?? 0;
    if (reserved + quantity > ticketType.capacity) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Ticket capacity reached' });
    }
  }

  if (event.capacity) {
    const aggregate = await prisma.eventTicketOrder.aggregate({
      where: { eventId: event.id, status: { in: [TicketOrderStatus.PAID, TicketOrderStatus.PENDING] } },
      _sum: { quantity: true },
    });
    const reserved = aggregate._sum.quantity ?? 0;
    if (reserved + quantity > event.capacity) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Event capacity reached' });
    }
  }

  const order = await prisma.eventTicketOrder.create({
    data: {
      eventId: event.id,
      ticketTypeId: ticketType.id,
      memberId: input.memberId,
      quantity,
      amount: new Prisma.Decimal(amount),
      currency: ticketType.currency,
      provider: input.provider,
      status: TicketOrderStatus.PENDING,
    },
  });

  const paymentIntent = await prisma.paymentIntent.create({
    data: {
      churchId: event.churchId,
      memberId: input.memberId,
      amount: new Prisma.Decimal(amount),
      currency: ticketType.currency,
      provider: input.provider,
      providerRef: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: PaymentIntentStatus.REQUIRES_ACTION,
      metadata: {
        ticketOrderId: order.id,
        eventId: event.id,
        ticketTypeId: ticketType.id,
        quantity,
        churchId: event.churchId,
      },
    },
  });

  await prisma.eventTicketOrder.update({
    where: { id: order.id },
    data: { paymentIntentId: paymentIntent.id },
  });

  const checkoutInput: CreateCheckoutInput = {
    churchId: event.churchId,
    amount,
    currency: ticketType.currency,
    provider: input.provider,
    donorName: input.purchaserName,
    donorEmail: input.purchaserEmail,
    donorPhone: input.purchaserPhone,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
  };

  if (input.provider === PaymentProvider.PAYSTACK) {
    if (!input.purchaserEmail) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'purchaserEmail is required for Paystack' });
    }
    if (!input.successUrl) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'successUrl is required for Paystack' });
    }
    ensurePaystackCurrency(amount, ticketType.currency, event.church.countryCode);
  }

  const { checkoutUrl, providerRef } =
    input.provider === PaymentProvider.STRIPE
      ? await createStripeCheckout(checkoutInput, paymentIntent.id)
      : await createPaystackCheckout(checkoutInput, paymentIntent.id, event.church.countryCode);

  await prisma.paymentIntent.update({
    where: { id: paymentIntent.id },
    data: { providerRef, checkoutUrl, status: PaymentIntentStatus.PROCESSING },
  });

  await prisma.eventTicketOrder.update({
    where: { id: order.id },
    data: { providerRef },
  });

  return { checkoutUrl, orderId: order.id, paymentIntentId: paymentIntent.id };
}

export async function createRecurringCheckout(input: CreateRecurringCheckoutInput) {
  if (input.provider === PaymentProvider.MANUAL) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Manual provider is not supported for checkout' });
  }

  const church = await resolveChurch(input);

  const recurring = await prisma.recurringDonation.create({
    data: {
      churchId: church.id,
      memberId: input.memberId,
      amount: new Prisma.Decimal(input.amount),
      currency: input.currency,
      interval: input.interval,
      provider: input.provider,
      status: 'PAUSED',
      startAt: new Date(),
      nextChargeAt: null,
    },
  });

  try {
    if (input.provider === PaymentProvider.PAYSTACK) {
      const { checkoutUrl, providerRef } = await createPaystackRecurringCheckout(
        { ...input, churchId: church.id },
        recurring.id,
        church.countryCode
      );

      await prisma.recurringDonation.update({
        where: { id: recurring.id },
        data: { providerRef },
      });

      return {
        checkoutUrl,
        recurringDonationId: recurring.id,
      };
    }

    const { checkoutUrl, providerRef } = await createStripeRecurringCheckout(
      { ...input, churchId: church.id },
      recurring.id
    );

    await prisma.recurringDonation.update({
      where: { id: recurring.id },
      data: { providerRef },
    });

    return {
      checkoutUrl,
      recurringDonationId: recurring.id,
    };
  } catch (error) {
    await prisma.recurringDonation.update({
      where: { id: recurring.id },
      data: { status: 'CANCELED' },
    });
    throw error;
  }
}

async function markPaymentSucceeded(paymentIntentIdOrRef: string, providerRef?: string) {
  const paymentIntent =
    (await prisma.paymentIntent.findUnique({
      where: { id: paymentIntentIdOrRef },
    })) ??
    (await prisma.paymentIntent.findFirst({
      where: { providerRef: paymentIntentIdOrRef },
    }));

  if (!paymentIntent) {
    return;
  }

  const updatedIntent =
    paymentIntent.status === PaymentIntentStatus.SUCCEEDED
      ? paymentIntent
      : await prisma.paymentIntent.update({
          where: { id: paymentIntent.id },
          data: {
            status: PaymentIntentStatus.SUCCEEDED,
            ...(providerRef ? { providerRef } : {}),
          },
        });

  const donation = await prisma.donation.findFirst({
    where: { paymentIntentId: paymentIntent.id },
    include: { church: { include: { organization: true } } },
  });

  if (donation) {
    const wasCompleted = donation.status === DonationStatus.COMPLETED || donation.status === DonationStatus.REFUNDED;
    const rawAnonymous =
      typeof paymentIntent.metadata === 'object' && paymentIntent.metadata && 'isAnonymous' in paymentIntent.metadata
        ? (paymentIntent.metadata as Record<string, unknown>).isAnonymous
        : donation.isAnonymous;
    const isAnonymous = rawAnonymous === true || rawAnonymous === 'true' || rawAnonymous === '1';

    const updatedDonation = await prisma.donation.update({
      where: { id: donation.id },
      data: {
        status: DonationStatus.COMPLETED,
        providerRef: providerRef ?? donation.providerRef,
        isAnonymous,
      },
    });

    if (!wasCompleted) {
      await ensureDonationReceipt(updatedDonation.id);

      emitRealtimeEvent({
        type: 'donation.created',
        data: {
          id: updatedDonation.id,
          churchId: updatedDonation.churchId,
          tenantId: donation.church.organization.tenantId,
          amount: updatedDonation.amount.toString(),
          currency: updatedDonation.currency,
          status: updatedDonation.status,
          provider: updatedDonation.provider,
        },
      });

      await recordAuditLog({
        tenantId: donation.church.organization.tenantId,
        churchId: updatedDonation.churchId,
        actorType: AuditActorType.WEBHOOK,
        action: 'donation.completed',
        targetType: 'Donation',
        targetId: updatedDonation.id,
        metadata: {
          amount: updatedDonation.amount.toString(),
          currency: updatedDonation.currency,
          provider: updatedDonation.provider,
        },
      });
    }
  }

  const ticketOrderId =
    typeof paymentIntent.metadata === 'object' && paymentIntent.metadata && 'ticketOrderId' in paymentIntent.metadata
      ? (paymentIntent.metadata as Record<string, unknown>).ticketOrderId
      : undefined;
  const ticketOrder =
    (typeof ticketOrderId === 'string'
      ? await prisma.eventTicketOrder.findUnique({ where: { id: ticketOrderId } })
      : null) ??
    (await prisma.eventTicketOrder.findFirst({ where: { paymentIntentId: paymentIntent.id } }));

  if (ticketOrder && ticketOrder.status !== TicketOrderStatus.PAID) {
    const updatedOrder = await prisma.eventTicketOrder.update({
      where: { id: ticketOrder.id },
      data: {
        status: TicketOrderStatus.PAID,
        providerRef: providerRef ?? ticketOrder.providerRef ?? paymentIntent.providerRef,
      },
    });

    if (updatedOrder.memberId) {
      const event = await prisma.event.findUnique({ where: { id: updatedOrder.eventId } });
      if (event && event.requiresRsvp) {
        await prisma.eventRsvp.upsert({
          where: { eventId_memberId: { eventId: event.id, memberId: updatedOrder.memberId } },
          update: {
            status: 'GOING',
            guestCount: Math.max(updatedOrder.quantity - 1, 0),
          },
          create: {
            eventId: event.id,
            memberId: updatedOrder.memberId,
            status: 'GOING',
            guestCount: Math.max(updatedOrder.quantity - 1, 0),
          },
        });
      }
    }
  }

  return updatedIntent;
}

async function markPaymentFailed(paymentIntentIdOrRef: string) {
  const paymentIntent =
    (await prisma.paymentIntent.findUnique({
      where: { id: paymentIntentIdOrRef },
    })) ??
    (await prisma.paymentIntent.findFirst({
      where: { providerRef: paymentIntentIdOrRef },
    }));

  if (!paymentIntent || paymentIntent.status === PaymentIntentStatus.FAILED) {
    return;
  }

  await prisma.paymentIntent.update({
    where: { id: paymentIntent.id },
    data: { status: PaymentIntentStatus.FAILED },
  });

  await prisma.donation.updateMany({
    where: { paymentIntentId: paymentIntent.id },
    data: { status: DonationStatus.FAILED },
  });

  await prisma.eventTicketOrder.updateMany({
    where: { paymentIntentId: paymentIntent.id },
    data: { status: TicketOrderStatus.CANCELED },
  });

  const church = await prisma.church.findUnique({
    where: { id: paymentIntent.churchId },
    include: { organization: true },
  });

  await recordAuditLog({
    tenantId: church?.organization.tenantId ?? null,
    churchId: paymentIntent.churchId,
    actorType: AuditActorType.WEBHOOK,
    action: 'payment.failed',
    targetType: 'PaymentIntent',
    targetId: paymentIntent.id,
    metadata: {
      provider: paymentIntent.provider,
      amount: paymentIntent.amount.toString(),
      currency: paymentIntent.currency,
    },
  });
}

async function refreshDonationRefundStatus(donationId: string) {
  const donation = await prisma.donation.findUnique({ where: { id: donationId } });
  if (!donation) return;

  const refundTotals = await prisma.refund.aggregate({
    where: { donationId },
    _sum: { amount: true },
  });

  const refundedAmount = refundTotals._sum.amount ? Number(refundTotals._sum.amount) : 0;
  const donationAmount = Number(donation.amount);
  if (refundedAmount >= donationAmount && donation.status !== DonationStatus.REFUNDED) {
    await prisma.donation.update({
      where: { id: donationId },
      data: { status: DonationStatus.REFUNDED },
    });
  }
}

async function resolveStripePaymentIntentId({
  donation,
  paymentIntentRef,
  stripe,
}: {
  donation: { providerRef: string; paymentIntentId?: string | null };
  paymentIntentRef?: string | null;
  stripe: Stripe;
}) {
  if (paymentIntentRef?.startsWith('pi_')) {
    return paymentIntentRef;
  }

  if (paymentIntentRef?.startsWith('cs_')) {
    const session = await stripe.checkout.sessions.retrieve(paymentIntentRef);
    return typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;
  }

  if (donation.providerRef.startsWith('pi_')) {
    return donation.providerRef;
  }

  if (donation.providerRef.startsWith('cs_')) {
    const session = await stripe.checkout.sessions.retrieve(donation.providerRef);
    return typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;
  }

  return null;
}

async function findDonationByStripeReference({
  paymentIntentId,
  chargeId,
}: {
  paymentIntentId?: string | null;
  chargeId?: string | null;
}) {
  if (paymentIntentId) {
    const paymentIntent = await prisma.paymentIntent.findFirst({
      where: { providerRef: paymentIntentId },
    });
    if (paymentIntent) {
      const donation = await prisma.donation.findFirst({ where: { paymentIntentId: paymentIntent.id } });
      if (donation) return donation;
    }
    const donationByRef = await prisma.donation.findFirst({ where: { providerRef: paymentIntentId } });
    if (donationByRef) return donationByRef;
  }

  if (chargeId) {
    const donation = await prisma.donation.findFirst({ where: { providerRef: chargeId } });
    if (donation) return donation;
  }

  return null;
}

async function upsertRefundRecord({
  provider,
  providerRef,
  donationId,
  churchId,
  amount,
  currency,
  status,
  reason,
  metadata,
}: {
  provider: PaymentProvider;
  providerRef: string;
  donationId: string;
  churchId: string;
  amount: number;
  currency: string;
  status: string;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  const refund = await prisma.refund.upsert({
    where: { provider_providerRef: { provider, providerRef } },
    create: {
      provider,
      providerRef,
      donationId,
      churchId,
      amount: new Prisma.Decimal(amount),
      currency,
      status,
      reason: reason ?? undefined,
      metadata,
    },
    update: {
      donationId,
      churchId,
      amount: new Prisma.Decimal(amount),
      currency,
      status,
      reason: reason ?? undefined,
      metadata,
    },
  });

  await refreshDonationRefundStatus(donationId);
  return refund;
}

async function upsertDisputeRecord({
  provider,
  providerRef,
  donationId,
  churchId,
  amount,
  currency,
  status,
  reason,
  evidenceDueBy,
  metadata,
}: {
  provider: PaymentProvider;
  providerRef: string;
  donationId?: string | null;
  churchId: string;
  amount?: number | null;
  currency?: string | null;
  status: string;
  reason?: string | null;
  evidenceDueBy?: Date | null;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.dispute.upsert({
    where: { provider_providerRef: { provider, providerRef } },
    create: {
      provider,
      providerRef,
      donationId: donationId ?? undefined,
      churchId,
      amount: amount !== null && amount !== undefined ? new Prisma.Decimal(amount) : undefined,
      currency: currency ?? undefined,
      status,
      reason: reason ?? undefined,
      evidenceDueBy: evidenceDueBy ?? undefined,
      metadata,
    },
    update: {
      donationId: donationId ?? undefined,
      churchId,
      amount: amount !== null && amount !== undefined ? new Prisma.Decimal(amount) : undefined,
      currency: currency ?? undefined,
      status,
      reason: reason ?? undefined,
      evidenceDueBy: evidenceDueBy ?? undefined,
      metadata,
    },
  });
}

export async function createRefundForDonation({
  donationId,
  amount,
  reason,
}: {
  donationId: string;
  amount?: number;
  reason?: string;
}) {
  const donation = await prisma.donation.findUnique({
    where: { id: donationId },
    include: { paymentIntent: true, church: { include: { organization: true } } },
  });

  if (!donation) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Donation not found' });
  }

  if (donation.status !== DonationStatus.COMPLETED && donation.status !== DonationStatus.REFUNDED) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Donation is not refundable' });
  }

  if (donation.provider === PaymentProvider.MANUAL) {
    const refund = await upsertRefundRecord({
      provider: PaymentProvider.MANUAL,
      providerRef: `manual-${Date.now()}`,
      donationId: donation.id,
      churchId: donation.churchId,
      amount: amount ?? Number(donation.amount),
      currency: donation.currency,
      status: 'succeeded',
      reason,
    });

    await recordAuditLog({
      tenantId: donation.church.organization.tenantId,
      churchId: donation.churchId,
      actorType: AuditActorType.USER,
      action: 'refund.created',
      targetType: 'Refund',
      targetId: refund.id,
      metadata: { provider: refund.provider, amount: refund.amount.toString(), currency: refund.currency },
    });

    return refund;
  }

  if (donation.provider === PaymentProvider.STRIPE) {
    const stripe = getStripe();
    const paymentIntentRef = donation.paymentIntent?.providerRef ?? null;
    const paymentIntentId = await resolveStripePaymentIntentId({
      donation,
      paymentIntentRef,
      stripe,
    });
    if (!paymentIntentId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Stripe payment intent not found' });
    }

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? toMinorUnits(amount, donation.currency) : undefined,
      reason: reason as Stripe.RefundCreateParams.Reason,
    });

    const refundRecord = await upsertRefundRecord({
      provider: PaymentProvider.STRIPE,
      providerRef: refund.id,
      donationId: donation.id,
      churchId: donation.churchId,
      amount: fromMinorUnits(refund.amount, refund.currency),
      currency: refund.currency.toUpperCase(),
      status: refund.status ?? 'unknown',
      reason: refund.reason ?? reason ?? null,
      metadata: refund as unknown as Prisma.InputJsonValue,
    });

    await recordAuditLog({
      tenantId: donation.church.organization.tenantId,
      churchId: donation.churchId,
      actorType: AuditActorType.USER,
      action: 'refund.created',
      targetType: 'Refund',
      targetId: refundRecord.id,
      metadata: { provider: refundRecord.provider, amount: refundRecord.amount.toString(), currency: refundRecord.currency },
    });

    return refundRecord;
  }

  if (donation.provider === PaymentProvider.PAYSTACK) {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Paystack is not configured' });
    }

    const response = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: donation.providerRef,
        amount: amount ? toMinorUnits(amount, donation.currency) : undefined,
        reason,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new TRPCError({ code: 'BAD_GATEWAY', message: `Paystack refund error: ${text}` });
    }

    const payload = (await response.json()) as {
      status: boolean;
      message: string;
      data?: { id: number; amount: number; currency: string; status: string; reason?: string };
    };

    if (!payload.status || !payload.data) {
      throw new TRPCError({ code: 'BAD_GATEWAY', message: payload.message || 'Paystack refund failed' });
    }

    const refundRecord = await upsertRefundRecord({
      provider: PaymentProvider.PAYSTACK,
      providerRef: String(payload.data.id),
      donationId: donation.id,
      churchId: donation.churchId,
      amount: fromMinorUnits(payload.data.amount, payload.data.currency),
      currency: payload.data.currency.toUpperCase(),
      status: payload.data.status ?? 'unknown',
      reason: payload.data.reason ?? reason ?? null,
      metadata: payload.data as unknown as Prisma.InputJsonValue,
    });

    await recordAuditLog({
      tenantId: donation.church.organization.tenantId,
      churchId: donation.churchId,
      actorType: AuditActorType.USER,
      action: 'refund.created',
      targetType: 'Refund',
      targetId: refundRecord.id,
      metadata: { provider: refundRecord.provider, amount: refundRecord.amount.toString(), currency: refundRecord.currency },
    });

    return refundRecord;
  }

  throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unsupported provider' });
}

async function recordStripeRefund({
  refund,
  paymentIntentId,
  chargeId,
}: {
  refund: Stripe.Refund;
  paymentIntentId?: string | null;
  chargeId?: string | null;
}) {
  const donation = await findDonationByStripeReference({ paymentIntentId, chargeId });
  if (!donation) return;

  const church = await prisma.church.findUnique({
    where: { id: donation.churchId },
    include: { organization: true },
  });

  const refundRecord = await upsertRefundRecord({
    provider: PaymentProvider.STRIPE,
    providerRef: refund.id,
    donationId: donation.id,
    churchId: donation.churchId,
    amount: fromMinorUnits(refund.amount, refund.currency),
    currency: refund.currency.toUpperCase(),
    status: refund.status ?? 'unknown',
    reason: refund.reason ?? null,
    metadata: refund as unknown as Prisma.InputJsonValue,
  });

  await recordAuditLog({
    tenantId: church?.organization.tenantId ?? null,
    churchId: donation.churchId,
    actorType: AuditActorType.WEBHOOK,
    action: 'refund.updated',
    targetType: 'Refund',
    targetId: refundRecord.id,
    metadata: { provider: refundRecord.provider, status: refundRecord.status },
  });
}

async function recordStripeDispute(dispute: Stripe.Dispute) {
  const donation = await findDonationByStripeReference({
    paymentIntentId: dispute.payment_intent as string | null,
    chargeId: dispute.charge as string | null,
  });

  const churchId = donation?.churchId ?? null;
  if (!churchId) return;

  const church = await prisma.church.findUnique({
    where: { id: churchId },
    include: { organization: true },
  });

  const disputeRecord = await upsertDisputeRecord({
    provider: PaymentProvider.STRIPE,
    providerRef: dispute.id,
    donationId: donation?.id ?? null,
    churchId,
    amount: dispute.amount ? fromMinorUnits(dispute.amount, dispute.currency) : null,
    currency: dispute.currency ? dispute.currency.toUpperCase() : null,
    status: dispute.status ?? 'unknown',
    reason: dispute.reason ?? null,
    evidenceDueBy: dispute.evidence_details?.due_by
      ? new Date(dispute.evidence_details.due_by * 1000)
      : null,
    metadata: dispute as unknown as Prisma.InputJsonValue,
  });

  await recordAuditLog({
    tenantId: church?.organization.tenantId ?? null,
    churchId,
    actorType: AuditActorType.WEBHOOK,
    action: 'dispute.updated',
    targetType: 'Dispute',
    targetId: disputeRecord.id,
    metadata: { provider: disputeRecord.provider, status: disputeRecord.status },
  });
}

async function recordPaystackRefund({
  donation,
  refundId,
  amount,
  currency,
  status,
  reason,
  metadata,
}: {
  donation: { id: string; churchId: string };
  refundId: string;
  amount: number;
  currency: string;
  status: string;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  const church = await prisma.church.findUnique({
    where: { id: donation.churchId },
    include: { organization: true },
  });

  const refundRecord = await upsertRefundRecord({
    provider: PaymentProvider.PAYSTACK,
    providerRef: refundId,
    donationId: donation.id,
    churchId: donation.churchId,
    amount,
    currency: currency.toUpperCase(),
    status,
    reason: reason ?? null,
    metadata,
  });

  await recordAuditLog({
    tenantId: church?.organization.tenantId ?? null,
    churchId: donation.churchId,
    actorType: AuditActorType.WEBHOOK,
    action: 'refund.updated',
    targetType: 'Refund',
    targetId: refundRecord.id,
    metadata: { provider: refundRecord.provider, status: refundRecord.status },
  });
}

async function recordPaystackDispute({
  donation,
  disputeId,
  amount,
  currency,
  status,
  reason,
  metadata,
}: {
  donation: { id: string; churchId: string } | null;
  disputeId: string;
  amount?: number;
  currency?: string | null;
  status: string;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  if (!donation?.churchId) return;

  const church = await prisma.church.findUnique({
    where: { id: donation.churchId },
    include: { organization: true },
  });

  const disputeRecord = await upsertDisputeRecord({
    provider: PaymentProvider.PAYSTACK,
    providerRef: disputeId,
    donationId: donation?.id ?? null,
    churchId: donation.churchId,
    amount: amount ?? null,
    currency: currency ? currency.toUpperCase() : null,
    status,
    reason: reason ?? null,
    metadata,
  });

  await recordAuditLog({
    tenantId: church?.organization.tenantId ?? null,
    churchId: donation.churchId,
    actorType: AuditActorType.WEBHOOK,
    action: 'dispute.updated',
    targetType: 'Dispute',
    targetId: disputeRecord.id,
    metadata: { provider: disputeRecord.provider, status: disputeRecord.status },
  });
}

export async function handleStripeWebhook(payload: string | Buffer, signature: string, webhookSecret: string) {
  const stripe = getStripe();
  const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  const idempotency = await beginWebhookProcessing({
    provider: WebhookProvider.STRIPE,
    externalEventId: event.id,
    eventType: event.type,
    payload,
  });
  if (idempotency.duplicate) {
    return { received: true, duplicate: true, event: event.type };
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentIntentId = session.client_reference_id ?? session.metadata?.paymentIntentId;
      if (paymentIntentId) {
        await markPaymentSucceeded(paymentIntentId, session.id);
      }

      if (session.mode === 'subscription' && session.subscription) {
        const recurringId = session.client_reference_id ?? session.metadata?.recurringDonationId;
        if (recurringId) {
          const recurring = await prisma.recurringDonation.findUnique({
            where: { id: recurringId },
          });
          const now = new Date();

          await prisma.recurringDonation.update({
            where: { id: recurringId },
            data: {
              status: 'ACTIVE',
              providerRef: typeof session.subscription === 'string' ? session.subscription : session.subscription.id,
              nextChargeAt: recurring ? nextRecurringChargeAt(recurring.interval, now) : null,
            },
          });
        }
      }
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const paymentIntentId = intent.metadata?.paymentIntentId;
      if (paymentIntentId) {
        await markPaymentSucceeded(paymentIntentId, intent.id);
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const paymentIntentId = intent.metadata?.paymentIntentId;
      if (paymentIntentId) {
        await markPaymentFailed(paymentIntentId);
      }
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = (invoice as Stripe.Invoice & { subscription?: string | null }).subscription ?? null;
      if (subscriptionId) {
        const recurring = await prisma.recurringDonation.findFirst({
          where: { providerRef: subscriptionId },
        });
        if (recurring) {
          const existingDonation = await prisma.donation.findFirst({
            where: { provider: PaymentProvider.STRIPE, providerRef: invoice.id },
          });

          if (!existingDonation) {
            const amount = fromMinorUnits(invoice.amount_paid, invoice.currency);
            const donation = await prisma.donation.create({
              data: {
                churchId: recurring.churchId,
                memberId: recurring.memberId,
                recurringDonationId: recurring.id,
                amount: new Prisma.Decimal(amount),
                currency: invoice.currency.toUpperCase(),
                status: DonationStatus.COMPLETED,
                provider: PaymentProvider.STRIPE,
                providerRef: invoice.id,
                donorEmail: invoice.customer_email ?? undefined,
              },
            });

            await ensureDonationReceipt(donation.id);
          }

          const now = new Date();
          await prisma.recurringDonation.update({
            where: { id: recurring.id },
            data: {
              lastChargeAt: now,
              nextChargeAt: nextRecurringChargeAt(recurring.interval, now),
            },
          });
        }
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = (invoice as Stripe.Invoice & { subscription?: string | null }).subscription ?? null;
      if (subscriptionId) {
        await prisma.recurringDonation.updateMany({
          where: { providerRef: subscriptionId },
          data: { status: 'PAUSED' },
        });
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      await prisma.recurringDonation.updateMany({
        where: { providerRef: subscription.id },
        data: { status: 'CANCELED' },
      });
    }

    if (event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentIntentId = session.client_reference_id ?? session.metadata?.paymentIntentId;
      if (paymentIntentId) {
        await markPaymentFailed(paymentIntentId);
      }
    }

    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      for (const refund of charge.refunds?.data ?? []) {
        await recordStripeRefund({ refund, paymentIntentId, chargeId: charge.id });
      }
    }

    if (
      event.type === 'refund.updated' ||
      event.type === 'refund.created' ||
      event.type === 'refund.failed' ||
      event.type === 'charge.refund.updated'
    ) {
      const refund = event.data.object as Stripe.Refund;
      const paymentIntentId = typeof refund.payment_intent === 'string' ? refund.payment_intent : refund.payment_intent?.id;
      const chargeId = typeof refund.charge === 'string' ? refund.charge : refund.charge?.id;
      await recordStripeRefund({ refund, paymentIntentId, chargeId });
    }

    if (event.type.startsWith('charge.dispute.')) {
      const dispute = event.data.object as Stripe.Dispute;
      await recordStripeDispute(dispute);
    }

    const result = { received: true, event: event.type };
    await markWebhookProcessed({
      recordId: idempotency.recordId!,
      result: result as unknown as Prisma.InputJsonValue,
    });
    return result;
  } catch (error) {
    await markWebhookFailed({
      recordId: idempotency.recordId!,
      error,
      result: { event: event.type } as Prisma.InputJsonValue,
    });
    throw error;
  }
}

function verifyPaystackSignature(payload: string, signature: string, secret: string) {
  const hash = crypto.createHmac('sha512', secret).update(payload).digest('hex');
  if (hash.length !== signature.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}

async function verifyPaystackTransaction(reference: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Paystack is not configured' });
  }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new TRPCError({ code: 'BAD_GATEWAY', message: `Paystack verify error: ${text}` });
  }

  const payload = (await response.json()) as { status: boolean; data?: { status: string } };
  return payload;
}

export async function handlePaystackWebhook(payload: string, signature: string, webhookSecret: string) {
  if (!verifyPaystackSignature(payload, signature, webhookSecret)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid Paystack signature' });
  }

  const event = JSON.parse(payload) as {
    event: string;
    data?: {
      reference?: string;
      amount?: number;
      currency?: string;
      metadata?: Record<string, any>;
      subscription?: { subscription_code?: string; next_payment_date?: string } | string | null;
      plan?: { plan_code?: string } | string | null;
      customer?: { email?: string; customer_code?: string } | null;
      id?: number | string;
      status?: string;
      reason?: string;
      dispute?: { id?: string | number; status?: string };
    };
  };
  const reference = event.data?.reference;
  const subscriptionCode =
    typeof event.data?.subscription === 'string'
      ? event.data.subscription
      : event.data?.subscription?.subscription_code;
  const planCode = typeof event.data?.plan === 'string' ? event.data.plan : event.data?.plan?.plan_code;
  const eventId = buildWebhookExternalEventId([
    event.event,
    event.data?.id,
    reference,
    subscriptionCode,
    planCode,
    hashWebhookPayload(payload).slice(0, 16),
  ]);
  const idempotency = await beginWebhookProcessing({
    provider: WebhookProvider.PAYSTACK,
    externalEventId: eventId,
    eventType: event.event,
    payload,
  });
  if (idempotency.duplicate) {
    return { received: true, duplicate: true, event: event.event };
  }

  try {
    const result = await (async () => {
      if (event.event === 'charge.success' && reference) {
        const verification = await verifyPaystackTransaction(reference);
        if (verification.status && verification.data?.status === 'success') {
          const metadata = (event.data?.metadata ?? {}) as Record<string, unknown>;
          const recurringDonationId = metadata.recurringDonationId as string | undefined;

          if (metadata.paymentIntentId || metadata.payment_intent_id) {
            const paymentIntentId = (metadata.paymentIntentId ?? metadata.payment_intent_id) as string;
            await markPaymentSucceeded(paymentIntentId, reference);
            return { received: true, event: event.event };
          }

          if (recurringDonationId || event.data?.subscription || event.data?.plan) {
            const recurring = recurringDonationId
              ? await prisma.recurringDonation.findUnique({ where: { id: recurringDonationId } })
              : subscriptionCode
                ? await prisma.recurringDonation.findFirst({ where: { providerRef: subscriptionCode } })
                : planCode
                  ? await prisma.recurringDonation.findFirst({ where: { providerRef: planCode } })
                  : null;

            if (recurring) {
              const existingDonation = await prisma.donation.findFirst({
                where: { provider: PaymentProvider.PAYSTACK, providerRef: reference },
              });

              if (!existingDonation) {
                const amount = event.data?.amount
                  ? fromMinorUnits(event.data.amount, recurring.currency)
                  : Number(recurring.amount);
                const currency = event.data?.currency ? event.data.currency.toUpperCase() : recurring.currency;
                const donation = await prisma.donation.create({
                  data: {
                    churchId: recurring.churchId,
                    memberId: recurring.memberId,
                    recurringDonationId: recurring.id,
                    amount: new Prisma.Decimal(amount),
                    currency,
                    status: DonationStatus.COMPLETED,
                    provider: PaymentProvider.PAYSTACK,
                    providerRef: reference,
                    isAnonymous:
                      metadata.isAnonymous === true ||
                      metadata.isAnonymous === 'true' ||
                      metadata.isAnonymous === '1',
                    donorEmail: event.data?.customer?.email ?? undefined,
                  },
                });

                await ensureDonationReceipt(donation.id);

                const donationChurch = await prisma.church.findUnique({
                  where: { id: donation.churchId },
                  include: { organization: true },
                });

                emitRealtimeEvent({
                  type: 'donation.created',
                  data: {
                    id: donation.id,
                    churchId: donation.churchId,
                    tenantId: donationChurch?.organization.tenantId,
                    amount: donation.amount.toString(),
                    currency: donation.currency,
                    status: donation.status,
                    provider: donation.provider,
                  },
                });
              }

              const nextCharge =
                event.data?.subscription && typeof event.data.subscription !== 'string'
                  ? event.data.subscription.next_payment_date
                  : null;

              await prisma.recurringDonation.update({
                where: { id: recurring.id },
                data: {
                  status: 'ACTIVE',
                  providerRef: subscriptionCode ?? recurring.providerRef,
                  lastChargeAt: new Date(),
                  nextChargeAt: nextCharge ? new Date(nextCharge) : nextRecurringChargeAt(recurring.interval, new Date()),
                },
              });
            }

            return { received: true, event: event.event };
          }

          await markPaymentSucceeded(reference);
        } else {
          await markPaymentFailed(reference);
        }
      }

      if (event.event === 'charge.failed' && reference) {
        await markPaymentFailed(reference);
      }

      if (event.event === 'subscription.create') {
        if (subscriptionCode || planCode) {
          const recurring = await prisma.recurringDonation.findFirst({
            where: { providerRef: planCode ?? subscriptionCode ?? undefined },
          });

          if (recurring) {
            const nextCharge =
              event.data?.subscription && typeof event.data.subscription !== 'string'
                ? event.data.subscription.next_payment_date
                : null;

            await prisma.recurringDonation.update({
              where: { id: recurring.id },
              data: {
                status: 'ACTIVE',
                providerRef: subscriptionCode ?? recurring.providerRef,
                nextChargeAt: nextCharge ? new Date(nextCharge) : recurring.nextChargeAt,
              },
            });
          }
        }
      }

      if (event.event === 'subscription.disable') {
        if (subscriptionCode) {
          await prisma.recurringDonation.updateMany({
            where: { providerRef: subscriptionCode },
            data: { status: 'CANCELED' },
          });
        }
      }

      if (event.event === 'invoice.payment_failed') {
        if (subscriptionCode) {
          await prisma.recurringDonation.updateMany({
            where: { providerRef: subscriptionCode },
            data: { status: 'PAUSED' },
          });
        }
      }

      if (event.event?.startsWith('charge.dispute')) {
        const donation = reference ? await prisma.donation.findFirst({ where: { providerRef: reference } }) : null;
        const disputeId = event.data?.dispute?.id ?? event.data?.id;
        if (donation && disputeId) {
          await recordPaystackDispute({
            donation,
            disputeId: String(disputeId),
            amount: event.data?.amount ? fromMinorUnits(event.data.amount, event.data.currency ?? donation.currency) : undefined,
            currency: event.data?.currency ?? donation.currency,
            status: event.data?.status ?? event.event,
            reason: event.data?.reason ?? null,
            metadata: event.data as unknown as Prisma.InputJsonValue,
          });
        }
      }

      if (event.event?.startsWith('refund.')) {
        const donation = reference ? await prisma.donation.findFirst({ where: { providerRef: reference } }) : null;
        if (donation && event.data?.id && event.data?.amount) {
          await recordPaystackRefund({
            donation,
            refundId: String(event.data.id),
            amount: fromMinorUnits(event.data.amount, event.data.currency ?? donation.currency),
            currency: event.data.currency ?? donation.currency,
            status: event.data.status ?? event.event,
            reason: event.data.reason ?? null,
            metadata: event.data as unknown as Prisma.InputJsonValue,
          });
        }
      }

      return { received: true, event: event.event };
    })();

    await markWebhookProcessed({
      recordId: idempotency.recordId!,
      result: result as unknown as Prisma.InputJsonValue,
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
