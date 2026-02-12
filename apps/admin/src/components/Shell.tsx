'use client';

import Link from 'next/link';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { BillingStatusBanner } from './BillingStatusBanner';
import { trpc } from '../lib/trpc';

const nav = [
  { href: '/', label: 'Overview' },
  { href: '/ai', label: 'AI' },
  { href: '/members', label: 'Members' },
  { href: '/events', label: 'Events' },
  { href: '/giving', label: 'Giving' },
  { href: '/billing', label: 'Billing' },
  { href: '/finance', label: 'Finance' },
  { href: '/operations', label: 'Ops' },
  { href: '/facilities', label: 'Facilities' },
  { href: '/streaming', label: 'Streaming' },
  { href: '/support', label: 'Support' },
  { href: '/care', label: 'Care' },
  { href: '/content', label: 'Content' },
  { href: '/communications', label: 'Comms' },
  { href: '/access-requests', label: 'Access' },
  { href: '/staff', label: 'Staff' },
  { href: '/platform', label: 'Platform' },
  { href: '/platform/ops', label: 'Platform Ops' },
  { href: '/platform/subscriptions', label: 'Subscriptions' },
  { href: '/platform/tenants', label: 'Tenants' },
  { href: '/live', label: 'Live' },
];

const navEntitlementMap: Record<string, string> = {
  '/ai': 'ai_insights',
  '/members': 'membership_enabled',
  '/events': 'events_enabled',
  '/giving': 'finance_enabled',
  '/finance': 'finance_enabled',
  '/facilities': 'facility_management_enabled',
  '/streaming': 'streaming_enabled',
  '/support': 'support_center_enabled',
  '/care': 'pastoral_care_enabled',
  '/content': 'content_library_enabled',
};

export function Shell({ children }: { children: React.ReactNode }) {
  const { data: entitlementsStatus } = trpc.billing.entitlements.useQuery(undefined, {
    retry: false,
  });
  const entitlements = entitlementsStatus?.entitlements?.entitlements ?? null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <span className="text-lg font-semibold">FaithFlow AI</span>
            <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/" afterCreateOrganizationUrl="/" />
            <nav className="flex gap-4 text-sm text-muted">
              {nav.map((item) => {
                const required = navEntitlementMap[item.href];
                const isLocked = Boolean(required && entitlements?.[required] && !entitlements[required]?.enabled);
                const href = isLocked ? `/billing?upgrade=1&feature=${encodeURIComponent(required)}` : item.href;
                const className = isLocked ? 'opacity-60 hover:text-foreground' : 'hover:text-foreground';
                const label = isLocked ? `${item.label} (Locked)` : item.label;
                return (
                  <Link key={item.href} href={href} className={className} aria-disabled={isLocked}>
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <UserButton />
        </div>
      </header>
      <BillingStatusBanner />
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
