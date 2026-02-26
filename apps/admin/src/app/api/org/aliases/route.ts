import { NextRequest, NextResponse } from 'next/server';
import { requireDatabaseForApi } from '@/lib/database-guard';
import { createOrgCaller } from '@/lib/org-caller';

export async function GET() {
	const dbUnavailable = requireDatabaseForApi('org.aliases.get');
	if (dbUnavailable) return dbUnavailable;

	try {
		const { caller, actor } = await createOrgCaller();
		const organizationId = actor.organizationId;
		const aliases = await caller.org.listUnitAliases({ organizationId });
		return NextResponse.json({ aliases });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 403 });
	}
}

export async function POST(request: NextRequest) {
	const dbUnavailable = requireDatabaseForApi('org.aliases.post');
	if (dbUnavailable) return dbUnavailable;

	const payload = (await request.json()) as {
		idempotencyKey?: string;
		concept?: 'HEADQUARTERS' | 'REGION' | 'BRANCH' | 'CAMPUS' | 'DIASPORA' | 'ZONE' | 'DEPARTMENT' | 'MINISTRY';
		singularLabel?: string;
		pluralLabel?: string;
	};

	if (!payload.concept || !payload.singularLabel || !payload.pluralLabel) {
		return NextResponse.json(
			{ error: 'concept, singularLabel, and pluralLabel are required' },
			{ status: 400 }
		);
	}

	try {
		const { caller, actor } = await createOrgCaller();
		const organizationId = actor.organizationId;
		const alias = await caller.org.upsertUnitAlias({
			organizationId,
			idempotencyKey: payload.idempotencyKey ?? request.headers.get('x-idempotency-key') ?? undefined,
			concept: payload.concept,
			singularLabel: payload.singularLabel,
			pluralLabel: payload.pluralLabel,
		});
		return NextResponse.json({ alias });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 403 });
	}
}
