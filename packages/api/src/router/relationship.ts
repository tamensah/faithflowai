import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { MemberRelationshipType, prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';

const createRelationshipSchema = z.object({
  churchId: z.string(),
  fromMemberId: z.string(),
  toMemberId: z.string(),
  type: z.nativeEnum(MemberRelationshipType),
  label: z.string().optional(),
  notes: z.string().optional(),
  createReciprocal: z.boolean().optional(),
  reciprocalType: z.nativeEnum(MemberRelationshipType).optional(),
});

const reciprocalDefaults: Record<MemberRelationshipType, MemberRelationshipType> = {
  SPOUSE: MemberRelationshipType.SPOUSE,
  PARENT: MemberRelationshipType.CHILD,
  CHILD: MemberRelationshipType.PARENT,
  SIBLING: MemberRelationshipType.SIBLING,
  GUARDIAN: MemberRelationshipType.CHILD,
  MENTOR: MemberRelationshipType.DISCIPLE,
  DISCIPLE: MemberRelationshipType.MENTOR,
  FRIEND: MemberRelationshipType.FRIEND,
  CAREGIVER: MemberRelationshipType.CAREGIVER,
  EMERGENCY_CONTACT: MemberRelationshipType.EMERGENCY_CONTACT,
  OTHER: MemberRelationshipType.OTHER,
};

export const relationshipRouter = router({
  create: protectedProcedure
    .input(createRelationshipSchema)
    .mutation(async ({ input, ctx }) => {
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      const [fromMember, toMember] = await Promise.all([
        prisma.member.findFirst({ where: { id: input.fromMemberId, churchId: church.id } }),
        prisma.member.findFirst({ where: { id: input.toMemberId, churchId: church.id } }),
      ]);

      if (!fromMember || !toMember) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      const relationship = await prisma.memberRelationship.upsert({
        where: {
          fromMemberId_toMemberId_type: {
            fromMemberId: input.fromMemberId,
            toMemberId: input.toMemberId,
            type: input.type,
          },
        },
        update: {
          label: input.label,
          notes: input.notes,
        },
        create: {
          churchId: church.id,
          fromMemberId: input.fromMemberId,
          toMemberId: input.toMemberId,
          type: input.type,
          label: input.label,
          notes: input.notes,
        },
      });

      if (input.createReciprocal) {
        const reciprocalType = input.reciprocalType ?? reciprocalDefaults[input.type];
        await prisma.memberRelationship.upsert({
          where: {
            fromMemberId_toMemberId_type: {
              fromMemberId: input.toMemberId,
              toMemberId: input.fromMemberId,
              type: reciprocalType,
            },
          },
          update: {
            label: input.label,
            notes: input.notes,
          },
          create: {
            churchId: church.id,
            fromMemberId: input.toMemberId,
            toMemberId: input.fromMemberId,
            type: reciprocalType,
            label: input.label,
            notes: input.notes,
          },
        });
      }

      return relationship;
    }),

  listForMember: protectedProcedure
    .input(z.object({ memberId: z.string() }))
    .query(async ({ input, ctx }) => {
      return prisma.memberRelationship.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          OR: [{ fromMemberId: input.memberId }, { toMemberId: input.memberId }],
        },
        include: {
          fromMember: true,
          toMember: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  graph: protectedProcedure
    .input(z.object({ memberId: z.string() }))
    .query(async ({ input, ctx }) => {
      const relationships = await prisma.memberRelationship.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          OR: [{ fromMemberId: input.memberId }, { toMemberId: input.memberId }],
        },
        include: {
          fromMember: true,
          toMember: true,
        },
      });

      const nodes = new Map<string, { id: string; name: string }>();
      const edges = relationships.map((rel) => {
        const fromName = `${rel.fromMember.firstName} ${rel.fromMember.lastName}`.trim();
        const toName = `${rel.toMember.firstName} ${rel.toMember.lastName}`.trim();
        nodes.set(rel.fromMemberId, { id: rel.fromMemberId, name: fromName });
        nodes.set(rel.toMemberId, { id: rel.toMemberId, name: toName });
        return {
          id: rel.id,
          fromMemberId: rel.fromMemberId,
          toMemberId: rel.toMemberId,
          type: rel.type,
          label: rel.label,
        };
      });

      return {
        nodes: Array.from(nodes.values()),
        edges,
      };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const relationship = await prisma.memberRelationship.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!relationship) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Relationship not found' });
      }

      return prisma.memberRelationship.delete({ where: { id: relationship.id } });
    }),
});
