import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from './context';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx });
});

const requireTenant = t.middleware(({ ctx, next }) => {
  if (!ctx.tenantId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing tenant context' });
  }
  if (ctx.tenantStatus === 'SUSPENDED') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Tenant suspended' });
  }
  return next({ ctx });
});

export const userProcedure = t.procedure.use(requireAuth);
export const protectedProcedure = t.procedure.use(requireAuth).use(requireTenant);
