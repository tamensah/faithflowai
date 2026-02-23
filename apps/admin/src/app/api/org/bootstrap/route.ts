import { NextResponse } from 'next/server';
import { createOrgCaller } from '@/lib/org-caller';

export async function GET() {
	try {
		const { caller, actor } = await createOrgCaller();
		const organizationId = actor.organizationId;
		const [units, aliases, hierarchyOverview, roleTemplates, members, assignmentsPage, audit] =
			await Promise.all([
				caller.org.listUnits({ organizationId }),
				caller.org.listUnitAliases({ organizationId }),
				caller.org.getHierarchyOverview({ organizationId }),
				caller.org.listRoleTemplates({ organizationId }),
				caller.org.listMembers({ organizationId, limit: 500 }),
				caller.org.listRoleAssignments({ organizationId, limit: 20 }),
				caller.org.listAuditEvents({ organizationId, limit: 20 }),
			]);

		return NextResponse.json({
			organizationId,
			units,
			aliases,
			hierarchyOverview,
			roleTemplates,
			members,
			assignments: assignmentsPage.items,
			assignmentsNextCursor: assignmentsPage.nextCursor,
			audit: audit.items,
			auditNextCursor: audit.nextCursor,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		const status = message.startsWith('Unauthorized') ? 401 : 403;
		return NextResponse.json({ error: message }, { status });
	}
}
