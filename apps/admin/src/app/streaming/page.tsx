'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { trpc } from '../../lib/trpc';

const providerOptions = ['YOUTUBE', 'FACEBOOK', 'VIMEO', 'CUSTOM_RTMP'] as const;
const moderationOptions = ['OPEN', 'FILTERED', 'STRICT'] as const;

export default function StreamingPage() {
  const utils = trpc.useUtils();
  const [churchId, setChurchId] = useState('');
  const [campusId, setCampusId] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelProvider, setChannelProvider] = useState<(typeof providerOptions)[number]>('YOUTUBE');
  const [playbackUrl, setPlaybackUrl] = useState('');
  const [ingestUrl, setIngestUrl] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionChannelId, setSessionChannelId] = useState('');
  const [sessionStartsAt, setSessionStartsAt] = useState('');
  const [moderationLevel, setModerationLevel] = useState<(typeof moderationOptions)[number]>('FILTERED');

  const { data: churches } = trpc.church.list.useQuery({});
  const { data: campuses } = trpc.campus.list.useQuery({ churchId: churchId || undefined });
  const { data: channels } = trpc.streaming.channels.useQuery({ churchId: churchId || undefined });
  const { data: sessions } = trpc.streaming.sessions.useQuery({ churchId: churchId || undefined, limit: 100 });
  const { data: analytics } = trpc.streaming.analytics.useQuery({ churchId: churchId || undefined });

  useEffect(() => {
    if (!churchId && churches?.length) {
      setChurchId(churches[0].id);
    }
  }, [churchId, churches]);

  const { mutate: createChannel, isPending: isCreatingChannel } = trpc.streaming.createChannel.useMutation({
    onSuccess: async (channel) => {
      setChannelName('');
      setPlaybackUrl('');
      setIngestUrl('');
      setSessionChannelId(channel.id);
      await utils.streaming.channels.invalidate();
    },
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

  return (
    <Shell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Streaming Ops</h1>
          <p className="mt-2 text-sm text-muted">Configure live channels, schedule sessions, and monitor stream outcomes.</p>
        </div>

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
          </div>
          <div className="mt-4">
            <Button
              disabled={!churchId || !channelName.trim() || isCreatingChannel}
              onClick={() =>
                createChannel({
                  churchId,
                  campusId: campusId || undefined,
                  name: channelName.trim(),
                  provider: channelProvider,
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
          </div>
          <div className="mt-4">
            <Button
              disabled={!churchId || !sessionChannelId || !sessionTitle.trim() || isCreatingSession}
              onClick={() =>
                createSession({
                  churchId,
                  channelId: sessionChannelId,
                  title: sessionTitle.trim(),
                  scheduledStartAt: sessionStartsAt ? new Date(sessionStartsAt) : undefined,
                  moderationLevel,
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
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{session.title}</p>
                  <p className="text-xs text-muted">{session.status}</p>
                </div>
                <p className="text-xs text-muted">{session.channel.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startSession({ id: session.id })}
                    disabled={session.status === 'LIVE'}
                  >
                    Go live
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => endSession({ id: session.id })}
                    disabled={session.status === 'ENDED' || session.status === 'CANCELED'}
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
          <h2 className="text-lg font-semibold">Analytics</h2>
          <div className="mt-4 grid gap-2 text-sm text-muted sm:grid-cols-2 lg:grid-cols-4">
            <p>Sessions: {analytics?.totals.sessions ?? 0}</p>
            <p>Live now: {analytics?.totals.liveSessions ?? 0}</p>
            <p>Peak viewers (sum): {analytics?.totals.peakViewers ?? 0}</p>
            <p>Total views: {analytics?.totals.totalViews ?? 0}</p>
          </div>
        </Card>
      </div>
    </Shell>
  );
}
