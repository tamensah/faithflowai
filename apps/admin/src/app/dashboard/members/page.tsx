import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@faithflow/database';
import { listOrganizationUnits, resolveOrganizationScope } from '@/lib/executive-rollups';

function toPositiveInt(value: string | undefined, fallback: number, min: number, max: number): number {
	if (!value) return fallback;
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(Math.max(Math.floor(parsed), min), max);
}

function buildMembersHref(input: {
	query?: string;
	page?: number;
	pageSize?: number;
	orgUnitId?: string;
	includeDescendants?: boolean;
}): string {
	const params = new URLSearchParams();
	if (input.query) params.set('query', input.query);
	if (input.page && input.page > 1) params.set('page', String(input.page));
	if (input.pageSize && input.pageSize !== 20) params.set('pageSize', String(input.pageSize));
	if (input.orgUnitId) params.set('orgUnitId', input.orgUnitId);
	if (input.includeDescendants === false) params.set('includeDescendants', 'false');
	const query = params.toString();
	return `/dashboard/members${query ? `?${query}` : ''}`;
}

export default async function MembersPage({
	searchParams,
}: {
	searchParams: Record<string, string | string[] | undefined>;
}) {
	const { orgId } = await auth();
	if (!orgId) {
		return (
			<div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
				Select an organization in Clerk to load members.
			</div>
		);
	}

	const queryParam = searchParams.query;
	const pageParam = searchParams.page;
	const pageSizeParam = searchParams.pageSize;
	const orgUnitParam = searchParams.orgUnitId;
	const includeDescendantsParam = searchParams.includeDescendants;

	const query = typeof queryParam === 'string' ? queryParam.trim() : '';
	const page = toPositiveInt(typeof pageParam === 'string' ? pageParam : undefined, 1, 1, 500);
	const pageSize = toPositiveInt(typeof pageSizeParam === 'string' ? pageSizeParam : undefined, 20, 10, 100);
	const orgUnitId = typeof orgUnitParam === 'string' && orgUnitParam ? orgUnitParam : null;
	const includeDescendants =
		typeof includeDescendantsParam === 'string' ? includeDescendantsParam !== 'false' : true;
	const units = await listOrganizationUnits(orgId);
	const scope = await resolveOrganizationScope({
		organizationId: orgId,
		orgUnitId,
		includeDescendants,
	});

	const churchFilter =
		scope.churchIds.length > 0 ? { in: scope.churchIds } : undefined;
	const where = {
		church: { organizationId: orgId },
		churchId: churchFilter,
		OR: query
			? [
					{ firstName: { contains: query, mode: 'insensitive' as const } },
					{ lastName: { contains: query, mode: 'insensitive' as const } },
					{ email: { contains: query, mode: 'insensitive' as const } },
			  ]
			: undefined,
	};

	const [totalCount, members] = await Promise.all([
		prisma.member.count({ where }),
		prisma.member.findMany({
			where,
			orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
			skip: (page - 1) * pageSize,
			take: pageSize,
			select: {
				id: true,
				firstName: true,
				lastName: true,
				email: true,
				createdAt: true,
				church: { select: { name: true } },
			},
		}),
	]);

	const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
	const safePage = Math.min(page, totalPages);
	const prevHref =
		safePage > 1
			? buildMembersHref({
					query,
					page: safePage - 1,
					pageSize,
					orgUnitId: scope.selectedOrgUnitId ?? undefined,
					includeDescendants: scope.includeDescendants,
			  })
			: null;
	const nextHref =
		safePage < totalPages
			? buildMembersHref({
					query,
					page: safePage + 1,
					pageSize,
					orgUnitId: scope.selectedOrgUnitId ?? undefined,
					includeDescendants: scope.includeDescendants,
			  })
			: null;

	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold text-gray-900">Members</h1>
			<p className="text-sm text-gray-600">Server-filtered member directory with org-unit scoping.</p>
			<form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-5 md:items-end">
				<label className="text-sm font-medium text-slate-700">
					Search
					<input
						name="query"
						defaultValue={query}
						placeholder="Name or email"
						className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
					/>
				</label>
				<label className="text-sm font-medium text-slate-700">
					Org unit
					<select
						name="orgUnitId"
						defaultValue={scope.selectedOrgUnitId ?? ''}
						className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
					>
						<option value="">All units</option>
						{units.map((unit) => (
							<option key={unit.id} value={unit.id}>
								{unit.name} ({unit.type})
							</option>
						))}
					</select>
				</label>
				<label className="text-sm font-medium text-slate-700">
					Scope
					<select
						name="includeDescendants"
						defaultValue={scope.includeDescendants ? 'true' : 'false'}
						className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
					>
						<option value="true">Include descendants</option>
						<option value="false">Selected unit only</option>
					</select>
				</label>
				<label className="text-sm font-medium text-slate-700">
					Page size
					<select
						name="pageSize"
						defaultValue={String(pageSize)}
						className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
					>
						<option value="20">20</option>
						<option value="50">50</option>
						<option value="100">100</option>
					</select>
				</label>
				<button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">
					Apply filters
				</button>
			</form>

			<div className="rounded-lg border border-slate-200 bg-white p-4">
				<div className="flex items-center justify-between">
					<p className="text-sm text-slate-600">
						{totalCount} member{totalCount === 1 ? '' : 's'} found
						{scope.selectedOrgUnitName ? ` in ${scope.selectedOrgUnitName}` : ' in organization'}
					</p>
					<Link
						href={buildMembersHref({
							query,
							page: 1,
							pageSize,
							orgUnitId: scope.selectedOrgUnitId ?? undefined,
							includeDescendants: scope.includeDescendants,
						})}
						className="text-xs font-medium text-blue-700"
					>
						Reset to page 1
					</Link>
				</div>
				<div className="mt-3 overflow-x-auto">
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
							<tr>
								<th className="px-3 py-2">Member</th>
								<th className="px-3 py-2">Email</th>
								<th className="px-3 py-2">Church</th>
								<th className="px-3 py-2">Created</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-200">
							{members.length ? (
								members.map((member) => (
									<tr key={member.id}>
										<td className="px-3 py-2 font-medium text-slate-900">
											{member.firstName} {member.lastName}
										</td>
										<td className="px-3 py-2 text-slate-600">{member.email ?? '—'}</td>
										<td className="px-3 py-2 text-slate-600">{member.church.name}</td>
										<td className="px-3 py-2 text-slate-600">
											{new Date(member.createdAt).toLocaleDateString()}
										</td>
									</tr>
								))
							) : (
								<tr>
									<td colSpan={4} className="px-3 py-8 text-center text-slate-500">
										No members found for current filters.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
				<div className="mt-4 flex items-center justify-between">
					<p className="text-xs text-slate-500">
						Page {safePage} of {totalPages}
					</p>
					<div className="flex items-center gap-2">
						{prevHref ? (
							<Link href={prevHref} className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700">
								Previous
							</Link>
						) : (
							<span className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-400">Previous</span>
						)}
						{nextHref ? (
							<Link href={nextHref} className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700">
								Next
							</Link>
						) : (
							<span className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-400">Next</span>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
