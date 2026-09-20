import { defineConfig } from '@neon/config/v1';

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required. Pass the reviewed Neon environment file with --env.`);
  }
  return value;
}

const optionalEnvironmentNames = [
  'CLERK_JWT_KEY',
  'CLERK_JWT_ISSUER',
  'CLERK_JWT_AUDIENCE',
  'CLERK_WEBHOOK_SECRET',
  'PLATFORM_ADMIN_EMAILS',
  'RESEND_FROM_EMAIL',
  'COMMS_QUIET_HOURS_ENABLED',
  'COMMS_UNSUBSCRIBE_SECRET',
  'FCM_SERVER_KEY',
  'PAYSTACK_SECRET_KEY',
  'PAYSTACK_WEBHOOK_SECRET',
  'PLATFORM_PAYSTACK_WEBHOOK_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'PLATFORM_STRIPE_WEBHOOK_SECRET',
  'INTEGRATION_API_KEY',
  'ALLOWED_CHECKOUT_REDIRECT_ORIGINS',
  'STREAM_SIGNING_SECRET',
  'RECEIPT_PUBLIC_SECRET',
  'DOMAIN_INCIDENT_AUTO_CLOSE',
  'DOMAIN_PENDING_ESCALATION_HOURS',
  'AUTH_POLICY_ENFORCE_SSO_STRICT',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_SMS_NUMBER',
  'TWILIO_WEBHOOK_URL',
  'TWILIO_SMS_WEBHOOK_URL',
  'TWILIO_WHATSAPP_WEBHOOK_URL',
  'TWILIO_WHATSAPP_NUMBER',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY',
  'AI_OPENAI_MODEL',
  'AI_ANTHROPIC_MODEL',
  'AI_GOOGLE_MODEL',
  'YOUTUBE_API_KEY',
  'FACEBOOK_PAGE_ACCESS_TOKEN',
  'VIMEO_ACCESS_TOKEN',
  'STREAMING_SYNC_HTTP_TIMEOUT_MS',
  'STORAGE_PROVIDER',
  'UPLOAD_MAX_BYTES',
  'S3_BUCKET',
  'S3_REGION',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_PUBLIC_URL',
  'S3_ENDPOINT',
  'S3_PUBLIC_READ',
  'S3_FORCE_PATH_STYLE',
  'GCS_BUCKET',
  'GCS_PROJECT_ID',
  'GCS_CLIENT_EMAIL',
  'GCS_PRIVATE_KEY',
  'GCS_KEYFILE_PATH',
  'GCS_PUBLIC_URL',
] as const;

const optionalEnvironment = Object.fromEntries(
  optionalEnvironmentNames.flatMap((name) => {
    const value = process.env[name]?.trim();
    return value ? [[name, value]] : [];
  })
);

export default defineConfig({
  functions: {
    faithflowapi: {
      name: 'FaithFlow API',
      source: './apps/api/src/neon-function.ts',
      env: {
        DATABASE_URL: requiredEnv('DATABASE_URL'),
        ALLOWED_ORIGINS: requiredEnv('ALLOWED_ORIGINS'),
        CLERK_SECRET_KEY: requiredEnv('CLERK_SECRET_KEY'),
        NEXT_PUBLIC_WEB_URL: requiredEnv('NEXT_PUBLIC_WEB_URL'),
        NEXT_PUBLIC_ADMIN_URL: requiredEnv('NEXT_PUBLIC_ADMIN_URL'),
        RESEND_API_KEY: requiredEnv('RESEND_API_KEY'),
        NODE_ENV: 'production',
        ENABLE_INTERNAL_SCHEDULER: 'false',
        ...optionalEnvironment,
      },
    },
  },
  triggers: {
    'support-sla-sweep': {
      type: 'schedule',
      function: 'faithflowapi',
      cron: '*/5 * * * *',
      functionPath: '/__triggers/support-sla',
    },
    'tenant-ops-automation': {
      type: 'schedule',
      function: 'faithflowapi',
      cron: '*/15 * * * *',
      functionPath: '/__triggers/tenant-ops',
    },
    'subscription-metadata-backfill': {
      type: 'schedule',
      function: 'faithflowapi',
      cron: '10 2 * * *',
      functionPath: '/__triggers/subscription-metadata',
    },
    'streaming-provider-sync': {
      type: 'schedule',
      function: 'faithflowapi',
      cron: '*/10 * * * *',
      functionPath: '/__triggers/streaming-sync',
    },
  },
  branch: () => ({
    functions: {
      faithflowapi: { runtime: 'nodejs24' },
    },
  }),
});
