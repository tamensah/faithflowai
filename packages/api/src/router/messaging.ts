import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import {
  ConversationMemberRole,
  ConversationType,
  MessageSenderType,
  NotificationCategory,
  prisma,
} from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';

async function resolveMember(userId: string | null, tenantId: string | null) {
  if (!userId || !tenantId) return null;
  return prisma.member.findFirst({
    where: { clerkUserId: userId, church: { organization: { tenantId } } },
  });
}

async function findDirectConversation(memberId: string, otherMemberId: string) {
  const candidates = await prisma.conversation.findMany({
    where: {
      type: ConversationType.DIRECT,
      members: {
        some: { memberId },
      },
    },
    include: { members: true },
  });

  return candidates.find((conversation) => {
    const memberIds = conversation.members.map((entry) => entry.memberId);
    return memberIds.length === 2 && memberIds.includes(memberId) && memberIds.includes(otherMemberId);
  });
}

export const messagingRouter = router({
  createDirect: protectedProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const member = await resolveMember(ctx.userId, ctx.tenantId);
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
      }

      const target = await prisma.member.findFirst({
        where: { id: input.memberId, churchId: member.churchId },
      });
      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Target member not found' });
      }

      const existing = await findDirectConversation(member.id, target.id);
      if (existing) return existing;

      return prisma.conversation.create({
        data: {
          churchId: member.churchId,
          type: ConversationType.DIRECT,
          members: {
            createMany: {
              data: [
                { memberId: member.id, role: ConversationMemberRole.MEMBER },
                { memberId: target.id, role: ConversationMemberRole.MEMBER },
              ],
            },
          },
        },
      });
    }),

  staffThread: protectedProcedure
    .input(z.object({ churchId: z.string(), memberId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      const member = await prisma.member.findFirst({
        where: { id: input.memberId, churchId: church.id },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      const existing = await prisma.conversation.findFirst({
        where: {
          churchId: church.id,
          type: ConversationType.DIRECT,
          name: 'Church Staff',
          members: { some: { memberId: member.id } },
        },
        include: { members: true },
      });

      if (existing) return existing;

      return prisma.conversation.create({
        data: {
          churchId: church.id,
          type: ConversationType.DIRECT,
          name: 'Church Staff',
          members: {
            create: { memberId: member.id, role: ConversationMemberRole.MEMBER },
          },
        },
      });
    }),

  listConversations: protectedProcedure.query(async ({ ctx }) => {
    const member = await resolveMember(ctx.userId, ctx.tenantId);
    if (!member) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
    }

    const conversations = await prisma.conversationMember.findMany({
      where: { memberId: member.id },
      include: {
        conversation: {
          include: {
            members: { include: { member: true } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return conversations.map((entry) => ({
      conversation: entry.conversation,
      lastMessage: entry.conversation.messages[0] ?? null,
    }));
  }),

  listMessages: protectedProcedure
    .input(z.object({ conversationId: z.string(), limit: z.number().min(1).max(200).default(50), asStaff: z.boolean().optional() }))
    .query(async ({ input, ctx }) => {
      if (!input.asStaff) {
        const member = await resolveMember(ctx.userId, ctx.tenantId);
        if (!member) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
        }

        const membership = await prisma.conversationMember.findFirst({
          where: { conversationId: input.conversationId, memberId: member.id },
        });
        if (!membership) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not allowed to view this conversation' });
        }
      }

      return prisma.message.findMany({
        where: { conversationId: input.conversationId },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        include: { senderMember: true },
      });
    }),

  sendMessage: protectedProcedure
    .input(z.object({
      conversationId: z.string(),
      body: z.string().min(1),
      attachments: z.array(z.object({
        url: z.string().url().optional(),
        assetId: z.string().optional(),
        name: z.string().optional(),
        type: z.string().optional(),
      }).refine((value) => Boolean(value.url || value.assetId), 'Attachment must include url or assetId')).optional(),
      asStaff: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      let senderMemberId: string | null = null;
      let senderType: MessageSenderType = MessageSenderType.STAFF;
      const conversation = await prisma.conversation.findFirst({
        where: { id: input.conversationId },
        include: { church: { include: { organization: true } } },
      });
      if (!conversation || conversation.church.organization.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found' });
      }
      const churchId = conversation.churchId;

      if (!input.asStaff) {
        const member = await resolveMember(ctx.userId, ctx.tenantId);
        if (!member) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
        }

        const membership = await prisma.conversationMember.findFirst({
          where: { conversationId: input.conversationId, memberId: member.id },
        });
        if (!membership) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not allowed to send messages here' });
        }

        senderMemberId = member.id;
        senderType = MessageSenderType.MEMBER;

        await prisma.conversationMember.update({
          where: { id: membership.id },
          data: { lastReadAt: new Date() },
        });
      }

      let resolvedAttachments = input.attachments;
      if (input.attachments?.length) {
        const assetIds = input.attachments.map((entry) => entry.assetId).filter(Boolean) as string[];
        if (assetIds.length) {
          const assets = await prisma.mediaAsset.findMany({
            where: { id: { in: assetIds }, churchId },
          });
          const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
          resolvedAttachments = input.attachments.map((attachment) => {
            if (attachment.assetId) {
              const asset = assetMap.get(attachment.assetId);
              if (!asset) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Attachment asset not found' });
              }
              return {
                url: asset.url,
                assetId: asset.id,
                name: attachment.name ?? asset.filename ?? undefined,
                type: attachment.type ?? asset.contentType ?? undefined,
              };
            }
            return {
              url: attachment.url!,
              name: attachment.name,
              type: attachment.type,
            };
          });
        }
      }

      const message = await prisma.message.create({
        data: {
          conversationId: input.conversationId,
          senderType,
          senderMemberId: senderMemberId ?? undefined,
          senderUserId: senderMemberId ? undefined : ctx.userId ?? undefined,
          body: input.body,
          attachments: resolvedAttachments ?? undefined,
        },
        include: { senderMember: true },
      });

      const participants = await prisma.conversationMember.findMany({
        where: { conversationId: input.conversationId },
        include: { member: true },
      });

      const recipients = participants.filter((participant) => participant.memberId !== senderMemberId);
      if (recipients.length) {
        const senderName = senderMemberId
          ? `${message.senderMember?.firstName ?? ''} ${message.senderMember?.lastName ?? ''}`.trim()
          : 'Church Staff';

        await prisma.inAppNotification.createMany({
          data: recipients.map((recipient) => ({
            churchId: recipient.member.churchId,
            memberId: recipient.memberId,
            category: NotificationCategory.MESSAGE,
            title: `New message from ${senderName || 'Member'}`,
            body: input.body.slice(0, 200),
          })),
        });
      }

      return message;
    }),

  markConversationRead: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const member = await resolveMember(ctx.userId, ctx.tenantId);
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
      }

      const membership = await prisma.conversationMember.findFirst({
        where: { conversationId: input.conversationId, memberId: member.id },
      });
      if (!membership) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not allowed to update this conversation' });
      }

      return prisma.conversationMember.update({
        where: { id: membership.id },
        data: { lastReadAt: new Date() },
      });
    }),

  setTyping: protectedProcedure
    .input(z.object({ conversationId: z.string(), typing: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const member = await resolveMember(ctx.userId, ctx.tenantId);
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
      }

      const membership = await prisma.conversationMember.findFirst({
        where: { conversationId: input.conversationId, memberId: member.id },
      });
      if (!membership) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not allowed to update this conversation' });
      }

      return prisma.conversationMember.update({
        where: { id: membership.id },
        data: { typingAt: input.typing ? new Date() : null },
      });
    }),

  typingStatus: protectedProcedure
    .input(z.object({ conversationId: z.string(), asStaff: z.boolean().optional() }))
    .query(async ({ input, ctx }) => {
      if (!input.asStaff) {
        const member = await resolveMember(ctx.userId, ctx.tenantId);
        if (!member) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
        }

        const membership = await prisma.conversationMember.findFirst({
          where: { conversationId: input.conversationId, memberId: member.id },
        });
        if (!membership) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not allowed to view this conversation' });
        }
      }

      const threshold = new Date(Date.now() - 15000);
      const members = await prisma.conversationMember.findMany({
        where: { conversationId: input.conversationId, typingAt: { gte: threshold } },
        include: { member: true },
      });

      return members.map((entry) => ({
        memberId: entry.memberId,
        name: `${entry.member.firstName} ${entry.member.lastName}`.trim(),
        typingAt: entry.typingAt,
      }));
    }),

  readStatus: protectedProcedure
    .input(z.object({ conversationId: z.string(), asStaff: z.boolean().optional() }))
    .query(async ({ input, ctx }) => {
      if (!input.asStaff) {
        const member = await resolveMember(ctx.userId, ctx.tenantId);
        if (!member) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
        }

        const membership = await prisma.conversationMember.findFirst({
          where: { conversationId: input.conversationId, memberId: member.id },
        });
        if (!membership) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not allowed to view this conversation' });
        }
      }

      const members = await prisma.conversationMember.findMany({
        where: { conversationId: input.conversationId },
        include: { member: true },
      });

      return members.map((entry) => ({
        memberId: entry.memberId,
        name: `${entry.member.firstName} ${entry.member.lastName}`.trim(),
        lastReadAt: entry.lastReadAt,
      }));
    }),
});
