'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../../components/Shell';
import { PageSectionLayout } from '../../../components/PageSectionLayout';
import { trpc } from '../../../lib/trpc';
import { useWriteAccess } from '../../../lib/entitlements';
import { ReadOnlyNotice } from '../../../components/ReadOnlyNotice';

export default function PlatformOpsPage() {
  const writeGate = useWriteAccess();
  const utils = trpc.useUtils();
  const canWrite = writeGate.canWrite;
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
  const [ipAllowlist, setIpAllowlist] = useState<string[]>([]);
  const [ipInput, setIpInput] = useState('');
  const [automationLimit, setAutomationLimit] = useState('250');
  const [sslWarningDays, setSslWarningDays] = useState('30');
  const [streamingChurchId, setStreamingChurchId] = useState('');
  const [streamingSyncLimit, setStreamingSyncLimit] = useState('200');
  const [applyStreamingTransitions, setApplyStreamingTransitions] = useState(true);
  const [streamingSyncStatus, setStreamingSyncStatus] = useState('');

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
    setIpAllowlist(Array.isArray(securityPolicy.ipAllowlist) ? (securityPolicy.ipAllowlist as string[]) : []);
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
  const streamingSyncInput = {
    tenantId,
    churchId: streamingChurchId.trim() || undefined,
    limit: Number.isFinite(Number(streamingSyncLimit)) ? Number(streamingSyncLimit) : 200,
  };
  const streamingSyncPreview = trpc.tenantOps.streamingSyncPreview.useQuery(streamingSyncInput, {
    enabled: Boolean(tenantId),
  });
  const { mutate: runStreamingSync, isPending: isRunningStreamingSync } = trpc.tenantOps.runStreamingSync.useMutation({
    onSuccess: async (result) => {
      setStreamingSyncStatus(`Synced ${result.scanned} session(s): ${result.updated} updated, ${result.failed} failed.`);
      await Promise.all([
        utils.tenantOps.streamingSyncPreview.invalidate(streamingSyncInput),
        utils.tenantOps.listHealthChecks.invalidate({ tenantId, limit: 20 }),
      ]);
    },
    onError: (error) => setStreamingSyncStatus(error.message),
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
      <PageSectionLayout rootId="platform-ops-page-sections" title="Platform ops sections" className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Platform Ops</h1>
          <p className="mt-2 text-sm text-muted">Manage tenant domains, platform health posture, and security policies.</p>
        </div>

        {writeGate.readOnly ? <ReadOnlyNotice /> : null}

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
              disabled={!canWrite || !tenantId || !domain.trim() || isSavingDomain}
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
                <p className="mt-1 text-xs text-muted">
                  Runbook {entry.runbook.state} · Severity {entry.runbook.severity}
                </p>
                <p className="mt-1 text-xs text-muted">{entry.runbook.recommendedAction}</p>
                {entry.incident ? (
                  <p className="mt-1 text-xs text-amber-700">
                    Incident ticket {entry.incident.id} · {entry.incident.priority} · {entry.incident.status}
                  </p>
                ) : null}
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canWrite}
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
          <p className="mt-1 text-xs text-muted">
            High/critical incidents:{' '}
            {domainAutomationPreview?.updates?.filter((entry) => entry.severity === 'HIGH' || entry.severity === 'CRITICAL').length ?? 0}
          </p>
          <div className="mt-4">
            <Button
              disabled={!canWrite || !tenantId || isRunningDomainAutomation}
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
          <h2 className="text-lg font-semibold">Streaming provider sync</h2>
          <p className="mt-1 text-xs text-muted">
            Preview and run provider reconciliation for live-stream sessions under this tenant.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Optional church ID"
              value={streamingChurchId}
              onChange={(event) => setStreamingChurchId(event.target.value)}
            />
            <Input
              placeholder="Session scan limit"
              type="number"
              value={streamingSyncLimit}
              onChange={(event) => setStreamingSyncLimit(event.target.value)}
            />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={applyStreamingTransitions}
              onChange={(event) => setApplyStreamingTransitions(event.target.checked)}
            />
            Apply suggested SCHEDULED → LIVE transitions
          </label>
          <p className="mt-3 text-xs text-muted">
            Preview: scanned {streamingSyncPreview.data?.scanned ?? 0} · updates {streamingSyncPreview.data?.updated ?? 0} · failed{' '}
            {streamingSyncPreview.data?.failed ?? 0}
          </p>
          {streamingSyncStatus ? <p className="mt-1 text-xs text-muted">{streamingSyncStatus}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!tenantId || streamingSyncPreview.isFetching}
              onClick={() => streamingSyncPreview.refetch()}
            >
              {streamingSyncPreview.isFetching ? 'Refreshing preview...' : 'Refresh preview'}
            </Button>
            <Button
              disabled={!canWrite || !tenantId || isRunningStreamingSync}
              onClick={() =>
                runStreamingSync({
                  ...streamingSyncInput,
                  applySuggestedTransitions: applyStreamingTransitions,
                })
              }
            >
              {isRunningStreamingSync ? 'Running sync...' : 'Run provider sync'}
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {(streamingSyncPreview.data?.entries ?? []).slice(0, 6).map((entry) => (
              <div key={entry.sessionId} className="rounded-md border border-border p-3 text-xs">
                <p className="font-semibold">
                  {entry.provider} · {entry.status}
                </p>
                <p className="text-muted">
                  Playback {entry.playbackReachable ? 'reachable' : 'unreachable'} ({entry.playbackStatusCode ?? 'n/a'})
                </p>
                <p className="text-muted">{entry.recommendedAction}</p>
              </div>
            ))}
            {!streamingSyncPreview.data?.entries?.length ? (
              <p className="text-sm text-muted">No stream sessions found for the current scope.</p>
            ) : null}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Health checks</h2>
            <Button disabled={!canWrite || !tenantId || isRunningSweep} onClick={() => runHealthSweep({ tenantId })}>
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
              Enforce SSO (strict mode requires <code className="text-xs">AUTH_POLICY_ENFORCE_SSO_STRICT=true</code>)
            </label>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium">IP Allowlist</p>
            <p className="mt-0.5 text-xs text-muted">When populated, only requests from these IPs are permitted. Leave empty to allow all IPs.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ipAllowlist.map((ip) => (
                <span key={ip} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2 py-0.5 text-xs">
                  {ip}
                  <button
                    type="button"
                    disabled={!canWrite}
                    className="ml-0.5 text-muted hover:text-foreground disabled:opacity-40"
                    onClick={() => setIpAllowlist((prev) => prev.filter((entry) => entry !== ip))}
                  >
                    ×
                  </button>
                </span>
              ))}
              {!ipAllowlist.length ? <p className="text-xs text-muted">No IPs — all addresses allowed.</p> : null}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="e.g. 203.0.113.5 or 10.0.0.0/24"
                value={ipInput}
                disabled={!canWrite}
                className="max-w-xs"
                onChange={(event) => setIpInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && ipInput.trim() && !ipAllowlist.includes(ipInput.trim())) {
                    setIpAllowlist((prev) => [...prev, ipInput.trim()]);
                    setIpInput('');
                  }
                }}
              />
              <Button
                variant="outline"
                disabled={!canWrite || !ipInput.trim() || ipAllowlist.includes(ipInput.trim())}
                onClick={() => {
                  if (ipInput.trim() && !ipAllowlist.includes(ipInput.trim())) {
                    setIpAllowlist((prev) => [...prev, ipInput.trim()]);
                    setIpInput('');
                  }
                }}
              >
                Add IP
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <Button
              disabled={!canWrite || !tenantId || isUpdatingPolicy}
              onClick={() =>
                updateSecurityPolicy({
                  tenantId,
                  requireMfaForStaff,
                  enforceSso,
                  sessionTimeoutMinutes: Number(sessionTimeoutMinutes || 480),
                  dataRetentionDays: Number(dataRetentionDays || 3650),
                  breachContactEmail: breachContactEmail.trim() || null,
                  ipAllowlist,
                })
              }
            >
              {isUpdatingPolicy ? 'Saving...' : 'Save security policy'}
            </Button>
          </div>
        </Card>
      </PageSectionLayout>
    </Shell>
  );
}
