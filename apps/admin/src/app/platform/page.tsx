'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { trpc } from '../../lib/trpc';

const roleOptions = [
  'SUPER_ADMIN',
  'PLATFORM_ADMIN',
  'OPERATIONS_MANAGER',
  'SUPPORT_MANAGER',
  'SUPPORT_AGENT',
  'SECURITY_ADMIN',
  'COMPLIANCE_OFFICER',
  'BILLING_ADMIN',
  'ANALYTICS_ADMIN',
] as const;

export default function PlatformAdminPage() {
  const utils = trpc.useUtils();
  const { data: platformSelf } = trpc.platform.self.useQuery();
  const { data: users } = trpc.platform.listUsers.useQuery(undefined, {
    enabled: Boolean(platformSelf?.platformUser),
  });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<typeof roleOptions[number]>('PLATFORM_ADMIN');

  const { mutate: assignRole, isPending } = trpc.platform.assignRole.useMutation({
    onSuccess: async () => {
      setEmail('');
      await utils.platform.listUsers.invalidate();
    },
  });
  const { mutate: removeRole } = trpc.platform.removeRole.useMutation({
    onSuccess: async () => {
      await utils.platform.listUsers.invalidate();
    },
  });

  const roleMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const user of users ?? []) {
      map.set(user.id, user.roles.map((entry) => entry.role));
    }
    return map;
  }, [users]);

  if (!platformSelf?.platformUser) {
    return (
      <Shell>
        <Card className="p-6">
          <h1 className="text-xl font-semibold">Platform admin</h1>
          <p className="mt-2 text-sm text-muted">You do not have platform access.</p>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Platform administration</h1>
          <p className="mt-2 text-sm text-muted">Assign platform roles and oversee access.</p>
          <div className="mt-3">
            <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href="/platform/tenants">
              Open platform tenants
            </Link>
            <span className="px-2 text-muted">·</span>
            <Link
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              href="/platform/ops"
            >
              Open platform ops
            </Link>
            <span className="px-2 text-muted">·</span>
            <Link
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              href="/platform/subscriptions"
            >
              Open subscriptions
            </Link>
          </div>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Assign role</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input placeholder="User email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof roleOptions[number])}
            >
              {roleOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4">
            <Button
              onClick={() => assignRole({ email: email.trim(), role })}
              disabled={!email.trim() || isPending}
            >
              {isPending ? 'Assigning…' : 'Assign role'}
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          {users?.map((user) => (
            <Card key={user.id} className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{user.email}</p>
                  <p className="text-xs text-muted">{user.name ?? 'Platform user'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {roleMap.get(user.id)?.map((entry) => (
                    <Badge key={entry} variant="default">
                      {entry}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(roleMap.get(user.id) ?? []).map((entry) => (
                  <Button
                    key={entry}
                    size="sm"
                    variant="outline"
                    onClick={() => removeRole({ platformUserId: user.id, role: entry as any })}
                  >
                    Remove {entry}
                  </Button>
                ))}
              </div>
            </Card>
          ))}
          {!users?.length && (
            <Card className="p-6">
              <p className="text-sm text-muted">No platform users yet.</p>
            </Card>
          )}
        </div>
      </div>
    </Shell>
  );
}
