'use client';

import { useEffect, useState } from 'react';
import { OrganizationSwitcher, useAuth, useUser } from '@clerk/nextjs';
import { Card, Button } from '@faithflow-ai/ui';
import { trpc } from '../lib/trpc';

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { orgId } = useAuth();
  const utils = trpc.useUtils();
  const { user, isLoaded, isSignedIn } = useUser();
  const webPortalUrl = `${(process.env.NEXT_PUBLIC_WEB_URL ?? 'https://web-nu-eight-62.vercel.app').replace(/\/+$/, '')}/portal`;
  const { data: platformSelf, isLoading: isPlatformLoading } = trpc.platform.self.useQuery(undefined, {
    enabled: Boolean(isSignedIn),
  });
  const { data, isLoading, error: authError } = trpc.auth.self.useQuery(undefined, {
    enabled: Boolean(isSignedIn),
  });
  const { data: memberSelf } = trpc.member.selfProfile.useQuery(undefined, {
    enabled: Boolean(isSignedIn && orgId && !data?.isStaff && !platformSelf?.platformUser),
    retry: false,
  });
  const [inviteAttempted, setInviteAttempted] = useState(false);
  const { mutate: bootstrap, isPending: isBootstrapping } = trpc.auth.bootstrap.useMutation({
    onSuccess: async () => {
      await utils.auth.self.invalidate();
    },
  });
  const { mutate: acceptInvite, isPending: isAcceptingInvite } = trpc.staff.acceptInvite.useMutation({
    onSuccess: async () => {
      await utils.auth.self.invalidate();
    },
  });
  const { mutate: bootstrapPlatform, isPending: isBootstrappingPlatform } = trpc.platform.bootstrap.useMutation({
    onSuccess: async () => {
      await utils.platform.self.invalidate();
    },
  });

  useEffect(() => {
    if (!isSignedIn) return;
    if (data?.bootstrapAllowed && !data?.isStaff && !isBootstrapping && !platformSelf?.platformUser) {
      bootstrap();
    }
  }, [bootstrap, data?.bootstrapAllowed, data?.isStaff, isBootstrapping, isSignedIn, platformSelf?.platformUser]);

  useEffect(() => {
    if (!isSignedIn) return;
    if (data?.isStaff || inviteAttempted || data?.bootstrapAllowed || isAcceptingInvite) return;
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email) return;
    setInviteAttempted(true);
    acceptInvite(
      { email },
      {
        onError: () => {
          // ignore if no pending invite
        },
      }
    );
  }, [acceptInvite, data?.bootstrapAllowed, data?.isStaff, inviteAttempted, isAcceptingInvite, isSignedIn, user]);

  useEffect(() => {
    if (!isSignedIn) return;
    if (!platformSelf?.bootstrapAllowed || platformSelf?.platformUser || isBootstrappingPlatform) return;
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email) return;
    bootstrapPlatform({ email });
  }, [bootstrapPlatform, isBootstrappingPlatform, isSignedIn, platformSelf, user]);

  useEffect(() => {
    setInviteAttempted(false);
  }, [orgId]);

  useEffect(() => {
    if (!memberSelf?.member) return;
    if (typeof window === 'undefined') return;
    window.location.replace(webPortalUrl);
  }, [memberSelf?.member, webPortalUrl]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">Loading session…</p>
      </div>
    );
  }

  // Middleware redirects unauthenticated users to /sign-in before this renders.
  // This fallback handles edge cases (e.g., session expiry between renders).
  if (!isSignedIn) {
    if (typeof window !== 'undefined') {
      window.location.replace('/sign-in');
    }
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">Redirecting to sign in…</p>
      </div>
    );
  }

  if (isLoading || isPlatformLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">Verifying access…</p>
      </div>
    );
  }

  if (platformSelf?.platformUser || data?.isStaff) {
    return <>{children}</>;
  }

  const missingTenantContext =
    authError?.data?.code === 'BAD_REQUEST' &&
    (authError.message ?? '').toLowerCase().includes('tenant');

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="max-w-lg p-6">
        <h1 className="text-xl font-semibold">Access restricted</h1>
        {missingTenantContext ? (
          <div className="mt-2 space-y-3 text-sm text-muted">
            <p>This account has no active church organization in the current session.</p>
            <p>Select your church organization, then refresh this page.</p>
            <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/" afterCreateOrganizationUrl="/" />
          </div>
        ) : (
          <div className="mt-2 space-y-2 text-sm text-muted">
            <p>This console is limited to staff and admins.</p>
            <p>If you are the first admin for this church, use “Claim admin access”.</p>
          </div>
        )}
        {data?.bootstrapAllowed || platformSelf?.bootstrapAllowed ? (
          <div className="mt-4">
            <Button onClick={() => bootstrap()} disabled={isBootstrapping}>
              {isBootstrapping ? 'Claiming access…' : 'Claim admin access'}
            </Button>
          </div>
        ) : null}
        <div className="mt-3">
          <Button variant="outline" onClick={() => (window.location.href = webPortalUrl)}>
            Go to member portal
          </Button>
        </div>
      </Card>
    </div>
  );
}
