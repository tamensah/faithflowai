import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { AuditActorType, prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { recordAuditLog } from '../audit';
import { ensureFeatureEnabled } from '../entitlements';

const budgetInput = z.object({
  churchId: z.string(),
  name: z.string().min(2),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
});

const budgetItemInput = z.object({
  budgetId: z.string(),
  categoryId: z.string().optional(),
  name: z.string().min(2),
  allocatedAmount: z.number().positive(),
});

export const budgetRouter = router({
  list: protectedProcedure
    .input(z.object({ churchId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      return prisma.budget.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      });
    }),

  create: protectedProcedure
    .input(budgetInput)
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureEnabled(
        ctx.tenantId!,
        'finance_enabled',
        'Your subscription does not include finance operations.'
      );
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      const budget = await prisma.budget.create({
        data: {
          churchId: input.churchId,
          name: input.name,
          startAt: input.startAt,
          endAt: input.endAt,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: budget.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'budget.created',
        targetType: 'Budget',
        targetId: budget.id,
        metadata: { name: budget.name },
      });

      return budget;
    }),

  addItem: protectedProcedure
    .input(budgetItemInput)
    .mutation(async ({ input, ctx }) => {
      const budget = await prisma.budget.findFirst({
        where: { id: input.budgetId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!budget) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Budget not found' });
      }

      if (input.categoryId) {
        const category = await prisma.expenseCategory.findFirst({
          where: { id: input.categoryId, churchId: budget.churchId },
        });
        if (!category) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Category not found' });
        }
      }

      const item = await prisma.budgetItem.create({
        data: {
          budgetId: input.budgetId,
          categoryId: input.categoryId,
          name: input.name,
          allocatedAmount: input.allocatedAmount,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: budget.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'budget.item_added',
        targetType: 'BudgetItem',
        targetId: item.id,
        metadata: { name: item.name, allocatedAmount: item.allocatedAmount.toString() },
      });

      return item;
    }),
});
