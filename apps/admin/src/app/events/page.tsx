'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Badge } from '@faithflow-ai/ui';
import QRCode from 'qrcode';
import { trpc } from '../../lib/trpc';
import { Shell } from '../../components/Shell';

export default function EventsPage() {
  const utils = trpc.useUtils();
  const { data: churches } = trpc.church.list.useQuery({});
  const [churchId, setChurchId] = useState<string>('');
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
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState('TEXT');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldOptions, setFieldOptions] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [checkInSearch, setCheckInSearch] = useState('');
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
  const [seriesFieldLabel, setSeriesFieldLabel] = useState('');
  const [seriesFieldType, setSeriesFieldType] = useState('TEXT');
  const [seriesFieldRequired, setSeriesFieldRequired] = useState(false);
  const [seriesFieldOptions, setSeriesFieldOptions] = useState('');
  const [checkInCode, setCheckInCode] = useState('');
  const [checkInUrl, setCheckInUrl] = useState('');
  const [checkInQr, setCheckInQr] = useState('');
  const [checkInEnabled, setCheckInEnabled] = useState(false);
  const [ticketName, setTicketName] = useState('');
  const [ticketPrice, setTicketPrice] = useState('');
  const [ticketCurrency, setTicketCurrency] = useState('USD');
  const [ticketCapacity, setTicketCapacity] = useState('');
  const [assignmentRole, setAssignmentRole] = useState('SPEAKER');
  const [assignmentMemberId, setAssignmentMemberId] = useState('');
  const [assignmentName, setAssignmentName] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [mediaType, setMediaType] = useState('PHOTO');
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaDescription, setMediaDescription] = useState('');
  const [mediaIsPublic, setMediaIsPublic] = useState(true);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [badgeCodeInput, setBadgeCodeInput] = useState('');
  const [badgeStats, setBadgeStats] = useState<{ created?: number }>({});
  const [playbookChannels, setPlaybookChannels] = useState<string[]>(['EMAIL', 'SMS']);
  const [playbookStats, setPlaybookStats] = useState<{ scheduled?: number }>({});

  useEffect(() => {
    if (!churchId && churches?.length) {
      setChurchId(churches[0].id);
    }
  }, [churchId, churches]);

  const { data: events } = trpc.event.list.useQuery({
    churchId: churchId || undefined,
  });
  const { data: members } = trpc.member.list.useQuery(
    { churchId: churchId || undefined, query: assignmentSearch || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: series } = trpc.event.listSeries.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: checkInInfo } = trpc.event.checkInInfo.useQuery(
    { eventId: selectedEventId },
    { enabled: Boolean(selectedEventId) }
  );
  const { data: roster } = trpc.attendance.eventRoster.useQuery(
    { eventId: selectedEventId, query: checkInSearch || undefined, limit: 200 },
    { enabled: Boolean(selectedEventId) }
  );
  const { data: ticketTypes } = trpc.event.listTicketTypes.useQuery(
    { eventId: selectedEventId },
    { enabled: Boolean(selectedEventId) }
  );
  const { data: ticketOrders } = trpc.event.listTicketOrders.useQuery(
    { eventId: selectedEventId },
    { enabled: Boolean(selectedEventId) }
  );
  const { data: registrations } = trpc.event.listRegistrations.useQuery(
    { eventId: selectedEventId },
    { enabled: Boolean(selectedEventId) }
  );
  const { data: assignments } = trpc.event.listAssignments.useQuery(
    { eventId: selectedEventId },
    { enabled: Boolean(selectedEventId) }
  );
  const { data: eventMedia } = trpc.event.listMedia.useQuery(
    { eventId: selectedEventId },
    { enabled: Boolean(selectedEventId) }
  );
  const { data: badges } = trpc.event.listBadges.useQuery(
    { eventId: selectedEventId },
    { enabled: Boolean(selectedEventId) }
  );
  const { data: eventAnalytics } = trpc.event.analytics.useQuery(
    { eventId: selectedEventId },
    { enabled: Boolean(selectedEventId) }
  );

  useEffect(() => {
    if (!selectedEventId && events?.length) {
      setSelectedEventId(events[0].id);
    }
  }, [selectedEventId, events]);

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

  const { mutate: createEvent, isPending } = trpc.event.create.useMutation({
    onSuccess: async () => {
      setTitle('');
      setDescription('');
      setEventType('SERVICE');
      setEventFormat('IN_PERSON');
      setEventVisibility('PUBLIC');
      setStartAt('');
      setEndAt('');
      setLocation('');
      setMeetingUrl('');
      setCoverImageUrl('');
      setCapacity('');
      setRequiresRsvp(false);
      setRegistrationEnabled(false);
      setRegistrationLimit('');
      setWaitlistEnabled(true);
      setAllowGuestRegistration(true);
      setRegistrationFields([]);
      setFieldLabel('');
      setFieldType('TEXT');
      setFieldRequired(false);
      setFieldOptions('');
      await utils.event.list.invalidate();
    },
  });

  const { mutate: deleteEvent } = trpc.event.delete.useMutation({
    onSuccess: async () => {
      await utils.event.list.invalidate();
    },
  });

  const { mutate: createSeries, isPending: isCreatingSeries } = trpc.event.createSeries.useMutation({
    onSuccess: async () => {
      setSeriesTitle('');
      setSeriesDescription('');
      setSeriesType('SERVICE');
      setSeriesFormat('IN_PERSON');
      setSeriesVisibility('PUBLIC');
      setSeriesStartDate('');
      setSeriesEndDate('');
      setSeriesLocation('');
      setSeriesMeetingUrl('');
      setSeriesCoverImageUrl('');
      setSeriesCapacity('');
      setSeriesOccurrences('12');
      setSeriesRequiresRsvp(false);
      setSeriesRegistrationEnabled(false);
      setSeriesRegistrationLimit('');
      setSeriesWaitlistEnabled(true);
      setSeriesAllowGuestRegistration(true);
      setSeriesRegistrationFields([]);
      setSeriesFieldLabel('');
      setSeriesFieldType('TEXT');
      setSeriesFieldRequired(false);
      setSeriesFieldOptions('');
      await utils.event.list.invalidate();
      await utils.event.listSeries.invalidate();
    },
  });

  const { mutate: createTicketType } = trpc.event.createTicketType.useMutation({
    onSuccess: async () => {
      setTicketName('');
      setTicketPrice('');
      setTicketCapacity('');
      await utils.event.listTicketTypes.invalidate();
      await utils.event.list.invalidate();
    },
  });

  const { mutate: addAssignment } = trpc.event.addAssignment.useMutation({
    onSuccess: async () => {
      setAssignmentMemberId('');
      setAssignmentName('');
      setAssignmentNotes('');
      await utils.event.listAssignments.invalidate();
    },
  });

  const { mutate: removeAssignment } = trpc.event.removeAssignment.useMutation({
    onSuccess: async () => {
      await utils.event.listAssignments.invalidate();
    },
  });

  const { mutate: addMedia } = trpc.event.addMedia.useMutation({
    onSuccess: async () => {
      setMediaTitle('');
      setMediaDescription('');
      await utils.event.listMedia.invalidate();
    },
  });

  const { mutate: removeMedia } = trpc.event.removeMedia.useMutation({
    onSuccess: async () => {
      await utils.event.listMedia.invalidate();
    },
  });

  const { mutate: generateBadges } = trpc.event.generateBadges.useMutation({
    onSuccess: async (data) => {
      setBadgeStats({ created: data.created });
      await utils.event.listBadges.invalidate();
    },
  });

  const { mutate: revokeBadge } = trpc.event.revokeBadge.useMutation({
    onSuccess: async () => {
      await utils.event.listBadges.invalidate();
    },
  });
  const { mutate: createCommsPlaybook, isPending: isCreatingPlaybook } = trpc.event.createCommsPlaybook.useMutation({
    onSuccess: (result) => {
      setPlaybookStats({ scheduled: result.scheduled });
    },
  });

  const { mutate: checkInBadge } = trpc.attendance.checkInBadge.useMutation({
    onSuccess: async () => {
      setBadgeCodeInput('');
      await utils.event.listBadges.invalidate();
      await utils.attendance.eventRoster.invalidate();
    },
  });

  const { mutateAsync: createUpload } = trpc.storage.createUpload.useMutation();

  const { mutate: enableCheckIn } = trpc.event.enableCheckIn.useMutation({
    onSuccess: async (data) => {
      await utils.event.checkInInfo.invalidate();
      setCheckInCode(data.code ?? '');
      setCheckInEnabled(Boolean(data.enabled));
    },
  });

  const { mutate: disableCheckIn } = trpc.event.disableCheckIn.useMutation({
    onSuccess: async (data) => {
      await utils.event.checkInInfo.invalidate();
      setCheckInCode(data.code ?? '');
      setCheckInEnabled(Boolean(data.enabled));
    },
  });

  const { mutate: checkInMember } = trpc.attendance.checkIn.useMutation({
    onSuccess: async () => {
      await utils.attendance.eventRoster.invalidate();
    },
  });

  const { mutate: checkOutMember } = trpc.attendance.checkOut.useMutation({
    onSuccess: async () => {
      await utils.attendance.eventRoster.invalidate();
    },
  });

  const { mutate: bulkCheckIn } = trpc.attendance.bulkCheckIn.useMutation({
    onSuccess: async () => {
      await utils.attendance.eventRoster.invalidate();
    },
  });

  const selectedChurch = useMemo(
    () => churches?.find((church) => church.id === churchId),
    [churches, churchId]
  );

  const addRegistrationField = () => {
    if (!fieldLabel) return;
    const options = fieldOptions
      ? fieldOptions.split(',').map((entry) => entry.trim()).filter(Boolean)
      : undefined;
    setRegistrationFields((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: fieldLabel,
        type: fieldType,
        required: fieldRequired,
        options,
      },
    ]);
    setFieldLabel('');
    setFieldType('TEXT');
    setFieldRequired(false);
    setFieldOptions('');
  };

  const removeRegistrationField = (id: string) => {
    setRegistrationFields((prev) => prev.filter((field) => field.id !== id));
  };

  const addSeriesField = () => {
    if (!seriesFieldLabel) return;
    const options = seriesFieldOptions
      ? seriesFieldOptions.split(',').map((entry) => entry.trim()).filter(Boolean)
      : undefined;
    setSeriesRegistrationFields((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: seriesFieldLabel,
        type: seriesFieldType,
        required: seriesFieldRequired,
        options,
      },
    ]);
    setSeriesFieldLabel('');
    setSeriesFieldType('TEXT');
    setSeriesFieldRequired(false);
    setSeriesFieldOptions('');
  };

  const removeSeriesField = (id: string) => {
    setSeriesRegistrationFields((prev) => prev.filter((field) => field.id !== id));
  };

  const handleMediaUpload = async (file?: File | null) => {
    if (!file || !selectedEventId || uploadingMedia) return;
    setUploadingMedia(true);
    try {
      const upload = await createUpload({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        purpose: 'event-media',
        churchId: churchId || undefined,
      });

      await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });

      addMedia({
        eventId: selectedEventId,
        assetId: upload.assetId,
        type: mediaType as any,
        title: mediaTitle || undefined,
        description: mediaDescription || undefined,
        isPublic: mediaIsPublic,
      });
    } catch (error) {
      console.error('Failed to upload event media', error);
    } finally {
      setUploadingMedia(false);
    }
  };

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Events</h1>
          <p className="mt-2 text-muted">
            Plan services, gatherings, and classes with attendance tracking.
          </p>
        </div>

        <Card className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            {churches?.map((church) => (
              <button
                key={church.id}
                className={`rounded-md border px-3 py-2 text-sm ${
                  churchId === church.id
                    ? 'border-primary text-primary'
                    : 'border-border text-muted'
                }`}
                onClick={() => setChurchId(church.id)}
                type="button"
              >
                {church.name}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Event analytics</h2>
              <p className="mt-1 text-sm text-muted">Registrations, RSVPs, attendance, and ticket revenue.</p>
            </div>
            <Badge variant="default">{selectedEventId ? 'Selected' : 'Select event'}</Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-md border border-border p-3 text-sm text-muted">
              <p className="text-xs uppercase text-muted">Registrations</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {eventAnalytics?.registrations?.reduce((sum, entry) => sum + (entry._count?._all ?? 0), 0) ?? 0}
              </p>
            </div>
            <div className="rounded-md border border-border p-3 text-sm text-muted">
              <p className="text-xs uppercase text-muted">RSVPs</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {eventAnalytics?.rsvps?.reduce((sum, entry) => sum + (entry._count?._all ?? 0), 0) ?? 0}
              </p>
            </div>
            <div className="rounded-md border border-border p-3 text-sm text-muted">
              <p className="text-xs uppercase text-muted">Attendance</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {eventAnalytics?.attendanceCount ?? 0}
              </p>
            </div>
            <div className="rounded-md border border-border p-3 text-sm text-muted">
              <p className="text-xs uppercase text-muted">Ticket revenue</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {eventAnalytics?.ticketSales?.totalAmount?.toString?.() ?? '0'}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
            {(eventAnalytics?.registrations ?? []).map((entry) => (
              <Badge key={entry.status} variant="default">
                {entry.status}: {entry._count?._all ?? 0}
              </Badge>
            ))}
            {(eventAnalytics?.rsvps ?? []).map((entry) => (
              <Badge key={entry.status} variant="default">
                {entry.status}: {entry._count?._all ?? 0}
              </Badge>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Event registrations</h2>
          <p className="mt-1 text-sm text-muted">Track guest and member registrations.</p>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {registrations?.map((registration) => (
              <div key={registration.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">
                      {registration.member
                        ? `${registration.member.firstName} ${registration.member.lastName}`
                        : registration.guestName || registration.guestEmail}
                    </p>
                    <p className="text-xs text-muted">
                      {registration.member?.email ?? registration.guestEmail ?? '—'}
                    </p>
                  </div>
                  <Badge variant="default">{registration.status}</Badge>
                </div>
                {registration.responses ? (
                  <pre className="mt-2 rounded-md bg-muted/10 p-2 text-xs whitespace-pre-wrap">
                    {JSON.stringify(registration.responses, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
            {!registrations?.length && <p className="text-sm text-muted">No registrations yet.</p>}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Event assignments</h2>
          <p className="mt-1 text-sm text-muted">Assign speakers, hosts, and volunteers.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={assignmentRole}
              onChange={(e) => setAssignmentRole(e.target.value)}
            >
              <option value="SPEAKER">Speaker</option>
              <option value="HOST">Host</option>
              <option value="WORSHIP_LEADER">Worship leader</option>
              <option value="VOLUNTEER">Volunteer</option>
              <option value="TECH">Tech</option>
              <option value="OTHER">Other</option>
            </select>
            <Input
              placeholder="Search members"
              value={assignmentSearch}
              onChange={(e) => setAssignmentSearch(e.target.value)}
            />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={assignmentMemberId}
              onChange={(e) => setAssignmentMemberId(e.target.value)}
            >
              <option value="">Select member</option>
              {members?.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </option>
              ))}
            </select>
            <Input
              placeholder="External name (if no member)"
              value={assignmentName}
              onChange={(e) => setAssignmentName(e.target.value)}
            />
            <Input
              placeholder="Notes (optional)"
              value={assignmentNotes}
              onChange={(e) => setAssignmentNotes(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <Button
              onClick={() => {
                if (!selectedEventId) return;
                addAssignment({
                  eventId: selectedEventId,
                  role: assignmentRole as any,
                  memberId: assignmentMemberId || undefined,
                  displayName: assignmentMemberId ? undefined : assignmentName || undefined,
                  notes: assignmentNotes || undefined,
                });
              }}
              disabled={!selectedEventId || (!assignmentMemberId && !assignmentName)}
            >
              Add assignment
            </Button>
          </div>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {assignments?.map((assignment) => (
              <div key={assignment.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">
                      {assignment.member
                        ? `${assignment.member.firstName} ${assignment.member.lastName}`
                        : assignment.displayName}
                    </p>
                    <p className="text-xs text-muted">{assignment.role}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => removeAssignment({ id: assignment.id })}>
                    Remove
                  </Button>
                </div>
                {assignment.notes ? <p className="mt-2 text-xs text-muted">{assignment.notes}</p> : null}
              </div>
            ))}
            {!assignments?.length && <p className="text-sm text-muted">No assignments yet.</p>}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Event media</h2>
          <p className="mt-1 text-sm text-muted">Upload photos, videos, or documents for this event.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value)}
            >
              <option value="PHOTO">Photo</option>
              <option value="VIDEO">Video</option>
              <option value="SERMON">Sermon</option>
              <option value="DOCUMENT">Document</option>
              <option value="OTHER">Other</option>
            </select>
            <Input
              placeholder="Title (optional)"
              value={mediaTitle}
              onChange={(e) => setMediaTitle(e.target.value)}
            />
            <Input
              placeholder="Description (optional)"
              value={mediaDescription}
              onChange={(e) => setMediaDescription(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={mediaIsPublic}
                onChange={(e) => setMediaIsPublic(e.target.checked)}
              />
              Visible on public page
            </label>
            <Input type="file" disabled={uploadingMedia} onChange={(e) => handleMediaUpload(e.target.files?.[0])} />
          </div>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {eventMedia?.map((media) => (
              <div key={media.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{media.title ?? media.asset.filename ?? media.type}</p>
                    <p className="text-xs text-muted">{media.type} · {media.isPublic ? 'Public' : 'Private'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a className="text-primary underline text-xs" href={media.asset.url} target="_blank" rel="noreferrer">
                      View
                    </a>
                    <Button size="sm" variant="outline" onClick={() => removeMedia({ id: media.id })}>
                      Remove
                    </Button>
                  </div>
                </div>
                {media.description ? <p className="mt-2 text-xs text-muted">{media.description}</p> : null}
              </div>
            ))}
            {!eventMedia?.length && <p className="text-sm text-muted">No media uploaded yet.</p>}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Create event</h2>
          <p className="mt-1 text-sm text-muted">
            {selectedChurch ? `Creating events for ${selectedChurch.name}.` : 'Select a church first.'}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
            <textarea
              className="min-h-[80px] w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            <Input
              type="number"
              placeholder="Capacity"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            >
              <option value="SERVICE">Service</option>
              <option value="BIBLE_STUDY">Bible Study</option>
              <option value="FUNDRAISER">Fundraiser</option>
              <option value="CEREMONY">Ceremony</option>
              <option value="MEETING">Meeting</option>
              <option value="CONFERENCE">Conference</option>
              <option value="OTHER">Other</option>
            </select>
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={eventFormat}
              onChange={(e) => setEventFormat(e.target.value)}
            >
              <option value="IN_PERSON">In-person</option>
              <option value="ONLINE">Online</option>
              <option value="HYBRID">Hybrid</option>
            </select>
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={eventVisibility}
              onChange={(e) => setEventVisibility(e.target.value)}
            >
              <option value="PUBLIC">Public</option>
              <option value="MEMBERS_ONLY">Members only</option>
              <option value="LEADERS_ONLY">Leaders only</option>
            </select>
            <Input
              placeholder="Meeting or livestream URL"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
            />
            <Input
              placeholder="Cover image URL"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={requiresRsvp} onChange={(e) => setRequiresRsvp(e.target.checked)} />
              Require RSVP
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={registrationEnabled}
                onChange={(e) => setRegistrationEnabled(e.target.checked)}
              />
              Enable registration
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={waitlistEnabled}
                onChange={(e) => setWaitlistEnabled(e.target.checked)}
              />
              Waitlist enabled
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowGuestRegistration}
                onChange={(e) => setAllowGuestRegistration(e.target.checked)}
              />
              Allow guest registration
            </label>
          </div>
          {registrationEnabled ? (
            <div className="mt-4 space-y-3">
              <Input
                type="number"
                placeholder="Registration limit (optional)"
                value={registrationLimit}
                onChange={(e) => setRegistrationLimit(e.target.value)}
              />
              <div className="grid gap-2 sm:grid-cols-4">
                <Input
                  placeholder="Field label"
                  value={fieldLabel}
                  onChange={(e) => setFieldLabel(e.target.value)}
                />
                <select
                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value)}
                >
                  <option value="TEXT">Text</option>
                  <option value="EMAIL">Email</option>
                  <option value="PHONE">Phone</option>
                  <option value="NUMBER">Number</option>
                  <option value="DATE">Date</option>
                  <option value="SELECT">Select</option>
                  <option value="MULTI_SELECT">Multi-select</option>
                  <option value="CHECKBOX">Checkbox</option>
                </select>
                <Input
                  placeholder="Options (comma)"
                  value={fieldOptions}
                  onChange={(e) => setFieldOptions(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={fieldRequired}
                      onChange={(e) => setFieldRequired(e.target.checked)}
                    />
                    Required
                  </label>
                  <Button variant="outline" size="sm" onClick={addRegistrationField} disabled={!fieldLabel}>
                    Add
                  </Button>
                </div>
              </div>
              {registrationFields.length ? (
                <div className="space-y-2 text-xs text-muted">
                  {registrationFields.map((field) => (
                    <div key={field.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                      <span>
                        {field.label} · {field.type} {field.required ? '(required)' : ''}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => removeRegistrationField(field.id)}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="mt-4">
            <Button
              onClick={() =>
                createEvent({
                  churchId,
                  title,
                  description: description || undefined,
                  type: eventType as any,
                  format: eventFormat as any,
                  visibility: eventVisibility as any,
                  startAt: new Date(startAt).toISOString(),
                  endAt: new Date(endAt).toISOString(),
                  location: location || undefined,
                  meetingUrl: meetingUrl || undefined,
                  coverImageUrl: coverImageUrl || undefined,
                  capacity: capacity ? Number(capacity) : undefined,
                  requiresRsvp,
                  registrationEnabled,
                  registrationLimit: registrationLimit ? Number(registrationLimit) : undefined,
                  waitlistEnabled,
                  registrationFields: registrationFields.length ? registrationFields : undefined,
                  allowGuestRegistration,
                })
              }
              disabled={!churchId || !title || !startAt || !endAt || isPending}
            >
              {isPending ? 'Saving…' : 'Save event'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Recurring events</h2>
          <p className="mt-1 text-sm text-muted">Schedule recurring services or classes.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input placeholder="Series title" value={seriesTitle} onChange={(e) => setSeriesTitle(e.target.value)} />
            <Input
              placeholder="Description"
              value={seriesDescription}
              onChange={(e) => setSeriesDescription(e.target.value)}
            />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={seriesType}
              onChange={(e) => setSeriesType(e.target.value)}
            >
              <option value="SERVICE">Service</option>
              <option value="BIBLE_STUDY">Bible Study</option>
              <option value="FUNDRAISER">Fundraiser</option>
              <option value="CEREMONY">Ceremony</option>
              <option value="MEETING">Meeting</option>
              <option value="CONFERENCE">Conference</option>
              <option value="OTHER">Other</option>
            </select>
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={seriesFormat}
              onChange={(e) => setSeriesFormat(e.target.value)}
            >
              <option value="IN_PERSON">In-person</option>
              <option value="ONLINE">Online</option>
              <option value="HYBRID">Hybrid</option>
            </select>
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={seriesVisibility}
              onChange={(e) => setSeriesVisibility(e.target.value)}
            >
              <option value="PUBLIC">Public</option>
              <option value="MEMBERS_ONLY">Members only</option>
              <option value="LEADERS_ONLY">Leaders only</option>
            </select>
            <Input type="date" value={seriesStartDate} onChange={(e) => setSeriesStartDate(e.target.value)} />
            <Input type="date" value={seriesEndDate} onChange={(e) => setSeriesEndDate(e.target.value)} />
            <Input type="time" value={seriesStartTime} onChange={(e) => setSeriesStartTime(e.target.value)} />
            <Input type="time" value={seriesEndTime} onChange={(e) => setSeriesEndTime(e.target.value)} />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={seriesFrequency}
              onChange={(e) => setSeriesFrequency(e.target.value)}
            >
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
            <Input
              placeholder="Occurrences"
              value={seriesOccurrences}
              onChange={(e) => setSeriesOccurrences(e.target.value)}
            />
            <Input
              placeholder="Location"
              value={seriesLocation}
              onChange={(e) => setSeriesLocation(e.target.value)}
            />
            <Input
              placeholder="Meeting or livestream URL"
              value={seriesMeetingUrl}
              onChange={(e) => setSeriesMeetingUrl(e.target.value)}
            />
            <Input
              placeholder="Cover image URL"
              value={seriesCoverImageUrl}
              onChange={(e) => setSeriesCoverImageUrl(e.target.value)}
            />
            <Input
              placeholder="Capacity"
              value={seriesCapacity}
              onChange={(e) => setSeriesCapacity(e.target.value)}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted">
            {['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map((day) => (
              <label key={day} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={seriesWeekdays.includes(day)}
                  onChange={(e) => {
                    setSeriesWeekdays((prev) =>
                      e.target.checked ? [...prev, day] : prev.filter((item) => item !== day)
                    );
                  }}
                />
                {day.slice(0, 3)}
              </label>
            ))}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={seriesRequiresRsvp}
                onChange={(e) => setSeriesRequiresRsvp(e.target.checked)}
              />
              Require RSVP
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={seriesRegistrationEnabled}
                onChange={(e) => setSeriesRegistrationEnabled(e.target.checked)}
              />
              Enable registration
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={seriesWaitlistEnabled}
                onChange={(e) => setSeriesWaitlistEnabled(e.target.checked)}
              />
              Waitlist enabled
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={seriesAllowGuestRegistration}
                onChange={(e) => setSeriesAllowGuestRegistration(e.target.checked)}
              />
              Allow guest registration
            </label>
          </div>
          {seriesRegistrationEnabled ? (
            <div className="mt-4 space-y-3">
              <Input
                type="number"
                placeholder="Registration limit (optional)"
                value={seriesRegistrationLimit}
                onChange={(e) => setSeriesRegistrationLimit(e.target.value)}
              />
              <div className="grid gap-2 sm:grid-cols-4">
                <Input
                  placeholder="Field label"
                  value={seriesFieldLabel}
                  onChange={(e) => setSeriesFieldLabel(e.target.value)}
                />
                <select
                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  value={seriesFieldType}
                  onChange={(e) => setSeriesFieldType(e.target.value)}
                >
                  <option value="TEXT">Text</option>
                  <option value="EMAIL">Email</option>
                  <option value="PHONE">Phone</option>
                  <option value="NUMBER">Number</option>
                  <option value="DATE">Date</option>
                  <option value="SELECT">Select</option>
                  <option value="MULTI_SELECT">Multi-select</option>
                  <option value="CHECKBOX">Checkbox</option>
                </select>
                <Input
                  placeholder="Options (comma)"
                  value={seriesFieldOptions}
                  onChange={(e) => setSeriesFieldOptions(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={seriesFieldRequired}
                      onChange={(e) => setSeriesFieldRequired(e.target.checked)}
                    />
                    Required
                  </label>
                  <Button variant="outline" size="sm" onClick={addSeriesField} disabled={!seriesFieldLabel}>
                    Add
                  </Button>
                </div>
              </div>
              {seriesRegistrationFields.length ? (
                <div className="space-y-2 text-xs text-muted">
                  {seriesRegistrationFields.map((field) => (
                    <div key={field.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                      <span>
                        {field.label} · {field.type} {field.required ? '(required)' : ''}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => removeSeriesField(field.id)}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (!churchId || !seriesTitle || !seriesStartDate) return;
                createSeries({
                  churchId,
                  title: seriesTitle,
                  description: seriesDescription || undefined,
                  type: seriesType as any,
                  format: seriesFormat as any,
                  visibility: seriesVisibility as any,
                  location: seriesLocation || undefined,
                  meetingUrl: seriesMeetingUrl || undefined,
                  coverImageUrl: seriesCoverImageUrl || undefined,
                  startDate: new Date(seriesStartDate),
                  endDate: seriesEndDate ? new Date(seriesEndDate) : undefined,
                  startTime: seriesStartTime,
                  endTime: seriesEndTime,
                  frequency: seriesFrequency as any,
                  weekdays: seriesWeekdays as any,
                  occurrences: Number(seriesOccurrences || '12'),
                  requiresRsvp: seriesRequiresRsvp,
                  registrationEnabled: seriesRegistrationEnabled,
                  registrationLimit: seriesRegistrationLimit ? Number(seriesRegistrationLimit) : undefined,
                  waitlistEnabled: seriesWaitlistEnabled,
                  registrationFields: seriesRegistrationFields.length ? seriesRegistrationFields : undefined,
                  allowGuestRegistration: seriesAllowGuestRegistration,
                  capacity: seriesCapacity ? Number(seriesCapacity) : undefined,
                });
              }}
              disabled={!churchId || !seriesTitle || !seriesStartDate || isCreatingSeries}
            >
              {isCreatingSeries ? 'Scheduling…' : 'Create series'}
            </Button>
          </div>
          <div className="mt-4 text-sm text-muted">
            <pre className="rounded-md bg-muted/10 p-3 text-xs">
              {JSON.stringify(series ?? [], null, 2)}
            </pre>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Event list</h2>
            <Badge variant="default">{events?.length ?? 0} total</Badge>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-muted">
                <tr className="text-left">
                  <th className="py-2">Title</th>
                  <th className="py-2">Start</th>
                  <th className="py-2">End</th>
                  <th className="py-2">Location</th>
                  <th className="py-2">RSVPs</th>
                  <th className="py-2">Registrations</th>
                  <th className="py-2">Visibility</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events?.map((event) => (
                  <tr key={event.id} className="border-t border-border">
                    <td className="py-2">{event.title}</td>
                    <td className="py-2">{new Date(event.startAt).toLocaleString()}</td>
                    <td className="py-2">{new Date(event.endAt).toLocaleString()}</td>
                    <td className="py-2">{event.location ?? '—'}</td>
                    <td className="py-2">
                      {event.requiresRsvp ? event._count?.rsvps ?? 0 : '—'}
                    </td>
                    <td className="py-2">{event.registrationEnabled ? event._count?.registrations ?? 0 : '—'}</td>
                    <td className="py-2">{event.visibility ?? 'PUBLIC'}</td>
                    <td className="py-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm('Delete this event?')) {
                            deleteEvent({ id: event.id });
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Event tickets</h2>
          <p className="mt-1 text-sm text-muted">Create ticket types and review orders.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
            >
              <option value="">Select event</option>
              {events?.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
            <Input placeholder="Ticket name" value={ticketName} onChange={(e) => setTicketName(e.target.value)} />
            <Input
              placeholder="Price"
              value={ticketPrice}
              onChange={(e) => setTicketPrice(e.target.value)}
            />
            <Input
              placeholder="Currency"
              value={ticketCurrency}
              onChange={(e) => setTicketCurrency(e.target.value.toUpperCase())}
            />
            <Input
              placeholder="Capacity (optional)"
              value={ticketCapacity}
              onChange={(e) => setTicketCapacity(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <Button
              onClick={() => {
                if (!selectedEventId || !ticketName || !ticketPrice) return;
                createTicketType({
                  eventId: selectedEventId,
                  name: ticketName,
                  price: Number(ticketPrice),
                  currency: ticketCurrency,
                  capacity: ticketCapacity ? Number(ticketCapacity) : undefined,
                });
              }}
              disabled={!selectedEventId || !ticketName || !ticketPrice}
            >
              Create ticket type
            </Button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3 text-sm text-muted">
              <p className="text-xs uppercase text-muted">Ticket types</p>
              <div className="mt-2 space-y-2">
                {ticketTypes?.map((type) => (
                  <div key={type.id} className="rounded-md border border-border p-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">{type.name}</p>
                      <Badge variant="default">{type.currency} {type.price.toString()}</Badge>
                    </div>
                    {type.capacity ? <p className="text-xs text-muted">Capacity: {type.capacity}</p> : null}
                  </div>
                ))}
                {!ticketTypes?.length && <p className="text-sm text-muted">No ticket types yet.</p>}
              </div>
            </div>
            <div className="rounded-md border border-border p-3 text-sm text-muted">
              <p className="text-xs uppercase text-muted">Recent orders</p>
              <div className="mt-2 space-y-2">
                {ticketOrders?.map((order) => (
                  <div key={order.id} className="rounded-md border border-border p-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">
                        {order.member ? `${order.member.firstName} ${order.member.lastName}` : 'Guest'}
                      </p>
                      <Badge variant="default">{order.status}</Badge>
                    </div>
                    <p className="text-xs text-muted">
                      {order.ticketType?.name ?? 'Ticket'} · {order.quantity} · {order.currency} {order.amount.toString()}
                    </p>
                  </div>
                ))}
                {!ticketOrders?.length && <p className="text-sm text-muted">No ticket orders yet.</p>}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Event badges</h2>
          <p className="mt-1 text-sm text-muted">Generate printable credentials for registrations and tickets.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              onClick={() => selectedEventId && generateBadges({ eventId: selectedEventId })}
              disabled={!selectedEventId}
            >
              Generate badges
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!selectedEventId) return;
                const url = `/events/badges?eventId=${selectedEventId}`;
                window.open(url, '_blank');
              }}
              disabled={!selectedEventId}
            >
              Print badges
            </Button>
            {badgeStats.created ? (
              <Badge variant="default">{badgeStats.created} created</Badge>
            ) : null}
            <Badge variant="default">{badges?.length ?? 0} total</Badge>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Input
              placeholder="Scan or enter badge code"
              value={badgeCodeInput}
              onChange={(e) => setBadgeCodeInput(e.target.value)}
            />
            <Button
              onClick={() => badgeCodeInput && checkInBadge({ badgeCode: badgeCodeInput.trim() })}
              disabled={!badgeCodeInput.trim()}
            >
              Check in badge
            </Button>
          </div>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {badges?.slice(0, 8).map((badge) => (
              <div key={badge.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">
                      {badge.member
                        ? `${badge.member.firstName} ${badge.member.lastName}`
                        : badge.registration?.guestName || 'Guest'}
                    </p>
                    <p className="text-xs text-muted">Code: {badge.badgeCode}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{badge.status}</Badge>
                    <Button size="sm" variant="outline" onClick={() => revokeBadge({ id: badge.id })}>
                      Revoke
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {!badges?.length && <p className="text-sm text-muted">No badges yet.</p>}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Event communications</h2>
          <p className="mt-1 text-sm text-muted">
            Launch a default playbook (reminder, day-of update, follow-up) for registrations and RSVP going.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={playbookChannels.includes('EMAIL')}
                onChange={(e) => {
                  setPlaybookChannels((prev) =>
                    e.target.checked ? [...prev, 'EMAIL'] : prev.filter((channel) => channel !== 'EMAIL')
                  );
                }}
              />
              Email
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={playbookChannels.includes('SMS')}
                onChange={(e) => {
                  setPlaybookChannels((prev) =>
                    e.target.checked ? [...prev, 'SMS'] : prev.filter((channel) => channel !== 'SMS')
                  );
                }}
              />
              SMS
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              onClick={() =>
                selectedEventId &&
                createCommsPlaybook({
                  eventId: selectedEventId,
                  channels: playbookChannels as any,
                })
              }
              disabled={!selectedEventId || !playbookChannels.length || isCreatingPlaybook}
            >
              {isCreatingPlaybook ? 'Scheduling…' : 'Create playbook'}
            </Button>
            {playbookStats.scheduled ? (
              <Badge variant="default">{playbookStats.scheduled} scheduled</Badge>
            ) : null}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Event check-in</h2>
              <p className="mt-1 text-sm text-muted">Track attendance in real time.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default">{roster?.checkedInCount ?? 0} checked in</Badge>
              <Badge variant="default">{roster?.rsvpGoingCount ?? 0} RSVP going</Badge>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
            >
              <option value="">Select event</option>
              {events?.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
            <Input
              placeholder="Search attendees"
              value={checkInSearch}
              onChange={(e) => setCheckInSearch(e.target.value)}
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3 text-sm text-muted">
              <p className="text-xs uppercase text-muted">Kiosk access</p>
              <p className="mt-2 text-sm text-foreground">
                Status: {checkInEnabled ? 'Enabled' : 'Disabled'}
              </p>
              <p className="mt-1 text-xs text-muted">Code: {checkInCode || '—'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => selectedEventId && enableCheckIn({ eventId: selectedEventId })}
                  disabled={!selectedEventId}
                >
                  Enable kiosk
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectedEventId && enableCheckIn({ eventId: selectedEventId })}
                  disabled={!selectedEventId}
                >
                  Rotate code
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectedEventId && disableCheckIn({ eventId: selectedEventId })}
                  disabled={!selectedEventId}
                >
                  Disable
                </Button>
              </div>
              {checkInUrl ? (
                <p className="mt-3 text-xs text-muted">
                  Kiosk URL: <a className="text-primary underline" href={checkInUrl}>{checkInUrl}</a>
                </p>
              ) : null}
            </div>
            <div className="flex items-center justify-center rounded-md border border-border p-3">
              {checkInQr ? (
                <img src={checkInQr} alt="Check-in QR" className="h-40 w-40 rounded-md border border-border" />
              ) : (
                <p className="text-xs text-muted">QR pending</p>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!selectedEventId || !roster?.roster?.length) return;
                const ids = roster.roster
                  .filter((entry) => entry.status !== 'CHECKED_IN')
                  .map((entry) => entry.member.id);
                if (ids.length) {
                  bulkCheckIn({ eventId: selectedEventId, memberIds: ids });
                }
              }}
              disabled={!selectedEventId || !roster?.roster?.length}
            >
              Check in all filtered
            </Button>
          </div>
          <div className="mt-4 overflow-x-auto text-sm text-muted">
            <table className="min-w-full">
              <thead className="text-left text-xs uppercase text-muted">
                <tr>
                  <th className="py-2">Member</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Phone</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Check-in</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roster?.roster?.map((entry) => (
                  <tr key={entry.member.id} className="border-t border-border">
                    <td className="py-2">{entry.member.firstName} {entry.member.lastName}</td>
                    <td className="py-2">{entry.member.email ?? '—'}</td>
                    <td className="py-2">{entry.member.phone ?? '—'}</td>
                    <td className="py-2">
                      <Badge variant={entry.status === 'CHECKED_IN' ? 'success' : 'default'}>
                        {entry.status}
                      </Badge>
                    </td>
                    <td className="py-2">
                      {entry.checkInAt ? new Date(entry.checkInAt).toLocaleString() : '—'}
                    </td>
                    <td className="py-2">
                      {entry.status === 'CHECKED_IN' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => checkOutMember({ eventId: selectedEventId, memberId: entry.member.id })}
                        >
                          Check out
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => checkInMember({ eventId: selectedEventId, memberId: entry.member.id })}
                        >
                          Check in
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!roster?.roster?.length && (
              <p className="mt-3 text-sm text-muted">No attendees found for this event.</p>
            )}
          </div>
        </Card>
      </div>
    </Shell>
  );
}
