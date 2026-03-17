'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { PageSectionLayout } from '../../components/PageSectionLayout';
import { trpc } from '../../lib/trpc';
import { useFeatureGate } from '../../lib/entitlements';
import { FeatureLocked } from '../../components/FeatureLocked';
import { ReadOnlyNotice } from '../../components/ReadOnlyNotice';

const priorityOptions = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
const platformStatusOptions = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'] as const;

export default function SupportPage() {
  const gate = useFeatureGate('support_center_enabled');
  const utils = trpc.useUtils();
  const canWrite = gate.canWrite;
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

  // KB management state (platform admins)
  const [kbTitle, setKbTitle] = useState('');
  const [kbBody, setKbBody] = useState('');
  const [kbCategory, setKbCategory] = useState('');
  const [kbPublished, setKbPublished] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState('');
  const [editKbTitle, setEditKbTitle] = useState('');
  const [editKbBody, setEditKbBody] = useState('');
  const [editKbCategory, setEditKbCategory] = useState('');
  const [editKbPublished, setEditKbPublished] = useState(false);

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

  // Ticket deflection: search KB when subject has 3+ chars
  const { data: deflectionResults } = trpc.support.kbSearch.useQuery(
    { query: subject, limit: 4 },
    { enabled: subject.trim().length >= 3 }
  );

  // KB management (platform admins only)
  const { data: kbArticles } = trpc.support.kbArticles.useQuery(
    { publishedOnly: false, limit: 100 },
    { enabled: Boolean(platformSelf?.platformUser) }
  );
  const { mutate: createKBArticle, isPending: isCreatingArticle } = trpc.support.createKBArticle.useMutation({
    onSuccess: async () => {
      setKbTitle('');
      setKbBody('');
      setKbCategory('');
      setKbPublished(false);
      await utils.support.kbArticles.invalidate();
    },
  });
  const { mutate: updateKBArticle } = trpc.support.updateKBArticle.useMutation({
    onSuccess: async () => {
      setEditingArticleId('');
      await utils.support.kbArticles.invalidate();
    },
  });
  const { mutate: deleteKBArticle } = trpc.support.deleteKBArticle.useMutation({
    onSuccess: async () => {
      await utils.support.kbArticles.invalidate();
    },
  });

  const thread = platformSelf?.platformUser ? (platformThread ?? tenantThread ?? []) : (tenantThread ?? []);

  return (
    <Shell>
      {!gate.isLoading && gate.access === 'locked' ? (
        <FeatureLocked
          featureKey="support_center_enabled"
          title="Support Center is locked"
          description="Your current subscription does not include the support center. Upgrade to restore access."
        />
      ) : (
      <PageSectionLayout rootId="support-page-sections" title="Support sections" className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Support Center</h1>
          <p className="mt-2 text-sm text-muted">Open support tickets, collaborate on resolution, and track escalation status.</p>
        </div>

        {gate.readOnly ? <ReadOnlyNotice /> : null}

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
          {deflectionResults && deflectionResults.length > 0 ? (
            <div className="mt-4 rounded-md border border-border bg-muted/20 p-3">
              <p className="text-xs font-semibold text-muted">These articles may answer your question — check before submitting:</p>
              <ul className="mt-2 space-y-1.5">
                {deflectionResults.map((article) => (
                  <li key={article.id} className="text-xs">
                    <p className="font-medium">{article.title}</p>
                    {article.category ? <p className="text-muted">{article.category}</p> : null}
                    <p className="mt-0.5 line-clamp-2 text-muted">{article.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-4">
            <Button
              disabled={!canWrite || !subject.trim() || description.trim().length < 10 || isCreating}
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
              <Button variant="outline" disabled={!canWrite || isRunningSlaSweep} onClick={() => runSlaSweep({ dryRun: false })}>
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
                  disabled={!canWrite}
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
                  disabled={!canWrite}
                  onClick={() => assignPlatformTicket({ ticketId: selectedTicket.id, platformUserId: assigneeId || undefined })}
                >
                  Assign
                </Button>
                <select
                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  value={status}
                  disabled={!canWrite}
                  onChange={(event) => setStatus(event.target.value as (typeof platformStatusOptions)[number])}
                >
                  {platformStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <Button variant="outline" disabled={!canWrite} onClick={() => updatePlatformTicket({ ticketId: selectedTicket.id, status })}>
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
              <Input placeholder="Write a reply" value={reply} disabled={!canWrite} onChange={(event) => setReply(event.target.value)} />
              {platformSelf?.platformUser ? (
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={internalNote}
                    disabled={!canWrite}
                    onChange={(event) => setInternalNote(event.target.checked)}
                  />
                  Internal note (hidden from tenant)
                </label>
              ) : null}
              <Button
                disabled={!canWrite || !reply.trim() || isTenantReplying || isPlatformReplying}
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
        {platformSelf?.platformUser ? (
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Knowledge Base</h2>
            <p className="mt-1 text-xs text-muted">Published articles are suggested to tenants during ticket creation to deflect common issues.</p>

            <div className="mt-4 grid gap-3">
              <Input
                placeholder="Article title"
                value={kbTitle}
                disabled={!canWrite}
                onChange={(event) => setKbTitle(event.target.value)}
              />
              <Input
                placeholder="Category (e.g. Billing, Streaming)"
                value={kbCategory}
                disabled={!canWrite}
                onChange={(event) => setKbCategory(event.target.value)}
              />
              <textarea
                placeholder="Article body (markdown supported)"
                rows={4}
                value={kbBody}
                disabled={!canWrite}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm disabled:opacity-50"
                onChange={(event) => setKbBody(event.target.value)}
              />
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={kbPublished}
                    disabled={!canWrite}
                    onChange={(event) => setKbPublished(event.target.checked)}
                  />
                  Publish immediately
                </label>
                <Button
                  disabled={!canWrite || kbTitle.trim().length < 4 || kbBody.trim().length < 10 || isCreatingArticle}
                  onClick={() =>
                    createKBArticle({ title: kbTitle.trim(), body: kbBody.trim(), category: kbCategory.trim() || undefined, published: kbPublished })
                  }
                >
                  {isCreatingArticle ? 'Saving...' : 'Add article'}
                </Button>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {kbArticles?.map((article) => (
                <div key={article.id} className="rounded-md border border-border p-3 text-sm">
                  {editingArticleId === article.id ? (
                    <div className="grid gap-2">
                      <Input
                        value={editKbTitle}
                        disabled={!canWrite}
                        onChange={(event) => setEditKbTitle(event.target.value)}
                        placeholder="Title"
                      />
                      <Input
                        value={editKbCategory}
                        disabled={!canWrite}
                        onChange={(event) => setEditKbCategory(event.target.value)}
                        placeholder="Category"
                      />
                      <textarea
                        rows={3}
                        value={editKbBody}
                        disabled={!canWrite}
                        className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm disabled:opacity-50"
                        onChange={(event) => setEditKbBody(event.target.value)}
                      />
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={editKbPublished}
                            disabled={!canWrite}
                            onChange={(event) => setEditKbPublished(event.target.checked)}
                          />
                          Published
                        </label>
                        <Button
                          variant="outline"
                          disabled={!canWrite}
                          onClick={() =>
                            updateKBArticle({
                              id: article.id,
                              title: editKbTitle.trim(),
                              body: editKbBody.trim(),
                              category: editKbCategory.trim() || null,
                              published: editKbPublished,
                            })
                          }
                        >
                          Save
                        </Button>
                        <Button variant="outline" onClick={() => setEditingArticleId('')}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{article.title}</p>
                        {article.category ? <p className="text-xs text-muted">{article.category}</p> : null}
                        <Badge variant={article.published ? 'default' : 'warning'} className="mt-1 text-xs">
                          {article.published ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="outline"
                          disabled={!canWrite}
                          onClick={() => {
                            setEditingArticleId(article.id);
                            setEditKbTitle(article.title);
                            setEditKbCategory(article.category ?? '');
                            setEditKbPublished(article.published);
                            setEditKbBody('');
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!canWrite}
                          onClick={() => {
                            if (window.confirm(`Delete "${article.title}"?`)) deleteKBArticle({ id: article.id });
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {!kbArticles?.length ? <p className="text-sm text-muted">No articles yet. Add one above to start building the knowledge base.</p> : null}
            </div>
          </Card>
        ) : null}
      </PageSectionLayout>
      )}
    </Shell>
  );
}
