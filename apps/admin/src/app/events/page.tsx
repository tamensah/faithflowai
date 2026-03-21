'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Input,
  Badge,
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
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
import type { ColumnDef } from '@faithflow-ai/ui';
import QRCode from 'qrcode';
import { trpc } from '../../lib/trpc';
import { Shell } from '../../components/Shell';
import { useFeatureGate } from '../../lib/entitlements';
import { FeatureLocked } from '../../components/FeatureLocked';
import { ReadOnlyNotice } from '../../components/ReadOnlyNotice';
import { EmptyState } from '../../components/EmptyState';
import { useKeyboardShortcuts } from '../../lib/useKeyboardShortcuts';

// ── Helpers ────────────────────────────────────────────────────────────────
const EVENT_TYPES = ['SERVICE', 'BIBLE_STUDY', 'FUNDRAISER', 'CEREMONY', 'MEETING', 'CONFERENCE', 'OTHER'];
const EVENT_FORMATS = ['IN_PERSON', 'ONLINE', 'HYBRID'];
const EVENT_VISIBILITIES = ['PUBLIC', 'MEMBERS_ONLY', 'LEADERS_ONLY'];
const FIELD_TYPES = ['TEXT', 'EMAIL', 'PHONE', 'NUMBER', 'DATE', 'SELECT', 'MULTI_SELECT', 'CHECKBOX'];
const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function RegistrationFieldBuilder({
  fields,
  onAdd,
  onRemove,
  canWrite,
}: {
  fields: any[];
  onAdd: (field: any) => void;
  onRemove: (id: string) => void;
  canWrite: boolean;
}) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState('TEXT');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState('');

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <Input placeholder="Field label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
          {FIELD_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
        <Input placeholder="Options (comma)" value={options} onChange={(e) => setOptions(e.target.value)} />
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
            Required
          </label>
          <Button
            variant="outline"
            size="sm"
            disabled={!canWrite || !label}
            onClick={() => {
              onAdd({ id: crypto.randomUUID(), label, type, required, options: options ? options.split(',').map((o) => o.trim()).filter(Boolean) : undefined });
              setLabel(''); setType('TEXT'); setRequired(false); setOptions('');
            }}
          >
            Add
          </Button>
        </div>
      </div>
      {fields.map((field) => (
        <div key={field.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-white px-3 py-2 text-xs">
          <span>{field.label} · {field.type} {field.required ? '(required)' : ''}</span>
          <Button size="sm" variant="outline" disabled={!canWrite} onClick={() => onRemove(field.id)}>Remove</Button>
        </div>
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function EventsPage() {
  const gate = useFeatureGate('events_enabled');
  const utils = trpc.useUtils();
  const canWrite = gate.canWrite;

  const [churchId, setChurchId] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [eventSheetOpen, setEventSheetOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState('overview');

  // Create event dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState('SERVICE');
  const [eventFormat, setEventFormat] = useState('IN_PERSON');
  const [eventVisibility, setEventVisibility] = useState('PUBLIC');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [location, setLocation] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [capacity, setCapacity] = useState('');
  const [requiresRsvp, setRequiresRsvp] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [registrationLimit, setRegistrationLimit] = useState('');
  const [waitlistEnabled, setWaitlistEnabled] = useState(true);
  const [allowGuestRegistration, setAllowGuestRegistration] = useState(true);
  const [registrationFields, setRegistrationFields] = useState<any[]>([]);
  const createEventTitleRef = useRef<HTMLInputElement | null>(null);

  // Create series dialog
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [seriesTitle, setSeriesTitle] = useState('');
  const [seriesDescription, setSeriesDescription] = useState('');
  const [seriesType, setSeriesType] = useState('SERVICE');
  const [seriesFormat, setSeriesFormat] = useState('IN_PERSON');
  const [seriesVisibility, setSeriesVisibility] = useState('PUBLIC');
  const [seriesStartDate, setSeriesStartDate] = useState('');
  const [seriesEndDate, setSeriesEndDate] = useState('');
  const [seriesStartTime, setSeriesStartTime] = useState('09:00');
  const [seriesEndTime, setSeriesEndTime] = useState('10:00');
  const [seriesFrequency, setSeriesFrequency] = useState('WEEKLY');
  const [seriesWeekdays, setSeriesWeekdays] = useState<string[]>(['SUNDAY']);
  const [seriesOccurrences, setSeriesOccurrences] = useState('12');
  const [seriesLocation, setSeriesLocation] = useState('');
  const [seriesMeetingUrl, setSeriesMeetingUrl] = useState('');
  const [seriesCoverImageUrl, setSeriesCoverImageUrl] = useState('');
  const [seriesCapacity, setSeriesCapacity] = useState('');
  const [seriesRequiresRsvp, setSeriesRequiresRsvp] = useState(false);
  const [seriesRegistrationEnabled, setSeriesRegistrationEnabled] = useState(false);
  const [seriesRegistrationLimit, setSeriesRegistrationLimit] = useState('');
  const [seriesWaitlistEnabled, setSeriesWaitlistEnabled] = useState(true);
  const [seriesAllowGuestRegistration, setSeriesAllowGuestRegistration] = useState(true);
  const [seriesRegistrationFields, setSeriesRegistrationFields] = useState<any[]>([]);

  // Check-in
  const [checkInSearch, setCheckInSearch] = useState('');
  const [checkInCode, setCheckInCode] = useState('');
  const [checkInUrl, setCheckInUrl] = useState('');
  const [checkInQr, setCheckInQr] = useState('');
  const [checkInEnabled, setCheckInEnabled] = useState(false);
  const [badgeCodeInput, setBadgeCodeInput] = useState('');
  const [badgeStats, setBadgeStats] = useState<{ created?: number }>({});
  const checkInSearchRef = useRef<HTMLInputElement | null>(null);

  // Tickets
  const [ticketName, setTicketName] = useState('');
  const [ticketPrice, setTicketPrice] = useState('');
  const [ticketCurrency, setTicketCurrency] = useState('USD');
  const [ticketCapacity, setTicketCapacity] = useState('');

  // Assignments
  const [assignmentRole, setAssignmentRole] = useState('SPEAKER');
  const [assignmentMemberId, setAssignmentMemberId] = useState('');
  const [assignmentName, setAssignmentName] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [assignmentSearch, setAssignmentSearch] = useState('');

  // Media
  const [mediaType, setMediaType] = useState('PHOTO');
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaDescription, setMediaDescription] = useState('');
  const [mediaIsPublic, setMediaIsPublic] = useState(true);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Communications
  const [playbookChannels, setPlaybookChannels] = useState<string[]>(['EMAIL', 'SMS']);
  const [playbookStats, setPlaybookStats] = useState<{ scheduled?: number }>({});

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: churches } = trpc.church.list.useQuery({});
  const { data: events, isLoading: isLoadingEvents } = trpc.event.list.useQuery({ churchId: churchId || undefined });
  const { data: members } = trpc.member.list.useQuery({ churchId: churchId || undefined, query: assignmentSearch || undefined }, { enabled: Boolean(churchId) });
  const { data: series } = trpc.event.listSeries.useQuery({ churchId: churchId || undefined }, { enabled: Boolean(churchId) });
  const { data: checkInInfo } = trpc.event.checkInInfo.useQuery({ eventId: selectedEventId }, { enabled: Boolean(selectedEventId) });
  const { data: roster } = trpc.attendance.eventRoster.useQuery({ eventId: selectedEventId, query: checkInSearch || undefined, limit: 200 }, { enabled: Boolean(selectedEventId) });
  const { data: ticketTypes } = trpc.event.listTicketTypes.useQuery({ eventId: selectedEventId }, { enabled: Boolean(selectedEventId) });
  const { data: ticketOrders } = trpc.event.listTicketOrders.useQuery({ eventId: selectedEventId }, { enabled: Boolean(selectedEventId) });
  const { data: registrations } = trpc.event.listRegistrations.useQuery({ eventId: selectedEventId }, { enabled: Boolean(selectedEventId) });
  const { data: assignments } = trpc.event.listAssignments.useQuery({ eventId: selectedEventId }, { enabled: Boolean(selectedEventId) });
  const { data: eventMedia } = trpc.event.listMedia.useQuery({ eventId: selectedEventId }, { enabled: Boolean(selectedEventId) });
  const { data: badges } = trpc.event.listBadges.useQuery({ eventId: selectedEventId }, { enabled: Boolean(selectedEventId) });
  const { data: eventAnalytics } = trpc.event.analytics.useQuery({ eventId: selectedEventId }, { enabled: Boolean(selectedEventId) });

  const selectedEvent = useMemo(() => events?.find((e) => e.id === selectedEventId), [events, selectedEventId]);
  const selectedChurch = useMemo(() => churches?.find((c) => c.id === churchId), [churches, churchId]);

  useEffect(() => {
    if (!churchId && churches?.length) setChurchId(churches[0].id);
  }, [churchId, churches]);

  useEffect(() => {
    if (!checkInInfo) return;
    setCheckInCode(checkInInfo.code ?? '');
    setCheckInEnabled(Boolean(checkInInfo.enabled));
    if (checkInInfo.code && selectedEventId) {
      const baseUrl = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
      const url = `${baseUrl}/kiosk?eventId=${selectedEventId}&code=${checkInInfo.code}`;
      setCheckInUrl(url);
      QRCode.toDataURL(url, { width: 220, margin: 1 }).then(setCheckInQr).catch(() => setCheckInQr(''));
    } else {
      setCheckInUrl('');
      setCheckInQr('');
    }
  }, [checkInInfo, selectedEventId]);

  useKeyboardShortcuts([
    { key: '/', onTrigger: () => checkInSearchRef.current?.focus() },
    { key: 'n', shift: true, onTrigger: () => { setCreateOpen(true); } },
  ]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const resetCreateForm = () => {
    setCreateError(null); setTitle(''); setDescription(''); setEventType('SERVICE');
    setEventFormat('IN_PERSON'); setEventVisibility('PUBLIC'); setStartAt(''); setEndAt('');
    setLocation(''); setMeetingUrl(''); setCoverImageUrl(''); setCapacity('');
    setRequiresRsvp(false); setRegistrationEnabled(false); setRegistrationLimit('');
    setWaitlistEnabled(true); setAllowGuestRegistration(true); setRegistrationFields([]);
  };

  const { mutate: createEvent, isPending: isCreatingEvent } = trpc.event.create.useMutation({
    onSuccess: async () => {
      resetCreateForm();
      setCreateOpen(false);
      await utils.event.list.invalidate();
    },
    onError: (e) => setCreateError(e.message),
  });

  const { mutate: deleteEvent } = trpc.event.delete.useMutation({
    onSuccess: async () => {
      if (eventSheetOpen) setEventSheetOpen(false);
      await utils.event.list.invalidate();
    },
  });

  const { mutate: createSeries, isPending: isCreatingSeries } = trpc.event.createSeries.useMutation({
    onSuccess: async () => {
      setSeriesOpen(false);
      setSeriesTitle(''); setSeriesDescription(''); setSeriesType('SERVICE');
      setSeriesFormat('IN_PERSON'); setSeriesVisibility('PUBLIC');
      setSeriesStartDate(''); setSeriesEndDate(''); setSeriesLocation('');
      setSeriesMeetingUrl(''); setSeriesCoverImageUrl(''); setSeriesCapacity('');
      setSeriesOccurrences('12'); setSeriesRequiresRsvp(false); setSeriesRegistrationEnabled(false);
      setSeriesRegistrationLimit(''); setSeriesWaitlistEnabled(true); setSeriesAllowGuestRegistration(true);
      setSeriesRegistrationFields([]);
      await Promise.all([utils.event.list.invalidate(), utils.event.listSeries.invalidate()]);
    },
  });

  const { mutate: createTicketType } = trpc.event.createTicketType.useMutation({
    onSuccess: async () => {
      setTicketName(''); setTicketPrice(''); setTicketCapacity('');
      await Promise.all([utils.event.listTicketTypes.invalidate(), utils.event.list.invalidate()]);
    },
  });

  const { mutate: addAssignment } = trpc.event.addAssignment.useMutation({
    onSuccess: async () => {
      setAssignmentMemberId(''); setAssignmentName(''); setAssignmentNotes('');
      await utils.event.listAssignments.invalidate();
    },
  });

  const { mutate: removeAssignment } = trpc.event.removeAssignment.useMutation({
    onSuccess: async () => { await utils.event.listAssignments.invalidate(); },
  });

  const { mutate: addMedia } = trpc.event.addMedia.useMutation({
    onSuccess: async () => {
      setMediaTitle(''); setMediaDescription('');
      await utils.event.listMedia.invalidate();
    },
  });

  const { mutate: removeMedia } = trpc.event.removeMedia.useMutation({
    onSuccess: async () => { await utils.event.listMedia.invalidate(); },
  });

  const { mutate: generateBadges } = trpc.event.generateBadges.useMutation({
    onSuccess: async (data) => {
      setBadgeStats({ created: data.created });
      await utils.event.listBadges.invalidate();
    },
  });

  const { mutate: revokeBadge } = trpc.event.revokeBadge.useMutation({
    onSuccess: async () => { await utils.event.listBadges.invalidate(); },
  });

  const { mutate: createCommsPlaybook, isPending: isCreatingPlaybook } = trpc.event.createCommsPlaybook.useMutation({
    onSuccess: (result) => setPlaybookStats({ scheduled: result.scheduled }),
  });

  const { mutate: checkInBadge } = trpc.attendance.checkInBadge.useMutation({
    onSuccess: async () => {
      setBadgeCodeInput('');
      await Promise.all([utils.event.listBadges.invalidate(), utils.attendance.eventRoster.invalidate()]);
    },
  });

  const { mutateAsync: createUpload } = trpc.storage.createUpload.useMutation();

  const { mutate: enableCheckIn } = trpc.event.enableCheckIn.useMutation({
    onSuccess: async (data) => {
      await utils.event.checkInInfo.invalidate();
      setCheckInCode(data.code ?? ''); setCheckInEnabled(Boolean(data.enabled));
    },
  });

  const { mutate: disableCheckIn } = trpc.event.disableCheckIn.useMutation({
    onSuccess: async (data) => {
      await utils.event.checkInInfo.invalidate();
      setCheckInCode(data.code ?? ''); setCheckInEnabled(Boolean(data.enabled));
    },
  });

  const { mutate: checkInMember } = trpc.attendance.checkIn.useMutation({
    onSuccess: async () => { await utils.attendance.eventRoster.invalidate(); },
  });

  const { mutate: checkOutMember } = trpc.attendance.checkOut.useMutation({
    onSuccess: async () => { await utils.attendance.eventRoster.invalidate(); },
  });

  const { mutate: bulkCheckIn } = trpc.attendance.bulkCheckIn.useMutation({
    onSuccess: async () => { await utils.attendance.eventRoster.invalidate(); },
  });

  const handleMediaUpload = async (file?: File | null) => {
    if (!file || !selectedEventId || uploadingMedia) return;
    setUploadingMedia(true);
    try {
      const upload = await createUpload({ filename: file.name, contentType: file.type || 'application/octet-stream', size: file.size, purpose: 'event-media', churchId: churchId || undefined });
      await fetch(upload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      addMedia({ eventId: selectedEventId, assetId: upload.assetId, type: mediaType as any, title: mediaTitle || undefined, description: mediaDescription || undefined, isPublic: mediaIsPublic });
    } catch (error) {
      console.error('Failed to upload event media', error);
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleCreateEvent = () => {
    if (!churchId) { setCreateError('Select a church before creating an event.'); return; }
    if (!title.trim()) { setCreateError('Event title is required.'); return; }
    if (!startAt || !endAt) { setCreateError('Start and end date/time are required.'); return; }
    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) { setCreateError('End must be after start.'); return; }
    setCreateError(null);
    createEvent({
      churchId, title: title.trim(), description: description || undefined,
      type: eventType as any, format: eventFormat as any, visibility: eventVisibility as any,
      startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString(),
      location: location || undefined, meetingUrl: meetingUrl || undefined,
      coverImageUrl: coverImageUrl || undefined, capacity: capacity ? Number(capacity) : undefined,
      requiresRsvp, registrationEnabled, registrationLimit: registrationLimit ? Number(registrationLimit) : undefined,
      waitlistEnabled, registrationFields: registrationFields.length ? registrationFields : undefined, allowGuestRegistration,
    });
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const eventColumns: ColumnDef<NonNullable<typeof events>[number], unknown>[] = [
    {
      accessorKey: 'title',
      header: 'Event',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">{row.original.title}</p>
          <p className="text-xs text-muted">{row.original.location ?? row.original.format}</p>
        </div>
      ),
    },
    {
      accessorKey: 'startAt',
      header: 'Date',
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap">{new Date(getValue() as string).toLocaleDateString()}</span>
      ),
    },
    {
      accessorKey: 'visibility',
      header: 'Visibility',
      cell: ({ getValue }) => <Badge variant="default">{String(getValue())}</Badge>,
    },
    {
      id: 'rsvps',
      header: 'RSVPs',
      cell: ({ row }) => row.original.requiresRsvp ? (row.original._count?.rsvps ?? 0) : '—',
    },
    {
      id: 'regs',
      header: 'Regs',
      cell: ({ row }) => row.original.registrationEnabled ? (row.original._count?.registrations ?? 0) : '—',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          disabled={!canWrite}
          onClick={(e) => {
            e.stopPropagation();
            if (confirm('Delete this event?')) deleteEvent({ id: row.original.id });
          }}
        >
          Delete
        </Button>
      ),
    },
  ];

  const rosterColumns: ColumnDef<NonNullable<typeof roster>['roster'][number], unknown>[] = [
    {
      id: 'member',
      header: 'Member',
      cell: ({ row }) => `${row.original.member.firstName} ${row.original.member.lastName}`,
    },
    { id: 'email', header: 'Email', cell: ({ row }) => row.original.member.email ?? '—' },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant={row.original.status === 'CHECKED_IN' ? 'success' : 'default'}>{row.original.status}</Badge>,
    },
    {
      id: 'checkIn',
      header: 'Check-in',
      cell: ({ row }) => row.original.checkInAt ? new Date(row.original.checkInAt).toLocaleTimeString() : '—',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.status === 'CHECKED_IN' ? (
          <Button size="sm" variant="outline" disabled={!canWrite} onClick={(e) => { e.stopPropagation(); checkOutMember({ eventId: selectedEventId, memberId: row.original.member.id }); }}>
            Check out
          </Button>
        ) : (
          <Button size="sm" disabled={!canWrite} onClick={(e) => { e.stopPropagation(); checkInMember({ eventId: selectedEventId, memberId: row.original.member.id }); }}>
            Check in
          </Button>
        ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Shell>
      {!gate.isLoading && gate.access === 'locked' ? (
        <FeatureLocked
          featureKey="events_enabled"
          title="Events are locked"
          description="Your current subscription does not include event management. Upgrade to restore access."
        />
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <Card className="border-primary/10 bg-gradient-to-r from-slate-950 to-primary p-6 text-primary-foreground shadow-lg">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">Event operations</p>
                <h1 className="mt-2 font-display text-3xl font-semibold">Events</h1>
                <p className="mt-2 max-w-2xl text-sm text-white/80">
                  Schedule services, manage registrations, run check-in, and coordinate teams from one flow.
                </p>
              </div>
              <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                {selectedChurch?.name ?? 'No church selected'}
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Events', value: events?.length ?? 0 },
                { label: 'Registrations', value: eventAnalytics?.registrations?.reduce((s, e) => s + (e._count?._all ?? 0), 0) ?? 0 },
                { label: 'Attendance', value: eventAnalytics?.attendanceCount ?? 0 },
                { label: 'Ticket revenue', value: eventAnalytics?.ticketSales?.totalAmount?.toString() ?? '0' },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-white/20 bg-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-white/70">{kpi.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{kpi.value}</p>
                </div>
              ))}
            </div>
          </Card>

          {gate.readOnly ? <ReadOnlyNotice /> : null}

          {/* Church selector (inline, compact) */}
          {churches && churches.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2">
              {churches.map((church) => (
                <button
                  key={church.id}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${churchId === church.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted hover:border-primary/50'}`}
                  onClick={() => setChurchId(church.id)}
                >
                  {church.name}
                </button>
              ))}
            </div>
          ) : null}

          <p className="text-xs text-muted">
            Shortcuts: <kbd className="rounded border px-1.5 py-0.5 text-xs">/</kbd> check-in search ·{' '}
            <kbd className="rounded border px-1.5 py-0.5 text-xs">Shift</kbd>+<kbd className="rounded border px-1.5 py-0.5 text-xs">N</kbd> new event
          </p>

          {/* Events table */}
          <Card className="ff-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Events</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setSeriesOpen(true)} disabled={!canWrite || !churchId}>
                  + New series
                </Button>
                <Button size="sm" onClick={() => { setCreateOpen(true); setTimeout(() => createEventTitleRef.current?.focus(), 100); }} disabled={!canWrite || !churchId}>
                  + New event
                </Button>
              </div>
            </div>
            <div className="mt-4">
              <DataTable
                columns={eventColumns}
                data={events ?? []}
                isLoading={isLoadingEvents}
                onRowClick={(row) => {
                  setSelectedEventId(row.id);
                  setSheetTab('overview');
                  setEventSheetOpen(true);
                }}
                emptyMessage="No events created yet. Create your first event to unlock RSVP, check-in, tickets, and analytics."
              />
            </div>
          </Card>

          {/* Series list */}
          {series?.length ? (
            <Card className="ff-surface p-6">
              <h2 className="text-lg font-semibold">Recurring series</h2>
              <div className="mt-3 space-y-1.5">
                {series.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-white px-4 py-2.5 text-sm">
                    <div>
                      <p className="font-medium">{s.title}</p>
                      <p className="text-xs text-muted">{s.frequency} · {s.type}</p>
                    </div>
                    <Badge variant="default">{(s as any).status ?? 'ACTIVE'}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      )}

      {/* ── Event Detail Sheet ─────────────────────────────────────────────── */}
      <Sheet open={eventSheetOpen} onOpenChange={setEventSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>{selectedEvent?.title ?? 'Event detail'}</SheetTitle>
            {selectedEvent ? (
              <p className="text-sm text-muted">
                {new Date(selectedEvent.startAt).toLocaleString()} — {new Date(selectedEvent.endAt).toLocaleString()}
                {selectedEvent.location ? ` · ${selectedEvent.location}` : ''}
              </p>
            ) : null}
          </SheetHeader>
          <SheetBody className="pt-4">
            <Tabs value={sheetTab} onValueChange={setSheetTab}>
              <TabsList className="w-full sm:w-auto flex-wrap">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="checkin">Check-in</TabsTrigger>
                <TabsTrigger value="tickets">Tickets</TabsTrigger>
                <TabsTrigger value="assignments">Assignments</TabsTrigger>
                <TabsTrigger value="media">Media</TabsTrigger>
                <TabsTrigger value="comms">Comms</TabsTrigger>
                <TabsTrigger value="badges">Badges</TabsTrigger>
              </TabsList>

              {/* Overview */}
              <TabsContent value="overview" className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: 'Registrations', value: eventAnalytics?.registrations?.reduce((s, e) => s + (e._count?._all ?? 0), 0) ?? 0 },
                    { label: 'RSVPs', value: eventAnalytics?.rsvps?.reduce((s, e) => s + (e._count?._all ?? 0), 0) ?? 0 },
                    { label: 'Attendance', value: eventAnalytics?.attendanceCount ?? 0 },
                    { label: 'Revenue', value: eventAnalytics?.ticketSales?.totalAmount?.toString?.() ?? '0' },
                  ].map((kpi) => (
                    <div key={kpi.label} className="rounded-lg border border-border bg-white p-3 text-center">
                      <p className="text-xs text-muted">{kpi.label}</p>
                      <p className="mt-1 text-xl font-bold">{kpi.value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(eventAnalytics?.registrations ?? []).map((e) => (
                    <Badge key={e.status} variant="default">{e.status}: {e._count?._all ?? 0}</Badge>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold">Registrations</p>
                  <div className="space-y-2">
                    {registrations?.map((reg) => (
                      <div key={reg.id} className="flex items-center justify-between rounded-lg border border-border bg-white px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">{reg.member ? `${reg.member.firstName} ${reg.member.lastName}` : reg.guestName || reg.guestEmail}</p>
                          <p className="text-xs text-muted">{reg.member?.email ?? reg.guestEmail ?? '—'}</p>
                        </div>
                        <Badge variant="default">{reg.status}</Badge>
                      </div>
                    ))}
                    {!registrations?.length ? <p className="text-sm text-muted">No registrations yet.</p> : null}
                  </div>
                </div>
              </TabsContent>

              {/* Check-in */}
              <TabsContent value="checkin" className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={checkInEnabled ? 'success' : 'default'}>{checkInEnabled ? 'Kiosk enabled' : 'Kiosk disabled'}</Badge>
                    {checkInCode ? <span className="text-xs text-muted">Code: {checkInCode}</span> : null}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => selectedEventId && enableCheckIn({ eventId: selectedEventId })} disabled={!canWrite || !selectedEventId}>Enable / Rotate</Button>
                    <Button size="sm" variant="outline" onClick={() => selectedEventId && disableCheckIn({ eventId: selectedEventId })} disabled={!canWrite || !selectedEventId}>Disable</Button>
                  </div>
                </div>

                {checkInQr ? (
                  <div className="flex items-center gap-4">
                    <img src={checkInQr} alt="Check-in QR" className="h-32 w-32 rounded-md border border-border" />
                    {checkInUrl ? <a className="text-xs text-primary underline break-all" href={checkInUrl} target="_blank" rel="noreferrer">{checkInUrl}</a> : null}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    ref={checkInSearchRef}
                    placeholder="Search attendees…"
                    className="max-w-64"
                    value={checkInSearch}
                    onChange={(e) => setCheckInSearch(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Badge variant="default">{roster?.checkedInCount ?? 0} checked in</Badge>
                    <Badge variant="default">{roster?.rsvpGoingCount ?? 0} RSVP going</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canWrite || !selectedEventId || !roster?.roster?.length}
                    onClick={() => {
                      if (!selectedEventId || !roster?.roster?.length) return;
                      const ids = roster.roster.filter((e) => e.status !== 'CHECKED_IN').map((e) => e.member.id);
                      if (ids.length) bulkCheckIn({ eventId: selectedEventId, memberIds: ids });
                    }}
                  >
                    Check in all
                  </Button>
                </div>

                <DataTable
                  columns={rosterColumns}
                  data={roster?.roster ?? []}
                  emptyMessage="No attendees found. Attendance roster appears when registrations or member RSVP activity exists."
                />
              </TabsContent>

              {/* Tickets */}
              <TabsContent value="tickets" className="mt-4 space-y-4">
                <div className="rounded-xl border border-border bg-muted/5 p-4">
                  <p className="mb-3 text-sm font-semibold">Add ticket type</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input placeholder="Ticket name" value={ticketName} onChange={(e) => setTicketName(e.target.value)} />
                    <Input placeholder="Price" value={ticketPrice} onChange={(e) => setTicketPrice(e.target.value)} />
                    <Input placeholder="Currency" value={ticketCurrency} onChange={(e) => setTicketCurrency(e.target.value.toUpperCase())} />
                    <Input placeholder="Capacity (optional)" value={ticketCapacity} onChange={(e) => setTicketCapacity(e.target.value)} />
                  </div>
                  <Button
                    className="mt-3"
                    size="sm"
                    disabled={!canWrite || !selectedEventId || !ticketName || !ticketPrice}
                    onClick={() => createTicketType({ eventId: selectedEventId, name: ticketName, price: Number(ticketPrice), currency: ticketCurrency, capacity: ticketCapacity ? Number(ticketCapacity) : undefined })}
                  >
                    Create ticket type
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-semibold">Ticket types</p>
                    <div className="space-y-2">
                      {ticketTypes?.map((type) => (
                        <div key={type.id} className="flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2.5">
                          <div>
                            <p className="text-sm font-medium">{type.name}</p>
                            {type.capacity ? <p className="text-xs text-muted">Capacity: {type.capacity}</p> : null}
                          </div>
                          <Badge variant="default">{type.currency} {type.price.toString()}</Badge>
                        </div>
                      ))}
                      {!ticketTypes?.length ? <p className="text-sm text-muted">No ticket types yet.</p> : null}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold">Recent orders</p>
                    <div className="space-y-2">
                      {ticketOrders?.map((order) => (
                        <div key={order.id} className="flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2.5">
                          <div>
                            <p className="text-sm font-medium">{order.member ? `${order.member.firstName} ${order.member.lastName}` : 'Guest'}</p>
                            <p className="text-xs text-muted">{order.ticketType?.name ?? 'Ticket'} · {order.quantity} · {order.currency} {order.amount.toString()}</p>
                          </div>
                          <Badge variant="default">{order.status}</Badge>
                        </div>
                      ))}
                      {!ticketOrders?.length ? <p className="text-sm text-muted">No orders yet.</p> : null}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Assignments */}
              <TabsContent value="assignments" className="mt-4 space-y-4">
                <div className="rounded-xl border border-border bg-muted/5 p-4">
                  <p className="mb-3 text-sm font-semibold">Add assignment</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={assignmentRole} onChange={(e) => setAssignmentRole(e.target.value)}>
                      {['SPEAKER', 'HOST', 'WORSHIP_LEADER', 'VOLUNTEER', 'TECH', 'OTHER'].map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                    </select>
                    <Input placeholder="Search members" value={assignmentSearch} onChange={(e) => setAssignmentSearch(e.target.value)} />
                    <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={assignmentMemberId} onChange={(e) => setAssignmentMemberId(e.target.value)}>
                      <option value="">Select member</option>
                      {members?.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
                    </select>
                    <Input placeholder="External name (if no member)" value={assignmentName} onChange={(e) => setAssignmentName(e.target.value)} />
                    <Input placeholder="Notes (optional)" value={assignmentNotes} onChange={(e) => setAssignmentNotes(e.target.value)} />
                  </div>
                  <Button
                    className="mt-3"
                    size="sm"
                    disabled={!canWrite || !selectedEventId || (!assignmentMemberId && !assignmentName)}
                    onClick={() => addAssignment({ eventId: selectedEventId, role: assignmentRole as any, memberId: assignmentMemberId || undefined, displayName: assignmentMemberId ? undefined : assignmentName || undefined, notes: assignmentNotes || undefined })}
                  >
                    Add assignment
                  </Button>
                </div>
                <div className="space-y-2">
                  {assignments?.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border border-border bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{a.member ? `${a.member.firstName} ${a.member.lastName}` : a.displayName}</p>
                        <p className="text-xs text-muted">{a.role}{a.notes ? ` · ${a.notes}` : ''}</p>
                      </div>
                      <Button size="sm" variant="outline" disabled={!canWrite} onClick={() => removeAssignment({ id: a.id })}>Remove</Button>
                    </div>
                  ))}
                  {!assignments?.length ? <EmptyState title="No assignments yet" description="Assign speakers and volunteers to lock execution plans." /> : null}
                </div>
              </TabsContent>

              {/* Media */}
              <TabsContent value="media" className="mt-4 space-y-4">
                <div className="rounded-xl border border-border bg-muted/5 p-4">
                  <p className="mb-3 text-sm font-semibold">Upload media</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={mediaType} onChange={(e) => setMediaType(e.target.value)}>
                      {['PHOTO', 'VIDEO', 'SERMON', 'DOCUMENT', 'OTHER'].map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <Input placeholder="Title (optional)" value={mediaTitle} onChange={(e) => setMediaTitle(e.target.value)} />
                    <Input placeholder="Description (optional)" value={mediaDescription} onChange={(e) => setMediaDescription(e.target.value)} />
                    <label className="flex items-center gap-2 text-sm text-muted">
                      <input type="checkbox" checked={mediaIsPublic} disabled={!canWrite} onChange={(e) => setMediaIsPublic(e.target.checked)} />
                      Visible on public page
                    </label>
                  </div>
                  <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground hover:bg-muted/5">
                    {uploadingMedia ? 'Uploading…' : 'Choose file'}
                    <input type="file" className="sr-only" disabled={!canWrite || uploadingMedia} onChange={(e) => handleMediaUpload(e.target.files?.[0])} />
                  </label>
                </div>
                <div className="space-y-2">
                  {eventMedia?.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-lg border border-border bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{m.title ?? m.asset.filename ?? m.type}</p>
                        <p className="text-xs text-muted">{m.type} · {m.isPublic ? 'Public' : 'Private'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <a className="text-xs text-primary underline" href={m.asset.url} target="_blank" rel="noreferrer">View</a>
                        <Button size="sm" variant="outline" disabled={!canWrite} onClick={() => removeMedia({ id: m.id })}>Remove</Button>
                      </div>
                    </div>
                  ))}
                  {!eventMedia?.length ? <EmptyState title="No media uploaded yet" description="Upload photos, sermon assets, or documents to enrich post-event archives." /> : null}
                </div>
              </TabsContent>

              {/* Communications */}
              <TabsContent value="comms" className="mt-4 space-y-4">
                <div className="rounded-xl border border-border bg-muted/5 p-4">
                  <p className="text-sm font-semibold">Launch communications playbook</p>
                  <p className="mt-1 text-xs text-muted">Schedules reminder, day-of update, and follow-up messages for registrations and RSVP responses.</p>
                  <div className="mt-4 flex flex-wrap gap-4">
                    {['EMAIL', 'SMS'].map((channel) => (
                      <label key={channel} className="flex items-center gap-2 text-sm text-muted">
                        <input
                          type="checkbox"
                          checked={playbookChannels.includes(channel)}
                          disabled={!canWrite}
                          onChange={(e) => setPlaybookChannels((prev) => e.target.checked ? [...prev, channel] : prev.filter((c) => c !== channel))}
                        />
                        {channel}
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                      disabled={!canWrite || !selectedEventId || !playbookChannels.length || isCreatingPlaybook}
                      onClick={() => selectedEventId && createCommsPlaybook({ eventId: selectedEventId, channels: playbookChannels as any })}
                    >
                      {isCreatingPlaybook ? 'Scheduling…' : 'Create playbook'}
                    </Button>
                    {playbookStats.scheduled ? <Badge variant="success">{playbookStats.scheduled} messages scheduled</Badge> : null}
                  </div>
                </div>
              </TabsContent>

              {/* Badges */}
              <TabsContent value="badges" className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button disabled={!canWrite || !selectedEventId} onClick={() => selectedEventId && generateBadges({ eventId: selectedEventId })}>
                    Generate badges
                  </Button>
                  <Button variant="outline" disabled={!selectedEventId} onClick={() => window.open(`/events/badges?eventId=${selectedEventId}`, '_blank')}>
                    Print badges
                  </Button>
                  <Badge variant="default">{badges?.length ?? 0} total</Badge>
                  {badgeStats.created ? <Badge variant="success">{badgeStats.created} created</Badge> : null}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    placeholder="Scan or enter badge code"
                    className="max-w-64"
                    value={badgeCodeInput}
                    onChange={(e) => setBadgeCodeInput(e.target.value)}
                  />
                  <Button disabled={!canWrite || !badgeCodeInput.trim()} onClick={() => badgeCodeInput && checkInBadge({ badgeCode: badgeCodeInput.trim() })}>
                    Check in badge
                  </Button>
                </div>

                <div className="space-y-2">
                  {badges?.slice(0, 10).map((badge) => (
                    <div key={badge.id} className="flex items-center justify-between rounded-lg border border-border bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{badge.member ? `${badge.member.firstName} ${badge.member.lastName}` : badge.registration?.guestName || 'Guest'}</p>
                        <p className="text-xs text-muted">Code: {badge.badgeCode}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default">{badge.status}</Badge>
                        <Button size="sm" variant="outline" disabled={!canWrite} onClick={() => revokeBadge({ id: badge.id })}>Revoke</Button>
                      </div>
                    </div>
                  ))}
                  {!badges?.length ? <p className="text-sm text-muted">No badges yet.</p> : null}
                </div>
              </TabsContent>
            </Tabs>
          </SheetBody>
        </SheetContent>
      </Sheet>

      {/* ── Create Event Dialog ────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>New event</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                ref={createEventTitleRef}
                placeholder="Title *"
                value={title}
                onChange={(e) => { setCreateError(null); setTitle(e.target.value); }}
                aria-invalid={Boolean(createError && !title.trim())}
              />
              <Input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
              <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="sm:col-span-2" />
              <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
              <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
              <Input type="number" placeholder="Capacity" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={eventType} onChange={(e) => setEventType(e.target.value)}>
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
              <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={eventFormat} onChange={(e) => setEventFormat(e.target.value)}>
                {EVENT_FORMATS.map((f) => <option key={f} value={f}>{f.replace('_', ' ')}</option>)}
              </select>
              <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={eventVisibility} onChange={(e) => setEventVisibility(e.target.value)}>
                {EVENT_VISIBILITIES.map((v) => <option key={v} value={v}>{v.replace('_', ' ')}</option>)}
              </select>
              <Input placeholder="Meeting or livestream URL" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} />
              <Input placeholder="Cover image URL" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted">
              {[
                { label: 'Require RSVP', state: requiresRsvp, set: setRequiresRsvp },
                { label: 'Enable registration', state: registrationEnabled, set: setRegistrationEnabled },
                { label: 'Waitlist enabled', state: waitlistEnabled, set: setWaitlistEnabled },
                { label: 'Allow guest registration', state: allowGuestRegistration, set: setAllowGuestRegistration },
              ].map(({ label, state, set }) => (
                <label key={label} className="flex items-center gap-2">
                  <input type="checkbox" checked={state} onChange={(e) => set(e.target.checked)} />
                  {label}
                </label>
              ))}
            </div>
            {registrationEnabled ? (
              <div className="space-y-3">
                <Input type="number" placeholder="Registration limit (optional)" value={registrationLimit} onChange={(e) => setRegistrationLimit(e.target.value)} />
                <RegistrationFieldBuilder fields={registrationFields} canWrite={canWrite} onAdd={(f) => setRegistrationFields((p) => [...p, f])} onRemove={(id) => setRegistrationFields((p) => p.filter((f) => f.id !== id))} />
              </div>
            ) : null}
            {createError ? <p className="text-xs font-medium text-destructive">{createError}</p> : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetCreateForm(); }}>Cancel</Button>
            <Button onClick={handleCreateEvent} disabled={!canWrite || !churchId || !title || !startAt || !endAt || isCreatingEvent}>
              {isCreatingEvent ? 'Saving…' : 'Save event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Series Dialog ───────────────────────────────────────────── */}
      <Dialog open={seriesOpen} onOpenChange={setSeriesOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>New recurring series</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Series title *" value={seriesTitle} onChange={(e) => setSeriesTitle(e.target.value)} />
              <Input placeholder="Description" value={seriesDescription} onChange={(e) => setSeriesDescription(e.target.value)} />
              <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={seriesType} onChange={(e) => setSeriesType(e.target.value)}>
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
              <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={seriesFormat} onChange={(e) => setSeriesFormat(e.target.value)}>
                {EVENT_FORMATS.map((f) => <option key={f} value={f}>{f.replace('_', ' ')}</option>)}
              </select>
              <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={seriesVisibility} onChange={(e) => setSeriesVisibility(e.target.value)}>
                {EVENT_VISIBILITIES.map((v) => <option key={v} value={v}>{v.replace('_', ' ')}</option>)}
              </select>
              <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={seriesFrequency} onChange={(e) => setSeriesFrequency(e.target.value)}>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
              <Input type="date" value={seriesStartDate} onChange={(e) => setSeriesStartDate(e.target.value)} />
              <Input type="date" value={seriesEndDate} onChange={(e) => setSeriesEndDate(e.target.value)} />
              <Input type="time" value={seriesStartTime} onChange={(e) => setSeriesStartTime(e.target.value)} />
              <Input type="time" value={seriesEndTime} onChange={(e) => setSeriesEndTime(e.target.value)} />
              <Input placeholder="Occurrences" value={seriesOccurrences} onChange={(e) => setSeriesOccurrences(e.target.value)} />
              <Input placeholder="Location" value={seriesLocation} onChange={(e) => setSeriesLocation(e.target.value)} />
              <Input placeholder="Meeting URL" value={seriesMeetingUrl} onChange={(e) => setSeriesMeetingUrl(e.target.value)} />
              <Input placeholder="Capacity" value={seriesCapacity} onChange={(e) => setSeriesCapacity(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-muted">
              {WEEKDAYS.map((day) => (
                <label key={day} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={seriesWeekdays.includes(day)} onChange={(e) => setSeriesWeekdays((p) => e.target.checked ? [...p, day] : p.filter((d) => d !== day))} />
                  {day.slice(0, 3)}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted">
              {[
                { label: 'Require RSVP', state: seriesRequiresRsvp, set: setSeriesRequiresRsvp },
                { label: 'Enable registration', state: seriesRegistrationEnabled, set: setSeriesRegistrationEnabled },
                { label: 'Waitlist enabled', state: seriesWaitlistEnabled, set: setSeriesWaitlistEnabled },
                { label: 'Allow guest registration', state: seriesAllowGuestRegistration, set: setSeriesAllowGuestRegistration },
              ].map(({ label, state, set }) => (
                <label key={label} className="flex items-center gap-2">
                  <input type="checkbox" checked={state} onChange={(e) => set(e.target.checked)} />
                  {label}
                </label>
              ))}
            </div>
            {seriesRegistrationEnabled ? (
              <div className="space-y-3">
                <Input type="number" placeholder="Registration limit (optional)" value={seriesRegistrationLimit} onChange={(e) => setSeriesRegistrationLimit(e.target.value)} />
                <RegistrationFieldBuilder fields={seriesRegistrationFields} canWrite={canWrite} onAdd={(f) => setSeriesRegistrationFields((p) => [...p, f])} onRemove={(id) => setSeriesRegistrationFields((p) => p.filter((f) => f.id !== id))} />
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeriesOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!churchId || !seriesTitle || !seriesStartDate) return;
                createSeries({
                  churchId, title: seriesTitle, description: seriesDescription || undefined,
                  type: seriesType as any, format: seriesFormat as any, visibility: seriesVisibility as any,
                  location: seriesLocation || undefined, meetingUrl: seriesMeetingUrl || undefined,
                  coverImageUrl: seriesCoverImageUrl || undefined,
                  startDate: new Date(seriesStartDate), endDate: seriesEndDate ? new Date(seriesEndDate) : undefined,
                  startTime: seriesStartTime, endTime: seriesEndTime,
                  frequency: seriesFrequency as any, weekdays: seriesWeekdays as any,
                  occurrences: Number(seriesOccurrences || '12'),
                  requiresRsvp: seriesRequiresRsvp, registrationEnabled: seriesRegistrationEnabled,
                  registrationLimit: seriesRegistrationLimit ? Number(seriesRegistrationLimit) : undefined,
                  waitlistEnabled: seriesWaitlistEnabled,
                  registrationFields: seriesRegistrationFields.length ? seriesRegistrationFields : undefined,
                  allowGuestRegistration: seriesAllowGuestRegistration,
                  capacity: seriesCapacity ? Number(seriesCapacity) : undefined,
                });
              }}
              disabled={!canWrite || !churchId || !seriesTitle || !seriesStartDate || isCreatingSeries}
            >
              {isCreatingSeries ? 'Scheduling…' : 'Create series'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
