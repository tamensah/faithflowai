'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Button,
  Card,
  Input,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  Textarea,
} from '@faithflow-ai/ui';
import type { ColumnDef } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { trpc } from '../../lib/trpc';
import { useFeatureGate } from '../../lib/entitlements';
import { FeatureLocked } from '../../components/FeatureLocked';
import { ReadOnlyNotice } from '../../components/ReadOnlyNotice';

const channelOptions = ['EMAIL', 'SMS', 'WHATSAPP'] as const;
const audienceOptions = [
  { value: '', label: 'No audience' },
  { value: 'ALL_MEMBERS', label: 'All members' },
  { value: 'ACTIVE_MEMBERS', label: 'Active members' },
  { value: 'DONORS_90_DAYS', label: 'Donors (last 90 days)' },
];

export default function CommunicationsPage() {
  const gate = useFeatureGate('communications_enabled');
  const utils = trpc.useUtils();
  const canWrite = gate.canWrite;

  const [churchId, setChurchId] = useState('');

  // Quiet hours
  const [quietEnabled, setQuietEnabled] = useState(true);
  const [quietStart, setQuietStart] = useState('21');
  const [quietEnd, setQuietEnd] = useState('7');
  const [quietIncrement, setQuietIncrement] = useState('30');
  const [quietHoursStatus, setQuietHoursStatus] = useState('');

  // Template dialog
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateChannel, setTemplateChannel] = useState('EMAIL');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [templateStatus, setTemplateStatus] = useState('');

  // Send message
  const [sendChannel, setSendChannel] = useState('EMAIL');
  const [sendTo, setSendTo] = useState('');
  const [sendSubject, setSendSubject] = useState('');
  const [sendBody, setSendBody] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [audience, setAudience] = useState('');
  const [sendStatus, setSendStatus] = useState('');

  // Schedule message
  const [scheduleChannel, setScheduleChannel] = useState('EMAIL');
  const [scheduleTo, setScheduleTo] = useState('');
  const [scheduleAudience, setScheduleAudience] = useState('');
  const [scheduleTemplateId, setScheduleTemplateId] = useState('');
  const [scheduleSubject, setScheduleSubject] = useState('');
  const [scheduleBody, setScheduleBody] = useState('');
  const [scheduleSendAt, setScheduleSendAt] = useState('');
  const [scheduleInitialStatus, setScheduleInitialStatus] = useState<'QUEUED' | 'DRAFT' | 'PENDING_REVIEW'>('QUEUED');
  const [scheduleStatus, setScheduleStatus] = useState('');
  const [lastScheduleBatchKey, setLastScheduleBatchKey] = useState('');
  const [batchActionStatus, setBatchActionStatus] = useState('');

  // AI draft
  const [draftObjective, setDraftObjective] = useState('');
  const [draftAudienceHint, setDraftAudienceHint] = useState('');
  const [draftTone, setDraftTone] = useState<'PASTORAL' | 'INFORMATIVE' | 'URGENT' | 'FRIENDLY'>('PASTORAL');
  const [draftProvider, setDraftProvider] = useState<'openai' | 'anthropic' | 'google'>('openai');
  const [draftChecklist, setDraftChecklist] = useState<string[]>([]);

  // Calendar
  const [calendarWindowDays, setCalendarWindowDays] = useState('14');
  const [calendarChannel, setCalendarChannel] = useState<'ALL' | (typeof channelOptions)[number]>('ALL');

  // Drip
  const [dripName, setDripName] = useState('');
  const [dripDescription, setDripDescription] = useState('');
  const [selectedDripId, setSelectedDripId] = useState('');
  const [dripStepOrder, setDripStepOrder] = useState('1');
  const [dripDelayHours, setDripDelayHours] = useState('24');
  const [dripChannel, setDripChannel] = useState('EMAIL');
  const [dripTemplateId, setDripTemplateId] = useState('');
  const [dripSubject, setDripSubject] = useState('');
  const [dripBody, setDripBody] = useState('');
  const [dripAudience, setDripAudience] = useState('');
  const [dripTo, setDripTo] = useState('');
  const [dripStatus, setDripStatus] = useState('');

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: churches, isLoading: isLoadingChurches } = trpc.church.list.useQuery({ organizationId: undefined });
  const { data: templates } = trpc.communications.templates.useQuery({ churchId: churchId || undefined }, { enabled: Boolean(churchId) });
  const { data: messages } = trpc.communications.messages.useQuery({ churchId: churchId || undefined, limit: 20 }, { enabled: Boolean(churchId) });
  const { data: schedules } = trpc.communications.schedules.useQuery({ churchId: churchId || undefined, limit: 20 }, { enabled: Boolean(churchId) });
  const { data: commsAnalytics } = trpc.communications.analytics.useQuery({ churchId: churchId || undefined, days: 30 }, { enabled: Boolean(churchId) });
  const { data: drips } = trpc.communications.drips.useQuery({ churchId: churchId || undefined }, { enabled: Boolean(churchId) });
  const { data: dripSteps } = trpc.communications.dripSteps.useQuery({ campaignId: selectedDripId }, { enabled: Boolean(selectedDripId) });
  const { data: summary } = trpc.communications.summary.useQuery({ churchId: churchId || undefined }, { enabled: Boolean(churchId) });

  const calendarRange = useMemo(() => {
    const days = Math.max(7, Math.min(60, Number(calendarWindowDays) || 14));
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const to = new Date(from); to.setDate(to.getDate() + days);
    return { from, to, days };
  }, [calendarWindowDays]);

  const { data: calendarSchedules } = trpc.communications.schedulesRange.useQuery(
    { churchId: churchId || undefined, from: calendarRange.from, to: calendarRange.to, limit: 2000 },
    { enabled: Boolean(churchId) }
  );

  const parsedSendRecipients = useMemo(() => sendTo.split(',').map((v) => v.trim()).filter(Boolean), [sendTo]);
  const parsedScheduleRecipients = useMemo(() => scheduleTo.split(',').map((v) => v.trim()).filter(Boolean), [scheduleTo]);

  const sendPreviewEnabled = Boolean(churchId && (parsedSendRecipients.length || audience));
  const { data: sendPreview } = trpc.communications.previewAudience.useQuery(
    { churchId, channel: sendChannel as any, to: parsedSendRecipients.length ? parsedSendRecipients : undefined, audience: audience ? (audience as any) : undefined },
    { enabled: sendPreviewEnabled }
  );

  const schedulePreviewEnabled = Boolean(churchId && (parsedScheduleRecipients.length || scheduleAudience));
  const { data: schedulePreview } = trpc.communications.previewAudience.useQuery(
    { churchId, channel: scheduleChannel as any, to: parsedScheduleRecipients.length ? parsedScheduleRecipients : undefined, audience: scheduleAudience ? (scheduleAudience as any) : undefined },
    { enabled: schedulePreviewEnabled }
  );

  const selectedChurch = useMemo(() => churches?.find((c) => c.id === churchId) ?? null, [churches, churchId]);

  useEffect(() => {
    if (!churchId && churches?.length) setChurchId(churches[0].id);
  }, [churchId, churches]);

  useEffect(() => {
    if (!selectedChurch) return;
    setQuietEnabled(Boolean((selectedChurch as any).quietHoursEnabled ?? true));
    setQuietStart(String((selectedChurch as any).quietHoursStartHour ?? 21));
    setQuietEnd(String((selectedChurch as any).quietHoursEndHour ?? 7));
    setQuietIncrement(String((selectedChurch as any).quietHoursRescheduleMinutes ?? 30));
  }, [selectedChurch?.id]);

  useEffect(() => {
    if (!selectedDripId && drips?.length) setSelectedDripId(drips[0].id);
  }, [selectedDripId, drips]);

  useEffect(() => {
    if (dripSteps?.length) setDripChannel(dripSteps[0].channel);
  }, [dripSteps]);

  const templatesByChannel = useMemo(() => {
    const map: Record<string, typeof templates> = { EMAIL: [], SMS: [], WHATSAPP: [] };
    for (const t of templates ?? []) map[t.channel] = [...(map[t.channel] ?? []), t];
    return map;
  }, [templates]);

  const sendTemplates = templatesByChannel[sendChannel] ?? [];
  const scheduleTemplates = templatesByChannel[scheduleChannel] ?? [];
  const dripTemplates = templatesByChannel[dripChannel] ?? [];

  const scheduleBatches = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const item of schedules ?? []) {
      const meta = (item as any).metadata as any;
      const key = typeof meta?.batchKey === 'string' && meta.batchKey.length ? meta.batchKey : `single:${item.id}`;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([batchKey, entries]) => {
      const sorted = [...entries].sort((a, b) => new Date(a.sendAt).getTime() - new Date(b.sendAt).getTime());
      const statusCounts = sorted.reduce<Record<string, number>>((acc, row) => { acc[row.status] = (acc[row.status] ?? 0) + 1; return acc; }, {});
      return { batchKey, channel: sorted[0]?.channel, sendAt: sorted[0]?.sendAt, primaryStatus: sorted[0]?.status, count: sorted.length, statusCounts };
    });
  }, [schedules]);

  const calendarDays = useMemo(() => {
    const tz = (selectedChurch as any)?.timezone ?? 'UTC';
    const { from, days } = calendarRange;
    const buckets = new Map<string, { key: string; label: string; counts: Record<string, number> }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(from); d.setDate(from.getDate() + i);
      const key = d.toLocaleDateString('en-CA', { timeZone: tz });
      const label = d.toLocaleDateString(undefined, { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' });
      buckets.set(key, { key, label, counts: {} });
    }
    for (const row of calendarSchedules ?? []) {
      if (calendarChannel !== 'ALL' && row.channel !== calendarChannel) continue;
      const key = new Date(row.sendAt).toLocaleDateString('en-CA', { timeZone: tz });
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.counts[row.status] = (bucket.counts[row.status] ?? 0) + 1;
    }
    return Array.from(buckets.values());
  }, [calendarChannel, calendarRange.from, calendarRange.days, calendarSchedules, selectedChurch]);

  const analyticsTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const row of commsAnalytics?.messagesDaily ?? []) {
      const key = `${row.channel}:${row.status}`;
      totals[key] = (totals[key] ?? 0) + (row.count ?? 0);
    }
    return totals;
  }, [commsAnalytics?.messagesDaily]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const { mutate: createTemplate, isPending: isCreatingTemplate } = trpc.communications.createTemplate.useMutation({
    onSuccess: async () => {
      setTemplateStatus('Template created.');
      setTemplateName(''); setTemplateBody(''); setTemplateSubject('');
      setTemplateOpen(false);
      await utils.communications.templates.invalidate();
    },
    onError: (e) => setTemplateStatus(e.message),
  });

  const { mutate: sendMessage, isPending: isSendingMessage } = trpc.communications.send.useMutation({
    onSuccess: async () => {
      setSendStatus('Message sent.');
      setSendTo(''); setSendSubject(''); setSendBody(''); setTemplateId(''); setAudience('');
      await utils.communications.messages.invalidate();
    },
    onError: (e) => setSendStatus(e.message),
  });

  const { mutate: scheduleMessage, isPending: isScheduling } = trpc.communications.schedule.useMutation({
    onSuccess: async (data) => {
      setScheduleStatus('Message scheduled.');
      setScheduleTo(''); setScheduleSubject(''); setScheduleBody(''); setScheduleTemplateId(''); setScheduleAudience('');
      setLastScheduleBatchKey((data as any)?.batchKey ?? '');
      await utils.communications.schedules.invalidate();
    },
    onError: (e) => setScheduleStatus(e.message),
  });

  const { mutate: updateBatchStatus, isPending: isUpdatingBatch } = trpc.communications.updateScheduleBatchStatus.useMutation({
    onSuccess: async (data) => {
      setBatchActionStatus(`Updated ${data.updated} schedule(s).`);
      await utils.communications.schedules.invalidate();
    },
    onError: (e) => setBatchActionStatus(e.message),
  });

  const { mutate: generateDraft, isPending: isGeneratingDraft } = trpc.ai.generateCommunicationDraft.useMutation({
    onSuccess: (data) => {
      setScheduleBody(data.body);
      setScheduleSubject(data.subject ?? '');
      setScheduleInitialStatus('DRAFT');
      setDraftChecklist(data.reviewChecklist ?? []);
    },
  });

  const { mutate: dispatchDue, isPending: isDispatching } = trpc.communications.dispatchDue.useMutation({
    onSuccess: async () => {
      await utils.communications.schedules.invalidate();
      await utils.communications.messages.invalidate();
    },
  });

  const { mutate: createDrip, isPending: isCreatingDrip } = trpc.communications.createDrip.useMutation({
    onSuccess: async () => {
      setDripStatus('Drip campaign created.'); setDripName(''); setDripDescription('');
      await utils.communications.drips.invalidate();
    },
    onError: (e) => setDripStatus(e.message),
  });

  const { mutate: addDripStep, isPending: isAddingDripStep } = trpc.communications.addDripStep.useMutation({
    onSuccess: async () => {
      setDripStatus('Drip step added.'); setDripStepOrder(String(Number(dripStepOrder) + 1));
      setDripDelayHours('24'); setDripSubject(''); setDripBody(''); setDripTemplateId('');
      await utils.communications.dripSteps.invalidate();
    },
    onError: (e) => setDripStatus(e.message),
  });

  const { mutate: enrollDrip, isPending: isEnrollingDrip } = trpc.communications.enrollDrip.useMutation({
    onSuccess: async () => {
      setDripStatus('Recipients enrolled.'); setDripTo(''); setDripAudience('');
      await utils.communications.schedules.invalidate();
    },
    onError: (e) => setDripStatus(e.message),
  });

  const { mutate: updateChurch, isPending: isSavingQuietHours } = trpc.church.update.useMutation({
    onSuccess: async () => {
      setQuietHoursStatus('Quiet hours saved.');
      await utils.church.list.invalidate();
    },
    onError: (e) => setQuietHoursStatus(e.message),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSaveQuietHours = () => {
    if (!churchId) { setQuietHoursStatus('Select a church first.'); return; }
    setQuietHoursStatus('');
    updateChurch({ id: churchId, quietHoursEnabled: quietEnabled, quietHoursStartHour: Number(quietStart || '21'), quietHoursEndHour: Number(quietEnd || '7'), quietHoursRescheduleMinutes: Number(quietIncrement || '30') });
  };

  const handleCreateTemplate = () => {
    if (!churchId || !templateName.trim() || !templateBody.trim()) { setTemplateStatus('Church, name, and body are required.'); return; }
    if (templateChannel === 'EMAIL' && !templateSubject.trim()) { setTemplateStatus('Email templates require a subject.'); return; }
    setTemplateStatus('');
    createTemplate({ churchId, name: templateName.trim(), channel: templateChannel as any, subject: templateChannel === 'EMAIL' ? templateSubject.trim() : undefined, body: templateBody });
  };

  const handleSendMessage = () => {
    if (!churchId || (!sendTo && !audience)) { setSendStatus('Provide recipients or an audience.'); return; }
    if (!templateId && !sendBody.trim()) { setSendStatus('Provide a message body or select a template.'); return; }
    if (sendChannel === 'EMAIL' && !templateId && !sendSubject.trim()) { setSendStatus('Email messages require a subject when no template is selected.'); return; }
    setSendStatus('');
    sendMessage({ churchId, channel: sendChannel as any, templateId: templateId || undefined, audience: audience ? (audience as any) : undefined, subject: sendChannel === 'EMAIL' ? sendSubject : undefined, body: sendBody || undefined, to: parsedSendRecipients });
  };

  const handleScheduleMessage = () => {
    if (!churchId || (!scheduleTo && !scheduleAudience)) { setScheduleStatus('Provide recipients or an audience.'); return; }
    if (!scheduleTemplateId && !scheduleBody.trim()) { setScheduleStatus('Provide a message body or select a template.'); return; }
    if (scheduleChannel === 'EMAIL' && !scheduleTemplateId && !scheduleSubject.trim()) { setScheduleStatus('Email schedules require a subject when no template is selected.'); return; }
    setScheduleStatus('');
    scheduleMessage({ churchId, channel: scheduleChannel as any, templateId: scheduleTemplateId || undefined, audience: scheduleAudience ? (scheduleAudience as any) : undefined, subject: scheduleChannel === 'EMAIL' ? scheduleSubject : undefined, body: scheduleBody || undefined, sendAt: scheduleSendAt ? new Date(scheduleSendAt) : new Date(), initialStatus: scheduleInitialStatus, to: parsedScheduleRecipients });
  };

  const handleCreateDrip = () => {
    if (!churchId || !dripName.trim()) { setDripStatus('Church and campaign name are required.'); return; }
    setDripStatus('');
    createDrip({ churchId, name: dripName.trim(), description: dripDescription || undefined });
  };

  const handleAddDripStep = () => {
    if (!selectedDripId || !dripStepOrder || !dripDelayHours) { setDripStatus('Select campaign, step order, and delay hours.'); return; }
    if (!dripTemplateId && !dripBody.trim()) { setDripStatus('Provide step body or select a template.'); return; }
    setDripStatus('');
    addDripStep({ campaignId: selectedDripId, stepOrder: Number(dripStepOrder), delayHours: Number(dripDelayHours), channel: dripChannel as any, templateId: dripTemplateId || undefined, subject: dripChannel === 'EMAIL' ? dripSubject : undefined, body: dripBody || undefined });
  };

  const handleEnrollDrip = () => {
    if (!selectedDripId || (!dripAudience && !dripTo)) { setDripStatus('Choose an audience or provide recipients.'); return; }
    setDripStatus('');
    enrollDrip({ campaignId: selectedDripId, churchId, audience: dripAudience ? (dripAudience as any) : undefined, to: dripTo.split(',').map((v) => v.trim()).filter(Boolean) });
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const templateColumns: ColumnDef<NonNullable<typeof templates>[number], unknown>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'channel', header: 'Channel', cell: ({ getValue }) => <Badge variant="default">{String(getValue())}</Badge> },
    { accessorKey: 'createdAt', header: 'Created', cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString() },
  ];

  const messageColumns: ColumnDef<NonNullable<typeof messages>[number], unknown>[] = [
    { accessorKey: 'channel', header: 'Channel', cell: ({ getValue }) => <Badge variant="default">{String(getValue())}</Badge> },
    { accessorKey: 'to', header: 'To', cell: ({ getValue }) => <span className="truncate max-w-xs block">{String(getValue())}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge variant={getValue() === 'SENT' ? 'success' : getValue() === 'FAILED' ? 'warning' : 'default'}>{String(getValue())}</Badge> },
    { accessorKey: 'createdAt', header: 'Sent', cell: ({ getValue }) => new Date(getValue() as string).toLocaleString() },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Shell>
      {!gate.isLoading && gate.access === 'locked' ? (
        <FeatureLocked
          featureKey="communications_enabled"
          title="Communications are locked"
          description="Your current subscription does not include communications. Upgrade to restore access."
        />
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <Card className="border-primary/10 bg-gradient-to-r from-slate-950 to-primary p-6 text-primary-foreground shadow-lg">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">Outreach</p>
                <h1 className="mt-2 font-display text-3xl font-semibold">Communications</h1>
                <p className="mt-2 max-w-2xl text-sm text-white/80">
                  Templates, broadcasts, scheduled sends, drip campaigns, and delivery analytics.
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                  {selectedChurch?.name ?? 'No church selected'}
                </span>
                <Link href="/communications/suppressions" className="text-xs text-white/70 underline hover:text-white">
                  Manage suppressions →
                </Link>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Templates', value: templates?.length ?? 0 },
                { label: 'Sent (30d)', value: channelOptions.reduce((s, c) => s + (analyticsTotals[`${c}:SENT`] ?? 0), 0) },
                { label: 'Queued', value: scheduleBatches.filter((b) => b.primaryStatus === 'QUEUED').length },
                { label: 'Drip campaigns', value: drips?.length ?? 0 },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-white/20 bg-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-white/70">{kpi.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{kpi.value}</p>
                </div>
              ))}
            </div>
          </Card>

          {gate.readOnly ? <ReadOnlyNotice /> : null}

          {/* Church selector */}
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
          ) : !churchId && isLoadingChurches ? (
            <p className="text-xs text-muted">Loading churches…</p>
          ) : null}

          {/* Tabs */}
          <Tabs defaultValue="overview">
            <div className="sticky top-16 z-10 -mx-4 border-b border-border/50 bg-white/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="compose">Compose</TabsTrigger>
                <TabsTrigger value="automation">Automation</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
            </div>

            {/* ── Overview ─────────────────────────────────────────────────── */}
            <TabsContent value="overview" className="mt-6 space-y-6">
              {/* Delivery summary */}
              <Card className="ff-surface p-6">
                <h2 className="text-lg font-semibold">Delivery summary (30 days)</h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[400px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted">
                        <th className="py-2 pr-4">Channel</th>
                        <th className="py-2 pr-4">Sent</th>
                        <th className="py-2 pr-4">Failed</th>
                        <th className="py-2 pr-4">Queued</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channelOptions.map((ch) => (
                        <tr key={ch} className="border-b border-border last:border-0">
                          <td className="py-2 pr-4 font-medium">{ch}</td>
                          <td className="py-2 pr-4 font-mono">{analyticsTotals[`${ch}:SENT`] ?? 0}</td>
                          <td className="py-2 pr-4 font-mono">{analyticsTotals[`${ch}:FAILED`] ?? 0}</td>
                          <td className="py-2 pr-4 font-mono">{analyticsTotals[`${ch}:QUEUED`] ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(commsAnalytics?.topFailures?.length ?? 0) > 0 ? (
                  <div className="mt-5">
                    <p className="mb-2 text-sm font-semibold">Top failures</p>
                    <div className="space-y-2">
                      {commsAnalytics?.topFailures?.map((row, idx) => (
                        <div key={`${row.source}-${row.channel}-${idx}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs">
                          <span className="text-muted">{row.source} · {row.channel}</span>
                          <span className="text-foreground">{row.error}</span>
                          <span className="font-mono font-bold">{row.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </Card>

              {/* Quiet hours */}
              <Card className="ff-surface p-6">
                <h2 className="text-lg font-semibold">Quiet hours</h2>
                <p className="mt-1 text-sm text-muted">SMS/WhatsApp sends are rescheduled during quiet hours. Members can be marked "allow quiet hours" for urgent communications.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <input type="checkbox" checked={quietEnabled} onChange={(e) => setQuietEnabled(e.target.checked)} disabled={!canWrite} />
                    Enabled
                  </label>
                  <Input placeholder="Start hour (0–23)" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} disabled={!canWrite} />
                  <Input placeholder="End hour (0–23)" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} disabled={!canWrite} />
                  <Input placeholder="Reschedule minutes" value={quietIncrement} onChange={(e) => setQuietIncrement(e.target.value)} disabled={!canWrite} />
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Button onClick={handleSaveQuietHours} disabled={!canWrite || isSavingQuietHours || !churchId}>
                    {isSavingQuietHours ? 'Saving…' : 'Save quiet hours'}
                  </Button>
                  {quietHoursStatus ? <p className="text-xs text-muted">{quietHoursStatus}</p> : null}
                </div>
              </Card>
            </TabsContent>

            {/* ── Compose ──────────────────────────────────────────────────── */}
            <TabsContent value="compose" className="mt-6 space-y-6">
              {/* Templates */}
              <Card className="ff-surface p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Templates</h2>
                    <p className="mt-0.5 text-xs text-muted">Supported variables: {'{{firstName}}'}, {'{{lastName}}'}, {'{{email}}'}, {'{{phone}}'}, {'{{donorName}}'}, {'{{churchName}}'}</p>
                  </div>
                  <Button size="sm" onClick={() => setTemplateOpen(true)} disabled={!canWrite || !churchId}>+ New template</Button>
                </div>
                <div className="mt-4">
                  <DataTable
                    columns={templateColumns}
                    data={templates ?? []}
                    emptyMessage="No templates yet. Create your first template to speed up sends."
                  />
                </div>
              </Card>

              {/* Send now */}
              <Card className="ff-surface p-6">
                <h2 className="text-lg font-semibold">Send message</h2>
                <p className="mt-1 text-sm text-muted">Choose a template or write a custom message. Audiences expand to real recipients.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={sendChannel} onChange={(e) => setSendChannel(e.target.value)}>
                    {channelOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                    <option value="">No template</option>
                    {sendTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={audience} onChange={(e) => setAudience(e.target.value)}>
                    {audienceOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <Input placeholder="Recipients (comma separated)" value={sendTo} onChange={(e) => setSendTo(e.target.value)} />
                  {sendChannel === 'EMAIL' && (
                    <Input placeholder="Email subject (required without template)" value={sendSubject} onChange={(e) => setSendSubject(e.target.value)} className="sm:col-span-2" />
                  )}
                  <Textarea placeholder="Message body (required without template)" value={sendBody} onChange={(e) => setSendBody(e.target.value)} className="sm:col-span-2 min-h-[120px]" />
                </div>
                {sendPreviewEnabled ? (
                  <div className="mt-3 rounded-lg border border-border bg-muted/5 p-3 text-xs text-muted">
                    {sendPreview?.deliverable ?? 0} deliverable of {sendPreview?.total ?? 0} · Blocked: {sendPreview?.blockedCount ?? 0} (suppressed {sendPreview?.suppressed ?? 0}, opted out {sendPreview?.optedOut ?? 0}, invalid {sendPreview?.invalid ?? 0})
                    {sendPreview?.unsubscribeMechanism ? <p className="mt-1">{sendPreview.unsubscribeMechanism}</p> : null}
                  </div>
                ) : null}
                <div className="mt-4 flex items-center gap-3">
                  <Button onClick={handleSendMessage} disabled={!canWrite || isSendingMessage || (sendPreviewEnabled && (sendPreview?.deliverable ?? 0) === 0)}>
                    {isSendingMessage ? 'Sending…' : 'Send'}
                  </Button>
                  {sendStatus ? <p className="text-xs text-muted">{sendStatus}</p> : null}
                </div>
              </Card>
            </TabsContent>

            {/* ── Automation ───────────────────────────────────────────────── */}
            <TabsContent value="automation" className="mt-6 space-y-6">
              {/* Schedule message */}
              <Card className="ff-surface p-6">
                <h2 className="text-lg font-semibold">Schedule message</h2>
                <p className="mt-1 text-sm text-muted">Draft, review, and queue messages to be sent later.</p>

                {/* AI draft assistant */}
                <div className="mt-4 rounded-xl border border-primary/10 bg-primary/5 p-4">
                  <p className="text-sm font-semibold text-primary">AI drafting assistant (human review required)</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Input placeholder="Draft objective (e.g. remind volunteers for Sunday service)" value={draftObjective} onChange={(e) => setDraftObjective(e.target.value)} />
                    <Input placeholder="Audience hint (optional)" value={draftAudienceHint} onChange={(e) => setDraftAudienceHint(e.target.value)} />
                    <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={draftTone} onChange={(e) => setDraftTone(e.target.value as any)}>
                      <option value="PASTORAL">Pastoral</option>
                      <option value="INFORMATIVE">Informative</option>
                      <option value="FRIENDLY">Friendly</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                    <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={draftProvider} onChange={(e) => setDraftProvider(e.target.value as any)}>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Claude</option>
                      <option value="google">Gemini</option>
                    </select>
                  </div>
                  <Button
                    className="mt-3"
                    size="sm"
                    disabled={!canWrite || !churchId || draftObjective.trim().length < 10 || isGeneratingDraft}
                    onClick={() => generateDraft({ churchId, channel: scheduleChannel as any, objective: draftObjective, audienceHint: draftAudienceHint || undefined, tone: draftTone, provider: draftProvider })}
                  >
                    {isGeneratingDraft ? 'Drafting…' : 'Draft with AI'}
                  </Button>
                  {draftChecklist.length ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
                      {draftChecklist.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={scheduleChannel} onChange={(e) => setScheduleChannel(e.target.value)}>
                    {channelOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={scheduleInitialStatus} onChange={(e) => setScheduleInitialStatus(e.target.value as any)}>
                    <option value="QUEUED">Queue (ready to send)</option>
                    <option value="DRAFT">Draft</option>
                    <option value="PENDING_REVIEW">Submit for review</option>
                  </select>
                  <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={scheduleTemplateId} onChange={(e) => setScheduleTemplateId(e.target.value)}>
                    <option value="">No template</option>
                    {scheduleTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={scheduleAudience} onChange={(e) => setScheduleAudience(e.target.value)}>
                    {audienceOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <Input placeholder="Recipients (comma separated)" value={scheduleTo} onChange={(e) => setScheduleTo(e.target.value)} />
                  <Input type="datetime-local" value={scheduleSendAt} onChange={(e) => setScheduleSendAt(e.target.value)} />
                  {scheduleChannel === 'EMAIL' && (
                    <Input placeholder="Email subject (required without template)" value={scheduleSubject} onChange={(e) => setScheduleSubject(e.target.value)} className="sm:col-span-2" />
                  )}
                  <Textarea placeholder="Message body (required without template)" value={scheduleBody} onChange={(e) => setScheduleBody(e.target.value)} className="sm:col-span-2 min-h-[120px]" />
                </div>
                {schedulePreviewEnabled ? (
                  <div className="mt-3 rounded-lg border border-border bg-muted/5 p-3 text-xs text-muted">
                    {schedulePreview?.deliverable ?? 0} deliverable of {schedulePreview?.total ?? 0} · Blocked: {schedulePreview?.blockedCount ?? 0}
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button onClick={handleScheduleMessage} disabled={!canWrite || isScheduling || (schedulePreviewEnabled && (schedulePreview?.deliverable ?? 0) === 0)}>
                    {isScheduling ? 'Saving…' : scheduleInitialStatus === 'QUEUED' ? 'Queue' : 'Save'}
                  </Button>
                  <Button variant="outline" onClick={() => dispatchDue({ limit: 50 })} disabled={!canWrite || isDispatching}>
                    {isDispatching ? 'Dispatching…' : 'Dispatch due now'}
                  </Button>
                  {scheduleStatus ? <p className="text-xs text-muted">{scheduleStatus}</p> : null}
                </div>
                {lastScheduleBatchKey ? <p className="mt-2 font-mono text-xs text-muted">Batch: {lastScheduleBatchKey}</p> : null}
                {batchActionStatus ? <p className="mt-1 text-xs text-muted">{batchActionStatus}</p> : null}

                {/* Scheduled batches */}
                {scheduleBatches.length ? (
                  <div className="mt-6 space-y-2">
                    <p className="text-sm font-semibold">Scheduled batches</p>
                    {scheduleBatches.map((batch) => (
                      <div key={batch.batchKey} className="rounded-lg border border-border bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm">
                            <span className="font-medium">{batch.channel}</span>
                            <span className="text-muted"> · {batch.count} recipient(s)</span>
                          </div>
                          <div className="text-xs text-muted">{batch.sendAt ? new Date(batch.sendAt).toLocaleString() : 'N/A'} · {batch.primaryStatus}</div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {batch.primaryStatus === 'DRAFT' ? (
                            <Button size="sm" variant="outline" disabled={!canWrite || isUpdatingBatch} onClick={() => updateBatchStatus({ churchId, batchKey: batch.batchKey, status: 'PENDING_REVIEW' })}>Submit for review</Button>
                          ) : null}
                          {batch.primaryStatus === 'PENDING_REVIEW' ? (
                            <Button size="sm" disabled={!canWrite || isUpdatingBatch} onClick={() => updateBatchStatus({ churchId, batchKey: batch.batchKey, status: 'QUEUED' })}>Approve & queue</Button>
                          ) : null}
                          {batch.primaryStatus === 'QUEUED' ? (
                            <Button size="sm" variant="outline" disabled={!canWrite || isUpdatingBatch} onClick={() => updateBatchStatus({ churchId, batchKey: batch.batchKey, status: 'CANCELED' })}>Cancel</Button>
                          ) : null}
                        </div>
                        <p className="mt-2 break-all font-mono text-[11px] text-muted">{batch.batchKey}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </Card>

              {/* Calendar */}
              <Card className="ff-surface p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Schedule calendar</h2>
                    <p className="mt-0.5 text-sm text-muted">Upcoming sends grouped by day (church timezone).</p>
                  </div>
                  <div className="flex gap-2">
                    <select className="h-9 rounded-md border border-border bg-white px-3 text-sm" value={calendarWindowDays} onChange={(e) => setCalendarWindowDays(e.target.value)}>
                      <option value="14">Next 14 days</option>
                      <option value="30">Next 30 days</option>
                      <option value="60">Next 60 days</option>
                    </select>
                    <select className="h-9 rounded-md border border-border bg-white px-3 text-sm" value={calendarChannel} onChange={(e) => setCalendarChannel(e.target.value as any)}>
                      <option value="ALL">All channels</option>
                      {channelOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-4 md:grid-cols-7">
                  {calendarDays.map((day) => (
                    <div key={day.key} className="rounded-md border border-border bg-white p-3">
                      <p className="text-xs font-medium">{day.label}</p>
                      <div className="mt-2 space-y-1 text-xs text-muted">
                        {Object.keys(day.counts).length ? (
                          Object.entries(day.counts).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                            <div key={status} className="flex justify-between gap-1">
                              <span>{status}</span>
                              <span className="font-mono font-bold">{count}</span>
                            </div>
                          ))
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Drip campaigns */}
              <Card className="ff-surface p-6">
                <h2 className="text-lg font-semibold">Drip campaigns</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Input placeholder="Campaign name *" value={dripName} onChange={(e) => setDripName(e.target.value)} />
                  <Input placeholder="Description (optional)" value={dripDescription} onChange={(e) => setDripDescription(e.target.value)} />
                </div>
                <Button className="mt-3" size="sm" onClick={handleCreateDrip} disabled={!canWrite || isCreatingDrip || !churchId}>
                  {isCreatingDrip ? 'Creating…' : 'Create drip'}
                </Button>

                {/* Drip list */}
                {drips?.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {drips.map((drip) => (
                      <button
                        key={drip.id}
                        type="button"
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${selectedDripId === drip.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted hover:border-primary/50'}`}
                        onClick={() => setSelectedDripId(drip.id)}
                      >
                        {drip.name}
                      </button>
                    ))}
                  </div>
                ) : null}

                {selectedDripId ? (
                  <div className="mt-5 space-y-4 rounded-xl border border-border bg-muted/5 p-4">
                    <p className="text-sm font-semibold">Add step</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input placeholder="Step order" type="number" value={dripStepOrder} onChange={(e) => setDripStepOrder(e.target.value)} />
                      <Input placeholder="Delay hours" type="number" value={dripDelayHours} onChange={(e) => setDripDelayHours(e.target.value)} />
                      <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={dripChannel} onChange={(e) => setDripChannel(e.target.value)}>
                        {channelOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={dripTemplateId} onChange={(e) => setDripTemplateId(e.target.value)}>
                        <option value="">No template</option>
                        {dripTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      {dripChannel === 'EMAIL' && (
                        <Input placeholder="Email subject" value={dripSubject} onChange={(e) => setDripSubject(e.target.value)} className="sm:col-span-2" />
                      )}
                      <Textarea placeholder="Step body (HTML for email)" value={dripBody} onChange={(e) => setDripBody(e.target.value)} className="sm:col-span-2 min-h-[100px]" />
                    </div>
                    <Button size="sm" onClick={handleAddDripStep} disabled={!canWrite || isAddingDripStep}>
                      {isAddingDripStep ? 'Adding…' : 'Add drip step'}
                    </Button>

                    {/* Steps list */}
                    {dripSteps?.length ? (
                      <div className="space-y-1.5">
                        {dripSteps.map((step) => (
                          <div key={step.id} className="flex items-center justify-between rounded-md border border-border bg-white px-3 py-2 text-xs">
                            <span>Step {step.stepOrder} · {step.channel} · +{step.delayHours}h</span>
                            <span className="text-muted">{step.templateId ? 'Template' : 'Custom'}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {/* Enroll */}
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={dripAudience} onChange={(e) => setDripAudience(e.target.value)}>
                        {audienceOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <Input placeholder="Recipients (comma separated)" value={dripTo} onChange={(e) => setDripTo(e.target.value)} />
                    </div>
                    <Button size="sm" onClick={handleEnrollDrip} disabled={!canWrite || isEnrollingDrip}>
                      {isEnrollingDrip ? 'Enrolling…' : 'Enroll recipients'}
                    </Button>
                  </div>
                ) : null}
                {dripStatus ? <p className="mt-3 text-xs text-muted">{dripStatus}</p> : null}
              </Card>
            </TabsContent>

            {/* ── Activity ──────────────────────────────────────────────────── */}
            <TabsContent value="activity" className="mt-6 space-y-6">
              {/* Summary badges */}
              {summary?.length ? (
                <div className="flex flex-wrap gap-2">
                  {summary.map((item) => (
                    <Badge key={`${item.channel}-${item.status}`} variant={item.status === 'SENT' ? 'success' : item.status === 'FAILED' ? 'warning' : 'default'}>
                      {item.channel} {item.status}: {item._count}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <Card className="ff-surface p-6">
                <h2 className="text-lg font-semibold">Recent messages</h2>
                <div className="mt-4">
                  <DataTable
                    columns={messageColumns}
                    data={messages ?? []}
                    emptyMessage="No messages sent yet."
                  />
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* ── Create Template Dialog ─────────────────────────────────────────── */}
      <Dialog open={templateOpen} onOpenChange={(open) => { setTemplateOpen(open); if (!open) { setTemplateName(''); setTemplateBody(''); setTemplateSubject(''); setTemplateStatus(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>New template</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <Input placeholder="Template name *" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
            <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={templateChannel} onChange={(e) => setTemplateChannel(e.target.value)}>
              {channelOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {templateChannel === 'EMAIL' && (
              <Input placeholder="Email subject *" value={templateSubject} onChange={(e) => setTemplateSubject(e.target.value)} />
            )}
            <Textarea placeholder="Template body * (HTML for email)" value={templateBody} onChange={(e) => setTemplateBody(e.target.value)} className="min-h-[140px]" />
            {templateStatus ? <p className="text-xs text-muted">{templateStatus}</p> : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTemplate} disabled={!canWrite || isCreatingTemplate}>
              {isCreatingTemplate ? 'Creating…' : 'Create template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
