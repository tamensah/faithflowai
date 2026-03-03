import { auth } from '@clerk/nextjs/server';
import { FacilitiesConsole } from '@/components/addons/facilities-console';
import { ModuleLockPanel } from '@/components/locks/module-lock-panel';
import { OrgContextLockPanel } from '@/components/locks/org-context-lock-panel';
import { getAddonStateForOrganization, isAddonEnabled } from '@/lib/addon-entitlements';

export default async function FacilitiesPage() {
	const { orgId } = await auth();
	if (!orgId) {
		return (
			<div className="space-y-4">
				<h1 className="text-2xl font-semibold text-slate-900">Facilities</h1>
				<OrgContextLockPanel moduleName="Facilities" />
			</div>
		);
	}

	const addonState = await getAddonStateForOrganization(orgId);
	const enabled = isAddonEnabled(addonState, 'FACILITIES_SUITE');

	if (!enabled) {
		return (
			<div className="space-y-4">
				<h1 className="text-2xl font-semibold text-slate-900">Facilities</h1>
				<ModuleLockPanel
					title="Facilities add-on is not enabled"
					reason="Facilities operations require the FACILITIES_SUITE entitlement for this tenant."
					nextSteps={[
						{ label: 'Open Add-ons and enable FACILITIES_SUITE for the tenant.', href: '/dashboard/addons' },
						{
							label: 'Set billing source/reference so entitlement provenance is tracked.',
							href: '/dashboard/payments',
						},
						{ label: 'Return here to execute reservation operations.' },
					]}
					cta={[
						{ label: 'Open add-ons', href: '/dashboard/addons' },
						{ label: 'Open settings', href: '/dashboard/settings' },
					]}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold text-slate-900">Facilities</h1>
				<p className="mt-2 text-sm text-slate-600">
					Entitled module: capture facilities operations with auditable actions.
				</p>
			</div>
			<FacilitiesConsole />
		</div>
	);
}
