import { TRPCError } from '@trpc/server';
import crypto from 'crypto';
import {
  AuditActorType,
  HealthCheckStatus,
  HealthCheckType,
  PlatformRole,
  Prisma,
  TenantDomainStatus,
  TenantSslStatus,
  prisma,
} from '@faithflow-ai/database';
import { z } from 'zod';
import { router, userProcedure } from '../trpc';
import { recordAuditLog } from '../audit';
import { runTenantDomainAutomation } from '../tenant-ops-automation';

async function requirePlatformRole(clerkUserId: string, roles: PlatformRole[]) {
  const platformUser = await prisma.platformUser.findFirst({
    where: { clerkUserId },
    include: { roles: true },
  });
  if (!platformUser) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Platform access required' });
  }
  const roleSet = new Set(platformUser.roles.map((entry) => entry.role));
  if (!roles.some((role) => roleSet.has(role))) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Platform role required' });
  }
  return platformUser;
}

function toDomainSlug(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

function randomToken() {
  return crypto.randomBytes(12).toString('hex');
}

export const tenantOpsRouter = router({
  listDomains: userProcedure
    .input(z.object({ tenantId: z.string().optional(), status: z.nativeEnum(TenantDomainStatus).optional() }).optional())
    .query(async ({ input, ctx }) => {
      await requirePlatformRole(ctx.userId!, [
        PlatformRole.SUPER_ADMIN,
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.OPERATIONS_MANAGER,
        PlatformRole.SECURITY_ADMIN,
        PlatformRole.COMPLIANCE_OFFICER,
      ]);

      return prisma.tenantDomain.findMany({
        where: {
          ...(input?.tenantId ? { tenantId: input.tenantId } : {}),
          ...(input?.status ? { status: input.status } : {}),
        },
        include: { tenant: { select: { id: true, name: true, slug: true } } },
        orderBy: [{ createdAt: 'desc' }],
      });
    }),

  upsertDomain: userProcedure
    .input(
      z.object({
        tenantId: z.string(),
        domain: z.string().min(3).max(190),
        dnsTarget: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const actor = await requirePlatformRole(ctx.userId!, [
        PlatformRole.SUPER_ADMIN,
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.OPERATIONS_MANAGER,
      ]);

      const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
      if (!tenant) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant not found' });
      const domain = toDomainSlug(input.domain);

      const created = await prisma.tenantDomain.upsert({
        where: { tenantId_domain: { tenantId: input.tenantId, domain } },
        update: {
          dnsTarget: input.dnsTarget,
          status: TenantDomainStatus.PENDING_VERIFICATION,
          sslStatus: TenantSslStatus.PENDING,
          verificationToken: randomToken(),
        },
        create: {
          tenantId: input.tenantId,
          domain,
          dnsTarget: input.dnsTarget,
          verificationToken: randomToken(),
          status: TenantDomainStatus.PENDING_VERIFICATION,
          sslStatus: TenantSslStatus.PENDING,
        },
      });

      await recordAuditLog({
        tenantId: input.tenantId,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'tenant.domain.upserted',
        targetType: 'TenantDomain',
        targetId: created.id,
        metadata: { domain: created.domain, dnsTarget: created.dnsTarget },
      });

      return created;
    }),

  verifyDomain: userProcedure
    .input(
      z.object({
        id: z.string(),
        activate: z.boolean().default(true),
        sslStatus: z.nativeEnum(TenantSslStatus).default(TenantSslStatus.PROVISIONED),
        sslExpiresAt: z.coerce.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const actor = await requirePlatformRole(ctx.userId!, [
        PlatformRole.SUPER_ADMIN,
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.OPERATIONS_MANAGER,
        PlatformRole.SECURITY_ADMIN,
      ]);

      const domain = await prisma.tenantDomain.findUnique({ where: { id: input.id } });
      if (!domain) throw new TRPCError({ code: 'NOT_FOUND', message: 'Domain not found' });

      const updated = await prisma.tenantDomain.update({
        where: { id: domain.id },
        data: {
          status: input.activate ? TenantDomainStatus.ACTIVE : TenantDomainStatus.VERIFIED,
          verifiedAt: new Date(),
          sslStatus: input.sslStatus,
          sslExpiresAt: input.sslExpiresAt,
          lastCheckedAt: new Date(),
        },
      });

      await recordAuditLog({
        tenantId: updated.tenantId,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'tenant.domain.verified',
        targetType: 'TenantDomain',
        targetId: updated.id,
        metadata: { status: updated.status, sslStatus: updated.sslStatus },
      });

      return updated;
    }),

  domainAutomationPreview: userProcedure
    .input(
      z
        .object({
          tenantId: z.string().optional(),
          limit: z.number().int().min(1).max(1000).default(250),
          sslExpiryWarningDays: z.number().int().min(1).max(180).default(30),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      await requirePlatformRole(ctx.userId!, [
        PlatformRole.SUPER_ADMIN,
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.OPERATIONS_MANAGER,
        PlatformRole.SECURITY_ADMIN,
      ]);
      return runTenantDomainAutomation({
        tenantId: input?.tenantId,
        limit: input?.limit ?? 250,
        sslExpiryWarningDays: input?.sslExpiryWarningDays ?? 30,
        dryRun: true,
      });
    }),

  runDomainAutomation: userProcedure
    .input(
      z
        .object({
          tenantId: z.string().optional(),
          limit: z.number().int().min(1).max(1000).default(250),
          sslExpiryWarningDays: z.number().int().min(1).max(180).default(30),
          dryRun: z.boolean().default(false),
        })
        .optional()
    )
    .mutation(async ({ input, ctx }) => {
      await requirePlatformRole(ctx.userId!, [
        PlatformRole.SUPER_ADMIN,
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.OPERATIONS_MANAGER,
        PlatformRole.SECURITY_ADMIN,
      ]);
      return runTenantDomainAutomation({
        tenantId: input?.tenantId,
        limit: input?.limit ?? 250,
        sslExpiryWarningDays: input?.sslExpiryWarningDays ?? 30,
        dryRun: input?.dryRun ?? false,
      });
    }),

  listHealthChecks: userProcedure
    .input(
      z
        .object({
          tenantId: z.string(),
          type: z.nativeEnum(HealthCheckType).optional(),
          limit: z.number().int().min(1).max(200).default(50),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      await requirePlatformRole(ctx.userId!, [
        PlatformRole.SUPER_ADMIN,
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.OPERATIONS_MANAGER,
        PlatformRole.SECURITY_ADMIN,
        PlatformRole.COMPLIANCE_OFFICER,
        PlatformRole.SUPPORT_MANAGER,
      ]);

      return prisma.tenantHealthCheck.findMany({
        where: {
          ...(input?.tenantId ? { tenantId: input.tenantId } : {}),
          ...(input?.type ? { type: input.type } : {}),
        },
        orderBy: { checkedAt: 'desc' },
        take: input?.limit ?? 50,
      });
    }),

  runHealthSweep: userProcedure
    .input(z.object({ tenantId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const actor = await requirePlatformRole(ctx.userId!, [
        PlatformRole.SUPER_ADMIN,
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.OPERATIONS_MANAGER,
        PlatformRole.SECURITY_ADMIN,
      ]);

      const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
      if (!tenant) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant not found' });

      const startedAt = Date.now();
      let dbStatus: HealthCheckStatus = HealthCheckStatus.HEALTHY;
      let dbLatencyMs = 0;
      try {
        const dbStart = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        dbLatencyMs = Date.now() - dbStart;
      } catch {
        dbStatus = HealthCheckStatus.OUTAGE;
      }

      const checks = [
        {
          type: HealthCheckType.DATABASE,
          status: dbStatus,
          latencyMs: dbLatencyMs,
          details: { query: 'SELECT 1' },
        },
        {
          type: HealthCheckType.EMAIL,
          status: process.env.RESEND_API_KEY ? HealthCheckStatus.HEALTHY : HealthCheckStatus.DEGRADED,
          latencyMs: null,
          details: { configured: Boolean(process.env.RESEND_API_KEY) },
        },
        {
          type: HealthCheckType.SMS,
          status:
            process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
              ? HealthCheckStatus.HEALTHY
              : HealthCheckStatus.DEGRADED,
          latencyMs: null,
          details: {
            configured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
          },
        },
        {
          type: HealthCheckType.WEBHOOK,
          status:
            process.env.STRIPE_WEBHOOK_SECRET || process.env.PAYSTACK_WEBHOOK_SECRET
              ? HealthCheckStatus.HEALTHY
              : HealthCheckStatus.DEGRADED,
          latencyMs: null,
          details: {
            stripe: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
            paystack: Boolean(process.env.PAYSTACK_WEBHOOK_SECRET),
          },
        },
        {
          type: HealthCheckType.STORAGE,
          status: process.env.STORAGE_PROVIDER ? HealthCheckStatus.HEALTHY : HealthCheckStatus.DEGRADED,
          latencyMs: null,
          details: { provider: process.env.STORAGE_PROVIDER ?? null },
        },
      ] as const;

      await prisma.tenantHealthCheck.createMany({
        data: checks.map((check) => ({
          tenantId: input.tenantId,
          type: check.type,
          status: check.status,
          latencyMs: check.latencyMs ?? undefined,
          details: check.details as Prisma.InputJsonValue,
        })),
      });

      await recordAuditLog({
        tenantId: input.tenantId,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'tenant.health.sweep_ran',
        targetType: 'Tenant',
        targetId: tenant.id,
        metadata: {
          checks: checks.length,
          durationMs: Date.now() - startedAt,
        },
      });

      return {
        tenantId: input.tenantId,
        checks: checks.length,
        durationMs: Date.now() - startedAt,
      };
    }),

  securityPolicy: userProcedure
    .input(z.object({ tenantId: z.string() }))
    .query(async ({ input, ctx }) => {
      await requirePlatformRole(ctx.userId!, [
        PlatformRole.SUPER_ADMIN,
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.SECURITY_ADMIN,
        PlatformRole.COMPLIANCE_OFFICER,
      ]);

      const existing = await prisma.tenantSecurityPolicy.findUnique({
        where: { tenantId: input.tenantId },
      });
      if (existing) return existing;

      return prisma.tenantSecurityPolicy.create({
        data: {
          tenantId: input.tenantId,
          requireMfaForStaff: true,
          enforceSso: false,
          sessionTimeoutMinutes: 480,
          dataRetentionDays: 3650,
        },
      });
    }),

  updateSecurityPolicy: userProcedure
    .input(
      z.object({
        tenantId: z.string(),
        requireMfaForStaff: z.boolean().optional(),
        enforceSso: z.boolean().optional(),
        sessionTimeoutMinutes: z.number().int().min(15).max(1440).optional(),
        dataRetentionDays: z.number().int().min(30).max(3650).optional(),
        ipAllowlist: z.array(z.string()).optional(),
        breachContactEmail: z.string().email().optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const actor = await requirePlatformRole(ctx.userId!, [
        PlatformRole.SUPER_ADMIN,
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.SECURITY_ADMIN,
        PlatformRole.COMPLIANCE_OFFICER,
      ]);

      const policy = await prisma.tenantSecurityPolicy.upsert({
        where: { tenantId: input.tenantId },
        update: {
          ...(input.requireMfaForStaff !== undefined ? { requireMfaForStaff: input.requireMfaForStaff } : {}),
          ...(input.enforceSso !== undefined ? { enforceSso: input.enforceSso } : {}),
          ...(input.sessionTimeoutMinutes !== undefined ? { sessionTimeoutMinutes: input.sessionTimeoutMinutes } : {}),
          ...(input.dataRetentionDays !== undefined ? { dataRetentionDays: input.dataRetentionDays } : {}),
          ...(input.ipAllowlist !== undefined
            ? {
                ipAllowlist: input.ipAllowlist.length
                  ? (input.ipAllowlist as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
              }
            : {}),
          ...(input.breachContactEmail !== undefined ? { breachContactEmail: input.breachContactEmail } : {}),
          updatedBy: actor.id,
        },
        create: {
          tenantId: input.tenantId,
          requireMfaForStaff: input.requireMfaForStaff ?? true,
          enforceSso: input.enforceSso ?? false,
          sessionTimeoutMinutes: input.sessionTimeoutMinutes ?? 480,
          dataRetentionDays: input.dataRetentionDays ?? 3650,
          ipAllowlist: input.ipAllowlist?.length
            ? (input.ipAllowlist as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          breachContactEmail: input.breachContactEmail ?? null,
          updatedBy: actor.id,
        },
      });

      await recordAuditLog({
        tenantId: input.tenantId,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'tenant.security_policy.updated',
        targetType: 'TenantSecurityPolicy',
        targetId: policy.id,
      });

      return policy;
    }),
});
