import { TRPCError } from '@trpc/server';
import { prisma, StaffInviteStatus, UserRole } from '@faithflow-ai/database';
import { createClerkClient } from '@clerk/backend';
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

const clerk = process.env.CLERK_SECRET_KEY
  ? createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
  : null;

const requireStaff = async (tenantId: string, clerkUserId: string) => {
  const membership = await prisma.staffMembership.findFirst({
    where: { user: { clerkUserId }, church: { organization: { tenantId } } },
    include: { user: true, church: true },
  });
  if (!membership) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Staff access required' });
  }
  return membership;
};

const requireAdmin = async (tenantId: string, clerkUserId: string) => {
  const membership = await requireStaff(tenantId, clerkUserId);
  if (membership.role !== UserRole.ADMIN) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return membership;
};

export const staffRouter = router({
  list: protectedProcedure
    .input(z.object({ churchId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      await requireStaff(ctx.tenantId!, ctx.userId!);
      return prisma.staffMembership.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        include: { user: true, church: true },
        orderBy: { createdAt: 'desc' },
      });
    }),

  listInvites: protectedProcedure
    .input(z.object({ churchId: z.string().optional(), status: z.nativeEnum(StaffInviteStatus).optional() }))
    .query(async ({ input, ctx }) => {
      await requireAdmin(ctx.tenantId!, ctx.userId!);
      return prisma.staffInvite.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
          ...(input.status ? { status: input.status } : {}),
        },
        include: { church: true },
        orderBy: { createdAt: 'desc' },
      });
    }),

  invite: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
        churchId: z.string(),
        role: z.nativeEnum(UserRole).default(UserRole.STAFF),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAdmin(ctx.tenantId!, ctx.userId!);

      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      if (!clerk || !ctx.clerkOrgId) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Clerk secret key or organization context is missing',
        });
      }

      let clerkInvitationId: string | undefined;
      try {
        const invitation = await clerk.organizations.createOrganizationInvitation({
          organizationId: ctx.clerkOrgId,
          emailAddress: input.email,
          role: input.role === UserRole.ADMIN ? 'org:admin' : 'org:member',
          redirectUrl: process.env.NEXT_PUBLIC_ADMIN_URL ?? process.env.NEXT_PUBLIC_WEB_URL ?? undefined,
          publicMetadata: {
            churchId: input.churchId,
            staffRole: input.role,
          },
        });
        clerkInvitationId = invitation?.id;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Unable to send Clerk invitation',
        });
      }

      return prisma.staffInvite.upsert({
        where: { churchId_email: { churchId: input.churchId, email: input.email } },
        update: {
          role: input.role,
          invitedByClerkUserId: ctx.userId ?? undefined,
          clerkInvitationId,
          status: StaffInviteStatus.PENDING,
        },
        create: {
          churchId: input.churchId,
          email: input.email,
          role: input.role,
          invitedByClerkUserId: ctx.userId ?? undefined,
          clerkInvitationId,
          status: StaffInviteStatus.PENDING,
        },
        include: { church: true },
      });
    }),

  acceptInvite: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      const invite = await prisma.staffInvite.findFirst({
        where: {
          email: input.email,
          status: StaffInviteStatus.PENDING,
          church: { organization: { tenantId: ctx.tenantId! } },
        },
        include: { church: true },
      });
      if (!invite) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No pending invite found' });
      }

      const user = await prisma.user.upsert({
        where: { clerkUserId: ctx.userId! },
        update: { email: input.email, role: invite.role },
        create: {
          clerkUserId: ctx.userId!,
          email: input.email,
          role: invite.role,
        },
      });

      const membership = await prisma.staffMembership.upsert({
        where: { userId_churchId: { userId: user.id, churchId: invite.churchId } },
        update: { role: invite.role },
        create: {
          userId: user.id,
          churchId: invite.churchId,
          role: invite.role,
        },
      });

      await prisma.staffInvite.update({
        where: { id: invite.id },
        data: {
          status: StaffInviteStatus.ACCEPTED,
          clerkUserId: ctx.userId ?? undefined,
          acceptedAt: new Date(),
        },
      });

      return { accepted: true, membership };
    }),

  cancelInvite: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await requireAdmin(ctx.tenantId!, ctx.userId!);
      const invite = await prisma.staffInvite.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!invite) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invite not found' });
      }
      return prisma.staffInvite.update({
        where: { id: invite.id },
        data: { status: StaffInviteStatus.CANCELED },
        include: { church: true },
      });
    }),

  upsert: protectedProcedure
    .input(
      z.object({
        clerkUserId: z.string().min(1),
        email: z.string().email(),
        name: z.string().optional(),
        churchId: z.string(),
        role: z.nativeEnum(UserRole).default(UserRole.STAFF),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAdmin(ctx.tenantId!, ctx.userId!);

      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      const user = await prisma.user.upsert({
        where: { clerkUserId: input.clerkUserId },
        update: {
          email: input.email,
          name: input.name ?? undefined,
          role: input.role,
        },
        create: {
          clerkUserId: input.clerkUserId,
          email: input.email,
          name: input.name ?? undefined,
          role: input.role,
        },
      });

      return prisma.staffMembership.upsert({
        where: { userId_churchId: { userId: user.id, churchId: input.churchId } },
        update: { role: input.role },
        create: {
          userId: user.id,
          churchId: input.churchId,
          role: input.role,
        },
        include: { user: true, church: true },
      });
    }),

  updateRole: protectedProcedure
    .input(z.object({ id: z.string(), role: z.nativeEnum(UserRole) }))
    .mutation(async ({ input, ctx }) => {
      await requireAdmin(ctx.tenantId!, ctx.userId!);
      const membership = await prisma.staffMembership.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!membership) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Staff membership not found' });
      }
      return prisma.staffMembership.update({
        where: { id: input.id },
        data: { role: input.role },
        include: { user: true, church: true },
      });
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await requireAdmin(ctx.tenantId!, ctx.userId!);
      const membership = await prisma.staffMembership.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!membership) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Staff membership not found' });
      }
      await prisma.staffMembership.delete({ where: { id: input.id } });
      return { removed: true };
    }),
});
