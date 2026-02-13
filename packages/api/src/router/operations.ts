import { z } from 'zod';
import { Prisma, prisma, CareRequestStatus, SermonStatus, StorageProvider, TenantSubscriptionStatus } from '@faithflow-ai/database';
import { router, protectedProcedure } from '../trpc';
import { ensureFeatureReadAccess } from '../entitlements';
import { TRPCError } from '@trpc/server';
import { sendEmail } from '../email';
import { runStorageSmokeTest } from '../storage';

const rangeInput = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    churchId: z.string().optional(),
  })
  .optional();

const defaultFrom = () => new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
const defaultTo = () => new Date();
const activeCareStatuses: CareRequestStatus[] = [
  CareRequestStatus.OPEN,
  CareRequestStatus.ASSIGNED,
  CareRequestStatus.IN_PROGRESS,
];

export const operationsRouter = router({
  health: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId || !ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant context required' });
    }

    const staff = await prisma.staffMembership.findFirst({
      where: {
        user: { clerkUserId: ctx.userId },
        church: { organization: { tenantId: ctx.tenantId } },
      },
      include: { user: true, church: true },
    });
    if (!staff) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Staff access required' });
    }

    const dbStart = Date.now();
    let dbOk = true;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbOk = false;
    }
    const dbLatencyMs = Date.now() - dbStart;

    let migrationInfo: { ok: boolean; lastMigration?: { name: string; finishedAt: Date | null }; total?: number } = {
      ok: false,
    };
    try {
      const rows = (await prisma.$queryRaw<
        Array<{ migration_name: string; finished_at: Date | null }>
      >`SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at DESC NULLS LAST LIMIT 1`) as Array<{
        migration_name: string;
        finished_at: Date | null;
      }>;
      const countRows = (await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint as count FROM "_prisma_migrations"`) as Array<{
        count: bigint;
      }>;
      migrationInfo = {
        ok: true,
        lastMigration: rows[0] ? { name: rows[0].migration_name, finishedAt: rows[0].finished_at } : undefined,
        total: countRows[0] ? Number(countRows[0].count) : undefined,
      };
    } catch {
      // ignore if migrations table is unavailable in a given environment
    }

    const providers = {
      clerk: Boolean(process.env.CLERK_SECRET_KEY && process.env.CLERK_JWT_ISSUER),
      resend: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
      stripe: Boolean(process.env.STRIPE_SECRET_KEY),
      paystack: Boolean(process.env.PAYSTACK_SECRET_KEY),
      twilio: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      storage: Boolean(process.env.STORAGE_PROVIDER),
      scheduler: Boolean(process.env.ENABLE_INTERNAL_SCHEDULER) ? 'internal' : 'external',
    } as const;

    const latestWebhookEvents = await prisma.webhookEvent.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { receivedAt: 'desc' },
      take: 25,
      select: {
        provider: true,
        eventType: true,
        status: true,
        receivedAt: true,
        processedAt: true,
        error: true,
      },
    });

    const latestByProvider = Object.fromEntries(
      latestWebhookEvents.reduce((acc, event) => {
        if (!acc.some((entry) => entry.provider === event.provider)) acc.push(event);
        return acc;
      }, [] as typeof latestWebhookEvents)
        .map((event) => [event.provider, event])
    ) as Record<string, (typeof latestWebhookEvents)[number]>;

    const currentSubscription = await prisma.tenantSubscription.findFirst({
      where: {
        tenantId: ctx.tenantId,
        status: {
          in: [
            TenantSubscriptionStatus.TRIALING,
            TenantSubscriptionStatus.ACTIVE,
            TenantSubscriptionStatus.PAST_DUE,
            TenantSubscriptionStatus.PAUSED,
          ],
        },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    const lastAudit = await prisma.auditLog.findMany({
      where: {
        tenantId: ctx.tenantId,
        action: { in: ['subscription.trial_reminder_queued', 'billing.dunning_queued', 'subscription.past_due_expired'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { action: true, createdAt: true, targetType: true, targetId: true },
    });

    const lastByAction = Object.fromEntries(
      lastAudit.reduce((acc, row) => {
        if (!acc.some((entry) => entry.action === row.action)) acc.push(row);
        return acc;
      }, [] as typeof lastAudit)
        .map((row) => [row.action, row])
    ) as Record<string, (typeof lastAudit)[number]>;

    return {
      tenantId: ctx.tenantId,
      db: {
        ok: dbOk,
        latencyMs: dbLatencyMs,
      },
      migrations: migrationInfo,
      providers,
      webhooks: {
        latestByProvider,
      },
      subscription: currentSubscription
        ? {
            id: currentSubscription.id,
            status: currentSubscription.status,
            provider: currentSubscription.provider,
            planCode: currentSubscription.plan.code,
            planName: currentSubscription.plan.name,
            currentPeriodEnd: currentSubscription.currentPeriodEnd,
            trialEndsAt: currentSubscription.trialEndsAt,
          }
        : null,
      jobs: {
        trialReminderLast: lastByAction['subscription.trial_reminder_queued'] ?? null,
        dunningLast: lastByAction['billing.dunning_queued'] ?? null,
        pastDueExpireLast: lastByAction['subscription.past_due_expired'] ?? null,
      },
    };
  }),

  goLiveChecklist: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId || !ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant context required' });
    }

    const staff = await prisma.staffMembership.findFirst({
      where: {
        user: { clerkUserId: ctx.userId },
        church: { organization: { tenantId: ctx.tenantId } },
      },
      include: { user: true },
    });
    if (!staff) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Staff access required' });
    }

    const storageProvider = process.env.STORAGE_PROVIDER as StorageProvider | undefined;
    const checklist = [
      {
        id: 'clerk',
        title: 'Clerk auth configured',
        status: process.env.CLERK_SECRET_KEY && process.env.CLERK_JWT_ISSUER && process.env.CLERK_JWT_AUDIENCE ? 'OK' : 'MISSING',
        env: ['CLERK_SECRET_KEY', 'CLERK_JWT_ISSUER', 'CLERK_JWT_AUDIENCE'],
        detail: 'Required for admin + portal auth and API verification.',
      },
      {
        id: 'clerk_webhooks',
        title: 'Clerk webhooks configured',
        status: process.env.CLERK_WEBHOOK_SECRET ? 'OK' : 'WARN',
        env: ['CLERK_WEBHOOK_SECRET'],
        detail: 'Enables org provisioning and user lifecycle events.',
      },
      {
        id: 'resend',
        title: 'Resend email configured',
        status: process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL ? 'OK' : 'MISSING',
        env: ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'],
        detail: 'Receipts, transactional emails, and contact form notifications.',
      },
      {
        id: 'payments_stripe',
        title: 'Stripe configured',
        status: process.env.STRIPE_SECRET_KEY ? 'OK' : 'WARN',
        env: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
        detail: 'Recommended for USD billing and giving.',
      },
      {
        id: 'payments_paystack',
        title: 'Paystack configured',
        status: process.env.PAYSTACK_SECRET_KEY ? 'OK' : 'WARN',
        env: ['PAYSTACK_SECRET_KEY', 'PAYSTACK_WEBHOOK_SECRET'],
        detail: 'Recommended for NGN/GHS and supported African currencies.',
      },
      {
        id: 'storage',
        title: 'Storage configured',
        status: process.env.STORAGE_PROVIDER ? 'OK' : 'MISSING',
        env:
          storageProvider === StorageProvider.GCS
            ? ['STORAGE_PROVIDER', 'GCS_BUCKET', 'GCS_PROJECT_ID', 'GCS_CLIENT_EMAIL', 'GCS_PRIVATE_KEY']
            : ['STORAGE_PROVIDER', 'S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'],
        detail: 'Required for dispute evidence uploads, media library, and attachments.',
      },
      {
        id: 'twilio',
        title: 'Twilio SMS/WhatsApp configured',
        status: process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN ? 'OK' : 'WARN',
        env: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_SMS_NUMBER', 'TWILIO_WHATSAPP_NUMBER'],
        detail: 'Required for SMS/WhatsApp campaigns and text-to-give.',
      },
      {
        id: 'unsubscribe',
        title: 'Unsubscribe token signing configured',
        status: process.env.COMMS_UNSUBSCRIBE_SECRET ? 'OK' : 'WARN',
        env: ['COMMS_UNSUBSCRIBE_SECRET'],
        detail: 'Required to enable one-click unsubscribe links in email.',
      },
      {
        id: 'scheduler',
        title: 'Scheduler mode',
        status: process.env.ENABLE_INTERNAL_SCHEDULER === 'true' ? 'WARN' : 'OK',
        env: ['ENABLE_INTERNAL_SCHEDULER', 'CRON_TENANT_OPS_AUTOMATE', 'CRON_SUPPORT_SLA_SWEEP', 'CRON_SUBSCRIPTION_METADATA_BACKFILL'],
        detail: 'In production, prefer Render cron jobs over internal scheduler for multi-instance safety.',
      },
    ] as const;

    return {
      tenantId: ctx.tenantId,
      items: checklist.map((item) => ({
        ...item,
        status: item.status as 'OK' | 'MISSING' | 'WARN',
        env: [...item.env],
      })),
    };
  }),

  sendTestEmail: protectedProcedure
    .input(z.object({ to: z.string().email().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId || !ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant context required' });
      }

      const staff = await prisma.staffMembership.findFirst({
        where: {
          user: { clerkUserId: ctx.userId },
          church: { organization: { tenantId: ctx.tenantId } },
        },
        include: { user: true, church: true },
      });
      if (!staff) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Staff access required' });
      }

      const to = input?.to ?? staff.user.email;
      if (!to) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No email found for staff user. Provide "to".' });
      }

      const now = new Date();
      await sendEmail({
        to,
        subject: 'FaithFlow AI test email',
        html: `<p>This is a test email from FaithFlow AI.</p><p>Tenant: ${ctx.tenantId}</p><p>Time: ${now.toISOString()}</p>`,
      });

      return { ok: true, to, sentAt: now.toISOString() };
    }),

  uploadTest: protectedProcedure
    .input(z.object({ provider: z.nativeEnum(StorageProvider).optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId || !ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant context required' });
      }

      const staff = await prisma.staffMembership.findFirst({
        where: {
          user: { clerkUserId: ctx.userId },
          church: { organization: { tenantId: ctx.tenantId } },
        },
        include: { user: true, church: true },
      });
      if (!staff) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Staff access required' });
      }

      const church = await prisma.church.findFirst({
        where: { organization: { tenantId: ctx.tenantId } },
        orderBy: { createdAt: 'asc' },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No church found for tenant.' });
      }

      try {
        const result = await runStorageSmokeTest({ churchId: church.id, provider: input?.provider });
        return result;
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_GATEWAY',
          message: error instanceof Error ? error.message : 'Upload test failed',
        });
      }
    }),

  headquartersSummary: protectedProcedure.input(rangeInput).query(async ({ input, ctx }) => {
    await ensureFeatureReadAccess(
      ctx.tenantId!,
      'multi_campus_enabled',
      'Your subscription does not include multi-campus operations.'
    );

    const from = input?.from ?? defaultFrom();
    const to = input?.to ?? defaultTo();
    const churchFilter = input?.churchId ? { churchId: input.churchId } : {};
    const tenantChurchWhere = { organization: { tenantId: ctx.tenantId! } };

    const [organizations, churches, campuses, members, events, attendance, donations, facilities, bookings, careRequests, sermons] =
      await Promise.all([
        prisma.organization.count({ where: { tenantId: ctx.tenantId! } }),
        prisma.church.count({ where: tenantChurchWhere }),
        prisma.campus.count({ where: { church: tenantChurchWhere } }),
        prisma.member.count({ where: { church: tenantChurchWhere } }),
        prisma.event.count({
          where: {
            church: tenantChurchWhere,
            ...churchFilter,
            startAt: { gte: from, lte: to },
          },
        }),
        prisma.attendance.count({
          where: {
            event: {
              church: tenantChurchWhere,
              ...churchFilter,
              startAt: { gte: from, lte: to },
            },
          },
        }),
        prisma.donation.aggregate({
          where: {
            church: tenantChurchWhere,
            ...churchFilter,
            status: 'COMPLETED',
            createdAt: { gte: from, lte: to },
          },
          _count: { _all: true },
          _sum: { amount: true },
        }),
        prisma.facility.count({ where: { church: tenantChurchWhere, ...(input?.churchId ? { churchId: input.churchId } : {}) } }),
        prisma.facilityBooking.count({
          where: {
            church: tenantChurchWhere,
            ...(input?.churchId ? { churchId: input.churchId } : {}),
            startAt: { gte: from, lte: to },
          },
        }),
        prisma.careRequest.count({
          where: {
            church: tenantChurchWhere,
            ...(input?.churchId ? { churchId: input.churchId } : {}),
            createdAt: { gte: from, lte: to },
          },
        }),
        prisma.sermon.count({
          where: {
            church: tenantChurchWhere,
            ...(input?.churchId ? { churchId: input.churchId } : {}),
            status: SermonStatus.PUBLISHED,
            createdAt: { gte: from, lte: to },
          },
        }),
      ]);

    return {
      from,
      to,
      totals: {
        organizations,
        churches,
        campuses,
        members,
        events,
        attendance,
        donationCount: donations._count._all,
        donationAmount: donations._sum.amount ?? new Prisma.Decimal(0),
        facilities,
        facilityBookings: bookings,
        careRequests,
        publishedSermons: sermons,
      },
    };
  }),

  campusPerformance: protectedProcedure.input(rangeInput).query(async ({ input, ctx }) => {
    await ensureFeatureReadAccess(
      ctx.tenantId!,
      'multi_campus_enabled',
      'Your subscription does not include multi-campus operations.'
    );

    const from = input?.from ?? defaultFrom();
    const to = input?.to ?? defaultTo();

    const campuses = await prisma.campus.findMany({
      where: {
        church: { organization: { tenantId: ctx.tenantId! } },
        ...(input?.churchId ? { churchId: input.churchId } : {}),
      },
      include: {
        events: {
          where: { startAt: { gte: from, lte: to } },
          select: { id: true },
        },
        facilities: {
          include: {
            bookings: {
              where: {
                startAt: { gte: from, lte: to },
              },
              select: { id: true, startAt: true, endAt: true, status: true },
            },
          },
        },
        careRequests: {
          where: { createdAt: { gte: from, lte: to } },
          select: { id: true, status: true, priority: true },
        },
        sermons: {
          where: { createdAt: { gte: from, lte: to } },
          select: { id: true, status: true, viewCount: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const eventIds = campuses.flatMap((campus) => campus.events.map((event) => event.id));
    const attendanceByEvent = eventIds.length
      ? await prisma.attendance.groupBy({
          by: ['eventId'],
          where: { eventId: { in: eventIds } },
          _count: { _all: true },
        })
      : [];
    const attendanceMap = new Map(attendanceByEvent.map((entry) => [entry.eventId, entry._count._all]));

    return campuses.map((campus) => {
      const eventCount = campus.events.length;
      const attendanceCount = campus.events.reduce((sum, event) => sum + (attendanceMap.get(event.id) ?? 0), 0);
      const bookedHours = campus.facilities.reduce((sum, facility) => {
        return (
          sum +
          facility.bookings.reduce((facilityTotal, booking) => {
            if (booking.endAt <= booking.startAt) return facilityTotal;
            return facilityTotal + (booking.endAt.getTime() - booking.startAt.getTime()) / (1000 * 60 * 60);
          }, 0)
        );
      }, 0);
      const openCareRequests = campus.careRequests.filter((request) =>
        activeCareStatuses.includes(request.status)
      ).length;
      const publishedSermons = campus.sermons.filter((sermon) => sermon.status === SermonStatus.PUBLISHED).length;
      const sermonViews = campus.sermons.reduce((sum, sermon) => sum + sermon.viewCount, 0);

      return {
        campusId: campus.id,
        campusName: campus.name,
        churchId: campus.churchId,
        eventCount,
        attendanceCount,
        facilityCount: campus.facilities.length,
        bookedHours,
        careRequestCount: campus.careRequests.length,
        openCareRequests,
        publishedSermons,
        sermonViews,
      };
    });
  }),
});
