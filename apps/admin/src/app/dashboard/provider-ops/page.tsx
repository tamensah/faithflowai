import { ProviderOpsConsole } from '@/components/provider-ops/provider-ops-console';

export default function ProviderOpsPage() {
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
