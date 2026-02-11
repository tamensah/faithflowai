'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../../components/Shell';
import { trpc } from '../../../lib/trpc';

export default function PlatformOpsPage() {
  const utils = trpc.useUtils();
  const { data: platformSelf } = trpc.platform.self.useQuery();
  const { data: tenants } = trpc.platform.listTenants.useQuery(
    { limit: 100 },
    { enabled: Boolean(platformSelf?.platformUser) }
  );

  const [tenantId, setTenantId] = useState('');
  const [domain, setDomain] = useState('');
  const [dnsTarget, setDnsTarget] = useState('');
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState('480');
  const [dataRetentionDays, setDataRetentionDays] = useState('3650');
  const [breachContactEmail, setBreachContactEmail] = useState('');
  const [requireMfaForStaff, setRequireMfaForStaff] = useState(true);
  const [enforceSso, setEnforceSso] = useState(false);
  const [automationLimit, setAutomationLimit] = useState('250');
  const [sslWarningDays, setSslWarningDays] = useState('30');

  useEffect(() => {
    if (!tenantId && tenants?.length) {
      setTenantId(tenants[0].id);
    }
  }, [tenantId, tenants]);

  const { data: domains } = trpc.tenantOps.listDomains.useQuery(
    { tenantId: tenantId || undefined },
    { enabled: Boolean(tenantId) }
  );
  const { data: healthChecks } = trpc.tenantOps.listHealthChecks.useQuery(
    { tenantId, limit: 20 },
    { enabled: Boolean(tenantId) }
  );
  const { data: securityPolicy } = trpc.tenantOps.securityPolicy.useQuery(
    { tenantId },
    {
      enabled: Boolean(tenantId),
    }
  );
  const domainAutomationInput = {
    tenantId: tenantId || undefined,
    limit: Number.isFinite(Number(automationLimit)) ? Number(automationLimit) : 250,
    sslExpiryWarningDays: Number.isFinite(Number(sslWarningDays)) ? Number(sslWarningDays) : 30,
  };
  const { data: domainAutomationPreview } = trpc.tenantOps.domainAutomationPreview.useQuery(domainAutomationInput, {
    enabled: Boolean(tenantId),
  });

  useEffect(() => {
    if (!securityPolicy) return;
    setSessionTimeoutMinutes(String(securityPolicy.sessionTimeoutMinutes));
    setDataRetentionDays(String(securityPolicy.dataRetentionDays));
    setBreachContactEmail(securityPolicy.breachContactEmail ?? '');
    setRequireMfaForStaff(securityPolicy.requireMfaForStaff);
    setEnforceSso(securityPolicy.enforceSso);
  }, [securityPolicy]);

  const { mutate: upsertDomain, isPending: isSavingDomain } = trpc.tenantOps.upsertDomain.useMutation({
    onSuccess: async () => {
      setDomain('');
      setDnsTarget('');
      await utils.tenantOps.listDomains.invalidate({ tenantId });
    },
  });
  const { mutate: verifyDomain } = trpc.tenantOps.verifyDomain.useMutation({
    onSuccess: async () => {
      await utils.tenantOps.listDomains.invalidate({ tenantId });
    },
  });
  const { mutate: runHealthSweep, isPending: isRunningSweep } = trpc.tenantOps.runHealthSweep.useMutation({
    onSuccess: async () => {
      await utils.tenantOps.listHealthChecks.invalidate({ tenantId, limit: 20 });
    },
  });
  const { mutate: updateSecurityPolicy, isPending: isUpdatingPolicy } = trpc.tenantOps.updateSecurityPolicy.useMutation({
    onSuccess: async () => {
      await utils.tenantOps.securityPolicy.invalidate({ tenantId });
    },
  });
  const { mutate: runDomainAutomation, isPending: isRunningDomainAutomation } = trpc.tenantOps.runDomainAutomation.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.tenantOps.domainAutomationPreview.invalidate(domainAutomationInput),
        utils.tenantOps.listDomains.invalidate({ tenantId }),
      ]);
    },
  });

  if (!platformSelf?.platformUser) {
    return (
      <Shell>
        <Card className="p-6">
          <h1 className="text-xl font-semibold">Platform Ops</h1>
          <p className="mt-2 text-sm text-muted">You do not have platform access.</p>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Platform Ops</h1>
          <p className="mt-2 text-sm text-muted">Manage tenant domains, platform health posture, and security policies.</p>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Tenant scope</h2>
          <div className="mt-4">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
            >
              <option value="">Select tenant</option>
              {tenants?.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.slug})
                </option>
              ))}
            </select>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Domain management</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input placeholder="church.example.com" value={domain} onChange={(event) => setDomain(event.target.value)} />
            <Input
              placeholder="DNS target (optional)"
              value={dnsTarget}
              onChange={(event) => setDnsTarget(event.target.value)}
            />
          </div>
          <div className="mt-4">
            <Button
              disabled={!tenantId || !domain.trim() || isSavingDomain}
              onClick={() => upsertDomain({ tenantId, domain: domain.trim(), dnsTarget: dnsTarget.trim() || undefined })}
            >
              {isSavingDomain ? 'Saving...' : 'Save domain'}
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {domains?.map((entry) => (
              <div key={entry.id} className="rounded-md border border-border p-3 text-sm">
                <p className="font-semibold">{entry.domain}</p>
                <p className="text-xs text-muted">
                  {entry.status} · SSL {entry.sslStatus}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => verifyDomain({ id: entry.id, activate: true, sslStatus: 'PROVISIONED' })}
                  >
                    Verify + Activate
                  </Button>
                </div>
              </div>
            ))}
            {!domains?.length ? <p className="text-sm text-muted">No domains configured.</p> : null}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Domain + SSL automation</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Automation scan limit"
              type="number"
              value={automationLimit}
              onChange={(event) => setAutomationLimit(event.target.value)}
            />
            <Input
              placeholder="SSL warning days"
              type="number"
              value={sslWarningDays}
              onChange={(event) => setSslWarningDays(event.target.value)}
            />
          </div>
          <p className="mt-3 text-xs text-muted">
            Preview: scanned {domainAutomationPreview?.scanned ?? 0} · updated {domainAutomationPreview?.updated ?? 0} · failed{' '}
            {domainAutomationPreview?.failed ?? 0}
          </p>
          <div className="mt-4">
            <Button
              disabled={!tenantId || isRunningDomainAutomation}
              onClick={() =>
                runDomainAutomation({
                  ...domainAutomationInput,
                  dryRun: false,
                })
              }
            >
              {isRunningDomainAutomation ? 'Running automation...' : 'Run automation'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Health checks</h2>
            <Button disabled={!tenantId || isRunningSweep} onClick={() => runHealthSweep({ tenantId })}>
              {isRunningSweep ? 'Running...' : 'Run health sweep'}
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {healthChecks?.map((entry) => (
              <div key={entry.id} className="rounded-md border border-border p-3 text-xs">
                <p className="font-semibold">
                  {entry.type} · {entry.status}
                </p>
                <p className="text-muted">
                  {new Date(entry.checkedAt).toLocaleString()}
                  {entry.latencyMs !== null ? ` · ${entry.latencyMs}ms` : ''}
                </p>
              </div>
            ))}
            {!healthChecks?.length ? <p className="text-sm text-muted">No health checks yet.</p> : null}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Security policy</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              type="number"
              placeholder="Session timeout (minutes)"
              value={sessionTimeoutMinutes}
              onChange={(event) => setSessionTimeoutMinutes(event.target.value)}
            />
            <Input
              type="number"
              placeholder="Data retention (days)"
              value={dataRetentionDays}
              onChange={(event) => setDataRetentionDays(event.target.value)}
            />
            <Input
              placeholder="Breach contact email"
              value={breachContactEmail}
              onChange={(event) => setBreachContactEmail(event.target.value)}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={requireMfaForStaff}
                onChange={(event) => setRequireMfaForStaff(event.target.checked)}
              />
              Require MFA for staff
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={enforceSso} onChange={(event) => setEnforceSso(event.target.checked)} />
              Enforce SSO
            </label>
          </div>
          <div className="mt-4">
            <Button
              disabled={!tenantId || isUpdatingPolicy}
              onClick={() =>
                updateSecurityPolicy({
                  tenantId,
                  requireMfaForStaff,
                  enforceSso,
                  sessionTimeoutMinutes: Number(sessionTimeoutMinutes || 480),
                  dataRetentionDays: Number(dataRetentionDays || 3650),
                  breachContactEmail: breachContactEmail.trim() || null,
                })
              }
            >
              {isUpdatingPolicy ? 'Saving...' : 'Save security policy'}
            </Button>
          </div>
        </Card>
      </div>
    </Shell>
  );
}
