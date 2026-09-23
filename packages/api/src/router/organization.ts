import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router, staffProcedure } from "../trpc";
import { AuditActorType, prisma } from "@faithflow-ai/database";
import { recordAuditLog } from "../audit";

export const organizationRouter = router({
  create: adminProcedure
    .input(z.object({ name: z.string().min(2) }))
    .mutation(async ({ input, ctx }) => {
      return prisma.organization.create({
        data: {
          name: input.name,
          tenantId: ctx.tenantId!,
        },
      });
    }),

  update: adminProcedure
    .input(z.object({ id: z.string(), name: z.string().trim().min(2) }))
    .mutation(async ({ input, ctx }) => {
      const result = await prisma.organization.updateMany({
        where: { id: input.id, tenantId: ctx.tenantId! },
        data: { name: input.name },
      });
      if (result.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }
      const organization = await prisma.organization.findUniqueOrThrow({
        where: { id: input.id },
      });
      await recordAuditLog({
        tenantId: ctx.tenantId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: "organization.updated",
        targetType: "Organization",
        targetId: organization.id,
        metadata: { name: organization.name },
      });
      return organization;
    }),

  list: staffProcedure.query(async ({ ctx }) => {
    return prisma.organization.findMany({
      where: { tenantId: ctx.tenantId! },
      orderBy: { createdAt: "desc" },
    });
  }),
});
