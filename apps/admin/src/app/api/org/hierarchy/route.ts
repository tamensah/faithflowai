import { NextRequest, NextResponse } from 'next/server';
import { requireDatabaseForApi } from '@/lib/database-guard';
import { createOrgCaller } from '@/lib/org-caller';

export async function GET(request: NextRequest) {
	const dbUnavailable = requireDatabaseForApi('org.hierarchy.get');
	if (dbUnavailable) return dbUnavailable;

	const parentUnitId = request.nextUrl.searchParams.get('parentUnitId') ?? undefined;

	try {
		const { caller, actor } = await createOrgCaller();
		const organizationId = actor.organizationId;
		const [nodes, overview] = await Promise.all([
			caller.org.listHierarchyNodes({ organizationId, parentUnitId }),
			caller.org.getHierarchyOverview({ organizationId }),
		]);

		return NextResponse.json({ nodes, overview });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 403 });
	}
}
