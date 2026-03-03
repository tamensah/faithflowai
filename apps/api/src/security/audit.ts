import { prisma } from '@faithflow/database';
import type { Prisma } from '@faithflow/database';
import { TRPCError } from '@trpc/server';
import {
  PolicyAction,
  PolicyActor,
  PolicyScope,
  evaluatePolicy,
  normalizeRoles,
} from './policy';

export type AuditResult = 'SUCCESS' | 'DENIED' | 'FAILED';

type AuditWriteInput = {
  organizationId: string;
  orgUnitId?: string;
  actor: PolicyActor;
  action: string;
  entityType: string;
  entityId?: string;
  result: AuditResult;
  reason?: string;
  metadata?: Record<string, unknown>;
};

export async function writeAuditEvent(input: AuditWriteInput): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      organizationId: input.organizationId,
      orgUnitId: input.orgUnitId,
      actorId: input.actor.id,
      actorType: input.actor.type,
      actorRoles: normalizeRoles(input.actor.roles),
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      result: input.result,
      reason: input.reason,
      metadata: input.metadata as Prisma.InputJsonValue,
    },
  });
}

type GuardedMutationInput<T> = {
  actor: PolicyActor;
  action: PolicyAction;
  scope: PolicyScope;
  entityType: string;
  entityId?: string;
  orgUnitId?: string;
  metadata?: Record<string, unknown>;
  execute: () => Promise<T>;
};

export async function executeGuardedMutation<T>(
  input: GuardedMutationInput<T>
): Promise<T> {
  const decision = evaluatePolicy(input.actor, input.action, input.scope);

  if (!decision.allowed) {
    await writeAuditEvent({
      organizationId: input.scope.organizationId,
      orgUnitId: input.orgUnitId,
      actor: input.actor,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      result: 'DENIED',
      reason: decision.reason,
      metadata: input.metadata,
    });

    throw new TRPCError({
      code: 'FORBIDDEN',
      message: decision.reason ?? 'Access denied by policy.',
    });
  }

  try {
    const result = await input.execute();
    await writeAuditEvent({
      organizationId: input.scope.organizationId,
      orgUnitId: input.orgUnitId,
      actor: input.actor,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      result: 'SUCCESS',
      metadata: input.metadata,
    });
    return result;
  } catch (error) {
    await writeAuditEvent({
      organizationId: input.scope.organizationId,
      orgUnitId: input.orgUnitId,
      actor: input.actor,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      result: 'FAILED',
      reason: error instanceof Error ? error.message : 'Unknown error',
      metadata: input.metadata,
    });
    throw error;
  }
}
