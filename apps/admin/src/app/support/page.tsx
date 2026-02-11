'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { trpc } from '../../lib/trpc';

const priorityOptions = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
const platformStatusOptions = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'] as const;

export default function SupportPage() {
  const utils = trpc.useUtils();
  const { data: platformSelf } = trpc.platform.self.useQuery();
  const { data: tenantTickets } = trpc.support.tenantTickets.useQuery({ limit: 100 });
  const { data: platformTickets } = trpc.support.platformTickets.useQuery(
    { limit: 120 },
    { enabled: Boolean(platformSelf?.platformUser) }
  );
  const { data: platformUsers } = trpc.platform.listUsers.useQuery(undefined, {
    enabled: Boolean(platformSelf?.platformUser),
  });
  const { data: slaAnalytics } = trpc.support.slaAnalytics.useQuery(
    { lookbackDays: 30 },
    { enabled: Boolean(platformSelf?.platformUser) }
  );
  const { data: slaBreaches } = trpc.support.slaBreaches.useQuery(
    { unresolvedOnly: true, limit: 50 },
    { enabled: Boolean(platformSelf?.platformUser) }
  );

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<(typeof priorityOptions)[number]>('NORMAL');
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [reply, setReply] = useState('');
  const [internalNote, setInternalNote] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [status, setStatus] = useState<(typeof platformStatusOptions)[number]>('IN_PROGRESS');

  const selectedTicket = useMemo(
    () =>
      tenantTickets?.find((ticket) => ticket.id === selectedTicketId) ??
      platformTickets?.find((ticket) => ticket.id === selectedTicketId) ??
      null,
    [selectedTicketId, tenantTickets, platformTickets]
  );

  const { data: tenantThread } = trpc.support.tenantTicketThread.useQuery(
    { ticketId: selectedTicketId },
    { enabled: Boolean(selectedTicketId) }
  );
  const { data: platformThread } = trpc.support.platformTicketThread.useQuery(
    { ticketId: selectedTicketId },
    { enabled: Boolean(selectedTicketId && platformSelf?.platformUser) }
  );

  const { mutate: createTicket, isPending: isCreating } = trpc.support.createTicket.useMutation({
    onSuccess: async (ticket) => {
      setSubject('');
      setDescription('');
      setPriority('NORMAL');
      setSelectedTicketId(ticket.id);
      await utils.support.tenantTickets.invalidate();
    },
  });
  const { mutate: addTenantMessage, isPending: isTenantReplying } = trpc.support.addTenantMessage.useMutation({
    onSuccess: async () => {
      setReply('');
      await Promise.all([utils.support.tenantTicketThread.invalidate(), utils.support.tenantTickets.invalidate()]);
    },
  });
  const { mutate: addPlatformMessage, isPending: isPlatformReplying } = trpc.support.addPlatformMessage.useMutation({
    onSuccess: async () => {
      setReply('');
      await Promise.all([
        utils.support.platformTicketThread.invalidate(),
        utils.support.platformTickets.invalidate(),
        utils.support.tenantTickets.invalidate(),
      ]);
    },
  });
  const { mutate: assignPlatformTicket } = trpc.support.assignPlatformTicket.useMutation({
    onSuccess: async () => {
      await utils.support.platformTickets.invalidate();
    },
  });
  const { mutate: updatePlatformTicket } = trpc.support.updatePlatformTicket.useMutation({
    onSuccess: async () => {
      await utils.support.platformTickets.invalidate();
    },
  });
  const { mutate: runSlaSweep, isPending: isRunningSlaSweep } = trpc.support.runSlaSweep.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.support.slaAnalytics.invalidate(),
        utils.support.slaBreaches.invalidate(),
        utils.support.platformTickets.invalidate(),
      ]);
    },
  });

  const thread = platformSelf?.platformUser ? (platformThread ?? tenantThread ?? []) : (tenantThread ?? []);

  return (
    <Shell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Support Center</h1>
          <p className="mt-2 text-sm text-muted">Open support tickets, collaborate on resolution, and track escalation status.</p>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Create Ticket</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input placeholder="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={priority}
              onChange={(event) => setPriority(event.target.value as (typeof priorityOptions)[number])}
            >
              {priorityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <Input
              className="sm:col-span-2"
              placeholder="Describe the issue"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="mt-4">
            <Button
              disabled={!subject.trim() || description.trim().length < 10 || isCreating}
              onClick={() =>
                createTicket({
                  subject: subject.trim(),
                  description: description.trim(),
                  priority,
                })
              }
            >
              {isCreating ? 'Creating...' : 'Create ticket'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Tenant Tickets</h2>
          <div className="mt-4 space-y-2">
            {tenantTickets?.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                className="w-full rounded-md border border-border p-3 text-left"
                onClick={() => setSelectedTicketId(ticket.id)}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{ticket.subject}</p>
                  <Badge variant="default">{ticket.status}</Badge>
                </div>
                <p className="text-xs text-muted">{ticket.priority}</p>
              </button>
            ))}
            {!tenantTickets?.length ? <p className="text-sm text-muted">No tickets yet.</p> : null}
          </div>
        </Card>

        {platformSelf?.platformUser ? (
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">SLA Analytics</h2>
              <Button variant="outline" disabled={isRunningSlaSweep} onClick={() => runSlaSweep({ dryRun: false })}>
                {isRunningSlaSweep ? 'Running...' : 'Run SLA sweep'}
              </Button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border p-3 text-xs">
                <p className="font-semibold">Open Queue</p>
                <p className="mt-1 text-muted">{slaAnalytics?.totals.open ?? 0}</p>
              </div>
              <div className="rounded-md border border-border p-3 text-xs">
                <p className="font-semibold">First Response SLA Breaches</p>
                <p className="mt-1 text-muted">{slaAnalytics?.totals.breachedFirstResponse ?? 0}</p>
              </div>
              <div className="rounded-md border border-border p-3 text-xs">
                <p className="font-semibold">Resolution SLA Breaches</p>
                <p className="mt-1 text-muted">{slaAnalytics?.totals.breachedResolution ?? 0}</p>
              </div>
              <div className="rounded-md border border-border p-3 text-xs">
                <p className="font-semibold">Avg First Response (min)</p>
                <p className="mt-1 text-muted">{slaAnalytics?.averages.firstResponseMinutes ?? 'n/a'}</p>
              </div>
              <div className="rounded-md border border-border p-3 text-xs">
                <p className="font-semibold">Avg Resolution (min)</p>
                <p className="mt-1 text-muted">{slaAnalytics?.averages.resolutionMinutes ?? 'n/a'}</p>
              </div>
              <div className="rounded-md border border-border p-3 text-xs">
                <p className="font-semibold">Reopened Tickets</p>
                <p className="mt-1 text-muted">{slaAnalytics?.totals.reopened ?? 0}</p>
              </div>
            </div>
          </Card>
        ) : null}

        {platformSelf?.platformUser ? (
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Platform Queue</h2>
            <div className="mt-4 space-y-2">
              {platformTickets?.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  className="w-full rounded-md border border-border p-3 text-left"
                  onClick={() => setSelectedTicketId(ticket.id)}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{ticket.subject}</p>
                    <Badge variant="default">{ticket.status}</Badge>
                  </div>
                  <p className="text-xs text-muted">
                    {ticket.tenant.name} · {ticket.priority}
                  </p>
                </button>
              ))}
              {!platformTickets?.length ? <p className="text-sm text-muted">No platform tickets queued.</p> : null}
            </div>
          </Card>
        ) : null}

        {platformSelf?.platformUser ? (
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Active SLA Breaches</h2>
            <div className="mt-4 space-y-2">
              {slaBreaches?.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  className="w-full rounded-md border border-border p-3 text-left"
                  onClick={() => setSelectedTicketId(ticket.id)}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{ticket.subject}</p>
                    <Badge variant="warning">{ticket.priority}</Badge>
                  </div>
                  <p className="text-xs text-muted">
                    {ticket.tenant.name} · first breach {ticket.firstResponseBreachedAt ? 'yes' : 'no'} · resolution breach{' '}
                    {ticket.resolutionBreachedAt ? 'yes' : 'no'}
                  </p>
                </button>
              ))}
              {!slaBreaches?.length ? <p className="text-sm text-muted">No active SLA breaches.</p> : null}
            </div>
          </Card>
        ) : null}

        {selectedTicket ? (
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Ticket Thread</h2>
            <p className="mt-1 text-xs text-muted">{selectedTicket.subject}</p>
            {platformSelf?.platformUser ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <select
                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  value={assigneeId}
                  onChange={(event) => setAssigneeId(event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {platformUsers?.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  onClick={() => assignPlatformTicket({ ticketId: selectedTicket.id, platformUserId: assigneeId || undefined })}
                >
                  Assign
                </Button>
                <select
                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as (typeof platformStatusOptions)[number])}
                >
                  {platformStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <Button variant="outline" onClick={() => updatePlatformTicket({ ticketId: selectedTicket.id, status })}>
                  Update status
                </Button>
              </div>
            ) : null}

            <div className="mt-4 space-y-2">
              {thread.map((message) => (
                <div key={message.id} className="rounded-md border border-border p-3 text-xs">
                  <p className="font-semibold">{message.authorType}</p>
                  <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                  <p className="mt-1 text-muted">{new Date(message.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              <Input placeholder="Write a reply" value={reply} onChange={(event) => setReply(event.target.value)} />
              {platformSelf?.platformUser ? (
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={internalNote}
                    onChange={(event) => setInternalNote(event.target.checked)}
                  />
                  Internal note (hidden from tenant)
                </label>
              ) : null}
              <Button
                disabled={!reply.trim() || isTenantReplying || isPlatformReplying}
                onClick={() => {
                  if (platformSelf?.platformUser) {
                    addPlatformMessage({ ticketId: selectedTicket.id, body: reply.trim(), isInternal: internalNote });
                  } else {
                    addTenantMessage({ ticketId: selectedTicket.id, body: reply.trim() });
                  }
                }}
              >
                {(isTenantReplying || isPlatformReplying) ? 'Sending...' : 'Send reply'}
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    </Shell>
  );
}
