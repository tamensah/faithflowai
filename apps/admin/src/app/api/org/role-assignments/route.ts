import { NextRequest, NextResponse } from 'next/server';
import { createOrgCaller } from '@/lib/org-caller';

export async function GET(request: NextRequest) {
	const status = request.nextUrl.searchParams.get('status') ?? undefined;
	const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined;
	const query = request.nextUrl.searchParams.get('query') ?? undefined;
	const requestedLimit = Number(request.nextUrl.searchParams.get('limit') ?? '20');
	const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 20;

	try {
		const { caller, actor } = await createOrgCaller();
		const organizationId = actor.organizationId;
		const assignments = await caller.org.listRoleAssignments({
			organizationId,
			status:
				status && ['PLANNED', 'ACTIVE', 'SUSPENDED', 'ENDED'].includes(status)
					? (status as 'PLANNED' | 'ACTIVE' | 'SUSPENDED' | 'ENDED')
					: undefined,
			cursor,
			query,
			limit,
		});
		return NextResponse.json(assignments);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		const statusCode = message.startsWith('Unauthorized') ? 401 : 403;
		return NextResponse.json({ error: message }, { status: statusCode });
	}
}

export async function POST(request: NextRequest) {
	const payload = (await request.json()) as {
		idempotencyKey?: string;
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
			idempotencyKey: payload.idempotencyKey ?? request.headers.get('x-idempotency-key') ?? undefined,
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
		idempotencyKey?: string;
		operation?: 'end' | 'update';
		assignmentId?: string;
		startAt?: string | null;
		endAt?: string | null;
		status?: 'PLANNED' | 'ACTIVE' | 'SUSPENDED' | 'ENDED';
		metadata?: Record<string, unknown>;
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
		const idempotencyKey =
			payload.idempotencyKey ?? request.headers.get('x-idempotency-key') ?? undefined;

		const assignment =
			payload.operation === 'update'
				? await caller.org.updateRoleAssignment({
						organizationId,
						idempotencyKey,
						assignmentId: payload.assignmentId,
						startAt:
							payload.startAt === null
								? null
								: payload.startAt
									? new Date(payload.startAt)
									: undefined,
						endAt:
							payload.endAt === null
								? null
								: payload.endAt
									? new Date(payload.endAt)
									: undefined,
						status: payload.status,
						metadata: payload.metadata,
					})
				: await caller.org.endRoleAssignment({
						organizationId,
						idempotencyKey,
						assignmentId: payload.assignmentId,
						endAt: payload.endAt ? new Date(payload.endAt) : undefined,
					});
		return NextResponse.json({ assignment });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 403 });
	}
}
