import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { AuditActorType, prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { recordAuditLog } from '../audit';
import { ensureFeatureEnabled, ensureFeatureLimit } from '../entitlements';

const expenseInput = z.object({
  churchId: z.string(),
  categoryId: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  description: z.string().optional(),
  vendor: z.string().optional(),
  occurredAt: z.coerce.date().optional(),
});

export const expenseRouter = router({
  list: protectedProcedure
    .input(z.object({ churchId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      return prisma.expense.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: { category: true },
      });
    }),

  create: protectedProcedure
    .input(expenseInput)
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureEnabled(
        ctx.tenantId!,
        'finance_enabled',
        'Your subscription does not include finance operations.'
      );
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const currentExpenseCount = await prisma.expense.count({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          createdAt: { gte: monthStart },
        },
      });
      await ensureFeatureLimit(
        ctx.tenantId!,
        'max_expenses_monthly',
        currentExpenseCount,
        1,
        'Monthly expense limit reached for your subscription.'
      );
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      if (input.categoryId) {
        const category = await prisma.expenseCategory.findFirst({
          where: { id: input.categoryId, churchId: input.churchId },
        });
        if (!category) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Category not found' });
        }
      }

      const submittedBy = ctx.userId
        ? await prisma.user.findUnique({ where: { clerkUserId: ctx.userId } })
        : null;

      const expense = await prisma.expense.create({
        data: {
          churchId: input.churchId,
          categoryId: input.categoryId,
          amount: input.amount,
          currency: input.currency.toUpperCase(),
          description: input.description,
          vendor: input.vendor,
          occurredAt: input.occurredAt,
          submittedById: submittedBy?.id ?? undefined,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: expense.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'expense.created',
        targetType: 'Expense',
        targetId: expense.id,
        metadata: { amount: expense.amount.toString(), currency: expense.currency, status: expense.status },
      });

      return expense;
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureEnabled(
        ctx.tenantId!,
        'finance_enabled',
        'Your subscription does not include finance operations.'
      );
      const expense = await prisma.expense.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!expense) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Expense not found' });
      }

      const approvedBy = ctx.userId
        ? await prisma.user.findUnique({ where: { clerkUserId: ctx.userId } })
        : null;

      const updated = await prisma.expense.update({
        where: { id: input.id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedById: approvedBy?.id ?? undefined,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: updated.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'expense.approved',
        targetType: 'Expense',
        targetId: updated.id,
        metadata: { status: updated.status },
      });

      return updated;
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureEnabled(
        ctx.tenantId!,
        'finance_enabled',
        'Your subscription does not include finance operations.'
      );
      const expense = await prisma.expense.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!expense) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Expense not found' });
      }

      const updated = await prisma.expense.update({
        where: { id: input.id },
        data: { status: 'REJECTED' },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: updated.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'expense.rejected',
        targetType: 'Expense',
        targetId: updated.id,
        metadata: { status: updated.status },
      });

      return updated;
    }),

  markPaid: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureEnabled(
        ctx.tenantId!,
        'finance_enabled',
        'Your subscription does not include finance operations.'
      );
      const expense = await prisma.expense.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!expense) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Expense not found' });
      }

      const updated = await prisma.expense.update({
        where: { id: input.id },
        data: { status: 'PAID', paidAt: new Date() },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: updated.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'expense.paid',
        targetType: 'Expense',
        targetId: updated.id,
        metadata: { status: updated.status },
      });

      return updated;
    }),
});
