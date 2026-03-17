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

type ProviderApiResult = {
  liveViewers: number | null;
  providerStatus: string | null;
  isLiveOnProvider: boolean;
  hasEndedOnProvider: boolean;
  providerRecordingUrl: string | null;
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
  liveViewers: number | null;
  providerStatus: string | null;
  recommendedAction: string;
  suggestedTransition: 'NONE' | 'SCHEDULED_TO_LIVE' | 'LIVE_TO_ENDED';
  updated: boolean;
};

function timeoutMs() {
  const parsed = Number.parseInt(process.env.STREAMING_SYNC_HTTP_TIMEOUT_MS ?? '3000', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3000;
}

// Security: private/loopback/link-local IP ranges that must not be fetched (SSRF defense)
const PRIVATE_IP_PATTERNS = [
  /^127\./,                        // loopback
  /^10\./,                         // RFC 1918
  /^172\.(1[6-9]|2\d|3[01])\./,   // RFC 1918
  /^192\.168\./,                   // RFC 1918
  /^169\.254\./,                   // link-local (AWS IMDS, etc.)
  /^::1$/,                         // IPv6 loopback
  /^fc00:/i,                       // IPv6 unique local
  /^fe80:/i,                       // IPv6 link-local
  /^0\./,                          // 0.0.0.0/8
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,  // RFC 6598 CGN
  /^localhost$/i,
];

function isSafeExternalUrl(raw: string): { safe: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { safe: false, reason: 'invalid_url' };
  }
  if (parsed.protocol !== 'https:') {
    return { safe: false, reason: 'non_https_scheme' };
  }
  const hostname = parsed.hostname;
  if (PRIVATE_IP_PATTERNS.some((re) => re.test(hostname))) {
    return { safe: false, reason: 'private_ip_blocked' };
  }
  return { safe: true };
}

async function probeUrl(url?: string | null): Promise<ProbeResult> {
  if (!url) {
    return { reachable: false, statusCode: null, latencyMs: null, error: 'missing_url' };
  }

  // Security: block SSRF — only allow HTTPS to public IPs
  const safety = isSafeExternalUrl(url);
  if (!safety.safe) {
    return { reachable: false, statusCode: null, latencyMs: null, error: safety.reason ?? 'url_blocked' };
  }

  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'error',  // do not follow redirects — validate the redirect target instead
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

function nullProviderResult(): ProviderApiResult {
  return { liveViewers: null, providerStatus: null, isLiveOnProvider: false, hasEndedOnProvider: false, providerRecordingUrl: null };
}

async function fetchYoutubeStatus(broadcastId: string): Promise<ProviderApiResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return nullProviderResult();

  const url = `https://www.googleapis.com/youtube/v3/liveBroadcasts?part=status,statistics&id=${encodeURIComponent(broadcastId)}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs()) });
  if (!res.ok) return nullProviderResult();

  const data = await res.json() as {
    items?: Array<{
      status?: { lifeCycleStatus?: string };
      statistics?: { concurrentViewers?: string };
    }>;
  };
  const item = data.items?.[0];
  if (!item) return nullProviderResult();

  const lifeCycle = item.status?.lifeCycleStatus ?? null;
  const viewers = item.statistics?.concurrentViewers != null ? Number(item.statistics.concurrentViewers) : null;

  return {
    liveViewers: viewers,
    providerStatus: lifeCycle,
    // liveStarting = imminent; live = broadcasting
    isLiveOnProvider: lifeCycle === 'live' || lifeCycle === 'liveStarting',
    hasEndedOnProvider: lifeCycle === 'complete' || lifeCycle === 'revoked',
    // YouTube archive URLs are not available via this API endpoint
    providerRecordingUrl: null,
  };
}

async function fetchFacebookStatus(videoId: string): Promise<ProviderApiResult> {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!token) return nullProviderResult();

  const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(videoId)}?fields=status,live_views&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs()) });
  if (!res.ok) return nullProviderResult();

  const data = await res.json() as { status?: string; live_views?: number };
  const status = data.status ?? null;

  return {
    liveViewers: data.live_views ?? null,
    providerStatus: status,
    isLiveOnProvider: status === 'LIVE' || status === 'SCHEDULED_LIVE',
    hasEndedOnProvider: status === 'VOD' || status === 'PROCESSING',
    providerRecordingUrl: null,
  };
}

async function fetchVimeoStatus(videoId: string): Promise<ProviderApiResult> {
  const token = process.env.VIMEO_ACCESS_TOKEN;
  if (!token) return nullProviderResult();

  const url = `https://api.vimeo.com/live_events/${encodeURIComponent(videoId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `bearer ${token}` },
    signal: AbortSignal.timeout(timeoutMs()),
  });
  if (!res.ok) return nullProviderResult();

  const data = await res.json() as {
    status?: string;
    record?: { url?: string };
  };
  const status = data.status ?? null;

  return {
    liveViewers: null,
    providerStatus: status,
    isLiveOnProvider: status === 'streaming',
    hasEndedOnProvider: status === 'archived' || status === 'archive_in_progress',
    // Auto-ingest recording URL once the Vimeo event is archived
    providerRecordingUrl: status === 'archived' ? (data.record?.url ?? null) : null,
  };
}

