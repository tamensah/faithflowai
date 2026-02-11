import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { MemberMilestoneType, prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';

const createMilestoneSchema = z.object({
  memberId: z.string(),
  type: z.nativeEnum(MemberMilestoneType),
  date: z.coerce.date(),
  notes: z.string().optional(),
});

export const memberMilestoneRouter = router({
  create: protectedProcedure
    .input(createMilestoneSchema)
    .mutation(async ({ input, ctx }) => {
      const member = await prisma.member.findFirst({
        where: { id: input.memberId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      return prisma.memberMilestone.create({
        data: {
          memberId: input.memberId,
          type: input.type,
          date: input.date,
          notes: input.notes,
        },
      });
    }),

  list: protectedProcedure
    .input(z.object({ memberId: z.string() }))
    .query(async ({ input, ctx }) => {
      const member = await prisma.member.findFirst({
        where: { id: input.memberId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      return prisma.memberMilestone.findMany({
        where: { memberId: input.memberId },
        orderBy: { date: 'desc' },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const milestone = await prisma.memberMilestone.findFirst({
        where: { id: input.id, member: { church: { organization: { tenantId: ctx.tenantId! } } } },
      });
      if (!milestone) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Milestone not found' });
      }

      return prisma.memberMilestone.delete({ where: { id: input.id } });
    }),
});
