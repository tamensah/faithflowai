import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import {
	type ExecutiveTrendPoint,
	getExecutiveRollups,
	listOrganizationUnits,
} from '@/lib/executive-rollups';
import { OrgContextLockPanel } from '@/components/locks/org-context-lock-panel';

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

function formatTrendValue(value: number, format: 'count' | 'currency'): string {
	if (format === 'currency') {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits: 0,
		}).format(value);
	}
	return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function getWeekOverWeek(points: ExecutiveTrendPoint[]): {
	label: string;
	state: 'up' | 'down' | 'flat';
} {
	if (points.length < 2) return { label: 'No trend yet', state: 'flat' };
	const last = points[points.length - 1]?.value ?? 0;
	const previous = points[points.length - 2]?.value ?? 0;
	if (last > previous) return { label: 'Up week-over-week', state: 'up' };
	if (last < previous) return { label: 'Down week-over-week', state: 'down' };
	return { label: 'Flat week-over-week', state: 'flat' };
}

function TrendSurface({
	title,
	points,
	format,
}: {
	title: string;
	points: ExecutiveTrendPoint[];
	format: 'count' | 'currency';
}) {
	const maxValue = Math.max(1, ...points.map((point) => point.value));
	const total = points.reduce((sum, point) => sum + point.value, 0);
	const latest = points[points.length - 1]?.value ?? 0;
	const weekOverWeek = getWeekOverWeek(points);

	return (
		<div className="rounded-xl border border-slate-200 bg-white p-5">
			<div className="flex items-start justify-between gap-4">
				<div>
					<p className="text-xs uppercase tracking-[0.14em] text-slate-500">{title}</p>
					<p className="mt-2 text-2xl font-semibold text-slate-900">{formatTrendValue(latest, format)}</p>
					<p
						className={`mt-1 text-xs ${
							weekOverWeek.state === 'up'
								? 'text-emerald-600'
								: weekOverWeek.state === 'down'
									? 'text-rose-600'
									: 'text-slate-500'
						}`}
					>
						{weekOverWeek.label}
					</p>
				</div>
				<p className="text-xs text-slate-500">12-week total: {formatTrendValue(total, format)}</p>
			</div>
			<div className="mt-4 flex h-28 items-end gap-1">
				{points.map((point) => {
					const ratio = point.value / maxValue;
					const height = Math.max(6, Math.round(ratio * 100));
					return (
						<div key={point.weekStart} className="group relative flex flex-1 justify-center">
							<span className="sr-only">
								{point.label}: {formatTrendValue(point.value, format)}
							</span>
							<div
								className="w-full rounded-t-sm bg-blue-200 transition-colors group-hover:bg-blue-500"
								style={{ height: `${height}%` }}
								title={`${point.label}: ${formatTrendValue(point.value, format)}`}
							/>
						</div>
					);
				})}
			</div>
			<div className="mt-2 flex justify-between text-[11px] uppercase tracking-[0.12em] text-slate-400">
				<span>{points[0]?.label ?? '—'}</span>
				<span>{points[points.length - 1]?.label ?? '—'}</span>
			</div>
		</div>
	);
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
						href="/dashboard/staff"
						className="rounded-md border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white"
					>
						Open Staff Console
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
					<Link
						href="/dashboard/ops-health"
						className="rounded-md border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white"
					>
						Open Ops Health
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

					<div className="grid gap-4 xl:grid-cols-4">
						<TrendSurface title="Member growth" points={rollups.trends.members} format="count" />
						<TrendSurface title="Giving momentum" points={rollups.trends.giving} format="currency" />
						<TrendSurface title="Attendance momentum" points={rollups.trends.attendance} format="count" />
						<TrendSurface title="Leadership bench" points={rollups.trends.leadership} format="count" />
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
								<Link
									href={`/dashboard/staff${scopedQuery}`}
									className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700"
								>
									Open staff assignments
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
				<div className="space-y-4">
					<OrgContextLockPanel moduleName="Overview" />
				</div>
			)}
		</div>
	);
}
