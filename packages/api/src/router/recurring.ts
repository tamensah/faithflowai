import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { AuditActorType, prisma, PaymentProvider } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { ensureDonationReceipt } from '../receipts';
import { createRecurringCheckout } from '../payments';
import { recurringCheckoutInputSchema } from '../payments/inputs';
import { recordAuditLog } from '../audit';

function nextChargeDate(from: Date, interval: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY') {
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

const recurringInput = z.object({
  churchId: z.string(),
  memberId: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  interval: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  provider: z.nativeEnum(PaymentProvider),
  providerRef: z.string().optional(),
  startAt: z.coerce.date().optional(),
});

export const recurringRouter = router({
  createCheckout: protectedProcedure
    .input(recurringCheckoutInputSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await createRecurringCheckout({ ...input, tenantId: ctx.tenantId });
      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: input.churchId ?? undefined,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'recurring.checkout_created',
        targetType: 'RecurringDonation',
        targetId: result.recurringDonationId,
        metadata: { provider: input.provider, interval: input.interval, amount: input.amount },
      });
      return result;
    }),

  list: protectedProcedure
    .input(z.object({ churchId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      return prisma.recurringDonation.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  create: protectedProcedure
    .input(recurringInput)
    .mutation(async ({ input, ctx }) => {
      if (input.provider === PaymentProvider.PAYSTACK) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Paystack recurring must use createCheckout to capture authorization',
        });
      }
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      return prisma.recurringDonation.create({
        data: {
          churchId: input.churchId,
          memberId: input.memberId,
          amount: input.amount,
          currency: input.currency.toUpperCase(),
          interval: input.interval,
          provider: input.provider,
          providerRef: input.providerRef,
          startAt: input.startAt ?? new Date(),
        },
      });
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: z.enum(['ACTIVE', 'PAUSED', 'CANCELED']) }))
    .mutation(async ({ input, ctx }) => {
      const recurring = await prisma.recurringDonation.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!recurring) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Recurring donation not found' });
      }

      const updated = await prisma.recurringDonation.update({
        where: { id: input.id },
        data: { status: input.status },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: updated.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'recurring.status_updated',
        targetType: 'RecurringDonation',
        targetId: updated.id,
        metadata: { status: updated.status },
      });

      return updated;
    }),

  chargeNow: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const recurring = await prisma.recurringDonation.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!recurring) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Recurring donation not found' });
      }

      if (recurring.status !== 'ACTIVE') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Recurring donation is not active' });
      }

      const now = new Date();
      const donation = await prisma.donation.create({
        data: {
          churchId: recurring.churchId,
          memberId: recurring.memberId,
          recurringDonationId: recurring.id,
          amount: recurring.amount,
          currency: recurring.currency,
          status: 'COMPLETED',
          provider: recurring.provider,
          providerRef: recurring.providerRef ?? `recurring-${recurring.id}-${now.getTime()}`,
        },
      });

      await ensureDonationReceipt(donation.id);

      await prisma.recurringDonation.update({
        where: { id: recurring.id },
        data: {
          lastChargeAt: now,
          nextChargeAt: nextChargeDate(now, recurring.interval),
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: donation.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'recurring.charge_now',
        targetType: 'Donation',
        targetId: donation.id,
        metadata: { amount: donation.amount.toString(), currency: donation.currency },
      });

      return donation;
    }),
});
