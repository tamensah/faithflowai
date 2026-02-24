import Link from 'next/link';
import { ModuleLockPanel } from '@/components/locks/module-lock-panel';
import { getModuleGate } from '@/lib/module-gates';

export default function AnalyticsPage() {
	const gate = getModuleGate('analytics');

	if (gate.locked) {
		return (
			<div className="space-y-4">
				<h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
				<ModuleLockPanel
					title="Analytics rollout is currently gated"
					reason={gate.reason}
					nextSteps={gate.nextSteps}
					cta={[
						{ label: 'Open organization builder', href: '/dashboard/org' },
						{ label: 'Open provider ops', href: '/dashboard/provider-ops' },
						{ label: 'Open settings', href: '/dashboard/settings' },
					]}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
			<p className="text-sm text-gray-600">
				Cross-unit analytics are planned after org hierarchy and scoped roles are fully
				adopted.
			</p>
			<Link
				href="/dashboard/org"
				className="inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
			>
				Open Organization Builder
			</Link>
		</div>
	);
}
