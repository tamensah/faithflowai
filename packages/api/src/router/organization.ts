import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '@faithflow-ai/database';

export const organizationRouter = router({
  create: protectedProcedure
    .input(z.object({ name: z.string().min(2) }))
    .mutation(async ({ input, ctx }) => {
      return prisma.organization.create({
        data: {
          name: input.name,
          tenantId: ctx.tenantId!,
        },
      });
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return prisma.organization.findMany({
      where: { tenantId: ctx.tenantId! },
      orderBy: { createdAt: 'desc' },
    });
  }),
});
