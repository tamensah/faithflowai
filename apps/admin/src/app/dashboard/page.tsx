import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { getExecutiveRollups, listOrganizationUnits } from '@/lib/executive-rollups';

function formatCurrency(amount: number): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 0,
	}).format(amount);
}

function trendLabel(trend: 'up' | 'down' | 'flat'): string {
	if (trend === 'up') return 'up vs previous 30d';
	if (trend === 'down') return 'down vs previous 30d';
	return 'flat vs previous 30d';
}

export default async function DashboardPage({
	searchParams,
}: {
	searchParams: Record<string, string | string[] | undefined>;
}) {
	const { userId, orgId } = await auth();
	const orgUnitParam = searchParams.orgUnitId;
	const includeDescendantsParam = searchParams.includeDescendants;
	const orgUnitId =
		typeof orgUnitParam === 'string' && orgUnitParam.trim().length > 0 ? orgUnitParam : null;
	const includeDescendants =
		typeof includeDescendantsParam === 'string' ? includeDescendantsParam === 'true' : true;
	const scopedUnits = orgId ? await listOrganizationUnits(orgId) : [];
	const rollups = orgId
		? await getExecutiveRollups({
				organizationId: orgId,
				orgUnitId,
				includeDescendants,
		  })
		: null;
	const defaultScope = rollups?.scope.selectedOrgUnitId ?? '';
	const includeDescendantsChecked = rollups?.scope.includeDescendants ?? true;
	const scopedQuery = rollups?.scope.selectedOrgUnitId
		? `?orgUnitId=${encodeURIComponent(rollups.scope.selectedOrgUnitId)}&includeDescendants=${rollups.scope.includeDescendants}`
		: '';

	return (
		<div className="space-y-6">
			<div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-950 to-blue-700 p-6 text-white">
				<p className="text-xs uppercase tracking-[0.2em] text-blue-200">Admin workspace</p>
				<h1 className="mt-2 text-3xl font-semibold">Operate with confidence</h1>
				<p className="mt-2 text-sm text-blue-100">
					User: {userId ?? 'unknown'} | Org: {orgId ?? 'not selected'}
				</p>
				<div className="mt-4 flex flex-wrap gap-3">
					<Link
						href="/dashboard/org"
						className="rounded-md border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white"
					>
						Open Organization Builder
					</Link>
					<Link
						href="/dashboard/payments"
						className="rounded-md border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white"
					>
						Run Payments Flow
					</Link>
					<Link
						href="/dashboard/comms"
						className="rounded-md border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white"
					>
						Run Comms Flow
					</Link>
					<Link
						href="/dashboard/settings"
						className="rounded-md border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white"
					>
						Open Settings
					</Link>
					<Link
						href="/dashboard/provider-ops"
						className="rounded-md border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white"
					>
						Open Provider Ops
					</Link>
				</div>
			</div>

			{rollups ? (
				<>
					<div className="rounded-xl border border-slate-200 bg-white p-4">
						<form className="grid gap-3 md:grid-cols-[2fr_1fr_auto] md:items-end">
							<label className="text-sm font-medium text-slate-700">
								Scope org unit
								<select
									name="orgUnitId"
									defaultValue={defaultScope}
									className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
								>
									<option value="">All organization units</option>
									{scopedUnits.map((unit) => (
										<option key={unit.id} value={unit.id}>
											{unit.name} ({unit.type})
										</option>
									))}
								</select>
							</label>
							<label className="text-sm font-medium text-slate-700">
								Descendant scope
								<select
									name="includeDescendants"
									defaultValue={includeDescendantsChecked ? 'true' : 'false'}
									className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
								>
									<option value="true">Include descendants</option>
									<option value="false">Selected unit only</option>
								</select>
							</label>
							<button
								type="submit"
								className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
							>
								Apply scope
							</button>
						</form>
						{rollups.scope.selectedOrgUnitName ? (
							<p className="mt-2 text-xs text-slate-500">
								Current scope: {rollups.scope.selectedOrgUnitName} ({rollups.scope.unitIds.length} units,{' '}
								{rollups.scope.churchIds.length} churches)
							</p>
						) : (
							<p className="mt-2 text-xs text-slate-500">Current scope: full organization</p>
						)}
					</div>

					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
						<div className="rounded-xl border border-slate-200 bg-white p-4">
							<p className="text-xs uppercase tracking-[0.14em] text-slate-500">Members</p>
							<p className="mt-2 text-2xl font-semibold text-slate-900">{rollups.members.total}</p>
							<p className="mt-1 text-sm text-slate-600">
								+{rollups.members.newLast30Days} in last 30 days
							</p>
						</div>
						<div className="rounded-xl border border-slate-200 bg-white p-4">
							<p className="text-xs uppercase tracking-[0.14em] text-slate-500">Giving (30d)</p>
							<p className="mt-2 text-2xl font-semibold text-slate-900">
								{formatCurrency(rollups.giving.last30DaysAmount)}
							</p>
							<p className="mt-1 text-sm text-slate-600">{trendLabel(rollups.giving.trend)}</p>
						</div>
						<div className="rounded-xl border border-slate-200 bg-white p-4">
							<p className="text-xs uppercase tracking-[0.14em] text-slate-500">Upcoming events</p>
							<p className="mt-2 text-2xl font-semibold text-slate-900">{rollups.events.upcoming30Days}</p>
							<p className="mt-1 text-sm text-slate-600">{rollups.events.past30Days} in past 30 days</p>
						</div>
						<div className="rounded-xl border border-slate-200 bg-white p-4">
							<p className="text-xs uppercase tracking-[0.14em] text-slate-500">Leadership</p>
							<p className="mt-2 text-2xl font-semibold text-slate-900">
								{rollups.leadership.leadershipAssignments}
							</p>
							<p className="mt-1 text-sm text-slate-600">
								{rollups.leadership.activeAssignments} active assignments
							</p>
						</div>
						<div className="rounded-xl border border-slate-200 bg-white p-4">
							<p className="text-xs uppercase tracking-[0.14em] text-slate-500">Readiness</p>
							<p className="mt-2 text-2xl font-semibold text-slate-900">{rollups.readiness.percent}%</p>
							<p className="mt-1 text-sm text-slate-600">
								{rollups.readiness.completedChecks}/{rollups.readiness.totalChecks} checks complete
							</p>
						</div>
					</div>

					<div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
						<div className="rounded-xl border border-slate-200 bg-white p-5">
							<div className="flex items-center justify-between">
								<h2 className="text-lg font-semibold text-slate-900">Executive drill-down</h2>
								<span className="text-xs uppercase tracking-[0.14em] text-slate-500">
									3-click operations
								</span>
							</div>
							<div className="mt-4 grid gap-3 sm:grid-cols-2">
								<Link
									href={`/dashboard/members${scopedQuery}`}
									className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700"
								>
									Open member management
								</Link>
								<Link
									href={`/dashboard/events${scopedQuery}`}
									className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700"
								>
									Open events operations
								</Link>
								<Link
									href={`/dashboard/payments${scopedQuery}`}
									className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700"
								>
									Open giving and billing
								</Link>
								<Link
									href={`/dashboard/org${scopedQuery}`}
									className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700"
								>
									Open org hierarchy
								</Link>
							</div>
						</div>
						<div className="rounded-xl border border-slate-200 bg-white p-5">
							<h2 className="text-lg font-semibold text-slate-900">Go-live readiness</h2>
							<p className="mt-1 text-sm text-slate-600">
								Complete these checks to tighten enterprise operations.
							</p>
							<div className="mt-4 space-y-2">
								{rollups.readiness.items.map((item) => (
									<Link
										key={item.id}
										href={`${item.href}${scopedQuery}`}
										className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
									>
										<span className="text-slate-700">{item.label}</span>
										<span
											className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
												item.done
													? 'bg-emerald-100 text-emerald-700'
													: 'bg-amber-100 text-amber-700'
											}`}
										>
											{item.done ? 'Done' : 'Action needed'}
										</span>
									</Link>
								))}
							</div>
						</div>
					</div>
				</>
			) : (
				<div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
					Select an organization from the Clerk switcher to load executive rollups and drill-down dashboards.
				</div>
			)}
		</div>
	);
}
