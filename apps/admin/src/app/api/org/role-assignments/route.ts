import { NextRequest, NextResponse } from 'next/server';
import { createOrgCaller } from '@/lib/org-caller';

export async function POST(request: NextRequest) {
	const payload = (await request.json()) as {
		memberId?: string;
		roleTemplateId?: string;
		orgUnitId?: string;
		startAt?: string;
		endAt?: string;
	};

	if (!payload.memberId || !payload.roleTemplateId || !payload.orgUnitId) {
		return NextResponse.json(
			{
				error:
					'memberId, roleTemplateId, and orgUnitId are required',
			},
			{ status: 400 }
		);
	}

	try {
		const { caller, actor } = await createOrgCaller();
		const organizationId = actor.organizationId;

		const assignment = await caller.org.assignRole({
			organizationId,
			memberId: payload.memberId,
			roleTemplateId: payload.roleTemplateId,
			orgUnitId: payload.orgUnitId,
			startAt: payload.startAt ? new Date(payload.startAt) : undefined,
			endAt: payload.endAt ? new Date(payload.endAt) : undefined,
		});

		return NextResponse.json({ assignment });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 403 });
	}
}

export async function PATCH(request: NextRequest) {
	const payload = (await request.json()) as {
		assignmentId?: string;
		endAt?: string;
	};

	if (!payload.assignmentId) {
		return NextResponse.json(
			{ error: 'assignmentId is required' },
			{ status: 400 }
		);
	}

	try {
		const { caller, actor } = await createOrgCaller();
		const organizationId = actor.organizationId;
		const assignment = await caller.org.endRoleAssignment({
			organizationId,
			assignmentId: payload.assignmentId,
			endAt: payload.endAt ? new Date(payload.endAt) : undefined,
		});
		return NextResponse.json({ assignment });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 403 });
	}
}
