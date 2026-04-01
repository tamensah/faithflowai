import { initTRPC, TRPCError } from '@trpc/server';
import { createClerkClient } from '@clerk/backend';
import { AuditActorType, UserRole, prisma } from '@faithflow-ai/database';
import superjson from 'superjson';
import type { Context } from './context';
import { resolveTenantPlan } from './entitlements';
import { recordAuditLog } from './audit';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
const clerk = process.env.CLERK_SECRET_KEY ? createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }) : null;

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

function parseIpAllowlist(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function authMethodMatchesSso(method: string) {
  const normalized = method.toLowerCase();
  return normalized.includes('sso') || normalized.includes('saml');
}

async function resolveTenantStaffRole(tenantId: string, clerkUserId: string) {
  const membership = await prisma.staffMembership.findFirst({
    where: {
      church: { organization: { tenantId } },
      user: { clerkUserId },
    },
    select: { role: true },
  });
  return membership?.role ?? null;
}

const requireTenantStaff = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId || !ctx.tenantId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  const role = await resolveTenantStaffRole(ctx.tenantId, ctx.userId);
  if (!role) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Staff access required' });
  }
  return next({ ctx });
});

const requireTenantAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId || !ctx.tenantId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  const role = await resolveTenantStaffRole(ctx.tenantId, ctx.userId);
  if (role !== UserRole.ADMIN) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

async function resolveClerkUserSignals(userId: string) {
  if (!clerk) return { twoFactorEnabled: null, emailVerified: null };
  try {
    const user = await clerk.users.getUser(userId);
    const primaryEmail = user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId);
    return {
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
      emailVerified: typeof primaryEmail?.verification?.status === 'string' ? primaryEmail.verification.status === 'verified' : null,
    };
  } catch {
    return { twoFactorEnabled: null, emailVerified: null };
  }
}

const enforceTenantSecurityPolicy = t.middleware(async ({ ctx, next, path }) => {
  if (!ctx.userId || !ctx.tenantId) return next({ ctx });

  const staffRole = await resolveTenantStaffRole(ctx.tenantId, ctx.userId);
  if (!staffRole) return next({ ctx });

  const policy = await prisma.tenantSecurityPolicy.findUnique({ where: { tenantId: ctx.tenantId } });
  if (!policy) return next({ ctx });

  const violations: string[] = [];
  const warnings: string[] = [];
  const strictSso = process.env.AUTH_POLICY_ENFORCE_SSO_STRICT === 'true';

  const authMethods = ctx.authSignals?.authMethods ?? [];
  const tokenSecondFactor = ctx.authSignals?.secondFactorVerified;
  const tokenEmailVerified = ctx.authSignals?.emailVerified;
  const tokenIssuedAt = ctx.authSignals?.sessionIssuedAtMs;
  const tokenSso = authMethods.some(authMethodMatchesSso);
  const clerkSignals = await resolveClerkUserSignals(ctx.userId);

  if (policy.requireMfaForStaff) {
    const mfaSatisfied =
      tokenSecondFactor === true ||
      (tokenSecondFactor === null && clerkSignals.twoFactorEnabled === true);
    if (!mfaSatisfied) {
      violations.push('MFA_REQUIRED');
    }
  }

  if (policy.enforceSso) {
    if (!tokenSso && strictSso) {
      violations.push('SSO_REQUIRED');
    } else if (!tokenSso && !strictSso) {
      warnings.push('SSO_ENFORCEMENT_SOFT');
    }
  }

  if (policy.sessionTimeoutMinutes > 0) {
    if (!tokenIssuedAt) {
      warnings.push('SESSION_ISSUED_AT_MISSING');
    } else {
      const ageMinutes = (Date.now() - tokenIssuedAt) / (1000 * 60);
      if (ageMinutes > policy.sessionTimeoutMinutes) {
        violations.push('SESSION_TIMEOUT');
      }
    }
  }

  const allowlist = parseIpAllowlist(policy.ipAllowlist);
  if (allowlist.length > 0) {
    if (!ctx.requestIp) {
      // Security: when an IP allowlist is configured and the request IP cannot be determined,
      // treat it as a violation rather than a warning — silent bypass is worse than a false block.
      violations.push('IP_NOT_ALLOWED');
    } else if (!allowlist.includes(ctx.requestIp)) {
      violations.push('IP_NOT_ALLOWED');
    }
  }

  const emailVerified = tokenEmailVerified ?? clerkSignals.emailVerified;
  if (emailVerified === false) {
    warnings.push('EMAIL_UNVERIFIED');
  }

  if (warnings.length > 0) {
    await recordAuditLog({
      tenantId: ctx.tenantId,
      actorType: AuditActorType.USER,
      actorId: ctx.userId,
      action: 'AUTH_GUARDRAIL_WARNING',
      targetType: 'TenantSecurityPolicy',
      targetId: policy.id,
      metadata: {
        path,
        staffRole,
        warnings,
        strictSso,
      },
    });
  }

  if (violations.length > 0) {
    await recordAuditLog({
      tenantId: ctx.tenantId,
      actorType: AuditActorType.USER,
      actorId: ctx.userId,
      action: 'AUTH_GUARDRAIL_BLOCKED',
      targetType: 'TenantSecurityPolicy',
      targetId: policy.id,
      metadata: {
        path,
        staffRole,
        violations,
        strictSso,
        requestIp: ctx.requestIp ?? null,
      },
    });

    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Security policy blocked request (${violations.join(', ')}).`,
    });
  }

  return next({ ctx });
});

// Lockout Policy A:
// If a tenant previously had a subscription but no longer has an active one, allow reads but block writes.
// Billing routes must remain accessible so tenants can restore service.
const enforceBillingLockout = t.middleware(async ({ ctx, next, path, type }) => {
  if (type !== 'mutation') return next({ ctx });
  if (!ctx.tenantId) return next({ ctx });
  // billing.* and auth.* are always exempt: tenants need these to recover from lockout
  if (path.startsWith('billing.') || path.startsWith('auth.')) return next({ ctx });

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
export const protectedProcedure = t.procedure
  .use(requireAuth)
  .use(requireTenant)
  .use(enforceTenantSecurityPolicy)
  .use(enforceBillingLockout);
export const staffProcedure = protectedProcedure.use(requireTenantStaff);
export const adminProcedure = protectedProcedure.use(requireTenantAdmin);
