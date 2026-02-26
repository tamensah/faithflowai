import { auth } from '@clerk/nextjs/server';
import { ModuleLockPanel } from '@/components/locks/module-lock-panel';
import { StreamingConsole } from '@/components/addons/streaming-console';
import { getAddonStateForOrganization, isAddonEnabled } from '@/lib/addon-entitlements';

export default async function StreamingPage() {
	const { orgId } = await auth();
	if (!orgId) {
		return (
			<div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
				Select an organization to access streaming operations.
			</div>
		);
	}

	const addonState = await getAddonStateForOrganization(orgId);
	const enabled = isAddonEnabled(addonState, 'STREAMING_SUITE');

	if (!enabled) {
		return (
			<div className="space-y-4">
				<h1 className="text-2xl font-semibold text-slate-900">Streaming</h1>
				<ModuleLockPanel
					title="Streaming add-on is not enabled"
					reason="Streaming operations require the STREAMING_SUITE entitlement for this tenant."
					nextSteps={[
						{ label: 'Open Add-ons and enable STREAMING_SUITE for the tenant.', href: '/dashboard/addons' },
						{ label: 'Attach billing source/reference (manual or billing).', href: '/dashboard/payments' },
						{ label: 'Return to this page and run readiness checklist actions.' },
					]}
					cta={[
						{ label: 'Open add-ons', href: '/dashboard/addons' },
						{ label: 'Open provider ops', href: '/dashboard/provider-ops' },
					]}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold text-slate-900">Streaming</h1>
				<p className="mt-2 text-sm text-slate-600">
					Entitled module: run streaming readiness actions with audit trails.
				</p>
			</div>
			<StreamingConsole />
		</div>
	);
}
