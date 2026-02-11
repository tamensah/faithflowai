import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { AuditActorType, prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { ensureDonationReceipt, getReceiptByNumber, renderReceiptHtml } from '../receipts';
import { sendEmail } from '../email';
import { recordAuditLog } from '../audit';

export const receiptRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
        limit: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ input, ctx }) => {
      return prisma.donationReceipt.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { issuedAt: 'desc' },
        take: input.limit,
      });
    }),

  getByDonation: protectedProcedure
    .input(z.object({ donationId: z.string() }))
    .query(async ({ input, ctx }) => {
      const receipt = await prisma.donationReceipt.findFirst({
        where: {
          donationId: input.donationId,
          church: { organization: { tenantId: ctx.tenantId! } },
        },
      });

      if (!receipt) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Receipt not found' });
      }

      return receipt;
    }),

  issue: protectedProcedure
    .input(z.object({ donationId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const donation = await prisma.donation.findFirst({
        where: {
          id: input.donationId,
          church: { organization: { tenantId: ctx.tenantId! } },
        },
      });

      if (!donation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Donation not found' });
      }

      if (donation.status !== 'COMPLETED') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Donation is not completed' });
      }

      const receipt = await ensureDonationReceipt(donation.id);
      if (!receipt) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to issue receipt' });
      }

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: receipt.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'receipt.issued',
        targetType: 'DonationReceipt',
        targetId: receipt.id,
        metadata: { receiptNumber: receipt.receiptNumber },
      });

      return receipt;
    }),

  sendEmail: protectedProcedure
    .input(z.object({ receiptNumber: z.string(), to: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      const receipt = await getReceiptByNumber(input.receiptNumber);

      if (!receipt) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Receipt not found' });
      }

      const church = await prisma.church.findFirst({
        where: { id: receipt.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Receipt not found' });
      }

      const html = renderReceiptHtml(receipt);
      await sendEmail({
        to: input.to,
        subject: `Your donation receipt ${receipt.receiptNumber}`,
        html,
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: receipt.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'receipt.emailed',
        targetType: 'DonationReceipt',
        targetId: receipt.id,
        metadata: { receiptNumber: receipt.receiptNumber, to: input.to },
      });

      return { ok: true };
    }),

  void: protectedProcedure
    .input(z.object({ receiptNumber: z.string(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const receipt = await prisma.donationReceipt.findFirst({
        where: {
          receiptNumber: input.receiptNumber,
          church: { organization: { tenantId: ctx.tenantId! } },
        },
      });

      if (!receipt) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Receipt not found' });
      }

      if (receipt.status === 'VOIDED') {
        return receipt;
      }

      const updated = await prisma.donationReceipt.update({
        where: { id: receipt.id },
        data: { status: 'VOIDED', voidReason: input.reason },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: updated.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'receipt.voided',
        targetType: 'DonationReceipt',
        targetId: updated.id,
        metadata: { receiptNumber: updated.receiptNumber, reason: input.reason },
      });

      return updated;
    }),
});
