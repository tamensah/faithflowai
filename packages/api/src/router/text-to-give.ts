import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { AuditActorType, PaymentProvider, prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { recordAuditLog } from '../audit';

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, '');
}

const createNumberSchema = z.object({
  churchId: z.string(),
  phoneNumber: z.string().min(6),
  provider: z
    .nativeEnum(PaymentProvider)
    .default(PaymentProvider.STRIPE)
    .refine((value) => value !== PaymentProvider.MANUAL, {
      message: 'Manual provider is not supported',
    }),
  defaultCurrency: z.string().default('USD'),
  fundId: z.string().optional(),
  campaignId: z.string().optional(),
});

const updateNumberSchema = createNumberSchema.partial().extend({
  id: z.string(),
});

export const textToGiveRouter = router({
  list: protectedProcedure
    .input(z.object({ churchId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      return prisma.textToGiveNumber.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: { fund: true, campaign: true },
      });
    }),

  create: protectedProcedure
    .input(createNumberSchema)
    .mutation(async ({ input, ctx }) => {
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      if (input.fundId) {
        const fund = await prisma.fund.findFirst({ where: { id: input.fundId, churchId: input.churchId } });
        if (!fund) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Fund not found' });
        }
      }

      if (input.campaignId) {
        const campaign = await prisma.campaign.findFirst({ where: { id: input.campaignId, churchId: input.churchId } });
        if (!campaign) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
        }
      }

      const number = await prisma.textToGiveNumber.create({
        data: {
          churchId: input.churchId,
          phoneNumber: normalizePhone(input.phoneNumber),
          provider: input.provider,
          defaultCurrency: input.defaultCurrency.toUpperCase(),
          fundId: input.fundId,
          campaignId: input.campaignId,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: number.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'text_to_give.number_created',
        targetType: 'TextToGiveNumber',
        targetId: number.id,
        metadata: { phoneNumber: number.phoneNumber, provider: number.provider },
      });

      return number;
    }),

  update: protectedProcedure
    .input(updateNumberSchema)
    .mutation(async ({ input, ctx }) => {
      const number = await prisma.textToGiveNumber.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!number) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Text-to-give number not found' });
      }

      const updated = await prisma.textToGiveNumber.update({
        where: { id: input.id },
        data: {
          phoneNumber: input.phoneNumber ? normalizePhone(input.phoneNumber) : undefined,
          provider: input.provider,
          defaultCurrency: input.defaultCurrency ? input.defaultCurrency.toUpperCase() : undefined,
          fundId: input.fundId,
          campaignId: input.campaignId,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: updated.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'text_to_give.number_updated',
        targetType: 'TextToGiveNumber',
        targetId: updated.id,
        metadata: { phoneNumber: updated.phoneNumber, provider: updated.provider },
      });

      return updated;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const number = await prisma.textToGiveNumber.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!number) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Text-to-give number not found' });
      }

      await prisma.textToGiveNumber.delete({ where: { id: number.id } });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: number.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'text_to_give.number_deleted',
        targetType: 'TextToGiveNumber',
        targetId: number.id,
        metadata: { phoneNumber: number.phoneNumber },
      });

      return { ok: true };
    }),

  messages: protectedProcedure
    .input(z.object({ churchId: z.string().optional(), limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ input, ctx }) => {
      return prisma.textToGiveMessage.findMany({
        where: {
          ...(input.churchId ? { churchId: input.churchId } : {}),
          church: { organization: { tenantId: ctx.tenantId! } },
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });
    }),
});
