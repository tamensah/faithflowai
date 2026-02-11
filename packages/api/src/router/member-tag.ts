import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';

const createTagSchema = z.object({
  churchId: z.string(),
  name: z.string().min(1),
  color: z.string().optional(),
  description: z.string().optional(),
});

const updateTagSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  description: z.string().optional(),
});

export const memberTagRouter = router({
  create: protectedProcedure
    .input(createTagSchema)
    .mutation(async ({ input, ctx }) => {
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      return prisma.memberTag.create({
        data: {
          churchId: input.churchId,
          name: input.name,
          color: input.color,
          description: input.description,
        },
      });
    }),

  list: protectedProcedure
    .input(z.object({ churchId: z.string().optional(), limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ input, ctx }) => {
      return prisma.memberTag.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { name: 'asc' },
        take: input.limit,
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: updateTagSchema }))
    .mutation(async ({ input, ctx }) => {
      const tag = await prisma.memberTag.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!tag) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tag not found' });
      }

      return prisma.memberTag.update({
        where: { id: input.id },
        data: input.data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const tag = await prisma.memberTag.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!tag) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tag not found' });
      }

      return prisma.memberTag.delete({ where: { id: input.id } });
    }),

  assign: protectedProcedure
    .input(z.object({ memberId: z.string(), tagId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const member = await prisma.member.findFirst({
        where: { id: input.memberId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      const tag = await prisma.memberTag.findFirst({
        where: { id: input.tagId, churchId: member.churchId },
      });
      if (!tag) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tag not found' });
      }

      return prisma.memberTagAssignment.upsert({
        where: { memberId_tagId: { memberId: member.id, tagId: tag.id } },
        update: {},
        create: { memberId: member.id, tagId: tag.id },
      });
    }),

  unassign: protectedProcedure
    .input(z.object({ memberId: z.string(), tagId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const member = await prisma.member.findFirst({
        where: { id: input.memberId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      return prisma.memberTagAssignment.deleteMany({
        where: { memberId: input.memberId, tagId: input.tagId },
      });
    }),
});
