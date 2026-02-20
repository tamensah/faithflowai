import { NextRequest, NextResponse } from 'next/server';
import { createOrgCaller } from '@/lib/org-caller';

export async function GET(request: NextRequest) {
	const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined;
	const action = request.nextUrl.searchParams.get('action') ?? undefined;
	const result = request.nextUrl.searchParams.get('result') as
		| 'SUCCESS'
		| 'DENIED'
		| 'FAILED'
		| null;

	try {
		const { caller, actor } = await createOrgCaller();
		const organizationId = actor.organizationId;
		const audit = await caller.org.listAuditEvents({
			organizationId,
			cursor,
			action,
			result: result ?? undefined,
			limit: 100,
		});
		return NextResponse.json(audit);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 403 });
	}
}
