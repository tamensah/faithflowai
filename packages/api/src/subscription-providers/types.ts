import { z } from 'zod';

export const saasBillingProviderSchema = z.enum(['POLAR', 'PAYSTACK', 'STRIPE']);

export type SaasBillingProvider = z.infer<typeof saasBillingProviderSchema>;
