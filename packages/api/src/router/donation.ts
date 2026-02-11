import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { AuditActorType, PaymentProvider, prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { emitRealtimeEvent } from '../realtime';
import { createDonationReceiptForManual } from '../receipts';
import { recordAuditLog } from '../audit';

const createDonationSchema = z.object({
  churchId: z.string(),
  memberId: z.string().optional(),
  fundId: z.string().optional(),
  campaignId: z.string().optional(),
  fundraiserPageId: z.string().optional(),
  pledgeId: z.string().optional(),
  recurringDonationId: z.string().optional(),
  amount: z.number().positive(),
  currency: z
    .string()
    .default('USD')
    .transform((value) => value.toUpperCase()),
  provider: z.nativeEnum(PaymentProvider).default(PaymentProvider.MANUAL),
  providerRef: z.string().optional(),
  isAnonymous: z.boolean().optional(),
  donorName: z.string().optional(),
  donorEmail: z.string().email().optional(),
  donorPhone: z.string().optional(),
});

export const donationRouter = router({
  create: protectedProcedure
    .input(createDonationSchema)
    .mutation(async ({ input, ctx }) => {
      const church = await prisma.church.findFirst({
        where: {
          id: input.churchId,
          organization: { tenantId: ctx.tenantId! },
        },
      });

      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      if (input.memberId) {
        const member = await prisma.member.findFirst({
          where: {
            id: input.memberId,
            church: { organization: { tenantId: ctx.tenantId! } },
          },
        });

        if (!member) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
        }
      }

      if (input.fundId) {
        const fund = await prisma.fund.findFirst({
          where: { id: input.fundId, churchId: input.churchId },
        });
        if (!fund) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Fund not found' });
        }
      }

      if (input.campaignId) {
        const campaign = await prisma.campaign.findFirst({
          where: { id: input.campaignId, churchId: input.churchId },
        });
        if (!campaign) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
        }
      }

      if (input.fundraiserPageId) {
        const fundraiser = await prisma.fundraiserPage.findFirst({
          where: { id: input.fundraiserPageId, churchId: input.churchId },
        });
        if (!fundraiser) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Fundraiser page not found' });
        }
      }

      if (input.pledgeId) {
        const pledge = await prisma.pledge.findFirst({
          where: { id: input.pledgeId, churchId: input.churchId },
        });
        if (!pledge) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Pledge not found' });
        }
      }

      if (input.recurringDonationId) {
        const recurring = await prisma.recurringDonation.findFirst({
          where: { id: input.recurringDonationId, churchId: input.churchId },
        });
        if (!recurring) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Recurring donation not found' });
        }
      }

      if (input.provider !== PaymentProvider.MANUAL && !input.providerRef) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'providerRef is required' });
      }

      const providerRef = input.providerRef ?? `manual-${Date.now()}`;

      const donation = await prisma.donation.create({
        data: {
          churchId: input.churchId,
          memberId: input.memberId,
          fundId: input.fundId,
          campaignId: input.campaignId,
          fundraiserPageId: input.fundraiserPageId,
          pledgeId: input.pledgeId,
          recurringDonationId: input.recurringDonationId,
          amount: input.amount,
          currency: input.currency,
          status: 'COMPLETED',
          provider: input.provider,
          providerRef,
          isAnonymous: input.isAnonymous ?? false,
          donorName: input.donorName,
          donorEmail: input.donorEmail,
          donorPhone: input.donorPhone,
        },
      });

      await createDonationReceiptForManual(donation.id);

      emitRealtimeEvent({
        type: 'donation.created',
        data: {
          id: donation.id,
          churchId: donation.churchId,
          tenantId: ctx.tenantId,
          amount: donation.amount.toString(),
          currency: donation.currency,
          status: donation.status,
          provider: donation.provider,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: donation.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'donation.created',
        targetType: 'Donation',
        targetId: donation.id,
        metadata: {
          amount: donation.amount.toString(),
          currency: donation.currency,
          provider: donation.provider,
        },
      });

      return donation;
    }),

  list: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
        limit: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ input, ctx }) => {
      return prisma.donation.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        include: {
          member: true,
          fund: true,
          campaign: true,
          fundraiserPage: true,
          pledge: true,
          recurringDonation: true,
        },
      });
    }),
});
