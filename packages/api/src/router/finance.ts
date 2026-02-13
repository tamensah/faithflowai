import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { AuditActorType, DisputeEvidenceType, PaymentProvider, prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { syncPaystackSettlements, syncStripePayouts } from '../reconciliation';
import { toCsv } from '../csv';
import { recordAuditLog } from '../audit';
import { createRefundForDonation } from '../payments';
import { createDisputeEvidenceRecord, submitDisputeEvidence, submitStripeDispute } from '../disputes';
import { ensureFeatureReadAccess, ensureFeatureWriteAccess } from '../entitlements';

const churchFilterSchema = z.object({
  churchId: z.string().optional(),
});

const trendInputSchema = z.object({
  churchId: z.string().optional(),
  months: z.number().min(3).max(36).default(12),
});

const donorSegmentInputSchema = z.object({
  churchId: z.string().optional(),
  lookbackMonths: z.number().min(6).max(36).default(18),
});

const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

type MonthPoint = { month: string; totalAmount: number; count: number };

function monthKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function buildMonthSeries(months: number, to: Date) {
  const series: string[] = [];
  const cursor = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  for (let i = 0; i < months; i += 1) {
    series.unshift(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }
  return series;
}

function mergeMonthPoints(months: string[], entries: Map<string, MonthPoint>) {
  return months.map((month) => entries.get(month) ?? { month, totalAmount: 0, count: 0 });
}

async function computeDonationTrends(params: {
  tenantId: string;
  churchId?: string;
  months: number;
}) {
  const to = new Date();
  const monthsSeries = buildMonthSeries(params.months, to);
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  from.setUTCMonth(from.getUTCMonth() - (params.months - 1));

  const donations = await prisma.donation.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      status: 'COMPLETED',
      church: { organization: { tenantId: params.tenantId } },
      ...(params.churchId ? { churchId: params.churchId } : {}),
    },
    select: { createdAt: true, amount: true, currency: true },
  });

  const currencyMap = new Map<string, Map<string, MonthPoint>>();

  for (const donation of donations) {
    const currency = donation.currency;
    const key = monthKey(donation.createdAt);
    const monthMap = currencyMap.get(currency) ?? new Map<string, MonthPoint>();
    const current = monthMap.get(key) ?? { month: key, totalAmount: 0, count: 0 };
    current.totalAmount += Number(donation.amount);
    current.count += 1;
    monthMap.set(key, current);
    currencyMap.set(currency, monthMap);
  }

  const series = Array.from(currencyMap.entries()).map(([currency, points]) => ({
    currency,
    points: mergeMonthPoints(monthsSeries, points),
  }));

  return { months: monthsSeries, series };
}

