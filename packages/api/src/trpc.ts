import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from './context';
import { resolveTenantPlan } from './entitlements';

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

// Lockout Policy A:
// If a tenant previously had a subscription but no longer has an active one, allow reads but block writes.
// Billing routes must remain accessible so tenants can restore service.
const enforceBillingLockout = t.middleware(async ({ ctx, next, path, type }) => {
  if (type !== 'mutation') return next({ ctx });
  if (!ctx.tenantId) return next({ ctx });
  if (path.startsWith('billing.')) return next({ ctx });

  const resolved = await resolveTenantPlan(ctx.tenantId);
  if (resolved.source === 'inactive_subscription') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Subscription inactive. Update billing to restore write access.',
    });
  }

  return next({ ctx });
});

export const userProcedure = t.procedure.use(requireAuth);
export const protectedProcedure = t.procedure.use(requireAuth).use(requireTenant).use(enforceBillingLockout);
