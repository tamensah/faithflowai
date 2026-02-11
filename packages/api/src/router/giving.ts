import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { checkoutInputSchema } from '../payments/inputs';
import { createDonationCheckout } from '../payments';
import { prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';

const protectedCheckoutSchema = checkoutInputSchema.safeExtend({
  churchId: z.string(),
});

export const givingRouter = router({
  createCheckout: protectedProcedure
    .input(protectedCheckoutSchema)
    .mutation(async ({ input, ctx }) => {
      return createDonationCheckout({ ...input, tenantId: ctx.tenantId });
    }),

  createCheckoutPublic: publicProcedure
    .input(checkoutInputSchema)
    .mutation(async ({ input }) => {
      return createDonationCheckout({ ...input, tenantId: null });
    }),

  churchBySlug: publicProcedure
    .input(
      z.object({
        slug: z.string(),
      })
    )
    .query(async ({ input }) => {
      const church = await prisma.church.findFirst({
        where: { slug: input.slug },
        select: { id: true, name: true, slug: true, timezone: true, countryCode: true },
      });

      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      return church;
    }),
});
