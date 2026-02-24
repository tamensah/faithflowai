import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { getExecutiveRollups } from '@/lib/executive-rollups';

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

export default async function DashboardPage() {
	const { userId, orgId } = await auth();
	const rollups = orgId ? await getExecutiveRollups(orgId) : null;

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
									href="/dashboard/members"
									className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700"
								>
									Open member management
								</Link>
								<Link
									href="/dashboard/events"
									className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700"
								>
									Open events operations
								</Link>
								<Link
									href="/dashboard/payments"
									className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700"
								>
									Open giving and billing
								</Link>
								<Link
									href="/dashboard/org"
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
										href={item.href}
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
