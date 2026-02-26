import { NextRequest, NextResponse } from 'next/server';
import { requireDatabaseForApi } from '@/lib/database-guard';
import { createOrgCaller } from '@/lib/org-caller';

export async function POST(request: NextRequest) {
	const dbUnavailable = requireDatabaseForApi('org.rollups.refresh.post');
	if (dbUnavailable) return dbUnavailable;

	const payload = (await request.json().catch(() => ({}))) as { idempotencyKey?: string };

	try {
		const { caller, actor } = await createOrgCaller();
		const organizationId = actor.organizationId;
		const refreshed = await caller.org.refreshHierarchyRollups({
			organizationId,
			idempotencyKey: payload.idempotencyKey ?? request.headers.get('x-idempotency-key') ?? undefined,
		});

		return NextResponse.json(refreshed);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 403 });
	}
}
