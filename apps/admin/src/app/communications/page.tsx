'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { PageSectionLayout } from '../../components/PageSectionLayout';
import { trpc } from '../../lib/trpc';
import { useFeatureGate } from '../../lib/entitlements';
import { FeatureLocked } from '../../components/FeatureLocked';
import { ReadOnlyNotice } from '../../components/ReadOnlyNotice';

const channelOptions = ['EMAIL', 'SMS', 'WHATSAPP'] as const;

export default function CommunicationsPage() {
  const gate = useFeatureGate('communications_enabled');
  const utils = trpc.useUtils();
  const canWrite = gate.canWrite;
  const [churchId, setChurchId] = useState('');
  const [quietEnabled, setQuietEnabled] = useState(true);
  const [quietStart, setQuietStart] = useState('21');
  const [quietEnd, setQuietEnd] = useState('7');
  const [quietIncrement, setQuietIncrement] = useState('30');
  const [templateName, setTemplateName] = useState('');
  const [templateChannel, setTemplateChannel] = useState('EMAIL');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [sendChannel, setSendChannel] = useState('EMAIL');
  const [sendTo, setSendTo] = useState('');
  const [sendSubject, setSendSubject] = useState('');
  const [sendBody, setSendBody] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [audience, setAudience] = useState('');
  const [scheduleChannel, setScheduleChannel] = useState('EMAIL');
  const [scheduleTo, setScheduleTo] = useState('');
  const [scheduleAudience, setScheduleAudience] = useState('');
  const [scheduleTemplateId, setScheduleTemplateId] = useState('');
  const [scheduleSubject, setScheduleSubject] = useState('');
  const [scheduleBody, setScheduleBody] = useState('');
  const [scheduleSendAt, setScheduleSendAt] = useState('');
  const [scheduleInitialStatus, setScheduleInitialStatus] = useState<'QUEUED' | 'DRAFT' | 'PENDING_REVIEW'>('QUEUED');
  const [draftObjective, setDraftObjective] = useState('');
  const [draftAudienceHint, setDraftAudienceHint] = useState('');
  const [draftTone, setDraftTone] = useState<'PASTORAL' | 'INFORMATIVE' | 'URGENT' | 'FRIENDLY'>('PASTORAL');
  const [draftProvider, setDraftProvider] = useState<'openai' | 'anthropic' | 'google'>('openai');
  const [draftChecklist, setDraftChecklist] = useState<string[]>([]);
  const [lastScheduleBatchKey, setLastScheduleBatchKey] = useState('');
  const [batchActionStatus, setBatchActionStatus] = useState<string>('');
  const [calendarWindowDays, setCalendarWindowDays] = useState('14');
  const [calendarChannel, setCalendarChannel] = useState<'ALL' | (typeof channelOptions)[number]>('ALL');
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

  const { data: churches } = trpc.church.list.useQuery({ organizationId: undefined });
  const { data: templates } = trpc.communications.templates.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: messages } = trpc.communications.messages.useQuery(
    { churchId: churchId || undefined, limit: 20 },
    { enabled: Boolean(churchId) }
  );
  const { data: schedules } = trpc.communications.schedules.useQuery(
    { churchId: churchId || undefined, limit: 20 },
    { enabled: Boolean(churchId) }
  );
  const calendarRange = useMemo(() => {
    const days = Math.max(7, Math.min(60, Number(calendarWindowDays) || 14));
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + days);
    return { from, to, days };
  }, [calendarWindowDays]);

  const { data: calendarSchedules } = trpc.communications.schedulesRange.useQuery(
    { churchId: churchId || undefined, from: calendarRange.from, to: calendarRange.to, limit: 2000 },
    { enabled: Boolean(churchId) }
  );

  const { data: commsAnalytics } = trpc.communications.analytics.useQuery(
    { churchId: churchId || undefined, days: 30 },
    { enabled: Boolean(churchId) }
  );
  const { data: drips } = trpc.communications.drips.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: dripSteps } = trpc.communications.dripSteps.useQuery(
    { campaignId: selectedDripId },
    { enabled: Boolean(selectedDripId) }
  );
  const { data: summary } = trpc.communications.summary.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const parsedSendRecipients = useMemo(
    () =>
      sendTo
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    [sendTo]
  );
  const parsedScheduleRecipients = useMemo(
    () =>
      scheduleTo
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    [scheduleTo]
  );

  const sendPreviewEnabled = Boolean(churchId && (parsedSendRecipients.length || audience));
  const { data: sendPreview } = trpc.communications.previewAudience.useQuery(
    {
      churchId,
      channel: sendChannel as any,
      to: parsedSendRecipients.length ? parsedSendRecipients : undefined,
      audience: audience ? (audience as any) : undefined,
    },
    { enabled: sendPreviewEnabled }
  );

  const schedulePreviewEnabled = Boolean(churchId && (parsedScheduleRecipients.length || scheduleAudience));
  const { data: schedulePreview } = trpc.communications.previewAudience.useQuery(
    {
      churchId,
      channel: scheduleChannel as any,
      to: parsedScheduleRecipients.length ? parsedScheduleRecipients : undefined,
      audience: scheduleAudience ? (scheduleAudience as any) : undefined,
    },
    { enabled: schedulePreviewEnabled }
  );

  useEffect(() => {
    if (!churchId && churches?.length) {
      setChurchId(churches[0].id);
    }
  }, [churchId, churches]);

  const selectedChurch = useMemo(() => churches?.find((church) => church.id === churchId) ?? null, [churches, churchId]);

  useEffect(() => {
    if (!selectedChurch) return;
    setQuietEnabled(Boolean((selectedChurch as any).quietHoursEnabled ?? true));
    setQuietStart(String((selectedChurch as any).quietHoursStartHour ?? 21));
    setQuietEnd(String((selectedChurch as any).quietHoursEndHour ?? 7));
    setQuietIncrement(String((selectedChurch as any).quietHoursRescheduleMinutes ?? 30));
  }, [selectedChurch?.id]);

  useEffect(() => {
    if (!selectedDripId && drips?.length) {
      setSelectedDripId(drips[0].id);
    }
  }, [selectedDripId, drips]);

  useEffect(() => {
    if (dripSteps?.length) {
      setDripChannel(dripSteps[0].channel);
    }
  }, [dripSteps]);

  const templatesByChannel = useMemo(() => {
    const map: Record<string, typeof templates> = { EMAIL: [], SMS: [], WHATSAPP: [] };
    for (const template of templates ?? []) {
      map[template.channel] = [...(map[template.channel] ?? []), template];
    }
    return map;
  }, [templates]);

  const sendTemplates = templatesByChannel[sendChannel] ?? [];
  const scheduleTemplates = templatesByChannel[scheduleChannel] ?? [];
  const dripTemplates = templatesByChannel[dripChannel] ?? [];

  const scheduleBatches = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const item of schedules ?? []) {
      const meta = (item as any).metadata as any;
      const key = meta?.batchKey;
      const batchKey = typeof key === 'string' && key.length ? key : `single:${item.id}`;
      const list = map.get(batchKey) ?? [];
      list.push(item);
      map.set(batchKey, list);
    }
    return Array.from(map.entries()).map(([batchKey, entries]) => {
      const sorted = [...entries].sort((a, b) => new Date(a.sendAt).getTime() - new Date(b.sendAt).getTime());
      const statusCounts = sorted.reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = (acc[row.status] ?? 0) + 1;
        return acc;
      }, {});
      return {
        batchKey,
        channel: sorted[0]?.channel,
        sendAt: sorted[0]?.sendAt,
        primaryStatus: sorted[0]?.status,
        count: sorted.length,
        statusCounts,
      };
    });
  }, [schedules]);

  const calendarDays = useMemo(() => {
    const tz = (selectedChurch as any)?.timezone ?? 'UTC';
    const start = calendarRange.from;
    const days = calendarRange.days;
    const buckets = new Map<
      string,
      {
        key: string;
        label: string;
        counts: Record<string, number>;
      }
    >();

    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
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

  const { mutate: createTemplate, isPending: isCreatingTemplate } = trpc.communications.createTemplate.useMutation({
    onSuccess: async () => {
      setTemplateName('');
      setTemplateBody('');
      setTemplateSubject('');
      await utils.communications.templates.invalidate();
    },
  });

  const { mutate: sendMessage, isPending: isSendingMessage } = trpc.communications.send.useMutation({
    onSuccess: async () => {
      setSendTo('');
      setSendSubject('');
      setSendBody('');
      setTemplateId('');
      setAudience('');
      await utils.communications.messages.invalidate();
    },
  });

  const { mutate: scheduleMessage, isPending: isScheduling } = trpc.communications.schedule.useMutation({
    onSuccess: async (data) => {
      setScheduleTo('');
      setScheduleSubject('');
      setScheduleBody('');
      setScheduleTemplateId('');
      setScheduleAudience('');
      setLastScheduleBatchKey((data as any)?.batchKey ?? '');
      await utils.communications.schedules.invalidate();
    },
  });

  const { mutate: updateBatchStatus, isPending: isUpdatingBatch } =
    trpc.communications.updateScheduleBatchStatus.useMutation({
      onSuccess: async (data) => {
        setBatchActionStatus(`Updated ${data.updated} schedule(s).`);
        await utils.communications.schedules.invalidate();
      },
      onError: (error) => setBatchActionStatus(error.message),
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
      setDripName('');
      setDripDescription('');
      await utils.communications.drips.invalidate();
    },
  });

  const { mutate: addDripStep, isPending: isAddingDripStep } = trpc.communications.addDripStep.useMutation({
    onSuccess: async () => {
      setDripStepOrder(String(Number(dripStepOrder) + 1));
      setDripDelayHours('24');
      setDripSubject('');
      setDripBody('');
      setDripTemplateId('');
      await utils.communications.dripSteps.invalidate();
    },
  });

  const { mutate: enrollDrip, isPending: isEnrollingDrip } = trpc.communications.enrollDrip.useMutation({
    onSuccess: async () => {
      setDripTo('');
      setDripAudience('');
      await utils.communications.schedules.invalidate();
    },
  });

  const { mutate: updateChurch, isPending: isSavingQuietHours } = trpc.church.update.useMutation({
    onSuccess: async () => {
      await utils.church.list.invalidate();
    },
  });

  return (
    <Shell>
      {!gate.isLoading && gate.access === 'locked' ? (
        <FeatureLocked
          featureKey="communications_enabled"
          title="Communications are locked"
          description="Your current subscription does not include communications. Upgrade to restore access."
        />
      ) : (
      <PageSectionLayout rootId="communications-page-sections" title="Communications sections" className="space-y-6">
        {gate.readOnly ? <ReadOnlyNotice /> : null}

        <Card className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Communications</h2>
              <p className="mt-1 text-sm text-muted">Create templates and send emails/SMS/WhatsApp to your community.</p>
            </div>
            <Link
              href="/communications/suppressions"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Manage suppressions
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={churchId}
              onChange={(event) => setChurchId(event.target.value)}
            >
              {churches?.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.name}
                </option>
              ))}
            </select>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Quiet hours</h2>
          <p className="mt-1 text-sm text-muted">
            SMS/WhatsApp sends are rescheduled during quiet hours. Members can be marked as “allow quiet hours” for urgent
            communications.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={quietEnabled}
                onChange={(event) => setQuietEnabled(event.target.checked)}
                disabled={!canWrite}
              />
              Enabled
            </label>
            <Input
              placeholder="Start hour (0-23)"
              value={quietStart}
              onChange={(event) => setQuietStart(event.target.value)}
              disabled={!canWrite}
            />
            <Input
              placeholder="End hour (0-23)"
              value={quietEnd}
              onChange={(event) => setQuietEnd(event.target.value)}
              disabled={!canWrite}
            />
            <Input
              placeholder="Reschedule minutes"
              value={quietIncrement}
              onChange={(event) => setQuietIncrement(event.target.value)}
              disabled={!canWrite}
            />
          </div>
          <div className="mt-4">
            <Button
              onClick={() =>
                updateChurch({
                  id: churchId,
                  quietHoursEnabled: quietEnabled,
                  quietHoursStartHour: Number(quietStart || '21'),
                  quietHoursEndHour: Number(quietEnd || '7'),
                  quietHoursRescheduleMinutes: Number(quietIncrement || '30'),
                })
              }
              disabled={!canWrite || !churchId || isSavingQuietHours}
            >
              {isSavingQuietHours ? 'Saving…' : 'Save quiet hours'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Templates</h2>
          <p className="mt-1 text-sm text-muted">
            Supported variables: {'{{firstName}}'}, {'{{lastName}}'}, {'{{email}}'}, {'{{phone}}'}, {'{{donorName}}'},
            {'{{churchName}}'}
          </p>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {templates?.map((template) => (
              <div key={template.id} className="flex items-center justify-between">
                <span>
                  {template.name} · {template.channel}
                </span>
                <span>{new Date(template.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
            {!templates?.length && <p>No templates yet.</p>}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Template name"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
            />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={templateChannel}
              onChange={(event) => setTemplateChannel(event.target.value)}
            >
              {channelOptions.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
            {templateChannel === 'EMAIL' && (
              <Input
                placeholder="Email subject"
                value={templateSubject}
                onChange={(event) => setTemplateSubject(event.target.value)}
              />
            )}
            <textarea
              className="min-h-[120px] w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              placeholder="Template body (HTML for email)"
              value={templateBody}
              onChange={(event) => setTemplateBody(event.target.value)}
            />
            <Button
              onClick={() =>
                createTemplate({
                  churchId,
                  name: templateName,
                  channel: templateChannel as any,
                  subject: templateChannel === 'EMAIL' ? templateSubject : undefined,
                  body: templateBody,
                })
              }
              disabled={!canWrite || !churchId || !templateName || !templateBody || isCreatingTemplate}
            >
              {isCreatingTemplate ? 'Creating…' : 'Create template'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Send message</h2>
          <p className="mt-1 text-sm text-muted">Choose a template or write a custom message. Audiences expand to real recipients.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={sendChannel}
              onChange={(event) => setSendChannel(event.target.value)}
            >
              {channelOptions.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
            >
              <option value="">No template</option>
              {sendTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
            >
              <option value="">No audience</option>
              <option value="ALL_MEMBERS">All members</option>
              <option value="ACTIVE_MEMBERS">Active members</option>
              <option value="DONORS_90_DAYS">Donors (last 90 days)</option>
            </select>
            <Input
              placeholder="Recipients (comma separated)"
              value={sendTo}
              onChange={(event) => setSendTo(event.target.value)}
            />
            {sendChannel === 'EMAIL' && (
              <Input
                placeholder="Email subject"
                value={sendSubject}
                onChange={(event) => setSendSubject(event.target.value)}
              />
            )}
            <textarea
              className="min-h-[120px] w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              placeholder="Message body (HTML for email)"
              value={sendBody}
              onChange={(event) => setSendBody(event.target.value)}
            />
            <Button
              onClick={() =>
                sendMessage({
                  churchId,
                  channel: sendChannel as any,
                  templateId: templateId || undefined,
                  audience: audience ? (audience as any) : undefined,
                  subject: sendChannel === 'EMAIL' ? sendSubject : undefined,
                  body: sendBody || undefined,
                  to: parsedSendRecipients,
                })
              }
              disabled={
                !canWrite ||
                !churchId ||
                (!sendTo && !audience) ||
                isSendingMessage ||
                (sendPreviewEnabled && (sendPreview?.deliverable ?? 0) === 0)
              }
            >
              {isSendingMessage ? 'Sending…' : 'Send'}
            </Button>
          </div>
          {sendPreviewEnabled ? (
            <div className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted">
              <p>
                Preview: {sendPreview?.deliverable ?? 0} deliverable of {sendPreview?.total ?? 0}. Blocked:{' '}
                {sendPreview?.blockedCount ?? 0} (suppressed {sendPreview?.suppressed ?? 0}, opted out{' '}
                {sendPreview?.optedOut ?? 0}, invalid {sendPreview?.invalid ?? 0}).
              </p>
              <p className="mt-1">{sendPreview?.unsubscribeMechanism ?? 'Unsubscribe control not configured.'}</p>
            </div>
          ) : null}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Schedule message</h2>
          <p className="mt-1 text-sm text-muted">Draft, review, and queue messages to be sent later (use dispatch in your cron).</p>
          <div className="mt-4 rounded-md border border-border bg-muted/40 p-3">
            <p className="text-sm font-medium text-foreground">AI drafting assistant (human review required)</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <Input
                placeholder="Draft objective (e.g. remind volunteers for Sunday service)"
                value={draftObjective}
                onChange={(event) => setDraftObjective(event.target.value)}
              />
              <Input
                placeholder="Audience hint (optional)"
                value={draftAudienceHint}
                onChange={(event) => setDraftAudienceHint(event.target.value)}
              />
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={draftTone}
                onChange={(event) => setDraftTone(event.target.value as any)}
              >
                <option value="PASTORAL">Pastoral</option>
                <option value="INFORMATIVE">Informative</option>
                <option value="FRIENDLY">Friendly</option>
                <option value="URGENT">Urgent</option>
              </select>
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={draftProvider}
                onChange={(event) => setDraftProvider(event.target.value as any)}
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Claude</option>
                <option value="google">Gemini</option>
              </select>
              <Button
                onClick={() =>
                  generateDraft({
                    churchId,
                    channel: scheduleChannel as any,
                    objective: draftObjective,
                    audienceHint: draftAudienceHint || undefined,
                    tone: draftTone,
                    provider: draftProvider,
                  })
                }
                disabled={!canWrite || !churchId || draftObjective.trim().length < 10 || isGeneratingDraft}
              >
                {isGeneratingDraft ? 'Drafting…' : 'Draft with AI'}
              </Button>
            </div>
            {draftChecklist.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
                {draftChecklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={scheduleChannel}
              onChange={(event) => setScheduleChannel(event.target.value)}
            >
              {channelOptions.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={scheduleInitialStatus}
              onChange={(event) => setScheduleInitialStatus(event.target.value as any)}
            >
              <option value="QUEUED">Queue (ready to send)</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_REVIEW">Submit for review</option>
            </select>
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={scheduleTemplateId}
              onChange={(event) => setScheduleTemplateId(event.target.value)}
            >
              <option value="">No template</option>
              {scheduleTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={scheduleAudience}
              onChange={(event) => setScheduleAudience(event.target.value)}
            >
              <option value="">No audience</option>
              <option value="ALL_MEMBERS">All members</option>
              <option value="ACTIVE_MEMBERS">Active members</option>
              <option value="DONORS_90_DAYS">Donors (last 90 days)</option>
            </select>
            <Input
              placeholder="Recipients (comma separated)"
              value={scheduleTo}
              onChange={(event) => setScheduleTo(event.target.value)}
            />
            {scheduleChannel === 'EMAIL' && (
              <Input
                placeholder="Email subject"
                value={scheduleSubject}
                onChange={(event) => setScheduleSubject(event.target.value)}
              />
            )}
            <textarea
              className="min-h-[120px] w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              placeholder="Message body (HTML for email)"
              value={scheduleBody}
              onChange={(event) => setScheduleBody(event.target.value)}
            />
            <Input
              type="datetime-local"
              value={scheduleSendAt}
              onChange={(event) => setScheduleSendAt(event.target.value)}
            />
            <Button
              onClick={() =>
                scheduleMessage({
                  churchId,
                  channel: scheduleChannel as any,
                  templateId: scheduleTemplateId || undefined,
                  audience: scheduleAudience ? (scheduleAudience as any) : undefined,
                  subject: scheduleChannel === 'EMAIL' ? scheduleSubject : undefined,
                  body: scheduleBody || undefined,
                  sendAt: scheduleSendAt ? new Date(scheduleSendAt) : new Date(),
                  initialStatus: scheduleInitialStatus,
                  to: parsedScheduleRecipients,
                })
              }
              disabled={
                !canWrite ||
                !churchId ||
                (!scheduleTo && !scheduleAudience) ||
                isScheduling ||
                (schedulePreviewEnabled && (schedulePreview?.deliverable ?? 0) === 0)
              }
            >
              {isScheduling ? 'Saving…' : scheduleInitialStatus === 'QUEUED' ? 'Queue' : 'Save'}
            </Button>
            <Button variant="outline" onClick={() => dispatchDue({ limit: 50 })} disabled={!canWrite || isDispatching}>
              {isDispatching ? 'Dispatching…' : 'Dispatch due now'}
            </Button>
          </div>
          {schedulePreviewEnabled ? (
            <div className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted">
              <p>
                Preview: {schedulePreview?.deliverable ?? 0} deliverable of {schedulePreview?.total ?? 0}. Blocked:{' '}
                {schedulePreview?.blockedCount ?? 0} (suppressed {schedulePreview?.suppressed ?? 0}, opted out{' '}
                {schedulePreview?.optedOut ?? 0}, invalid {schedulePreview?.invalid ?? 0}).
              </p>
              <p className="mt-1">{schedulePreview?.unsubscribeMechanism ?? 'Unsubscribe control not configured.'}</p>
            </div>
          ) : null}
          {lastScheduleBatchKey ? (
            <p className="mt-3 text-xs text-muted">
              Batch key: <span className="font-mono">{lastScheduleBatchKey}</span>
            </p>
          ) : null}
          {batchActionStatus ? <p className="mt-2 text-xs text-muted">{batchActionStatus}</p> : null}
          <div className="mt-4 space-y-2 text-sm text-muted">
            {scheduleBatches.map((batch) => (
              <div key={batch.batchKey} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-medium text-foreground">{batch.channel}</span>{' '}
                    <span className="text-muted">· {batch.count} recipient(s)</span>
                  </div>
                  <div className="text-xs text-muted">
                    {batch.sendAt ? new Date(batch.sendAt).toLocaleString() : 'N/A'} · {batch.primaryStatus}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {batch.primaryStatus === 'DRAFT' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateBatchStatus({ churchId, batchKey: batch.batchKey, status: 'PENDING_REVIEW' })}
                      disabled={!canWrite || isUpdatingBatch}
                    >
                      Submit for review
                    </Button>
                  ) : null}
                  {batch.primaryStatus === 'PENDING_REVIEW' ? (
                    <Button
                      size="sm"
                      onClick={() => updateBatchStatus({ churchId, batchKey: batch.batchKey, status: 'QUEUED' })}
                      disabled={!canWrite || isUpdatingBatch}
                    >
                      Approve & queue
                    </Button>
                  ) : null}
                  {batch.primaryStatus === 'QUEUED' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateBatchStatus({ churchId, batchKey: batch.batchKey, status: 'CANCELED' })}
                      disabled={!canWrite || isUpdatingBatch}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
                <p className="mt-2 text-[11px] text-muted font-mono break-all">{batch.batchKey}</p>
              </div>
            ))}
            {!schedules?.length && <p>No scheduled messages yet.</p>}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Schedule calendar</h2>
              <p className="mt-1 text-sm text-muted">Upcoming scheduled sends grouped by day (church timezone).</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-10 rounded-md border border-border bg-white px-3 text-sm"
                value={calendarWindowDays}
                onChange={(e) => setCalendarWindowDays(e.target.value)}
              >
                <option value="14">Next 14 days</option>
                <option value="30">Next 30 days</option>
                <option value="60">Next 60 days</option>
              </select>
              <select
                className="h-10 rounded-md border border-border bg-white px-3 text-sm"
                value={calendarChannel}
                onChange={(e) => setCalendarChannel(e.target.value as any)}
              >
                <option value="ALL">All channels</option>
                {channelOptions.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-7">
            {calendarDays.map((day) => (
              <div key={day.key} className="rounded-md border border-border bg-white p-3">
                <div className="text-xs font-medium text-foreground">{day.label}</div>
                <div className="mt-2 space-y-1 text-xs text-muted">
                  {Object.keys(day.counts).length ? (
                    <>
                      {Object.entries(day.counts)
                        .sort((a, b) => b[1] - a[1])
                        .map(([status, count]) => (
                          <div key={status} className="flex items-center justify-between gap-2">
                            <span>{status}</span>
                            <span className="font-mono text-foreground">{count}</span>
                          </div>
                        ))}
                    </>
                  ) : (
                    <div>No sends</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Delivery analytics (last 30 days)</h2>
          <p className="mt-1 text-sm text-muted">Counts based on communication messages sent/failed/queued.</p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="py-2 pr-4">Channel</th>
                  <th className="py-2 pr-4">SENT</th>
                  <th className="py-2 pr-4">FAILED</th>
                  <th className="py-2 pr-4">QUEUED</th>
                </tr>
              </thead>
              <tbody>
                {channelOptions.map((channel) => (
                  <tr key={channel} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 font-medium">{channel}</td>
                    <td className="py-2 pr-4 font-mono">{analyticsTotals[`${channel}:SENT`] ?? 0}</td>
                    <td className="py-2 pr-4 font-mono">{analyticsTotals[`${channel}:FAILED`] ?? 0}</td>
                    <td className="py-2 pr-4 font-mono">{analyticsTotals[`${channel}:QUEUED`] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(commsAnalytics?.topFailures?.length ?? 0) > 0 ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold">Top failures</h3>
              <div className="mt-2 space-y-2">
                {commsAnalytics?.topFailures?.map((row, idx) => (
                  <div key={`${row.source}-${row.channel}-${idx}`} className="rounded-md border border-border bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-muted">
                        {row.source} · {row.channel}
                      </div>
                      <div className="text-xs font-mono text-foreground">{row.count}</div>
                    </div>
                    <div className="mt-1 text-sm text-foreground">{row.error}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Drip campaigns</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Campaign name"
              value={dripName}
              onChange={(event) => setDripName(event.target.value)}
            />
            <Input
              placeholder="Description (optional)"
              value={dripDescription}
              onChange={(event) => setDripDescription(event.target.value)}
            />
            <Button
              onClick={() =>
                createDrip({
                  churchId,
                  name: dripName,
                  description: dripDescription || undefined,
                })
              }
              disabled={!canWrite || !churchId || !dripName || isCreatingDrip}
            >
              {isCreatingDrip ? 'Creating…' : 'Create drip'}
            </Button>
          </div>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {drips?.map((drip) => (
              <button
                key={drip.id}
                type="button"
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                  drip.id === selectedDripId ? 'border-primary text-primary' : 'border-border text-muted'
                }`}
                onClick={() => setSelectedDripId(drip.id)}
              >
                <span>{drip.name}</span>
                <span>{drip.status}</span>
              </button>
            ))}
            {!drips?.length && <p>No drip campaigns yet.</p>}
          </div>
          {selectedDripId && (
            <div className="mt-6 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Step order"
                  type="number"
                  value={dripStepOrder}
                  onChange={(event) => setDripStepOrder(event.target.value)}
                />
                <Input
                  placeholder="Delay hours"
                  type="number"
                  value={dripDelayHours}
                  onChange={(event) => setDripDelayHours(event.target.value)}
                />
                <select
                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  value={dripChannel}
                  onChange={(event) => setDripChannel(event.target.value)}
                >
                  {channelOptions.map((channel) => (
                    <option key={channel} value={channel}>
                      {channel}
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  value={dripTemplateId}
                  onChange={(event) => setDripTemplateId(event.target.value)}
                >
                  <option value="">No template</option>
                  {dripTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                {dripChannel === 'EMAIL' && (
                  <Input
                    placeholder="Email subject"
                    value={dripSubject}
                    onChange={(event) => setDripSubject(event.target.value)}
                  />
                )}
                <textarea
                  className="min-h-[120px] w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                  placeholder="Step body (HTML for email)"
                  value={dripBody}
                  onChange={(event) => setDripBody(event.target.value)}
                />
                <Button
                  onClick={() =>
                    addDripStep({
                      campaignId: selectedDripId,
                      stepOrder: Number(dripStepOrder),
                      delayHours: Number(dripDelayHours),
                      channel: dripChannel as any,
                      templateId: dripTemplateId || undefined,
                      subject: dripChannel === 'EMAIL' ? dripSubject : undefined,
                      body: dripBody || undefined,
                    })
                  }
                  disabled={!canWrite || !dripStepOrder || isAddingDripStep}
                >
                  {isAddingDripStep ? 'Adding…' : 'Add drip step'}
                </Button>
              </div>
              <div className="space-y-2 text-sm text-muted">
                {dripSteps?.map((step) => (
                  <div key={step.id} className="flex items-center justify-between">
                    <span>
                      Step {step.stepOrder} · {step.channel} · +{step.delayHours}h
                    </span>
                    <span>{step.templateId ? 'Template' : 'Custom'}</span>
                  </div>
                ))}
                {!dripSteps?.length && <p>No steps yet.</p>}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  value={dripAudience}
                  onChange={(event) => setDripAudience(event.target.value)}
                >
                  <option value="">No audience</option>
                  <option value="ALL_MEMBERS">All members</option>
                  <option value="ACTIVE_MEMBERS">Active members</option>
                  <option value="DONORS_90_DAYS">Donors (last 90 days)</option>
                </select>
                <Input
                  placeholder="Recipients (comma separated)"
                  value={dripTo}
                  onChange={(event) => setDripTo(event.target.value)}
                />
                <Button
                  onClick={() =>
                    enrollDrip({
                      campaignId: selectedDripId,
                      churchId,
                      audience: dripAudience ? (dripAudience as any) : undefined,
                      to: dripTo
                        .split(',')
                        .map((value) => value.trim())
                        .filter(Boolean),
                    })
                  }
                  disabled={!canWrite || !selectedDripId || (!dripAudience && !dripTo) || isEnrollingDrip}
                >
                  {isEnrollingDrip ? 'Enrolling…' : 'Enroll recipients'}
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Recent messages</h2>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted">
            {summary?.map((item) => (
              <span key={`${item.channel}-${item.status}`}>
                {item.channel} {item.status}: {item._count}
              </span>
            ))}
            {!summary?.length && <span>No delivery stats yet.</span>}
          </div>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {messages?.map((message) => (
              <div key={message.id} className="flex items-center justify-between">
                <span>
                  {message.channel} · {message.to}
                </span>
                <span>{message.status}</span>
              </div>
            ))}
            {!messages?.length && <p>No messages yet.</p>}
          </div>
        </Card>
      </PageSectionLayout>
      )}
    </Shell>
  );
}
