import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { AuditActorType, Prisma, prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { recordAuditLog } from '../audit';

async function requireStaff(tenantId: string, clerkUserId: string) {
  const staff = await prisma.staffMembership.findFirst({
    where: { user: { clerkUserId }, church: { organization: { tenantId } } },
  });
  if (!staff) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Staff access required' });
  }
  return staff;
}

const churchSlugSchema = z.string().trim().min(2).max(80).regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  'Slug must use lowercase letters, numbers, and hyphens only'
);
const countryCodeSchema = z.string().trim().regex(/^[A-Z]{2}$/, 'Use a two-letter country code');

function rethrowChurchSlugConflict(error: unknown): never {
  if ((error as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'That church slug is already in use. Choose another one.',
    });
  }
  throw error;
}

const createChurchSchema = z.object({
  name: z.string().min(2),
  slug: churchSlugSchema,
  organizationId: z.string(),
  timezone: z.string().default('UTC'),
  countryCode: countryCodeSchema,
});

export const churchRouter = router({
  create: protectedProcedure
    .input(createChurchSchema)
    .mutation(async ({ input, ctx }) => {
      await requireStaff(ctx.tenantId!, ctx.userId!);
      const organization = await prisma.organization.findFirst({
        where: { id: input.organizationId, tenantId: ctx.tenantId! },
      });

      if (!organization) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
      }

      const church = await prisma.church.create({ data: input }).catch(rethrowChurchSlugConflict);
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
        slug: churchSlugSchema.optional(),
        timezone: z.string().optional(),
        countryCode: countryCodeSchema.optional(),
        quietHoursEnabled: z.boolean().optional(),
        quietHoursStartHour: z.number().int().min(0).max(23).optional(),
        quietHoursEndHour: z.number().int().min(0).max(23).optional(),
        quietHoursRescheduleMinutes: z.number().int().min(5).max(180).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireStaff(ctx.tenantId!, ctx.userId!);
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
          quietHoursEnabled: input.quietHoursEnabled,
          quietHoursStartHour: input.quietHoursStartHour,
          quietHoursEndHour: input.quietHoursEndHour,
          quietHoursRescheduleMinutes: input.quietHoursRescheduleMinutes,
        },
      }).catch(rethrowChurchSlugConflict);

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
