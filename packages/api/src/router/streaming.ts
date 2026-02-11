import { TRPCError } from '@trpc/server';
import {
  AuditActorType,
  LiveModerationLevel,
  LiveStreamProvider,
  LiveStreamStatus,
  UserRole,
  prisma,
} from '@faithflow-ai/database';
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { ensureFeatureEnabled } from '../entitlements';
import { recordAuditLog } from '../audit';

async function requireStaff(tenantId: string, clerkUserId: string) {
  const membership = await prisma.staffMembership.findFirst({
    where: {
      user: { clerkUserId },
      church: { organization: { tenantId } },
    },
    include: { church: true },
  });
  if (!membership) throw new TRPCError({ code: 'FORBIDDEN', message: 'Staff access required' });
  return membership;
}

export const streamingRouter = router({
  channels: protectedProcedure
    .input(z.object({ churchId: z.string().optional(), campusId: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      await ensureFeatureEnabled(ctx.tenantId!, 'streaming_enabled', 'Your subscription does not include live streaming.');
      await requireStaff(ctx.tenantId!, ctx.userId!);

      return prisma.liveStreamChannel.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input?.churchId ? { churchId: input.churchId } : {}),
          ...(input?.campusId ? { campusId: input.campusId } : {}),
        },
        orderBy: [{ createdAt: 'desc' }],
      });
    }),

  createChannel: protectedProcedure
    .input(
      z.object({
        churchId: z.string(),
        campusId: z.string().optional(),
        name: z.string().min(2).max(120),
        provider: z.nativeEnum(LiveStreamProvider),
        externalChannelId: z.string().optional(),
        ingestUrl: z.string().url().optional(),
        playbackUrl: z.string().url().optional(),
        streamKey: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureEnabled(ctx.tenantId!, 'streaming_enabled', 'Your subscription does not include live streaming.');
      const membership = await requireStaff(ctx.tenantId!, ctx.userId!);

      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      if (input.campusId) {
        const campus = await prisma.campus.findFirst({ where: { id: input.campusId, churchId: church.id } });
        if (!campus) throw new TRPCError({ code: 'NOT_FOUND', message: 'Campus not found' });
      }

      const channel = await prisma.liveStreamChannel.create({
        data: {
          churchId: input.churchId,
          campusId: input.campusId,
          name: input.name,
          provider: input.provider,
          externalChannelId: input.externalChannelId,
          ingestUrl: input.ingestUrl,
          playbackUrl: input.playbackUrl,
          streamKey: input.streamKey,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: channel.churchId,
        actorType: AuditActorType.USER,
        actorId: membership.userId,
        action: 'streaming.channel.created',
        targetType: 'LiveStreamChannel',
        targetId: channel.id,
        metadata: { provider: channel.provider, campusId: channel.campusId },
      });

      return channel;
    }),

  updateChannel: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).max(120).optional(),
        isActive: z.boolean().optional(),
        ingestUrl: z.string().url().optional(),
        playbackUrl: z.string().url().optional(),
        streamKey: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureEnabled(ctx.tenantId!, 'streaming_enabled', 'Your subscription does not include live streaming.');
      const membership = await requireStaff(ctx.tenantId!, ctx.userId!);

      const channel = await prisma.liveStreamChannel.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!channel) throw new TRPCError({ code: 'NOT_FOUND', message: 'Channel not found' });

      const updated = await prisma.liveStreamChannel.update({
        where: { id: channel.id },
        data: {
          name: input.name,
          isActive: input.isActive,
          ingestUrl: input.ingestUrl,
          playbackUrl: input.playbackUrl,
          streamKey: input.streamKey,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: updated.churchId,
        actorType: AuditActorType.USER,
        actorId: membership.userId,
        action: 'streaming.channel.updated',
        targetType: 'LiveStreamChannel',
        targetId: updated.id,
      });

      return updated;
    }),

  sessions: protectedProcedure
    .input(
      z
        .object({
          churchId: z.string().optional(),
          channelId: z.string().optional(),
          status: z.nativeEnum(LiveStreamStatus).optional(),
          limit: z.number().int().min(1).max(200).default(100),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      await ensureFeatureEnabled(ctx.tenantId!, 'streaming_enabled', 'Your subscription does not include live streaming.');
      await requireStaff(ctx.tenantId!, ctx.userId!);

      return prisma.liveStreamSession.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input?.churchId ? { churchId: input.churchId } : {}),
          ...(input?.channelId ? { channelId: input.channelId } : {}),
          ...(input?.status ? { status: input.status } : {}),
        },
        include: {
          channel: true,
          event: { select: { id: true, title: true, startAt: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
        take: input?.limit ?? 100,
      });
    }),

  createSession: protectedProcedure
    .input(
      z.object({
        churchId: z.string(),
        channelId: z.string(),
        eventId: z.string().optional(),
        title: z.string().min(2).max(200),
        description: z.string().optional(),
        scheduledStartAt: z.coerce.date().optional(),
        moderationLevel: z.nativeEnum(LiveModerationLevel).default(LiveModerationLevel.FILTERED),
        isRecording: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureEnabled(ctx.tenantId!, 'streaming_enabled', 'Your subscription does not include live streaming.');
      const membership = await requireStaff(ctx.tenantId!, ctx.userId!);

      const channel = await prisma.liveStreamChannel.findFirst({
        where: {
          id: input.channelId,
          churchId: input.churchId,
          church: { organization: { tenantId: ctx.tenantId! } },
        },
      });
      if (!channel) throw new TRPCError({ code: 'NOT_FOUND', message: 'Channel not found' });

      if (input.eventId) {
        const event = await prisma.event.findFirst({ where: { id: input.eventId, churchId: input.churchId } });
        if (!event) throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      const session = await prisma.liveStreamSession.create({
        data: {
          churchId: input.churchId,
          channelId: input.channelId,
          eventId: input.eventId,
          title: input.title,
          description: input.description,
          status: LiveStreamStatus.SCHEDULED,
          scheduledStartAt: input.scheduledStartAt,
          moderationLevel: input.moderationLevel,
          isRecording: input.isRecording,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: session.churchId,
        actorType: AuditActorType.USER,
        actorId: membership.userId,
        action: 'streaming.session.created',
        targetType: 'LiveStreamSession',
        targetId: session.id,
      });

      return session;
    }),

  startSession: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    await ensureFeatureEnabled(ctx.tenantId!, 'streaming_enabled', 'Your subscription does not include live streaming.');
    const membership = await requireStaff(ctx.tenantId!, ctx.userId!);

    const session = await prisma.liveStreamSession.findFirst({
      where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
    });
    if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });

    const updated = await prisma.liveStreamSession.update({
      where: { id: session.id },
      data: {
        status: LiveStreamStatus.LIVE,
        startedAt: new Date(),
      },
    });

    await recordAuditLog({
      tenantId: ctx.tenantId,
      churchId: updated.churchId,
      actorType: AuditActorType.USER,
      actorId: membership.userId,
      action: 'streaming.session.started',
      targetType: 'LiveStreamSession',
      targetId: updated.id,
    });

    return updated;
  }),

  endSession: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        peakViewers: z.number().int().min(0).optional(),
        totalViews: z.number().int().min(0).optional(),
        recordingUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureEnabled(ctx.tenantId!, 'streaming_enabled', 'Your subscription does not include live streaming.');
      const membership = await requireStaff(ctx.tenantId!, ctx.userId!);

      const session = await prisma.liveStreamSession.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });

      const updated = await prisma.liveStreamSession.update({
        where: { id: session.id },
        data: {
          status: LiveStreamStatus.ENDED,
          endedAt: new Date(),
          ...(input.peakViewers !== undefined ? { peakViewers: input.peakViewers } : {}),
          ...(input.totalViews !== undefined ? { totalViews: input.totalViews } : {}),
          ...(input.recordingUrl !== undefined ? { recordingUrl: input.recordingUrl } : {}),
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: updated.churchId,
        actorType: AuditActorType.USER,
        actorId: membership.userId,
        action: 'streaming.session.ended',
        targetType: 'LiveStreamSession',
        targetId: updated.id,
        metadata: { peakViewers: updated.peakViewers, totalViews: updated.totalViews },
      });

      return updated;
    }),

  analytics: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      await ensureFeatureEnabled(ctx.tenantId!, 'streaming_enabled', 'Your subscription does not include live streaming.');
      await requireStaff(ctx.tenantId!, ctx.userId!);

      const from = input?.from ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const to = input?.to ?? new Date();

      const sessions = await prisma.liveStreamSession.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input?.churchId ? { churchId: input.churchId } : {}),
          createdAt: { gte: from, lte: to },
        },
      });

      return {
        from,
        to,
        totals: {
          sessions: sessions.length,
          liveSessions: sessions.filter((session) => session.status === LiveStreamStatus.LIVE).length,
          endedSessions: sessions.filter((session) => session.status === LiveStreamStatus.ENDED).length,
          peakViewers: sessions.reduce((sum, session) => sum + session.peakViewers, 0),
          totalViews: sessions.reduce((sum, session) => sum + session.totalViews, 0),
        },
      };
    }),
});
