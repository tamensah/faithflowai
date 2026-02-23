import Link from 'next/link';
import { SecurityPolicyCard } from '@/components/org/security-policy-card';

export default function SettingsPage() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
				<p className="mt-2 text-sm text-gray-600">
					System settings are moving to scoped organization controls.
				</p>
			</div>

			<div className="rounded-lg border border-gray-200 bg-white p-5">
				<h2 className="text-base font-semibold text-gray-900">
					Organization configuration
				</h2>
				<p className="mt-2 text-sm text-gray-600">
					Use the Organization Builder for org units, role templates, assignments, and
					audit traces.
				</p>
				<Link
					href="/dashboard/org"
					className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
				>
					Open Organization Builder
				</Link>
			</div>

			<SecurityPolicyCard />
		</div>
	);
}
