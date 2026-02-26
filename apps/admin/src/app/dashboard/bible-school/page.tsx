import { auth } from '@clerk/nextjs/server';
import { BibleSchoolConsole } from '@/components/addons/bible-school-console';
import { ModuleLockPanel } from '@/components/locks/module-lock-panel';
import { getAddonStateForOrganization, isAddonEnabled } from '@/lib/addon-entitlements';

export default async function BibleSchoolPage() {
	const { orgId } = await auth();
	if (!orgId) {
		return (
			<div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
				Select an organization to access bible school operations.
			</div>
		);
	}

	const addonState = await getAddonStateForOrganization(orgId);
	const enabled = isAddonEnabled(addonState, 'BIBLE_SCHOOL_SUITE');

	if (!enabled) {
		return (
			<div className="space-y-4">
				<h1 className="text-2xl font-semibold text-slate-900">Bible school</h1>
				<ModuleLockPanel
					title="Bible school add-on is not enabled"
					reason="Bible school operations require the BIBLE_SCHOOL_SUITE entitlement for this tenant."
					nextSteps={[
						{ label: 'Open Add-ons and enable BIBLE_SCHOOL_SUITE for the tenant.', href: '/dashboard/addons' },
						{
							label: 'Attach billing source/reference so entitlement provenance stays clear.',
							href: '/dashboard/payments',
						},
						{ label: 'Return here to capture class cohort launch actions.' },
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
				<h1 className="text-2xl font-semibold text-slate-900">Bible school</h1>
				<p className="mt-2 text-sm text-slate-600">
					Entitled module: capture cohort setup operations with audit-backed actions.
				</p>
			</div>
			<BibleSchoolConsole />
		</div>
	);
}
