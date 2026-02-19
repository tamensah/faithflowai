'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { Badge } from '@faithflow-ai/ui';
import { BillingStatusBanner } from './BillingStatusBanner';
import { trpc } from '../lib/trpc';

type NavItem = {
  href: string;
  label: string;
  featureKey?: string;
  platformOnly?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { href: '/', label: 'Overview' },
      { href: '/members', label: 'Members', featureKey: 'membership_enabled' },
      { href: '/events', label: 'Events', featureKey: 'events_enabled' },
      { href: '/giving', label: 'Giving', featureKey: 'finance_enabled' },
      { href: '/billing', label: 'Billing' },
      { href: '/finance', label: 'Finance', featureKey: 'finance_enabled' },
      { href: '/communications', label: 'Comms', featureKey: 'communications_enabled' },
      { href: '/staff', label: 'Staff' },
      { href: '/access-requests', label: 'Access' },
    ],
  },
  {
    label: 'Ministry',
    items: [
      { href: '/operations', label: 'Ops' },
      { href: '/support', label: 'Support', featureKey: 'support_center_enabled' },
      { href: '/care', label: 'Care', featureKey: 'pastoral_care_enabled' },
      { href: '/facilities', label: 'Facilities', featureKey: 'facility_management_enabled' },
      { href: '/streaming', label: 'Streaming', featureKey: 'streaming_enabled' },
      { href: '/content', label: 'Content', featureKey: 'content_library_enabled' },
      { href: '/live', label: 'Live' },
    ],
  },
  {
    label: 'Intelligence',
    items: [{ href: '/ai', label: 'AI', featureKey: 'ai_insights' }],
  },
  {
    label: 'Platform',
    items: [
      { href: '/platform', label: 'Platform users', platformOnly: true },
      { href: '/platform/subscriptions', label: 'Subscriptions', platformOnly: true },
      { href: '/platform/tenants', label: 'Tenants', platformOnly: true },
      { href: '/platform/ops', label: 'Platform ops', platformOnly: true },
    ],
  },
];

function isRouteActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Workspace: true,
    Ministry: false,
    Intelligence: false,
    Platform: false,
  });
  const { data: entitlementsStatus } = trpc.billing.entitlements.useQuery(undefined, {
    retry: false,
  });
  const { data: platformSelf } = trpc.platform.self.useQuery(undefined, {
    retry: false,
  });

  const entitlements = entitlementsStatus?.entitlements?.entitlements ?? null;
  const isBillingReadOnly = entitlementsStatus?.entitlements?.source === 'inactive_subscription';
  const hasPlatformAccess = Boolean(platformSelf?.platformUser);

  const activeLabel = useMemo(() => {
    for (const group of navGroups) {
      for (const item of group.items) {
        if (isRouteActive(pathname, item.href)) return item.label;
      }
    }
    return 'Overview';
  }, [pathname]);

  const groups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !item.platformOnly || hasPlatformAccess),
        }))
        .filter((group) => group.items.length > 0),
    [hasPlatformAccess]
  );

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    setOpenGroups((current) => {
      const next = { ...current };
      let changed = false;
      groups.forEach((group) => {
        if (next[group.label] === undefined) {
          next[group.label] = group.label === 'Workspace';
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [groups]);

  useEffect(() => {
    const activeGroup = groups.find((group) =>
      group.items.some((item) => isRouteActive(pathname, item.href))
    );
    if (!activeGroup) return;
    setOpenGroups((current) =>
      current[activeGroup.label] ? current : { ...current, [activeGroup.label]: true }
    );
  }, [groups, pathname]);

  const renderNav = (mobile = false) => (
    <nav className="space-y-6">
      {groups.map((group) => (
        <div key={group.label} className="space-y-1.5">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted hover:bg-slate-200/50"
            aria-expanded={openGroups[group.label] ?? group.label === 'Workspace'}
            onClick={() =>
              setOpenGroups((current) => ({
                ...current,
                [group.label]: !(current[group.label] ?? group.label === 'Workspace'),
              }))
            }
          >
            <span>{group.label}</span>
            <svg
              viewBox="0 0 20 20"
              className={`h-3.5 w-3.5 transition ${
                openGroups[group.label] ?? group.label === 'Workspace' ? 'rotate-90' : ''
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path d="M7 5l6 5-6 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {(openGroups[group.label] ?? group.label === 'Workspace')
            ? group.items.map((item) => {
            const isLocked = Boolean(
              !isBillingReadOnly && item.featureKey && entitlements?.[item.featureKey] && !entitlements[item.featureKey]?.enabled
            );
            const href = isLocked
              ? `/billing?upgrade=1&feature=${encodeURIComponent(item.featureKey!)}`
              : item.href;
            const active = isRouteActive(pathname, item.href) && !isLocked;

            return (
              <Link
                key={item.href}
                href={href}
                aria-disabled={isLocked}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground hover:bg-slate-200/70'
                } ${isLocked ? 'opacity-70' : ''}`}
                onClick={() => {
                  if (mobile) setMobileOpen(false);
                }}
              >
                <span>{item.label}</span>
                {isLocked ? (
                  <span className={`text-[11px] font-medium ${active ? 'text-primary-foreground/90' : 'text-muted'}`}>
                    Locked
                  </span>
                ) : null}
              </Link>
            );
          })
            : null}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eaf3ff_0%,_#f6f7fb_40%,_#f7f7f4_100%)]">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-white/80 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-white text-foreground lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
            </svg>
          </button>

          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-display text-sm font-semibold text-primary-foreground">
              FF
            </span>
            <div className="leading-tight">
              <p className="font-display text-base font-semibold text-foreground">FaithFlow Admin</p>
              <p className="text-[11px] text-muted">Trustworthy, modern operations</p>
            </div>
          </Link>

          <div className="hidden flex-1 items-center gap-2 px-4 xl:flex">
            <Badge className="border-primary/20 bg-primary/5 text-primary">Current view</Badge>
            <span className="text-sm font-medium text-foreground">{activeLabel}</span>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {isBillingReadOnly ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                Read-only
              </span>
            ) : null}
            <div className="hidden sm:block">
              <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/" afterCreateOrganizationUrl="/" />
            </div>
            <UserButton />
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-900/35"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[86%] max-w-[340px] border-r border-border bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <p className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-muted">Navigation</p>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-white text-foreground"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="mb-5">
              <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/" afterCreateOrganizationUrl="/" />
            </div>
            {renderNav(true)}
          </aside>
        </div>
      ) : null}

      <div className="lg:grid lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="hidden border-r border-border/70 bg-white/70 lg:block">
          <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto px-4 py-5">{renderNav()}</div>
        </aside>

        <section className="min-w-0">
          <BillingStatusBanner />
          <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
        </section>
      </div>
    </div>
  );
}
