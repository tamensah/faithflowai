'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { PageSectionLayout } from '../../components/PageSectionLayout';
import { trpc } from '../../lib/trpc';
import { useFeatureGate } from '../../lib/entitlements';
import { FeatureLocked } from '../../components/FeatureLocked';
import { ReadOnlyNotice } from '../../components/ReadOnlyNotice';

const providerOptions = ['YOUTUBE', 'FACEBOOK', 'VIMEO', 'CUSTOM_RTMP'] as const;
const moderationOptions = ['OPEN', 'FILTERED', 'STRICT'] as const;
const moderationActionOptions = ['WARN', 'MUTE_PARTICIPANT', 'REMOVE_PARTICIPANT', 'DELETE_MESSAGE', 'BAN_PARTICIPANT'] as const;

export default function StreamingPage() {
  const gate = useFeatureGate('streaming_enabled');
  const utils = trpc.useUtils();
  const canWrite = gate.canWrite;
  const [churchId, setChurchId] = useState('');
  const [campusId, setCampusId] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelProvider, setChannelProvider] = useState<(typeof providerOptions)[number]>('YOUTUBE');
  const [externalChannelId, setExternalChannelId] = useState('');
  const [playbackUrl, setPlaybackUrl] = useState('');
  const [ingestUrl, setIngestUrl] = useState('');
  const [editChannelId, setEditChannelId] = useState('');
  const [editExternalChannelId, setEditExternalChannelId] = useState('');
  const [editPlaybackUrl, setEditPlaybackUrl] = useState('');
  const [editIngestUrl, setEditIngestUrl] = useState('');
  const [editChannelStatus, setEditChannelStatus] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionChannelId, setSessionChannelId] = useState('');
  const [sessionStartsAt, setSessionStartsAt] = useState('');
  const [moderationLevel, setModerationLevel] = useState<(typeof moderationOptions)[number]>('FILTERED');
  const [isRecording, setIsRecording] = useState(true);
  const [syncLimit, setSyncLimit] = useState('200');
  const [syncStatus, setSyncStatus] = useState('');
  const [applySuggestedTransitions, setApplySuggestedTransitions] = useState(true);
  const [moderationSessionId, setModerationSessionId] = useState('');
  const [moderationActionType, setModerationActionType] = useState<(typeof moderationActionOptions)[number]>('WARN');
  const [moderationParticipantRef, setModerationParticipantRef] = useState('');
  const [moderationMessageRef, setModerationMessageRef] = useState('');
  const [moderationReason, setModerationReason] = useState('');
  const [moderationDurationMinutes, setModerationDurationMinutes] = useState('15');
  const [moderationStatus, setModerationStatus] = useState('');
  const [sessionModerationDraft, setSessionModerationDraft] = useState<Record<string, (typeof moderationOptions)[number]>>({});

  const { data: churches } = trpc.church.list.useQuery({});
  const { data: campuses } = trpc.campus.list.useQuery({ churchId: churchId || undefined });
  const { data: channels } = trpc.streaming.channels.useQuery({ churchId: churchId || undefined });
  const { data: sessions } = trpc.streaming.sessions.useQuery({ churchId: churchId || undefined, limit: 100 });
  const { data: analytics } = trpc.streaming.analytics.useQuery({ churchId: churchId || undefined });
  const parsedSyncLimit = Number.isFinite(Number(syncLimit)) ? Math.max(1, Math.min(500, Number(syncLimit))) : 200;
  const providerSyncPreview = trpc.streaming.providerSyncPreview.useQuery(
    { churchId: churchId || undefined, limit: parsedSyncLimit },
    { enabled: false, refetchOnWindowFocus: false }
  );
  const moderationTimeline = trpc.streaming.moderationTimeline.useQuery(
    { sessionId: moderationSessionId, limit: 50 },
    { enabled: Boolean(moderationSessionId) }
  );

  useEffect(() => {
    if (!churchId && churches?.length) {
      setChurchId(churches[0].id);
    }
  }, [churchId, churches]);

  useEffect(() => {
    if (!moderationSessionId && sessions?.length) {
      setModerationSessionId(sessions[0].id);
    }
  }, [moderationSessionId, sessions]);

  const { mutate: createChannel, isPending: isCreatingChannel } = trpc.streaming.createChannel.useMutation({
    onSuccess: async (channel) => {
      setChannelName('');
      setExternalChannelId('');
      setPlaybackUrl('');
      setIngestUrl('');
      setSessionChannelId(channel.id);
      await utils.streaming.channels.invalidate();
    },
  });
  const { mutate: updateChannel, isPending: isUpdatingChannel } = trpc.streaming.updateChannel.useMutation({
    onSuccess: async () => {
      setEditChannelStatus('Channel updated.');
      await utils.streaming.channels.invalidate();
    },
    onError: (error) => setEditChannelStatus(error.message),
  });
  const { mutate: createSession, isPending: isCreatingSession } = trpc.streaming.createSession.useMutation({
    onSuccess: async () => {
      setSessionTitle('');
      setSessionStartsAt('');
      await utils.streaming.sessions.invalidate();
      await utils.streaming.analytics.invalidate();
    },
  });
  const { mutate: startSession } = trpc.streaming.startSession.useMutation({
    onSuccess: async () => {
      await utils.streaming.sessions.invalidate();
    },
  });
  const { mutate: endSession } = trpc.streaming.endSession.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.streaming.sessions.invalidate(), utils.streaming.analytics.invalidate()]);
    },
  });
  const { mutate: runProviderSync, isPending: isRunningProviderSync } = trpc.streaming.runProviderSync.useMutation({
    onSuccess: async (result) => {
      setSyncStatus(`Synced ${result.scanned} session(s): ${result.updated} updated, ${result.failed} failed.`);
      await Promise.all([utils.streaming.sessions.invalidate(), utils.streaming.analytics.invalidate()]);
    },
    onError: (error) => setSyncStatus(error.message),
  });
  const { mutate: setModerationForSession, isPending: isSettingModeration } = trpc.streaming.setModerationLevel.useMutation({
    onSuccess: async (session) => {
      setModerationStatus(`Moderation level updated for ${session.title}.`);
      await utils.streaming.sessions.invalidate();
    },
    onError: (error) => setModerationStatus(error.message),
  });
  const { mutate: recordModerationAction, isPending: isRecordingModerationAction } =
    trpc.streaming.recordModerationAction.useMutation({
      onSuccess: async () => {
        setModerationStatus('Moderation action recorded.');
        setModerationReason('');
        setModerationParticipantRef('');
        setModerationMessageRef('');
        await utils.streaming.moderationTimeline.invalidate();
      },
      onError: (error) => setModerationStatus(error.message),
    });

  return (
    <Shell>
      {!gate.isLoading && gate.access === 'locked' ? (
        <FeatureLocked
          featureKey="streaming_enabled"
          title="Streaming is locked"
          description="Your current subscription does not include streaming operations. Upgrade to unlock channels and sessions."
        />
      ) : (
        <PageSectionLayout rootId="streaming-page-sections" title="Streaming sections" className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold">Streaming Ops</h1>
            <p className="mt-2 text-sm text-muted">
              Configure live channels, schedule sessions, and monitor stream outcomes.
            </p>
          </div>

          {gate.readOnly ? <ReadOnlyNotice /> : null}

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Scope</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={churchId}
              onChange={(event) => {
                setChurchId(event.target.value);
                setCampusId('');
              }}
            >
              <option value="">Select church</option>
              {churches?.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={campusId}
              onChange={(event) => setCampusId(event.target.value)}
            >
              <option value="">All campuses</option>
              {campuses?.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </select>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Create channel</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Sunday Broadcast"
              value={channelName}
              onChange={(event) => setChannelName(event.target.value)}
            />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={channelProvider}
              onChange={(event) => setChannelProvider(event.target.value as (typeof providerOptions)[number])}
            >
              {providerOptions.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
            <Input placeholder="Playback URL" value={playbackUrl} onChange={(event) => setPlaybackUrl(event.target.value)} />
            <Input placeholder="Ingest URL" value={ingestUrl} onChange={(event) => setIngestUrl(event.target.value)} />
            <Input
              placeholder="External ID (broadcast/video ID for provider API)"
              value={externalChannelId}
              onChange={(event) => setExternalChannelId(event.target.value)}
            />
          </div>
          <div className="mt-4">
            <Button
              disabled={!canWrite || !churchId || !channelName.trim() || isCreatingChannel}
              onClick={() =>
                createChannel({
                  churchId,
                  campusId: campusId || undefined,
                  name: channelName.trim(),
                  provider: channelProvider,
                  externalChannelId: externalChannelId.trim() || undefined,
                  playbackUrl: playbackUrl.trim() || undefined,
                  ingestUrl: ingestUrl.trim() || undefined,
                })
              }
            >
              {isCreatingChannel ? 'Creating...' : 'Create channel'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Channels</h2>
          <div className="mt-4 space-y-3">
            {channels?.map((channel) => (
              <div key={channel.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{channel.name}</p>
                    <p className="text-xs text-muted">{channel.provider} · {channel.isActive ? 'Active' : 'Inactive'}</p>
                    {channel.externalChannelId ? (
                      <p className="text-xs text-muted">External ID: {channel.externalChannelId}</p>
                    ) : (
                      <p className="text-xs text-amber-600">No external ID — provider API unavailable</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditChannelId(channel.id);
                      setEditExternalChannelId(channel.externalChannelId ?? '');
                      setEditPlaybackUrl(channel.playbackUrl ?? '');
                      setEditIngestUrl(channel.ingestUrl ?? '');
                      setEditChannelStatus('');
                    }}
                  >
                    Edit
                  </Button>
                </div>
                {editChannelId === channel.id ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Input
                      placeholder="External ID (broadcast/video ID)"
                      value={editExternalChannelId}
                      onChange={(event) => setEditExternalChannelId(event.target.value)}
                    />
                    <Input
                      placeholder="Playback URL"
                      value={editPlaybackUrl}
                      onChange={(event) => setEditPlaybackUrl(event.target.value)}
                    />
                    <Input
                      placeholder="Ingest URL"
                      value={editIngestUrl}
                      onChange={(event) => setEditIngestUrl(event.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={!canWrite || isUpdatingChannel}
                        onClick={() =>
                          updateChannel({
                            id: channel.id,
                            externalChannelId: editExternalChannelId.trim() || null,
                            playbackUrl: editPlaybackUrl.trim() || null,
                            ingestUrl: editIngestUrl.trim() || null,
                          })
                        }
                      >
                        {isUpdatingChannel ? 'Saving...' : 'Save'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditChannelId('')}>
                        Cancel
                      </Button>
                    </div>
                    {editChannelStatus ? <p className="col-span-2 text-xs text-muted">{editChannelStatus}</p> : null}
                  </div>
                ) : null}
              </div>
            ))}
            {!channels?.length ? <p className="text-sm text-muted">No channels yet. Create one above.</p> : null}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Schedule session</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={sessionChannelId}
              onChange={(event) => setSessionChannelId(event.target.value)}
            >
              <option value="">Select channel</option>
              {channels?.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}
                </option>
              ))}
            </select>
            <Input
              placeholder="Session title"
              value={sessionTitle}
              onChange={(event) => setSessionTitle(event.target.value)}
            />
            <Input type="datetime-local" value={sessionStartsAt} onChange={(event) => setSessionStartsAt(event.target.value)} />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={moderationLevel}
              onChange={(event) => setModerationLevel(event.target.value as (typeof moderationOptions)[number])}
            >
              {moderationOptions.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={isRecording}
                onChange={(event) => setIsRecording(event.target.checked)}
              />
              Record this session
            </label>
          </div>
          <div className="mt-4">
            <Button
              disabled={!canWrite || !churchId || !sessionChannelId || !sessionTitle.trim() || isCreatingSession}
              onClick={() =>
                createSession({
                  churchId,
                  channelId: sessionChannelId,
                  title: sessionTitle.trim(),
                  scheduledStartAt: sessionStartsAt ? new Date(sessionStartsAt) : undefined,
                  moderationLevel,
                  isRecording,
                })
              }
            >
              {isCreatingSession ? 'Scheduling...' : 'Schedule session'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Sessions</h2>
          <div className="mt-4 space-y-3">
            {sessions?.map((session) => (
              <div key={session.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{session.title}</p>
                    <p className="text-xs text-muted">
                      {session.channel.name}
                      {session.event ? ` · ${session.event.title}` : ''}
                      {session.scheduledStartAt
                        ? ` · ${new Date(session.scheduledStartAt).toLocaleString()}`
                        : ''}
                    </p>
                    {(session.peakViewers > 0 || session.totalViews > 0) ? (
                      <p className="text-xs text-muted">
                        Peak viewers: {session.peakViewers} · Total views: {session.totalViews}
                      </p>
                    ) : null}
                    {session.recordingUrl ? (
                      <a
                        href={session.recordingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline text-muted hover:text-foreground"
                      >
                        Recording
                      </a>
                    ) : session.isRecording && session.status === 'ENDED' ? (
                      <p className="text-xs text-amber-600">Recording expected — URL not yet ingested</p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-xs font-medium text-muted">{session.status}</p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-border bg-white px-2 text-xs"
                    value={sessionModerationDraft[session.id] ?? session.moderationLevel}
                    onChange={(event) =>
                      setSessionModerationDraft((current) => ({
                        ...current,
                        [session.id]: event.target.value as (typeof moderationOptions)[number],
                      }))
                    }
                  >
                    {moderationOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setModerationForSession({
                        sessionId: session.id,
                        moderationLevel: sessionModerationDraft[session.id] ?? session.moderationLevel,
                      })
                    }
                    disabled={
                      !canWrite ||
                      isSettingModeration ||
                      (sessionModerationDraft[session.id] ?? session.moderationLevel) === session.moderationLevel
                    }
                  >
                    Save moderation
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startSession({ id: session.id })}
                    disabled={!canWrite || session.status !== 'SCHEDULED'}
                  >
                    Go live
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => endSession({ id: session.id })}
                    disabled={!canWrite || session.status === 'ENDED' || session.status === 'CANCELED'}
                  >
                    End stream
                  </Button>
                </div>
              </div>
            ))}
            {!sessions?.length ? <p className="text-sm text-muted">No streaming sessions yet.</p> : null}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Provider sync</h2>
          <p className="mt-1 text-sm text-muted">
            Preview provider reachability checks and reconcile session status from the provider signal.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              type="number"
              min={1}
              max={500}
              value={syncLimit}
              onChange={(event) => setSyncLimit(event.target.value)}
              placeholder="Sync limit"
            />
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={applySuggestedTransitions}
                onChange={(event) => setApplySuggestedTransitions(event.target.checked)}
              />
              Apply suggested transitions (SCHEDULED → LIVE, LIVE → ENDED)
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={providerSyncPreview.isFetching}
              onClick={async () => {
                const result = await providerSyncPreview.refetch();
                setSyncStatus(
                  result.data
                    ? `Preview scanned ${result.data.scanned} session(s), ${result.data.failed} check(s) failed.`
                    : 'No preview data available.'
                );
              }}
            >
              {providerSyncPreview.isFetching ? 'Running preview...' : 'Preview sync'}
            </Button>
            <Button
              disabled={!canWrite || isRunningProviderSync}
              onClick={() =>
                runProviderSync({
                  churchId: churchId || undefined,
                  limit: parsedSyncLimit,
                  applySuggestedTransitions,
                })
              }
            >
              {isRunningProviderSync ? 'Running sync...' : 'Run provider sync'}
            </Button>
          </div>
          {syncStatus ? <p className="mt-3 text-sm text-muted">{syncStatus}</p> : null}
          <div className="mt-4 space-y-2">
            {(providerSyncPreview.data?.entries ?? []).slice(0, 8).map((entry) => (
              <div key={entry.sessionId} className="rounded-md border border-border p-3 text-xs text-muted">
                <p className="font-medium text-foreground">{entry.sessionId}</p>
                <p>
                  Status <span className="font-medium text-foreground">{entry.status}</span>
                  {' · '}Playback {entry.playbackReachable ? 'reachable' : 'unreachable'} ({entry.playbackStatusCode ?? 'n/a'})
                  {entry.providerStatus ? ` · Provider: ${entry.providerStatus}` : ''}
                  {entry.liveViewers != null ? ` · ${entry.liveViewers} live viewers` : ''}
                </p>
                {entry.suggestedTransition !== 'NONE' ? (
                  <p className="mt-1 font-medium text-amber-700">
                    Suggested: {entry.suggestedTransition.replace('_', ' → ')}
                  </p>
                ) : null}
                <p className="mt-1">{entry.recommendedAction}</p>
              </div>
            ))}
            {!providerSyncPreview.data?.entries?.length ? (
              <p className="text-sm text-muted">Run preview to inspect provider state.</p>
            ) : null}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Moderation controls</h2>
          <p className="mt-1 text-sm text-muted">Record moderation interventions and review timeline entries.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={moderationSessionId}
              onChange={(event) => setModerationSessionId(event.target.value)}
            >
              <option value="">Select session</option>
              {sessions?.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title}
                </option>
              ))}
            </select>
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={moderationActionType}
              onChange={(event) => setModerationActionType(event.target.value as (typeof moderationActionOptions)[number])}
            >
              {moderationActionOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <Input
              placeholder="Participant ref (optional)"
              value={moderationParticipantRef}
              onChange={(event) => setModerationParticipantRef(event.target.value)}
            />
            <Input
              placeholder="Message ref (optional)"
              value={moderationMessageRef}
              onChange={(event) => setModerationMessageRef(event.target.value)}
            />
            <Input
              type="number"
              min={1}
              max={1440}
              placeholder="Duration minutes"
              value={moderationDurationMinutes}
              onChange={(event) => setModerationDurationMinutes(event.target.value)}
            />
            <Input
              placeholder="Reason"
              value={moderationReason}
              onChange={(event) => setModerationReason(event.target.value)}
            />
          </div>
          <div className="mt-4">
            <Button
              disabled={!canWrite || !moderationSessionId || moderationReason.trim().length < 2 || isRecordingModerationAction}
              onClick={() =>
                recordModerationAction({
                  sessionId: moderationSessionId,
                  actionType: moderationActionType,
                  participantRef: moderationParticipantRef.trim() || undefined,
                  messageRef: moderationMessageRef.trim() || undefined,
                  reason: moderationReason.trim(),
                  durationMinutes: (() => {
                    const parsed = Number.parseInt(moderationDurationMinutes, 10);
                    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
                  })(),
                })
              }
            >
              {isRecordingModerationAction ? 'Saving action...' : 'Record moderation action'}
            </Button>
          </div>
          {moderationStatus ? <p className="mt-3 text-sm text-muted">{moderationStatus}</p> : null}
          <div className="mt-4 space-y-2">
            {(moderationTimeline.data ?? []).map((entry) => (
              <div key={entry.id} className="rounded-md border border-border p-3 text-xs text-muted">
                <p className="font-medium text-foreground">{entry.action}</p>
                <p>{new Date(entry.createdAt).toLocaleString()}</p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(entry.metadata ?? {}, null, 2)}</pre>
              </div>
            ))}
            {moderationSessionId && !moderationTimeline.data?.length ? (
              <p className="text-sm text-muted">No moderation actions recorded for this session yet.</p>
            ) : null}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Analytics</h2>
          <div className="mt-4 grid gap-2 text-sm text-muted sm:grid-cols-2 lg:grid-cols-4">
            <p>Sessions: {analytics?.totals.sessions ?? 0}</p>
            <p>Live now: {analytics?.totals.liveSessions ?? 0}</p>
            <p>Peak viewers (sum): {analytics?.totals.peakViewers ?? 0}</p>
            <p>Total views: {analytics?.totals.totalViews ?? 0}</p>
          </div>
        </Card>
        </PageSectionLayout>
      )}
    </Shell>
  );
}
