import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  prisma,
  AuditActorType,
  ContentResourceType,
  ContentResourceVisibility,
  SermonStatus,
} from '@faithflow-ai/database';
import { router, protectedProcedure } from '../trpc';
import { ensureFeatureEnabled } from '../entitlements';
import { recordAuditLog } from '../audit';

const sermonInput = z.object({
  churchId: z.string(),
  campusId: z.string().optional(),
  eventId: z.string().optional(),
  mediaAssetId: z.string().optional(),
  title: z.string().min(2),
  speaker: z.string().optional(),
  seriesName: z.string().optional(),
  summary: z.string().optional(),
  scriptureRefs: z.array(z.string()).optional(),
  durationSeconds: z.number().int().positive().optional(),
  status: z.nativeEnum(SermonStatus).optional(),
  publishedAt: z.coerce.date().optional(),
});

const resourceInput = z.object({
  churchId: z.string(),
  campusId: z.string().optional(),
  mediaAssetId: z.string().optional(),
  title: z.string().min(2),
  description: z.string().optional(),
  type: z.nativeEnum(ContentResourceType).optional(),
  visibility: z.nativeEnum(ContentResourceVisibility).optional(),
  linkUrl: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  isFeatured: z.boolean().optional(),
  publishedAt: z.coerce.date().optional(),
});

async function ensureContentContext(churchId: string, tenantId: string, campusId?: string, mediaAssetId?: string, eventId?: string) {
  const church = await prisma.church.findFirst({
    where: { id: churchId, organization: { tenantId } },
  });
  if (!church) throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });

  if (campusId) {
    const campus = await prisma.campus.findFirst({ where: { id: campusId, churchId } });
    if (!campus) throw new TRPCError({ code: 'NOT_FOUND', message: 'Campus not found' });
  }
  if (mediaAssetId) {
    const mediaAsset = await prisma.mediaAsset.findFirst({ where: { id: mediaAssetId, churchId } });
    if (!mediaAsset) throw new TRPCError({ code: 'NOT_FOUND', message: 'Media asset not found' });
  }
  if (eventId) {
    const event = await prisma.event.findFirst({ where: { id: eventId, churchId } });
    if (!event) throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
  }

  return church;
}

