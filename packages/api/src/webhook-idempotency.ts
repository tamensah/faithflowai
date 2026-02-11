import crypto from 'crypto';
import { Prisma, WebhookEventStatus, WebhookProvider, prisma } from '@faithflow-ai/database';

function toHexDigest(payload: string | Buffer) {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function hashWebhookPayload(payload: string | Buffer) {
  return toHexDigest(payload);
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Webhook processing failed';
}

export function buildWebhookExternalEventId(parts: Array<string | number | null | undefined>) {
  const compact = parts
    .map((part) => (part === null || part === undefined ? '' : String(part).trim()))
    .filter(Boolean)
    .join(':');
  if (compact) return compact;
  const digest = crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 20);
  return `hash:${digest}`;
}

export async function beginWebhookProcessing(input: {
  provider: WebhookProvider;
  externalEventId: string;
  eventType: string;
  payload: string | Buffer;
  tenantId?: string | null;
  churchId?: string | null;
}) {
  const payloadHash = toHexDigest(input.payload);

  try {
    const created = await prisma.webhookEvent.create({
      data: {
        provider: input.provider,
        externalEventId: input.externalEventId,
        eventType: input.eventType,
        payloadHash,
        tenantId: input.tenantId ?? null,
        churchId: input.churchId ?? null,
        status: WebhookEventStatus.PROCESSING,
      },
    });
    return {
      duplicate: false,
      recordId: created.id,
      payloadHash,
    };
  } catch (error) {
    const prismaError = error as Prisma.PrismaClientKnownRequestError;
    if (prismaError?.code !== 'P2002') {
      throw error;
    }

    const existing = await prisma.webhookEvent.findUnique({
      where: {
        provider_externalEventId: {
          provider: input.provider,
          externalEventId: input.externalEventId,
        },
      },
    });

    if (!existing) {
      return {
        duplicate: true,
        recordId: null,
        payloadHash,
      };
    }

    if (existing.status === WebhookEventStatus.FAILED) {
      const resumed = await prisma.webhookEvent.update({
        where: { id: existing.id },
        data: {
          status: WebhookEventStatus.PROCESSING,
          error: null,
          payloadHash,
          receivedAt: new Date(),
          tenantId: input.tenantId ?? existing.tenantId,
          churchId: input.churchId ?? existing.churchId,
          eventType: input.eventType,
        },
      });

      return {
        duplicate: false,
        recordId: resumed.id,
        payloadHash,
      };
    }

    return {
      duplicate: true,
      recordId: existing.id,
      payloadHash,
    };
  }
}

export async function markWebhookProcessed(input: {
  recordId: string;
  tenantId?: string | null;
  churchId?: string | null;
  result?: Prisma.InputJsonValue;
}) {
  await prisma.webhookEvent.update({
    where: { id: input.recordId },
    data: {
      status: WebhookEventStatus.PROCESSED,
      processedAt: new Date(),
      ...(input.tenantId !== undefined ? { tenantId: input.tenantId } : {}),
      ...(input.churchId !== undefined ? { churchId: input.churchId } : {}),
      ...(input.result !== undefined ? { result: input.result } : {}),
    },
  });
}

export async function markWebhookFailed(input: { recordId: string; error: unknown; result?: Prisma.InputJsonValue }) {
  await prisma.webhookEvent.update({
    where: { id: input.recordId },
    data: {
      status: WebhookEventStatus.FAILED,
      processedAt: new Date(),
      error: toErrorMessage(input.error),
      ...(input.result !== undefined ? { result: input.result } : {}),
    },
  });
}
