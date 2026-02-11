'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, Button } from '@faithflow-ai/ui';
import { trpc } from '../lib/trpc';

export function AdminGate({ children }: { children: React.ReactNode }) {
  const utils = trpc.useUtils();
  const { user } = useUser();
  const { data: platformSelf, isLoading: isPlatformLoading } = trpc.platform.self.useQuery();
  const { data, isLoading } = trpc.auth.self.useQuery();
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
    if (data?.bootstrapAllowed && !data?.isStaff && !isBootstrapping && !platformSelf?.platformUser) {
      bootstrap();
    }
  }, [bootstrap, data?.bootstrapAllowed, data?.isStaff, isBootstrapping]);

  useEffect(() => {
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
  }, [acceptInvite, data?.bootstrapAllowed, data?.isStaff, inviteAttempted, isAcceptingInvite, user]);

  useEffect(() => {
    if (!platformSelf?.bootstrapAllowed || platformSelf?.platformUser || isBootstrappingPlatform) return;
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email) return;
    bootstrapPlatform({ email });
  }, [bootstrapPlatform, isBootstrappingPlatform, platformSelf, user]);

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="max-w-lg p-6">
        <h1 className="text-xl font-semibold">Access restricted</h1>
        <p className="mt-2 text-sm text-muted">
          This console is limited to staff and admins. Ask an admin to grant you access.
        </p>
        {data?.bootstrapAllowed ? (
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
