import { auth } from '@clerk/nextjs/server';
import { OrgContextLockPanel } from '@/components/locks/org-context-lock-panel';
import { ProviderOpsConsole } from '@/components/provider-ops/provider-ops-console';

export default async function ProviderOpsPage() {
	const { orgId } = await auth();
	if (!orgId) {
		return (
			<div className="space-y-4">
				<h1 className="text-2xl font-semibold text-slate-900">Provider Ops</h1>
				<OrgContextLockPanel moduleName="Provider Ops" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold text-slate-900">Provider Ops</h1>
				<p className="mt-2 text-sm text-slate-600">
					Monitor webhook health, delivery outcomes, and replay failed provider operations.
				</p>
			</div>
			<ProviderOpsConsole />
		</div>
	);
}
