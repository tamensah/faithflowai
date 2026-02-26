import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { TopNav } from '@/components/TopNav';

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { userId } = await auth();
	if (!userId) {
		redirect('/sign-in');
	}
	const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());

	return (
		<div className="flex h-[calc(100vh-56px)] bg-gray-50">
			<Sidebar />
			<div className="flex flex-1 flex-col overflow-hidden">
				<TopNav />
				<main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
					<div className="mx-auto w-full max-w-[1400px] px-6 py-8">
						{databaseConfigured ? (
							children
						) : (
							<div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
								<p className="text-xs uppercase tracking-[0.16em] text-amber-700">Configuration required</p>
								<h2 className="mt-2 text-2xl font-semibold text-amber-900">Database not configured for this environment</h2>
								<p className="mt-2 text-sm text-amber-900">
									This dashboard needs <code>DATABASE_URL</code> in Vercel Preview/Production to load organization data.
								</p>
								<p className="mt-2 text-sm text-amber-800">
									Set <code>DATABASE_URL</code> (and your provider keys) in project environment variables, then redeploy.
								</p>
							</div>
						)}
					</div>
				</main>
			</div>
		</div>
	);
}
