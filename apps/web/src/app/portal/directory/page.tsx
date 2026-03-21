'use client';

import { Badge, Card } from '@faithflow-ai/ui';
import { trpc } from '../../../lib/trpc';

export default function DirectoryPage() {
  const { data: selfProfile } = trpc.member.selfProfile.useQuery(undefined, { retry: false });
  const churchId = selfProfile?.member?.churchId;

  const { data: directory } = trpc.member.directory.useQuery(
    { churchId, viewer: 'MEMBER' },
    { enabled: Boolean(churchId) }
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Member Directory</h2>
        <p className="text-sm text-muted">Browse fellow church members.</p>
      </div>
      <div className="space-y-2">
        {directory?.map((member) => (
          <div key={member.id} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {member.preferredName ?? member.firstName} {member.lastName}
              </p>
              <Badge variant="default">{member.directoryVisibility}</Badge>
            </div>
            <div className="mt-2 grid gap-2 text-sm text-muted sm:grid-cols-2">
              <p>Email: {member.email ?? '—'}</p>
              <p>Phone: {member.phone ?? '—'}</p>
              <p>
                Location:{' '}
                {[member.city, member.state, member.country].filter(Boolean).join(', ') || '—'}
              </p>
            </div>
          </div>
        ))}
        {!directory?.length ? <p className="text-sm text-muted">No directory entries available.</p> : null}
      </div>
    </div>
  );
}
