import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { AuditActorType, prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { recordAuditLog } from '../audit';

const pledgeInput = z.object({
  churchId: z.string(),
  memberId: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  dueDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export const pledgeRouter = router({
  list: protectedProcedure
    .input(z.object({ churchId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      return prisma.pledge.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  create: protectedProcedure
    .input(pledgeInput)
    .mutation(async ({ input, ctx }) => {
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      const pledge = await prisma.pledge.create({
        data: {
          churchId: input.churchId,
          memberId: input.memberId,
          amount: input.amount,
          currency: input.currency.toUpperCase(),
          dueDate: input.dueDate,
          notes: input.notes,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: pledge.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'pledge.created',
        targetType: 'Pledge',
        targetId: pledge.id,
        metadata: { amount: pledge.amount.toString(), currency: pledge.currency },
      });

      return pledge;
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: z.enum(['ACTIVE', 'FULFILLED', 'CANCELED']) }))
    .mutation(async ({ input, ctx }) => {
      const pledge = await prisma.pledge.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!pledge) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Pledge not found' });
      }

      const updated = await prisma.pledge.update({
        where: { id: input.id },
        data: { status: input.status },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: updated.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'pledge.status_updated',
        targetType: 'Pledge',
        targetId: updated.id,
        metadata: { status: updated.status },
      });

      return updated;
    }),

  progress: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const pledge = await prisma.pledge.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!pledge) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Pledge not found' });
      }

      const donations = await prisma.donation.findMany({
        where: {
          pledgeId: pledge.id,
          status: 'COMPLETED',
        },
      });

      const total = donations.reduce((sum, donation) => sum + Number(donation.amount), 0);
      const remaining = Math.max(0, Number(pledge.amount) - total);

      return {
        pledge,
        total,
        remaining,
      };
    }),
});
