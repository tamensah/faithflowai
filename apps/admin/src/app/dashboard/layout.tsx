import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { TopNav } from '@/components/TopNav';
import { AdminSecurityPolicyError } from '@/lib/admin-security-policy';
import { getActorFromClerk } from '@/lib/server-actor';

type AccessBlock = {
	title: string;
	description: string;
	actions: string[];
};

function buildGuardrailBlock(error: AdminSecurityPolicyError): AccessBlock {
	switch (error.code) {
		case 'EMAIL_NOT_VERIFIED':
			return {
				title: 'Access blocked: email verification required',
				description: 'Your admin session is blocked by policy because your email is not verified.',
				actions: [
					'Open your Clerk profile and verify your primary email address.',
					'Sign out and sign in again to refresh your session claims.',
				],
			};
		case 'MFA_REQUIRED':
			return {
				title: 'Access blocked: MFA required',
				description: 'Your role requires MFA before privileged dashboard actions are allowed.',
				actions: [
					'Enable MFA in your Clerk account settings.',
					'Sign out and sign in again so the new MFA state is applied to this session.',
				],
			};
		case 'SESSION_AGE_EXCEEDED':
			return {
				title: 'Access blocked: session expired',
				description: 'Your session age exceeded this organization security policy.',
				actions: ['Sign out and sign in again to create a fresh privileged session.'],
			};
		case 'EMAIL_DOMAIN_NOT_ALLOWED':
			return {
				title: 'Access blocked: email domain restricted',
				description:
					'Your email domain is not in the organization allowlist for privileged access.',
				actions: [
					'Sign in with an approved organization email domain.',
					'Ask an organization admin to update allowed admin domains in Settings.',
				],
			};
		default:
			return {
				title: 'Access blocked by security policy',
				description: error.message,
				actions: ['Review organization security policy and retry sign in.'],
			};
	}
}

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
	let accessBlock: AccessBlock | null = null;

	if (databaseConfigured) {
		try {
			await getActorFromClerk();
		} catch (error) {
			if (error instanceof AdminSecurityPolicyError) {
				accessBlock = buildGuardrailBlock(error);
			} else if (error instanceof Error) {
				accessBlock = {
					title: 'Access restricted',
					description: error.message,
					actions: ['Check organization context and assigned admin/staff role claims, then retry.'],
				};
			} else {
				throw error;
			}
		}
	}

	return (
		<div className="flex h-[calc(100vh-56px)] bg-gray-50">
			<Sidebar />
			<div className="flex flex-1 flex-col overflow-hidden">
				<TopNav />
				<main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
					<div className="mx-auto w-full max-w-[1400px] px-6 py-8">
						{databaseConfigured ? (
							accessBlock ? (
								<div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
									<p className="text-xs uppercase tracking-[0.16em] text-rose-700">Security policy</p>
									<h2 className="mt-2 text-2xl font-semibold text-rose-900">{accessBlock.title}</h2>
									<p className="mt-2 text-sm text-rose-900">{accessBlock.description}</p>
									<ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-rose-800">
										{accessBlock.actions.map((action) => (
											<li key={action}>{action}</li>
										))}
									</ul>
								</div>
							) : (
								children
							)
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
