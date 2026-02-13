'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Badge } from '@faithflow-ai/ui';
import { trpc } from '../../lib/trpc';
import { Shell } from '../../components/Shell';
import { useFeatureGate } from '../../lib/entitlements';
import { FeatureLocked } from '../../components/FeatureLocked';
import { ReadOnlyNotice } from '../../components/ReadOnlyNotice';

export default function MembersPage() {
  const gate = useFeatureGate('membership_enabled');
  const utils = trpc.useUtils();
  const canWrite = gate.canWrite;
  const { data: churches } = trpc.church.list.useQuery({});
  const [churchId, setChurchId] = useState<string>('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [primaryMemberId, setPrimaryMemberId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState('SMALL_GROUP');
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('');
  const [milestoneType, setMilestoneType] = useState('BAPTISM');
  const [milestoneDate, setMilestoneDate] = useState('');
  const [milestoneNotes, setMilestoneNotes] = useState('');
  const [volunteerRoleName, setVolunteerRoleName] = useState('');
  const [volunteerRoleDescription, setVolunteerRoleDescription] = useState('');
  const [directoryVisibility, setDirectoryVisibility] = useState('MEMBERS_ONLY');
  const [showEmail, setShowEmail] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [showPhoto, setShowPhoto] = useState(true);
  const [clerkUserId, setClerkUserId] = useState('');
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [workflowIdForStep, setWorkflowIdForStep] = useState('');
  const [stepName, setStepName] = useState('');
  const [stepType, setStepType] = useState('WELCOME_CALL');
  const [stepOrder, setStepOrder] = useState('1');
  const [stepDueDays, setStepDueDays] = useState('7');
  const [assignWorkflowId, setAssignWorkflowId] = useState('');
  const [groupIdForEvent, setGroupIdForEvent] = useState('');
  const [groupEventTitle, setGroupEventTitle] = useState('');
  const [groupEventStart, setGroupEventStart] = useState('');
  const [groupEventEnd, setGroupEventEnd] = useState('');
  const [groupEventLocation, setGroupEventLocation] = useState('');
  const [shiftRoleId, setShiftRoleId] = useState('');
  const [shiftTitle, setShiftTitle] = useState('');
  const [shiftDescription, setShiftDescription] = useState('');
  const [shiftStart, setShiftStart] = useState('');
  const [shiftEnd, setShiftEnd] = useState('');
  const [shiftCapacity, setShiftCapacity] = useState('');
  const [surveyTitle, setSurveyTitle] = useState('');
  const [surveyDescription, setSurveyDescription] = useState('');
  const [surveyIdForQuestion, setSurveyIdForQuestion] = useState('');
  const [surveyQuestionPrompt, setSurveyQuestionPrompt] = useState('');
  const [surveyQuestionType, setSurveyQuestionType] = useState('TEXT');
  const [surveyQuestionOrder, setSurveyQuestionOrder] = useState('1');
  const [surveyQuestionOptions, setSurveyQuestionOptions] = useState('');
  const [shiftFilterFrom, setShiftFilterFrom] = useState('');
  const [shiftFilterTo, setShiftFilterTo] = useState('');
  const [surveySummaryId, setSurveySummaryId] = useState('');
  const [surveyAiProvider, setSurveyAiProvider] = useState('openai');
  const [directorySearch, setDirectorySearch] = useState('');
  const [gapHoursAhead, setGapHoursAhead] = useState('48');
  const [analyticsLookbackDays, setAnalyticsLookbackDays] = useState('90');
  const [segmentLookbackDays, setSegmentLookbackDays] = useState('90');
  const [segmentLimit, setSegmentLimit] = useState('8');
  const [relationshipToMemberId, setRelationshipToMemberId] = useState('');
  const [relationshipType, setRelationshipType] = useState('SPOUSE');
  const [relationshipLabel, setRelationshipLabel] = useState('');
  const [relationshipNotes, setRelationshipNotes] = useState('');
  const [relationshipReciprocal, setRelationshipReciprocal] = useState(true);
  const [availabilityRoleId, setAvailabilityRoleId] = useState('');
  const [availabilityDay, setAvailabilityDay] = useState('SUNDAY');
  const [availabilityStart, setAvailabilityStart] = useState('09:00');
  const [availabilityEnd, setAvailabilityEnd] = useState('12:00');
  const [availabilityNotes, setAvailabilityNotes] = useState('');
  const [importCsv, setImportCsv] = useState('');
  const [importFilename, setImportFilename] = useState('');
  const [importSummary, setImportSummary] = useState<any>(null);
  const [householdImportCsv, setHouseholdImportCsv] = useState('');
  const [householdImportFilename, setHouseholdImportFilename] = useState('');
  const [householdImportSummary, setHouseholdImportSummary] = useState<any>(null);
  const [staffConversationId, setStaffConversationId] = useState('');
  const [staffMessageBody, setStaffMessageBody] = useState('');
  const [staffAttachmentUrl, setStaffAttachmentUrl] = useState('');
  const [staffAttachmentName, setStaffAttachmentName] = useState('');
  const [pendingStaffAttachments, setPendingStaffAttachments] = useState<{ url: string; name?: string; assetId?: string }[]>([]);
  const [uploadingStaffAttachment, setUploadingStaffAttachment] = useState(false);

  useEffect(() => {
    if (!churchId && churches?.length) {
      setChurchId(churches[0].id);
    }
  }, [churchId, churches]);

  const { data: members } = trpc.member.list.useQuery({
    churchId: churchId || undefined,
    query: searchQuery || undefined,
  });
  const { data: memberProfile } = trpc.member.profile.useQuery(
    { id: selectedMemberId },
    { enabled: Boolean(selectedMemberId) }
  );
  const { data: households } = trpc.household.list.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: groups } = trpc.group.list.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: tags } = trpc.memberTag.list.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: volunteerRoles } = trpc.volunteer.listRoles.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: volunteerShifts } = trpc.volunteer.listShifts.useQuery(
    {
      churchId: churchId || undefined,
      from: shiftFilterFrom ? new Date(shiftFilterFrom) : undefined,
      to: shiftFilterTo ? new Date(shiftFilterTo) : undefined,
    },
    { enabled: Boolean(churchId) }
  );
  const { data: surveys } = trpc.survey.listSurveys.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: surveySummary } = trpc.survey.summary.useQuery(
    { surveyId: surveySummaryId },
    { enabled: Boolean(surveySummaryId) }
  );
  const { data: surveySummaryAi, refetch: refetchSurveyAi, isFetching: isFetchingSurveyAi } =
    trpc.survey.summaryAi.useQuery(
      { surveyId: surveySummaryId, provider: surveyAiProvider as any },
      { enabled: false }
    );
  const { refetch: refetchSurveyExport, isFetching: isFetchingSurveyExport } =
    trpc.survey.exportResponses.useQuery(
      { surveyId: surveySummaryId },
      { enabled: false }
    );
  const { data: workflows } = trpc.onboarding.listWorkflows.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: onboardingAssignments } = trpc.onboarding.memberAssignments.useQuery(
    { memberId: selectedMemberId },
    { enabled: Boolean(selectedMemberId) }
  );
  const { data: membershipEngagement } = trpc.member.engagementSummary.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: memberAnalytics } = trpc.member.analytics.useQuery(
    { churchId: churchId || undefined, lookbackDays: Number(analyticsLookbackDays || '90') },
    { enabled: Boolean(churchId) }
  );
  const { data: memberSegments } = trpc.member.segments.useQuery(
    {
      churchId: churchId || undefined,
      lookbackDays: Number(segmentLookbackDays || '90'),
      limit: Number(segmentLimit || '8'),
    },
    { enabled: Boolean(churchId) }
  );
  const { data: groupEngagement } = trpc.group.engagementSummary.useQuery(
    { groupId: groupIdForEvent },
    { enabled: Boolean(groupIdForEvent) }
  );
  const { data: groupEvents } = trpc.event.list.useQuery(
    { groupId: groupIdForEvent },
    { enabled: Boolean(groupIdForEvent) }
  );
  const { data: directoryPreview } = trpc.member.directory.useQuery(
    { churchId: churchId || undefined, viewer: 'LEADER', limit: 200 },
    { enabled: Boolean(churchId) }
  );
  const { data: staffingGaps } = trpc.volunteer.shiftGaps.useQuery(
    { churchId: churchId || undefined, hoursAhead: Number(gapHoursAhead || '48') },
    { enabled: Boolean(churchId) }
  );
  const { data: relationships } = trpc.relationship.listForMember.useQuery(
    { memberId: selectedMemberId },
    { enabled: Boolean(selectedMemberId) }
  );
  const { data: availability } = trpc.volunteer.listAvailability.useQuery(
    { memberId: selectedMemberId },
    { enabled: Boolean(selectedMemberId) }
  );
  const { data: staffMessages } = trpc.messaging.listMessages.useQuery(
    { conversationId: staffConversationId, limit: 50, asStaff: true },
    { enabled: Boolean(staffConversationId) }
  );

  type ShiftItem = NonNullable<typeof volunteerShifts>[number];
  const shiftsByDay = useMemo(() => {
    const map = new Map<string, ShiftItem[]>();
    (volunteerShifts ?? []).forEach((shift) => {
      const dayKey = new Date(shift.startAt).toLocaleDateString();
      const list = map.get(dayKey) ?? [];
      list.push(shift);
      map.set(dayKey, list);
    });
    return Array.from(map.entries());
  }, [volunteerShifts]);

  const shiftCalendar = useMemo(() => {
    const dayMap = new Map<string, ShiftItem[]>();
    (volunteerShifts ?? []).forEach((shift) => {
      const dayKey = new Date(shift.startAt).toDateString();
      const list = dayMap.get(dayKey) ?? [];
      list.push(shift);
      dayMap.set(dayKey, list);
    });

    const days: { date: Date; shifts: ShiftItem[] }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i += 1) {
      const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
      const key = date.toDateString();
      days.push({ date, shifts: dayMap.get(key) ?? [] });
    }
    return days;
  }, [volunteerShifts]);

  const orderedStaffMessages = useMemo(() => {
    return [...(staffMessages ?? [])].reverse();
  }, [staffMessages]);

  const filteredDirectory = useMemo(() => {
    const query = directorySearch.trim().toLowerCase();
    if (!query) return directoryPreview ?? [];
    return (directoryPreview ?? []).filter((member) => {
      const name = `${member.firstName} ${member.lastName} ${member.preferredName ?? ''}`.toLowerCase();
      const email = (member.email ?? '').toLowerCase();
      const phone = (member.phone ?? '').toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query);
    });
  }, [directoryPreview, directorySearch]);

  const handleSurveyExport = async () => {
    if (!surveySummaryId) return;
    const result = await refetchSurveyExport();
    if (!result.data) return;
    const blob = new Blob([result.data.content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.data.filename || 'survey-responses.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImportCsv(String(reader.result ?? ''));
      setImportFilename(file.name);
      setImportSummary(null);
    };
    reader.readAsText(file);
  };

  const handleHouseholdImportFile = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setHouseholdImportCsv(String(reader.result ?? ''));
      setHouseholdImportFilename(file.name);
      setHouseholdImportSummary(null);
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const template = 'firstName,lastName,email,phone,householdName,preferredName,status,tags,notes\\n';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'faithflow-member-import-template.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadHouseholdTemplate = () => {
    const template = 'name,primaryEmail,primaryPhone,memberEmails\\nFamily Doe,primary@example.com,+15551234567,\"member1@example.com;member2@example.com\"\\n';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'faithflow-household-import-template.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const addStaffAttachment = () => {
    const url = staffAttachmentUrl.trim();
    if (!url) return;
    setPendingStaffAttachments((prev) => {
      if (prev.some((entry) => entry.url === url)) return prev;
      return [...prev, { url, name: staffAttachmentName.trim() || undefined }];
    });
    setStaffAttachmentUrl('');
    setStaffAttachmentName('');
  };

  const removeStaffAttachment = (url: string) => {
    setPendingStaffAttachments((prev) => prev.filter((entry) => entry.url !== url));
  };

  const handleStaffAttachmentFile = async (file?: File | null) => {
    if (!file || uploadingStaffAttachment) return;
    setUploadingStaffAttachment(true);
    try {
      const upload = await createUpload({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        purpose: 'message-attachments',
        churchId: churchId || undefined,
      });

      await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });

      setPendingStaffAttachments((prev) => [
        ...prev,
        { url: upload.publicUrl, name: file.name, assetId: upload.assetId },
      ]);
    } catch (error) {
      console.error('Failed to upload attachment', error);
    } finally {
      setUploadingStaffAttachment(false);
    }
  };

  const { mutate: createMember, isPending } = trpc.member.create.useMutation({
    onSuccess: async () => {
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      await utils.member.list.invalidate();
    },
  });

  const { mutate: deleteMember } = trpc.member.delete.useMutation({
    onSuccess: async () => {
      await utils.member.list.invalidate();
    },
  });

  const { mutate: updateMember } = trpc.member.update.useMutation({
    onSuccess: async () => {
      await utils.member.list.invalidate();
      await utils.member.profile.invalidate();
    },
  });

  const { mutate: createHousehold } = trpc.household.create.useMutation({
    onSuccess: async () => {
      setHouseholdName('');
      setPrimaryMemberId('');
      await utils.household.list.invalidate();
    },
  });

  const { mutate: assignHousehold } = trpc.household.addMember.useMutation({
    onSuccess: async () => {
      await utils.member.list.invalidate();
      await utils.member.profile.invalidate();
      await utils.household.list.invalidate();
    },
  });

  const { mutate: createGroup } = trpc.group.create.useMutation({
    onSuccess: async () => {
      setGroupName('');
      await utils.group.list.invalidate();
    },
  });

  const { mutate: addGroupMember } = trpc.group.addMember.useMutation({
    onSuccess: async () => {
      await utils.group.list.invalidate();
      await utils.member.profile.invalidate();
    },
  });

  const { mutate: createTag } = trpc.memberTag.create.useMutation({
    onSuccess: async () => {
      setTagName('');
      setTagColor('');
      await utils.memberTag.list.invalidate();
    },
  });

  const { mutate: assignTag } = trpc.memberTag.assign.useMutation({
    onSuccess: async () => {
      await utils.member.profile.invalidate();
      await utils.member.list.invalidate();
    },
  });

  const { mutate: createMilestone } = trpc.memberMilestone.create.useMutation({
    onSuccess: async () => {
      setMilestoneDate('');
      setMilestoneNotes('');
      await utils.member.profile.invalidate();
    },
  });

  const { mutate: createVolunteerRole } = trpc.volunteer.createRole.useMutation({
    onSuccess: async () => {
      setVolunteerRoleName('');
      setVolunteerRoleDescription('');
      await utils.volunteer.listRoles.invalidate();
    },
  });

  const { mutate: assignVolunteer } = trpc.volunteer.assignMember.useMutation({
    onSuccess: async () => {
      await utils.volunteer.listRoles.invalidate();
      await utils.member.profile.invalidate();
    },
  });

  const { mutate: createWorkflow } = trpc.onboarding.createWorkflow.useMutation({
    onSuccess: async () => {
      setWorkflowName('');
      setWorkflowDescription('');
      await utils.onboarding.listWorkflows.invalidate();
    },
  });

  const { mutate: createStep } = trpc.onboarding.createStep.useMutation({
    onSuccess: async () => {
      setStepName('');
      await utils.onboarding.listSteps.invalidate();
      await utils.onboarding.listWorkflows.invalidate();
    },
  });

  const { mutate: assignWorkflow } = trpc.onboarding.assignMember.useMutation({
    onSuccess: async () => {
      await utils.onboarding.memberAssignments.invalidate();
    },
  });

  const { mutate: createGroupEvent } = trpc.event.create.useMutation({
    onSuccess: async () => {
      setGroupEventTitle('');
      setGroupEventStart('');
      setGroupEventEnd('');
      setGroupEventLocation('');
      await utils.event.list.invalidate();
    },
  });

  const { mutate: createShift } = trpc.volunteer.createShift.useMutation({
    onSuccess: async () => {
      setShiftTitle('');
      setShiftDescription('');
      setShiftStart('');
      setShiftEnd('');
      setShiftCapacity('');
      await utils.volunteer.listShifts.invalidate();
    },
  });

  const { mutate: assignShift } = trpc.volunteer.assignShift.useMutation({
    onSuccess: async () => {
      await utils.volunteer.listShifts.invalidate();
      await utils.member.profile.invalidate();
    },
  });

  const { mutate: createRelationship } = trpc.relationship.create.useMutation({
    onSuccess: async () => {
      setRelationshipLabel('');
      setRelationshipNotes('');
      await utils.relationship.listForMember.invalidate();
    },
  });

  const { mutate: deleteRelationship } = trpc.relationship.delete.useMutation({
    onSuccess: async () => {
      await utils.relationship.listForMember.invalidate();
    },
  });

  const { mutate: setAvailability } = trpc.volunteer.setAvailability.useMutation({
    onSuccess: async () => {
      setAvailabilityNotes('');
      await utils.volunteer.listAvailability.invalidate();
    },
  });

  const { mutate: deleteAvailability } = trpc.volunteer.deleteAvailability.useMutation({
    onSuccess: async () => {
      await utils.volunteer.listAvailability.invalidate();
    },
  });

  const { mutate: createSurvey } = trpc.survey.createSurvey.useMutation({
    onSuccess: async () => {
      setSurveyTitle('');
      setSurveyDescription('');
      await utils.survey.listSurveys.invalidate();
    },
  });

  const { mutate: addSurveyQuestion } = trpc.survey.addQuestion.useMutation({
    onSuccess: async () => {
      setSurveyQuestionPrompt('');
      setSurveyQuestionOptions('');
      await utils.survey.listSurveys.invalidate();
    },
  });

  const { mutate: importMembers, isPending: isImportingMembers } = trpc.member.importCsv.useMutation({
    onSuccess: (data) => {
      setImportSummary(data);
      utils.member.list.invalidate();
    },
  });

  const { mutate: rollbackImport, isPending: isRollingBackImport } = trpc.member.rollbackImport.useMutation({
    onSuccess: async (data) => {
      setImportSummary((prev: any) => ({
        ...(prev ?? {}),
        rolledBack: true,
        rollback: data,
      }));
      await utils.member.list.invalidate();
    },
  });

  const { mutate: importHouseholds, isPending: isImportingHouseholds } = trpc.household.importCsv.useMutation({
    onSuccess: (data) => {
      setHouseholdImportSummary(data);
      utils.household.list.invalidate();
    },
  });

  const { mutate: rollbackHouseholdImport, isPending: isRollingBackHouseholds } = trpc.household.rollbackImport.useMutation({
    onSuccess: async (data) => {
      setHouseholdImportSummary((prev: any) => ({
        ...(prev ?? {}),
        rolledBack: true,
        rollback: data,
      }));
      await utils.household.list.invalidate();
    },
  });

  const { mutateAsync: ensureStaffThread } = trpc.messaging.staffThread.useMutation();
  const { mutateAsync: createUpload } = trpc.storage.createUpload.useMutation();

  const { mutate: sendStaffMessage } = trpc.messaging.sendMessage.useMutation({
    onSuccess: async () => {
      setStaffMessageBody('');
      setStaffAttachmentUrl('');
      setStaffAttachmentName('');
      setPendingStaffAttachments([]);
      await utils.messaging.listMessages.invalidate();
    },
  });

  const selectedChurch = useMemo(
    () => churches?.find((church) => church.id === churchId),
    [churches, churchId]
  );

  useEffect(() => {
    if (!groupIdForEvent && groups?.length) {
      setGroupIdForEvent(groups[0].id);
    }
  }, [groupIdForEvent, groups]);

  useEffect(() => {
    if (!shiftRoleId && volunteerRoles?.length) {
      setShiftRoleId(volunteerRoles[0].id);
    }
  }, [shiftRoleId, volunteerRoles]);

  useEffect(() => {
    if (!availabilityRoleId && volunteerRoles?.length) {
      setAvailabilityRoleId(volunteerRoles[0].id);
    }
  }, [availabilityRoleId, volunteerRoles]);

  useEffect(() => {
    if (!surveyIdForQuestion && surveys?.length) {
      setSurveyIdForQuestion(surveys[0].id);
    }
    if (!surveySummaryId && surveys?.length) {
      setSurveySummaryId(surveys[0].id);
    }
  }, [surveyIdForQuestion, surveySummaryId, surveys]);

  useEffect(() => {
    if (!workflowIdForStep && workflows?.length) {
      setWorkflowIdForStep(workflows[0].id);
    }
    if (!assignWorkflowId && workflows?.length) {
      setAssignWorkflowId(workflows[0].id);
    }
  }, [assignWorkflowId, workflowIdForStep, workflows]);

  useEffect(() => {
    if (memberProfile?.member) {
      setDirectoryVisibility(memberProfile.member.directoryVisibility ?? 'MEMBERS_ONLY');
      setShowEmail(Boolean(memberProfile.member.showEmailInDirectory));
      setShowPhone(Boolean(memberProfile.member.showPhoneInDirectory));
      setShowAddress(Boolean(memberProfile.member.showAddressInDirectory));
      setShowPhoto(Boolean(memberProfile.member.showPhotoInDirectory));
      setClerkUserId(memberProfile.member.clerkUserId ?? '');
    }
  }, [memberProfile]);

  useEffect(() => {
    const run = async () => {
      if (!selectedMemberId || !churchId) return;
      const conversation = await ensureStaffThread({ churchId, memberId: selectedMemberId });
      setStaffConversationId(conversation.id);
    };
    run();
  }, [churchId, ensureStaffThread, selectedMemberId]);

  useEffect(() => {
    if (selectedMemberId && members?.length) {
      const candidate = members.find((member) => member.id !== selectedMemberId);
      if (candidate) {
        setRelationshipToMemberId(candidate.id);
      }
    }
  }, [members, selectedMemberId]);

  return (
    <Shell>
      {!gate.isLoading && gate.access === 'locked' ? (
        <FeatureLocked
          featureKey="membership_enabled"
          title="Membership is locked"
          description="Your current subscription does not include membership management. Upgrade to restore access."
        />
      ) : (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Members</h1>
          <p className="mt-2 text-muted">
            Manage your congregation with accurate profiles and status tracking.
          </p>
        </div>

        {gate.readOnly ? <ReadOnlyNotice /> : null}

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
          <h2 className="text-lg font-semibold">Add member</h2>
          <p className="mt-1 text-sm text-muted">
            {selectedChurch ? `Adding members to ${selectedChurch.name}.` : 'Select a church first.'}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="mt-4">
            <Button
              onClick={() =>
                createMember({
                  churchId,
                  firstName,
                  lastName,
                  email: email || undefined,
                  phone: phone || undefined,
                })
              }
              disabled={!canWrite || !churchId || !firstName || !lastName || isPending}
            >
              {isPending ? 'Saving…' : 'Save member'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Member analytics</h2>
              <p className="mt-1 text-sm text-muted">Engagement, attendance, and giving signals.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="text-xs uppercase text-muted">Lookback days</span>
              <Input
                className="h-8 w-24"
                value={analyticsLookbackDays}
                onChange={(e) => setAnalyticsLookbackDays(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border p-3 text-sm text-muted">
              <p className="text-xs uppercase text-muted">Total members</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{memberAnalytics?.totalMembers ?? 0}</p>
            </div>
            <div className="rounded-md border border-border p-3 text-sm text-muted">
              <p className="text-xs uppercase text-muted">Active members</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{memberAnalytics?.activeMembers ?? 0}</p>
            </div>
            <div className="rounded-md border border-border p-3 text-sm text-muted">
              <p className="text-xs uppercase text-muted">New members</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{memberAnalytics?.newMembers ?? 0}</p>
            </div>
            <div className="rounded-md border border-border p-3 text-sm text-muted">
              <p className="text-xs uppercase text-muted">Recent attendance</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{memberAnalytics?.recentAttendance ?? 0}</p>
            </div>
            <div className="rounded-md border border-border p-3 text-sm text-muted">
              <p className="text-xs uppercase text-muted">Recent donors</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{memberAnalytics?.recentDonors ?? 0}</p>
            </div>
            <div className="rounded-md border border-border p-3 text-sm text-muted">
              <p className="text-xs uppercase text-muted">Volunteers</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{memberAnalytics?.volunteers ?? 0}</p>
            </div>
            <div className="rounded-md border border-border p-3 text-sm text-muted">
              <p className="text-xs uppercase text-muted">Group members</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{memberAnalytics?.groupMembers ?? 0}</p>
            </div>
            <div className="rounded-md border border-border p-3 text-sm text-muted">
              <p className="text-xs uppercase text-muted">Lapsed members</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{memberAnalytics?.lapsedMembers ?? 0}</p>
            </div>
            <div className="rounded-md border border-border p-3 text-sm text-muted">
              <p className="text-xs uppercase text-muted">Missing contact</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{memberAnalytics?.missingContact ?? 0}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
            {(membershipEngagement?.statusCounts ?? []).map((entry) => (
              <Badge key={entry.status ?? 'UNKNOWN'} variant="default">
                {entry.status ?? 'UNKNOWN'}: {(entry as any)?._count?._all ?? (entry as any)?._count ?? 0}
              </Badge>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Member segments</h2>
              <p className="mt-1 text-sm text-muted">Targeted cohorts for follow-up and care.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="text-xs uppercase text-muted">Lookback</span>
              <Input
                className="h-8 w-24"
                value={segmentLookbackDays}
                onChange={(e) => setSegmentLookbackDays(e.target.value)}
              />
              <span className="text-xs uppercase text-muted">Limit</span>
              <Input
                className="h-8 w-20"
                value={segmentLimit}
                onChange={(e) => setSegmentLimit(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(memberSegments ?? []).map((segment) => (
              <div key={segment.key} className="rounded-md border border-border p-3 text-sm text-muted">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{segment.label}</p>
                  <Badge variant="default">{segment.count}</Badge>
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted">
                  {(segment.members ?? []).map((member) => (
                    <div key={member.id} className="flex items-center justify-between gap-2">
                      <span>
                        {member.preferredName ?? member.firstName} {member.lastName}
                      </span>
                      <span>{member.email ?? member.phone ?? '—'}</span>
                    </div>
                  ))}
                  {!segment.members?.length && <p>No members listed.</p>}
                </div>
              </div>
            ))}
            {!memberSegments?.length && <p className="text-sm text-muted">No segments available yet.</p>}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Member list</h2>
            <Badge variant="default">{members?.length ?? 0} total</Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Search members"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-muted">
                <tr className="text-left">
                  <th className="py-2">Name</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Phone</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Household</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members?.map((member) => (
                  <tr key={member.id} className="border-t border-border">
                    <td className="py-2">{member.firstName} {member.lastName}</td>
                    <td className="py-2">{member.email ?? '—'}</td>
                    <td className="py-2">{member.phone ?? '—'}</td>
                    <td className="py-2">
                      <Badge variant="success">{member.status}</Badge>
                    </td>
                    <td className="py-2">{member.household?.name ?? '—'}</td>
                    <td className="py-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedMemberId(member.id)}
                      >
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canWrite}
                        onClick={() => {
                          if (confirm('Delete this member?')) {
                            deleteMember({ id: member.id });
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
          <h2 className="text-lg font-semibold">Member import</h2>
          <p className="mt-1 text-sm text-muted">
            Import members from CSV. Supports firstName, lastName, email, phone, householdName, preferredName, status,
            tags, and notes.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              type="file"
              accept=".csv"
              onChange={(event) => handleImportFile(event.target.files?.[0])}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={handleDownloadTemplate}>
                Download template
              </Button>
              <Badge variant="default">{importFilename || 'No file selected'}</Badge>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => importMembers({ churchId, csv: importCsv, dryRun: true })}
              disabled={!canWrite || !churchId || !importCsv || isImportingMembers}
            >
              {isImportingMembers ? 'Processing…' : 'Dry run'}
            </Button>
            <Button
              onClick={() => importMembers({ churchId, csv: importCsv })}
              disabled={!canWrite || !churchId || !importCsv || isImportingMembers}
            >
              {isImportingMembers ? 'Importing…' : 'Import members'}
            </Button>
            {importSummary?.batchId ? (
              <Button
                variant="outline"
                onClick={() => rollbackImport({ batchId: importSummary.batchId })}
                disabled={!canWrite || isRollingBackImport || importSummary?.rolledBack}
              >
                {importSummary?.rolledBack ? 'Rolled back' : isRollingBackImport ? 'Rolling back…' : 'Rollback import batch'}
              </Button>
            ) : null}
          </div>
          <div className="mt-4 text-sm text-muted">
            <pre className="rounded-md bg-muted/10 p-3 text-xs whitespace-pre-wrap">
              {importSummary ? JSON.stringify(importSummary, null, 2) : 'No import summary yet.'}
            </pre>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Member profile</h2>
          <p className="mt-1 text-sm text-muted">
            {selectedMemberId ? 'Profile overview and engagement.' : 'Select a member to view details.'}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Clerk user id"
              value={clerkUserId}
              onChange={(e) => setClerkUserId(e.target.value)}
            />
            <Button
              onClick={() => {
                if (selectedMemberId) {
                  updateMember({ id: selectedMemberId, data: { clerkUserId: clerkUserId || undefined } });
                }
              }}
              disabled={!canWrite || !selectedMemberId}
            >
              Link Clerk user
            </Button>
          </div>
          <div className="mt-4 text-sm text-muted">
            <pre className="rounded-md bg-muted/10 p-3 text-xs whitespace-pre-wrap">
              {JSON.stringify(memberProfile ?? {}, null, 2)}
            </pre>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Member messaging</h2>
          <p className="mt-1 text-sm text-muted">
            Send direct messages from church staff to the selected member.
          </p>
          <div className="mt-4 space-y-3">
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-border p-3 text-sm text-muted">
              {orderedStaffMessages.map((message) => (
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
              {!orderedStaffMessages.length && <p className="text-sm text-muted">No messages yet.</p>}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Write a message"
                value={staffMessageBody}
                disabled={!canWrite}
                onChange={(e) => setStaffMessageBody(e.target.value)}
              />
              <Button
                onClick={() => {
                  if (staffConversationId && staffMessageBody.trim()) {
                    const pending = pendingStaffAttachments.length
                      ? pendingStaffAttachments
                      : staffAttachmentUrl.trim()
                        ? [{ url: staffAttachmentUrl.trim(), name: staffAttachmentName.trim() || undefined }]
                        : undefined;
                    sendStaffMessage({
                      conversationId: staffConversationId,
                      body: staffMessageBody.trim(),
                      attachments: pending,
                      asStaff: true,
                    });
                  }
                }}
                disabled={!canWrite || !staffConversationId || !staffMessageBody.trim()}
              >
                Send
              </Button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <Input
                placeholder="Attachment URL"
                value={staffAttachmentUrl}
                onChange={(e) => setStaffAttachmentUrl(e.target.value)}
              />
              <Input
                placeholder="Label (optional)"
                value={staffAttachmentName}
                onChange={(e) => setStaffAttachmentName(e.target.value)}
              />
              <Button variant="outline" onClick={addStaffAttachment} disabled={!canWrite || !staffAttachmentUrl.trim()}>
                Add attachment
              </Button>
              <Input
                type="file"
                disabled={!canWrite || uploadingStaffAttachment}
                onChange={(e) => handleStaffAttachmentFile(e.target.files?.[0])}
              />
            </div>
            {pendingStaffAttachments.length ? (
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                {pendingStaffAttachments.map((attachment) => (
                  <div key={attachment.url} className="flex items-center gap-2 rounded-md border border-border px-2 py-1">
                    <span className="truncate">{attachment.name ?? attachment.url}</span>
                    <Button size="sm" variant="outline" disabled={!canWrite} onClick={() => removeStaffAttachment(attachment.url)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Member relationships</h2>
          <p className="mt-1 text-sm text-muted">Build relationship graphs for pastoral care.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={relationshipToMemberId}
              onChange={(e) => setRelationshipToMemberId(e.target.value)}
            >
              <option value="">Select related member</option>
              {members
                ?.filter((member) => member.id !== selectedMemberId)
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.firstName} {member.lastName}
                  </option>
                ))}
            </select>
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={relationshipType}
              onChange={(e) => setRelationshipType(e.target.value)}
            >
              <option value="SPOUSE">Spouse</option>
              <option value="PARENT">Parent</option>
              <option value="CHILD">Child</option>
              <option value="SIBLING">Sibling</option>
              <option value="GUARDIAN">Guardian</option>
              <option value="MENTOR">Mentor</option>
              <option value="DISCIPLE">Disciple</option>
              <option value="FRIEND">Friend</option>
              <option value="CAREGIVER">Caregiver</option>
              <option value="EMERGENCY_CONTACT">Emergency contact</option>
              <option value="OTHER">Other</option>
            </select>
            <Input
              placeholder="Custom label (optional)"
              value={relationshipLabel}
              onChange={(e) => setRelationshipLabel(e.target.value)}
            />
            <Input
              placeholder="Notes (optional)"
              value={relationshipNotes}
              onChange={(e) => setRelationshipNotes(e.target.value)}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={relationshipReciprocal}
                onChange={(e) => setRelationshipReciprocal(e.target.checked)}
              />
              Create reciprocal relationship
            </label>
          </div>
          <div className="mt-4">
            <Button
              onClick={() => {
                if (selectedMemberId && relationshipToMemberId && churchId) {
                  createRelationship({
                    churchId,
                    fromMemberId: selectedMemberId,
                    toMemberId: relationshipToMemberId,
                    type: relationshipType as any,
                    label: relationshipLabel || undefined,
                    notes: relationshipNotes || undefined,
                    createReciprocal: relationshipReciprocal,
                  });
                }
              }}
              disabled={!selectedMemberId || !relationshipToMemberId}
            >
              Add relationship
            </Button>
          </div>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {relationships?.map((relationship) => {
              const isOutgoing = relationship.fromMemberId === selectedMemberId;
              const other = isOutgoing ? relationship.toMember : relationship.fromMember;
              return (
                <div key={relationship.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {other.firstName} {other.lastName}
                      </p>
                      <p className="text-xs text-muted">
                        {isOutgoing ? 'You →' : 'You ←'} {relationship.type}
                      </p>
                      {relationship.label ? <p className="text-xs text-muted">{relationship.label}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">{relationship.type}</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteRelationship({ id: relationship.id })}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {!relationships?.length && <p className="text-sm text-muted">No relationships yet.</p>}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Directory privacy</h2>
          <p className="mt-1 text-sm text-muted">Control visibility for the selected member.</p>
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
              onClick={() => {
                if (selectedMemberId) {
                  updateMember({
                    id: selectedMemberId,
                    data: {
                      directoryVisibility: directoryVisibility as any,
                      showEmailInDirectory: showEmail,
                      showPhoneInDirectory: showPhone,
                      showAddressInDirectory: showAddress,
                      showPhotoInDirectory: showPhoto,
                    },
                  });
                }
              }}
              disabled={!selectedMemberId}
            >
              Update privacy
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Directory preview</h2>
            <Badge variant="default">{filteredDirectory.length} shown</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            Preview visibility as a leader. Masks reflect member privacy settings.
          </p>
          <div className="mt-4">
            <Input
              placeholder="Search directory"
              value={directorySearch}
              onChange={(event) => setDirectorySearch(event.target.value)}
            />
          </div>
          <div className="mt-4 space-y-3 text-sm">
            {filteredDirectory.map((member) => (
              <div key={member.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">
                      {member.firstName} {member.lastName}
                    </p>
                    {member.preferredName ? (
                      <p className="text-xs text-muted">Preferred: {member.preferredName}</p>
                    ) : null}
                    <div className="mt-2 space-y-1 text-xs text-muted">
                      <p>Email: {member.email ?? 'Hidden'}</p>
                      <p>Phone: {member.phone ?? 'Hidden'}</p>
                      <p>
                        Address:{' '}
                        {[
                          member.addressLine1,
                          member.addressLine2,
                          member.city,
                          member.state,
                          member.postalCode,
                          member.country,
                        ]
                          .filter(Boolean)
                          .join(', ') || 'Hidden'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="default">{member.directoryVisibility}</Badge>
                    <Badge variant={member.showEmailInDirectory ? 'success' : 'warning'}>
                      Email {member.showEmailInDirectory ? 'Visible' : 'Hidden'}
                    </Badge>
                    <Badge variant={member.showPhoneInDirectory ? 'success' : 'warning'}>
                      Phone {member.showPhoneInDirectory ? 'Visible' : 'Hidden'}
                    </Badge>
                    <Badge variant={member.showAddressInDirectory ? 'success' : 'warning'}>
                      Address {member.showAddressInDirectory ? 'Visible' : 'Hidden'}
                    </Badge>
                    <Badge variant={member.showPhotoInDirectory ? 'success' : 'warning'}>
                      Photo {member.showPhotoInDirectory ? 'Visible' : 'Hidden'}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
            {!filteredDirectory.length && <p className="text-sm text-muted">No directory entries yet.</p>}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Households</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input placeholder="Household name" value={householdName} onChange={(e) => setHouseholdName(e.target.value)} />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={primaryMemberId}
              onChange={(e) => setPrimaryMemberId(e.target.value)}
            >
              <option value="">Primary member (optional)</option>
              {members?.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() =>
                createHousehold({
                  churchId,
                  name: householdName || undefined,
                  primaryMemberId: primaryMemberId || undefined,
                })
              }
              disabled={!churchId || !householdName}
            >
              Create household
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (selectedMemberId && households?.length) {
                  assignHousehold({ householdId: households[0].id, memberId: selectedMemberId });
                }
              }}
              disabled={!selectedMemberId || !households?.length}
            >
              Assign selected member to first household
            </Button>
          </div>

          <div className="mt-8 border-t border-border pt-6">
            <h3 className="text-base font-semibold">Household import</h3>
            <p className="mt-1 text-sm text-muted">Import households from CSV (name, primaryEmail/primaryPhone, memberEmails).</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input type="file" accept=".csv" onChange={(event) => handleHouseholdImportFile(event.target.files?.[0])} />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={handleDownloadHouseholdTemplate}>
                  Download template
                </Button>
                <Badge variant="default">{householdImportFilename || 'No file selected'}</Badge>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => importHouseholds({ churchId, csv: householdImportCsv, dryRun: true })}
                disabled={!churchId || !householdImportCsv || isImportingHouseholds}
              >
                {isImportingHouseholds ? 'Processing…' : 'Dry run'}
              </Button>
              <Button
                onClick={() => importHouseholds({ churchId, csv: householdImportCsv })}
                disabled={!churchId || !householdImportCsv || isImportingHouseholds}
              >
                {isImportingHouseholds ? 'Importing…' : 'Import households'}
              </Button>
              {householdImportSummary?.batchId ? (
                <Button
                  variant="outline"
                  onClick={() => rollbackHouseholdImport({ batchId: householdImportSummary.batchId })}
                  disabled={!canWrite || isRollingBackHouseholds || householdImportSummary?.rolledBack}
                >
                  {householdImportSummary?.rolledBack
                    ? 'Rolled back'
                    : isRollingBackHouseholds
                      ? 'Rolling back…'
                      : 'Rollback import batch'}
                </Button>
              ) : null}
            </div>
            <div className="mt-4 text-sm text-muted">
              <pre className="rounded-md bg-muted/10 p-3 text-xs whitespace-pre-wrap">
                {householdImportSummary ? JSON.stringify(householdImportSummary, null, 2) : 'No household import summary yet.'}
              </pre>
            </div>
          </div>

          <div className="mt-4 text-sm text-muted">
            <pre className="rounded-md bg-muted/10 p-3 text-xs">
              {JSON.stringify(households ?? [], null, 2)}
            </pre>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Onboarding workflows</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input placeholder="Workflow name" value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} />
            <Input
              placeholder="Description"
              value={workflowDescription}
              onChange={(e) => setWorkflowDescription(e.target.value)}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() =>
                createWorkflow({
                  churchId,
                  name: workflowName,
                  description: workflowDescription || undefined,
                })
              }
              disabled={!churchId || !workflowName}
            >
              Create workflow
            </Button>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={workflowIdForStep}
              onChange={(e) => setWorkflowIdForStep(e.target.value)}
            >
              {workflows?.map((workflow) => (
                <option key={workflow.id} value={workflow.id}>
                  {workflow.name}
                </option>
              ))}
            </select>
            <Input placeholder="Step name" value={stepName} onChange={(e) => setStepName(e.target.value)} />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={stepType}
              onChange={(e) => setStepType(e.target.value)}
            >
              <option value="WELCOME_CALL">Welcome call</option>
              <option value="CLASS">Class</option>
              <option value="PROFILE_SETUP">Profile setup</option>
              <option value="GROUP_ASSIGNMENT">Group assignment</option>
              <option value="VOLUNTEER_ONBOARDING">Volunteer onboarding</option>
              <option value="OTHER">Other</option>
            </select>
            <Input placeholder="Order" value={stepOrder} onChange={(e) => setStepOrder(e.target.value)} />
            <Input placeholder="Due days" value={stepDueDays} onChange={(e) => setStepDueDays(e.target.value)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() =>
                createStep({
                  workflowId: workflowIdForStep,
                  name: stepName,
                  type: stepType as any,
                  order: Number(stepOrder || '1'),
                  dueDays: stepDueDays ? Number(stepDueDays) : undefined,
                })
              }
              disabled={!workflowIdForStep || !stepName}
            >
              Add step
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (selectedMemberId && assignWorkflowId) {
                  assignWorkflow({ memberId: selectedMemberId, workflowId: assignWorkflowId });
                }
              }}
              disabled={!selectedMemberId || !assignWorkflowId}
            >
              Assign workflow to selected member
            </Button>
          </div>
          <div className="mt-4 text-sm text-muted">
            <pre className="rounded-md bg-muted/10 p-3 text-xs">
              {JSON.stringify(workflows ?? [], null, 2)}
            </pre>
            <div className="mt-4">
              <p className="text-xs text-muted">Assignments</p>
              <pre className="rounded-md bg-muted/10 p-3 text-xs">
                {JSON.stringify(onboardingAssignments ?? [], null, 2)}
              </pre>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Groups & ministries</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Input placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={groupType}
              onChange={(e) => setGroupType(e.target.value)}
            >
              <option value="SMALL_GROUP">Small group</option>
              <option value="MINISTRY">Ministry</option>
              <option value="TEAM">Team</option>
              <option value="CLASS">Class</option>
            </select>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() =>
                createGroup({
                  churchId,
                  name: groupName,
                  type: groupType as any,
                })
              }
              disabled={!churchId || !groupName}
            >
              Create group
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (selectedMemberId && groups?.length) {
                  addGroupMember({ groupId: groups[0].id, memberId: selectedMemberId });
                }
              }}
              disabled={!selectedMemberId || !groups?.length}
            >
              Add selected member to first group
            </Button>
          </div>
          <div className="mt-4 text-sm text-muted">
            <pre className="rounded-md bg-muted/10 p-3 text-xs">
              {JSON.stringify(groups ?? [], null, 2)}
            </pre>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Group events</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={groupIdForEvent}
              onChange={(e) => setGroupIdForEvent(e.target.value)}
            >
              {groups?.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <Input placeholder="Event title" value={groupEventTitle} onChange={(e) => setGroupEventTitle(e.target.value)} />
            <Input placeholder="Start (YYYY-MM-DDTHH:mm)" value={groupEventStart} onChange={(e) => setGroupEventStart(e.target.value)} />
            <Input placeholder="End (YYYY-MM-DDTHH:mm)" value={groupEventEnd} onChange={(e) => setGroupEventEnd(e.target.value)} />
            <Input placeholder="Location" value={groupEventLocation} onChange={(e) => setGroupEventLocation(e.target.value)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (groupIdForEvent && groupEventTitle && groupEventStart && groupEventEnd) {
                  createGroupEvent({
                    churchId,
                    groupId: groupIdForEvent,
                    title: groupEventTitle,
                    startAt: groupEventStart,
                    endAt: groupEventEnd,
                    location: groupEventLocation || undefined,
                  });
                }
              }}
              disabled={!churchId || !groupIdForEvent || !groupEventTitle || !groupEventStart || !groupEventEnd}
            >
              Schedule group event
            </Button>
          </div>
          <div className="mt-4 text-sm text-muted">
            <pre className="rounded-md bg-muted/10 p-3 text-xs">
              {JSON.stringify(groupEvents ?? [], null, 2)}
            </pre>
            <div className="mt-4">
              <p className="text-xs text-muted">Group engagement</p>
              <pre className="rounded-md bg-muted/10 p-3 text-xs">
                {JSON.stringify(groupEngagement ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Tags</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input placeholder="Tag name" value={tagName} onChange={(e) => setTagName(e.target.value)} />
            <Input placeholder="Color (hex)" value={tagColor} onChange={(e) => setTagColor(e.target.value)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => createTag({ churchId, name: tagName, color: tagColor || undefined })}
              disabled={!churchId || !tagName}
            >
              Create tag
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (selectedMemberId && tags?.length) {
                  assignTag({ memberId: selectedMemberId, tagId: tags[0].id });
                }
              }}
              disabled={!selectedMemberId || !tags?.length}
            >
              Tag selected member with first tag
            </Button>
          </div>
          <div className="mt-4 text-sm text-muted">
            <pre className="rounded-md bg-muted/10 p-3 text-xs">
              {JSON.stringify(tags ?? [], null, 2)}
            </pre>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Milestones</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={milestoneType}
              onChange={(e) => setMilestoneType(e.target.value)}
            >
              <option value="BAPTISM">Baptism</option>
              <option value="CONFIRMATION">Confirmation</option>
              <option value="MEMBERSHIP">Membership</option>
              <option value="SALVATION">Salvation</option>
              <option value="FIRST_COMMUNION">First Communion</option>
              <option value="OTHER">Other</option>
            </select>
            <Input placeholder="YYYY-MM-DD" value={milestoneDate} onChange={(e) => setMilestoneDate(e.target.value)} />
            <Input placeholder="Notes" value={milestoneNotes} onChange={(e) => setMilestoneNotes(e.target.value)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (selectedMemberId && milestoneDate) {
                  createMilestone({
                    memberId: selectedMemberId,
                    type: milestoneType as any,
                    date: new Date(milestoneDate),
                    notes: milestoneNotes || undefined,
                  });
                }
              }}
              disabled={!selectedMemberId || !milestoneDate}
            >
              Add milestone
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Volunteer roles</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Role name"
              value={volunteerRoleName}
              onChange={(e) => setVolunteerRoleName(e.target.value)}
            />
            <Input
              placeholder="Description"
              value={volunteerRoleDescription}
              onChange={(e) => setVolunteerRoleDescription(e.target.value)}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() =>
                createVolunteerRole({
                  churchId,
                  name: volunteerRoleName,
                  description: volunteerRoleDescription || undefined,
                })
              }
              disabled={!churchId || !volunteerRoleName}
            >
              Create volunteer role
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (selectedMemberId && volunteerRoles?.length) {
                  assignVolunteer({ roleId: volunteerRoles[0].id, memberId: selectedMemberId });
                }
              }}
              disabled={!selectedMemberId || !volunteerRoles?.length}
            >
              Assign selected member to first role
            </Button>
          </div>
          <div className="mt-4 text-sm text-muted">
            <pre className="rounded-md bg-muted/10 p-3 text-xs">
              {JSON.stringify(volunteerRoles ?? [], null, 2)}
            </pre>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Volunteer availability</h2>
          <p className="mt-1 text-sm text-muted">
            Capture when the selected member is available to serve.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
              onClick={() => {
                if (selectedMemberId && churchId) {
                  setAvailability({
                    churchId,
                    memberId: selectedMemberId,
                    roleId: availabilityRoleId || undefined,
                    dayOfWeek: availabilityDay as any,
                    startTime: availabilityStart,
                    endTime: availabilityEnd,
                    notes: availabilityNotes || undefined,
                  });
                }
              }}
              disabled={!selectedMemberId || !churchId || !availabilityDay || !availabilityStart || !availabilityEnd}
            >
              Save availability
            </Button>
          </div>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {availability?.map((slot) => (
              <div key={slot.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">
                      {slot.dayOfWeek} · {slot.startTime} - {slot.endTime}
                    </p>
                    <p className="text-xs text-muted">{slot.role?.name ?? 'Any role'}</p>
                    {slot.notes ? <p className="text-xs text-muted">{slot.notes}</p> : null}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteAvailability({ id: slot.id })}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            {!availability?.length && <p className="text-sm text-muted">No availability recorded.</p>}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Volunteer shifts</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={shiftRoleId}
              onChange={(e) => setShiftRoleId(e.target.value)}
            >
              {volunteerRoles?.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <Input placeholder="Shift title" value={shiftTitle} onChange={(e) => setShiftTitle(e.target.value)} />
            <Input
              placeholder="Start (YYYY-MM-DDTHH:mm)"
              value={shiftStart}
              onChange={(e) => setShiftStart(e.target.value)}
            />
            <Input
              placeholder="End (YYYY-MM-DDTHH:mm)"
              value={shiftEnd}
              onChange={(e) => setShiftEnd(e.target.value)}
            />
            <Input
              placeholder="Capacity"
              value={shiftCapacity}
              onChange={(e) => setShiftCapacity(e.target.value)}
            />
            <Input
              placeholder="Description"
              value={shiftDescription}
              onChange={(e) => setShiftDescription(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <Button
              onClick={() =>
                createShift({
                  churchId,
                  roleId: shiftRoleId,
                  title: shiftTitle,
                  description: shiftDescription || undefined,
                  startAt: shiftStart,
                  endAt: shiftEnd,
                  capacity: shiftCapacity ? Number(shiftCapacity) : undefined,
                })
              }
              disabled={!churchId || !shiftRoleId || !shiftTitle || !shiftStart || !shiftEnd}
            >
              Create shift
            </Button>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Filter from (YYYY-MM-DD)"
              value={shiftFilterFrom}
              onChange={(e) => setShiftFilterFrom(e.target.value)}
            />
            <Input
              placeholder="Filter to (YYYY-MM-DD)"
              value={shiftFilterTo}
              onChange={(e) => setShiftFilterTo(e.target.value)}
            />
          </div>
          <div className="mt-4 overflow-x-auto text-sm text-muted">
            <table className="min-w-full">
              <thead className="text-left text-xs uppercase text-muted">
                <tr>
                  <th className="py-2">Shift</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Start</th>
                  <th className="py-2">End</th>
                  <th className="py-2">Assigned</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {volunteerShifts?.map((shift) => {
                  const assigned = shift.assignments?.filter((assignment) => assignment.status !== 'CANCELED').length ?? 0;
                  return (
                    <tr key={shift.id} className="border-t border-border">
                      <td className="py-2">{shift.title}</td>
                      <td className="py-2">{shift.role?.name ?? '—'}</td>
                      <td className="py-2">{new Date(shift.startAt).toLocaleString()}</td>
                      <td className="py-2">{new Date(shift.endAt).toLocaleString()}</td>
                      <td className="py-2">
                        {assigned}{shift.capacity ? ` / ${shift.capacity}` : ''}
                      </td>
                      <td className="py-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (selectedMemberId) {
                              assignShift({ shiftId: shift.id, memberId: selectedMemberId });
                            }
                          }}
                          disabled={!selectedMemberId}
                        >
                          Assign selected member
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!volunteerShifts?.length && <p className="mt-3 text-sm text-muted">No shifts scheduled.</p>}
          </div>
          <div className="mt-6 space-y-3 text-sm text-muted">
            <p className="text-xs uppercase text-muted">Weekly view</p>
            {shiftsByDay.map(([day, items]) => (
              <div key={day} className="rounded-md border border-border p-3">
                <p className="font-medium text-foreground">{day}</p>
                <div className="mt-2 space-y-1 text-xs text-muted">
                  {items.map((shift) => (
                    <div key={shift.id} className="flex items-center justify-between">
                      <span>{shift.title} · {shift.role?.name ?? 'Role'}</span>
                      <span>{new Date(shift.startAt).toLocaleTimeString()} - {new Date(shift.endAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!shiftsByDay.length && <p className="text-sm text-muted">No upcoming shifts.</p>}
          </div>
          <div className="mt-6 space-y-3 text-sm text-muted">
            <p className="text-xs uppercase text-muted">Calendar view (next 14 days)</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {shiftCalendar.map((day) => (
                <div key={day.date.toISOString()} className="rounded-md border border-border p-3">
                  <p className="text-xs font-medium text-foreground">
                    {day.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  <p className="mt-1 text-xs text-muted">{day.shifts.length} shifts</p>
                  <div className="mt-2 space-y-1 text-xs text-muted">
                    {day.shifts.slice(0, 3).map((shift) => (
                      <div key={shift.id} className="flex items-center justify-between">
                        <span className="truncate">{shift.title}</span>
                        <span>{new Date(shift.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))}
                    {day.shifts.length > 3 && <p className="text-xs text-muted">+{day.shifts.length - 3} more</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Staffing gaps</h2>
              <p className="mt-1 text-sm text-muted">
                Shifts within the horizon that still need volunteers.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                className="w-28"
                placeholder="Hours ahead"
                value={gapHoursAhead}
                onChange={(event) => setGapHoursAhead(event.target.value)}
              />
              <Badge variant="default">{staffingGaps?.gaps?.length ?? 0} gaps</Badge>
            </div>
          </div>
          <div className="mt-4 space-y-3 text-sm text-muted">
            {staffingGaps?.gaps?.map((gap) => (
              <div key={gap.shift.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{gap.shift.title}</p>
                    <p className="text-xs text-muted">{gap.shift.role?.name ?? 'Volunteer role'}</p>
                    <p className="text-xs text-muted">
                      {new Date(gap.shift.startAt).toLocaleString()} → {new Date(gap.shift.endAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-xs text-muted">
                    <p>Assigned: {gap.assigned}</p>
                    <p>Capacity: {gap.capacity}</p>
                    <Badge variant="warning">Remaining {gap.remaining}</Badge>
                  </div>
                </div>
              </div>
            ))}
            {!staffingGaps?.gaps?.length && <p className="text-sm text-muted">No staffing gaps right now.</p>}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Surveys</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input placeholder="Survey title" value={surveyTitle} onChange={(e) => setSurveyTitle(e.target.value)} />
            <Input
              placeholder="Description"
              value={surveyDescription}
              onChange={(e) => setSurveyDescription(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <Button
              onClick={() =>
                createSurvey({
                  churchId,
                  title: surveyTitle,
                  description: surveyDescription || undefined,
                  status: 'ACTIVE',
                })
              }
              disabled={!churchId || !surveyTitle}
            >
              Create survey
            </Button>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={surveyIdForQuestion}
              onChange={(e) => setSurveyIdForQuestion(e.target.value)}
            >
              {surveys?.map((survey) => (
                <option key={survey.id} value={survey.id}>
                  {survey.title}
                </option>
              ))}
            </select>
            <Input
              placeholder="Question prompt"
              value={surveyQuestionPrompt}
              onChange={(e) => setSurveyQuestionPrompt(e.target.value)}
            />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={surveyQuestionType}
              onChange={(e) => setSurveyQuestionType(e.target.value)}
            >
              <option value="TEXT">Text</option>
              <option value="SINGLE_CHOICE">Single choice</option>
              <option value="MULTI_CHOICE">Multi choice</option>
              <option value="RATING">Rating</option>
            </select>
            <Input
              placeholder="Order"
              value={surveyQuestionOrder}
              onChange={(e) => setSurveyQuestionOrder(e.target.value)}
            />
            <Input
              placeholder="Options (comma-separated)"
              value={surveyQuestionOptions}
              onChange={(e) => setSurveyQuestionOptions(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <Button
              onClick={() =>
                addSurveyQuestion({
                  surveyId: surveyIdForQuestion,
                  prompt: surveyQuestionPrompt,
                  type: surveyQuestionType as any,
                  order: Number(surveyQuestionOrder || '1'),
                  options: surveyQuestionOptions
                    ? surveyQuestionOptions.split(',').map((value) => value.trim()).filter(Boolean)
                    : undefined,
                })
              }
              disabled={!surveyIdForQuestion || !surveyQuestionPrompt}
            >
              Add question
            </Button>
          </div>
          <div className="mt-6 overflow-x-auto text-sm text-muted">
            <table className="min-w-full">
              <thead className="text-left text-xs uppercase text-muted">
                <tr>
                  <th className="py-2">Survey</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Questions</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {surveys?.map((survey) => (
                  <tr key={survey.id} className="border-t border-border">
                    <td className="py-2">{survey.title}</td>
                    <td className="py-2">{survey.status}</td>
                    <td className="py-2">{survey.questions?.length ?? 0}</td>
                    <td className="py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSurveySummaryId(survey.id)}
                      >
                        View summary
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!surveys?.length && <p className="mt-3 text-sm text-muted">No surveys yet.</p>}
          </div>

          <div className="mt-6 text-sm text-muted">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-muted">Survey analytics</p>
                {surveySummary ? (
                  <p className="mt-1 text-xs text-muted">Total responses: {surveySummary.totalResponses}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-9 rounded-md border border-border bg-white px-3 text-xs"
                  value={surveyAiProvider}
                  onChange={(event) => setSurveyAiProvider(event.target.value)}
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSurveyExport}
                  disabled={!surveySummaryId || isFetchingSurveyExport}
                >
                  {isFetchingSurveyExport ? 'Exporting…' : 'Export CSV'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refetchSurveyAi()}
                  disabled={!surveySummaryId || isFetchingSurveyAi}
                >
                  {isFetchingSurveyAi ? 'Summarizing…' : 'Generate AI summary'}
                </Button>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {surveySummary?.summary?.map((item) => (
                <div key={item.questionId} className="rounded-md border border-border p-3">
                  <p className="font-medium text-foreground">{item.prompt}</p>
                  {item.counts ? (
                    <div className="mt-2 grid gap-1 text-xs">
                      {Object.entries(item.counts).map(([option, count]) => (
                        <div key={option} className="flex items-center justify-between">
                          <span>{option}</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {typeof item.average === 'number' ? (
                    <p className="mt-2 text-xs text-muted">Average rating: {item.average.toFixed(2)}</p>
                  ) : null}
                </div>
              ))}
              {!surveySummary && <p className="text-sm text-muted">Select a survey to view analytics.</p>}
            </div>
            <div className="mt-4 rounded-md border border-border bg-muted/10 p-3 text-xs text-muted">
              <p className="font-medium text-foreground">AI summary</p>
              <p className="mt-2 whitespace-pre-wrap">{surveySummaryAi?.summary ?? 'No summary generated yet.'}</p>
              {surveySummaryAi?.warnings?.length ? (
                <div className="mt-2 space-y-1">
                  {surveySummaryAi.warnings.map((warning) => (
                    <p key={warning}>Warning: {warning}</p>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </Card>
      </div>
      )}
    </Shell>
  );
}
