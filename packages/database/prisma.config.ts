import { defineConfig } from 'prisma/config';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';

// Load env for Prisma CLI when executed from packages/database.
// Prefer package-local env, then fall back to repo root env.
loadEnv();
loadEnv({ path: path.resolve(process.cwd(), '../../.env') });
loadEnv({ path: path.resolve(process.cwd(), '../../.env.local') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Prisma migrations need a direct Neon connection. Application traffic
    // continues to use the pooled DATABASE_URL through the runtime adapter.
    url:
      process.env['DIRECT_URL'] ??
      process.env['DATABASE_URL_UNPOOLED'] ??
      process.env['DATABASE_URL'],
  },
});
