import { NextRequest, NextResponse } from 'next/server';
import { createOrgCaller } from '@/lib/org-caller';

export async function GET(_request: NextRequest) {
	try {
		const { caller, actor } = await createOrgCaller();
		const organizationId = actor.organizationId;
		const [units, roleTemplates, members, assignments, audit] = await Promise.all([
			caller.org.listUnits({ organizationId }),
			caller.org.listRoleTemplates({ organizationId }),
			caller.org.listMembers({ organizationId, limit: 500 }),
			caller.org.listRoleAssignments({ organizationId, limit: 500 }),
			caller.org.listAuditEvents({ organizationId, limit: 100 }),
		]);

		return NextResponse.json({
			organizationId,
			units,
			roleTemplates,
			members,
			assignments,
			audit: audit.items,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		const status = message.startsWith('Unauthorized') ? 401 : 403;
		return NextResponse.json({ error: message }, { status });
	}
}
