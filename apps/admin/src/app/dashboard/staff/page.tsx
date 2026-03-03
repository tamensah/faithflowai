import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { Prisma, prisma } from '@faithflow/database';
import { OrgContextLockPanel } from '@/components/locks/org-context-lock-panel';
import { createAssignmentAction, updateAssignmentStatusAction } from './actions';

const STATUS_FILTERS = ['ALL', 'PLANNED', 'ACTIVE', 'SUSPENDED', 'ENDED'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
type AssignmentStatus = Exclude<StatusFilter, 'ALL'>;
type QuickAction = {
	id: 'activate' | 'suspend' | 'end';
	label: string;
	className: string;
};
type StaffAuditEntry = {
	id: string;
	actorId: string;
	createdAt: Date;
	result: string;
	note: string;
};

function toPositiveInt(value: string | undefined, fallback: number, min: number, max: number): number {
	if (!value) return fallback;
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(Math.max(Math.floor(parsed), min), max);
}

function toStringParam(value: string | string[] | undefined): string | undefined {
	if (typeof value === 'string') return value;
	return undefined;
}

function buildStaffHref(input: {
	query?: string;
	status?: StatusFilter;
	orgUnitId?: string;
	page?: number;
	pageSize?: number;
}): string {
	const params = new URLSearchParams();
	if (input.query) params.set('query', input.query);
	if (input.status && input.status !== 'ALL') params.set('status', input.status);
	if (input.orgUnitId) params.set('orgUnitId', input.orgUnitId);
	if (input.page && input.page > 1) params.set('page', String(input.page));
	if (input.pageSize && input.pageSize !== 20) params.set('pageSize', String(input.pageSize));
	const query = params.toString();
	return `/dashboard/staff${query ? `?${query}` : ''}`;
}

function formatDateTime(value: Date | null): string {
	if (!value) return '—';
	return new Date(value).toLocaleString();
}

function formatAuditNote(metadata: Prisma.JsonValue | null): string {
	if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return 'Status updated.';
	const value = metadata as Record<string, unknown>;
	const operation = typeof value.operation === 'string' ? value.operation : null;
	const previousStatus = typeof value.previousStatus === 'string' ? value.previousStatus : null;
	const nextStatus = typeof value.nextStatus === 'string' ? value.nextStatus : null;
	if (operation === 'END') return 'Assignment ended.';
	if (operation === 'UPDATE' && previousStatus && nextStatus) {
		return `Status changed ${previousStatus} -> ${nextStatus}.`;
	}
	if (operation === 'UPDATE' && nextStatus) return `Status set to ${nextStatus}.`;
	return operation ? `Operation: ${operation}.` : 'Assignment changed.';
}

function statusBadgeClass(status: AssignmentStatus): string {
	if (status === 'ACTIVE') return 'bg-emerald-100 text-emerald-700';
	if (status === 'SUSPENDED') return 'bg-amber-100 text-amber-700';
	if (status === 'PLANNED') return 'bg-blue-100 text-blue-700';
	return 'bg-slate-100 text-slate-700';
}

function quickActionsForStatus(status: AssignmentStatus): QuickAction[] {
	if (status === 'PLANNED') {
		return [
			{
				id: 'activate',
				label: 'Activate',
				className: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
			},
			{
				id: 'end',
				label: 'End',
				className: 'border-rose-200 text-rose-700 hover:bg-rose-50',
			},
		];
	}
	if (status === 'ACTIVE') {
		return [
			{
				id: 'suspend',
				label: 'Suspend',
				className: 'border-amber-200 text-amber-700 hover:bg-amber-50',
			},
			{
				id: 'end',
				label: 'End',
				className: 'border-rose-200 text-rose-700 hover:bg-rose-50',
			},
		];
	}
	if (status === 'SUSPENDED') {
		return [
			{
				id: 'activate',
				label: 'Reactivate',
				className: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
			},
			{
				id: 'end',
				label: 'End',
				className: 'border-rose-200 text-rose-700 hover:bg-rose-50',
			},
		];
	}
	return [];
}

export default async function StaffPage({
	searchParams,
}: {
	searchParams: Record<string, string | string[] | undefined>;
}) {
	const { orgId } = await auth();
	if (!orgId) {
		return (
			<div className="space-y-4">
				<h1 className="text-2xl font-semibold text-slate-900">Staff</h1>
				<OrgContextLockPanel moduleName="Staff console" />
			</div>
		);
	}

	const query = (toStringParam(searchParams.query) ?? '').trim();
	const statusParam = toStringParam(searchParams.status);
	const statusFilter: StatusFilter =
		STATUS_FILTERS.find((item) => item === statusParam) ?? 'ALL';
	const selectedOrgUnitId = (toStringParam(searchParams.orgUnitId) ?? '').trim() || '';
	const page = toPositiveInt(toStringParam(searchParams.page), 1, 1, 500);
	const pageSize = toPositiveInt(toStringParam(searchParams.pageSize), 20, 10, 100);

	const where: Prisma.UnitRoleAssignmentWhereInput = {
		organizationId: orgId,
		...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
		...(selectedOrgUnitId ? { orgUnitId: selectedOrgUnitId } : {}),
		...(query
			? {
					OR: [
						{ member: { firstName: { contains: query, mode: 'insensitive' } } },
						{ member: { lastName: { contains: query, mode: 'insensitive' } } },
						{ member: { email: { contains: query, mode: 'insensitive' } } },
						{ roleTemplate: { name: { contains: query, mode: 'insensitive' } } },
						{ roleTemplate: { code: { contains: query, mode: 'insensitive' } } },
						{ orgUnit: { name: { contains: query, mode: 'insensitive' } } },
					],
				}
			: {}),
	};

	const [statusRows, totalAssignments, members, roleTemplates, orgUnits] = await Promise.all([
		prisma.unitRoleAssignment.groupBy({
			by: ['status'],
			where: { organizationId: orgId },
			_count: { _all: true },
		}),
		prisma.unitRoleAssignment.count({ where }),
		prisma.member.findMany({
			where: { church: { organizationId: orgId } },
			orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
			take: 200,
			select: {
				id: true,
				firstName: true,
				lastName: true,
				email: true,
			},
		}),
		prisma.roleTemplate.findMany({
			where: { organizationId: orgId },
			orderBy: [{ isLeadership: 'desc' }, { name: 'asc' }],
			select: {
				id: true,
				name: true,
				code: true,
				isLeadership: true,
			},
		}),
		prisma.orgUnit.findMany({
			where: { organizationId: orgId },
			orderBy: [{ type: 'asc' }, { name: 'asc' }],
			select: {
				id: true,
				name: true,
				type: true,
			},
		}),
	]);
	const totalPages = Math.max(1, Math.ceil(totalAssignments / pageSize));
	const safePage = Math.min(page, totalPages);
	const assignments = await prisma.unitRoleAssignment.findMany({
		where,
		orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
		skip: (safePage - 1) * pageSize,
		take: pageSize,
		select: {
			id: true,
			status: true,
			startAt: true,
			endAt: true,
			member: {
				select: {
					firstName: true,
					lastName: true,
					email: true,
				},
			},
			roleTemplate: {
				select: {
					name: true,
					code: true,
					isLeadership: true,
				},
			},
			orgUnit: {
				select: {
					name: true,
					type: true,
				},
			},
		},
	});
	const assignmentIds = assignments.map((assignment) => assignment.id);
	const assignmentAuditRows = assignmentIds.length
		? await prisma.auditEvent.findMany({
				where: {
					organizationId: orgId,
					action: 'ROLE_ASSIGNMENT_CHANGE',
					entityType: 'UnitRoleAssignment',
					entityId: { in: assignmentIds },
				},
				orderBy: { createdAt: 'desc' },
				take: Math.max(assignmentIds.length * 4, 40),
				select: {
					id: true,
					entityId: true,
					actorId: true,
					createdAt: true,
					result: true,
					metadata: true,
				},
			})
		: [];
	const assignmentAuditMap = new Map<string, StaffAuditEntry[]>();
	for (const row of assignmentAuditRows) {
		if (!row.entityId) continue;
		const existing = assignmentAuditMap.get(row.entityId) ?? [];
		if (existing.length >= 3) continue;
		existing.push({
			id: row.id,
			actorId: row.actorId,
			createdAt: row.createdAt,
			result: row.result,
			note: formatAuditNote(row.metadata),
		});
		assignmentAuditMap.set(row.entityId, existing);
	}

	const statusTotals: Record<AssignmentStatus, number> = {
		PLANNED: 0,
		ACTIVE: 0,
		SUSPENDED: 0,
		ENDED: 0,
	};
	for (const row of statusRows) {
		statusTotals[row.status as AssignmentStatus] = row._count._all;
	}
	const prevHref =
		safePage > 1
			? buildStaffHref({
					query,
					status: statusFilter,
					orgUnitId: selectedOrgUnitId || undefined,
					page: safePage - 1,
					pageSize,
			  })
			: null;
	const nextHref =
		safePage < totalPages
			? buildStaffHref({
					query,
					status: statusFilter,
					orgUnitId: selectedOrgUnitId || undefined,
					page: safePage + 1,
					pageSize,
			  })
			: null;

	return (
		<div className="space-y-6">
			<div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-900 to-blue-700 p-6 text-white">
				<p className="text-xs uppercase tracking-[0.2em] text-blue-200">Staff operations</p>
				<h1 className="mt-2 text-3xl font-semibold">Leadership and assignment control</h1>
				<p className="mt-2 text-sm text-blue-100">
					Track planned, active, and suspended assignments before changes are published to ministries.
				</p>
				<div className="mt-4 flex flex-wrap gap-3">
					<Link
						href="/dashboard/org"
						className="rounded-md border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white"
					>
						Open organization builder
					</Link>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-4">
				<div className="rounded-xl border border-slate-200 bg-white p-4">
					<p className="text-xs uppercase tracking-[0.16em] text-slate-500">Planned</p>
					<p className="mt-2 text-2xl font-semibold text-slate-900">{statusTotals.PLANNED}</p>
				</div>
				<div className="rounded-xl border border-slate-200 bg-white p-4">
					<p className="text-xs uppercase tracking-[0.16em] text-slate-500">Active</p>
					<p className="mt-2 text-2xl font-semibold text-slate-900">{statusTotals.ACTIVE}</p>
				</div>
				<div className="rounded-xl border border-slate-200 bg-white p-4">
					<p className="text-xs uppercase tracking-[0.16em] text-slate-500">Suspended</p>
					<p className="mt-2 text-2xl font-semibold text-slate-900">{statusTotals.SUSPENDED}</p>
				</div>
				<div className="rounded-xl border border-slate-200 bg-white p-4">
					<p className="text-xs uppercase tracking-[0.16em] text-slate-500">Ended</p>
					<p className="mt-2 text-2xl font-semibold text-slate-900">{statusTotals.ENDED}</p>
				</div>
			</div>

			<div className="rounded-xl border border-slate-200 bg-white p-5">
				<div className="flex items-center justify-between">
					<h2 className="text-base font-semibold text-slate-900">Quick assign</h2>
					<span className="text-xs uppercase tracking-[0.12em] text-slate-500">
						{members.length} members · {roleTemplates.length} roles · {orgUnits.length} org units
					</span>
				</div>
				{members.length === 0 || roleTemplates.length === 0 || orgUnits.length === 0 ? (
					<div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
						Missing setup for assignment creation. Ensure members, role templates, and org units exist.
					</div>
				) : (
					<form action={createAssignmentAction} className="mt-4 grid gap-3 md:grid-cols-5 md:items-end">
						<label className="text-sm font-medium text-slate-700">
							Member *
							<select
								name="memberId"
								required
								defaultValue=""
								className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
							>
								<option value="" disabled>
									Select member
								</option>
								{members.map((member) => (
									<option key={member.id} value={member.id}>
										{member.firstName} {member.lastName}
										{member.email ? ` (${member.email})` : ''}
									</option>
								))}
							</select>
						</label>
						<label className="text-sm font-medium text-slate-700">
							Role template *
							<select
								name="roleTemplateId"
								required
								defaultValue=""
								className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
							>
								<option value="" disabled>
									Select role template
								</option>
								{roleTemplates.map((role) => (
									<option key={role.id} value={role.id}>
										{role.name} ({role.code})
										{role.isLeadership ? ' · leadership' : ''}
									</option>
								))}
							</select>
						</label>
						<label className="text-sm font-medium text-slate-700">
							Org unit *
							<select
								name="orgUnitId"
								required
								defaultValue=""
								className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
							>
								<option value="" disabled>
									Select org unit
								</option>
								{orgUnits.map((unit) => (
									<option key={unit.id} value={unit.id}>
										{unit.name} ({unit.type})
									</option>
								))}
							</select>
						</label>
						<label className="text-sm font-medium text-slate-700">
							Start at
							<input
								name="startAt"
								type="datetime-local"
								className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
							/>
						</label>
						<div className="grid gap-3">
							<label className="text-sm font-medium text-slate-700">
								Status
								<select
									name="status"
									defaultValue="ACTIVE"
									className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
								>
									<option value="ACTIVE">Active</option>
									<option value="PLANNED">Planned</option>
								</select>
							</label>
							<button
								type="submit"
								className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
							>
								Create assignment
							</button>
						</div>
					</form>
				)}
			</div>

			<div className="rounded-xl border border-slate-200 bg-white p-5">
				<div className="flex items-center justify-between">
					<h2 className="text-base font-semibold text-slate-900">Current assignment queue</h2>
					<span className="text-xs uppercase tracking-[0.14em] text-slate-500">
						{totalAssignments} total
					</span>
				</div>
				<form className="mt-4 grid gap-3 md:grid-cols-5 md:items-end">
					<label className="text-sm font-medium text-slate-700">
						Search
						<input
							name="query"
							defaultValue={query}
							placeholder="Member, role, unit..."
							className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
						/>
					</label>
					<label className="text-sm font-medium text-slate-700">
						Status
						<select
							name="status"
							defaultValue={statusFilter}
							className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
						>
							{STATUS_FILTERS.map((status) => (
								<option key={status} value={status}>
									{status}
								</option>
							))}
						</select>
					</label>
					<label className="text-sm font-medium text-slate-700">
						Org unit
						<select
							name="orgUnitId"
							defaultValue={selectedOrgUnitId}
							className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
						>
							<option value="">All units</option>
							{orgUnits.map((unit) => (
								<option key={unit.id} value={unit.id}>
									{unit.name} ({unit.type})
								</option>
							))}
						</select>
					</label>
					<label className="text-sm font-medium text-slate-700">
						Page size
						<select
							name="pageSize"
							defaultValue={String(pageSize)}
							className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
						>
							<option value="20">20</option>
							<option value="50">50</option>
							<option value="100">100</option>
						</select>
					</label>
					<button
						type="submit"
						className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
					>
						Apply filters
					</button>
				</form>
				<div className="mt-4 overflow-x-auto">
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
							<tr>
								<th className="px-3 py-2">Member</th>
								<th className="px-3 py-2">Role</th>
								<th className="px-3 py-2">Org unit</th>
								<th className="px-3 py-2">Status</th>
								<th className="px-3 py-2">Timeline</th>
								<th className="px-3 py-2">Quick actions</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-200">
							{assignments.length ? (
								assignments.map((assignment) => (
									<tr key={assignment.id}>
										<td className="px-3 py-2">
											<div className="font-medium text-slate-900">
												{assignment.member.firstName} {assignment.member.lastName}
											</div>
											<div className="text-xs text-slate-500">{assignment.member.email ?? 'No email'}</div>
										</td>
										<td className="px-3 py-2">
											<div className="text-slate-900">{assignment.roleTemplate.name}</div>
											<div className="text-xs text-slate-500">
												{assignment.roleTemplate.code}
												{assignment.roleTemplate.isLeadership ? ' · leadership' : ''}
											</div>
										</td>
										<td className="px-3 py-2">
											<div className="text-slate-900">{assignment.orgUnit.name}</div>
											<div className="text-xs text-slate-500">{assignment.orgUnit.type}</div>
										</td>
										<td className="px-3 py-2">
											<span
												className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(
													assignment.status as AssignmentStatus
												)}`}
											>
												{assignment.status}
											</span>
										</td>
										<td className="px-3 py-2 text-xs text-slate-600">
											<div>Start: {formatDateTime(assignment.startAt)}</div>
											<div>End: {formatDateTime(assignment.endAt)}</div>
											<div className="mt-2 space-y-1">
												{(assignmentAuditMap.get(assignment.id) ?? []).map((audit) => (
													<div key={audit.id} className="rounded border border-slate-200 px-2 py-1">
														<div className="font-medium text-slate-700">{audit.note}</div>
														<div className="text-[11px] text-slate-500">
															{formatDateTime(audit.createdAt)} | {audit.actorId} | {audit.result}
														</div>
													</div>
												))}
												{!(assignmentAuditMap.get(assignment.id) ?? []).length ? (
													<div className="text-[11px] text-slate-500">No audit events yet.</div>
												) : null}
											</div>
										</td>
										<td className="px-3 py-2">
											<div className="flex flex-wrap gap-2">
												{quickActionsForStatus(assignment.status as AssignmentStatus).map((action) => (
													<form key={action.id} action={updateAssignmentStatusAction}>
														<input type="hidden" name="assignmentId" value={assignment.id} />
														<input type="hidden" name="action" value={action.id} />
														<button
															type="submit"
															className={`rounded-md border px-2 py-1 text-xs font-medium transition ${action.className}`}
														>
															{action.label}
														</button>
													</form>
												))}
											</div>
										</td>
									</tr>
								))
							) : (
								<tr>
									<td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
										No assignments yet. Create templates and assign leaders in Organization Builder.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
			<div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
				<p className="text-xs text-slate-500">
					Page {safePage} of {totalPages}
				</p>
				<div className="flex items-center gap-2">
					{prevHref ? (
						<Link
							href={prevHref}
							className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700"
						>
							Previous
						</Link>
					) : (
						<span className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-400">
							Previous
						</span>
					)}
					{nextHref ? (
						<Link
							href={nextHref}
							className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700"
						>
							Next
						</Link>
					) : (
						<span className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-400">
							Next
						</span>
					)}
				</div>
			</div>
		</div>
	);
}
