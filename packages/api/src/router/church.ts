import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { AuditActorType, prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { recordAuditLog } from '../audit';

const createChurchSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  organizationId: z.string(),
  timezone: z.string().default('UTC'),
  countryCode: z.string().min(2).max(2).optional(),
});

export const churchRouter = router({
  create: protectedProcedure
    .input(createChurchSchema)
    .mutation(async ({ input, ctx }) => {
      const organization = await prisma.organization.findFirst({
        where: { id: input.organizationId, tenantId: ctx.tenantId! },
      });

      if (!organization) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
      }

      const church = await prisma.church.create({ data: input });
      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: church.id,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'church.created',
        targetType: 'Church',
        targetId: church.id,
        metadata: { name: church.name, slug: church.slug, countryCode: church.countryCode },
      });
      return church;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).optional(),
        slug: z.string().min(2).optional(),
        timezone: z.string().optional(),
        countryCode: z.string().min(2).max(2).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const church = await prisma.church.findFirst({
        where: { id: input.id, organization: { tenantId: ctx.tenantId! } },
      });

      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      const updated = await prisma.church.update({
        where: { id: input.id },
        data: {
          name: input.name,
          slug: input.slug,
          timezone: input.timezone,
          countryCode: input.countryCode,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: updated.id,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'church.updated',
        targetType: 'Church',
        targetId: updated.id,
        metadata: { name: updated.name, slug: updated.slug, countryCode: updated.countryCode },
      });

      return updated;
    }),

  list: protectedProcedure
    .input(z.object({ organizationId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      return prisma.church.findMany({
        where: {
          organization: { tenantId: ctx.tenantId! },
          ...(input.organizationId ? { organizationId: input.organizationId } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  publicList: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ input }) => {
      return prisma.church.findMany({
        orderBy: { name: 'asc' },
        take: input?.limit ?? 20,
        select: { id: true, name: true, slug: true, countryCode: true, timezone: true },
      });
    }),
});
