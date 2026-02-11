import { z } from 'zod';
import { PaymentProvider } from '@faithflow-ai/database';

export const checkoutInputSchema = z
  .object({
    churchId: z.string().optional(),
    churchSlug: z.string().optional(),
    memberId: z.string().optional(),
    amount: z.number().positive(),
    currency: z
      .string()
      .default('USD')
      .transform((value) => value.toUpperCase()),
    provider: z.nativeEnum(PaymentProvider),
    donorName: z.string().optional(),
    donorEmail: z.string().email().optional(),
    donorPhone: z.string().optional(),
    fundId: z.string().optional(),
    campaignId: z.string().optional(),
    fundraiserPageId: z.string().optional(),
    pledgeId: z.string().optional(),
    recurringDonationId: z.string().optional(),
    isAnonymous: z.boolean().optional(),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
  })
  .refine((data) => data.churchId || data.churchSlug, {
    message: 'churchId or churchSlug is required',
    path: ['churchId'],
  });

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

export const recurringCheckoutInputSchema = z
  .object({
    churchId: z.string().optional(),
    churchSlug: z.string().optional(),
    memberId: z.string().optional(),
    amount: z.number().positive(),
    currency: z
      .string()
      .default('USD')
      .transform((value) => value.toUpperCase()),
    interval: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
    provider: z.nativeEnum(PaymentProvider),
    donorName: z.string().optional(),
    donorEmail: z.string().email().optional(),
    donorPhone: z.string().optional(),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
  })
  .refine((data) => data.churchId || data.churchSlug, {
    message: 'churchId or churchSlug is required',
    path: ['churchId'],
  });

export type RecurringCheckoutInput = z.infer<typeof recurringCheckoutInputSchema>;
