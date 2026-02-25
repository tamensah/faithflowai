import { AddonsConsole } from '@/components/addons/addons-console';

export default function AddonsPage() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold text-slate-900">Add-ons</h1>
				<p className="mt-2 text-sm text-slate-600">
					Configure module catalog, bind tenant entitlements, and capture billing linkage metadata.
				</p>
			</div>
			<AddonsConsole />
		</div>
	);
}
