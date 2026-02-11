import path from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';

config({
  path: process.env.DOTENV_CONFIG_PATH ?? path.join(process.cwd(), '.env.local'),
});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),
  CLERK_JWT_KEY: z.string().optional(),
  CLERK_JWT_ISSUER: z.string().optional(),
  CLERK_JWT_AUDIENCE: z.string().optional(),
  CLERK_WEBHOOK_SECRET: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  PLATFORM_ADMIN_EMAILS: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PLATFORM_STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),
  PLATFORM_PAYSTACK_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  FCM_SERVER_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_SMS_NUMBER: z.string().optional(),
  TWILIO_WEBHOOK_URL: z.string().url().optional(),
  NEXT_PUBLIC_WEB_URL: z.string().url().optional(),
  NEXT_PUBLIC_ADMIN_URL: z.string().url().optional(),
  INTEGRATION_API_KEY: z.string().optional(),
  ENABLE_INTERNAL_SCHEDULER: z.string().optional(),
  SCHEDULER_TIMEZONE: z.string().default('UTC'),
  CRON_SUBSCRIPTION_METADATA_BACKFILL: z.string().default('10 2 * * *'),
  CRON_TENANT_OPS_AUTOMATE: z.string().default('*/15 * * * *'),
  CRON_SUPPORT_SLA_SWEEP: z.string().default('*/5 * * * *'),
  STORAGE_PROVIDER: z.enum(['S3', 'GCS']).optional(),
  UPLOAD_MAX_BYTES: z.coerce.number().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_PUBLIC_READ: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.string().optional(),
  GCS_BUCKET: z.string().optional(),
  GCS_PROJECT_ID: z.string().optional(),
  GCS_CLIENT_EMAIL: z.string().optional(),
  GCS_PRIVATE_KEY: z.string().optional(),
  GCS_KEYFILE_PATH: z.string().optional(),
  GCS_PUBLIC_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);
