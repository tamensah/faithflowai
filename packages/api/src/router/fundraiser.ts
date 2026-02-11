import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { AuditActorType, prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { recordAuditLog } from '../audit';

const createFundraiserSchema = z.object({
  churchId: z.string(),
  memberId: z.string().optional(),
  campaignId: z.string().optional(),
  name: z.string().min(2),
  slug: z.string().min(2),
  goalAmount: z.number().positive().optional(),
  currency: z.string().default('USD'),
  message: z.string().optional(),
});

export const fundraiserRouter = router({
  list: protectedProcedure
    .input(z.object({ churchId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      return prisma.fundraiserPage.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  create: protectedProcedure
    .input(createFundraiserSchema)
    .mutation(async ({ input, ctx }) => {
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      if (input.memberId) {
        const member = await prisma.member.findFirst({
          where: { id: input.memberId, churchId: input.churchId },
        });
        if (!member) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
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

      const fundraiser = await prisma.fundraiserPage.create({
        data: {
          churchId: input.churchId,
          memberId: input.memberId,
          campaignId: input.campaignId,
          name: input.name,
          slug: input.slug,
          goalAmount: input.goalAmount,
          currency: input.currency.toUpperCase(),
          message: input.message,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: fundraiser.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'fundraiser.created',
        targetType: 'FundraiserPage',
        targetId: fundraiser.id,
        metadata: { name: fundraiser.name, slug: fundraiser.slug },
      });

      return fundraiser;
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: z.enum(['ACTIVE', 'PAUSED', 'ENDED']) }))
    .mutation(async ({ input, ctx }) => {
      const fundraiser = await prisma.fundraiserPage.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!fundraiser) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Fundraiser not found' });
      }

      const updated = await prisma.fundraiserPage.update({
        where: { id: input.id },
        data: { status: input.status },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: updated.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'fundraiser.status_updated',
        targetType: 'FundraiserPage',
        targetId: updated.id,
        metadata: { status: updated.status },
      });

      return updated;
    }),

  stats: protectedProcedure
    .input(z.object({ churchId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const fundraisers = await prisma.fundraiserPage.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });

      const donationGroups = await prisma.donation.groupBy({
        by: ['fundraiserPageId', 'currency'],
        where: {
          fundraiserPageId: { not: null },
          status: 'COMPLETED',
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        _sum: { amount: true },
        _count: true,
      });

      const totalsByFundraiser = donationGroups.reduce<Record<string, { totals: Record<string, number>; count: number }>>(
        (acc, group) => {
          if (!group.fundraiserPageId) return acc;
          const existing = acc[group.fundraiserPageId] ?? { totals: {}, count: 0 };
          const currency = group.currency;
          const amount = group._sum.amount ? Number(group._sum.amount) : 0;
          existing.totals[currency] = (existing.totals[currency] ?? 0) + amount;
          existing.count += group._count;
          acc[group.fundraiserPageId] = existing;
          return acc;
        },
        {}
      );

      return fundraisers.map((fundraiser) => ({
        fundraiser,
        totals: totalsByFundraiser[fundraiser.id]?.totals ?? {},
        count: totalsByFundraiser[fundraiser.id]?.count ?? 0,
      }));
    }),

  getBySlug: publicProcedure
    .input(z.object({ churchSlug: z.string(), slug: z.string() }))
    .query(async ({ input }) => {
      const fundraiser = await prisma.fundraiserPage.findFirst({
        where: { slug: input.slug, church: { slug: input.churchSlug } },
        include: {
          church: true,
          member: true,
          campaign: true,
        },
      });

      if (!fundraiser) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Fundraiser not found' });
      }

      const totals = await prisma.donation.groupBy({
        by: ['currency'],
        where: {
          fundraiserPageId: fundraiser.id,
          status: 'COMPLETED',
        },
        _sum: { amount: true },
        _count: true,
      });

      return { fundraiser, totals };
    }),
});
