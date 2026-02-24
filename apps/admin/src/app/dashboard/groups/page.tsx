import Link from 'next/link';
import { ModuleLockPanel } from '@/components/locks/module-lock-panel';
import { getModuleGate } from '@/lib/module-gates';

export default function GroupsPage() {
	const gate = getModuleGate('groups');

	if (gate.locked) {
		return (
			<div className="space-y-4">
				<h1 className="text-2xl font-semibold text-gray-900">Small Groups</h1>
				<ModuleLockPanel
					title="Groups rollout is currently gated"
					reason={gate.reason}
					nextSteps={gate.nextSteps}
					cta={[
						{ label: 'Open organization builder', href: '/dashboard/org' },
						{ label: 'Open members', href: '/dashboard/members' },
						{ label: 'Open events', href: '/dashboard/events' },
					]}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold text-gray-900">Small Groups</h1>
			<p className="text-sm text-gray-600">
				Group operations are being upgraded to use scoped roles and unit-level policies.
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
