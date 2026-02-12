import { TRPCError } from '@trpc/server';
import { createClerkClient } from '@clerk/backend';
import {
  prisma,
  Prisma,
  AuditActorType,
  BillingInterval,
  PlatformRole,
  PlatformUserStatus,
  SubscriptionProvider,
  TenantStatus,
  TenantSubscriptionStatus,
} from '@faithflow-ai/database';
import { z } from 'zod';
import { recordAuditLog } from '../audit';
import { router, userProcedure } from '../trpc';
import { getTenantUsageSnapshot } from '../entitlements';
import { runSubscriptionAutomation } from '../subscription-automation';
import { runSubscriptionDunning } from '../billing-dunning';
import { runSubscriptionMetadataBackfill } from '../subscription-metadata-backfill';

const clerk = process.env.CLERK_SECRET_KEY ? createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }) : null;

const activeSubscriptionStatuses = [
  TenantSubscriptionStatus.TRIALING,
  TenantSubscriptionStatus.ACTIVE,
  TenantSubscriptionStatus.PAST_DUE,
  TenantSubscriptionStatus.PAUSED,
] as const;

const tenantListInput = z.object({
  query: z.string().trim().max(120).optional(),
  status: z.nativeEnum(TenantStatus).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

const tenantAuditInput = z.object({
  tenantId: z.string(),
  limit: z.number().int().min(1).max(200).default(50),
});

const planFeatureInput = z.object({
  key: z.string().trim().min(2).max(100),
  enabled: z.boolean().default(true),
  limit: z.number().int().nonnegative().nullable().optional(),
});

const upsertPlanInput = z.object({
  id: z.string().optional(),
  code: z.string().trim().min(2).max(64).regex(/^[a-z0-9_-]+$/),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  currency: z.string().trim().toUpperCase().length(3).default('USD'),
  interval: z.nativeEnum(BillingInterval).default(BillingInterval.MONTHLY),
  amountMinor: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).optional(),
  features: z.array(planFeatureInput).default([]),
});

const assignTenantPlanInput = z
  .object({
    tenantId: z.string(),
    planId: z.string().optional(),
    planCode: z.string().trim().min(2).max(64).optional(),
    status: z.nativeEnum(TenantSubscriptionStatus).default(TenantSubscriptionStatus.ACTIVE),
    provider: z.nativeEnum(SubscriptionProvider).default(SubscriptionProvider.MANUAL),
    providerRef: z.string().trim().max(191).optional(),
    startsAt: z.coerce.date().optional(),
    currentPeriodStart: z.coerce.date().optional(),
    currentPeriodEnd: z.coerce.date().optional(),
    trialEndsAt: z.coerce.date().optional(),
    cancelAtPeriodEnd: z.boolean().default(false),
    seatCount: z.number().int().positive().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((input) => Boolean(input.planId || input.planCode), {
    message: 'Provide either planId or planCode',
    path: ['planId'],
  });

const parseAllowlist = () => {
  const raw = process.env.PLATFORM_ADMIN_EMAILS ?? '';
  return raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
};

const getUserEmail = async (clerkUserId: string) => {
  if (!clerk) return null;
  const user = await clerk.users.getUser(clerkUserId);
  const primary = user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId);
  return primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
};

const loadPlatformUser = async (clerkUserId: string) => {
  return prisma.platformUser.findFirst({
    where: { clerkUserId },
    include: { roles: true },
  });
};

const ensurePlatformRole = async (platformUserId: string, role: PlatformRole) => {
  return prisma.platformUserRole.upsert({
    where: { platformUserId_role: { platformUserId, role } },
    update: {},
    create: { platformUserId, role },
  });
};

const requirePlatformRole = async (clerkUserId: string, roles: PlatformRole[]) => {
  const platformUser = await loadPlatformUser(clerkUserId);
  if (!platformUser) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Platform access required' });
  }
  const roleSet = new Set(platformUser.roles.map((entry) => entry.role));
  if (!roles.some((role) => roleSet.has(role))) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Platform role required' });
  }
  return platformUser;
};

