import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { AuditActorType, prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { recordAuditLog } from '../audit';

const categoryInput = z.object({
  churchId: z.string(),
  name: z.string().min(2),
  description: z.string().optional(),
});

export const expenseCategoryRouter = router({
  list: protectedProcedure
    .input(z.object({ churchId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      return prisma.expenseCategory.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { name: 'asc' },
      });
    }),

  create: protectedProcedure
    .input(categoryInput)
    .mutation(async ({ input, ctx }) => {
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      const category = await prisma.expenseCategory.create({
        data: {
          churchId: input.churchId,
          name: input.name,
          description: input.description,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: category.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'expense_category.created',
        targetType: 'ExpenseCategory',
        targetId: category.id,
        metadata: { name: category.name },
      });

      return category;
    }),
});
