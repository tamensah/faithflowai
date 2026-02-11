import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';

const createHouseholdSchema = z.object({
  churchId: z.string(),
  name: z.string().optional(),
  primaryMemberId: z.string().optional(),
});

const updateHouseholdSchema = z.object({
  name: z.string().optional(),
  primaryMemberId: z.string().optional(),
});

export const householdRouter = router({
  create: protectedProcedure
    .input(createHouseholdSchema)
    .mutation(async ({ input, ctx }) => {
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      if (input.primaryMemberId) {
        const member = await prisma.member.findFirst({
          where: { id: input.primaryMemberId, churchId: input.churchId },
        });
        if (!member) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Primary member not found' });
        }
      }

      return prisma.household.create({
        data: {
          churchId: input.churchId,
          name: input.name,
          primaryMemberId: input.primaryMemberId,
        },
      });
    }),

  list: protectedProcedure
    .input(z.object({ churchId: z.string().optional(), limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ input, ctx }) => {
      return prisma.household.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        include: { members: true, primaryMember: true },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: updateHouseholdSchema }))
    .mutation(async ({ input, ctx }) => {
      const household = await prisma.household.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!household) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Household not found' });
      }

      if (input.data.primaryMemberId) {
        const member = await prisma.member.findFirst({
          where: { id: input.data.primaryMemberId, churchId: household.churchId },
        });
        if (!member) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Primary member not found' });
        }
      }

      return prisma.household.update({
        where: { id: input.id },
        data: input.data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const household = await prisma.household.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!household) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Household not found' });
      }

      return prisma.household.delete({ where: { id: input.id } });
    }),

  addMember: protectedProcedure
    .input(z.object({ householdId: z.string(), memberId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const household = await prisma.household.findFirst({
        where: { id: input.householdId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!household) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Household not found' });
      }

      const member = await prisma.member.findFirst({
        where: { id: input.memberId, churchId: household.churchId },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      return prisma.member.update({
        where: { id: input.memberId },
        data: { householdId: household.id },
      });
    }),

  removeMember: protectedProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const member = await prisma.member.findFirst({
        where: { id: input.memberId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      return prisma.member.update({
        where: { id: input.memberId },
        data: { householdId: null },
      });
    }),
});