export const contentRouter = router({
  createSermon: protectedProcedure
    .input(sermonInput)
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureEnabled(
        ctx.tenantId!,
        'content_library_enabled',
        'Your subscription does not include content library features.'
      );
      const church = await ensureContentContext(input.churchId, ctx.tenantId!, input.campusId, input.mediaAssetId, input.eventId);

      const sermon = await prisma.sermon.create({
        data: {
          churchId: input.churchId,
          campusId: input.campusId,
          eventId: input.eventId,
          mediaAssetId: input.mediaAssetId,
          title: input.title,
          speaker: input.speaker,
          seriesName: input.seriesName,
          summary: input.summary,
          scriptureRefs: input.scriptureRefs ?? undefined,
          durationSeconds: input.durationSeconds,
          status: input.status ?? SermonStatus.DRAFT,
          publishedAt: input.publishedAt,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: church.id,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'content.sermon_created',
        targetType: 'Sermon',
        targetId: sermon.id,
        metadata: { title: sermon.title, status: sermon.status, campusId: sermon.campusId },
      });

      return sermon;
    }),

  listSermons: protectedProcedure
    .input(
      z
        .object({
          churchId: z.string().optional(),
          campusId: z.string().optional(),
          status: z.nativeEnum(SermonStatus).optional(),
          limit: z.number().int().min(1).max(200).default(100),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      await ensureFeatureEnabled(
        ctx.tenantId!,
        'content_library_enabled',
        'Your subscription does not include content library features.'
      );
      return prisma.sermon.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input?.churchId ? { churchId: input.churchId } : {}),
          ...(input?.campusId ? { campusId: input.campusId } : {}),
          ...(input?.status ? { status: input.status } : {}),
        },
        include: {
          mediaAsset: true,
          event: { select: { id: true, title: true, startAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: input?.limit ?? 100,
      });
    }),

  publishSermon: protectedProcedure
    .input(z.object({ id: z.string(), published: z.boolean().default(true) }))
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureEnabled(
        ctx.tenantId!,
        'content_library_enabled',
        'Your subscription does not include content library features.'
      );
      const sermon = await prisma.sermon.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!sermon) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sermon not found' });

      const updated = await prisma.sermon.update({
        where: { id: sermon.id },
        data: {
          status: input.published ? SermonStatus.PUBLISHED : SermonStatus.DRAFT,
          publishedAt: input.published ? new Date() : null,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: updated.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'content.sermon_publish_toggled',
        targetType: 'Sermon',
        targetId: updated.id,
        metadata: { status: updated.status },
      });

      return updated;
    }),

  createResource: protectedProcedure
    .input(resourceInput)
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureEnabled(
        ctx.tenantId!,
        'content_library_enabled',
        'Your subscription does not include content library features.'
      );
      const church = await ensureContentContext(input.churchId, ctx.tenantId!, input.campusId, input.mediaAssetId);

      const resource = await prisma.contentResource.create({
        data: {
          churchId: input.churchId,
          campusId: input.campusId,
          mediaAssetId: input.mediaAssetId,
          title: input.title,
          description: input.description,
          type: input.type ?? ContentResourceType.DOCUMENT,
          visibility: input.visibility ?? ContentResourceVisibility.MEMBERS_ONLY,
          linkUrl: input.linkUrl,
          tags: input.tags ?? undefined,
          isFeatured: input.isFeatured ?? false,
          publishedAt: input.publishedAt,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: church.id,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'content.resource_created',
        targetType: 'ContentResource',
        targetId: resource.id,
        metadata: { title: resource.title, type: resource.type, visibility: resource.visibility },
      });

      return resource;
    }),

  listResources: protectedProcedure
    .input(
      z
        .object({
          churchId: z.string().optional(),
          campusId: z.string().optional(),
          type: z.nativeEnum(ContentResourceType).optional(),
          visibility: z.nativeEnum(ContentResourceVisibility).optional(),
          limit: z.number().int().min(1).max(200).default(100),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      await ensureFeatureEnabled(
        ctx.tenantId!,
        'content_library_enabled',
        'Your subscription does not include content library features.'
      );
      return prisma.contentResource.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input?.churchId ? { churchId: input.churchId } : {}),
          ...(input?.campusId ? { campusId: input.campusId } : {}),
          ...(input?.type ? { type: input.type } : {}),
          ...(input?.visibility ? { visibility: input.visibility } : {}),
        },
        include: { mediaAsset: true },
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        take: input?.limit ?? 100,
      });
    }),

  analytics: protectedProcedure
    .input(z.object({ churchId: z.string().optional(), campusId: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      await ensureFeatureEnabled(
        ctx.tenantId!,
        'content_library_enabled',
        'Your subscription does not include content library features.'
      );
      const where = {
        church: { organization: { tenantId: ctx.tenantId! } },
        ...(input?.churchId ? { churchId: input.churchId } : {}),
        ...(input?.campusId ? { campusId: input.campusId } : {}),
      };

      const [sermonsByStatus, resourcesByType, featuredResources, totalSermonViews] = await Promise.all([
        prisma.sermon.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        }),
        prisma.contentResource.groupBy({
          by: ['type'],
          where,
          _count: { _all: true },
        }),
        prisma.contentResource.count({ where: { ...where, isFeatured: true } }),
        prisma.sermon.aggregate({
          where,
          _sum: { viewCount: true },
        }),
      ]);

      return {
        sermonsByStatus,
        resourcesByType,
        featuredResources,
        totalSermonViews: totalSermonViews._sum.viewCount ?? 0,
      };
    }),
});
