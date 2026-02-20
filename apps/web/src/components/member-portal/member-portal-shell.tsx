'use client';

import { useClerk } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BanknotesIcon,
  BellIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  HeartIcon,
  HomeIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import {
  type ComponentType,
  type ReactNode,
  type SVGProps,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

type NavItem = {
  label: string;
  href: string;
  icon: Icon;
  description: string;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

export type PortalSectionLink = {
  id: string;
  label: string;
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      {
        label: 'Overview',
        href: '/portal',
        icon: HomeIcon,
        description: 'Snapshot and quick actions',
      },
      {
        label: 'Profile',
        href: '/portal/profile',
        icon: UserCircleIcon,
        description: 'Personal details and privacy',
      },
    ],
  },
  {
    id: 'ministry',
    label: 'Ministry',
    items: [
      {
        label: 'Events',
        href: '/portal/events',
        icon: CalendarDaysIcon,
        description: 'RSVP and attendance',
      },
      {
        label: 'Giving',
        href: '/portal/giving',
        icon: BanknotesIcon,
        description: 'Gifts and receipts',
      },
      {
        label: 'Volunteer',
        href: '/portal/volunteer',
        icon: UserGroupIcon,
        description: 'Availability and shifts',
      },
    ],
  },
  {
    id: 'care',
    label: 'Care',
    items: [
      {
        label: 'Messages',
        href: '/portal/messages',
        icon: ChatBubbleLeftRightIcon,
        description: 'Staff communication',
      },
      {
        label: 'Prayer',
        href: '/portal/prayer',
        icon: HeartIcon,
        description: 'Requests and follow-up',
      },
    ],
  },
];

const DEFAULT_GROUP_ID = 'workspace';

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ');
}

