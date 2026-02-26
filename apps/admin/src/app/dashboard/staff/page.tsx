import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@faithflow/database';
import { updateAssignmentStatusAction } from './actions';

type AssignmentStatus = 'PLANNED' | 'ACTIVE' | 'SUSPENDED' | 'ENDED';
type QuickAction = {
	id: 'activate' | 'suspend' | 'end';
	label: string;
	className: string;
};

function formatDateTime(value: Date | null): string {
	if (!value) return '—';
	return new Date(value).toLocaleString();
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

export default async function StaffPage() {
	const { orgId } = await auth();
	if (!orgId) {
		return (
			<div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
				Select an organization from the Clerk switcher to manage staff assignments.
			</div>
		);
	}

	const [statusRows, assignments] = await Promise.all([
		prisma.unitRoleAssignment.groupBy({
			by: ['status'],
			where: { organizationId: orgId },
			_count: { _all: true },
		}),
		prisma.unitRoleAssignment.findMany({
			where: {
				organizationId: orgId,
				status: { in: ['PLANNED', 'ACTIVE', 'SUSPENDED'] },
			},
			orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
			take: 40,
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
		}),
	]);

	const statusTotals: Record<AssignmentStatus, number> = {
		PLANNED: 0,
		ACTIVE: 0,
		SUSPENDED: 0,
		ENDED: 0,
	};
	for (const row of statusRows) {
		statusTotals[row.status as AssignmentStatus] = row._count._all;
	}

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
					<h2 className="text-base font-semibold text-slate-900">Current assignment queue</h2>
					<span className="text-xs uppercase tracking-[0.14em] text-slate-500">
						{assignments.length} items
					</span>
				</div>
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
		</div>
	);
}
