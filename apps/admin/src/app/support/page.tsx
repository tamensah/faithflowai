'use client';

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@faithflow-ai/ui';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  Input,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Textarea,
} from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { trpc } from '../../lib/trpc';
import { useFeatureGate } from '../../lib/entitlements';
import { FeatureLocked } from '../../components/FeatureLocked';
import { ReadOnlyNotice } from '../../components/ReadOnlyNotice';

const priorityOptions = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
const platformStatusOptions = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'] as const;

type TenantTicket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
};

type PlatformTicket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  tenant: { name: string };
  firstResponseBreachedAt?: string | null;
  resolutionBreachedAt?: string | null;
};

type KBArticle = {
  id: string;
  title: string;
  category?: string | null;
  body: string;
  published: boolean;
};

export default function SupportPage() {
  const gate = useFeatureGate('support_center_enabled');
  const utils = trpc.useUtils();
  const canWrite = gate.canWrite;
  const { data: platformSelf } = trpc.platform.self.useQuery();

  // Queries
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
  const { data: kbArticles } = trpc.support.kbArticles.useQuery(
    { publishedOnly: false, limit: 100 },
    { enabled: Boolean(platformSelf?.platformUser) }
  );

  // Create ticket state
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<(typeof priorityOptions)[number]>('NORMAL');

  // Ticket thread sheet state
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reply, setReply] = useState('');
  const [internalNote, setInternalNote] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [status, setStatus] = useState<(typeof platformStatusOptions)[number]>('IN_PROGRESS');

  // KB state
  const [kbDialogOpen, setKbDialogOpen] = useState(false);
  const [kbTitle, setKbTitle] = useState('');
  const [kbBody, setKbBody] = useState('');
  const [kbCategory, setKbCategory] = useState('');
  const [kbPublished, setKbPublished] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState('');
  const [editKbTitle, setEditKbTitle] = useState('');
  const [editKbBody, setEditKbBody] = useState('');
  const [editKbCategory, setEditKbCategory] = useState('');
  const [editKbPublished, setEditKbPublished] = useState(false);

  const selectedTicket = useMemo(
    () =>
      tenantTickets?.find((t) => t.id === selectedTicketId) ??
      platformTickets?.find((t) => t.id === selectedTicketId) ??
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

  // KB deflection search
  const { data: deflectionResults } = trpc.support.kbSearch.useQuery(
    { query: subject, limit: 4 },
    { enabled: subject.trim().length >= 3 }
  );

  const thread = platformSelf?.platformUser ? (platformThread ?? tenantThread ?? []) : (tenantThread ?? []);

  // Mutations
  const { mutate: createTicket, isPending: isCreating } = trpc.support.createTicket.useMutation({
    onSuccess: async (ticket) => {
      setSubject('');
      setDescription('');
      setPriority('NORMAL');
      setSelectedTicketId(ticket.id);
      setSheetOpen(true);
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
  const { mutate: createKBArticle, isPending: isCreatingArticle } = trpc.support.createKBArticle.useMutation({
    onSuccess: async () => {
      setKbTitle('');
      setKbBody('');
      setKbCategory('');
      setKbPublished(false);
      setKbDialogOpen(false);
      await utils.support.kbArticles.invalidate();
    },
  });
  const { mutate: updateKBArticle } = trpc.support.updateKBArticle.useMutation({
    onSuccess: async () => {
      setEditingArticleId('');
      setEditDialogOpen(false);
      await utils.support.kbArticles.invalidate();
    },
  });
  const { mutate: deleteKBArticle } = trpc.support.deleteKBArticle.useMutation({
    onSuccess: async () => {
      await utils.support.kbArticles.invalidate();
    },
  });

  // Column definitions
  const ticketColumns: ColumnDef<TenantTicket>[] = [
    { accessorKey: 'subject', header: 'Subject' },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ getValue }) => {
        const val = String(getValue());
        return <Badge variant={val === 'URGENT' || val === 'HIGH' ? 'warning' : 'default'}>{val}</Badge>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const val = String(getValue());
        return <Badge variant={val === 'RESOLVED' || val === 'CLOSED' ? 'success' : 'default'}>{val}</Badge>;
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString(),
    },
  ];

  const platformTicketColumns: ColumnDef<PlatformTicket>[] = [
    { accessorKey: 'subject', header: 'Subject' },
    {
      accessorKey: 'tenant',
      header: 'Tenant',
      cell: ({ getValue }) => (getValue() as { name: string }).name,
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ getValue }) => {
        const val = String(getValue());
        return <Badge variant={val === 'URGENT' || val === 'HIGH' ? 'warning' : 'default'}>{val}</Badge>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const val = String(getValue());
        return <Badge variant={val === 'RESOLVED' || val === 'CLOSED' ? 'success' : 'default'}>{val}</Badge>;
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString(),
    },
  ];

  const kbColumns: ColumnDef<KBArticle>[] = [
    { accessorKey: 'title', header: 'Title' },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ getValue }) => String(getValue() ?? '—'),
    },
    {
      accessorKey: 'published',
      header: 'Status',
      cell: ({ getValue }) => (
        <Badge variant={getValue() ? 'success' : 'default'}>{getValue() ? 'Published' : 'Draft'}</Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outline"
            disabled={!canWrite}
            onClick={() => {
              const article = row.original as KBArticle;
              setEditingArticleId(article.id);
              setEditKbTitle(article.title);
              setEditKbCategory(article.category ?? '');
              setEditKbPublished(article.published);
              setEditKbBody('');
              setEditDialogOpen(true);
            }}
          >
            Edit
          </Button>
          <Button
            variant="outline"
            disabled={!canWrite}
            onClick={() => {
              const article = row.original as KBArticle;
              if (window.confirm(`Delete "${article.title}"?`)) deleteKBArticle({ id: article.id });
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const slaBreachColumns: ColumnDef<PlatformTicket>[] = [
    { accessorKey: 'subject', header: 'Subject' },
    { accessorKey: 'tenant', header: 'Tenant', cell: ({ getValue }) => (getValue() as { name: string }).name },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ getValue }) => <Badge variant="warning">{String(getValue())}</Badge>,
    },
    {
      id: 'breach',
      header: 'Breach type',
      cell: ({ row }) => {
        const t = row.original as PlatformTicket;
        const parts = [];
        if (t.firstResponseBreachedAt) parts.push('First response');
        if (t.resolutionBreachedAt) parts.push('Resolution');
        return <span className="text-xs text-muted">{parts.join(' · ') || '—'}</span>;
      },
    },
  ];

  return (
    <Shell>
      {!gate.isLoading && gate.access === 'locked' ? (
        <FeatureLocked
          featureKey="support_center_enabled"
          title="Support Center is locked"
          description="Your current subscription does not include the support center. Upgrade to restore access."
        />
      ) : (
        <div className="flex flex-col gap-6 p-4 sm:p-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">Support Center</h1>
            <p className="mt-1 text-sm text-muted">Open support tickets, collaborate on resolution, and track escalation status.</p>
          </div>

          {gate.readOnly ? <ReadOnlyNotice /> : null}

          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs text-muted">Open Tickets</p>
              <p className="mt-1 text-2xl font-bold">
                {tenantTickets?.filter((t) => !['RESOLVED', 'CLOSED'].includes(t.status)).length ?? 0}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted">Total Tickets</p>
              <p className="mt-1 text-2xl font-bold">{tenantTickets?.length ?? 0}</p>
            </Card>
            {platformSelf?.platformUser ? (
              <>
                <Card className="p-4">
                  <p className="text-xs text-muted">Platform Queue</p>
                  <p className="mt-1 text-2xl font-bold">{slaAnalytics?.totals.open ?? 0}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted">SLA Breaches</p>
                  <p className="mt-1 text-2xl font-bold">
                    {(slaAnalytics?.totals.breachedFirstResponse ?? 0) + (slaAnalytics?.totals.breachedResolution ?? 0)}
                  </p>
                </Card>
              </>
            ) : (
              <>
                <Card className="p-4">
                  <p className="text-xs text-muted">Avg Response</p>
                  <p className="mt-1 text-2xl font-bold">—</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted">Resolved</p>
                  <p className="mt-1 text-2xl font-bold">
                    {tenantTickets?.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status)).length ?? 0}
                  </p>
                </Card>
              </>
            )}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="tickets">
            <div className="sticky top-16 z-10 -mx-4 border-b border-border/50 bg-white/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
              <TabsList>
                <TabsTrigger value="tickets">My Tickets</TabsTrigger>
                {platformSelf?.platformUser ? <TabsTrigger value="queue">Queue & SLA</TabsTrigger> : null}
                {platformSelf?.platformUser ? <TabsTrigger value="kb">Knowledge Base</TabsTrigger> : null}
              </TabsList>
            </div>

            {/* My Tickets tab */}
            <TabsContent value="tickets" className="mt-4 space-y-4">
              <Card className="p-4 sm:p-6">
                <h2 className="text-base font-semibold">New Ticket</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                  <select
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as typeof priority)}
                  >
                    {priorityOptions.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  <Input
                    className="sm:col-span-2"
                    placeholder="Describe the issue"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                {deflectionResults && deflectionResults.length > 0 ? (
                  <div className="mt-3 rounded-md border border-border bg-muted/20 p-3">
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
                <div className="mt-3">
                  <Button
                    disabled={!canWrite || !subject.trim() || description.trim().length < 10 || isCreating}
                    onClick={() =>
                      createTicket({ subject: subject.trim(), description: description.trim(), priority })
                    }
                  >
                    {isCreating ? 'Creating...' : 'Create ticket'}
                  </Button>
                </div>
              </Card>

              <DataTable
                columns={ticketColumns as ColumnDef<unknown>[]}
                data={(tenantTickets ?? []) as unknown[]}
                searchKey="subject"
                onRowClick={(row) => {
                  const ticket = row as TenantTicket;
                  setSelectedTicketId(ticket.id);
                  setReply('');
                  setSheetOpen(true);
                }}
              />
            </TabsContent>

            {/* Queue & SLA tab (platform admins) */}
            {platformSelf?.platformUser ? (
              <TabsContent value="queue" className="mt-4 space-y-4">
                <Card className="p-4 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold">SLA Analytics (30 days)</h2>
                    <Button
                      variant="outline"
                      disabled={!canWrite || isRunningSlaSweep}
                      onClick={() => runSlaSweep({ dryRun: false })}
                    >
                      {isRunningSlaSweep ? 'Running...' : 'Run SLA sweep'}
                    </Button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[
                      { label: 'Open Queue', value: slaAnalytics?.totals.open ?? 0 },
                      { label: 'First Response Breaches', value: slaAnalytics?.totals.breachedFirstResponse ?? 0 },
                      { label: 'Resolution Breaches', value: slaAnalytics?.totals.breachedResolution ?? 0 },
                      { label: 'Avg First Response (min)', value: slaAnalytics?.averages.firstResponseMinutes ?? '—' },
                      { label: 'Avg Resolution (min)', value: slaAnalytics?.averages.resolutionMinutes ?? '—' },
                      { label: 'Reopened', value: slaAnalytics?.totals.reopened ?? 0 },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-md border border-border p-3">
                        <p className="text-xs text-muted">{label}</p>
                        <p className="mt-1 text-lg font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                {slaBreaches && slaBreaches.length > 0 ? (
                  <div>
                    <h2 className="mb-2 text-sm font-semibold text-muted">Active SLA Breaches</h2>
                    <DataTable
                      columns={slaBreachColumns as ColumnDef<unknown>[]}
                      data={(slaBreaches ?? []) as unknown[]}
                      searchKey="subject"
                      onRowClick={(row) => {
                        const ticket = row as PlatformTicket;
                        setSelectedTicketId(ticket.id);
                        setReply('');
                        setSheetOpen(true);
                      }}
                    />
                  </div>
                ) : null}

                <div>
                  <h2 className="mb-2 text-sm font-semibold text-muted">All Platform Tickets</h2>
                  <DataTable
                    columns={platformTicketColumns as ColumnDef<unknown>[]}
                    data={(platformTickets ?? []) as unknown[]}
                    searchKey="subject"
                    onRowClick={(row) => {
                      const ticket = row as PlatformTicket;
                      setSelectedTicketId(ticket.id);
                      setReply('');
                      setSheetOpen(true);
                    }}
                  />
                </div>
              </TabsContent>
            ) : null}

            {/* Knowledge Base tab (platform admins) */}
            {platformSelf?.platformUser ? (
              <TabsContent value="kb" className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted">
                    Published articles are suggested to tenants during ticket creation to deflect common issues.
                  </p>
                  <Button disabled={!canWrite} onClick={() => setKbDialogOpen(true)}>
                    New article
                  </Button>
                </div>
                <DataTable
                  columns={kbColumns as ColumnDef<unknown>[]}
                  data={(kbArticles ?? []) as unknown[]}
                  searchKey="title"
                />
              </TabsContent>
            ) : null}
          </Tabs>
        </div>
      )}

      {/* Ticket Thread Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selectedTicket?.subject ?? 'Ticket'}</SheetTitle>
          </SheetHeader>
          <SheetBody className="space-y-4">
            {platformSelf?.platformUser ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={assigneeId}
                  disabled={!canWrite}
                  onChange={(e) => setAssigneeId(e.target.value)}
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
                  onClick={() =>
                    assignPlatformTicket({ ticketId: selectedTicketId, platformUserId: assigneeId || undefined })
                  }
                >
                  Assign
                </Button>
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={status}
                  disabled={!canWrite}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                >
                  {platformStatusOptions.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  disabled={!canWrite}
                  onClick={() => updatePlatformTicket({ ticketId: selectedTicketId, status })}
                >
                  Update status
                </Button>
              </div>
            ) : null}

            {/* Thread */}
            <div className="space-y-2">
              {thread.map((message) => (
                <div key={message.id} className="rounded-md border border-border p-3 text-xs">
                  <p className="font-semibold">{message.authorType}</p>
                  <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                  <p className="mt-1 text-muted">{new Date(message.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {thread.length === 0 ? <p className="text-xs text-muted">No messages yet.</p> : null}
            </div>

            {/* Reply */}
            <div className="space-y-2">
              <Textarea
                placeholder="Write a reply"
                rows={3}
                value={reply}
                disabled={!canWrite}
                onChange={(e) => setReply(e.target.value)}
              />
              {platformSelf?.platformUser ? (
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={internalNote}
                    disabled={!canWrite}
                    onChange={(e) => setInternalNote(e.target.checked)}
                  />
                  Internal note (hidden from tenant)
                </label>
              ) : null}
              <Button
                disabled={!canWrite || !reply.trim() || isTenantReplying || isPlatformReplying}
                onClick={() => {
                  if (platformSelf?.platformUser) {
                    addPlatformMessage({ ticketId: selectedTicketId, body: reply.trim(), isInternal: internalNote });
                  } else {
                    addTenantMessage({ ticketId: selectedTicketId, body: reply.trim() });
                  }
                }}
              >
                {isTenantReplying || isPlatformReplying ? 'Sending...' : 'Send reply'}
              </Button>
            </div>
          </SheetBody>
        </SheetContent>
      </Sheet>

      {/* Create KB Article Dialog */}
      <Dialog
        open={kbDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setKbTitle('');
            setKbBody('');
            setKbCategory('');
            setKbPublished(false);
          }
          setKbDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New KB Article</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <Input
              placeholder="Article title"
              value={kbTitle}
              disabled={!canWrite}
              onChange={(e) => setKbTitle(e.target.value)}
            />
            <Input
              placeholder="Category (e.g. Billing, Streaming)"
              value={kbCategory}
              disabled={!canWrite}
              onChange={(e) => setKbCategory(e.target.value)}
            />
            <Textarea
              placeholder="Article body (markdown supported)"
              rows={5}
              value={kbBody}
              disabled={!canWrite}
              onChange={(e) => setKbBody(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={kbPublished}
                disabled={!canWrite}
                onChange={(e) => setKbPublished(e.target.checked)}
              />
              Publish immediately
            </label>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKbDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!canWrite || kbTitle.trim().length < 4 || kbBody.trim().length < 10 || isCreatingArticle}
              onClick={() =>
                createKBArticle({
                  title: kbTitle.trim(),
                  body: kbBody.trim(),
                  category: kbCategory.trim() || undefined,
                  published: kbPublished,
                })
              }
            >
              {isCreatingArticle ? 'Saving...' : 'Add article'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit KB Article Dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          if (!open) setEditingArticleId('');
          setEditDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Article</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <Input
              placeholder="Title"
              value={editKbTitle}
              disabled={!canWrite}
              onChange={(e) => setEditKbTitle(e.target.value)}
            />
            <Input
              placeholder="Category"
              value={editKbCategory}
              disabled={!canWrite}
              onChange={(e) => setEditKbCategory(e.target.value)}
            />
            <Textarea
              placeholder="Article body"
              rows={5}
              value={editKbBody}
              disabled={!canWrite}
              onChange={(e) => setEditKbBody(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editKbPublished}
                disabled={!canWrite}
                onChange={(e) => setEditKbPublished(e.target.checked)}
              />
              Published
            </label>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setEditingArticleId('');
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!canWrite}
              onClick={() =>
                updateKBArticle({
                  id: editingArticleId,
                  title: editKbTitle.trim(),
                  body: editKbBody.trim(),
                  category: editKbCategory.trim() || null,
                  published: editKbPublished,
                })
              }
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
