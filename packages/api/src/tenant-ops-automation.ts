import dns from 'node:dns/promises';
import {
  AuditActorType,
  HealthCheckStatus,
  HealthCheckType,
  Prisma,
  TenantDomainStatus,
  TenantSslStatus,
  prisma,
} from '@faithflow-ai/database';
import { recordAuditLog } from './audit';

function normalizeHost(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, '');
}

async function resolveDnsRecords(domain: string) {
  let cname: string[] = [];
  let a: string[] = [];

  try {
    cname = (await dns.resolveCname(domain)).map((entry) => normalizeHost(entry));
  } catch {
    cname = [];
  }

  try {
    a = await dns.resolve4(domain);
  } catch {
    a = [];
  }

  return { cname, a };
}

type DomainAutomationResult = {
  domainId: string;
  tenantId: string;
  domain: string;
  dnsVerified: boolean;
  previousStatus: TenantDomainStatus;
  nextStatus: TenantDomainStatus;
  previousSslStatus: TenantSslStatus;
  nextSslStatus: TenantSslStatus;
};

function determineSslStatus(input: {
  current: TenantSslStatus;
  dnsVerified: boolean;
  sslExpiresAt?: Date | null;
  warningDate: Date;
  now: Date;
}) {
  if (!input.dnsVerified) {
    return input.current === TenantSslStatus.PROVISIONED ? TenantSslStatus.FAILED : TenantSslStatus.PENDING;
  }
  if (!input.sslExpiresAt) {
    return input.current === TenantSslStatus.FAILED ? TenantSslStatus.PENDING : TenantSslStatus.PROVISIONED;
  }
  if (input.sslExpiresAt <= input.now) return TenantSslStatus.EXPIRED;
  if (input.sslExpiresAt <= input.warningDate) return TenantSslStatus.EXPIRING_SOON;
  return TenantSslStatus.PROVISIONED;
}

function determineDomainStatus(input: {
  current: TenantDomainStatus;
  dnsVerified: boolean;
  nextSslStatus: TenantSslStatus;
}) {
  if (!input.dnsVerified) return TenantDomainStatus.PENDING_VERIFICATION;
  if (input.nextSslStatus === TenantSslStatus.EXPIRED || input.nextSslStatus === TenantSslStatus.FAILED) {
    return TenantDomainStatus.VERIFIED;
  }
  return TenantDomainStatus.ACTIVE;
}

export async function runTenantDomainAutomation(options?: {
  tenantId?: string;
  limit?: number;
  sslExpiryWarningDays?: number;
  dryRun?: boolean;
}) {
  const now = new Date();
  const warningDays = options?.sslExpiryWarningDays ?? 30;
  const warningDate = new Date(now.getTime() + warningDays * 24 * 60 * 60 * 1000);
  const domains = await prisma.tenantDomain.findMany({
    where: {
      ...(options?.tenantId ? { tenantId: options.tenantId } : {}),
      status: { in: [TenantDomainStatus.PENDING_VERIFICATION, TenantDomainStatus.VERIFIED, TenantDomainStatus.ACTIVE] },
    },
    orderBy: { createdAt: 'asc' },
    take: options?.limit ?? 250,
  });

  const updates: DomainAutomationResult[] = [];
  const errors: Array<{ domainId: string; domain: string; error: string }> = [];

  for (const domain of domains) {
    try {
      const records = await resolveDnsRecords(domain.domain);
      const normalizedTarget = domain.dnsTarget ? normalizeHost(domain.dnsTarget) : null;
      const dnsVerified = normalizedTarget ? records.cname.includes(normalizedTarget) : records.cname.length > 0 || records.a.length > 0;

      const nextSslStatus = determineSslStatus({
        current: domain.sslStatus,
        dnsVerified,
        sslExpiresAt: domain.sslExpiresAt,
        warningDate,
        now,
      });
      const nextStatus = determineDomainStatus({
        current: domain.status,
        dnsVerified,
        nextSslStatus,
      });

      if (!options?.dryRun) {
        await prisma.tenantDomain.update({
          where: { id: domain.id },
          data: {
            status: nextStatus,
            sslStatus: nextSslStatus,
            lastCheckedAt: now,
            ...(dnsVerified && !domain.verifiedAt ? { verifiedAt: now } : {}),
            notes: `dns:${dnsVerified ? 'verified' : 'unverified'} cname:${records.cname.join('|') || '-'} a:${
              records.a.join('|') || '-'
            }`,
          },
        });

        await prisma.tenantHealthCheck.create({
          data: {
            tenantId: domain.tenantId,
            type: HealthCheckType.API,
            status:
              nextStatus === TenantDomainStatus.ACTIVE && nextSslStatus === TenantSslStatus.PROVISIONED
                ? HealthCheckStatus.HEALTHY
                : nextStatus === TenantDomainStatus.PENDING_VERIFICATION
                  ? HealthCheckStatus.DEGRADED
                  : HealthCheckStatus.OUTAGE,
            details: {
              domainId: domain.id,
              domain: domain.domain,
              dnsVerified,
              dnsTarget: domain.dnsTarget ?? null,
              cname: records.cname,
              a: records.a,
              status: nextStatus,
              sslStatus: nextSslStatus,
            } as Prisma.InputJsonValue,
          },
        });
      }

      if (!options?.dryRun && (domain.status !== nextStatus || domain.sslStatus !== nextSslStatus)) {
        await recordAuditLog({
          tenantId: domain.tenantId,
          actorType: AuditActorType.SYSTEM,
          action: 'tenant.domain.automation_updated',
          targetType: 'TenantDomain',
          targetId: domain.id,
          metadata: {
            domain: domain.domain,
            previousStatus: domain.status,
            nextStatus,
            previousSslStatus: domain.sslStatus,
            nextSslStatus,
            dnsVerified,
          },
        });
      }

      updates.push({
        domainId: domain.id,
        tenantId: domain.tenantId,
        domain: domain.domain,
        dnsVerified,
        previousStatus: domain.status,
        nextStatus,
        previousSslStatus: domain.sslStatus,
        nextSslStatus,
      });
    } catch (error) {
      errors.push({
        domainId: domain.id,
        domain: domain.domain,
        error: error instanceof Error ? error.message : 'Domain automation failed',
      });
    }
  }

  return {
    scanned: domains.length,
    updated: updates.filter((entry) => entry.previousStatus !== entry.nextStatus || entry.previousSslStatus !== entry.nextSslStatus)
      .length,
    unchanged: updates.filter((entry) => entry.previousStatus === entry.nextStatus && entry.previousSslStatus === entry.nextSslStatus)
      .length,
    failed: errors.length,
    updates,
    errors,
    dryRun: Boolean(options?.dryRun),
  };
}
