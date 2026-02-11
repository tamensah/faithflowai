import { prisma, Prisma, AuditActorType } from '@faithflow-ai/database';

type AuditInput = {
  tenantId?: string | null;
  churchId?: string | null;
  actorType?: AuditActorType;
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function recordAuditLog(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      tenantId: input.tenantId ?? undefined,
      churchId: input.churchId ?? undefined,
      actorType: input.actorType ?? AuditActorType.SYSTEM,
      actorId: input.actorId ?? undefined,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? undefined,
      metadata: input.metadata,
    },
  });
}
