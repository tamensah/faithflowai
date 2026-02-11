import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import {
  DevicePlatform,
  NotificationCategory,
  NotificationChannel,
  Prisma,
  prisma,
} from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';

const preferenceSchema = z.object({
  channel: z.nativeEnum(NotificationChannel),
  enabled: z.boolean(),
});

const registerDeviceSchema = z.object({
  token: z.string().min(10),
  platform: z.nativeEnum(DevicePlatform),
  provider: z.string().optional(),
});

const sendNotificationSchema = z.object({
  churchId: z.string(),
  title: z.string().min(1),
  body: z.string().min(1),
  category: z.nativeEnum(NotificationCategory).optional(),
  memberIds: z.array(z.string()).optional(),
  audience: z.enum(['ALL_MEMBERS', 'ACTIVE_MEMBERS']).optional(),
  data: z.record(z.string(), z.any()).optional(),
});

async function resolveMember(userId: string | null, tenantId: string | null) {
  if (!userId || !tenantId) return null;
  return prisma.member.findFirst({
    where: { clerkUserId: userId, church: { organization: { tenantId } } },
  });
}

async function fetchRecipients({
  churchId,
  memberIds,
  audience,
}: {
  churchId: string;
  memberIds?: string[];
  audience?: 'ALL_MEMBERS' | 'ACTIVE_MEMBERS';
}) {
  if (memberIds && memberIds.length) {
    return prisma.member.findMany({ where: { id: { in: memberIds }, churchId } });
  }

  if (audience) {
    return prisma.member.findMany({
      where: { churchId, ...(audience === 'ACTIVE_MEMBERS' ? { status: 'ACTIVE' } : {}) },
    });
  }

  return [];
}

async function sendPush(tokens: string[], payload: { title: string; body: string; data?: Record<string, any> }) {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey || tokens.length === 0) {
    return { sent: 0, failed: tokens.length, skipped: tokens.length };
  }

  const response = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      Authorization: `key=${serverKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      registration_ids: tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data ?? {},
    }),
  });

  if (!response.ok) {
    return { sent: 0, failed: tokens.length, skipped: 0 };
  }

  const json = (await response.json()) as { success?: number; failure?: number };
  return { sent: json.success ?? 0, failed: json.failure ?? 0, skipped: 0 };
}

export const notificationsRouter = router({
  listMine: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(25), unreadOnly: z.boolean().optional() }))
    .query(async ({ input, ctx }) => {
      const member = await resolveMember(ctx.userId, ctx.tenantId);
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
      }

      return prisma.inAppNotification.findMany({
        where: {
          memberId: member.id,
          ...(input.unreadOnly ? { readAt: null } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });
    }),

  markRead: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).min(1) }))
    .mutation(async ({ input, ctx }) => {
      const member = await resolveMember(ctx.userId, ctx.tenantId);
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
      }

      const updated = await prisma.inAppNotification.updateMany({
        where: { id: { in: input.ids }, memberId: member.id },
        data: { readAt: new Date() },
      });

      return { updated: updated.count };
    }),

  updatePreference: protectedProcedure
    .input(preferenceSchema)
    .mutation(async ({ input, ctx }) => {
      const member = await resolveMember(ctx.userId, ctx.tenantId);
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
      }

      return prisma.notificationPreference.upsert({
        where: { memberId_channel: { memberId: member.id, channel: input.channel } },
        update: { enabled: input.enabled },
        create: { memberId: member.id, channel: input.channel, enabled: input.enabled },
      });
    }),

  listPreferences: protectedProcedure.query(async ({ ctx }) => {
    const member = await resolveMember(ctx.userId, ctx.tenantId);
    if (!member) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
    }

    return prisma.notificationPreference.findMany({
      where: { memberId: member.id },
      orderBy: { channel: 'asc' },
    });
  }),

  registerDevice: protectedProcedure
    .input(registerDeviceSchema)
    .mutation(async ({ input, ctx }) => {
      const member = await resolveMember(ctx.userId, ctx.tenantId);
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
      }

      return prisma.deviceToken.upsert({
        where: { memberId_token: { memberId: member.id, token: input.token } },
        update: { platform: input.platform, provider: input.provider, lastSeenAt: new Date() },
        create: { memberId: member.id, platform: input.platform, provider: input.provider, token: input.token },
      });
    }),

  send: protectedProcedure
    .input(sendNotificationSchema)
    .mutation(async ({ input, ctx }) => {
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      const recipients = await fetchRecipients({
        churchId: church.id,
        memberIds: input.memberIds,
        audience: input.audience,
      });

      if (!recipients.length) {
        return { sent: 0, push: { sent: 0, failed: 0, skipped: 0 } };
      }

      await prisma.inAppNotification.createMany({
        data: recipients.map((recipient) => ({
          churchId: church.id,
          memberId: recipient.id,
          category: input.category ?? NotificationCategory.GENERAL,
          title: input.title,
          body: input.body,
          data: input.data ? (input.data as Prisma.InputJsonValue) : undefined,
        })),
      });

      const preferences = await prisma.notificationPreference.findMany({
        where: { memberId: { in: recipients.map((member) => member.id) }, channel: NotificationChannel.PUSH },
      });
      const enabledPush = new Set(preferences.filter((pref) => pref.enabled).map((pref) => pref.memberId));
      const deviceTokens = await prisma.deviceToken.findMany({
        where: { memberId: { in: recipients.map((member) => member.id) } },
      });
      const pushResult = await sendPush(
        deviceTokens.filter((token) => enabledPush.has(token.memberId)).map((token) => token.token),
        { title: input.title, body: input.body, data: input.data ?? undefined }
      );

      return { sent: recipients.length, push: pushResult };
    }),
});