const resolvePlan = async (input: { planId?: string; planCode?: string }) => {
  if (input.planId) {
    const byId = await prisma.subscriptionPlan.findUnique({
      where: { id: input.planId },
      include: { features: { orderBy: { key: 'asc' } } },
    });
    if (byId) return byId;
  }
  if (input.planCode) {
    const byCode = await prisma.subscriptionPlan.findUnique({
      where: { code: input.planCode },
      include: { features: { orderBy: { key: 'asc' } } },
    });
    if (byCode) return byCode;
  }
  return null;
};

export const platformRouter = router({
  self: userProcedure.query(async ({ ctx }) => {
    const platformUser = await loadPlatformUser(ctx.userId!);
    const allowlist = parseAllowlist();
    const email = platformUser?.email ?? (await getUserEmail(ctx.userId!));
    const invitedUser = email ? await prisma.platformUser.findUnique({ where: { email: email.toLowerCase() } }) : null;
    const platformUserCount = await prisma.platformUser.count();
    const isAllowlisted = Boolean(email && allowlist.includes(email.toLowerCase()));
    const canFirstUserBootstrap = Boolean(email && allowlist.length === 0 && platformUserCount === 0);
    const bootstrapAllowed = isAllowlisted || canFirstUserBootstrap || Boolean(invitedUser);
    if (platformUser) {
      await prisma.platformUser.update({
        where: { id: platformUser.id },
        data: { lastAccessAt: new Date() },
      });
    }
    return {
      platformUser,
      roles: platformUser?.roles.map((entry) => entry.role) ?? [],
      bootstrapAllowed,
      email,
    };
  }),

  bootstrap: userProcedure
    .input(z.object({ email: z.string().email().optional() }))
    .mutation(async ({ input, ctx }) => {
      const allowlist = parseAllowlist();
      const email = (input.email ?? (await getUserEmail(ctx.userId!)))?.toLowerCase();
      const existingByEmail = email
        ? await prisma.platformUser.findUnique({ where: { email }, include: { roles: true } })
        : null;
      const platformUserCount = await prisma.platformUser.count();
      const isAllowlisted = Boolean(email && allowlist.includes(email));
      const canFirstUserBootstrap = Boolean(email && allowlist.length === 0 && platformUserCount === 0);
      const canClaimByInvite = Boolean(existingByEmail);

      if (!email || (!isAllowlisted && !canFirstUserBootstrap && !canClaimByInvite)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not allowed to bootstrap platform access' });
      }

      let platformUser = existingByEmail;

      if (!platformUser) {
        platformUser = await prisma.platformUser.create({
          data: {
            clerkUserId: ctx.userId!,
            email,
            name: email.split('@')[0],
            status: PlatformUserStatus.ACTIVE,
          },
          include: { roles: true },
        });
      } else if (!platformUser.clerkUserId) {
        platformUser = await prisma.platformUser.update({
          where: { id: platformUser.id },
          data: { clerkUserId: ctx.userId! },
          include: { roles: true },
        });
      }

      await ensurePlatformRole(platformUser.id, PlatformRole.SUPER_ADMIN);

      const updated = await prisma.platformUser.findUnique({
        where: { id: platformUser.id },
        include: { roles: true },
      });

      return {
        platformUser: updated,
        roles: updated?.roles.map((entry) => entry.role) ?? [],
      };
    }),

  listUsers: userProcedure.query(async ({ ctx }) => {
    await requirePlatformRole(ctx.userId!, [PlatformRole.SUPER_ADMIN, PlatformRole.PLATFORM_ADMIN]);
    return prisma.platformUser.findMany({
      include: { roles: true },
      orderBy: { createdAt: 'desc' },
    });
  }),

  assignRole: userProcedure
    .input(z.object({ email: z.string().email(), role: z.nativeEnum(PlatformRole) }))
    .mutation(async ({ input, ctx }) => {
      await requirePlatformRole(ctx.userId!, [PlatformRole.SUPER_ADMIN]);
      const email = input.email.toLowerCase();
      let platformUser = await prisma.platformUser.findUnique({ where: { email }, include: { roles: true } });
      if (!platformUser) {
        platformUser = await prisma.platformUser.create({
          data: { email, name: email.split('@')[0], status: PlatformUserStatus.ACTIVE },
          include: { roles: true },
        });
      }
      await ensurePlatformRole(platformUser.id, input.role);
      return prisma.platformUser.findUnique({ where: { id: platformUser.id }, include: { roles: true } });
    }),

  removeRole: userProcedure
    .input(z.object({ platformUserId: z.string(), role: z.nativeEnum(PlatformRole) }))
    .mutation(async ({ input, ctx }) => {
      await requirePlatformRole(ctx.userId!, [PlatformRole.SUPER_ADMIN]);
      const entry = await prisma.platformUserRole.findFirst({
        where: { platformUserId: input.platformUserId, role: input.role },
      });
      if (!entry) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Role not found' });
      }
      await prisma.platformUserRole.delete({ where: { id: entry.id } });
      return { removed: true };
    }),

  listPlans: userProcedure
    .input(z.object({ includeInactive: z.boolean().default(true) }).optional())
    .query(async ({ input, ctx }) => {
      await requirePlatformRole(ctx.userId!, [
        PlatformRole.SUPER_ADMIN,
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.BILLING_ADMIN,
        PlatformRole.OPERATIONS_MANAGER,
      ]);

      return prisma.subscriptionPlan.findMany({
        where: input?.includeInactive ? undefined : { isActive: true },
        include: {
          features: { orderBy: { key: 'asc' } },
          _count: { select: { tenantSubscriptions: true } },
        },
        orderBy: [{ isDefault: 'desc' }, { amountMinor: 'asc' }, { createdAt: 'asc' }],
      });
    }),

  upsertPlan: userProcedure.input(upsertPlanInput).mutation(async ({ input, ctx }) => {
    await requirePlatformRole(ctx.userId!, [
      PlatformRole.SUPER_ADMIN,
      PlatformRole.PLATFORM_ADMIN,
      PlatformRole.BILLING_ADMIN,
    ]);

    const normalizedFeatures = Array.from(
      input.features.reduce<Map<string, { key: string; enabled: boolean; limit: number | null }>>((map, feature) => {
        map.set(feature.key, {
          key: feature.key,
          enabled: feature.enabled,
          limit: feature.limit ?? null,
        });
        return map;
      }, new Map()).values()
    );

    const plan = await prisma.$transaction(async (tx) => {
      const existingByCode = await tx.subscriptionPlan.findUnique({ where: { code: input.code } });

      const nextPlan =
        input.id || existingByCode
          ? await tx.subscriptionPlan.update({
              where: { id: input.id ?? existingByCode!.id },
              data: {
                code: input.code,
                name: input.name,
                description: input.description,
                currency: input.currency,
                interval: input.interval,
                amountMinor: input.amountMinor,
                isActive: input.isActive,
                isDefault: input.isDefault,
                metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
              },
            })
          : await tx.subscriptionPlan.create({
              data: {
                code: input.code,
                name: input.name,
                description: input.description,
                currency: input.currency,
                interval: input.interval,
                amountMinor: input.amountMinor,
                isActive: input.isActive,
                isDefault: input.isDefault,
                metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
              },
            });

      if (input.isDefault) {
        await tx.subscriptionPlan.updateMany({
          where: { id: { not: nextPlan.id } },
          data: { isDefault: false },
        });
      }

      await tx.subscriptionPlanFeature.deleteMany({ where: { planId: nextPlan.id } });
      if (normalizedFeatures.length) {
        await tx.subscriptionPlanFeature.createMany({
          data: normalizedFeatures.map((feature) => ({
            planId: nextPlan.id,
            key: feature.key,
            enabled: feature.enabled,
            limit: feature.limit,
          })),
        });
      }

      return tx.subscriptionPlan.findUnique({
        where: { id: nextPlan.id },
        include: { features: { orderBy: { key: 'asc' } } },
      });
    });

    return plan;
  }),

  assignTenantPlan: userProcedure.input(assignTenantPlanInput).mutation(async ({ input, ctx }) => {
    const actor = await requirePlatformRole(ctx.userId!, [
      PlatformRole.SUPER_ADMIN,
      PlatformRole.PLATFORM_ADMIN,
      PlatformRole.BILLING_ADMIN,
      PlatformRole.OPERATIONS_MANAGER,
    ]);

    const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
    if (!tenant) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant not found' });
    }

    const plan = await resolvePlan({ planId: input.planId, planCode: input.planCode });
    if (!plan) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found' });
    }
    if (!plan.isActive) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Plan is inactive' });
    }

    const previous = await prisma.tenantSubscription.findFirst({
      where: {
        tenantId: tenant.id,
        status: { in: activeSubscriptionStatuses as unknown as TenantSubscriptionStatus[] },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    const startsAt = input.startsAt ?? new Date();
    const subscription = await prisma.$transaction(async (tx) => {
      if (previous) {
        await tx.tenantSubscription.update({
          where: { id: previous.id },
          data: {
            status: TenantSubscriptionStatus.CANCELED,
            canceledAt: new Date(),
            cancelAtPeriodEnd: false,
          },
        });
      }

      const created = await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: input.status,
          provider: input.provider,
          providerRef: input.providerRef,
          startsAt,
          currentPeriodStart: input.currentPeriodStart ?? startsAt,
          currentPeriodEnd: input.currentPeriodEnd,
          trialEndsAt: input.trialEndsAt,
          canceledAt: input.status === TenantSubscriptionStatus.CANCELED ? new Date() : null,
          cancelAtPeriodEnd: input.cancelAtPeriodEnd,
          seatCount: input.seatCount,
          metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          createdByPlatformUserId: actor.id,
        },
      });

      return tx.tenantSubscription.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          plan: { include: { features: { orderBy: { key: 'asc' } } } },
        },
      });
    });

    await recordAuditLog({
      tenantId: tenant.id,
      actorType: AuditActorType.USER,
      actorId: actor.id,
      action: 'platform.tenant.plan_assigned',
      targetType: 'TenantSubscription',
      targetId: subscription.id,
      metadata: {
        previousSubscriptionId: previous?.id ?? null,
        previousPlanCode: previous?.plan.code ?? null,
        nextPlanCode: subscription.plan.code,
        status: subscription.status,
        provider: subscription.provider,
        reason: input.reason ?? null,
      },
    });

    return subscription;
  }),

  tenantSubscription: userProcedure
    .input(z.object({ tenantId: z.string() }))
    .query(async ({ input, ctx }) => {
      await requirePlatformRole(ctx.userId!, [
        PlatformRole.SUPER_ADMIN,
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.BILLING_ADMIN,
        PlatformRole.OPERATIONS_MANAGER,
        PlatformRole.SUPPORT_MANAGER,
        PlatformRole.SUPPORT_AGENT,
      ]);

      return prisma.tenantSubscription.findFirst({
        where: { tenantId: input.tenantId },
        include: {
          plan: { include: { features: { orderBy: { key: 'asc' } } } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  tenantEntitlements: userProcedure
    .input(z.object({ tenantId: z.string() }))
    .query(async ({ input, ctx }) => {
      await requirePlatformRole(ctx.userId!, [
        PlatformRole.SUPER_ADMIN,
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.BILLING_ADMIN,
        PlatformRole.OPERATIONS_MANAGER,
        PlatformRole.SUPPORT_MANAGER,
        PlatformRole.SUPPORT_AGENT,
      ]);

      const subscription = await prisma.tenantSubscription.findFirst({
        where: {
          tenantId: input.tenantId,
          status: { in: activeSubscriptionStatuses as unknown as TenantSubscriptionStatus[] },
        },
        include: {
          plan: { include: { features: { orderBy: { key: 'asc' } } } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const defaultPlan = !subscription
        ? await prisma.subscriptionPlan.findFirst({
            where: { isDefault: true, isActive: true },
            include: { features: { orderBy: { key: 'asc' } } },
          })
        : null;

      const sourcePlan = subscription?.plan ?? defaultPlan;
      if (!sourcePlan) {
        return {
          tenantId: input.tenantId,
          source: 'none' as const,
          plan: null,
          entitlements: {},
        };
      }

      const entitlements = Object.fromEntries(
        sourcePlan.features.map((feature: { key: string; enabled: boolean; limit: number | null }) => [
          feature.key,
          {
            enabled: feature.enabled,
            limit: feature.limit,
            planCode: sourcePlan.code,
          },
        ])
      );

      return {
        tenantId: input.tenantId,
        source: subscription ? ('subscription' as const) : ('default_plan' as const),
        plan: sourcePlan,
        subscriptionId: subscription?.id ?? null,
        entitlements,
      };
    }),

  tenantUsage: userProcedure
    .input(z.object({ tenantId: z.string() }))
    .query(async ({ input, ctx }) => {
      await requirePlatformRole(ctx.userId!, [
        PlatformRole.SUPER_ADMIN,
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.BILLING_ADMIN,
        PlatformRole.OPERATIONS_MANAGER,
        PlatformRole.SUPPORT_MANAGER,
        PlatformRole.SUPPORT_AGENT,
      ]);

      const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
      if (!tenant) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant not found' });

      const usage = await getTenantUsageSnapshot(input.tenantId);
      return {
        tenantId: input.tenantId,
        ...usage,
      };
    }),

  runBillingAutomation: userProcedure
    .input(
      z
        .object({
          suspendPastDueAfterDays: z.number().int().min(1).max(90).default(14),
          limitTenants: z.number().int().min(1).max(1000).default(500),
        })
        .optional()
    )
    .mutation(async ({ input, ctx }) => {
      await requirePlatformRole(ctx.userId!, [PlatformRole.SUPER_ADMIN, PlatformRole.PLATFORM_ADMIN, PlatformRole.BILLING_ADMIN]);
      return runSubscriptionAutomation({
        suspendPastDueAfterDays: input?.suspendPastDueAfterDays ?? 14,
        limitTenants: input?.limitTenants ?? 500,
      });
    }),

  dunningPreview: userProcedure
    .input(
      z
        .object({
          graceDays: z.number().int().min(1).max(30).default(3),
          limit: z.number().int().min(1).max(1000).default(200),
          tenantIds: z.array(z.string()).max(100).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      await requirePlatformRole(ctx.userId!, [PlatformRole.SUPER_ADMIN, PlatformRole.PLATFORM_ADMIN, PlatformRole.BILLING_ADMIN]);
      return runSubscriptionDunning({
        graceDays: input?.graceDays ?? 3,
        limit: input?.limit ?? 200,
        tenantIds: input?.tenantIds,
        dryRun: true,
      });
    }),

  runDunning: userProcedure
    .input(
      z
        .object({
          graceDays: z.number().int().min(1).max(30).default(3),
          limit: z.number().int().min(1).max(1000).default(200),
          tenantIds: z.array(z.string()).max(100).optional(),
        })
        .optional()
    )
    .mutation(async ({ input, ctx }) => {
      await requirePlatformRole(ctx.userId!, [PlatformRole.SUPER_ADMIN, PlatformRole.PLATFORM_ADMIN, PlatformRole.BILLING_ADMIN]);
      return runSubscriptionDunning({
        graceDays: input?.graceDays ?? 3,
        limit: input?.limit ?? 200,
        tenantIds: input?.tenantIds,
        dryRun: false,
      });
    }),

  subscriptionMetadataBackfill: userProcedure
    .input(
      z
        .object({
          tenantIds: z.array(z.string()).max(100).optional(),
          subscriptionIds: z.array(z.string()).max(200).optional(),
          limit: z.number().int().min(1).max(1000).default(250),
          dryRun: z.boolean().default(false),
        })
        .optional()
    )
    .mutation(async ({ input, ctx }) => {
      await requirePlatformRole(ctx.userId!, [PlatformRole.SUPER_ADMIN, PlatformRole.PLATFORM_ADMIN, PlatformRole.BILLING_ADMIN]);
      return runSubscriptionMetadataBackfill({
        tenantIds: input?.tenantIds,
        subscriptionIds: input?.subscriptionIds,
        limit: input?.limit ?? 250,
        dryRun: input?.dryRun ?? false,
      });
    }),

  listTenants: userProcedure.input(tenantListInput.optional()).query(async ({ input, ctx }) => {
    await requirePlatformRole(ctx.userId!, [
      PlatformRole.SUPER_ADMIN,
      PlatformRole.PLATFORM_ADMIN,
      PlatformRole.OPERATIONS_MANAGER,
      PlatformRole.SUPPORT_MANAGER,
      PlatformRole.SUPPORT_AGENT,
      PlatformRole.BILLING_ADMIN,
    ]);

    const query = input?.query?.trim();

    const tenants = await prisma.tenant.findMany({
      where: {
        ...(input?.status ? { status: input.status } : {}),
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { slug: { contains: query, mode: 'insensitive' } },
                { clerkOrgId: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        organizations: {
          select: {
            id: true,
            name: true,
            _count: { select: { churches: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        subscriptions: {
          where: { status: { in: activeSubscriptionStatuses as unknown as TenantSubscriptionStatus[] } },
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            organizations: true,
            payouts: true,
            payoutTransactions: true,
            auditLogs: true,
            subscriptions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: input?.limit ?? 50,
    });

    return tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      clerkOrgId: tenant.clerkOrgId,
      status: tenant.status,
      suspendedAt: tenant.suspendedAt,
      suspensionReason: tenant.suspensionReason,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
      currentSubscription: tenant.subscriptions[0]
        ? {
            id: tenant.subscriptions[0].id,
            planId: tenant.subscriptions[0].planId,
            planCode: tenant.subscriptions[0].plan.code,
            planName: tenant.subscriptions[0].plan.name,
            status: tenant.subscriptions[0].status,
            provider: tenant.subscriptions[0].provider,
            currentPeriodEnd: tenant.subscriptions[0].currentPeriodEnd,
          }
        : null,
      counts: {
        organizations: tenant._count.organizations,
        churches: tenant.organizations.reduce((sum: number, org: { _count: { churches: number } }) => sum + org._count.churches, 0),
        payouts: tenant._count.payouts,
        payoutTransactions: tenant._count.payoutTransactions,
        auditLogs: tenant._count.auditLogs,
        subscriptions: tenant._count.subscriptions,
      },
      organizations: tenant.organizations.map((org: { id: string; name: string; _count: { churches: number } }) => ({
        id: org.id,
        name: org.name,
        churchCount: org._count.churches,
      })),
    }));
  }),

  setTenantStatus: userProcedure
    .input(
      z.object({
        tenantId: z.string(),
        status: z.nativeEnum(TenantStatus),
        reason: z.string().trim().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const actor = await requirePlatformRole(ctx.userId!, [
        PlatformRole.SUPER_ADMIN,
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.OPERATIONS_MANAGER,
      ]);

      const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
      if (!tenant) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant not found' });
      }

      if (tenant.status === input.status) {
        return tenant;
      }

      const nextStatus = input.status;
      const reason = input.reason?.trim() || null;
      const updated = await prisma.tenant.update({
        where: { id: input.tenantId },
        data: {
          status: nextStatus,
          suspendedAt: nextStatus === TenantStatus.SUSPENDED ? new Date() : null,
          suspensionReason: nextStatus === TenantStatus.SUSPENDED ? reason : null,
        },
      });

      await recordAuditLog({
        tenantId: updated.id,
        actorType: AuditActorType.USER,
        actorId: actor.id,
        action: 'platform.tenant.status_changed',
        targetType: 'Tenant',
        targetId: updated.id,
        metadata: {
          previousStatus: tenant.status,
          nextStatus: updated.status,
          reason,
        },
      });

      return updated;
    }),

  tenantAudit: userProcedure.input(tenantAuditInput).query(async ({ input, ctx }) => {
    await requirePlatformRole(ctx.userId!, [
      PlatformRole.SUPER_ADMIN,
      PlatformRole.PLATFORM_ADMIN,
      PlatformRole.OPERATIONS_MANAGER,
      PlatformRole.SUPPORT_MANAGER,
      PlatformRole.SUPPORT_AGENT,
      PlatformRole.COMPLIANCE_OFFICER,
      PlatformRole.SECURITY_ADMIN,
      PlatformRole.BILLING_ADMIN,
    ]);

    return prisma.auditLog.findMany({
      where: { tenantId: input.tenantId },
      include: {
        church: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: input.limit,
    });
  }),
});
