import dns from 'node:dns/promises';
import {
  AuditActorType,
  HealthCheckStatus,
  HealthCheckType,
  Prisma,
  SupportMessageAuthorType,
  SupportTicketPriority,
  SupportTicketSource,
  SupportTicketStatus,
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
  runbookState: DomainRunbookState;
  severity: DomainIncidentSeverity;
  recommendedAction: string;
  escalationTicketId: string | null;
};

export type DomainRunbookState =
  | 'HEALTHY'
  | 'VERIFY_DNS'
  | 'PROVISION_SSL'
  | 'RENEW_SSL'
  | 'INVESTIGATE_FAILURE'
  | 'ESCALATED';

export type DomainIncidentSeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

type DerivedRunbook = {
  state: DomainRunbookState;
  severity: DomainIncidentSeverity;
  recommendedAction: string;
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

function autoEscalationHoursThreshold() {
  const raw = Number.parseInt(process.env.DOMAIN_PENDING_ESCALATION_HOURS ?? '24', 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : 24;
}

export function deriveDomainRunbookState(input: {
  status: TenantDomainStatus;
  sslStatus: TenantSslStatus;
  lastCheckedAt?: Date | null;
  createdAt?: Date | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const baseline = input.lastCheckedAt ?? input.createdAt ?? now;
  const ageHours = (now.getTime() - baseline.getTime()) / (1000 * 60 * 60);
  const pendingThresholdHours = autoEscalationHoursThreshold();

  if (input.sslStatus === TenantSslStatus.FAILED) {
    return {
      state: 'INVESTIGATE_FAILURE',
      severity: 'CRITICAL',
      recommendedAction: 'Inspect DNS target and certificate provisioning logs, then re-run domain automation.',
    } satisfies DerivedRunbook;
  }
  if (input.sslStatus === TenantSslStatus.EXPIRED) {
    return {
      state: 'RENEW_SSL',
      severity: 'CRITICAL',
      recommendedAction: 'Renew or reprovision SSL certificate immediately to restore secure access.',
    } satisfies DerivedRunbook;
  }
  if (input.sslStatus === TenantSslStatus.EXPIRING_SOON) {
    return {
      state: 'RENEW_SSL',
      severity: 'HIGH',
      recommendedAction: 'Renew SSL certificate before expiry and verify certificate deployment.',
    } satisfies DerivedRunbook;
  }
  if (input.status === TenantDomainStatus.PENDING_VERIFICATION) {
    if (ageHours >= pendingThresholdHours) {
      return {
        state: 'ESCALATED',
        severity: 'HIGH',
        recommendedAction: 'DNS verification has been pending too long. Escalate to ops and registrar/DNS provider.',
      } satisfies DerivedRunbook;
    }
    return {
      state: 'VERIFY_DNS',
      severity: 'MEDIUM',
      recommendedAction: 'Complete DNS verification by pointing CNAME/A records to the configured target.',
    } satisfies DerivedRunbook;
  }
  if (input.status === TenantDomainStatus.VERIFIED && input.sslStatus !== TenantSslStatus.PROVISIONED) {
    return {
      state: 'PROVISION_SSL',
      severity: 'HIGH',
      recommendedAction: 'DNS is verified but SSL is not fully provisioned. Trigger certificate provisioning.',
    } satisfies DerivedRunbook;
  }
  if (input.status === TenantDomainStatus.FAILED) {
    return {
      state: 'INVESTIGATE_FAILURE',
      severity: 'CRITICAL',
      recommendedAction: 'Domain failed verification. Validate ownership and DNS propagation, then retry.',
    } satisfies DerivedRunbook;
  }
  if (input.status === TenantDomainStatus.ACTIVE && input.sslStatus === TenantSslStatus.PROVISIONED) {
    return {
      state: 'HEALTHY',
      severity: 'NONE',
      recommendedAction: 'No action required.',
    } satisfies DerivedRunbook;
  }
  return {
    state: 'VERIFY_DNS',
    severity: 'LOW',
    recommendedAction: 'Review domain configuration and run verification checks.',
  } satisfies DerivedRunbook;
}

function domainTicketMarker(domainId: string) {
  return `[domain:${domainId}]`;
}

function buildIncidentTicketPayload(input: {
  domainId: string;
  domain: string;
  runbook: DerivedRunbook;
  dnsVerified: boolean;
  nextStatus: TenantDomainStatus;
  nextSslStatus: TenantSslStatus;
  dnsTarget?: string | null;
}) {
  const marker = domainTicketMarker(input.domainId);
  const subject = `Domain incident: ${input.domain} ${marker}`;
  const description = [
    `Runbook state: ${input.runbook.state}`,
    `Severity: ${input.runbook.severity}`,
    `Domain status: ${input.nextStatus}`,
    `SSL status: ${input.nextSslStatus}`,
    `DNS verified: ${input.dnsVerified ? 'yes' : 'no'}`,
    `DNS target: ${input.dnsTarget ?? '-'}`,
    '',
    `Recommended action: ${input.runbook.recommendedAction}`,
  ].join('\n');
  return { marker, subject, description };
}

async function ensureDomainIncidentTicket(input: {
  tenantId: string;
  domainId: string;
  domain: string;
  runbook: DerivedRunbook;
  dnsVerified: boolean;
  nextStatus: TenantDomainStatus;
  nextSslStatus: TenantSslStatus;
  dnsTarget?: string | null;
}) {
  const shouldEscalate = input.runbook.severity === 'HIGH' || input.runbook.severity === 'CRITICAL';
  const marker = domainTicketMarker(input.domainId);

  const openTicket = await prisma.supportTicket.findFirst({
    where: {
      tenantId: input.tenantId,
      subject: { contains: marker },
      status: { in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS, SupportTicketStatus.WAITING_CUSTOMER] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!shouldEscalate) {
    if (openTicket && process.env.DOMAIN_INCIDENT_AUTO_CLOSE !== 'false') {
      await prisma.supportTicket.update({
        where: { id: openTicket.id },
        data: {
          status: SupportTicketStatus.RESOLVED,
          resolvedAt: new Date(),
        },
      });
      await prisma.supportTicketMessage.create({
        data: {
          ticketId: openTicket.id,
          authorType: SupportMessageAuthorType.SYSTEM,
          body: `Domain incident auto-resolved after health recovery. Current runbook state: ${input.runbook.state}.`,
          isInternal: true,
        },
      });
    }
    return null;
  }

  const ticketPriority =
    input.runbook.severity === 'CRITICAL' ? SupportTicketPriority.URGENT : SupportTicketPriority.HIGH;
  const payload = buildIncidentTicketPayload(input);

  if (openTicket) {
    const updated = await prisma.supportTicket.update({
      where: { id: openTicket.id },
      data: {
        priority: ticketPriority,
        description: payload.description,
      },
    });
    await prisma.supportTicketMessage.create({
      data: {
        ticketId: updated.id,
        authorType: SupportMessageAuthorType.SYSTEM,
        body: `Domain incident still active. Runbook state: ${input.runbook.state}; SSL: ${input.nextSslStatus}; status: ${input.nextStatus}.`,
        isInternal: true,
      },
    });
    return updated.id;
  }

  const created = await prisma.supportTicket.create({
    data: {
      tenantId: input.tenantId,
      subject: payload.subject,
      description: payload.description,
      priority: ticketPriority,
      source: SupportTicketSource.IN_APP,
      status: SupportTicketStatus.OPEN,
    },
  });
  await prisma.supportTicketMessage.create({
    data: {
      ticketId: created.id,
      authorType: SupportMessageAuthorType.SYSTEM,
      body: `Domain incident escalated automatically. Runbook state: ${input.runbook.state}.`,
      isInternal: true,
    },
  });
  return created.id;
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
      const runbook = deriveDomainRunbookState({
        status: nextStatus,
        sslStatus: nextSslStatus,
        lastCheckedAt: domain.lastCheckedAt,
        createdAt: domain.createdAt,
        now,
      });
      let escalationTicketId: string | null = null;

      if (!options?.dryRun) {
        escalationTicketId = await ensureDomainIncidentTicket({
          tenantId: domain.tenantId,
          domainId: domain.id,
          domain: domain.domain,
          runbook,
          dnsVerified,
          nextStatus,
          nextSslStatus,
          dnsTarget: domain.dnsTarget,
        });

        await prisma.tenantDomain.update({
          where: { id: domain.id },
          data: {
            status: nextStatus,
            sslStatus: nextSslStatus,
            lastCheckedAt: now,
            ...(dnsVerified && !domain.verifiedAt ? { verifiedAt: now } : {}),
            notes: `dns:${dnsVerified ? 'verified' : 'unverified'} cname:${records.cname.join('|') || '-'} a:${
              records.a.join('|') || '-'
            } runbook:${runbook.state} severity:${runbook.severity} ticket:${escalationTicketId ?? '-'}`,
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
              runbookState: runbook.state,
              incidentSeverity: runbook.severity,
              recommendedAction: runbook.recommendedAction,
              escalationTicketId,
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
            runbookState: runbook.state,
            incidentSeverity: runbook.severity,
            escalationTicketId,
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
        runbookState: runbook.state,
        severity: runbook.severity,
        recommendedAction: runbook.recommendedAction,
        escalationTicketId,
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