function isRouteActive(pathname: string, href: string) {
  if (href === '/portal') return pathname === '/portal';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function findActiveGroup(pathname: string) {
  return (
    NAV_GROUPS.find((group) => group.items.some((item) => isRouteActive(pathname, item.href)))?.id ??
    DEFAULT_GROUP_ID
  );
}

type MemberPortalShellProps = {
  title: string;
  description: string;
  sectionLinks: PortalSectionLink[];
  actions?: ReactNode;
  children: ReactNode;
};

export function MemberPortalShell({
  title,
  description,
  sectionLinks,
  actions,
  children,
}: MemberPortalShellProps) {
  const { signOut } = useClerk();
  const pathname = usePathname();
  const activeGroup = useMemo(() => findActiveGroup(pathname), [pathname]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_GROUPS.map((group) => [group.id, group.id === activeGroup]))
  );
  const [activeSection, setActiveSection] = useState(sectionLinks[0]?.id ?? '');
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [readAlertIds, setReadAlertIds] = useState<string[]>([]);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const alertsPanelRef = useRef<HTMLDivElement | null>(null);
  const profilePanelRef = useRef<HTMLDivElement | null>(null);

  const alertItems = [
    {
      id: 'profile',
      title: 'Complete your profile',
      detail: 'Required fields are missing for full directory access.',
      href: '/portal/profile',
    },
    {
      id: 'events',
      title: 'No RSVPs yet',
      detail: 'Join your next event to stay updated with ministry schedules.',
      href: '/portal/events',
    },
    {
      id: 'giving',
      title: 'Set your giving plan',
      detail: 'Add recurring giving to simplify monthly support.',
      href: '/portal/giving',
    },
  ];
  const unreadCount = alertItems.filter((alert) => !readAlertIds.includes(alert.id)).length;

  useEffect(() => {
    setOpenGroups(Object.fromEntries(NAV_GROUPS.map((group) => [group.id, group.id === activeGroup])));
  }, [activeGroup]);

  useEffect(() => {
    setActiveSection(sectionLinks[0]?.id ?? '');
  }, [pathname, sectionLinks]);

  useEffect(() => {
    if (sectionLinks.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (top?.target?.id) {
          setActiveSection(top.target.id);
        }
      },
      { rootMargin: '-18% 0px -64% 0px', threshold: [0.2, 0.45, 0.8] }
    );

    sectionLinks.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [sectionLinks, pathname]);

  useEffect(() => {
    const closeMenusOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (alertsPanelRef.current && !alertsPanelRef.current.contains(target)) {
        setAlertsOpen(false);
      }
      if (profilePanelRef.current && !profilePanelRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
    };

    const closeMenusOnEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAlertsOpen(false);
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', closeMenusOnOutsideClick);
    document.addEventListener('keydown', closeMenusOnEsc);
    return () => {
      document.removeEventListener('mousedown', closeMenusOnOutsideClick);
      document.removeEventListener('keydown', closeMenusOnEsc);
    };
  }, []);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const focusSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut({ redirectUrl: '/' });
    } catch {
      window.location.assign('/');
    } finally {
      setIsSigningOut(false);
      setProfileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white">
              FF
            </div>
            <div>
              <p className="text-sm font-semibold">FaithFlow Member</p>
              <p className="text-xs text-slate-500">Seamless member portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div ref={alertsPanelRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setAlertsOpen((open) => !open);
                  setProfileMenuOpen(false);
                }}
                aria-haspopup="dialog"
                aria-expanded={alertsOpen}
                aria-controls="member-alerts-panel"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
              >
                <BellIcon className="h-4 w-4" />
                Alerts
                {unreadCount > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-slate-900 px-1.5 py-0.5 text-xs font-semibold text-white">
                    {unreadCount}
                  </span>
                ) : null}
              </button>

              {alertsOpen ? (
                <div
                  id="member-alerts-panel"
                  role="dialog"
                  aria-label="Member alerts"
                  className="absolute right-0 z-50 mt-2 w-[22rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Alerts</p>
                    <button
                      type="button"
                      onClick={() => setReadAlertIds(alertItems.map((item) => item.id))}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {alertItems.map((alert) => {
                      const isUnread = !readAlertIds.includes(alert.id);
                      return (
                        <Link
                          key={alert.id}
                          href={alert.href}
                          onClick={() => {
                            setReadAlertIds((current) =>
                              current.includes(alert.id) ? current : [...current, alert.id]
                            );
                            setAlertsOpen(false);
                          }}
                          className="block border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-medium text-slate-900">{alert.title}</p>
                            {isUnread ? (
                              <span className="mt-0.5 h-2 w-2 rounded-full bg-blue-600" aria-hidden="true" />
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-slate-600">{alert.detail}</p>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div ref={profilePanelRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen((open) => !open);
                  setAlertsOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                aria-controls="member-profile-menu"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 transition hover:bg-slate-300"
              >
                TM
              </button>

              {profileMenuOpen ? (
                <div
                  id="member-profile-menu"
                  role="menu"
                  className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
                >
                  <Link
                    href="/portal/profile"
                    role="menuitem"
                    className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    My profile
                  </Link>
                  <Link
                    href="/portal/messages"
                    role="menuitem"
                    className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    Messages
                  </Link>
                  <Link
                    href="/portal/prayer"
                    role="menuitem"
                    className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    Prayer requests
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    {isSigningOut ? 'Signing out...' : 'Sign out'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[290px_minmax(0,1fr)] lg:px-8 2xl:grid-cols-[290px_minmax(0,1fr)_280px]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <h2 className="px-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Portal navigation
          </h2>
          <nav className="mt-4 space-y-3">
            {NAV_GROUPS.map((group) => {
              const isGroupOpen = openGroups[group.id];
              return (
                <section key={group.id} className="rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left"
                  >
                    <span className="text-sm font-semibold text-slate-800">{group.label}</span>
                    {isGroupOpen ? (
                      <ChevronDownIcon className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4 text-slate-500" />
                    )}
                  </button>
                  {isGroupOpen && (
                    <div className="space-y-1 px-2 pb-2">
                      {group.items.map((item) => {
                        const isActive = isRouteActive(pathname, item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() =>
                              setOpenGroups(
                                Object.fromEntries(
                                  NAV_GROUPS.map((candidate) => [candidate.id, candidate.id === group.id])
                                )
                              )
                            }
                            className={cx(
                              'flex items-start gap-3 rounded-lg px-2 py-2 text-left transition',
                              isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                            )}
                          >
                            <item.icon
                              className={cx('mt-0.5 h-4 w-4', isActive ? 'text-slate-100' : 'text-slate-500')}
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium">{item.label}</span>
                              <span className={cx('mt-0.5 block text-xs', isActive ? 'text-slate-300' : 'text-slate-500')}>
                                {item.description}
                              </span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </nav>
        </aside>

        <main className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-blue-900 to-blue-700 p-6 text-white shadow-sm lg:p-8">
            <p className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
              Member workspace
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm text-blue-100 sm:text-base">{description}</p>
            {actions ? <div className="mt-5 flex flex-wrap gap-3">{actions}</div> : null}
          </section>
          {children}
        </main>

        <aside className="hidden 2xl:block">
          <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Current page sections
            </h3>
            <div className="mt-3 space-y-1">
              {sectionLinks.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => focusSection(section.id)}
                  className={cx(
                    'block w-full rounded-lg px-3 py-2 text-left text-sm transition',
                    activeSection === section.id
                      ? 'bg-slate-900 font-semibold text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function MemberSectionCard({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
      <header className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
      </header>
      {children}
    </section>
  );
}

export function MemberStatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
    </article>
  );
}

export const PROFILE_SECTION_LINKS: PortalSectionLink[] = [
  { id: 'identity', label: 'Identity' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'notifications', label: 'Notifications' },
];

export const OVERVIEW_SECTION_LINKS: PortalSectionLink[] = [
  { id: 'snapshot', label: 'Snapshot' },
  { id: 'next-steps', label: 'Next steps' },
  { id: 'goals', label: 'Goals' },
];

export const EVENTS_SECTION_LINKS: PortalSectionLink[] = [
  { id: 'upcoming-events', label: 'Upcoming events' },
  { id: 'attendance-history', label: 'Attendance history' },
  { id: 'event-alerts', label: 'Event alerts' },
];

export const GIVING_SECTION_LINKS: PortalSectionLink[] = [
  { id: 'giving-summary', label: 'Summary' },
  { id: 'recurring-plan', label: 'Recurring plan' },
  { id: 'receipts', label: 'Receipts' },
];

export const VOLUNTEER_SECTION_LINKS: PortalSectionLink[] = [
  { id: 'availability', label: 'Availability' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'preferences', label: 'Preferences' },
];

export const MESSAGES_SECTION_LINKS: PortalSectionLink[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'message-preferences', label: 'Preferences' },
];

export const PRAYER_SECTION_LINKS: PortalSectionLink[] = [
  { id: 'request-form', label: 'Request form' },
  { id: 'active-requests', label: 'Active requests' },
  { id: 'care-guidance', label: 'Care guidance' },
];

export const COMMON_ACTION_BUTTON = (
  <button
    type="button"
    className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
  >
    Review updates
  </button>
);

export const PROFILE_ACTION_BUTTON = (
  <Link
    href="/portal/profile"
    className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
  >
    Complete profile
  </Link>
);

export const PRIVACY_ACTION_BUTTON = (
  <Link
    href="/portal/profile#privacy"
    className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
  >
    Privacy settings
  </Link>
);

export const LOCKED_CARD = (
  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
    <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
      <ShieldCheckIcon className="h-4 w-4" />
      This section is available once your church enables this feature.
    </p>
  </div>
);
