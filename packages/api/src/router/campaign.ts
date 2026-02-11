import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { AuditActorType, prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { recordAuditLog } from '../audit';

const createCampaignSchema = z.object({
  churchId: z.string(),
  name: z.string().min(2),
  description: z.string().optional(),
  targetAmount: z.number().positive().optional(),
  currency: z.string().optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
});

export const campaignRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      return prisma.campaign.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  create: protectedProcedure
    .input(createCampaignSchema)
    .mutation(async ({ input, ctx }) => {
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });

      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      const campaign = await prisma.campaign.create({
        data: {
          churchId: input.churchId,
          name: input.name,
          description: input.description,
          targetAmount: input.targetAmount,
          currency: input.currency,
          startAt: input.startAt,
          endAt: input.endAt,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: campaign.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'campaign.created',
        targetType: 'Campaign',
        targetId: campaign.id,
        metadata: {
          name: campaign.name,
          targetAmount: campaign.targetAmount ? campaign.targetAmount.toString() : null,
          currency: campaign.currency,
        },
      });

      return campaign;
    }),

  stats: protectedProcedure
    .input(z.object({ churchId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const campaigns = await prisma.campaign.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });

      const donationGroups = await prisma.donation.groupBy({
        by: ['campaignId', 'currency'],
        where: {
          campaignId: { not: null },
          status: 'COMPLETED',
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        _sum: { amount: true },
        _count: true,
      });

      const totalsByCampaign = donationGroups.reduce<Record<string, { totals: Record<string, number>; count: number }>>(
        (acc, group) => {
          if (!group.campaignId) return acc;
          const existing = acc[group.campaignId] ?? { totals: {}, count: 0 };
          const currency = group.currency;
          const amount = group._sum.amount ? Number(group._sum.amount) : 0;
          existing.totals[currency] = (existing.totals[currency] ?? 0) + amount;
          existing.count += group._count;
          acc[group.campaignId] = existing;
          return acc;
        },
        {}
      );

      return campaigns.map((campaign) => ({
        campaign,
        totals: totalsByCampaign[campaign.id]?.totals ?? {},
        count: totalsByCampaign[campaign.id]?.count ?? 0,
      }));
    }),
});
