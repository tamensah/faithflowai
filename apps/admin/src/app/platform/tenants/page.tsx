'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../../components/Shell';
import { trpc } from '../../../lib/trpc';

type TenantStatusFilter = 'ALL' | 'ACTIVE' | 'SUSPENDED';

function formatDate(value: Date | string | null | undefined) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString();
}

export default function PlatformTenantsPage() {
  const utils = trpc.useUtils();
  const { data: platformSelf } = trpc.platform.self.useQuery();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<TenantStatusFilter>('ALL');
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const tenantFilters = useMemo(
    () => ({
      query: query.trim() ? query.trim() : undefined,
      status: status === 'ALL' ? undefined : status,
      limit: 100,
    }),
    [query, status]
  );

  const { data: tenants, isLoading } = trpc.platform.listTenants.useQuery(tenantFilters, {
    enabled: Boolean(platformSelf?.platformUser),
  });

  const selectedTenant = useMemo(
    () => tenants?.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [selectedTenantId, tenants]
  );

  const { data: auditLogs, isLoading: isAuditLoading } = trpc.platform.tenantAudit.useQuery(
    {
      tenantId: selectedTenantId ?? '',
      limit: 80,
    },
    {
      enabled: Boolean(selectedTenantId),
    }
  );

  const { mutate: setTenantStatus, isPending: isChangingStatus } = trpc.platform.setTenantStatus.useMutation({
    onSuccess: async () => {
      await utils.platform.listTenants.invalidate();
      if (selectedTenantId) {
        await utils.platform.tenantAudit.invalidate({ tenantId: selectedTenantId, limit: 80 });
      }
    },
  });

  if (!platformSelf?.platformUser) {
    return (
      <Shell>
        <Card className="p-6">
          <h1 className="text-xl font-semibold">Platform tenants</h1>
          <p className="mt-2 text-sm text-muted">You do not have platform access.</p>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Platform tenants</h1>
          <p className="mt-2 text-sm text-muted">
            Search tenants, manage account lifecycle, and inspect cross-tenant audit history.
          </p>
        </div>

        <Card className="p-6">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              placeholder="Search by tenant name, slug, or Clerk org id"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className="h-10 min-w-[180px] rounded-md border border-border bg-white px-3 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value as TenantStatusFilter)}
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </Card>

        <div className="space-y-4">
          {isLoading ? (
            <Card className="p-6">
              <p className="text-sm text-muted">Loading tenants...</p>
            </Card>
          ) : null}

          {!isLoading && !tenants?.length ? (
            <Card className="p-6">
              <p className="text-sm text-muted">No tenants match the current filters.</p>
            </Card>
          ) : null}

          {tenants?.map((tenant) => (
            <Card key={tenant.id} className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold">{tenant.name}</p>
                  <p className="text-xs text-muted">
                    {tenant.slug} · {tenant.clerkOrgId}
                  </p>
                </div>
                <Badge variant={tenant.status === 'SUSPENDED' ? 'warning' : 'default'}>{tenant.status}</Badge>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2 lg:grid-cols-4">
                <p>Organizations: {tenant.counts.organizations}</p>
                <p>Churches: {tenant.counts.churches}</p>
                <p>Audit logs: {tenant.counts.auditLogs}</p>
                <p>Created: {formatDate(tenant.createdAt)}</p>
              </div>

              <div className="mt-2 text-xs text-muted">
                {tenant.organizations.length ? (
                  <p>Org list: {tenant.organizations.map((org) => `${org.name} (${org.churchCount})`).join(', ')}</p>
                ) : (
                  <p>Org list: none</p>
                )}
                <p>
                  Subscription:{' '}
                  {tenant.currentSubscription
                    ? `${tenant.currentSubscription.planName} (${tenant.currentSubscription.planCode}) · ${tenant.currentSubscription.status}`
                    : 'No active subscription'}
                </p>
              </div>

              {tenant.status === 'SUSPENDED' ? (
                <p className="mt-2 text-xs text-muted">
                  Suspended: {formatDate(tenant.suspendedAt)}
                  {tenant.suspensionReason ? ` · ${tenant.suspensionReason}` : ''}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedTenantId(tenant.id)}>
                  View audit
                </Button>
                {tenant.status === 'ACTIVE' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                    disabled={isChangingStatus}
                    onClick={() => {
                      const reason = window.prompt('Optional suspension reason');
                      setTenantStatus({
                        tenantId: tenant.id,
                        status: 'SUSPENDED',
                        reason: reason?.trim() || undefined,
                      });
                    }}
                  >
                    Suspend
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={isChangingStatus}
                    onClick={() => setTenantStatus({ tenantId: tenant.id, status: 'ACTIVE' })}
                  >
                    Activate
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>

        {selectedTenant ? (
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Tenant audit: {selectedTenant.name}</h2>
                <p className="text-xs text-muted">{selectedTenant.id}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setSelectedTenantId(null)}>
                Close
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {isAuditLoading ? <p className="text-sm text-muted">Loading audit logs...</p> : null}
              {!isAuditLoading && !auditLogs?.length ? (
                <p className="text-sm text-muted">No tenant audit entries found.</p>
              ) : null}
              {auditLogs?.map((entry) => (
                <Card key={entry.id} className="p-3">
                  <p className="text-sm font-semibold">{entry.action}</p>
                  <p className="text-xs text-muted">
                    {entry.targetType}
                    {entry.targetId ? ` · ${entry.targetId}` : ''} · {formatDate(entry.createdAt)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Actor: {entry.actorType}
                    {entry.actorId ? ` · ${entry.actorId}` : ''}
                    {entry.church ? ` · Church: ${entry.church.name}` : ''}
                  </p>
                  {entry.metadata ? (
                    <pre className="mt-2 overflow-x-auto rounded-md bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">
                      {JSON.stringify(entry.metadata, null, 2)}
                    </pre>
                  ) : null}
                </Card>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    </Shell>
  );
}
