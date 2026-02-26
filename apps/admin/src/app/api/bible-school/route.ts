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
	const dbUnavailable = requireDatabaseForApi('bible-school.post');
	if (dbUnavailable) return dbUnavailable;

	const payload = (await request.json().catch(() => ({}))) as {
		action?: 'createCohort';
		cohortName?: string;
		term?: string;
	};

	if (payload.action !== 'createCohort') {
		return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
	}
	if (!payload.cohortName?.trim()) {
		return NextResponse.json({ error: 'cohortName is required.' }, { status: 400 });
	}

	try {
		const { actor } = await createAppCaller();
		const addonState = await getAddonStateForOrganization(actor.organizationId);
		if (!isAddonEnabled(addonState, 'BIBLE_SCHOOL_SUITE')) {
			return NextResponse.json(
				{
					error: 'Feature locked: BIBLE_SCHOOL_SUITE entitlement is required.',
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
				action: 'BIBLE_SCHOOL_COHORT_CREATED',
				entityType: 'BibleSchoolCohort',
				entityId: null,
				result: 'SUCCESS',
				metadata: {
					cohortName: payload.cohortName.trim(),
					term: payload.term?.trim() || null,
				},
			},
		});

		return NextResponse.json({
			ok: true,
			message: 'Bible school cohort request captured.',
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Bible school action failed';
		return NextResponse.json({ error: message }, { status: parseStatus(error) });
	}
}
