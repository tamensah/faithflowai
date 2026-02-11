import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '@faithflow-ai/database';

export const auditRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      return prisma.auditLog.findMany({
        where: {
          tenantId: ctx.tenantId!,
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });
    }),
});
