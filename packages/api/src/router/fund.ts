import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { AuditActorType, prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { recordAuditLog } from '../audit';

const createFundSchema = z.object({
  churchId: z.string(),
  name: z.string().min(2),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export const fundRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      return prisma.fund.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { createdAt: 'asc' },
      });
    }),

  create: protectedProcedure
    .input(createFundSchema)
    .mutation(async ({ input, ctx }) => {
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });

      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      if (input.isDefault) {
        const [_, fund] = await prisma.$transaction([
          prisma.fund.updateMany({
            where: { churchId: input.churchId, isDefault: true },
            data: { isDefault: false },
          }),
          prisma.fund.create({
            data: {
              churchId: input.churchId,
              name: input.name,
              description: input.description,
              isDefault: true,
            },
          }),
        ]);
        await recordAuditLog({
          tenantId: ctx.tenantId,
          churchId: fund.churchId,
          actorType: AuditActorType.USER,
          actorId: ctx.userId,
          action: 'fund.created',
          targetType: 'Fund',
          targetId: fund.id,
          metadata: { name: fund.name, isDefault: fund.isDefault },
        });
        return fund;
      }

      const fund = await prisma.fund.create({
        data: {
          churchId: input.churchId,
          name: input.name,
          description: input.description,
          isDefault: false,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: fund.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'fund.created',
        targetType: 'Fund',
        targetId: fund.id,
        metadata: { name: fund.name, isDefault: fund.isDefault },
      });

      return fund;
    }),
});
