'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SignedIn, SignedOut, SignInButton, useUser } from '@clerk/nextjs';
import { Button, Card, Input, Badge } from '@faithflow-ai/ui';
import { trpc } from '../../lib/trpc';

type SurveyAnswerState = Record<string, Record<string, any>>;
type MessageAttachment = { url: string; name?: string; type?: string; assetId?: string };

export default function MemberPortalPage() {
  const utils = trpc.useUtils();
  const { user } = useUser();
  const [answers, setAnswers] = useState<SurveyAnswerState>({});
  const [directoryVisibility, setDirectoryVisibility] = useState('MEMBERS_ONLY');
  const [showEmail, setShowEmail] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [showPhoto, setShowPhoto] = useState(true);
  const [preferredName, setPreferredName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
  const [availabilityRoleId, setAvailabilityRoleId] = useState('');
  const [availabilityDay, setAvailabilityDay] = useState('SUNDAY');
  const [availabilityStart, setAvailabilityStart] = useState('09:00');
  const [availabilityEnd, setAvailabilityEnd] = useState('12:00');
  const [availabilityNotes, setAvailabilityNotes] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [newConversationMemberId, setNewConversationMemberId] = useState('');
  const [ticketProvider, setTicketProvider] = useState('STRIPE');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [registrationResponses, setRegistrationResponses] = useState<Record<string, Record<string, any>>>({});
  const [requestChurchId, setRequestChurchId] = useState('');
  const [requestName, setRequestName] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastConversationRef = useRef<string | null>(null);

  const { data: selfProfile, error: selfError, isLoading: isProfileLoading } = trpc.member.selfProfile.useQuery(
    undefined,
    { retry: false }
  );
  const churchId = selfProfile?.member?.churchId;
  const showAccessRequest = selfError?.data?.code === 'NOT_FOUND';

  const { data: accessRequest } = trpc.member.myAccessRequest.useQuery(undefined, {
    enabled: Boolean(showAccessRequest),
  });
  const { data: churches } = trpc.church.list.useQuery(
    { organizationId: undefined },
    { enabled: Boolean(showAccessRequest) }
  );

  const { data: directory } = trpc.member.directory.useQuery(
    { churchId, viewer: 'MEMBER' },
    { enabled: Boolean(churchId) }
  );
  const { data: shifts } = trpc.volunteer.listShifts.useQuery(
    { churchId, from: new Date() },
    { enabled: Boolean(churchId) }
  );
  const { data: volunteerRoles } = trpc.volunteer.listRoles.useQuery(
    { churchId, limit: 100 },
    { enabled: Boolean(churchId) }
  );
  const { data: myAssignments } = trpc.volunteer.selfAssignments.useQuery(undefined, {
    enabled: Boolean(selfProfile),
  });
  const { data: myAvailability } = trpc.volunteer.selfAvailability.useQuery(undefined, {
    enabled: Boolean(selfProfile),
  });
  const { data: surveys } = trpc.survey.listActive.useQuery(
    { churchId },
    { enabled: Boolean(churchId) }
  );
  const { data: conversations } = trpc.messaging.listConversations.useQuery(undefined, {
    enabled: Boolean(selfProfile),
  });
  const { data: messages } = trpc.messaging.listMessages.useQuery(
    { conversationId: selectedConversationId, limit: 50 },
    { enabled: Boolean(selectedConversationId) }
  );
  const { data: typingStatus } = trpc.messaging.typingStatus.useQuery(
    { conversationId: selectedConversationId },
    { enabled: Boolean(selectedConversationId) }
  );
  const { data: readStatus } = trpc.messaging.readStatus.useQuery(
    { conversationId: selectedConversationId },
    { enabled: Boolean(selectedConversationId) }
  );
  const { data: notifications } = trpc.notifications.listMine.useQuery(
    { limit: 15 },
    { enabled: Boolean(selfProfile) }
  );
  const { data: preferences } = trpc.notifications.listPreferences.useQuery(undefined, {
    enabled: Boolean(selfProfile),
  });
  const { data: events } = trpc.event.list.useQuery(
    { churchId, limit: 10 },
    { enabled: Boolean(churchId) }
  );
  const { data: myRsvps } = trpc.event.myRsvps.useQuery(undefined, { enabled: Boolean(selfProfile) });
  const { data: myTicketOrders } = trpc.event.myTicketOrders.useQuery(undefined, { enabled: Boolean(selfProfile) });
  const { data: myRegistrations } = trpc.event.myRegistrations.useQuery(undefined, { enabled: Boolean(selfProfile) });

  const { mutate: updateProfile } = trpc.member.selfUpdate.useMutation();
  const { mutate: assignShift } = trpc.volunteer.selfAssignShift.useMutation();
  const { mutate: cancelShift } = trpc.volunteer.selfCancelShift.useMutation();
  const { mutate: setAvailability } = trpc.volunteer.setSelfAvailability.useMutation({
    onSuccess: async () => {
      setAvailabilityNotes('');
      await utils.volunteer.selfAvailability.invalidate();
    },
  });
  const { mutate: deleteAvailability } = trpc.volunteer.deleteAvailability.useMutation({
    onSuccess: async () => {
      await utils.volunteer.selfAvailability.invalidate();
    },
  });
  const { mutate: sendMessage } = trpc.messaging.sendMessage.useMutation({
    onSuccess: async () => {
      setMessageBody('');
      setAttachmentUrl('');
      setAttachmentName('');
      setPendingAttachments([]);
      if (selectedConversationId) {
        setTyping({ conversationId: selectedConversationId, typing: false });
      }
      await utils.messaging.listMessages.invalidate();
      await utils.messaging.listConversations.invalidate();
    },
  });
  const { mutate: setTyping } = trpc.messaging.setTyping.useMutation();
  const { mutate: markConversationRead } = trpc.messaging.markConversationRead.useMutation();
  const { mutate: createDirect } = trpc.messaging.createDirect.useMutation({
    onSuccess: async (conversation) => {
      setSelectedConversationId(conversation.id);
      await utils.messaging.listConversations.invalidate();
    },
  });
  const { mutate: markRead } = trpc.notifications.markRead.useMutation({
    onSuccess: async () => {
      await utils.notifications.listMine.invalidate();
    },
  });
  const { mutate: updatePreference } = trpc.notifications.updatePreference.useMutation({
    onSuccess: async () => {
      await utils.notifications.listPreferences.invalidate();
    },
  });
  const { mutate: rsvp } = trpc.event.rsvp.useMutation({
    onSuccess: async () => {
      await utils.event.myRsvps.invalidate();
      await utils.event.list.invalidate();
    },
  });
  const { mutate: registerEvent } = trpc.event.register.useMutation({
    onSuccess: async () => {
      await utils.event.myRegistrations.invalidate();
      await utils.event.list.invalidate();
    },
  });
  const { mutate: cancelRegistration } = trpc.event.cancelRegistration.useMutation({
    onSuccess: async () => {
      await utils.event.myRegistrations.invalidate();
      await utils.event.list.invalidate();
    },
  });
  const { mutateAsync: ticketCheckout } = trpc.event.ticketCheckout.useMutation();
  const { mutateAsync: createUpload } = trpc.storage.createUpload.useMutation();
  const { mutate: submitSurvey } = trpc.survey.submitSelfResponse.useMutation();
  const { mutate: requestAccess, isPending: isRequestingAccess } = trpc.member.requestAccess.useMutation({
    onSuccess: async () => {
      await utils.member.myAccessRequest.invalidate();
    },
  });

  useEffect(() => {
    if (selfProfile?.member) {
      setDirectoryVisibility(selfProfile.member.directoryVisibility ?? 'MEMBERS_ONLY');
      setShowEmail(Boolean(selfProfile.member.showEmailInDirectory));
      setShowPhone(Boolean(selfProfile.member.showPhoneInDirectory));
      setShowAddress(Boolean(selfProfile.member.showAddressInDirectory));
      setShowPhoto(Boolean(selfProfile.member.showPhotoInDirectory));
      setPreferredName(selfProfile.member.preferredName ?? '');
      setPhone(selfProfile.member.phone ?? '');
      setAddressLine1(selfProfile.member.addressLine1 ?? '');
      setAddressLine2(selfProfile.member.addressLine2 ?? '');
      setCity(selfProfile.member.city ?? '');
      setState(selfProfile.member.state ?? '');
      setPostalCode(selfProfile.member.postalCode ?? '');
      setCountry(selfProfile.member.country ?? '');
    }
  }, [selfProfile]);

  useEffect(() => {
    if (!showAccessRequest) return;
    if (!requestName && user?.fullName) {
      setRequestName(user.fullName);
    }
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!requestEmail && email) {
      setRequestEmail(email);
    }
  }, [requestEmail, requestName, showAccessRequest, user]);

  useEffect(() => {
    if (!requestChurchId && churches?.length) {
      setRequestChurchId(churches[0].id);
    }
  }, [requestChurchId, churches]);

  useEffect(() => {
    if (!availabilityRoleId && volunteerRoles?.length) {
      setAvailabilityRoleId(volunteerRoles[0].id);
    }
  }, [availabilityRoleId, volunteerRoles]);

  useEffect(() => {
    if (!selectedConversationId && conversations?.length) {
      setSelectedConversationId(conversations[0].conversation.id);
    }
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    const previous = lastConversationRef.current;
    if (previous && previous !== selectedConversationId) {
      setTyping({ conversationId: previous, typing: false });
    }
    lastConversationRef.current = selectedConversationId || null;
  }, [selectedConversationId, setTyping]);

  useEffect(() => {
    if (!selectedConversationId) return;
    markConversationRead({ conversationId: selectedConversationId });
  }, [markConversationRead, messages?.[0]?.id, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (typingIdleRef.current) {
      clearTimeout(typingIdleRef.current);
    }

    const hasContent = Boolean(messageBody.trim());
    typingTimeoutRef.current = setTimeout(() => {
      setTyping({ conversationId: selectedConversationId, typing: hasContent });
    }, 300);

    if (hasContent) {
      typingIdleRef.current = setTimeout(() => {
        setTyping({ conversationId: selectedConversationId, typing: false });
      }, 2000);
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (typingIdleRef.current) {
        clearTimeout(typingIdleRef.current);
      }
    };
  }, [messageBody, selectedConversationId, setTyping]);

  const addAttachment = () => {
    const url = attachmentUrl.trim();
    if (!url) return;
    setPendingAttachments((prev) => {
      if (prev.some((entry) => entry.url === url)) return prev;
      const next: MessageAttachment = { url, name: attachmentName.trim() || undefined };
      return [...prev, next];
    });
    setAttachmentUrl('');
    setAttachmentName('');
  };

  const removeAttachment = (url: string) => {
    setPendingAttachments((prev) => prev.filter((entry) => entry.url !== url));
  };

  const handleAttachmentFile = async (file?: File | null) => {
    if (!file || uploadingAttachment) return;
    setUploadingAttachment(true);
    try {
      const upload = await createUpload({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        purpose: 'message-attachments',
        churchId: churchId ?? undefined,
      });

      await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });

      setPendingAttachments((prev) => [
        ...prev,
        {
          url: upload.publicUrl,
          name: file.name,
          type: file.type || undefined,
          assetId: upload.assetId,
        },
      ]);
    } catch (error) {
      console.error('Failed to upload attachment', error);
    } finally {
      setUploadingAttachment(false);
    }
  };

  const surveyQuestions = useMemo(() => {
    const map: Record<string, any[]> = {};
    surveys?.forEach((survey) => {
      map[survey.id] = survey.questions ?? [];
    });
    return map;
  }, [surveys]);

  const myShiftIds = useMemo(() => new Set(myAssignments?.map((assignment) => assignment.shiftId) ?? []), [myAssignments]);
  const rsvpMap = useMemo(() => {
    const map = new Map<string, string>();
    (myRsvps ?? []).forEach((entry) => {
      map.set(entry.eventId, entry.status);
    });
    return map;
  }, [myRsvps]);

  const ticketOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    (myTicketOrders ?? []).forEach((order) => {
      map.set(order.eventId, (map.get(order.eventId) ?? 0) + order.quantity);
    });
    return map;
  }, [myTicketOrders]);

  const registrationMap = useMemo(() => {
    const map = new Map<string, any>();
    (myRegistrations ?? []).forEach((registration) => {
      map.set(registration.eventId, registration);
    });
    return map;
  }, [myRegistrations]);

  const otherTyping = useMemo(
    () => (typingStatus ?? []).filter((entry) => entry.memberId !== selfProfile?.member?.id),
    [typingStatus, selfProfile?.member?.id]
  );

  const otherReadStatus = useMemo(
    () => (readStatus ?? []).filter((entry) => entry.memberId !== selfProfile?.member?.id),
    [readStatus, selfProfile?.member?.id]
  );

  const formatDateTime = (value?: string | Date | null) => {
    if (!value) return '—';
    const date = typeof value === 'string' ? new Date(value) : value;
    return date.toLocaleString();
  };

  const handleAnswerChange = (surveyId: string, questionId: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [surveyId]: {
        ...(prev[surveyId] ?? {}),
        [questionId]: value,
      },
    }));
  };

  const handleRegistrationResponse = (eventId: string, fieldKey: string, value: any) => {
    setRegistrationResponses((prev) => ({
      ...prev,
      [eventId]: {
        ...(prev[eventId] ?? {}),
        [fieldKey]: value,
      },
    }));
  };

  if (isProfileLoading) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <Card className="p-6">
          <p className="text-sm text-muted">Loading your portal…</p>
        </Card>
      </div>
    );
  }

  if (selfError?.data?.code === 'UNAUTHORIZED') {
    return (
      <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center p-8">
        <Card className="p-6 text-center">
          <h1 className="text-xl font-semibold">Sign in to continue</h1>
          <p className="mt-2 text-sm text-muted">Your member portal is protected.</p>
          <div className="mt-4">
            <SignedOut>
              <SignInButton mode="modal">
                <Button>Sign in</Button>
              </SignInButton>
            </SignedOut>
          </div>
        </Card>
      </div>
    );
  }

  if (selfError?.data?.code === 'NOT_FOUND') {
    return (
      <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center p-8">
        <Card className="w-full max-w-xl p-6">
          <h1 className="text-xl font-semibold">Request member access</h1>
          <p className="mt-2 text-sm text-muted">
            Your account is signed in but not linked to a member record. Submit this request and we’ll notify your
            church staff.
          </p>
          {accessRequest ? (
            <div className="mt-4 rounded-md border border-border bg-muted/10 p-3 text-sm text-muted">
              <p className="font-medium text-foreground">Request status: {accessRequest.status}</p>
              <p className="text-xs text-muted">
                {accessRequest.church?.name ?? 'Church'} · {accessRequest.email ?? 'No email'}
              </p>
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Full name"
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
            />
            <Input
              placeholder="Email"
              value={requestEmail}
              onChange={(e) => setRequestEmail(e.target.value)}
            />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={requestChurchId}
              onChange={(e) => setRequestChurchId(e.target.value)}
            >
              <option value="">Select church</option>
              {churches?.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.name}
                </option>
              ))}
            </select>
            <Input
              placeholder="Message (optional)"
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <Button
              onClick={() =>
                requestAccess({
                  churchId: requestChurchId,
                  name: requestName.trim() || undefined,
                  email: requestEmail.trim() || undefined,
                  message: requestMessage.trim() || undefined,
                })
              }
              disabled={!requestChurchId || !requestName.trim() || !requestEmail.trim() || isRequestingAccess}
            >
              {isRequestingAccess ? 'Submitting…' : 'Request access'}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <SignedOut>
        <Card className="p-6">
          <h1 className="text-2xl font-semibold">Member Portal</h1>
          <p className="mt-2 text-sm text-muted">Sign in to access your profile and church community tools.</p>
          <div className="mt-4">
            <SignInButton mode="modal">
              <Button>Sign in</Button>
            </SignInButton>
          </div>
        </Card>
      </SignedOut>

      <SignedIn>
        <div>
          <h1 className="text-3xl font-semibold">Member Portal</h1>
          <p className="mt-2 text-sm text-muted">Profile, privacy, volunteering, and surveys.</p>
        </div>

        {selfError ? (
          <Card className="p-6">
            <p className="text-sm text-muted">
              Your account is not linked to a member profile yet. Ask an admin to link your Clerk user to your member
              record.
            </p>
          </Card>
        ) : null}

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Profile</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input placeholder="Preferred name" value={preferredName} onChange={(e) => setPreferredName(e.target.value)} />
            <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input placeholder="Address line 1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
            <Input placeholder="Address line 2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
            <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
            <Input placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
            <Input placeholder="Postal code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
            <Input placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <div className="mt-4">
            <Button
              onClick={() =>
                updateProfile({
                  preferredName: preferredName || undefined,
                  phone: phone || undefined,
                  addressLine1: addressLine1 || undefined,
                  addressLine2: addressLine2 || undefined,
                  city: city || undefined,
                  state: state || undefined,
                  postalCode: postalCode || undefined,
                  country: country || undefined,
                })
              }
              disabled={!selfProfile?.member}
            >
              Save profile
            </Button>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border border-border p-3 text-sm text-muted">
              <p className="text-xs uppercase tracking-wide">Engagement</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {selfProfile?.engagementScore?.score ?? 0}
              </p>
              <p className="mt-1 text-xs text-muted">Last seen: {formatDateTime(selfProfile?.attendance?.lastSeenAt)}</p>
            </div>
            <div className="rounded-md border border-border p-3 text-sm text-muted">
              <p className="text-xs uppercase tracking-wide">Attendance</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {selfProfile?.attendance?.count ?? 0}
              </p>
              <p className="mt-1 text-xs text-muted">Recent 90 days</p>
            </div>
            <div className="rounded-md border border-border p-3 text-sm text-muted">
              <p className="text-xs uppercase tracking-wide">Giving</p>
              <div className="mt-2 space-y-1 text-sm">
                {(selfProfile?.giving?.totals ?? []).map((total) => (
                  <div key={total.currency} className="flex items-center justify-between">
                    <span>{total.currency}</span>
                    <span className="font-semibold text-foreground">{total.totalAmount?.toString() ?? '0'}</span>
                  </div>
                ))}
                {!selfProfile?.giving?.totals?.length && <p className="text-xs text-muted">No giving yet.</p>}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Directory privacy</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={directoryVisibility}
              onChange={(e) => setDirectoryVisibility(e.target.value)}
            >
              <option value="PUBLIC">Public</option>
              <option value="MEMBERS_ONLY">Members only</option>
              <option value="LEADERS_ONLY">Leaders only</option>
              <option value="PRIVATE">Private</option>
            </select>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showEmail} onChange={(e) => setShowEmail(e.target.checked)} />
                Show email
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showPhone} onChange={(e) => setShowPhone(e.target.checked)} />
                Show phone
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showAddress} onChange={(e) => setShowAddress(e.target.checked)} />
                Show address
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showPhoto} onChange={(e) => setShowPhoto(e.target.checked)} />
                Show photo
              </label>
            </div>
          </div>
          <div className="mt-4">
            <Button
              onClick={() =>
                updateProfile({
                  directoryVisibility: directoryVisibility as any,
                  showEmailInDirectory: showEmail,
                  showPhoneInDirectory: showPhone,
                  showAddressInDirectory: showAddress,
                  showPhotoInDirectory: showPhoto,
                })
              }
              disabled={!selfProfile?.member}
            >
              Update privacy
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Member directory</h2>
          <div className="mt-4 space-y-3 text-sm text-muted">
            {directory?.map((member) => (
              <div key={member.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">
                    {member.preferredName ?? member.firstName} {member.lastName}
                  </p>
                  <Badge variant="default">{member.directoryVisibility}</Badge>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <p>Email: {member.email ?? '—'}</p>
                  <p>Phone: {member.phone ?? '—'}</p>
                  <p>
                    Location:{' '}
                    {[member.city, member.state, member.country].filter(Boolean).join(', ') || '—'}
                  </p>
                </div>
              </div>
            ))}
            {!directory?.length && <p>No directory entries available.</p>}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="mt-1 text-sm text-muted">Your latest updates from church staff.</p>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {notifications?.map((notification) => (
              <div key={notification.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{notification.title}</p>
                    <p className="text-xs text-muted">{notification.body}</p>
                    <p className="text-xs text-muted">{new Date(notification.createdAt).toLocaleString()}</p>
                  </div>
                  {notification.readAt ? (
                    <Badge variant="default">Read</Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => markRead({ ids: [notification.id] })}>
                      Mark read
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {!notifications?.length && <p className="text-sm text-muted">No notifications yet.</p>}
          </div>
          <div className="mt-4 space-y-2 text-sm text-muted">
            <p className="text-xs uppercase text-muted">Notification preferences</p>
            {['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH'].map((channel) => {
              const pref = preferences?.find((entry) => entry.channel === channel);
              return (
                <label key={channel} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pref?.enabled ?? true}
                    onChange={(e) => updatePreference({ channel: channel as any, enabled: e.target.checked })}
                  />
                  {channel.replace('_', ' ')}
                </label>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Messages</h2>
          <p className="mt-1 text-sm text-muted">Chat with church staff or other members.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={selectedConversationId}
              onChange={(e) => setSelectedConversationId(e.target.value)}
            >
              <option value="">Select conversation</option>
              {conversations?.map((entry) => (
                <option key={entry.conversation.id} value={entry.conversation.id}>
                  {entry.conversation.name ?? 'Direct conversation'}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-10 flex-1 rounded-md border border-border bg-white px-3 text-sm"
                value={newConversationMemberId}
                onChange={(e) => setNewConversationMemberId(e.target.value)}
              >
                <option value="">Start new conversation</option>
                {directory
                  ?.filter((member) => member.id !== selfProfile?.member?.id)
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.preferredName ?? member.firstName} {member.lastName}
                    </option>
                  ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (newConversationMemberId) {
                    createDirect({ memberId: newConversationMemberId });
                  }
                }}
                disabled={!newConversationMemberId}
              >
                Start
              </Button>
            </div>
          </div>
          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-md border border-border p-3 text-sm text-muted">
            {messages?.slice().reverse().map((message) => (
              <div key={message.id} className="rounded-md border border-border p-2">
                <p className="text-xs text-muted">
                  {message.senderType === 'MEMBER' ? 'Member' : 'Staff'} ·{' '}
                  {new Date(message.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-foreground">{message.body}</p>
                {Array.isArray(message.attachments) && message.attachments.length ? (
                  <div className="mt-2 space-y-1 text-xs text-muted">
                    {message.attachments.map((attachment: any) => (
                      <a
                        key={attachment.url}
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-primary underline"
                      >
                        {attachment.name ?? attachment.url}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {!messages?.length && <p className="text-sm text-muted">No messages yet.</p>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            {otherTyping.length ? <span>{otherTyping.map((entry) => entry.name).join(', ')} typing...</span> : null}
            {otherReadStatus.length ? (
              <span>
                Last read:{' '}
                {otherReadStatus
                  .map((entry) => `${entry.name} ${entry.lastReadAt ? formatDateTime(entry.lastReadAt) : '—'}`)
                  .join(', ')}
              </span>
            ) : null}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Write a message"
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
            />
            <Button
              onClick={() => {
                if (selectedConversationId && messageBody.trim()) {
                  const pending = pendingAttachments.length
                    ? pendingAttachments
                    : attachmentUrl.trim()
                      ? [{ url: attachmentUrl.trim(), name: attachmentName.trim() || undefined }]
                      : undefined;
                  sendMessage({
                    conversationId: selectedConversationId,
                    body: messageBody.trim(),
                    attachments: pending,
                  });
                }
              }}
              disabled={!selectedConversationId || !messageBody.trim()}
            >
              Send
            </Button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <Input
              placeholder="Attachment URL"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
            />
            <Input
              placeholder="Label (optional)"
              value={attachmentName}
              onChange={(e) => setAttachmentName(e.target.value)}
            />
            <Button variant="outline" onClick={addAttachment} disabled={!attachmentUrl.trim()}>
              Add attachment
            </Button>
            <Input
              type="file"
              disabled={uploadingAttachment}
              onChange={(e) => handleAttachmentFile(e.target.files?.[0])}
            />
          </div>
          {pendingAttachments.length ? (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
              {pendingAttachments.map((attachment) => (
                <div key={attachment.url} className="flex items-center gap-2 rounded-md border border-border px-2 py-1">
                  <span className="truncate">{attachment.name ?? attachment.url}</span>
                  <Button size="sm" variant="outline" onClick={() => removeAttachment(attachment.url)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Upcoming events</h2>
          <p className="mt-1 text-sm text-muted">RSVP and manage your attendance.</p>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted">
            <label className="text-xs uppercase text-muted">Payment provider</label>
            <select
              className="h-8 rounded-md border border-border bg-white px-2 text-xs"
              value={ticketProvider}
              onChange={(e) => setTicketProvider(e.target.value)}
            >
              <option value="STRIPE">Stripe</option>
              <option value="PAYSTACK">Paystack</option>
            </select>
          </div>
          <div className="mt-4 space-y-3 text-sm text-muted">
            {events?.map((event) => {
              const status = rsvpMap.get(event.id);
              const ticketTypes = event.ticketTypes ?? [];
              const ticketCount = ticketOrderMap.get(event.id) ?? 0;
              const registration = registrationMap.get(event.id);
              const registrationFields = Array.isArray(event.registrationFields) ? event.registrationFields : [];
              return (
                <div key={event.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{event.title}</p>
                      <p className="text-xs text-muted">
                        {formatDateTime(event.startAt)} → {formatDateTime(event.endAt)}
                      </p>
                      {event.location ? <p className="text-xs text-muted">{event.location}</p> : null}
                      {ticketCount ? (
                        <p className="text-xs text-muted">Tickets purchased: {ticketCount}</p>
                      ) : null}
                      {event.registrationEnabled ? (
                        <p className="text-xs text-muted">
                          Registration: {registration?.status ?? 'Not registered'}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {event.requiresRsvp && ticketTypes.length === 0 ? (
                        <Badge variant="default">{status ?? 'RSVP'}</Badge>
                      ) : (
                        <Badge variant="default">Open</Badge>
                      )}
                      {event.requiresRsvp && ticketTypes.length === 0 ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => rsvp({ eventId: event.id, status: 'GOING' })}
                          >
                            Going
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rsvp({ eventId: event.id, status: 'DECLINED' })}
                          >
                            Decline
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {event.registrationEnabled ? (
                    <div className="mt-3 space-y-2 text-xs text-muted">
                      {registrationFields.length ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {registrationFields.map((field: any, idx: number) => {
                            const fieldKey = field.id ?? field.label ?? `field-${idx}`;
                            const value = registrationResponses[event.id]?.[fieldKey] ?? '';
                            if (field.type === 'SELECT' || field.type === 'MULTI_SELECT') {
                              return (
                                <select
                                  key={fieldKey}
                                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                                  value={value}
                                  onChange={(e) => handleRegistrationResponse(event.id, fieldKey, e.target.value)}
                                >
                                  <option value="">Select {field.label}</option>
                                  {(field.options ?? []).map((option: string) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              );
                            }
                            if (field.type === 'CHECKBOX') {
                              return (
                                <label key={fieldKey} className="flex items-center gap-2 text-sm text-muted">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(value)}
                                    onChange={(e) => handleRegistrationResponse(event.id, fieldKey, e.target.checked)}
                                  />
                                  {field.label}
                                </label>
                              );
                            }
                            return (
                              <Input
                                key={fieldKey}
                                placeholder={field.label}
                                type={field.type === 'NUMBER' ? 'number' : field.type === 'DATE' ? 'date' : 'text'}
                                value={value}
                                onChange={(e) => handleRegistrationResponse(event.id, fieldKey, e.target.value)}
                              />
                            );
                          })}
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {registration && registration.status !== 'CANCELED' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => cancelRegistration({ eventId: event.id })}
                          >
                            Cancel registration
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() =>
                              registerEvent({
                                eventId: event.id,
                                responses: registrationResponses[event.id] ?? {},
                              })
                            }
                          >
                            {registration?.status === 'WAITLISTED' ? 'Join waitlist' : 'Register'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : null}
                  {ticketTypes.length ? (
                    <div className="mt-3 space-y-2 text-xs text-muted">
                      {ticketTypes.map((type: any) => (
                        <div key={type.id} className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-foreground">{type.name}</p>
                            <p className="text-xs text-muted">
                              {type.currency} {type.price}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={async () => {
                              const result = await ticketCheckout({
                                eventId: event.id,
                                ticketTypeId: type.id,
                                quantity: 1,
                                provider: ticketProvider as any,
                                successUrl: `${window.location.origin}/portal`,
                                cancelUrl: `${window.location.origin}/portal`,
                              });
                              if (result?.checkoutUrl) {
                                window.location.href = result.checkoutUrl;
                              }
                            }}
                          >
                            Buy ticket
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {!events?.length && <p className="text-sm text-muted">No upcoming events.</p>}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Volunteer shifts</h2>
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium text-muted">Upcoming shifts</p>
            <div className="space-y-2">
              {shifts?.map((shift) => {
                const assignedCount = shift.assignments?.filter((assignment) => assignment.status !== 'CANCELED').length ?? 0;
                const capacity = shift.capacity ?? null;
                const isAssigned = myShiftIds.has(shift.id);
                return (
                  <div key={shift.id} className="rounded-md border border-border p-3 text-sm text-muted">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">{shift.title}</p>
                        <p className="text-xs text-muted">
                          {shift.role?.name ?? 'Role'} · {formatDateTime(shift.startAt)} → {formatDateTime(shift.endAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="default">
                          {assignedCount}{capacity ? ` / ${capacity}` : ''} assigned
                        </Badge>
                        <Button
                          size="sm"
                          onClick={() => assignShift({ shiftId: shift.id })}
                          disabled={isAssigned}
                        >
                          {isAssigned ? 'Joined' : 'Join'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!shifts?.length && <p className="text-sm text-muted">No upcoming shifts.</p>}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <p className="text-sm font-medium text-muted">My assignments</p>
            <div className="space-y-2">
              {myAssignments?.map((assignment) => (
                <div key={assignment.id} className="rounded-md border border-border p-3 text-sm text-muted">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{assignment.shift.title}</p>
                      <p className="text-xs text-muted">
                        {assignment.shift.role?.name ?? 'Role'} · {formatDateTime(assignment.shift.startAt)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cancelShift({ assignmentId: assignment.id })}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
              {!myAssignments?.length && <p className="text-sm text-muted">No assignments yet.</p>}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Volunteer availability</h2>
          <p className="mt-1 text-sm text-muted">
            Share when you are available to serve so leaders can staff future shifts.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={availabilityRoleId}
              onChange={(e) => setAvailabilityRoleId(e.target.value)}
            >
              <option value="">Any role</option>
              {volunteerRoles?.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={availabilityDay}
              onChange={(e) => setAvailabilityDay(e.target.value)}
            >
              <option value="SUNDAY">Sunday</option>
              <option value="MONDAY">Monday</option>
              <option value="TUESDAY">Tuesday</option>
              <option value="WEDNESDAY">Wednesday</option>
              <option value="THURSDAY">Thursday</option>
              <option value="FRIDAY">Friday</option>
              <option value="SATURDAY">Saturday</option>
            </select>
            <Input
              placeholder="Start (HH:MM)"
              value={availabilityStart}
              onChange={(e) => setAvailabilityStart(e.target.value)}
            />
            <Input
              placeholder="End (HH:MM)"
              value={availabilityEnd}
              onChange={(e) => setAvailabilityEnd(e.target.value)}
            />
            <Input
              placeholder="Notes (optional)"
              value={availabilityNotes}
              onChange={(e) => setAvailabilityNotes(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <Button
              onClick={() =>
                setAvailability({
                  roleId: availabilityRoleId || undefined,
                  dayOfWeek: availabilityDay as any,
                  startTime: availabilityStart,
                  endTime: availabilityEnd,
                  notes: availabilityNotes || undefined,
                })
              }
            >
              Save availability
            </Button>
          </div>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {myAvailability?.map((slot) => (
              <div key={slot.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">
                      {slot.dayOfWeek} · {slot.startTime} - {slot.endTime}
                    </p>
                    <p className="text-xs text-muted">{slot.role?.name ?? 'Any role'}</p>
                    {slot.notes ? <p className="text-xs text-muted">{slot.notes}</p> : null}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => deleteAvailability({ id: slot.id })}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            {!myAvailability?.length && <p className="text-sm text-muted">No availability recorded yet.</p>}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Surveys</h2>
          <div className="mt-4 space-y-6">
            {surveys?.map((survey) => (
              <div key={survey.id} className="rounded-md border border-border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">{survey.title}</h3>
                  <Badge variant="default">{survey.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted">{survey.description ?? 'No description.'}</p>
                <div className="mt-4 space-y-3">
                  {surveyQuestions[survey.id]?.map((question) => (
                    <div key={question.id} className="space-y-2">
                      <p className="text-sm font-medium">{question.prompt}</p>
                      {question.type === 'TEXT' ? (
                        <Input
                          placeholder="Your response"
                          value={answers[survey.id]?.[question.id] ?? ''}
                          onChange={(e) => handleAnswerChange(survey.id, question.id, e.target.value)}
                        />
                      ) : question.type === 'RATING' ? (
                        <Input
                          placeholder="Rating 1-5"
                          type="number"
                          value={answers[survey.id]?.[question.id] ?? ''}
                          onChange={(e) => handleAnswerChange(survey.id, question.id, Number(e.target.value))}
                        />
                      ) : question.type === 'MULTI_CHOICE' ? (
                        <div className="flex flex-wrap gap-3 text-sm text-muted">
                          {(question.options ?? []).map((option: string) => {
                            const current = (answers[survey.id]?.[question.id] ?? []) as string[];
                            const checked = current.includes(option);
                            return (
                              <label key={option} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...current, option]
                                      : current.filter((item) => item !== option);
                                    handleAnswerChange(survey.id, question.id, next);
                                  }}
                                />
                                {option}
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <select
                          className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                          value={answers[survey.id]?.[question.id] ?? ''}
                          onChange={(e) => handleAnswerChange(survey.id, question.id, e.target.value)}
                        >
                          <option value="">Select</option>
                          {(question.options ?? []).map((option: string) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <Button
                    onClick={() => {
                      submitSurvey({
                        surveyId: survey.id,
                        answers: answers[survey.id] ?? {},
                      });
                    }}
                  >
                    Submit survey
                  </Button>
                </div>
              </div>
            ))}
            {!surveys?.length && <p className="text-sm text-muted">No active surveys.</p>}
          </div>
        </Card>
      </SignedIn>
    </div>
  );
}
