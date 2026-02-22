import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';

export default async function DashboardPage() {
	const { userId, orgId } = await auth();

	return (
		<div className="space-y-6">
			<div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-950 to-blue-700 p-6 text-white">
				<p className="text-xs uppercase tracking-[0.2em] text-blue-200">Admin workspace</p>
				<h1 className="mt-2 text-3xl font-semibold">Operate with confidence</h1>
				<p className="mt-2 text-sm text-blue-100">
					User: {userId ?? 'unknown'} | Org: {orgId ?? 'not selected'}
				</p>
				<div className="mt-4 flex flex-wrap gap-3">
					<Link
						href="/dashboard/org"
						className="rounded-md border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white"
					>
						Open Organization Builder
					</Link>
					<Link
						href="/dashboard/payments"
						className="rounded-md border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white"
					>
						Run Payments Flow
					</Link>
					<Link
						href="/dashboard/comms"
						className="rounded-md border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white"
					>
						Run Comms Flow
					</Link>
					<Link
						href="/dashboard/settings"
						className="rounded-md border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white"
					>
						Open Settings
					</Link>
				</div>
			</div>
		</div>
	);
}
