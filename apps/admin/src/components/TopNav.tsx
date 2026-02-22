'use client';

import { usePathname } from 'next/navigation';
import { BellIcon } from '@heroicons/react/24/outline';
import { OrganizationSwitcher, SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';

function toTitle(pathname: string): string {
	if (pathname === '/dashboard') return 'Overview';
	if (pathname.startsWith('/dashboard/org')) return 'Organization';
	if (pathname.startsWith('/dashboard/members')) return 'Members';
	if (pathname.startsWith('/dashboard/events')) return 'Events';
	if (pathname.startsWith('/dashboard/groups')) return 'Groups';
	if (pathname.startsWith('/dashboard/payments')) return 'Payments';
	if (pathname.startsWith('/dashboard/comms')) return 'Comms';
	if (pathname.startsWith('/dashboard/settings')) return 'Settings';
	return 'Dashboard';
}

export function TopNav() {
	const pathname = usePathname();
	const title = toTitle(pathname);

	return (
		<div className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
			<div>
				<p className="text-xs uppercase tracking-[0.18em] text-slate-500">Current view</p>
				<h1 className="text-base font-semibold text-slate-900">{title}</h1>
			</div>

			<div className="flex items-center gap-3">
				<button
					type="button"
					className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
				>
					<span className="sr-only">Alerts</span>
					<BellIcon className="h-5 w-5" />
				</button>

				<SignedIn>
					<OrganizationSwitcher
						hidePersonal
						appearance={{
							elements: {
								rootBox: 'h-9',
								organizationSwitcherTrigger:
									'h-9 rounded-full border border-slate-200 bg-white px-3 text-sm',
							},
						}}
					/>
					<UserButton afterSignOutUrl="/" />
				</SignedIn>

				<SignedOut>
					<SignInButton mode="modal">
						<button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900">
							Sign in
						</button>
					</SignInButton>
				</SignedOut>
			</div>
		</div>
	);
}
