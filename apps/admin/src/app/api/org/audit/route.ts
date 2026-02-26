import { NextRequest, NextResponse } from 'next/server';
import { requireDatabaseForApi } from '@/lib/database-guard';
import { createOrgCaller } from '@/lib/org-caller';

function toCsvCell(value: unknown): string {
	if (value === null || value === undefined) return '';
	const text = String(value);
	const escaped = text.replace(/"/g, '""');
	return `"${escaped}"`;
}

export async function GET(request: NextRequest) {
	const dbUnavailable = requireDatabaseForApi('org.audit.get');
	if (dbUnavailable) return dbUnavailable;

	const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined;
	const action = request.nextUrl.searchParams.get('action') ?? undefined;
	const orgUnitId = request.nextUrl.searchParams.get('orgUnitId') ?? undefined;
	const query = request.nextUrl.searchParams.get('query') ?? undefined;
	const format = request.nextUrl.searchParams.get('format');
	const requestedLimit = Number(request.nextUrl.searchParams.get('limit') ?? '100');
	const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 1000) : 100;
	const result = request.nextUrl.searchParams.get('result') as
		| 'SUCCESS'
		| 'DENIED'
		| 'FAILED'
		| null;

	try {
		const { caller, actor } = await createOrgCaller();
		const organizationId = actor.organizationId;
		const audit = await caller.org.listAuditEvents({
			organizationId,
			cursor,
			action,
			orgUnitId,
			result: result ?? undefined,
			query,
			limit,
		});

		if (format === 'csv') {
			const header = [
				'id',
				'createdAt',
				'action',
				'result',
				'orgUnitId',
				'entityType',
				'entityId',
				'actorId',
				'reason',
			];
			const rows = audit.items.map((event) =>
				[
					toCsvCell(event.id),
					toCsvCell(event.createdAt),
					toCsvCell(event.action),
					toCsvCell(event.result),
					toCsvCell(event.orgUnitId),
					toCsvCell(event.entityType),
					toCsvCell(event.entityId),
					toCsvCell(event.actorId),
					toCsvCell(event.reason),
				].join(',')
			);
			const csv = [header.join(','), ...rows].join('\n');

			return new NextResponse(csv, {
				status: 200,
				headers: {
					'Content-Type': 'text/csv; charset=utf-8',
					'Content-Disposition': `attachment; filename="faithflow-audit-${organizationId}.csv"`,
				},
			});
		}

		return NextResponse.json(audit);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 403 });
	}
}
