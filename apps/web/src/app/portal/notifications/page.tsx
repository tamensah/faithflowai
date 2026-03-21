'use client';

import { Badge, Button, Card } from '@faithflow-ai/ui';
import { trpc } from '../../../lib/trpc';

export default function NotificationsPage() {
  const { data: selfProfile } = trpc.member.selfProfile.useQuery(undefined, { retry: false });

  const { data: notifications } = trpc.notifications.listMine.useQuery(
    { limit: 15 },
    { enabled: Boolean(selfProfile) }
  );
  const { data: preferences } = trpc.notifications.listPreferences.useQuery(undefined, {
    enabled: Boolean(selfProfile),
  });

  const { mutate: markRead } = trpc.notifications.markRead.useMutation();
  const { mutate: updatePreference } = trpc.notifications.updatePreference.useMutation();

  return (
    <div className="space-y-6">
      <Card className="p-4 sm:p-6">
        <h2 className="text-base font-semibold">Notifications</h2>
        <p className="mt-1 text-sm text-muted">Your latest updates from church staff.</p>
        <div className="mt-4 space-y-2">
          {notifications?.map((notification) => (
            <div key={notification.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{notification.title}</p>
                  <p className="text-xs text-muted">{notification.body}</p>
                  <p className="text-xs text-muted">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
                {notification.readAt ? (
                  <Badge variant="default">Read</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markRead({ ids: [notification.id] })}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            </div>
          ))}
          {!notifications?.length ? (
            <p className="text-sm text-muted">No notifications yet.</p>
          ) : null}
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="text-base font-semibold">Notification Preferences</h2>
        <p className="mt-1 text-sm text-muted">Choose which channels you receive updates on.</p>
        <div className="mt-4 space-y-3">
          {(['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH'] as const).map((channel) => {
            const pref = preferences?.find((e) => e.channel === channel);
            return (
              <label key={channel} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={pref?.enabled ?? true}
                  onChange={(e) => updatePreference({ channel, enabled: e.target.checked })}
                />
                {channel.replace('_', ' ')}
              </label>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
