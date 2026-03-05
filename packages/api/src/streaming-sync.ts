import {
  AuditActorType,
  HealthCheckStatus,
  HealthCheckType,
  LiveStreamStatus,
  Prisma,
  prisma,
} from '@faithflow-ai/database';
import { recordAuditLog } from './audit';

type ProbeResult = {
  reachable: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
};

type StreamingSyncEntry = {
  sessionId: string;
  churchId: string;
  channelId: string;
  provider: string;
  status: LiveStreamStatus;
  playbackReachable: boolean;
  playbackStatusCode: number | null;
  recordingReachable: boolean | null;
  recordingStatusCode: number | null;
  ingestionConfigured: boolean;
  recommendedAction: string;
  suggestedTransition: 'NONE' | 'SCHEDULED_TO_LIVE';
  updated: boolean;
};

function timeoutMs() {
  const parsed = Number.parseInt(process.env.STREAMING_SYNC_HTTP_TIMEOUT_MS ?? '3000', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3000;
}

async function probeUrl(url?: string | null): Promise<ProbeResult> {
  if (!url) {
    return { reachable: false, statusCode: null, latencyMs: null, error: 'missing_url' };
  }

  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs()),
    });
    return {
      reachable: response.ok,
      statusCode: response.status,
      latencyMs: Date.now() - started,
      error: response.ok ? null : `http_${response.status}`,
    };
  } catch (error) {
    return {
      reachable: false,
      statusCode: null,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : 'probe_failed',
    };
  }
}

export async function runStreamingProviderSync(options?: {
  tenantId?: string;
  churchId?: string;
  limit?: number;
  dryRun?: boolean;
  applySuggestedTransitions?: boolean;
  actorId?: string | null;
}) {
  const now = new Date();
  const limit = options?.limit ?? 200;
  const sessions = await prisma.liveStreamSession.findMany({
    where: {
      ...(options?.churchId ? { churchId: options.churchId } : {}),
      ...(options?.tenantId ? { church: { organization: { tenantId: options.tenantId } } } : {}),
      status: { in: [LiveStreamStatus.SCHEDULED, LiveStreamStatus.LIVE, LiveStreamStatus.ENDED] },
    },
    include: {
      channel: true,
      church: { select: { id: true, organization: { select: { tenantId: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 500),
  });

  const entries: StreamingSyncEntry[] = [];
  const errors: Array<{ sessionId: string; error: string }> = [];
  let updated = 0;

  for (const session of sessions) {
    try {
      const playbackProbe = await probeUrl(session.channel.playbackUrl);
      const recordingProbe = session.recordingUrl ? await probeUrl(session.recordingUrl) : null;
      const shouldSuggestStart =
        session.status === LiveStreamStatus.SCHEDULED &&
        Boolean(session.scheduledStartAt && session.scheduledStartAt <= now) &&
        playbackProbe.reachable;

      let recommendedAction = 'No action required.';
      if (!session.channel.playbackUrl) {
        recommendedAction = 'Set playback URL to enable provider health checks.';
      } else if (!playbackProbe.reachable) {
        recommendedAction = 'Playback endpoint is unreachable. Check provider output and stream configuration.';
      } else if (session.status === LiveStreamStatus.SCHEDULED && shouldSuggestStart) {
        recommendedAction = 'Session appears live on provider. Promote status to LIVE.';
      } else if (session.status === LiveStreamStatus.ENDED && session.isRecording && !session.recordingUrl) {
        recommendedAction = 'Recording expected but missing URL. Ingest recording link from provider.';
      }

      let didUpdate = false;
      if (!options?.dryRun && options?.applySuggestedTransitions && shouldSuggestStart && !session.startedAt) {
        await prisma.liveStreamSession.update({
          where: { id: session.id },
          data: {
            status: LiveStreamStatus.LIVE,
            startedAt: now,
          },
        });
        updated += 1;
        didUpdate = true;

        await recordAuditLog({
          tenantId: session.church.organization.tenantId,
          churchId: session.churchId,
          actorType: AuditActorType.SYSTEM,
          actorId: options?.actorId ?? null,
          action: 'streaming.session.synced_live',
          targetType: 'LiveStreamSession',
          targetId: session.id,
          metadata: {
            reason: 'playback_reachable_after_schedule',
            playbackStatusCode: playbackProbe.statusCode,
          },
        });
      }

      const healthStatus = !session.channel.playbackUrl
        ? HealthCheckStatus.DEGRADED
        : playbackProbe.reachable
          ? HealthCheckStatus.HEALTHY
          : session.status === LiveStreamStatus.LIVE
            ? HealthCheckStatus.OUTAGE
            : HealthCheckStatus.DEGRADED;

      if (!options?.dryRun) {
        await prisma.tenantHealthCheck.create({
          data: {
            tenantId: session.church.organization.tenantId,
            type: HealthCheckType.WORKER,
            status: healthStatus,
            latencyMs: playbackProbe.latencyMs ?? undefined,
            details: {
              module: 'streaming_provider_sync',
              sessionId: session.id,
              churchId: session.churchId,
              channelId: session.channelId,
              provider: session.channel.provider,
              sessionStatus: session.status,
              playbackReachable: playbackProbe.reachable,
              playbackStatusCode: playbackProbe.statusCode,
              playbackError: playbackProbe.error,
              recordingReachable: recordingProbe?.reachable ?? null,
              recordingStatusCode: recordingProbe?.statusCode ?? null,
              suggestedTransition: shouldSuggestStart ? 'SCHEDULED_TO_LIVE' : 'NONE',
            } as Prisma.InputJsonValue,
          },
        });
      }

      entries.push({
        sessionId: session.id,
        churchId: session.churchId,
        channelId: session.channelId,
        provider: session.channel.provider,
        status: session.status,
        playbackReachable: playbackProbe.reachable,
        playbackStatusCode: playbackProbe.statusCode,
        recordingReachable: recordingProbe?.reachable ?? null,
        recordingStatusCode: recordingProbe?.statusCode ?? null,
        ingestionConfigured: Boolean(session.channel.ingestUrl),
        recommendedAction,
        suggestedTransition: shouldSuggestStart ? 'SCHEDULED_TO_LIVE' : 'NONE',
        updated: didUpdate,
      });
    } catch (error) {
      errors.push({
        sessionId: session.id,
        error: error instanceof Error ? error.message : 'streaming_sync_failed',
      });
    }
  }

  return {
    scanned: sessions.length,
    updated,
    failed: errors.length,
    entries,
    errors,
    dryRun: Boolean(options?.dryRun),
  };
}
