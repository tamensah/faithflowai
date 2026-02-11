import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma, StorageProvider } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { createSignedUpload } from '../storage';

const createUploadSchema = z.object({
  churchId: z.string().optional(),
  filename: z.string().min(1),
  contentType: z.string().optional(),
  size: z.number().int().positive().optional(),
  purpose: z.string().optional(),
  provider: z.nativeEnum(StorageProvider).optional(),
});

async function resolveChurchId(tenantId: string | null, userId: string | null, churchId?: string) {
  if (!tenantId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Tenant missing' });
  }

  if (churchId) {
    const church = await prisma.church.findFirst({
      where: { id: churchId, organization: { tenantId } },
    });
    if (!church) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
    }
    return church.id;
  }

  if (userId) {
    const member = await prisma.member.findFirst({
      where: { clerkUserId: userId, church: { organization: { tenantId } } },
    });
    if (member) return member.churchId;
  }

  const church = await prisma.church.findFirst({
    where: { organization: { tenantId } },
    orderBy: { createdAt: 'asc' },
  });
  if (!church) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
  }
  return church.id;
}

export const storageRouter = router({
  createUpload: protectedProcedure
    .input(createUploadSchema)
    .mutation(async ({ input, ctx }) => {
      const churchId = await resolveChurchId(ctx.tenantId ?? null, ctx.userId ?? null, input.churchId);

      let signed;
      try {
        signed = await createSignedUpload({
          churchId,
          filename: input.filename,
          contentType: input.contentType,
          size: input.size,
          purpose: input.purpose ?? 'attachments',
          provider: input.provider,
        });
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error?.message ?? 'Unable to create upload',
        });
      }

      const asset = await prisma.mediaAsset.create({
        data: {
          churchId,
          uploaderMemberId: ctx.userId
            ? (await prisma.member.findFirst({
                where: { clerkUserId: ctx.userId, churchId },
                select: { id: true },
              }))?.id
            : null,
          uploaderUserId: ctx.userId ?? undefined,
          provider: signed.provider,
          bucket: signed.bucket,
          key: signed.key,
          url: signed.publicUrl,
          filename: input.filename,
          contentType: input.contentType,
          size: input.size,
        },
      });

      return {
        assetId: asset.id,
        uploadUrl: signed.uploadUrl,
        publicUrl: signed.publicUrl,
        provider: signed.provider,
        bucket: signed.bucket,
        key: signed.key,
      };
    }),
});
