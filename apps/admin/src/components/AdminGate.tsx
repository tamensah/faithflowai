'use client';

import { useEffect, useState } from 'react';
import { OrganizationSwitcher, useAuth, useOrganizationList, useUser } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import { Card, Button } from '@faithflow-ai/ui';
import { trpc } from '../lib/trpc';

export function AdminGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) {
    return <>{children}</>;
  }

  return <ProtectedAdminGate>{children}</ProtectedAdminGate>;
}

function ProtectedAdminGate({ children }: { children: React.ReactNode }) {
  const { orgId } = useAuth();
  const { isLoaded: organizationsLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: { pageSize: 2 },
  });
  const utils = trpc.useUtils();
  const { user, isLoaded, isSignedIn } = useUser();
  const webPortalUrl = `${(process.env.NEXT_PUBLIC_WEB_URL ?? 'https://churchtrack-web-git-develop-tamensahs-projects.vercel.app').replace(/\/+$/, '')}/portal`;
  const { data: platformSelf, isLoading: isPlatformLoading } = trpc.platform.self.useQuery(undefined, {
    enabled: Boolean(isSignedIn),
  });
  const { data, isLoading, error: authError } = trpc.auth.self.useQuery(undefined, {
    enabled: Boolean(isSignedIn && orgId),
  });
  const { data: memberSelf } = trpc.member.selfProfile.useQuery(undefined, {
    enabled: Boolean(isSignedIn && orgId && !data?.isStaff && !platformSelf?.platformUser),
    retry: false,
  });
  const [inviteAttempted, setInviteAttempted] = useState(false);
  const [activationAttempted, setActivationAttempted] = useState<string | null>(null);
  const [activationError, setActivationError] = useState(false);
  const [activationPending, setActivationPending] = useState(false);
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
    if (!isSignedIn || orgId || !organizationsLoaded || !setActive) return;
    if (userMemberships.data?.length !== 1 || userMemberships.hasNextPage) return;
    const organizationId = userMemberships.data[0].organization.id;
    if (activationAttempted === organizationId) return;
    setActivationAttempted(organizationId);
    setActivationPending(true);
    void setActive({ organization: organizationId })
      .catch(() => setActivationError(true))
      .finally(() => setActivationPending(false));
  }, [activationAttempted, isSignedIn, orgId, organizationsLoaded, setActive, userMemberships.data, userMemberships.hasNextPage]);

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

  if (isLoading || isPlatformLoading || (!orgId && !organizationsLoaded) || activationPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">Verifying access…</p>
      </div>
    );
  }

  if (platformSelf?.platformUser || data?.isStaff) {
    return <>{children}</>;
  }

  const missingTenantContext = !orgId || (
    authError?.data?.code === 'BAD_REQUEST' &&
    (authError.message ?? '').toLowerCase().includes('tenant')
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="max-w-lg p-6">
        <h1 className="text-xl font-semibold">Access restricted</h1>
        {missingTenantContext ? (
          <div className="mt-2 space-y-3 text-sm text-muted">
            <p>This account has no active church organization in the current session.</p>
            {activationError ? <p>Automatic selection failed. Choose your church below.</p> : null}
            <p>Select your church organization to continue.</p>
            <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/" afterCreateOrganizationUrl="/" />
          </div>
        ) : (
          <div className="mt-2 space-y-2 text-sm text-muted">
            <p>This console is limited to staff and admins.</p>
            {authError ? <p>We could not verify your access. Select your church and try again.</p> : null}
            <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/" afterCreateOrganizationUrl="/" />
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
