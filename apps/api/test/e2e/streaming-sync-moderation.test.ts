import assert from 'node:assert/strict';
import test from 'node:test';
import { appRouter } from '@faithflow-ai/api';
import {
  LiveModerationLevel,
  LiveStreamProvider,
  LiveStreamStatus,
  BillingInterval,
  SubscriptionProvider,
  TenantSubscriptionStatus,
  UserRole,
  prisma,
} from '@faithflow-ai/database';

function uniqueSuffix() {
  return `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

test('streaming provider sync and moderation controls operate end-to-end', async () => {
  const suffix = uniqueSuffix();
  const startedAt = new Date();
  const clerkUserId = `clerk_stream_${suffix}`;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    return new Response(null, { status: url.includes('/ok') ? 200 : 404 });
  };
  const playbackUrl = `https://stream-provider.example/${suffix}/ok`;

  const tenant = await prisma.tenant.create({
    data: {
      name: `Streaming Tenant ${suffix}`,
      slug: `streaming-tenant-${suffix}`,
      clerkOrgId: `org_stream_${suffix}`,
    },
  });
  const organization = await prisma.organization.create({
    data: {
      tenantId: tenant.id,
      name: `Org ${suffix}`,
    },
  });
  const church = await prisma.church.create({
    data: {
      organizationId: organization.id,
      name: `Church ${suffix}`,
      slug: `church-stream-${suffix}`,
      countryCode: 'US',
      timezone: 'UTC',
    },
  });
  const user = await prisma.user.create({
    data: {
      clerkUserId,
      email: `stream-${suffix}@example.com`,
      name: 'Streaming Admin',
      role: UserRole.ADMIN,
    },
  });
  await prisma.staffMembership.create({
    data: {
      userId: user.id,
      churchId: church.id,
      role: UserRole.ADMIN,
    },
  });

  const channel = await prisma.liveStreamChannel.create({
    data: {
      churchId: church.id,
      name: `Sunday Channel ${suffix}`,
      provider: LiveStreamProvider.YOUTUBE,
      playbackUrl,
      ingestUrl: `rtmp://ingest.example.com/live/${suffix}`,
    },
  });
  const session = await prisma.liveStreamSession.create({
    data: {
      churchId: church.id,
      channelId: channel.id,
      title: `Sunday Service ${suffix}`,
      status: LiveStreamStatus.SCHEDULED,
      scheduledStartAt: new Date(Date.now() - 10 * 60 * 1000),
      moderationLevel: LiveModerationLevel.FILTERED,
      isRecording: true,
    },
  });
  const plan = await prisma.subscriptionPlan.create({
    data: {
      code: `streaming-plan-${suffix}`,
      name: `Streaming Plan ${suffix}`,
      currency: 'USD',
      interval: BillingInterval.MONTHLY,
      amountMinor: 4900,
      isActive: true,
      isDefault: false,
      features: {
        create: [
          {
            key: 'streaming_enabled',
            enabled: true,
            limit: null,
          },
        ],
      },
    },
  });
  await prisma.tenantSubscription.create({
    data: {
      tenantId: tenant.id,
      planId: plan.id,
      provider: SubscriptionProvider.STRIPE,
      providerRef: `sub_${suffix}`,
      status: TenantSubscriptionStatus.ACTIVE,
      startsAt: new Date(),
    },
  });

  try {
    const caller = appRouter.createCaller({
      userId: clerkUserId,
      clerkOrgId: tenant.clerkOrgId,
      tenantId: tenant.id,
      tenantStatus: 'ACTIVE',
    });

    const preview = await caller.streaming.providerSyncPreview({ churchId: church.id, limit: 20 });
    assert.equal(preview.scanned, 1);
    assert.equal(preview.entries[0]?.suggestedTransition, 'SCHEDULED_TO_LIVE');
    assert.equal(preview.entries[0]?.playbackReachable, true);

    const runResult = await caller.streaming.runProviderSync({
      churchId: church.id,
      limit: 20,
      applySuggestedTransitions: true,
    });
    assert.equal(runResult.scanned, 1);
    assert.equal(runResult.updated, 1);

    const updatedSession = await prisma.liveStreamSession.findUniqueOrThrow({ where: { id: session.id } });
    assert.equal(updatedSession.status, LiveStreamStatus.LIVE);
    assert.ok(updatedSession.startedAt);

    const moderationUpdate = await caller.streaming.setModerationLevel({
      sessionId: session.id,
      moderationLevel: LiveModerationLevel.STRICT,
    });
    assert.equal(moderationUpdate.moderationLevel, LiveModerationLevel.STRICT);

    await caller.streaming.recordModerationAction({
      sessionId: session.id,
      actionType: 'WARN',
      participantRef: 'participant_1',
      reason: 'Spam links in chat',
      durationMinutes: 15,
    });

    const timeline = await caller.streaming.moderationTimeline({ sessionId: session.id, limit: 10 });
    assert.ok(timeline.length >= 1);
    assert.equal(timeline[0].action, 'streaming.moderation.warn');

    const healthChecks = await prisma.tenantHealthCheck.findMany({
      where: { tenantId: tenant.id, checkedAt: { gte: startedAt } },
    });
    assert.ok(healthChecks.length >= 1);
  } finally {
    globalThis.fetch = originalFetch;

    await prisma.auditLog.deleteMany({
      where: {
        tenantId: tenant.id,
        action: {
          in: [
            'streaming.session.synced_live',
            'streaming.provider_sync.ran',
            'streaming.session.moderation_level_updated',
            'streaming.moderation.warn',
          ],
        },
      },
    });
    await prisma.tenantHealthCheck.deleteMany({ where: { tenantId: tenant.id, checkedAt: { gte: startedAt } } });
    await prisma.tenantSubscription.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.subscriptionPlanFeature.deleteMany({ where: { planId: plan.id } });
    await prisma.subscriptionPlan.deleteMany({ where: { id: plan.id } });
    await prisma.liveStreamSession.deleteMany({ where: { churchId: church.id } });
    await prisma.liveStreamChannel.deleteMany({ where: { churchId: church.id } });
    await prisma.staffMembership.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.church.deleteMany({ where: { id: church.id } });
    await prisma.organization.deleteMany({ where: { id: organization.id } });
    await prisma.tenant.deleteMany({ where: { id: tenant.id } });
  }
});
