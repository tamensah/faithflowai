'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { OrganizationSwitcher, SignIn, useUser } from '@clerk/nextjs';
import { Button, Card, Input } from '@faithflow-ai/ui';
import { trpc } from '../../lib/trpc';
import { HelpTriggerButton, PortalHelpSheet } from './PortalHelpSheet';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const navLinks = [
  { href: '/portal/profile', label: 'Profile' },
  { href: '/portal/directory', label: 'Directory' },
  { href: '/portal/events', label: 'Events' },
  { href: '/portal/volunteer', label: 'Volunteer' },
  { href: '/portal/messages', label: 'Messages' },
  { href: '/portal/notifications', label: 'Notifications' },
  { href: '/portal/surveys', label: 'Surveys' },
];

// 5 primary links shown in the mobile bottom tab bar
const bottomNavLinks = [
  {
    href: '/portal/profile',
    label: 'Profile',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/portal/events',
    label: 'Events',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/portal/messages',
    label: 'Messages',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/portal/volunteer',
    label: 'Volunteer',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <path d="M18 11V6a2 2 0 0 0-4 0v5M14 11V4a2 2 0 0 0-4 0v7M10 11V6a2 2 0 0 0-4 0v5c0 5 8 8 8 8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/portal/notifications',
    label: 'Alerts',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const pathname = usePathname();

  const [helpOpen, setHelpOpen] = useState(false);
  const [requestChurchId, setRequestChurchId] = useState('');
  const [requestName, setRequestName] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [requestAccessError, setRequestAccessError] = useState<string | null>(null);

  const { data: selfProfile, error: selfError, isLoading: isProfileLoading } = trpc.member.selfProfile.useQuery(
    undefined,
    { retry: false }
  );
  const { data: authSelf } = trpc.auth.self.useQuery(undefined, { retry: false, enabled: Boolean(user) });
  const { data: platformSelf } = trpc.platform.self.useQuery(undefined, { retry: false, enabled: Boolean(user) });

  const showAccessRequest = selfError?.data?.code === 'NOT_FOUND';
  const missingTenantContext =
    selfError?.data?.code === 'BAD_REQUEST' &&
    (selfError.message ?? '').toLowerCase().includes('tenant');
  const hasAdminAccess = Boolean(authSelf?.isStaff || platformSelf?.platformUser);
  const adminBaseUrl = (process.env.NEXT_PUBLIC_ADMIN_URL ?? 'https://admin-gamma-beryl.vercel.app').replace(/\/+$/, '');

  const { data: accessRequest } = trpc.member.myAccessRequest.useQuery(undefined, {
    enabled: Boolean(showAccessRequest),
  });
  const { data: churches } = trpc.church.list.useQuery(
    { organizationId: undefined },
    { enabled: Boolean(showAccessRequest) }
  );
  const { mutate: requestAccess, isPending: isRequestingAccess } = trpc.member.requestAccess.useMutation({
    onError: (err) => {
      setRequestAccessError(err.message ?? 'Failed to submit request.');
    },
  });

  useEffect(() => {
    if (!showAccessRequest) return;
    if (!requestName && user?.fullName) setRequestName(user.fullName);
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!requestEmail && email) setRequestEmail(email);
  }, [requestEmail, requestName, showAccessRequest, user]);

  useEffect(() => {
    if (!requestChurchId && churches?.length) setRequestChurchId(churches[0].id);
  }, [requestChurchId, churches]);

  useEffect(() => {
    if (!hasAdminAccess) return;
    if (typeof window === 'undefined') return;
    window.location.replace(adminBaseUrl);
  }, [adminBaseUrl, hasAdminAccess]);

  if (isProfileLoading) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <Card className="p-6">
          <p className="text-sm text-muted">Loading your portal…</p>
        </Card>
      </div>
    );
  }

  if (selfError?.data?.code === 'UNAUTHORIZED') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <SignIn routing="path" path="/sign-in" fallbackRedirectUrl="/portal" />
      </div>
    );
  }

  if (hasAdminAccess) {
    return (
      <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center p-8">
        <Card className="w-full max-w-xl p-6">
          <h1 className="text-xl font-semibold">Admin account detected</h1>
          <p className="mt-2 text-sm text-muted">
            This account has staff/admin access. Continue in the admin console for church operations.
          </p>
          <div className="mt-4">
            <Button onClick={() => (window.location.href = adminBaseUrl)}>Open admin console</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (missingTenantContext) {
    return (
      <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center p-8">
        <Card className="w-full max-w-xl p-6">
          <h1 className="text-xl font-semibold">Select your church</h1>
          <p className="mt-2 text-sm text-muted">
            You're signed in, but no church organization is active. Select your church below to continue.
          </p>
          <div className="mt-4">
            <OrganizationSwitcher
              hidePersonal
              afterSelectOrganizationUrl="/portal"
              afterCreateOrganizationUrl="/get-started"
            />
          </div>
        </Card>
      </div>
    );
  }

  if (showAccessRequest) {
    return (
      <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center p-8">
        <Card className="w-full max-w-xl p-6">
          <h1 className="text-xl font-semibold">Request member access</h1>
          <p className="mt-2 text-sm text-muted">
            Your account is signed in but not linked to a member record. Submit this request and we'll notify your
            church staff.
          </p>
          {accessRequest ? (
            <div className="mt-4 rounded-md border border-border bg-muted/10 p-3 text-sm text-muted">
              <p className="font-medium text-foreground">Request status: {accessRequest.status}</p>
              <p className="text-xs text-muted">
                {accessRequest.church?.name ?? 'Church'} · {accessRequest.email ?? 'No email'}
              </p>
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Full name *</label>
              <Input
                placeholder="Full name"
                value={requestName}
                onChange={(e) => {
                  setRequestAccessError(null);
                  setRequestName(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Email *</label>
              <Input
                placeholder="Email"
                value={requestEmail}
                onChange={(e) => {
                  setRequestAccessError(null);
                  setRequestEmail(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Church *</label>
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={requestChurchId}
                onChange={(e) => {
                  setRequestAccessError(null);
                  setRequestChurchId(e.target.value);
                }}
              >
                <option value="">Select church</option>
                {churches?.map((church) => (
                  <option key={church.id} value={church.id}>
                    {church.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Message (optional)</label>
              <Input
                placeholder="Message (optional)"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4">
            <Button
              onClick={() => {
                const email = requestEmail.trim();
                if (!emailRegex.test(email)) {
                  setRequestAccessError('Enter a valid email address.');
                  return;
                }
                setRequestAccessError(null);
                requestAccess({
                  churchId: requestChurchId,
                  name: requestName.trim() || undefined,
                  email,
                  message: requestMessage.trim() || undefined,
                });
              }}
              disabled={!requestChurchId || !requestName.trim() || !requestEmail.trim() || isRequestingAccess}
            >
              {isRequestingAccess ? 'Submitting…' : 'Request access'}
            </Button>
            {requestAccessError ? <p className="mt-2 text-xs text-destructive">{requestAccessError}</p> : null}
          </div>
        </Card>
      </div>
    );
  }

  const memberName =
    selfProfile?.member?.preferredName ?? selfProfile?.member?.firstName ?? user?.firstName ?? 'Member';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eaf3ff_0%,_#f6f7fb_40%,_#f7f7f4_100%)]">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div>
            <p className="text-[11px] text-muted">Welcome back, {memberName}</p>
            <p className="text-sm font-semibold leading-tight">Member Portal</p>
          </div>

          {/* Desktop nav (horizontal scroll) */}
          <nav className="hidden items-center gap-0.5 sm:flex">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname === href
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted hover:bg-slate-100 hover:text-foreground'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Right side: current page label (mobile) + help trigger */}
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground sm:hidden">
              {navLinks.find((l) => l.href === pathname)?.label ?? ''}
            </p>
            <HelpTriggerButton onClick={() => setHelpOpen(true)} />
          </div>
        </div>
      </header>

      {/* Page content — extra bottom padding on mobile for bottom nav */}
      <main className="mx-auto max-w-5xl px-4 py-5 pb-24 sm:px-6 sm:pb-8">
        {children}
      </main>

      <PortalHelpSheet open={helpOpen} onOpenChange={setHelpOpen} />

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-white/95 backdrop-blur sm:hidden">
        <div className="flex h-16 items-stretch">
          {bottomNavLinks.map(({ href, label, icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  active ? 'text-primary' : 'text-muted'
                }`}
              >
                <span className={active ? 'text-primary' : 'text-muted'}>{icon}</span>
                {label}
              </Link>
            );
          })}
          {/* More link — shows the remaining pages (directory, surveys) */}
          <Link
            href="/portal/directory"
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              ['/portal/directory', '/portal/surveys'].includes(pathname) ? 'text-primary' : 'text-muted'
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
            </svg>
            More
          </Link>
        </div>
      </nav>
    </div>
  );
}
