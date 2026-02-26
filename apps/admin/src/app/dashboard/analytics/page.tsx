import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { ModuleLockPanel } from '@/components/locks/module-lock-panel';
import { getAiInsights } from '@/lib/ai-insights';
import { getModuleGate } from '@/lib/module-gates';

function levelClass(level: 'LOW' | 'MEDIUM' | 'HIGH'): string {
	if (level === 'HIGH') return 'bg-rose-100 text-rose-700';
	if (level === 'MEDIUM') return 'bg-amber-100 text-amber-700';
	return 'bg-emerald-100 text-emerald-700';
}

export default async function AnalyticsPage() {
	const { orgId } = await auth();
	const gate = getModuleGate('analytics');

	if (gate.locked) {
		return (
			<div className="space-y-4">
				<h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
				<ModuleLockPanel
					title="Analytics rollout is currently gated"
					reason={gate.reason}
					nextSteps={[
						{ label: gate.nextSteps[0] ?? 'Set up organization hierarchy and role assignments.', href: '/dashboard/org' },
						{
							label: gate.nextSteps[1] ?? 'Complete provider and reconciliation checks in Provider Ops.',
							href: '/dashboard/provider-ops',
						},
						{ label: gate.nextSteps[2] ?? 'Enable analytics module for this environment when rollout is approved.', href: '/dashboard/settings' },
					]}
					cta={[
						{ label: 'Open organization builder', href: '/dashboard/org' },
						{ label: 'Open provider ops', href: '/dashboard/provider-ops' },
						{ label: 'Open settings', href: '/dashboard/settings' },
					]}
				/>
			</div>
		);
	}

	const insights = orgId ? await getAiInsights(orgId) : [];

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
			<p className="text-sm text-gray-600">
				Explainable intelligence signals for attendance, giving, and care routing.
			</p>
			{insights.length ? (
				<div className="grid gap-4 xl:grid-cols-3">
					{insights.map((insight) => (
						<div key={insight.key} className="rounded-xl border border-slate-200 bg-white p-4">
							<div className="flex items-center justify-between">
								<h2 className="text-base font-semibold text-slate-900">{insight.title}</h2>
								<span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${levelClass(insight.level)}`}>
									{insight.level}
								</span>
							</div>
							<p className="mt-2 text-sm text-slate-700">{insight.summary}</p>
							<p className="mt-2 text-xs text-slate-500">{insight.explanation}</p>
							<div className="mt-3 grid gap-2">
								{insight.metrics.map((metric) => (
									<div
										key={metric.label}
										className="flex items-center justify-between rounded-md border border-slate-200 px-2 py-1 text-xs"
									>
										<span className="text-slate-500">{metric.label}</span>
										<span className="font-medium text-slate-800">{metric.value}</span>
									</div>
								))}
							</div>
							<p className="mt-3 text-xs font-medium text-slate-700">
								Recommended: {insight.recommendedAction}
							</p>
						</div>
					))}
				</div>
			) : (
				<div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
					No analytics signals available yet. Add events and completed payments to generate insights.
				</div>
			)}
			<div className="flex flex-wrap gap-2">
				<Link href="/dashboard/events" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700">
					Open events
				</Link>
				<Link href="/dashboard/payments" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700">
					Open payments
				</Link>
				<Link href="/dashboard/org" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700">
					Open organization builder
				</Link>
			</div>
		</div>
	);
}