export const financeRouter = router({
  dashboard: protectedProcedure
    .input(churchFilterSchema.merge(dateRangeSchema))
    .query(async ({ input, ctx }) => {
      await ensureFeatureReadAccess(ctx.tenantId!, 'finance_enabled', 'Your subscription does not include finance operations.');
      const from = input.from ?? new Date(new Date().getFullYear(), 0, 1);
      const to = input.to ?? new Date();

      const donationTotals = await prisma.donation.groupBy({
        by: ['currency'],
        where: {
          createdAt: { gte: from, lte: to },
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        _sum: { amount: true },
        _count: true,
      });

      const expenseTotals = await prisma.expense.groupBy({
        by: ['currency'],
        where: {
          createdAt: { gte: from, lte: to },
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        _sum: { amount: true },
        _count: true,
      });

      return {
        range: { from, to },
        donations: donationTotals,
        expenses: expenseTotals,
      };
    }),
  reconciliationSummary: protectedProcedure
    .input(churchFilterSchema)
    .query(async ({ input, ctx }) => {
      await ensureFeatureReadAccess(ctx.tenantId!, 'finance_enabled', 'Your subscription does not include finance operations.');
      const paymentIntents = await prisma.paymentIntent.groupBy({
        by: ['status'],
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        _count: true,
      });

      const donations = await prisma.donation.groupBy({
        by: ['status'],
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        _count: true,
      });

      const paymentIntentSuccess = paymentIntents.find((item) => item.status === 'SUCCEEDED')?._count ?? 0;
      const donationCompleted = donations.find((item) => item.status === 'COMPLETED')?._count ?? 0;

      return {
        paymentIntents,
        donations,
        totals: {
          paymentIntentSuccess,
          donationCompleted,
          delta: paymentIntentSuccess - donationCompleted,
        },
      };
    }),

  reconciliationMismatches: protectedProcedure
    .input(churchFilterSchema)
    .query(async ({ input, ctx }) => {
      await ensureFeatureReadAccess(ctx.tenantId!, 'finance_enabled', 'Your subscription does not include finance operations.');
      const successIntents = await prisma.paymentIntent.findMany({
        where: {
          status: 'SUCCEEDED',
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        include: {
          donation: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });

      const intentWithoutCompletedDonation = successIntents.filter(
        (intent) => !intent.donation || intent.donation.status !== 'COMPLETED'
      );

      const completedDonations = await prisma.donation.findMany({
        where: {
          status: 'COMPLETED',
          paymentIntentId: { not: null },
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        include: {
          paymentIntent: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });

      const donationWithPendingIntent = completedDonations.filter(
        (donation) => donation.paymentIntent && donation.paymentIntent.status !== 'SUCCEEDED'
      );

      return {
        intentWithoutCompletedDonation,
        donationWithPendingIntent,
      };
    }),

  donorInsights: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input, ctx }) => {
      await ensureFeatureReadAccess(ctx.tenantId!, 'finance_enabled', 'Your subscription does not include finance operations.');
      const memberGroups = await prisma.donation.groupBy({
        by: ['memberId', 'currency'],
        where: {
          memberId: { not: null },
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        _sum: { amount: true },
        _count: true,
        orderBy: {
          _sum: { amount: 'desc' },
        },
        take: input.limit,
      });

      const memberIds = memberGroups
        .map((group) => group.memberId)
        .filter((id): id is string => Boolean(id));
      const members = await prisma.member.findMany({
        where: { id: { in: memberIds } },
      });

      const memberMap = new Map(members.map((member) => [member.id, member]));

      const anonymousGroups = await prisma.donation.groupBy({
        by: ['donorEmail', 'currency'],
        where: {
          donorEmail: { not: null },
          memberId: null,
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        _sum: { amount: true },
        _count: true,
        orderBy: {
          _sum: { amount: 'desc' },
        },
        take: input.limit,
      });

      return {
        members: memberGroups.map((group) => ({
          memberId: group.memberId,
          member: group.memberId ? memberMap.get(group.memberId) ?? null : null,
          currency: group.currency,
          totalAmount: group._sum.amount,
          count: group._count,
        })),
        anonymous: anonymousGroups.map((group) => ({
          donorEmail: group.donorEmail,
          currency: group.currency,
          totalAmount: group._sum.amount,
          count: group._count,
        })),
      };
    }),

  donationTrends: protectedProcedure
    .input(trendInputSchema)
    .query(async ({ input, ctx }) => {
      await ensureFeatureReadAccess(ctx.tenantId!, 'finance_enabled', 'Your subscription does not include finance operations.');
      return computeDonationTrends({
        tenantId: ctx.tenantId!,
        churchId: input.churchId,
        months: input.months,
      });
    }),

  donationForecast: protectedProcedure
    .input(trendInputSchema)
    .query(async ({ input, ctx }) => {
      await ensureFeatureReadAccess(ctx.tenantId!, 'finance_enabled', 'Your subscription does not include finance operations.');
      const trends = await computeDonationTrends({
        tenantId: ctx.tenantId!,
        churchId: input.churchId,
        months: input.months,
      });

      const basisMonths = Math.min(3, trends.months.length);
      const forecast = trends.series.map((series) => {
        const recent = series.points.slice(-basisMonths);
        const sum = recent.reduce((acc, item) => acc + item.totalAmount, 0);
        const average = basisMonths > 0 ? sum / basisMonths : 0;
        return {
          currency: series.currency,
          basisMonths,
          nextMonth: average,
          nextQuarter: average * 3,
        };
      });

      return { basisMonths, forecast };
    }),

  donorSegments: protectedProcedure
    .input(donorSegmentInputSchema)
    .query(async ({ input, ctx }) => {
      await ensureFeatureReadAccess(ctx.tenantId!, 'finance_enabled', 'Your subscription does not include finance operations.');
      const now = new Date();
      const lookbackFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      lookbackFrom.setUTCMonth(lookbackFrom.getUTCMonth() - (input.lookbackMonths - 1));

      const donations = await prisma.donation.findMany({
        where: {
          createdAt: { gte: lookbackFrom, lte: now },
          status: 'COMPLETED',
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        select: {
          memberId: true,
          donorEmail: true,
          donorName: true,
          donorPhone: true,
          amount: true,
          currency: true,
          createdAt: true,
        },
      });

      const recurring = await prisma.recurringDonation.findMany({
        where: {
          status: 'ACTIVE',
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        select: { memberId: true },
      });

      const recurringKeys = new Set(
        recurring
          .map((item) =>
            item.memberId ? `member:${item.memberId}` : null
          )
          .filter((value): value is string => Boolean(value))
      );

      const donorMap = new Map<
        string,
        {
          memberId?: string | null;
          donorEmail?: string | null;
          donorName?: string | null;
          donorPhone?: string | null;
          firstDonationAt: Date;
          lastDonationAt: Date;
          totalByCurrency: Map<string, number>;
          recentCount: number;
        }
      >();

      const recentThreshold = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      const newThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const activeThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const lapsedThreshold = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);

      for (const donation of donations) {
        const key = donation.memberId
          ? `member:${donation.memberId}`
          : donation.donorEmail
          ? `email:${donation.donorEmail}`
          : donation.donorPhone
          ? `phone:${donation.donorPhone}`
          : `anon:${donation.donorName ?? 'donor'}`;

        const current =
          donorMap.get(key) ??
          {
            memberId: donation.memberId,
            donorEmail: donation.donorEmail,
            donorName: donation.donorName,
            donorPhone: donation.donorPhone,
            firstDonationAt: donation.createdAt,
            lastDonationAt: donation.createdAt,
            totalByCurrency: new Map<string, number>(),
            recentCount: 0,
          };

        if (donation.createdAt < current.firstDonationAt) {
          current.firstDonationAt = donation.createdAt;
        }
        if (donation.createdAt > current.lastDonationAt) {
          current.lastDonationAt = donation.createdAt;
        }

        const total = current.totalByCurrency.get(donation.currency) ?? 0;
        current.totalByCurrency.set(donation.currency, total + Number(donation.amount));

        if (donation.createdAt >= recentThreshold) {
          current.recentCount += 1;
        }

        donorMap.set(key, current);
      }

      const donors = Array.from(donorMap.entries()).map(([key, value]) => ({
        donorKey: key,
        ...value,
        totals: Object.fromEntries(value.totalByCurrency.entries()),
      }));

      const donorInfo = new Map(
        donors.map((donor) => [
          donor.donorKey,
          {
            memberId: donor.memberId ?? null,
            donorEmail: donor.donorEmail ?? null,
            donorName: donor.donorName ?? null,
            donorPhone: donor.donorPhone ?? null,
          },
        ])
      );

      const newDonors = donors.filter((donor) => donor.firstDonationAt >= newThreshold);
      const activeDonors = donors.filter((donor) => donor.lastDonationAt >= activeThreshold);
      const lapsedDonors = donors.filter((donor) => donor.lastDonationAt < lapsedThreshold);
      const recurringDonors = donors.filter(
        (donor) => donor.recentCount >= 3 || recurringKeys.has(donor.donorKey)
      );

      const highValueByCurrency = new Map<string, { donorKey: string; amount: number }[]>();
      for (const donor of donors) {
        for (const [currency, amount] of Object.entries(donor.totals)) {
          const list = highValueByCurrency.get(currency) ?? [];
          list.push({ donorKey: donor.donorKey, amount });
          highValueByCurrency.set(currency, list);
        }
      }

      const topDonors = Array.from(highValueByCurrency.entries()).map(([currency, list]) => ({
        currency,
        donors: list
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10)
          .map((entry) => ({
            ...entry,
            ...(donorInfo.get(entry.donorKey) ?? {}),
          })),
      }));

      return {
        lookbackMonths: input.lookbackMonths,
        totals: {
          donors: donors.length,
          new: newDonors.length,
          active: activeDonors.length,
          lapsed: lapsedDonors.length,
          recurring: recurringDonors.length,
        },
        samples: {
          new: newDonors.slice(0, 10),
          active: activeDonors.slice(0, 10),
          lapsed: lapsedDonors.slice(0, 10),
          recurring: recurringDonors.slice(0, 10),
        },
        topDonors,
      };
    }),

  tithingStatement: protectedProcedure
    .input(
      z
        .object({
          churchId: z.string().optional(),
          memberId: z.string().optional(),
          donorEmail: z.string().email().optional(),
          year: z.number().min(2000).max(2100),
        })
        .refine((data) => data.memberId || data.donorEmail, {
          message: 'memberId or donorEmail is required',
        })
    )
    .query(async ({ input, ctx }) => {
      await ensureFeatureReadAccess(ctx.tenantId!, 'finance_enabled', 'Your subscription does not include finance operations.');
      const from = new Date(input.year, 0, 1);
      const to = new Date(input.year, 11, 31, 23, 59, 59);

      const donations = await prisma.donation.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
          ...(input.memberId ? { memberId: input.memberId } : {}),
          ...(input.donorEmail ? { donorEmail: input.donorEmail } : {}),
          status: 'COMPLETED',
        },
        orderBy: { createdAt: 'asc' },
      });

      const totals = donations.reduce<Record<string, number>>((acc, donation) => {
        const amount = Number(donation.amount);
        acc[donation.currency] = (acc[donation.currency] ?? 0) + amount;
        return acc;
      }, {});

      return {
        year: input.year,
        totals,
        donations,
      };
    }),

  refundDonation: protectedProcedure
    .input(
      z.object({
        donationId: z.string(),
        amount: z.number().positive().optional(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureWriteAccess(ctx.tenantId!, 'finance_enabled', 'Your subscription does not include finance operations.');
      const donation = await prisma.donation.findFirst({
        where: { id: input.donationId, church: { organization: { tenantId: ctx.tenantId! } } },
      });

      if (!donation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Donation not found' });
      }

      return createRefundForDonation({
        donationId: input.donationId,
        amount: input.amount,
        reason: input.reason,
      });
    }),

  refunds: protectedProcedure
    .input(z.object({ churchId: z.string().optional(), limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ input, ctx }) => {
      await ensureFeatureReadAccess(ctx.tenantId!, 'finance_enabled', 'Your subscription does not include finance operations.');
      return prisma.refund.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        include: { donation: true },
      });
    }),

  disputes: protectedProcedure
    .input(z.object({ churchId: z.string().optional(), limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ input, ctx }) => {
      await ensureFeatureReadAccess(ctx.tenantId!, 'finance_enabled', 'Your subscription does not include finance operations.');
      return prisma.dispute.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        include: { donation: true },
      });
    }),

  disputeEvidence: protectedProcedure
    .input(z.object({ disputeId: z.string() }))
    .query(async ({ input, ctx }) => {
      await ensureFeatureReadAccess(ctx.tenantId!, 'finance_enabled', 'Your subscription does not include finance operations.');
      const dispute = await prisma.dispute.findFirst({
        where: { id: input.disputeId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!dispute) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Dispute not found' });
      }

      return prisma.disputeEvidence.findMany({
        where: { disputeId: input.disputeId },
        orderBy: { createdAt: 'desc' },
      });
    }),

  submitDisputeEvidenceText: protectedProcedure
    .input(
      z.object({
        disputeId: z.string(),
        type: z.nativeEnum(DisputeEvidenceType),
        description: z.string().optional(),
        text: z.string().optional(),
        submit: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureWriteAccess(ctx.tenantId!, 'finance_enabled', 'Your subscription does not include finance operations.');
      const dispute = await prisma.dispute.findFirst({
        where: { id: input.disputeId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!dispute) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Dispute not found' });
      }

      const evidence = await createDisputeEvidenceRecord({
        disputeId: input.disputeId,
        type: input.type,
        description: input.description ?? null,
        text: input.text ?? null,
      });

      await submitDisputeEvidence({
        disputeId: input.disputeId,
        evidenceId: evidence.id,
        submit: input.submit,
      });

      return evidence;
    }),

  submitDispute: protectedProcedure
    .input(z.object({ disputeId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureWriteAccess(ctx.tenantId!, 'finance_enabled', 'Your subscription does not include finance operations.');
      const dispute = await prisma.dispute.findFirst({
        where: { id: input.disputeId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!dispute) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Dispute not found' });
      }
      if (dispute.provider !== PaymentProvider.STRIPE) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Only Stripe disputes can be submitted' });
      }

      await submitStripeDispute(dispute.providerRef);

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: dispute.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'dispute.submitted',
        targetType: 'Dispute',
        targetId: dispute.id,
      });

      return { ok: true };
    }),

  disputeSummary: protectedProcedure
    .input(z.object({ churchId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      await ensureFeatureReadAccess(ctx.tenantId!, 'finance_enabled', 'Your subscription does not include finance operations.');
      return prisma.dispute.groupBy({
        by: ['status'],
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        _count: true,
      });
    }),

  refundAnalytics: protectedProcedure
    .input(z.object({ churchId: z.string().optional(), lookbackDays: z.number().min(7).max(365).default(90) }))
    .query(async ({ input, ctx }) => {
      await ensureFeatureReadAccess(ctx.tenantId!, 'finance_enabled', 'Your subscription does not include finance operations.');
      const since = new Date(Date.now() - input.lookbackDays * 24 * 60 * 60 * 1000);
      const baseFilter = {
        church: { organization: { tenantId: ctx.tenantId! } },
        ...(input.churchId ? { churchId: input.churchId } : {}),
      };

      const refunds = await prisma.refund.groupBy({
        by: ['currency', 'status', 'provider'],
        where: { ...baseFilter, createdAt: { gte: since } },
        _sum: { amount: true },
        _count: true,
      });

      const donationTotals = await prisma.donation.groupBy({
        by: ['currency'],
        where: { ...baseFilter, createdAt: { gte: since }, status: 'COMPLETED' },
        _sum: { amount: true },
        _count: true,
      });

      const refundAmountByCurrency = refunds.reduce<Record<string, number>>((acc, row) => {
        const amount = Number(row._sum.amount ?? 0);
        acc[row.currency] = (acc[row.currency] ?? 0) + amount;
        return acc;
      }, {});

      const donationAmountByCurrency = donationTotals.reduce<Record<string, number>>((acc, row) => {
        const amount = Number(row._sum.amount ?? 0);
        acc[row.currency] = (acc[row.currency] ?? 0) + amount;
        return acc;
      }, {});

      const refundRateByCurrency = Object.entries(donationAmountByCurrency).reduce<Record<string, number>>(
        (acc, [currency, total]) => {
          const refunded = refundAmountByCurrency[currency] ?? 0;
          acc[currency] = total > 0 ? refunded / total : 0;
          return acc;
        },
        {}
      );

      const topRefunds = await prisma.refund.findMany({
        where: { ...baseFilter, createdAt: { gte: since } },
        orderBy: { amount: 'desc' },
        take: 10,
        include: { donation: true },
      });

      return {
        lookbackDays: input.lookbackDays,
        refunds,
        donationTotals,
        refundAmountByCurrency,
        refundRateByCurrency,
        topRefunds,
      };
    }),

  listPayouts: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
        provider: z.nativeEnum(PaymentProvider).optional(),
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      await ensureFeatureReadAccess(ctx.tenantId!, 'finance_enabled', 'Your subscription does not include finance operations.');
      return prisma.payout.findMany({
        where: {
          tenantId: ctx.tenantId!,
          ...(input.provider ? { provider: input.provider } : {}),
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { arrivalDate: 'desc' },
        take: input.limit,
      });
    }),

  payoutTransactions: protectedProcedure
    .input(z.object({ payoutId: z.string(), limit: z.number().min(1).max(200).default(100) }))
    .query(async ({ input, ctx }) => {
      await ensureFeatureReadAccess(ctx.tenantId!, 'finance_enabled', 'Your subscription does not include finance operations.');
      const payout = await prisma.payout.findFirst({
        where: { id: input.payoutId, tenantId: ctx.tenantId! },
      });
      if (!payout) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Payout not found' });
      }

      return prisma.payoutTransaction.findMany({
        where: { payoutId: input.payoutId },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });
    }),

  syncStripePayouts: protectedProcedure
    .input(
      z.object({
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureWriteAccess(ctx.tenantId!, 'finance_enabled', 'Your subscription does not include finance operations.');
      const result = await syncStripePayouts(ctx.tenantId!, input.from, input.to);
      await recordAuditLog({
        tenantId: ctx.tenantId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'payout.sync.stripe',
        targetType: 'Payout',
        metadata: result,
      });
      return result;
    }),

  syncPaystackSettlements: protectedProcedure
    .input(z.object({}))
    .mutation(async ({ ctx }) => {
      await ensureFeatureWriteAccess(ctx.tenantId!, 'finance_enabled', 'Your subscription does not include finance operations.');
      const result = await syncPaystackSettlements(ctx.tenantId!);
      await recordAuditLog({
        tenantId: ctx.tenantId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'payout.sync.paystack',
        targetType: 'Payout',
        metadata: result,
      });
      return result;
    }),

  exportCsv: protectedProcedure
    .input(
      z.object({
      type: z.enum(['donations', 'expenses', 'pledges', 'recurring', 'receipts', 'payouts', 'refunds', 'disputes']),
        churchId: z.string().optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await ensureFeatureReadAccess(ctx.tenantId!, 'finance_enabled', 'Your subscription does not include finance operations.');
      const baseFilter = {
        ...(input.churchId ? { churchId: input.churchId } : {}),
        church: { organization: { tenantId: ctx.tenantId! } },
      };

      const range =
        input.from || input.to
          ? {
              createdAt: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {}),
              },
            }
          : {};

      if (input.type === 'donations') {
        const donations = await prisma.donation.findMany({
          where: { ...baseFilter, ...range },
          orderBy: { createdAt: 'desc' },
        });
        return {
          filename: `donations-${Date.now()}.csv`,
          csv: toCsv(
            donations.map((donation) => ({
              id: donation.id,
              churchId: donation.churchId,
              amount: donation.amount.toString(),
              currency: donation.currency,
              status: donation.status,
              provider: donation.provider,
              donorEmail: donation.donorEmail ?? '',
              createdAt: donation.createdAt.toISOString(),
            })),
            [
              { key: 'id', label: 'id' },
              { key: 'churchId', label: 'church_id' },
              { key: 'amount', label: 'amount' },
              { key: 'currency', label: 'currency' },
              { key: 'status', label: 'status' },
              { key: 'provider', label: 'provider' },
              { key: 'donorEmail', label: 'donor_email' },
              { key: 'createdAt', label: 'created_at' },
            ]
          ),
        };
      }

      if (input.type === 'expenses') {
        const expenses = await prisma.expense.findMany({
          where: { ...baseFilter, ...range },
          orderBy: { createdAt: 'desc' },
        });
        return {
          filename: `expenses-${Date.now()}.csv`,
          csv: toCsv(
            expenses.map((expense) => ({
              id: expense.id,
              churchId: expense.churchId,
              amount: expense.amount.toString(),
              currency: expense.currency,
              status: expense.status,
              description: expense.description ?? '',
              createdAt: expense.createdAt.toISOString(),
            })),
            [
              { key: 'id', label: 'id' },
              { key: 'churchId', label: 'church_id' },
              { key: 'amount', label: 'amount' },
              { key: 'currency', label: 'currency' },
              { key: 'status', label: 'status' },
              { key: 'description', label: 'description' },
              { key: 'createdAt', label: 'created_at' },
            ]
          ),
        };
      }

      if (input.type === 'pledges') {
        const pledges = await prisma.pledge.findMany({
          where: { ...baseFilter, ...range },
          orderBy: { createdAt: 'desc' },
        });
        return {
          filename: `pledges-${Date.now()}.csv`,
          csv: toCsv(
            pledges.map((pledge) => ({
              id: pledge.id,
              churchId: pledge.churchId,
              amount: pledge.amount.toString(),
              currency: pledge.currency,
              status: pledge.status,
              dueDate: pledge.dueDate?.toISOString() ?? '',
              createdAt: pledge.createdAt.toISOString(),
            })),
            [
              { key: 'id', label: 'id' },
              { key: 'churchId', label: 'church_id' },
              { key: 'amount', label: 'amount' },
              { key: 'currency', label: 'currency' },
              { key: 'status', label: 'status' },
              { key: 'dueDate', label: 'due_date' },
              { key: 'createdAt', label: 'created_at' },
            ]
          ),
        };
      }

      if (input.type === 'recurring') {
        const recurring = await prisma.recurringDonation.findMany({
          where: { ...baseFilter, ...range },
          orderBy: { createdAt: 'desc' },
        });
        return {
          filename: `recurring-${Date.now()}.csv`,
          csv: toCsv(
            recurring.map((item) => ({
              id: item.id,
              churchId: item.churchId,
              amount: item.amount.toString(),
              currency: item.currency,
              interval: item.interval,
              status: item.status,
              nextChargeAt: item.nextChargeAt?.toISOString() ?? '',
              createdAt: item.createdAt.toISOString(),
            })),
            [
              { key: 'id', label: 'id' },
              { key: 'churchId', label: 'church_id' },
              { key: 'amount', label: 'amount' },
              { key: 'currency', label: 'currency' },
              { key: 'interval', label: 'interval' },
              { key: 'status', label: 'status' },
              { key: 'nextChargeAt', label: 'next_charge_at' },
              { key: 'createdAt', label: 'created_at' },
            ]
          ),
        };
      }

      if (input.type === 'receipts') {
        const receipts = await prisma.donationReceipt.findMany({
          where: { ...baseFilter, ...range },
          orderBy: { issuedAt: 'desc' },
        });
        return {
          filename: `receipts-${Date.now()}.csv`,
          csv: toCsv(
            receipts.map((receipt) => ({
              id: receipt.id,
              churchId: receipt.churchId,
              receiptNumber: receipt.receiptNumber,
              status: receipt.status,
              issuedAt: receipt.issuedAt.toISOString(),
            })),
            [
              { key: 'id', label: 'id' },
              { key: 'churchId', label: 'church_id' },
              { key: 'receiptNumber', label: 'receipt_number' },
              { key: 'status', label: 'status' },
              { key: 'issuedAt', label: 'issued_at' },
            ]
          ),
        };
      }

      if (input.type === 'refunds') {
        const refunds = await prisma.refund.findMany({
          where: { ...baseFilter, ...range },
          orderBy: { createdAt: 'desc' },
        });
        return {
          filename: `refunds-${Date.now()}.csv`,
          csv: toCsv(
            refunds.map((refund) => ({
              id: refund.id,
              donationId: refund.donationId,
              provider: refund.provider,
              providerRef: refund.providerRef,
              amount: refund.amount.toString(),
              currency: refund.currency,
              status: refund.status,
              createdAt: refund.createdAt.toISOString(),
            })),
            [
              { key: 'id', label: 'id' },
              { key: 'donationId', label: 'donation_id' },
              { key: 'provider', label: 'provider' },
              { key: 'providerRef', label: 'provider_ref' },
              { key: 'amount', label: 'amount' },
              { key: 'currency', label: 'currency' },
              { key: 'status', label: 'status' },
              { key: 'createdAt', label: 'created_at' },
            ]
          ),
        };
      }

      if (input.type === 'disputes') {
        const disputes = await prisma.dispute.findMany({
          where: { ...baseFilter, ...range },
          orderBy: { createdAt: 'desc' },
        });
        return {
          filename: `disputes-${Date.now()}.csv`,
          csv: toCsv(
            disputes.map((dispute) => ({
              id: dispute.id,
              donationId: dispute.donationId ?? '',
              provider: dispute.provider,
              providerRef: dispute.providerRef,
              amount: dispute.amount?.toString() ?? '',
              currency: dispute.currency ?? '',
              status: dispute.status,
              createdAt: dispute.createdAt.toISOString(),
            })),
            [
              { key: 'id', label: 'id' },
              { key: 'donationId', label: 'donation_id' },
              { key: 'provider', label: 'provider' },
              { key: 'providerRef', label: 'provider_ref' },
              { key: 'amount', label: 'amount' },
              { key: 'currency', label: 'currency' },
              { key: 'status', label: 'status' },
              { key: 'createdAt', label: 'created_at' },
            ]
          ),
        };
      }

      const payouts = await prisma.payout.findMany({
        where: {
          tenantId: ctx.tenantId!,
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { arrivalDate: 'desc' },
      });
      return {
        filename: `payouts-${Date.now()}.csv`,
        csv: toCsv(
          payouts.map((payout) => ({
            id: payout.id,
            provider: payout.provider,
            providerRef: payout.providerRef,
            currency: payout.currency,
            amount: payout.amount.toString(),
            status: payout.status,
            arrivalDate: payout.arrivalDate?.toISOString() ?? '',
          })),
          [
            { key: 'id', label: 'id' },
            { key: 'provider', label: 'provider' },
            { key: 'providerRef', label: 'provider_ref' },
            { key: 'currency', label: 'currency' },
            { key: 'amount', label: 'amount' },
            { key: 'status', label: 'status' },
            { key: 'arrivalDate', label: 'arrival_date' },
          ]
        ),
      };
    }),
});
