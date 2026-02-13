'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../../components/Shell';
import { trpc } from '../../../lib/trpc';

type TenantStatusFilter = 'ALL' | 'ACTIVE' | 'SUSPENDED';
type AuditActorTypeFilter = 'ALL' | 'USER' | 'SYSTEM' | 'WEBHOOK';

function formatDate(value: Date | string | null | undefined) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString();
}

function toDateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function escapeCsvCell(value: unknown) {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  const needsQuotes = /[",\n\r]/.test(raw);
  const escaped = raw.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export default function PlatformTenantsPage() {
  const utils = trpc.useUtils();
  const { data: platformSelf } = trpc.platform.self.useQuery();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<TenantStatusFilter>('ALL');
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [auditActionContains, setAuditActionContains] = useState('');
  const [auditActorType, setAuditActorType] = useState<AuditActorTypeFilter>('ALL');
  const [auditActorId, setAuditActorId] = useState('');
  const [auditTargetType, setAuditTargetType] = useState('');
  const [auditTargetId, setAuditTargetId] = useState('');
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');

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

  const auditFilters = useMemo(
    () => ({
      tenantId: selectedTenantId ?? '',
      limit: 120,
      actionContains: auditActionContains.trim() ? auditActionContains.trim() : undefined,
      actorType: auditActorType === 'ALL' ? undefined : (auditActorType as any),
      actorId: auditActorId.trim() ? auditActorId.trim() : undefined,
      targetType: auditTargetType.trim() ? auditTargetType.trim() : undefined,
      targetId: auditTargetId.trim() ? auditTargetId.trim() : undefined,
      from: auditFrom ? new Date(`${auditFrom}T00:00:00.000Z`) : undefined,
      to: auditTo ? new Date(`${auditTo}T23:59:59.999Z`) : undefined,
    }),
    [auditActionContains, auditActorId, auditActorType, auditFrom, auditTargetId, auditTargetType, auditTo, selectedTenantId]
  );

  const { data: auditLogs, isLoading: isAuditLoading } = trpc.platform.tenantAudit.useQuery(
    auditFilters,
    {
      enabled: Boolean(selectedTenantId),
    }
  );

  const { mutate: setTenantStatus, isPending: isChangingStatus } = trpc.platform.setTenantStatus.useMutation({
    onSuccess: async () => {
      await utils.platform.listTenants.invalidate();
      if (selectedTenantId) {
        await utils.platform.tenantAudit.invalidate(auditFilters);
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
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const rows = auditLogs ?? [];
                    const header = [
                      'createdAt',
                      'action',
                      'actorType',
                      'actorId',
                      'targetType',
                      'targetId',
                      'churchId',
                      'churchName',
                      'metadata',
                    ];
                    const lines = [
                      header.join(','),
                      ...rows.map((row) =>
                        [
                          escapeCsvCell(row.createdAt),
                          escapeCsvCell(row.action),
                          escapeCsvCell(row.actorType),
                          escapeCsvCell(row.actorId ?? ''),
                          escapeCsvCell(row.targetType),
                          escapeCsvCell(row.targetId ?? ''),
                          escapeCsvCell(row.church?.id ?? ''),
                          escapeCsvCell(row.church?.name ?? ''),
                          escapeCsvCell(row.metadata ?? ''),
                        ].join(',')
                      ),
                    ].join('\n');
                    const blob = new Blob([lines], { type: 'text/csv;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `tenant-audit-${selectedTenant.slug}-${toDateInputValue(new Date())}.csv`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                  disabled={!auditLogs?.length}
                >
                  Export CSV
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedTenantId(null)}>
                  Close
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Input
                placeholder="Action contains (e.g., billing., platform.)"
                value={auditActionContains}
                onChange={(event) => setAuditActionContains(event.target.value)}
              />
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={auditActorType}
                onChange={(event) => setAuditActorType(event.target.value as AuditActorTypeFilter)}
              >
                <option value="ALL">All actors</option>
                <option value="USER">USER</option>
                <option value="SYSTEM">SYSTEM</option>
                <option value="WEBHOOK">WEBHOOK</option>
              </select>
              <Input
                placeholder="Actor id (optional)"
                value={auditActorId}
                onChange={(event) => setAuditActorId(event.target.value)}
              />
              <Input
                placeholder="Target type (optional)"
                value={auditTargetType}
                onChange={(event) => setAuditTargetType(event.target.value)}
              />
              <Input
                placeholder="Target id (optional)"
                value={auditTargetId}
                onChange={(event) => setAuditTargetId(event.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input type="date" value={auditFrom} onChange={(event) => setAuditFrom(event.target.value)} />
                <Input type="date" value={auditTo} onChange={(event) => setAuditTo(event.target.value)} />
              </div>
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
