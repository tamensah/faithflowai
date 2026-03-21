'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { PageSectionLayout } from '../../components/PageSectionLayout';
import { trpc } from '../../lib/trpc';
import { useWriteAccess } from '../../lib/entitlements';
import { ReadOnlyNotice } from '../../components/ReadOnlyNotice';

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

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </Card>
  );
}

export default function PlatformAdminPage() {
  const writeGate = useWriteAccess();
  const utils = trpc.useUtils();
  const canWrite = writeGate.canWrite;
  const { data: platformSelf } = trpc.platform.self.useQuery();

  const { data: tenants, isLoading: isLoadingTenants } = trpc.platform.listTenants.useQuery(
    { limit: 100 },
    { enabled: Boolean(platformSelf?.platformUser) }
  );

  const { data: dunningAtRisk } = trpc.platform.dunningPreview.useQuery(
    { graceDays: 1, limit: 500 },
    { enabled: Boolean(platformSelf?.platformUser) }
  );

  const { data: plans } = trpc.platform.listPlans.useQuery(
    { includeInactive: false },
    { enabled: Boolean(platformSelf?.platformUser) }
  );

  const { data: users } = trpc.platform.listUsers.useQuery(undefined, {
    enabled: Boolean(platformSelf?.platformUser),
  });

  const stats = useMemo(() => {
    if (!tenants) return null;
    const total = tenants.length;
    const suspended = tenants.filter((t) => t.status === 'SUSPENDED').length;
    const active = tenants.filter((t) => t.currentSubscription?.status === 'ACTIVE').length;
    const trialing = tenants.filter((t) => t.currentSubscription?.status === 'TRIALING').length;
    const pastDue = tenants.filter((t) => t.currentSubscription?.status === 'PAST_DUE').length;
    const noSub = tenants.filter((t) => !t.currentSubscription).length;
    return { total, suspended, active, trialing, pastDue, noSub };
  }, [tenants]);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<(typeof roleOptions)[number]>('PLATFORM_ADMIN');

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
      <PageSectionLayout rootId="platform-page-sections" title="Platform sections" className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Platform overview</h1>
          <p className="mt-2 text-sm text-muted">
            Command center — tenant health, subscription status, and platform team access.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              href="/platform/tenants"
            >
              Tenant management
            </Link>
            <span className="text-muted">·</span>
            <Link
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              href="/platform/subscriptions"
            >
              Subscriptions &amp; plans
            </Link>
            <span className="text-muted">·</span>
            <Link
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              href="/platform/ops"
            >
              Platform ops
            </Link>
          </div>
        </div>

        {writeGate.readOnly ? <ReadOnlyNotice /> : null}

        {/* Tenant stats */}
        <div>
          <h2 className="mb-3 text-base font-semibold">Tenant overview</h2>
          {isLoadingTenants ? (
            <p className="text-sm text-muted">Loading tenant stats…</p>
          ) : stats ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Total tenants" value={stats.total} />
              <StatCard label="Active" value={stats.active} sub="paying" />
              <StatCard label="Trialing" value={stats.trialing} sub="in trial" />
              <StatCard
                label="Past due"
                value={stats.pastDue}
                sub={dunningAtRisk ? `${dunningAtRisk.targets?.length ?? 0} at risk` : undefined}
              />
              <StatCard label="No subscription" value={stats.noSub} sub="never subscribed" />
              <StatCard label="Suspended" value={stats.suspended} sub="access blocked" />
            </div>
          ) : null}
        </div>

        {/* Plan catalog summary */}
        {plans && plans.length > 0 ? (
          <div>
            <h2 className="mb-3 text-base font-semibold">Active plan catalog</h2>
            <div className="flex flex-wrap gap-3">
              {plans.map((plan) => (
                <Card key={plan.id} className="flex items-center gap-3 p-3">
                  <div>
                    <p className="text-sm font-semibold">{plan.name}</p>
                    <p className="text-xs text-muted">
                      {plan.currency} {(plan.amountMinor / 100).toFixed(2)} / {plan.interval}
                    </p>
                  </div>
                  <Badge variant="default">{plan._count.tenantSubscriptions} tenants</Badge>
                  {plan.isDefault ? <Badge variant="success">DEFAULT</Badge> : null}
                </Card>
              ))}
            </div>
          </div>
        ) : null}

        {/* Quick actions */}
        <div>
          <h2 className="mb-3 text-base font-semibold">Quick actions</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/platform/tenants">
              <Card className="cursor-pointer p-4 transition-colors hover:bg-accent">
                <p className="text-sm font-semibold">Tenant management</p>
                <p className="mt-1 text-xs text-muted">Search, suspend, activate tenants. View audit timeline.</p>
              </Card>
            </Link>
            <Link href="/platform/subscriptions">
              <Card className="cursor-pointer p-4 transition-colors hover:bg-accent">
                <p className="text-sm font-semibold">Subscriptions &amp; billing</p>
                <p className="mt-1 text-xs text-muted">
                  Plan catalog, tenant assignments, dunning, billing automation, tenant inspector.
                </p>
              </Card>
            </Link>
            <Link href="/platform/ops">
              <Card className="cursor-pointer p-4 transition-colors hover:bg-accent">
                <p className="text-sm font-semibold">Platform ops</p>
                <p className="mt-1 text-xs text-muted">
                  Domain management, SSL automation, security policies, streaming sync.
                </p>
              </Card>
            </Link>
          </div>
        </div>

        {/* Platform team */}
        <div>
          <h2 className="mb-3 text-base font-semibold">Platform team roles</h2>
          <Card className="p-6">
            <h3 className="text-base font-semibold">Assign role</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input placeholder="User email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as (typeof roleOptions)[number])}
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
                disabled={!canWrite || !email.trim() || isPending}
              >
                {isPending ? 'Assigning…' : 'Assign role'}
              </Button>
            </div>
          </Card>

          <div className="mt-4 space-y-4">
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
                      disabled={!canWrite}
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
                <p className="text-sm text-muted">
                  {writeGate.readOnly
                    ? 'No platform users listed in view-only mode.'
                    : 'No platform users yet. Assign a role above to get started.'}
                </p>
              </Card>
            )}
          </div>
        </div>
      </PageSectionLayout>
    </Shell>
  );
}
