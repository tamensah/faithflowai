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
	const dbUnavailable = requireDatabaseForApi('facilities.post');
	if (dbUnavailable) return dbUnavailable;

	const payload = (await request.json().catch(() => ({}))) as {
		action?: 'createReservation';
		facilityName?: string;
		note?: string;
	};

	if (payload.action !== 'createReservation') {
		return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
	}
	if (!payload.facilityName?.trim()) {
		return NextResponse.json({ error: 'facilityName is required.' }, { status: 400 });
	}

	try {
		const { actor } = await createAppCaller();
		const addonState = await getAddonStateForOrganization(actor.organizationId);
		if (!isAddonEnabled(addonState, 'FACILITIES_SUITE')) {
			return NextResponse.json(
				{
					error: 'Feature locked: FACILITIES_SUITE entitlement is required.',
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
				action: 'FACILITY_RESERVATION_CREATED',
				entityType: 'FacilityReservation',
				entityId: null,
				result: 'SUCCESS',
				metadata: {
					facilityName: payload.facilityName.trim(),
					note: payload.note ?? null,
				},
			},
		});

		return NextResponse.json({
			ok: true,
			message: 'Facility reservation request captured.',
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Facility action failed';
		return NextResponse.json({ error: message }, { status: parseStatus(error) });
	}
}
