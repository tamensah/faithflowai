'use client';

import { useState } from 'react';
import { Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { trpc } from '../../lib/trpc';
import { useFeatureGate } from '../../lib/entitlements';
import { FeatureLocked } from '../../components/FeatureLocked';

const providerOptions = ['openai', 'anthropic', 'google'] as const;

export default function AiAssistantPage() {
  const gate = useFeatureGate('ai_insights');
  const utils = trpc.useUtils();
  const [question, setQuestion] = useState('');
  const [provider, setProvider] = useState<(typeof providerOptions)[number]>('openai');
  const [model, setModel] = useState('');

  const { data: recent } = trpc.ai.recent.useQuery({ limit: 10 });
  const { data: starter } = trpc.ai.starterInsights.useQuery({});

  const { mutate: ask, data: response, isPending, error } = trpc.ai.ask.useMutation({
    onSuccess: async () => {
      await utils.ai.recent.invalidate();
    },
  });

  return (
    <Shell>
      {!gate.isLoading && !gate.enabled ? (
        <FeatureLocked
          featureKey="ai_insights"
          title="AI insights are locked"
          description="Your current subscription does not include AI insights. Upgrade to unlock Ask FaithFlow."
        />
      ) : (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Ask FaithFlow</h1>
          <p className="mt-2 text-sm text-muted">Tenant-scoped assistant with sources and audit logging.</p>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Starter insights</h2>
          <p className="mt-2 text-sm text-muted">Quick operational signals (last 30 days) to help staff take action.</p>
          <div className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-2">
            <p>Members: {starter?.membersTotal ?? 0}</p>
            <p>Upcoming events: {starter?.upcomingEvents ?? 0}</p>
            <p>
              Giving (30d): {starter?.giving?.last30Count ?? 0} gifts · {starter?.giving?.last30Sum ?? 0} total
            </p>
            <p>
              Attendance (30d): {starter?.attendance?.last30 ?? 0}{' '}
              {typeof starter?.attendance?.delta === 'number' ? `(${starter.attendance.delta >= 0 ? '+' : ''}${starter.attendance.delta})` : ''}
            </p>
            <p>Volunteer shifts (next 30d): {starter?.volunteer?.shiftsNext30 ?? 0}</p>
            <p>Shifts with gaps: {starter?.volunteer?.gaps?.length ?? 0}</p>
          </div>
          {starter?.volunteer?.gaps?.length ? (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-foreground">Top gaps</h3>
              <div className="mt-2 space-y-2 text-sm text-muted">
                {starter.volunteer.gaps.map((gap: any) => (
                  <div key={gap.id} className="rounded-md border border-border p-3">
                    <p className="font-medium text-foreground">{gap.title}</p>
                    <p className="text-xs text-muted">
                      {new Date(gap.startAt).toLocaleString()} · assigned {gap.assigned}/{gap.capacity} · gap {gap.gap}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Question</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={provider}
              onChange={(e) => setProvider(e.target.value as (typeof providerOptions)[number])}
            >
              {providerOptions.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model override (optional)" />
            <Button
              disabled={isPending || question.trim().length < 5}
              onClick={() => ask({ question, provider, model: model.trim() || undefined })}
            >
              {isPending ? 'Thinking...' : 'Ask'}
            </Button>
          </div>
          <textarea
            className="mt-4 min-h-[120px] w-full rounded-md border border-border bg-white p-3 text-sm"
            placeholder="Ask about attendance, giving, members, upcoming events, or operational status..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          {error ? <p className="mt-3 text-sm text-destructive">{error.message}</p> : null}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Answer</h2>
          {response ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-md bg-muted/10 p-4 text-sm whitespace-pre-wrap">{response.answer}</div>
              <div>
                <h3 className="text-sm font-semibold">Sources</h3>
                <div className="mt-2 space-y-2 text-sm text-muted">
                  {(response.sources ?? []).map((source: any, idx: number) => (
                    <div key={`${source.type}:${source.id}:${idx}`} className="rounded-md border border-border p-3">
                      <p className="text-xs text-muted">
                        [S{idx + 1}] {source.type} · {source.id} {source.timestamp ? `· ${new Date(source.timestamp).toLocaleString()}` : ''}
                      </p>
                      <p className="mt-1 text-sm text-foreground">{source.label}</p>
                    </div>
                  ))}
                  {!response.sources?.length ? <p>No sources.</p> : null}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">No answer yet.</p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Recent questions</h2>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {(recent ?? []).map((row) => (
              <div key={row.id} className="rounded-md border border-border p-3">
                <p className="text-xs text-muted">{new Date(row.createdAt).toLocaleString()} · {row.provider} · {row.model}</p>
                <p className="mt-1 text-sm text-foreground">{row.question}</p>
              </div>
            ))}
            {!recent?.length ? <p>No interactions yet.</p> : null}
          </div>
        </Card>
      </div>
      )}
    </Shell>
  );
}
