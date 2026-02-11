'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { trpc } from '../../lib/trpc';

const channelOptions = ['EMAIL', 'SMS', 'WHATSAPP'] as const;

export default function CommunicationsPage() {
  const utils = trpc.useUtils();
  const [churchId, setChurchId] = useState('');
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

  useEffect(() => {
    if (!churchId && churches?.length) {
      setChurchId(churches[0].id);
    }
  }, [churchId, churches]);

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
    onSuccess: async () => {
      setScheduleTo('');
      setScheduleSubject('');
      setScheduleBody('');
      setScheduleTemplateId('');
      setScheduleAudience('');
      await utils.communications.schedules.invalidate();
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

  return (
    <Shell>
      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Communications</h2>
          <p className="mt-1 text-sm text-muted">Create templates and send emails/SMS/WhatsApp to your community.</p>
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
              disabled={!churchId || !templateName || !templateBody || isCreatingTemplate}
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
                  to: sendTo
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean),
                })
              }
              disabled={!churchId || (!sendTo && !audience) || isSendingMessage}
            >
              {isSendingMessage ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Schedule message</h2>
          <p className="mt-1 text-sm text-muted">Queue a message to be sent later (use dispatch in your cron).</p>
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
                  to: scheduleTo
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean),
                })
              }
              disabled={!churchId || (!scheduleTo && !scheduleAudience) || isScheduling}
            >
              {isScheduling ? 'Scheduling…' : 'Schedule'}
            </Button>
            <Button variant="outline" onClick={() => dispatchDue({ limit: 50 })} disabled={isDispatching}>
              {isDispatching ? 'Dispatching…' : 'Dispatch due now'}
            </Button>
          </div>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {schedules?.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <span>
                  {item.channel} · {item.to}
                </span>
                <span>{new Date(item.sendAt).toLocaleString()} · {item.status}</span>
              </div>
            ))}
            {!schedules?.length && <p>No scheduled messages yet.</p>}
          </div>
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
              disabled={!churchId || !dripName || isCreatingDrip}
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
                  disabled={!dripStepOrder || isAddingDripStep}
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
                  disabled={!selectedDripId || (!dripAudience && !dripTo) || isEnrollingDrip}
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
      </div>
    </Shell>
  );
}
