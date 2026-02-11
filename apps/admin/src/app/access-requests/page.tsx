'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Card } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { trpc } from '../../lib/trpc';

const statusOptions = ['PENDING', 'APPROVED', 'DENIED'] as const;

export default function AccessRequestsPage() {
  const utils = trpc.useUtils();
  const { data: churches } = trpc.church.list.useQuery({ organizationId: undefined });
  const [churchId, setChurchId] = useState('');
  const [status, setStatus] = useState<typeof statusOptions[number]>('PENDING');

  useEffect(() => {
    if (!churchId && churches?.length) {
      setChurchId(churches[0].id);
    }
  }, [churchId, churches]);

  const { data: requests } = trpc.member.listAccessRequests.useQuery({
    churchId: churchId || undefined,
    status: status as any,
    limit: 100,
  });

  const { mutate: approveRequest, isPending: isApproving } = trpc.member.approveAccessRequest.useMutation({
    onSuccess: async () => {
      await utils.member.listAccessRequests.invalidate();
      await utils.member.selfProfile.invalidate();
    },
  });

  const { mutate: denyRequest, isPending: isDenying } = trpc.member.denyAccessRequest.useMutation({
    onSuccess: async () => {
      await utils.member.listAccessRequests.invalidate();
    },
  });

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Member access requests</h1>
          <p className="mt-2 text-sm text-muted">Approve members requesting portal access.</p>
        </div>

        <Card className="p-6">
          <div className="flex flex-wrap gap-3">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm sm:w-60"
              value={churchId}
              onChange={(e) => setChurchId(e.target.value)}
            >
              <option value="">All churches</option>
              {churches?.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm sm:w-48"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof statusOptions[number])}
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </Card>

        <div className="space-y-4">
          {requests?.map((request) => (
            <Card key={request.id} className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{request.name ?? 'Member request'}</p>
                  <p className="text-xs text-muted">{request.email ?? 'No email provided'}</p>
                  <p className="text-xs text-muted">{request.church?.name ?? 'Church'}</p>
                  {request.message ? <p className="mt-2 text-sm text-muted">{request.message}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default">{request.status}</Badge>
                  {request.status === 'PENDING' ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => approveRequest({ id: request.id })}
                        disabled={isApproving}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => denyRequest({ id: request.id })}
                        disabled={isDenying}
                      >
                        Deny
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
          {!requests?.length && (
            <Card className="p-6">
              <p className="text-sm text-muted">No access requests yet.</p>
            </Card>
          )}
        </div>
      </div>
    </Shell>
  );
}
