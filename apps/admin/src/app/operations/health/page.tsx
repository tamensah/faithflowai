'use client';

import { useState } from 'react';
import { Badge, Button, Card } from '@faithflow-ai/ui';
import { Shell } from '../../../components/Shell';
import { trpc } from '../../../lib/trpc';

function formatDate(value?: string | Date | null) {
  if (!value) return 'N/A';
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleString();
}

export default function OperationsHealthPage() {
  const utils = trpc.useUtils();
  const [message, setMessage] = useState<string | null>(null);
  const { data, isLoading, error } = trpc.operations.health.useQuery(undefined, { retry: false });
  const { data: checklist } = trpc.operations.goLiveChecklist.useQuery(undefined, { retry: false });
  const { mutate: sendTestEmail, isPending: isSendingTestEmail } = trpc.operations.sendTestEmail.useMutation({
    onSuccess: async () => {
      setMessage('Test email sent.');
      await utils.operations.health.invalidate();
    },
    onError: (err) => setMessage(err.message),
  });
  const { mutate: runUploadTest, isPending: isRunningUploadTest } = trpc.operations.uploadTest.useMutation({
    onSuccess: async (result) => {
      if (result.ok) {
        setMessage(`Storage upload test ok (${result.provider}) in ${result.latencyMs}ms.`);
      } else {
        setMessage('Storage upload test failed.');
      }
      await utils.operations.health.invalidate();
    },
    onError: (err) => setMessage(err.message),
  });

  return (
    <Shell>
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">Operational Health</h1>
            <p className="mt-2 text-sm text-muted">Configuration checks and recent signals for this tenant.</p>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              await utils.operations.health.invalidate();
            }}
          >
            Refresh
          </Button>
        </div>

        {isLoading ? <p className="text-sm text-muted">Loading health...</p> : null}
        {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
        {message ? (
          <Card className="p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <p>{message}</p>
              <button
                className="text-xs text-muted underline-offset-4 hover:underline"
                onClick={() => setMessage(null)}
                type="button"
              >
                Dismiss
              </button>
            </div>
          </Card>
        ) : null}

        {data ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-6">
              <h2 className="text-lg font-semibold">Database</h2>
              <p className="mt-2 text-sm text-muted">
                Status: {data.db.ok ? 'HEALTHY' : 'OUTAGE'} · Latency: {data.db.latencyMs}ms
              </p>
              <p className="mt-2 text-sm text-muted">
                Migrations:{' '}
                {data.migrations.ok
                  ? `${data.migrations.total ?? 0} applied · last: ${data.migrations.lastMigration?.name ?? 'N/A'}`
                  : 'unknown'}
              </p>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold">Providers</h2>
              <div className="mt-3 grid gap-2 text-sm text-muted sm:grid-cols-2">
                <p>Clerk: {data.providers.clerk ? 'configured' : 'missing'}</p>
                <p>Resend: {data.providers.resend ? 'configured' : 'missing'}</p>
                <p>Stripe: {data.providers.stripe ? 'configured' : 'missing'}</p>
                <p>Paystack: {data.providers.paystack ? 'configured' : 'missing'}</p>
                <p>Twilio: {data.providers.twilio ? 'configured' : 'missing'}</p>
                <p>Storage: {data.providers.storage ? 'configured' : 'missing'}</p>
                <p>Scheduler: {data.providers.scheduler}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSendingTestEmail || !data.providers.resend}
                  onClick={() => sendTestEmail({})}
                >
                  {isSendingTestEmail ? 'Sending...' : 'Send test email'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isRunningUploadTest || !data.providers.storage}
                  onClick={() => runUploadTest({})}
                >
                  {isRunningUploadTest ? 'Testing...' : 'Run storage upload test'}
                </Button>
              </div>
            </Card>

            <Card className="p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold">Go-live checklist</h2>
              <p className="mt-2 text-sm text-muted">Concrete setup steps based on current environment configuration.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {checklist?.items?.map((item) => (
                  <Card key={item.id} className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <Badge variant={item.status === 'OK' ? 'success' : item.status === 'MISSING' ? 'warning' : 'default'}>
                        {item.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted">{item.detail}</p>
                    <p className="mt-2 text-xs text-muted">
                      Env: <span className="text-foreground">{item.env.join(', ')}</span>
                    </p>
                  </Card>
                ))}
                {!checklist?.items?.length ? (
                  <p className="text-sm text-muted">Checklist unavailable.</p>
                ) : null}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold">Subscription</h2>
              {data.subscription ? (
                <div className="mt-3 space-y-2 text-sm text-muted">
                  <p className="text-foreground font-semibold">
                    {data.subscription.planName} ({data.subscription.planCode})
                  </p>
                  <p>
                    {data.subscription.status} · {data.subscription.provider}
                  </p>
                  <p>Trial ends: {formatDate(data.subscription.trialEndsAt)}</p>
                  <p>Period end: {formatDate(data.subscription.currentPeriodEnd)}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">No active subscription found.</p>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold">Recent Jobs</h2>
              <div className="mt-3 space-y-2 text-sm text-muted">
                <p>Trial reminders: {data.jobs.trialReminderLast ? formatDate(data.jobs.trialReminderLast.createdAt) : 'N/A'}</p>
                <p>Dunning queued: {data.jobs.dunningLast ? formatDate(data.jobs.dunningLast.createdAt) : 'N/A'}</p>
                <p>
                  Past-due expirations:{' '}
                  {data.jobs.pastDueExpireLast ? formatDate(data.jobs.pastDueExpireLast.createdAt) : 'N/A'}
                </p>
              </div>
            </Card>

            <Card className="p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold">Recent Webhooks</h2>
              <p className="mt-2 text-sm text-muted">Latest event per provider for this tenant.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(data.webhooks.latestByProvider).map(([provider, event]) => (
                  <Card key={provider} className="p-4">
                    <p className="text-sm font-semibold">{provider}</p>
                    <p className="mt-1 text-xs text-muted">{event.eventType}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Badge variant="default">{event.status}</Badge>
                      <span className="text-xs text-muted">{formatDate(event.receivedAt)}</span>
                    </div>
                    {event.error ? <p className="mt-2 text-xs text-destructive">{event.error}</p> : null}
                  </Card>
                ))}
              </div>
              {!Object.keys(data.webhooks.latestByProvider).length ? (
                <p className="mt-3 text-sm text-muted">No webhook events recorded yet.</p>
              ) : null}
            </Card>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
