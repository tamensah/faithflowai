import { TRPCError } from '@trpc/server';
import { z } from 'zod';

export const actorInputSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  roles: z.array(z.string().min(1)).default([]),
  type: z.enum(['USER', 'SYSTEM', 'INTEGRATION']).default('USER'),
});

export type PolicyActor = z.infer<typeof actorInputSchema>;

export type PolicyAction =
  | 'ORG_UNIT_READ'
  | 'ORG_UNIT_WRITE'
  | 'ROLE_ASSIGNMENT_WRITE'
  | 'AUDIT_READ'
  | 'PAYMENT_READ'
  | 'PAYMENT_WRITE'
  | 'COMMS_READ'
  | 'COMMS_WRITE';

export type PolicyScope = {
  organizationId: string;
};

export type PolicyDecision = {
  allowed: boolean;
  reason?: string;
};

const PLATFORM_SUPER_ADMIN = 'PLATFORM_SUPER_ADMIN';

const actionRoleMap: Record<PolicyAction, string[]> = {
  ORG_UNIT_READ: [
    PLATFORM_SUPER_ADMIN,
    'PLATFORM_SUPPORT',
    'CHURCH_ADMIN',
    'ORG_ADMIN',
    'STAFF',
  ],
  ORG_UNIT_WRITE: [PLATFORM_SUPER_ADMIN, 'CHURCH_ADMIN', 'ORG_ADMIN'],
  ROLE_ASSIGNMENT_WRITE: [
    PLATFORM_SUPER_ADMIN,
    'CHURCH_ADMIN',
    'ORG_ADMIN',
    'HR_ADMIN',
  ],
  AUDIT_READ: [
    PLATFORM_SUPER_ADMIN,
    'PLATFORM_SUPPORT',
    'CHURCH_ADMIN',
    'ORG_ADMIN',
  ],
  PAYMENT_READ: [
    PLATFORM_SUPER_ADMIN,
    'PLATFORM_SUPPORT',
    'CHURCH_ADMIN',
    'ORG_ADMIN',
    'STAFF',
    'FINANCE_ADMIN',
  ],
  PAYMENT_WRITE: [
    PLATFORM_SUPER_ADMIN,
    'CHURCH_ADMIN',
    'ORG_ADMIN',
    'FINANCE_ADMIN',
  ],
  COMMS_READ: [
    PLATFORM_SUPER_ADMIN,
    'PLATFORM_SUPPORT',
    'CHURCH_ADMIN',
    'ORG_ADMIN',
    'STAFF',
    'COMMS_ADMIN',
  ],
  COMMS_WRITE: [
    PLATFORM_SUPER_ADMIN,
    'CHURCH_ADMIN',
    'ORG_ADMIN',
    'STAFF',
    'COMMS_ADMIN',
  ],
};

export function normalizeRoles(roles: string[]): string[] {
  return roles.map((role) => role.trim().toUpperCase()).filter(Boolean);
}

export function evaluatePolicy(
  actor: PolicyActor,
  action: PolicyAction,
  scope: PolicyScope
): PolicyDecision {
  const roles = normalizeRoles(actor.roles);

  if (!roles.length) {
    return { allowed: false, reason: 'No roles assigned for this actor.' };
  }

  const isPlatformSuperAdmin = roles.includes(PLATFORM_SUPER_ADMIN);
  if (isPlatformSuperAdmin) {
    return { allowed: true };
  }

  if (actor.organizationId !== scope.organizationId) {
    return {
      allowed: false,
      reason: 'Cross-organization access is not allowed for this actor.',
    };
  }

  const allowedRoles = actionRoleMap[action];
  const hasAllowedRole = roles.some((role) => allowedRoles.includes(role));

  if (!hasAllowedRole) {
    return {
      allowed: false,
      reason: `Missing required role for action ${action}.`,
    };
  }

  return { allowed: true };
}

export function ensurePolicyAllowed(
  actor: PolicyActor,
  action: PolicyAction,
  scope: PolicyScope
): void {
  const decision = evaluatePolicy(actor, action, scope);
  if (!decision.allowed) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: decision.reason ?? 'Access denied by policy.',
    });
  }
}
