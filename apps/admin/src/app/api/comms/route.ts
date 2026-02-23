import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantContext } from '@/lib/tenant-context';

const channelValues = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'] as const;
const roomTypeValues = ['DIRECT', 'GROUP'] as const;

function resolveProvider(channel: (typeof channelValues)[number]): 'RESEND' | 'TWILIO' {
  if (channel === 'EMAIL') return 'RESEND';
  return 'TWILIO';
}

function resolveChannel(channel: (typeof channelValues)[number]): 'EMAIL' | 'SMS' | 'WHATSAPP' {
  if (channel === 'PUSH') return 'SMS';
  return channel;
}

function toErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
  if (message.startsWith('Unauthorized') || message.startsWith('Forbidden')) {
    return NextResponse.json({ error: message }, { status: 401 });
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const { prisma } = await import('@faithflow-ai/database');
    const roomId = request.nextUrl.searchParams.get('roomId') ?? undefined;
    const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined;
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? '50');
    const context = await resolveTenantContext();
    const resolvedLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;

    const [rooms, messages, churches] = await Promise.all([
      prisma.conversation.findMany({
        where: { churchId: { in: context.churchIds } },
        orderBy: { updatedAt: 'desc' },
        take: resolvedLimit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          _count: { select: { messages: true } },
          members: {
            include: {
              member: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
        },
      }),
      roomId
        ? prisma.message.findMany({
            where: { conversationId: roomId },
            orderBy: { createdAt: 'desc' },
            take: resolvedLimit,
            include: {
              senderMember: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          })
        : Promise.resolve([]),
      prisma.church.findMany({
        where: { id: { in: context.churchIds } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true },
      }),
    ]);

    return NextResponse.json({
      rooms: {
        items: rooms.map((room) => ({
          id: room.id,
          name: room.name ?? 'Untitled room',
          type: room.type,
          updatedAt: room.updatedAt,
          _count: { messages: room._count.messages },
          participants: room.members.map((participant) => ({
            id: participant.member.id,
            email: participant.member.email,
            name: `${participant.member.firstName} ${participant.member.lastName}`.trim(),
            role: participant.role,
          })),
        })),
        nextCursor: rooms.length === resolvedLimit ? rooms[rooms.length - 1]?.id : undefined,
      },
      messages: {
        items: messages.map((message) => ({
          id: message.id,
          roomId: message.conversationId,
          content: message.body,
          type: message.senderType,
          createdAt: message.createdAt,
          sender: message.senderMember
            ? {
                id: message.senderMember.id,
                email: message.senderMember.email,
                name: `${message.senderMember.firstName} ${message.senderMember.lastName}`.trim(),
                role: 'MEMBER',
              }
            : undefined,
        })),
        nextCursor: undefined,
      },
      churches,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { prisma } = await import('@faithflow-ai/database');
    const payload = (await request.json()) as {
      action?: 'createRoom' | 'sendMessage' | 'dispatch';
      name?: string;
      type?: string;
      churchId?: string;
      roomId?: string;
      content?: string;
      channel?: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH';
      recipient?: string;
      subject?: string;
      body?: string;
      templateKey?: string;
      metadata?: Record<string, unknown>;
    };

    if (!payload.action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    const context = await resolveTenantContext();

    if (payload.action === 'createRoom') {
      if (!payload.name) {
        return NextResponse.json({ error: 'name is required' }, { status: 400 });
      }

      const churchId =
        payload.churchId && context.churchIds.includes(payload.churchId)
          ? payload.churchId
          : context.defaultChurchId;

      if (!churchId) {
        return NextResponse.json(
          { error: 'No church found for this tenant. Create a church first.' },
          { status: 400 }
        );
      }

      const type = roomTypeValues.includes(payload.type as (typeof roomTypeValues)[number])
        ? (payload.type as (typeof roomTypeValues)[number])
        : 'GROUP';

      const room = await prisma.conversation.create({
        data: {
          churchId,
          name: payload.name,
          type,
        },
      });

      return NextResponse.json({
        room: {
          id: room.id,
          name: room.name ?? 'Untitled room',
          type: room.type,
          updatedAt: room.updatedAt,
        },
      });
    }

    if (payload.action === 'sendMessage') {
      if (!payload.roomId || !payload.content) {
        return NextResponse.json(
          { error: 'roomId and content are required for sendMessage' },
          { status: 400 }
        );
      }

      const room = await prisma.conversation.findUnique({
        where: { id: payload.roomId },
        select: { id: true, churchId: true },
      });
      if (!room || !context.churchIds.includes(room.churchId)) {
        return NextResponse.json({ error: 'Room not found in your tenant scope' }, { status: 404 });
      }

      const message = await prisma.message.create({
        data: {
          conversationId: payload.roomId,
          senderType: 'STAFF',
          senderUserId: context.userId,
          body: payload.content,
        },
      });

      return NextResponse.json({ message });
    }

    if (!payload.channel || !channelValues.includes(payload.channel)) {
      return NextResponse.json({ error: 'channel is invalid' }, { status: 400 });
    }
    if (!payload.recipient || !payload.body) {
      return NextResponse.json(
        { error: 'recipient and body are required for dispatch' },
        { status: 400 }
      );
    }

    const churchId =
      payload.churchId && context.churchIds.includes(payload.churchId)
        ? payload.churchId
        : context.defaultChurchId;
    if (!churchId) {
      return NextResponse.json(
        { error: 'No church found for this tenant. Create a church first.' },
        { status: 400 }
      );
    }

    const requestedChannel = payload.channel;
    const resolvedChannel = resolveChannel(requestedChannel);
    const dispatch = await prisma.communicationMessage.create({
      data: {
        churchId,
        channel: resolvedChannel,
        provider: resolveProvider(requestedChannel),
        to: payload.recipient,
        subject: payload.subject,
        body: payload.body,
        status: 'QUEUED',
        metadata: {
          requestedChannel,
          templateKey: payload.templateKey ?? null,
          ...payload.metadata,
        },
      },
    });

    return NextResponse.json({
      dispatch: {
        queued: true,
        id: dispatch.id,
        channel: requestedChannel,
        recipient: dispatch.to,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
