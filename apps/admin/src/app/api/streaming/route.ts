import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@faithflow/database';
import { createAppCaller } from '@/lib/app-caller';
import { getAddonStateForOrganization, isAddonEnabled } from '@/lib/addon-entitlements';
import { requireDatabaseForApi } from '@/lib/database-guard';

function parseStatus(error: unknown): number {
	const message = error instanceof Error ? error.message.toLowerCase() : '';
	if (message.includes('unauthorized')) return 401;
	if (message.includes('forbidden')) return 403;
	if (message.includes('not found')) return 404;
	return 400;
}

export async function POST(request: NextRequest) {
	const dbUnavailable = requireDatabaseForApi('streaming.post');
	if (dbUnavailable) return dbUnavailable;

	const payload = (await request.json().catch(() => ({}))) as {
		action?: 'startChecklist';
		streamKey?: string;
	};

	if (payload.action !== 'startChecklist') {
		return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
	}

	try {
		const { actor } = await createAppCaller();
		const addonState = await getAddonStateForOrganization(actor.organizationId);
		if (!isAddonEnabled(addonState, 'STREAMING_SUITE')) {
			return NextResponse.json(
				{
					error: 'Feature locked: STREAMING_SUITE entitlement is required.',
					code: 'FEATURE_LOCKED',
				},
				{ status: 403 }
			);
		}

		await prisma.auditEvent.create({
			data: {
				organizationId: actor.organizationId,
				actorId: actor.id,
				actorType: actor.type,
				actorRoles: actor.roles,
				action: 'STREAMING_CHECKLIST_STARTED',
				entityType: 'Streaming',
				entityId: payload.streamKey ?? null,
				result: 'SUCCESS',
				metadata: {
					streamKey: payload.streamKey ?? null,
				},
			},
		});

		return NextResponse.json({
			ok: true,
			message: 'Streaming checklist run started.',
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Streaming action failed';
		return NextResponse.json({ error: message }, { status: parseStatus(error) });
	}
}
