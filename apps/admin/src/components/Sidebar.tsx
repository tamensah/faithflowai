'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
	AcademicCapIcon,
	BuildingOffice2Icon,
	CalendarIcon,
	ChartBarIcon,
	ChatBubbleLeftRightIcon,
	CogIcon,
	CurrencyDollarIcon,
	CubeIcon,
	HomeIcon,
	RectangleStackIcon,
	UserGroupIcon,
	UsersIcon,
	WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

function cn(...classes: Array<string | false>) {
	return classes.filter(Boolean).join(' ');
}

const sections = [
	{
		label: 'Workspace',
		items: [
			{ name: 'Overview', href: '/dashboard', icon: HomeIcon },
			{ name: 'Members', href: '/dashboard/members', icon: UsersIcon },
			{ name: 'Events', href: '/dashboard/events', icon: CalendarIcon },
			{ name: 'Groups', href: '/dashboard/groups', icon: UserGroupIcon, locked: true },
			{ name: 'Payments', href: '/dashboard/payments', icon: CurrencyDollarIcon },
			{ name: 'Comms', href: '/dashboard/comms', icon: ChatBubbleLeftRightIcon },
			{ name: 'Staff', href: '/dashboard/staff', icon: UserGroupIcon },
			{ name: 'Analytics', href: '/dashboard/analytics', icon: ChartBarIcon, locked: true },
			{ name: 'Streaming', href: '/dashboard/streaming', icon: RectangleStackIcon },
			{ name: 'Bible school', href: '/dashboard/bible-school', icon: AcademicCapIcon },
			{ name: 'Facilities', href: '/dashboard/facilities', icon: CubeIcon },
		],
	},
	{
		label: 'Governance',
		items: [
			{ name: 'Organization', href: '/dashboard/org', icon: BuildingOffice2Icon },
			{ name: 'Add-ons', href: '/dashboard/addons', icon: CubeIcon },
			{ name: 'Provider Ops', href: '/dashboard/provider-ops', icon: WrenchScrewdriverIcon },
			{ name: 'Settings', href: '/dashboard/settings', icon: CogIcon },
		],
	},
];

export function Sidebar() {
	const pathname = usePathname();

	return (
		<aside className="hidden w-72 border-r border-slate-200 bg-white lg:flex lg:flex-col">
			<div className="border-b border-slate-200 px-5 py-4">
				<div className="flex items-center gap-3">
					<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white">
						FF
					</div>
					<div>
						<p className="text-sm font-semibold text-slate-900">FaithFlow Admin</p>
						<p className="text-xs text-slate-500">Operations console</p>
					</div>
				</div>
			</div>
			<nav className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
				{sections.map((section) => (
					<div key={section.label}>
						<p className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
							{section.label}
						</p>
						<div className="mt-2 space-y-1">
							{section.items.map((item) => {
								const isActive = pathname === item.href;
								return (
									<Link
										key={item.href}
										href={item.href}
										className={cn(
											'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition',
											isActive
												? 'bg-slate-900 text-white'
												: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
										)}
									>
										<item.icon className="h-5 w-5" />
										<span className="flex-1">{item.name}</span>
										{item.locked ? (
											<span
												className={cn(
													'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
													isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
												)}
											>
												Locked
											</span>
										) : null}
									</Link>
								);
							})}
						</div>
					</div>
				))}
			</nav>
		</aside>
	);
}
