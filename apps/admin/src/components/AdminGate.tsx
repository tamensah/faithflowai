'use client';

import { useEffect, useState } from 'react';
import { OrganizationSwitcher, SignInButton, SignUpButton, SignedOut, useAuth, useUser } from '@clerk/nextjs';
import { Card, Button } from '@faithflow-ai/ui';
import { trpc } from '../lib/trpc';

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { orgId } = useAuth();
  const utils = trpc.useUtils();
  const { user, isLoaded, isSignedIn } = useUser();
  const { data: platformSelf, isLoading: isPlatformLoading } = trpc.platform.self.useQuery(undefined, {
    enabled: Boolean(isSignedIn),
  });
  const { data, isLoading, error: authError } = trpc.auth.self.useQuery(undefined, {
    enabled: Boolean(isSignedIn),
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

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">Loading session…</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <Card className="max-w-lg p-6">
          <h1 className="text-xl font-semibold">Sign in to admin</h1>
          <p className="mt-2 text-sm text-muted">Use your church admin account to access the console.</p>
          <SignedOut>
            <div className="mt-4 flex flex-wrap gap-2">
              <SignInButton mode="modal">
                <Button>Sign in</Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button variant="outline">Create account</Button>
              </SignUpButton>
            </div>
          </SignedOut>
        </Card>
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
      </Card>
    </div>
  );
}
