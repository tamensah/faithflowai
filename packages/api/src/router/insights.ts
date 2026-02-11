import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '@faithflow-ai/database';
import { generateTextSimple, type AIProvider } from '@faithflow-ai/ai';

const providerSchema = z.enum(['openai', 'anthropic', 'google']).default('openai');

export const insightsRouter = router({
  donorSummary: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
        lookbackDays: z.number().min(7).max(365).default(90),
        provider: providerSchema.optional(),
        model: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const lookbackDays = input.lookbackDays ?? 90;
      const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
      const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

      const baseFilter = {
        church: { organization: { tenantId: ctx.tenantId! } },
        ...(input.churchId ? { churchId: input.churchId } : {}),
      };

      const recentDonations = await prisma.donation.findMany({
        where: {
          ...baseFilter,
          createdAt: { gte: since },
          status: 'COMPLETED',
        },
        orderBy: { createdAt: 'desc' },
      });

      const totalByCurrency = recentDonations.reduce<Record<string, number>>((acc, donation) => {
        const amount = Number(donation.amount);
        acc[donation.currency] = (acc[donation.currency] ?? 0) + amount;
        return acc;
      }, {});

      const topDonors = await prisma.donation.groupBy({
        by: ['donorEmail', 'memberId', 'currency'],
        where: {
          ...baseFilter,
          createdAt: { gte: since },
          status: 'COMPLETED',
        },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
        take: 10,
      });

      const recurringActive = await prisma.recurringDonation.count({
        where: {
          ...baseFilter,
          status: 'ACTIVE',
        },
      });

      const donorsLastYear = await prisma.donation.findMany({
        where: {
          ...baseFilter,
          createdAt: { gte: yearAgo },
          status: 'COMPLETED',
        },
        select: {
          donorEmail: true,
          memberId: true,
        },
      });
      const donorsRecent = await prisma.donation.findMany({
        where: {
          ...baseFilter,
          createdAt: { gte: since },
          status: 'COMPLETED',
        },
        select: {
          donorEmail: true,
          memberId: true,
        },
      });

      const lastYearSet = new Set(
        donorsLastYear
          .map((item) => item.memberId ?? item.donorEmail ?? null)
          .filter((id): id is string => Boolean(id))
      );
      const recentSet = new Set(
        donorsRecent
          .map((item) => item.memberId ?? item.donorEmail ?? null)
          .filter((id): id is string => Boolean(id))
      );
      const lapsedCount = Array.from(lastYearSet).filter((id) => !recentSet.has(id)).length;

      const stats = {
        lookbackDays,
        totalByCurrency,
        topDonors: topDonors.map((donor) => ({
          donorEmail: donor.donorEmail,
          memberId: donor.memberId,
          currency: donor.currency,
          totalAmount: donor._sum.amount?.toString() ?? '0',
          count: donor._count,
        })),
        recurringActive,
        lapsedCount,
        recentDonationCount: recentDonations.length,
      };

      const warnings: string[] = [];
      const provider = (input.provider ?? 'openai') as AIProvider;
      const model =
        input.model ??
        (provider === 'openai'
          ? 'gpt-4o-mini'
          : provider === 'anthropic'
          ? 'claude-3-5-haiku-latest'
          : 'gemini-1.5-flash');

      const providerKey =
        provider === 'openai'
          ? process.env.OPENAI_API_KEY
          : provider === 'anthropic'
          ? process.env.ANTHROPIC_API_KEY
          : process.env.GOOGLE_API_KEY;

      if (!providerKey) {
        warnings.push(`${provider} is not configured`);
        return {
          summary: `Recent donations: ${recentDonations.length}. Active recurring: ${recurringActive}. Lapsed donors (last 12 months but not last ${lookbackDays} days): ${lapsedCount}.`,
          stats,
          warnings,
        };
      }

      try {
        const prompt = `
You are a senior church finance analyst. Using the data below, write:
1) five concise insights, and
2) three actionable recommendations.

Data:
${JSON.stringify(stats, null, 2)}
`;

        const summary = await generateTextSimple({
          provider,
          model,
          prompt,
          temperature: 0.2,
          maxTokens: 500,
        });

        return { summary, stats, warnings };
      } catch (error) {
        warnings.push('AI generation failed; returned fallback summary.');
        return {
          summary: `Recent donations: ${recentDonations.length}. Active recurring: ${recurringActive}. Lapsed donors (last 12 months but not last ${lookbackDays} days): ${lapsedCount}.`,
          stats,
          warnings,
        };
      }
    }),
});
