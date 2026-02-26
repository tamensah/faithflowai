import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@faithflow/database';
import { createAppCaller } from '@/lib/app-caller';
import { requireDatabaseForApi } from '@/lib/database-guard';

const channelValues = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'] as const;

export async function GET(request: NextRequest) {
	const dbUnavailable = requireDatabaseForApi('comms.get');
	if (dbUnavailable) return dbUnavailable;

	const roomId = request.nextUrl.searchParams.get('roomId') ?? undefined;
	const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined;
	const limit = Number(request.nextUrl.searchParams.get('limit') ?? '50');

	try {
		const { caller, actor } = await createAppCaller();
		const organizationId = actor.organizationId;
		const resolvedLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;

		const [rooms, messages, churches] = await Promise.all([
			caller.comms.listRooms({
				organizationId,
				limit: resolvedLimit,
				cursor,
			}),
			roomId
				? caller.comms.listMessages({
						organizationId,
						roomId,
						limit: resolvedLimit,
					})
				: Promise.resolve({ items: [], nextCursor: undefined }),
			prisma.church.findMany({
				where: { organizationId },
				orderBy: { name: 'asc' },
				select: { id: true, name: true, slug: true },
			}),
		]);

		return NextResponse.json({
			rooms,
			messages,
			churches,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		const status = message.startsWith('Unauthorized') ? 401 : 403;
		return NextResponse.json({ error: message }, { status });
	}
}

export async function POST(request: NextRequest) {
	const dbUnavailable = requireDatabaseForApi('comms.post');
	if (dbUnavailable) return dbUnavailable;

	const payload = (await request.json()) as {
		action?: 'createRoom' | 'sendMessage' | 'dispatch';
		idempotencyKey?: string;
		name?: string;
		type?: string;
		churchId?: string;
		participantUserIds?: string[];
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

	try {
		const { caller, actor } = await createAppCaller();
		const organizationId = actor.organizationId;
		const idempotencyKey =
			payload.idempotencyKey ?? request.headers.get('x-idempotency-key') ?? undefined;

		if (payload.action === 'createRoom') {
			if (!payload.name) {
				return NextResponse.json({ error: 'name is required' }, { status: 400 });
			}

			const room = await caller.comms.createRoom({
				organizationId,
				idempotencyKey,
				name: payload.name,
				type: payload.type ?? 'THREAD',
				churchId: payload.churchId,
				participantUserIds: payload.participantUserIds ?? [],
				metadata: payload.metadata,
			});
			return NextResponse.json({ room });
		}

		if (payload.action === 'sendMessage') {
			if (!payload.roomId || !payload.content) {
				return NextResponse.json(
					{ error: 'roomId and content are required for sendMessage' },
					{ status: 400 }
				);
			}

			const message = await caller.comms.sendMessage({
				organizationId,
				idempotencyKey,
				roomId: payload.roomId,
				content: payload.content,
				type: payload.type ?? 'TEXT',
				metadata: payload.metadata,
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

		const dispatch = await caller.comms.dispatch({
			organizationId,
			idempotencyKey,
			churchId: payload.churchId,
			channel: payload.channel,
			recipient: payload.recipient,
			subject: payload.subject,
			body: payload.body,
			templateKey: payload.templateKey,
			metadata: payload.metadata,
		});
		return NextResponse.json({ dispatch });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 403 });
	}
}
