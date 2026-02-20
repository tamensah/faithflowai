import { NextRequest, NextResponse } from 'next/server';
import { createOrgCaller } from '@/lib/org-caller';

export async function POST(request: NextRequest) {
	const payload = (await request.json()) as {
		code?: string;
		name?: string;
		description?: string;
		isLeadership?: boolean;
	};

	if (!payload.code || !payload.name) {
		return NextResponse.json(
			{ error: 'code and name are required' },
			{ status: 400 }
		);
	}

	try {
		const { caller, actor } = await createOrgCaller();
		const organizationId = actor.organizationId;
		const roleTemplate = await caller.org.createRoleTemplate({
			organizationId,
			code: payload.code,
			name: payload.name,
			description: payload.description,
			isLeadership: Boolean(payload.isLeadership),
		});
		return NextResponse.json({ roleTemplate });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 403 });
	}
}
