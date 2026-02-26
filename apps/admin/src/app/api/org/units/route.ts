import { NextRequest, NextResponse } from 'next/server';
import { requireDatabaseForApi } from '@/lib/database-guard';
import { createOrgCaller } from '@/lib/org-caller';

export async function GET(request: NextRequest) {
	const dbUnavailable = requireDatabaseForApi('org.units.get');
	if (dbUnavailable) return dbUnavailable;

	const parentUnitId = request.nextUrl.searchParams.get('parentUnitId') ?? undefined;

	try {
		const { caller, actor } = await createOrgCaller();
		const organizationId = actor.organizationId;
		const units = await caller.org.listHierarchyNodes({ organizationId, parentUnitId });
		return NextResponse.json({ units });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 403 });
	}
}

export async function POST(request: NextRequest) {
	const dbUnavailable = requireDatabaseForApi('org.units.post');
	if (dbUnavailable) return dbUnavailable;

	const payload = (await request.json()) as {
		idempotencyKey?: string;
		churchId?: string;
		parentUnitId?: string;
		type?: 'HEADQUARTERS' | 'REGION' | 'BRANCH' | 'CAMPUS' | 'DIASPORA' | 'ZONE' | 'DEPARTMENT' | 'MINISTRY';
		name?: string;
		slug?: string;
		countryIso2?: string;
		timezone?: string;
	};

	if (!payload.type || !payload.name || !payload.slug) {
		return NextResponse.json(
			{ error: 'type, name, and slug are required' },
			{ status: 400 }
		);
	}

	try {
		const { caller, actor } = await createOrgCaller();
		const organizationId = actor.organizationId;
		const unit = await caller.org.createUnit({
			organizationId,
			idempotencyKey: payload.idempotencyKey ?? request.headers.get('x-idempotency-key') ?? undefined,
			churchId: payload.churchId,
			parentUnitId: payload.parentUnitId,
			type: payload.type,
			name: payload.name,
			slug: payload.slug,
			countryIso2: payload.countryIso2,
			timezone: payload.timezone ?? 'UTC',
		});

		return NextResponse.json({ unit });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 403 });
	}
}

export async function PATCH(request: NextRequest) {
	const dbUnavailable = requireDatabaseForApi('org.units.patch');
	if (dbUnavailable) return dbUnavailable;

	const payload = (await request.json()) as {
		idempotencyKey?: string;
		operation?: 'update' | 'move';
		unitId?: string;
		newParentUnitId?: string;
		name?: string;
		countryIso2?: string;
		timezone?: string;
		status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
	};

	if (!payload.unitId) {
		return NextResponse.json(
			{ error: 'unitId is required' },
			{ status: 400 }
		);
	}

	try {
		const { caller, actor } = await createOrgCaller();
		const organizationId = actor.organizationId;

		if (payload.operation === 'move') {
			const moved = await caller.org.moveUnit({
				organizationId,
				idempotencyKey: payload.idempotencyKey ?? request.headers.get('x-idempotency-key') ?? undefined,
				unitId: payload.unitId,
				newParentUnitId: payload.newParentUnitId,
			});
			return NextResponse.json({ unit: moved });
		}

		const updated = await caller.org.updateUnit({
			organizationId,
			idempotencyKey: payload.idempotencyKey ?? request.headers.get('x-idempotency-key') ?? undefined,
			unitId: payload.unitId,
			name: payload.name,
			countryIso2: payload.countryIso2,
			timezone: payload.timezone,
			status: payload.status,
		});
		return NextResponse.json({ unit: updated });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 403 });
	}
}
