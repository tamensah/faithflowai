import { TRPCError } from '@trpc/server';
import { prisma, UserRole } from '@faithflow-ai/database';
import { router, protectedProcedure } from '../trpc';

const getStaffMembership = async (tenantId: string, clerkUserId: string) => {
  return prisma.staffMembership.findFirst({
    where: {
      user: { clerkUserId },
      church: { organization: { tenantId } },
    },
    include: { church: true, user: true },
  });
};

const getDefaultChurch = async (tenantId: string) => {
  return prisma.church.findFirst({
    where: { organization: { tenantId } },
    orderBy: { createdAt: 'asc' },
  });
};

export const authRouter = router({
  self: protectedProcedure.query(async ({ ctx }) => {
    const membership = await getStaffMembership(ctx.tenantId!, ctx.userId!);
    const staffCount = await prisma.staffMembership.count({
      where: { church: { organization: { tenantId: ctx.tenantId! } } },
    });

    return {
      isStaff: Boolean(membership),
      role: membership?.role ?? null,
      churchId: membership?.churchId ?? null,
      userId: membership?.userId ?? null,
      bootstrapAllowed: staffCount === 0,
    };
  }),

  bootstrap: protectedProcedure.mutation(async ({ ctx }) => {
    const existing = await getStaffMembership(ctx.tenantId!, ctx.userId!);
    if (existing) {
      return {
        isStaff: true,
        role: existing.role,
        churchId: existing.churchId,
        userId: existing.userId,
        bootstrapped: false,
      };
    }

    const staffCount = await prisma.staffMembership.count({
      where: { church: { organization: { tenantId: ctx.tenantId! } } },
    });
    if (staffCount > 0) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Staff already configured for this tenant' });
    }

    const church = await getDefaultChurch(ctx.tenantId!);
    if (!church) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'No church found for tenant' });
    }

    const user = await prisma.user.upsert({
      where: { clerkUserId: ctx.userId! },
      update: {},
      create: {
        clerkUserId: ctx.userId!,
        email: `unknown+${ctx.userId}@faithflow.local`,
        name: 'Staff Admin',
        role: UserRole.ADMIN,
      },
    });

    const membership = await prisma.staffMembership.create({
      data: {
        userId: user.id,
        churchId: church.id,
        role: UserRole.ADMIN,
      },
    });

    return {
      isStaff: true,
      role: membership.role,
      churchId: membership.churchId,
      userId: membership.userId,
      bootstrapped: true,
    };
  }),
});