async function fetchProviderStatus(provider: string, externalChannelId: string | null): Promise<ProviderApiResult> {
  if (!externalChannelId) return nullProviderResult();

  try {
    if (provider === 'YOUTUBE') return await fetchYoutubeStatus(externalChannelId);
    if (provider === 'FACEBOOK') return await fetchFacebookStatus(externalChannelId);
    if (provider === 'VIMEO') return await fetchVimeoStatus(externalChannelId);
  } catch {
    // Provider API errors are non-fatal — fall back to URL probe signals
  }

  return nullProviderResult();
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
      const [playbackProbe, providerData] = await Promise.all([
        probeUrl(session.channel.playbackUrl),
        fetchProviderStatus(session.channel.provider, session.channel.externalChannelId),
      ]);
      const recordingProbe = session.recordingUrl ? await probeUrl(session.recordingUrl) : null;

      // Provider API takes precedence when available; URL probe is the fallback.
      const isLiveSignal =
        providerData.isLiveOnProvider ||
        (providerData.providerStatus === null && playbackProbe.reachable);
      const hasEndedSignal = providerData.hasEndedOnProvider;

      const shouldSuggestStart =
        session.status === LiveStreamStatus.SCHEDULED &&
        Boolean(session.scheduledStartAt && session.scheduledStartAt <= now) &&
        isLiveSignal;

      const shouldSuggestEnd =
        session.status === LiveStreamStatus.LIVE &&
        hasEndedSignal;

      let suggestedTransition: StreamingSyncEntry['suggestedTransition'] = 'NONE';
      if (shouldSuggestStart) suggestedTransition = 'SCHEDULED_TO_LIVE';
      else if (shouldSuggestEnd) suggestedTransition = 'LIVE_TO_ENDED';

      let recommendedAction = 'No action required.';
      if (!session.channel.playbackUrl) {
        recommendedAction = 'Set playback URL to enable provider health checks.';
      } else if (!playbackProbe.reachable && providerData.providerStatus === null) {
        recommendedAction = 'Playback endpoint is unreachable. Check provider output and stream configuration.';
      } else if (shouldSuggestStart) {
        recommendedAction = providerData.isLiveOnProvider
          ? `Provider confirms session is live (${providerData.providerStatus}). Promote status to LIVE.`
          : 'Session appears live on provider. Promote status to LIVE.';
      } else if (shouldSuggestEnd) {
        recommendedAction = `Provider reports session ended (${providerData.providerStatus}). Transition to ENDED.`;
      } else if (session.status === LiveStreamStatus.ENDED && session.isRecording && !session.recordingUrl) {
        recommendedAction = providerData.providerRecordingUrl
          ? 'Recording URL retrieved from provider and will be saved automatically.'
          : 'Recording expected but missing URL. Ingest recording link from provider.';
      }

      let didUpdate = false;
      if (!options?.dryRun && options?.applySuggestedTransitions) {
        if (shouldSuggestStart && !session.startedAt) {
          await prisma.liveStreamSession.update({
            where: { id: session.id },
            data: {
              status: LiveStreamStatus.LIVE,
              startedAt: now,
              ...(providerData.liveViewers != null ? { peakViewers: providerData.liveViewers } : {}),
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
              reason: isLiveSignal ? 'provider_api_live_signal' : 'playback_reachable_after_schedule',
              providerStatus: providerData.providerStatus,
              playbackStatusCode: playbackProbe.statusCode,
              liveViewers: providerData.liveViewers,
            },
          });
        } else if (shouldSuggestEnd && !session.endedAt) {
          await prisma.liveStreamSession.update({
            where: { id: session.id },
            data: {
              status: LiveStreamStatus.ENDED,
              endedAt: now,
            },
          });
          updated += 1;
          didUpdate = true;

          await recordAuditLog({
            tenantId: session.church.organization.tenantId,
            churchId: session.churchId,
            actorType: AuditActorType.SYSTEM,
            actorId: options?.actorId ?? null,
            action: 'streaming.session.synced_ended',
            targetType: 'LiveStreamSession',
            targetId: session.id,
            metadata: {
              reason: 'provider_api_ended_signal',
              providerStatus: providerData.providerStatus,
            },
          });
        }

        // Auto-ingest recording URL from provider when session is ENDED and recording was expected.
        if (
          providerData.providerRecordingUrl &&
          !session.recordingUrl &&
          (session.status === LiveStreamStatus.ENDED || shouldSuggestEnd)
        ) {
          await prisma.liveStreamSession.update({
            where: { id: session.id },
            data: { recordingUrl: providerData.providerRecordingUrl },
          });
          if (!didUpdate) {
            updated += 1;
            didUpdate = true;
          }

          await recordAuditLog({
            tenantId: session.church.organization.tenantId,
            churchId: session.churchId,
            actorType: AuditActorType.SYSTEM,
            actorId: options?.actorId ?? null,
            action: 'streaming.session.recording_ingested',
            targetType: 'LiveStreamSession',
            targetId: session.id,
            metadata: { providerStatus: providerData.providerStatus },
          });
        }

        // Update peak viewer count from live provider data.
        if (
          providerData.liveViewers != null &&
          session.status === LiveStreamStatus.LIVE &&
          !shouldSuggestEnd &&
          providerData.liveViewers > (session.peakViewers ?? 0)
        ) {
          await prisma.liveStreamSession.update({
            where: { id: session.id },
            data: { peakViewers: providerData.liveViewers },
          });
        }
      }

      const healthStatus = !session.channel.playbackUrl
        ? HealthCheckStatus.DEGRADED
        : playbackProbe.reachable || providerData.isLiveOnProvider
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
              providerStatus: providerData.providerStatus,
              liveViewers: providerData.liveViewers,
              suggestedTransition,
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
        liveViewers: providerData.liveViewers,
        providerStatus: providerData.providerStatus,
        recommendedAction,
        suggestedTransition,
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
