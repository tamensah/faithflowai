import Stripe from 'stripe';
import { TRPCError } from '@trpc/server';
import { prisma, PaymentProvider, Prisma } from '@faithflow-ai/database';

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND']);

function fromMinorUnits(amount: number, currency: string) {
  const factor = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 100;
  return amount / factor;
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Stripe is not configured' });
  }
  return new Stripe(key);
}

async function fetchPaystack<T>(path: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Paystack is not configured' });
  }

  const response = await fetch(`https://api.paystack.co${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new TRPCError({ code: 'BAD_GATEWAY', message: `Paystack error: ${text}` });
  }

  return (await response.json()) as T;
}

type SyncResult = {
  payouts: number;
  transactions: number;
};

export async function syncStripePayouts(tenantId: string, from?: Date, to?: Date): Promise<SyncResult> {
  const stripe = getStripe();
  const created: Stripe.RangeQueryParam = {};
  if (from) created.gte = Math.floor(from.getTime() / 1000);
  if (to) created.lte = Math.floor(to.getTime() / 1000);

  const payouts = await stripe.payouts.list({ limit: 100, ...(Object.keys(created).length ? { created } : {}) });
  let payoutCount = 0;
  let transactionCount = 0;

  for (const payout of payouts.data) {
    const amount = fromMinorUnits(payout.amount, payout.currency);
    const payoutRecord = await prisma.payout.upsert({
      where: { provider_providerRef: { provider: PaymentProvider.STRIPE, providerRef: payout.id } },
      create: {
        provider: PaymentProvider.STRIPE,
        providerRef: payout.id,
        tenantId,
        currency: payout.currency.toUpperCase(),
        amount: new Prisma.Decimal(amount),
        status: payout.status ?? 'unknown',
        arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000) : null,
        metadata: payout as unknown as Prisma.InputJsonValue,
      },
      update: {
        currency: payout.currency.toUpperCase(),
        amount: new Prisma.Decimal(amount),
        status: payout.status ?? 'unknown',
        arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000) : null,
        metadata: payout as unknown as Prisma.InputJsonValue,
      },
    });
    payoutCount += 1;

    const transactions = await stripe.balanceTransactions.list({ payout: payout.id, limit: 100 });
    for (const balanceTxn of transactions.data) {
      const sourceRef = typeof balanceTxn.source === 'string' ? balanceTxn.source : balanceTxn.source?.id;
      const donation = sourceRef
        ? await prisma.donation.findFirst({ where: { providerRef: sourceRef } })
        : null;
      const amountValue = fromMinorUnits(balanceTxn.amount, balanceTxn.currency);
      const feeValue = fromMinorUnits(balanceTxn.fee, balanceTxn.currency);
      const netValue = fromMinorUnits(balanceTxn.net, balanceTxn.currency);

      await prisma.payoutTransaction.upsert({
        where: { payoutId_providerRef: { payoutId: payoutRecord.id, providerRef: balanceTxn.id } },
        create: {
          payoutId: payoutRecord.id,
          tenantId,
          churchId: donation?.churchId ?? null,
          donationId: donation?.id ?? null,
          providerRef: balanceTxn.id,
          sourceRef: sourceRef ?? null,
          type: balanceTxn.type,
          amount: new Prisma.Decimal(amountValue),
          fee: new Prisma.Decimal(feeValue),
          net: new Prisma.Decimal(netValue),
          currency: balanceTxn.currency.toUpperCase(),
          description: balanceTxn.description ?? undefined,
          metadata: balanceTxn as unknown as Prisma.InputJsonValue,
        },
        update: {
          churchId: donation?.churchId ?? null,
          donationId: donation?.id ?? null,
          sourceRef: sourceRef ?? null,
          type: balanceTxn.type,
          amount: new Prisma.Decimal(amountValue),
          fee: new Prisma.Decimal(feeValue),
          net: new Prisma.Decimal(netValue),
          currency: balanceTxn.currency.toUpperCase(),
          description: balanceTxn.description ?? undefined,
          metadata: balanceTxn as unknown as Prisma.InputJsonValue,
        },
      });
      transactionCount += 1;
    }
  }

  return { payouts: payoutCount, transactions: transactionCount };
}

type PaystackSettlement = {
  id: number;
  status: string;
  currency: string;
  total_amount: number;
  effective_amount: number;
  total_fees: number;
  settled_by: string | null;
  settlement_date: string;
};

type PaystackSettlementList = {
  status: boolean;
  data: PaystackSettlement[];
};

type PaystackSettlementTransaction = {
  id: number;
  amount: number;
  fees: number;
  currency: string;
  reference: string;
  paid_at?: string | null;
};

type PaystackSettlementTransactions = {
  status: boolean;
  data: PaystackSettlementTransaction[];
};

export async function syncPaystackSettlements(tenantId: string): Promise<SyncResult> {
  const payload = await fetchPaystack<PaystackSettlementList>('/settlement');
  if (!payload.status) {
    throw new TRPCError({ code: 'BAD_GATEWAY', message: 'Paystack settlement list failed' });
  }

  let payoutCount = 0;
  let transactionCount = 0;

  for (const settlement of payload.data) {
    const amount = fromMinorUnits(settlement.effective_amount, settlement.currency);
    const payoutRecord = await prisma.payout.upsert({
      where: { provider_providerRef: { provider: PaymentProvider.PAYSTACK, providerRef: String(settlement.id) } },
      create: {
        provider: PaymentProvider.PAYSTACK,
        providerRef: String(settlement.id),
        tenantId,
        currency: settlement.currency.toUpperCase(),
        amount: new Prisma.Decimal(amount),
        status: settlement.status ?? 'unknown',
        arrivalDate: settlement.settlement_date ? new Date(settlement.settlement_date) : null,
        metadata: settlement as unknown as Prisma.InputJsonValue,
      },
      update: {
        currency: settlement.currency.toUpperCase(),
        amount: new Prisma.Decimal(amount),
        status: settlement.status ?? 'unknown',
        arrivalDate: settlement.settlement_date ? new Date(settlement.settlement_date) : null,
        metadata: settlement as unknown as Prisma.InputJsonValue,
      },
    });
    payoutCount += 1;

    const txPayload = await fetchPaystack<PaystackSettlementTransactions>(`/settlement/${settlement.id}/transactions`);
    if (!txPayload.status) continue;

    for (const tx of txPayload.data) {
      const donation = await prisma.donation.findFirst({ where: { providerRef: tx.reference } });
      const amountValue = fromMinorUnits(tx.amount, tx.currency);
      const feeValue = fromMinorUnits(tx.fees, tx.currency);
      const netValue = amountValue - feeValue;

      await prisma.payoutTransaction.upsert({
        where: { payoutId_providerRef: { payoutId: payoutRecord.id, providerRef: String(tx.id) } },
        create: {
          payoutId: payoutRecord.id,
          tenantId,
          churchId: donation?.churchId ?? null,
          donationId: donation?.id ?? null,
          providerRef: String(tx.id),
          sourceRef: tx.reference,
          type: 'paystack_transaction',
          amount: new Prisma.Decimal(amountValue),
          fee: new Prisma.Decimal(feeValue),
          net: new Prisma.Decimal(netValue),
          currency: tx.currency.toUpperCase(),
          metadata: tx as unknown as Prisma.InputJsonValue,
        },
        update: {
          churchId: donation?.churchId ?? null,
          donationId: donation?.id ?? null,
          sourceRef: tx.reference,
          amount: new Prisma.Decimal(amountValue),
          fee: new Prisma.Decimal(feeValue),
          net: new Prisma.Decimal(netValue),
          currency: tx.currency.toUpperCase(),
          metadata: tx as unknown as Prisma.InputJsonValue,
        },
      });
      transactionCount += 1;
    }
  }

  return { payouts: payoutCount, transactions: transactionCount };
}
