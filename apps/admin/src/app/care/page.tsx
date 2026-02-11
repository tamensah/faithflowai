'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { trpc } from '../../lib/trpc';

const priorityOptions = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
const channelOptions = ['WEB', 'MOBILE', 'STAFF', 'REFERRAL'] as const;
const statusOptions = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED', 'ARCHIVED'] as const;

export default function CarePage() {
  const utils = trpc.useUtils();
  const [churchId, setChurchId] = useState('');
  const [campusId, setCampusId] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [memberId, setMemberId] = useState('');

  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [priority, setPriority] = useState<typeof priorityOptions[number]>('NORMAL');
  const [channel, setChannel] = useState<typeof channelOptions[number]>('STAFF');
  const [dueAt, setDueAt] = useState('');

  const [statusFilter, setStatusFilter] = useState<'ALL' | typeof statusOptions[number]>('ALL');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const { data: churches } = trpc.church.list.useQuery({});
  const { data: campuses } = trpc.campus.list.useQuery({ churchId: churchId || undefined });
  const { data: staff } = trpc.staff.list.useQuery({ churchId: churchId || undefined });
  const { data: members } = trpc.member.list.useQuery(
    {
      churchId: churchId || undefined,
      query: memberQuery || undefined,
      limit: 25,
    },
    { enabled: Boolean(churchId) }
  );

  useEffect(() => {
    if (!churchId && churches?.length) {
      setChurchId(churches[0].id);
    }
  }, [churchId, churches]);

  const listInput = useMemo(
    () => ({
      churchId: churchId || undefined,
      campusId: campusId || undefined,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      limit: 100,
    }),
    [churchId, campusId, statusFilter]
  );

  const { data: requests } = trpc.care.listRequests.useQuery(listInput, { enabled: Boolean(churchId) });
  const { data: dashboard } = trpc.care.dashboard.useQuery(
    { churchId: churchId || undefined, campusId: campusId || undefined },
    { enabled: Boolean(churchId) }
  );

  const { mutate: createRequest, isPending: isCreating } = trpc.care.createRequest.useMutation({
    onSuccess: async () => {
      setTitle('');
      setDetails('');
      setPriority('NORMAL');
      setChannel('STAFF');
      setDueAt('');
      setMemberId('');
      await Promise.all([utils.care.listRequests.invalidate(), utils.care.dashboard.invalidate()]);
    },
  });

  const { mutate: updateStatus } = trpc.care.updateStatus.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.care.listRequests.invalidate(), utils.care.dashboard.invalidate()]);
    },
  });

  const { mutate: assignRequest } = trpc.care.assignRequest.useMutation({
    onSuccess: async () => {
      await utils.care.listRequests.invalidate();
    },
  });

  const { mutate: addNote } = trpc.care.addNote.useMutation({
    onSuccess: async (_, vars) => {
      setNoteDrafts((current) => ({ ...current, [vars.careRequestId]: '' }));
      await utils.care.listRequests.invalidate();
    },
  });

  const staffOptions = useMemo(
    () =>
      (staff ?? []).map((entry) => ({
        userId: entry.user.id,
        name: entry.user.name || entry.user.email,
      })),
    [staff]
  );

  return (
    <Shell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Pastoral Care</h1>
          <p className="mt-2 text-sm text-muted">Manage care intake, assignment, follow-ups, and status transitions.</p>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Scope & Summary</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={churchId}
              onChange={(event) => {
                setChurchId(event.target.value);
                setCampusId('');
                setMemberId('');
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
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'ALL' | typeof statusOptions[number])}
            >
              <option value="ALL">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-muted sm:grid-cols-3">
            <p>Active cases: {dashboard?.activeCases ?? 0}</p>
            <p>Overdue: {dashboard?.overdue ?? 0}</p>
            <p>Total listed: {requests?.length ?? 0}</p>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Create Care Request</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
            <Input placeholder="Details" value={details} onChange={(event) => setDetails(event.target.value)} />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={priority}
              onChange={(event) => setPriority(event.target.value as typeof priorityOptions[number])}
            >
              {priorityOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={channel}
              onChange={(event) => setChannel(event.target.value as typeof channelOptions[number])}
            >
              {channelOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            <Input
              placeholder="Search member (optional)"
              value={memberQuery}
              onChange={(event) => setMemberQuery(event.target.value)}
            />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm sm:col-span-2"
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
            >
              <option value="">No member selected</option>
              {members?.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4">
            <Button
              disabled={!churchId || !title.trim() || isCreating}
              onClick={() =>
                createRequest({
                  churchId,
                  campusId: campusId || undefined,
                  memberId: memberId || undefined,
                  title: title.trim(),
                  details: details.trim() || undefined,
                  priority,
                  channel,
                  dueAt: dueAt ? new Date(`${dueAt}T23:59:59.999Z`) : undefined,
                })
              }
            >
              {isCreating ? 'Creating...' : 'Create request'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Care Queue</h2>
          <div className="mt-4 space-y-3">
            {requests?.map((request) => (
              <div key={request.id} className="rounded-md border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{request.title}</p>
                    <p className="text-xs text-muted">
                      {request.priority} · {request.status}
                      {request.member ? ` · ${request.member.firstName} ${request.member.lastName}` : ''}
                    </p>
                  </div>
                  <select
                    className="h-9 rounded-md border border-border bg-white px-2 text-xs"
                    value={request.status}
                    onChange={(event) =>
                      updateStatus({
                        id: request.id,
                        status: event.target.value as typeof statusOptions[number],
                      })
                    }
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <select
                    className="h-9 rounded-md border border-border bg-white px-2 text-xs"
                    value={assignments[request.id] ?? request.assignedTo?.id ?? ''}
                    onChange={(event) => {
                      const userId = event.target.value;
                      setAssignments((current) => ({ ...current, [request.id]: userId }));
                      assignRequest({
                        id: request.id,
                        assignedToUserId: userId || undefined,
                      });
                    }}
                  >
                    <option value="">Unassigned</option>
                    {staffOptions.map((option) => (
                      <option key={option.userId} value={option.userId}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add note"
                      value={noteDrafts[request.id] ?? ''}
                      onChange={(event) =>
                        setNoteDrafts((current) => ({
                          ...current,
                          [request.id]: event.target.value,
                        }))
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!noteDrafts[request.id]?.trim()}
                      onClick={() =>
                        addNote({
                          careRequestId: request.id,
                          note: (noteDrafts[request.id] ?? '').trim(),
                        })
                      }
                    >
                      Note
                    </Button>
                  </div>
                </div>
                {request.details ? <p className="mt-3 text-xs text-muted">{request.details}</p> : null}
              </div>
            ))}
            {!requests?.length ? <p className="text-sm text-muted">No care requests found for this scope.</p> : null}
          </div>
        </Card>
      </div>
    </Shell>
  );
}
