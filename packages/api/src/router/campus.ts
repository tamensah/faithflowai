import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { prisma, AuditActorType } from '@faithflow-ai/database';
import { router, protectedProcedure } from '../trpc';
import { ensureFeatureEnabled, ensureFeatureLimit } from '../entitlements';
import { recordAuditLog } from '../audit';

const campusInput = z.object({
  churchId: z.string(),
  name: z.string().min(2),
  timezone: z.string().optional(),
});

export const campusRouter = router({
  list: protectedProcedure
    .input(z.object({ churchId: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      return prisma.campus.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input?.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: [{ churchId: 'asc' }, { createdAt: 'asc' }],
      });
    }),

  create: protectedProcedure
    .input(campusInput)
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureEnabled(
        ctx.tenantId!,
        'multi_campus_enabled',
        'Your subscription does not include multi-campus operations.'
      );
      const currentCampusCount = await prisma.campus.count({
        where: { church: { organization: { tenantId: ctx.tenantId! } } },
      });
      await ensureFeatureLimit(
        ctx.tenantId!,
        'max_campuses',
        currentCampusCount,
        1,
        'Campus limit reached for your subscription.'
      );

      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });

      const campus = await prisma.campus.create({
        data: {
          churchId: input.churchId,
          name: input.name,
          timezone: input.timezone ?? church.timezone,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: church.id,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'campus.created',
        targetType: 'Campus',
        targetId: campus.id,
        metadata: { name: campus.name, timezone: campus.timezone },
      });

      return campus;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).optional(),
        timezone: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const campus = await prisma.campus.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!campus) throw new TRPCError({ code: 'NOT_FOUND', message: 'Campus not found' });

      const updated = await prisma.campus.update({
        where: { id: input.id },
        data: {
          name: input.name,
          timezone: input.timezone,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: campus.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'campus.updated',
        targetType: 'Campus',
        targetId: updated.id,
        metadata: { name: updated.name, timezone: updated.timezone },
      });

      return updated;
    }),
});
