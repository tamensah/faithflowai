import { CommsConsole } from '@/components/comms/comms-console';

export default function CommsPage() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold text-slate-900">Comms</h1>
				<p className="mt-2 text-sm text-slate-600">
					Run room messaging and outbound dispatch flows directly from the dashboard.
				</p>
			</div>

			<CommsConsole />
		</div>
	);
}
