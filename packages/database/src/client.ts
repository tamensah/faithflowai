import path from 'node:path';
import { config } from 'dotenv';
import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

config({
  path: process.env.DOTENV_CONFIG_PATH ?? path.join(process.cwd(), '.env.local'),
});

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __prismaPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool = globalThis.__prismaPool ?? new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma = global.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prismaPool = pool;
}

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
