import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { ModuleLockPanel } from '@/components/locks/module-lock-panel';
import { OrgContextLockPanel } from '@/components/locks/org-context-lock-panel';
import { getModuleGate } from '@/lib/module-gates';

export default async function GroupsPage() {
	const gate = getModuleGate('groups');

	if (gate.locked) {
		return (
			<div className="space-y-4">
				<h1 className="text-2xl font-semibold text-gray-900">Small Groups</h1>
				<ModuleLockPanel
					title="Groups rollout is currently gated"
					reason={gate.reason}
					nextSteps={[
						{ label: gate.nextSteps[0] ?? 'Configure org units and leadership role templates.', href: '/dashboard/org' },
						{
							label: gate.nextSteps[1] ?? 'Validate member and event drill-down flows for your active unit scope.',
							href: '/dashboard/members',
						},
						{ label: gate.nextSteps[2] ?? 'Enable groups module for this environment when rollout is approved.', href: '/dashboard/settings' },
					]}
					cta={[
						{ label: 'Open organization builder', href: '/dashboard/org' },
						{ label: 'Open members', href: '/dashboard/members' },
						{ label: 'Open events', href: '/dashboard/events' },
					]}
				/>
			</div>
		);
	}

	const { orgId } = await auth();
	if (!orgId) {
		return (
			<div className="space-y-4">
				<h1 className="text-2xl font-semibold text-gray-900">Small Groups</h1>
				<OrgContextLockPanel moduleName="Small groups" />
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
