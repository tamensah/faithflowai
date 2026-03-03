import { auth } from '@clerk/nextjs/server';
import { OrgContextLockPanel } from '@/components/locks/org-context-lock-panel';
import { OrgConsole } from '@/components/org/org-console';

export default async function OrgOperationsPage() {
	const { orgId } = await auth();
	if (!orgId) {
		return (
			<div className="space-y-4">
				<h1 className="text-2xl font-semibold text-gray-900">Organization Builder</h1>
				<OrgContextLockPanel moduleName="Organization builder" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold text-gray-900">Organization Builder</h1>
				<p className="mt-2 text-sm text-gray-600">
					Manage org units, scoped role assignments, and immutable audit trails.
				</p>
			</div>
			<OrgConsole />
		</div>
	);
}
