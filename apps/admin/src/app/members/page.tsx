'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button, Card, Input, Badge, DataTable, type ColumnDef,
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Separator, Label, Textarea, Skeleton, ScrollArea,
} from '@faithflow-ai/ui';
import { trpc } from '../../lib/trpc';
import { Shell } from '../../components/Shell';
import { useFeatureGate } from '../../lib/entitlements';
import { FeatureLocked } from '../../components/FeatureLocked';
import { ReadOnlyNotice } from '../../components/ReadOnlyNotice';
import { EmptyState } from '../../components/EmptyState';
import { analyzeCsvImport } from '../../lib/csvImportPreview';
import {
  UserPlusIcon, ArrowUpTrayIcon, UsersIcon, HomeModernIcon,
  UserGroupIcon, BriefcaseIcon, ChartBarIcon, Cog6ToothIcon,
  TrashIcon, PlusIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

// ─── Import alias maps ───────────────────────────────────────────────────────

const householdImportAliases = {
  name: 'name', household: 'name',
  primarymemberid: 'primaryMemberId', primarymember: 'primaryMemberId',
  primaryemail: 'primaryEmail', email: 'primaryEmail',
  primaryphone: 'primaryPhone', phone: 'primaryPhone',
  memberemails: 'memberEmails', members: 'memberEmails',
} as const;

const memberImportAliases = {
  firstname: 'firstName', first: 'firstName',
  lastname: 'lastName', last: 'lastName',
  email: 'email', emailaddress: 'email',
  phone: 'phone', phonenumber: 'phone', mobile: 'phone',
  householdname: 'householdName', household: 'householdName',
  preferredname: 'preferredName', nickname: 'preferredName',
  status: 'status', tags: 'tags', notes: 'notes',
} as const;

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const gate = useFeatureGate('membership_enabled');
  const utils = trpc.useUtils();
  const canWrite = gate.canWrite;

  // ─── Church ───────────────────────────────────────────────────────────────
  const { data: churches } = trpc.church.list.useQuery({});
  const [churchId, setChurchId] = useState('');
  useEffect(() => { if (!churchId && churches?.length) setChurchId(churches[0].id); }, [churchId, churches]);

  // ─── Sheet / Dialog open state ────────────────────────────────────────────
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [importMembersOpen, setImportMembersOpen] = useState(false);
  const [memberSheetOpen, setMemberSheetOpen] = useState(false);
  const [addHouseholdOpen, setAddHouseholdOpen] = useState(false);
  const [importHouseholdsOpen, setImportHouseholdsOpen] = useState(false);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [addGroupEventOpen, setAddGroupEventOpen] = useState(false);
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [addShiftOpen, setAddShiftOpen] = useState(false);
  const [addAvailabilityOpen, setAddAvailabilityOpen] = useState(false);
  const [addSurveyOpen, setAddSurveyOpen] = useState(false);
  const [addQuestionOpen, setAddQuestionOpen] = useState(false);
  const [addWorkflowOpen, setAddWorkflowOpen] = useState(false);
  const [addStepOpen, setAddStepOpen] = useState(false);
  const [addTagOpen, setAddTagOpen] = useState(false);
  const [addRelationshipOpen, setAddRelationshipOpen] = useState(false);
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);

  // ─── Member form ──────────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');

  // ─── Household form ───────────────────────────────────────────────────────
  const [householdName, setHouseholdName] = useState('');
  const [primaryMemberId, setPrimaryMemberId] = useState('');
  const [householdImportCsv, setHouseholdImportCsv] = useState('');
  const [householdImportFilename, setHouseholdImportFilename] = useState('');
  const [householdImportSummary, setHouseholdImportSummary] = useState<any>(null);

  // ─── Group form ───────────────────────────────────────────────────────────
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState('SMALL_GROUP');
  const [groupIdForEvent, setGroupIdForEvent] = useState('');
  const [groupEventTitle, setGroupEventTitle] = useState('');
  const [groupEventStart, setGroupEventStart] = useState('');
  const [groupEventEnd, setGroupEventEnd] = useState('');
  const [groupEventLocation, setGroupEventLocation] = useState('');

  // ─── Volunteer form ───────────────────────────────────────────────────────
  const [volunteerRoleName, setVolunteerRoleName] = useState('');
  const [volunteerRoleDescription, setVolunteerRoleDescription] = useState('');
  const [shiftRoleId, setShiftRoleId] = useState('');
  const [shiftTitle, setShiftTitle] = useState('');
  const [shiftDescription, setShiftDescription] = useState('');
  const [shiftStart, setShiftStart] = useState('');
  const [shiftEnd, setShiftEnd] = useState('');
  const [shiftCapacity, setShiftCapacity] = useState('');
  const [shiftFilterFrom, setShiftFilterFrom] = useState('');
  const [shiftFilterTo, setShiftFilterTo] = useState('');
  const [gapHoursAhead, setGapHoursAhead] = useState('48');
  const [availabilityRoleId, setAvailabilityRoleId] = useState('');
  const [availabilityDay, setAvailabilityDay] = useState('SUNDAY');
  const [availabilityStart, setAvailabilityStart] = useState('09:00');
  const [availabilityEnd, setAvailabilityEnd] = useState('12:00');
  const [availabilityNotes, setAvailabilityNotes] = useState('');

  // ─── Survey form ──────────────────────────────────────────────────────────
  const [surveyTitle, setSurveyTitle] = useState('');
  const [surveyDescription, setSurveyDescription] = useState('');
  const [surveyIdForQuestion, setSurveyIdForQuestion] = useState('');
  const [surveyQuestionPrompt, setSurveyQuestionPrompt] = useState('');
  const [surveyQuestionType, setSurveyQuestionType] = useState('TEXT');
  const [surveyQuestionOrder, setSurveyQuestionOrder] = useState('1');
  const [surveyQuestionOptions, setSurveyQuestionOptions] = useState('');
  const [surveySummaryId, setSurveySummaryId] = useState('');
  const [surveyAiProvider, setSurveyAiProvider] = useState('openai');

  // ─── Directory & Settings ─────────────────────────────────────────────────
  const [directoryVisibility, setDirectoryVisibility] = useState('MEMBERS_ONLY');
  const [showEmail, setShowEmail] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [showPhoto, setShowPhoto] = useState(true);
  const [allowQuietHours, setAllowQuietHours] = useState(false);
  const [clerkUserId, setClerkUserId] = useState('');
  const [directorySearch, setDirectorySearch] = useState('');
  const [analyticsLookbackDays, setAnalyticsLookbackDays] = useState('90');
  const [segmentLookbackDays, setSegmentLookbackDays] = useState('90');
  const [segmentLimit, setSegmentLimit] = useState('8');

  // ─── Tag form ─────────────────────────────────────────────────────────────
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('');

  // ─── Milestone form ───────────────────────────────────────────────────────
  const [milestoneType, setMilestoneType] = useState('BAPTISM');
  const [milestoneDate, setMilestoneDate] = useState('');
  const [milestoneNotes, setMilestoneNotes] = useState('');

  // ─── Workflow form ────────────────────────────────────────────────────────
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [workflowIdForStep, setWorkflowIdForStep] = useState('');
  const [stepName, setStepName] = useState('');
  const [stepType, setStepType] = useState('WELCOME_CALL');
  const [stepOrder, setStepOrder] = useState('1');
  const [stepDueDays, setStepDueDays] = useState('7');
  const [assignWorkflowId, setAssignWorkflowId] = useState('');

  // ─── Relationship form ────────────────────────────────────────────────────
  const [relationshipToMemberId, setRelationshipToMemberId] = useState('');
  const [relationshipType, setRelationshipType] = useState('SPOUSE');
  const [relationshipLabel, setRelationshipLabel] = useState('');
  const [relationshipNotes, setRelationshipNotes] = useState('');
  const [relationshipReciprocal, setRelationshipReciprocal] = useState(true);

  // ─── Staff messaging ──────────────────────────────────────────────────────
  const [staffConversationId, setStaffConversationId] = useState('');
  const [staffMessageBody, setStaffMessageBody] = useState('');
  const [pendingStaffAttachments, setPendingStaffAttachments] = useState<{ url: string; name?: string; assetId?: string }[]>([]);
  const [uploadingStaffAttachment, setUploadingStaffAttachment] = useState(false);
  const [staffAttachmentUrl, setStaffAttachmentUrl] = useState('');
  const [staffAttachmentName, setStaffAttachmentName] = useState('');

  // ─── Member CSV import ────────────────────────────────────────────────────
  const [importCsv, setImportCsv] = useState('');
  const [importFilename, setImportFilename] = useState('');
  const [importSummary, setImportSummary] = useState<any>(null);

  // ─── tRPC Queries ─────────────────────────────────────────────────────────
  const { data: members, isLoading: isMembersLoading } = trpc.member.list.useQuery({
    churchId: churchId || undefined,
    query: searchQuery || undefined,
  });
  const { data: memberProfile } = trpc.member.profile.useQuery(
    { id: selectedMemberId }, { enabled: Boolean(selectedMemberId) }
  );
  const { data: households } = trpc.household.list.useQuery(
    { churchId: churchId || undefined }, { enabled: Boolean(churchId) }
  );
  const { data: groups } = trpc.group.list.useQuery(
    { churchId: churchId || undefined }, { enabled: Boolean(churchId) }
  );
  const { data: tags } = trpc.memberTag.list.useQuery(
    { churchId: churchId || undefined }, { enabled: Boolean(churchId) }
  );
  const { data: volunteerRoles } = trpc.volunteer.listRoles.useQuery(
    { churchId: churchId || undefined }, { enabled: Boolean(churchId) }
  );
  const { data: volunteerShifts } = trpc.volunteer.listShifts.useQuery({
    churchId: churchId || undefined,
    from: shiftFilterFrom ? new Date(shiftFilterFrom) : undefined,
    to: shiftFilterTo ? new Date(shiftFilterTo) : undefined,
  }, { enabled: Boolean(churchId) });
  const { data: surveys } = trpc.survey.listSurveys.useQuery(
    { churchId: churchId || undefined }, { enabled: Boolean(churchId) }
  );
  const { data: surveySummary } = trpc.survey.summary.useQuery(
    { surveyId: surveySummaryId }, { enabled: Boolean(surveySummaryId) }
  );
  const { data: surveySummaryAi, refetch: refetchSurveyAi, isFetching: isFetchingSurveyAi } =
    trpc.survey.summaryAi.useQuery(
      { surveyId: surveySummaryId, provider: surveyAiProvider as any }, { enabled: false }
    );
  const { refetch: refetchSurveyExport, isFetching: isFetchingSurveyExport } =
    trpc.survey.exportResponses.useQuery({ surveyId: surveySummaryId }, { enabled: false });
  const { data: workflows } = trpc.onboarding.listWorkflows.useQuery(
    { churchId: churchId || undefined }, { enabled: Boolean(churchId) }
  );
  const { data: onboardingAssignments } = trpc.onboarding.memberAssignments.useQuery(
    { memberId: selectedMemberId }, { enabled: Boolean(selectedMemberId) }
  );
  const { data: membershipEngagement } = trpc.member.engagementSummary.useQuery(
    { churchId: churchId || undefined }, { enabled: Boolean(churchId) }
  );
  const { data: memberAnalytics } = trpc.member.analytics.useQuery(
    { churchId: churchId || undefined, lookbackDays: Number(analyticsLookbackDays || '90') },
    { enabled: Boolean(churchId) }
  );
  const { data: memberSegments } = trpc.member.segments.useQuery({
    churchId: churchId || undefined,
    lookbackDays: Number(segmentLookbackDays || '90'),
    limit: Number(segmentLimit || '8'),
  }, { enabled: Boolean(churchId) });
  const { data: groupEngagement } = trpc.group.engagementSummary.useQuery(
    { groupId: groupIdForEvent }, { enabled: Boolean(groupIdForEvent) }
  );
  const { data: groupEvents } = trpc.event.list.useQuery(
    { groupId: groupIdForEvent }, { enabled: Boolean(groupIdForEvent) }
  );
  const { data: directoryPreview } = trpc.member.directory.useQuery(
    { churchId: churchId || undefined, viewer: 'LEADER', limit: 200 }, { enabled: Boolean(churchId) }
  );
  const { data: staffingGaps } = trpc.volunteer.shiftGaps.useQuery(
    { churchId: churchId || undefined, hoursAhead: Number(gapHoursAhead || '48') },
    { enabled: Boolean(churchId) }
  );
  const { data: relationships } = trpc.relationship.listForMember.useQuery(
    { memberId: selectedMemberId }, { enabled: Boolean(selectedMemberId) }
  );
  const { data: availability } = trpc.volunteer.listAvailability.useQuery(
    { memberId: selectedMemberId }, { enabled: Boolean(selectedMemberId) }
  );
  const { data: staffMessages } = trpc.messaging.listMessages.useQuery(
    { conversationId: staffConversationId, limit: 50, asStaff: true },
    { enabled: Boolean(staffConversationId) }
  );

  // ─── tRPC Mutations ───────────────────────────────────────────────────────
  const { mutate: createMember, isPending: isCreatingMember } = trpc.member.create.useMutation({
    onSuccess: async () => {
      setAddMemberError(null); setFirstName(''); setLastName(''); setEmail(''); setPhone('');
      setAddMemberOpen(false);
      await utils.member.list.invalidate();
    },
    onError: (e) => setAddMemberError(e.message),
  });
  const { mutate: deleteMember } = trpc.member.delete.useMutation({
    onSuccess: async () => { await utils.member.list.invalidate(); },
  });
  const { mutate: updateMember } = trpc.member.update.useMutation({
    onSuccess: async () => { await utils.member.list.invalidate(); await utils.member.profile.invalidate(); },
  });
  const { mutate: createHousehold } = trpc.household.create.useMutation({
    onSuccess: async () => {
      setHouseholdName(''); setPrimaryMemberId(''); setAddHouseholdOpen(false);
      await utils.household.list.invalidate();
    },
  });
  const { mutate: assignHousehold } = trpc.household.addMember.useMutation({
    onSuccess: async () => {
      await utils.member.list.invalidate(); await utils.member.profile.invalidate(); await utils.household.list.invalidate();
    },
  });
  const { mutate: createGroup } = trpc.group.create.useMutation({
    onSuccess: async () => { setGroupName(''); setAddGroupOpen(false); await utils.group.list.invalidate(); },
  });
  const { mutate: addGroupMember } = trpc.group.addMember.useMutation({
    onSuccess: async () => { await utils.group.list.invalidate(); await utils.member.profile.invalidate(); },
  });
  const { mutate: createTag } = trpc.memberTag.create.useMutation({
    onSuccess: async () => { setTagName(''); setTagColor(''); setAddTagOpen(false); await utils.memberTag.list.invalidate(); },
  });
  const { mutate: assignTag } = trpc.memberTag.assign.useMutation({
    onSuccess: async () => { await utils.member.profile.invalidate(); await utils.member.list.invalidate(); },
  });
  const { mutate: createMilestone } = trpc.memberMilestone.create.useMutation({
    onSuccess: async () => { setMilestoneDate(''); setMilestoneNotes(''); setAddMilestoneOpen(false); await utils.member.profile.invalidate(); },
  });
  const { mutate: createVolunteerRole } = trpc.volunteer.createRole.useMutation({
    onSuccess: async () => { setVolunteerRoleName(''); setVolunteerRoleDescription(''); setAddRoleOpen(false); await utils.volunteer.listRoles.invalidate(); },
  });
  const { mutate: assignVolunteer } = trpc.volunteer.assignMember.useMutation({
    onSuccess: async () => { await utils.volunteer.listRoles.invalidate(); await utils.member.profile.invalidate(); },
  });
  const { mutate: createWorkflow } = trpc.onboarding.createWorkflow.useMutation({
    onSuccess: async () => { setWorkflowName(''); setWorkflowDescription(''); setAddWorkflowOpen(false); await utils.onboarding.listWorkflows.invalidate(); },
  });
  const { mutate: createStep } = trpc.onboarding.createStep.useMutation({
    onSuccess: async () => { setStepName(''); setAddStepOpen(false); await utils.onboarding.listSteps.invalidate(); await utils.onboarding.listWorkflows.invalidate(); },
  });
  const { mutate: assignWorkflow } = trpc.onboarding.assignMember.useMutation({
    onSuccess: async () => { await utils.onboarding.memberAssignments.invalidate(); },
  });
  const { mutate: createGroupEvent } = trpc.event.create.useMutation({
    onSuccess: async () => { setGroupEventTitle(''); setGroupEventStart(''); setGroupEventEnd(''); setGroupEventLocation(''); setAddGroupEventOpen(false); await utils.event.list.invalidate(); },
  });
  const { mutate: createShift } = trpc.volunteer.createShift.useMutation({
    onSuccess: async () => { setShiftTitle(''); setShiftDescription(''); setShiftStart(''); setShiftEnd(''); setShiftCapacity(''); setAddShiftOpen(false); await utils.volunteer.listShifts.invalidate(); },
  });
  const { mutate: assignShift } = trpc.volunteer.assignShift.useMutation({
    onSuccess: async () => { await utils.volunteer.listShifts.invalidate(); await utils.member.profile.invalidate(); },
  });
  const { mutate: createRelationship } = trpc.relationship.create.useMutation({
    onSuccess: async () => { setRelationshipLabel(''); setRelationshipNotes(''); setAddRelationshipOpen(false); await utils.relationship.listForMember.invalidate(); },
  });
  const { mutate: deleteRelationship } = trpc.relationship.delete.useMutation({
    onSuccess: async () => { await utils.relationship.listForMember.invalidate(); },
  });
  const { mutate: setAvailability } = trpc.volunteer.setAvailability.useMutation({
    onSuccess: async () => { setAvailabilityNotes(''); setAddAvailabilityOpen(false); await utils.volunteer.listAvailability.invalidate(); },
  });
  const { mutate: deleteAvailability } = trpc.volunteer.deleteAvailability.useMutation({
    onSuccess: async () => { await utils.volunteer.listAvailability.invalidate(); },
  });
  const { mutate: createSurvey } = trpc.survey.createSurvey.useMutation({
    onSuccess: async () => { setSurveyTitle(''); setSurveyDescription(''); setAddSurveyOpen(false); await utils.survey.listSurveys.invalidate(); },
  });
  const { mutate: addSurveyQuestion } = trpc.survey.addQuestion.useMutation({
    onSuccess: async () => { setSurveyQuestionPrompt(''); setSurveyQuestionOptions(''); setAddQuestionOpen(false); await utils.survey.listSurveys.invalidate(); },
  });
  const { mutate: importMembers, isPending: isImportingMembers } = trpc.member.importCsv.useMutation({
    onSuccess: (data) => { setImportSummary(data); utils.member.list.invalidate(); },
  });
  const { mutate: rollbackImport, isPending: isRollingBackImport } = trpc.member.rollbackImport.useMutation({
    onSuccess: async (data) => { setImportSummary((p: any) => ({ ...(p ?? {}), rolledBack: true, rollback: data })); await utils.member.list.invalidate(); },
  });
  const { mutate: importHouseholds, isPending: isImportingHouseholds } = trpc.household.importCsv.useMutation({
    onSuccess: (data) => { setHouseholdImportSummary(data); utils.household.list.invalidate(); },
  });
  const { mutate: rollbackHouseholdImport, isPending: isRollingBackHouseholds } = trpc.household.rollbackImport.useMutation({
    onSuccess: async (data) => { setHouseholdImportSummary((p: any) => ({ ...(p ?? {}), rolledBack: true, rollback: data })); await utils.household.list.invalidate(); },
  });
  const { mutateAsync: ensureStaffThread } = trpc.messaging.staffThread.useMutation();
  const { mutateAsync: createUpload } = trpc.storage.createUpload.useMutation();
  const { mutate: sendStaffMessage } = trpc.messaging.sendMessage.useMutation({
    onSuccess: async () => { setStaffMessageBody(''); setPendingStaffAttachments([]); await utils.messaging.listMessages.invalidate(); },
  });

  // ─── Memos ────────────────────────────────────────────────────────────────
  type ShiftItem = NonNullable<typeof volunteerShifts>[number];
  const shiftCalendar = useMemo(() => {
    const dayMap = new Map<string, ShiftItem[]>();
    (volunteerShifts ?? []).forEach((shift) => {
      const key = new Date(shift.startAt).toDateString();
      const list = dayMap.get(key) ?? [];
      list.push(shift);
      dayMap.set(key, list);
    });
    const days: { date: Date; shifts: ShiftItem[] }[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const date = new Date(today.getTime() + i * 86400000);
      days.push({ date, shifts: dayMap.get(date.toDateString()) ?? [] });
    }
    return days;
  }, [volunteerShifts]);

  const orderedStaffMessages = useMemo(() => [...(staffMessages ?? [])].reverse(), [staffMessages]);
  const filteredDirectory = useMemo(() => {
    const q = directorySearch.trim().toLowerCase();
    if (!q) return directoryPreview ?? [];
    return (directoryPreview ?? []).filter((m) =>
      `${m.firstName} ${m.lastName} ${m.preferredName ?? ''} ${m.email ?? ''} ${m.phone ?? ''}`.toLowerCase().includes(q)
    );
  }, [directoryPreview, directorySearch]);

  const householdImportPreview = useMemo(
    () => analyzeCsvImport(householdImportCsv, householdImportAliases, [
      { label: 'Household identity', check: (t) => ({ ok: t.has('name') || t.has('primaryEmail') || t.has('primaryPhone'), detail: 'Provide a household name or a primary email/phone.' }) },
      { label: 'Member linking', check: (t) => ({ ok: t.has('memberEmails'), detail: 'Member emails allow households to attach members immediately.' }) },
    ]), [householdImportCsv]
  );
  const memberImportPreview = useMemo(
    () => analyzeCsvImport(importCsv, memberImportAliases, [
      { label: 'Member identity', check: (t) => ({ ok: t.has('firstName') || t.has('lastName') || t.has('email'), detail: 'Provide at least a first name, last name, or email.' }) },
      { label: 'Contact info', check: (t) => ({ ok: t.has('email') || t.has('phone'), detail: 'Email or phone recommended for deduplication.' }) },
    ]), [importCsv]
  );

  // ─── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => { if (!groupIdForEvent && groups?.length) setGroupIdForEvent(groups[0].id); }, [groupIdForEvent, groups]);
  useEffect(() => { if (!shiftRoleId && volunteerRoles?.length) setShiftRoleId(volunteerRoles[0].id); }, [shiftRoleId, volunteerRoles]);
  useEffect(() => { if (!availabilityRoleId && volunteerRoles?.length) setAvailabilityRoleId(volunteerRoles[0].id); }, [availabilityRoleId, volunteerRoles]);
  useEffect(() => {
    if (!surveyIdForQuestion && surveys?.length) setSurveyIdForQuestion(surveys[0].id);
    if (!surveySummaryId && surveys?.length) setSurveySummaryId(surveys[0].id);
  }, [surveyIdForQuestion, surveySummaryId, surveys]);
  useEffect(() => {
    if (!workflowIdForStep && workflows?.length) setWorkflowIdForStep(workflows[0].id);
    if (!assignWorkflowId && workflows?.length) setAssignWorkflowId(workflows[0].id);
  }, [assignWorkflowId, workflowIdForStep, workflows]);
  useEffect(() => {
    if (memberProfile?.member) {
      setDirectoryVisibility(memberProfile.member.directoryVisibility ?? 'MEMBERS_ONLY');
      setShowEmail(Boolean(memberProfile.member.showEmailInDirectory));
      setShowPhone(Boolean(memberProfile.member.showPhoneInDirectory));
      setShowAddress(Boolean(memberProfile.member.showAddressInDirectory));
      setShowPhoto(Boolean(memberProfile.member.showPhotoInDirectory));
      setClerkUserId(memberProfile.member.clerkUserId ?? '');
      setAllowQuietHours(Boolean((memberProfile.member as any).allowQuietHours));
    }
  }, [memberProfile]);
  useEffect(() => {
    if (!selectedMemberId || !churchId) return;
    ensureStaffThread({ churchId, memberId: selectedMemberId }).then((c) => setStaffConversationId(c.id)).catch(() => {});
  }, [churchId, selectedMemberId, ensureStaffThread]);
  useEffect(() => {
    if (selectedMemberId && members?.length) {
      const candidate = members.find((m) => m.id !== selectedMemberId);
      if (candidate) setRelationshipToMemberId(candidate.id);
    }
  }, [members, selectedMemberId]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleImportFile = (file?: File | null) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => { setImportCsv(String(r.result ?? '')); setImportFilename(file.name); setImportSummary(null); };
    r.readAsText(file);
  };
  const handleHouseholdImportFile = (file?: File | null) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => { setHouseholdImportCsv(String(r.result ?? '')); setHouseholdImportFilename(file.name); setHouseholdImportSummary(null); };
    r.readAsText(file);
  };
  const downloadCsv = (content: string, name: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
    Object.assign(document.createElement('a'), { href: url, download: name }).click();
    URL.revokeObjectURL(url);
  };
  const handleSurveyExport = async () => {
    const result = await refetchSurveyExport();
    if (result.data) downloadCsv(result.data.content, result.data.filename || 'survey-responses.csv');
  };
  const handleStaffAttachmentFile = async (file?: File | null) => {
    if (!file || uploadingStaffAttachment) return;
    setUploadingStaffAttachment(true);
    try {
      const upload = await createUpload({ filename: file.name, contentType: file.type || 'application/octet-stream', size: file.size, purpose: 'message-attachments', churchId: churchId || undefined });
      await fetch(upload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      setPendingStaffAttachments((p) => [...p, { url: upload.publicUrl, name: file.name, assetId: upload.assetId }]);
    } catch {}
    finally { setUploadingStaffAttachment(false); }
  };

  // ─── DataTable columns ────────────────────────────────────────────────────
  type MemberRow = NonNullable<typeof members>[number];
  const memberColumns: ColumnDef<MemberRow, unknown>[] = [
    {
      id: 'name',
      header: 'Name',
      accessorFn: (r) => `${r.firstName} ${r.lastName}`,
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">{row.original.firstName} {row.original.lastName}</p>
          {row.original.preferredName && <p className="text-xs text-muted">"{row.original.preferredName}"</p>}
        </div>
      ),
    },
    { accessorKey: 'email', header: 'Email', cell: ({ getValue }) => <span className="text-muted">{(getValue() as string) ?? '—'}</span> },
    { accessorKey: 'phone', header: 'Phone', cell: ({ getValue }) => <span className="text-muted">{(getValue() as string) ?? '—'}</span> },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return <Badge variant={s === 'ACTIVE' ? 'success' : s === 'INACTIVE' ? 'warning' : 'default'}>{s}</Badge>;
      },
    },
    {
      id: 'household',
      header: 'Household',
      accessorFn: (r) => (r as any).household?.name ?? '',
      cell: ({ getValue }) => <span className="text-muted">{(getValue() as string) || '—'}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" disabled={!canWrite}
            onClick={() => deleteMember({ id: row.original.id })}
            className="text-red-500 hover:text-red-700 hover:bg-red-50">
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // ─── Feature gate ─────────────────────────────────────────────────────────
  if (!gate.isLoading && gate.access === 'locked') {
    return (
      <Shell>
        <FeatureLocked featureKey="membership_enabled" title="Membership is locked" description="Upgrade your plan to manage members, households, groups, and volunteers." />
      </Shell>
    );
  }

  const selectedMember = members?.find((m) => m.id === selectedMemberId);
  const totalMembers = members?.length ?? 0;
  const activeMembers = members?.filter((m) => m.status === 'ACTIVE').length ?? 0;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Shell>
      {!canWrite && <ReadOnlyNotice />}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-semibold text-foreground">Members</h1>
          <p className="text-sm text-muted mt-0.5">Manage people, households, groups, and volunteers</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Church selector */}
          {churches && churches.length > 1 && (
            <select
              value={churchId}
              onChange={(e) => setChurchId(e.target.value)}
              className="h-9 rounded-md border border-border bg-white px-3 text-sm"
            >
              {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        {[
          { label: 'Total', value: totalMembers },
          { label: 'Active', value: activeMembers },
          { label: 'Households', value: households?.length ?? 0 },
          { label: 'Groups', value: groups?.length ?? 0 },
        ].map((kpi) => (
          <div key={kpi.label} className="ff-kpi">
            <p className="text-xs text-muted uppercase tracking-wide">{kpi.label}</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* ── Main Tabs ──────────────────────────────────────────────────────── */}
      <Tabs defaultValue="members">
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-max min-w-full sm:w-auto">
            <TabsTrigger value="members"><UsersIcon className="h-4 w-4 mr-1.5 inline" />Members</TabsTrigger>
            <TabsTrigger value="households"><HomeModernIcon className="h-4 w-4 mr-1.5 inline" />Households</TabsTrigger>
            <TabsTrigger value="groups"><UserGroupIcon className="h-4 w-4 mr-1.5 inline" />Groups</TabsTrigger>
            <TabsTrigger value="volunteers"><BriefcaseIcon className="h-4 w-4 mr-1.5 inline" />Volunteers</TabsTrigger>
            <TabsTrigger value="surveys"><ChartBarIcon className="h-4 w-4 mr-1.5 inline" />Surveys</TabsTrigger>
            <TabsTrigger value="settings"><Cog6ToothIcon className="h-4 w-4 mr-1.5 inline" />Directory & Settings</TabsTrigger>
          </TabsList>
        </div>

        {/* ── Members Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="members">
          <DataTable
            columns={memberColumns}
            data={members ?? []}
            searchKey="name"
            searchPlaceholder="Search members…"
            isLoading={isMembersLoading}
            emptyMessage="No members yet. Add your first member to get started."
            onRowClick={(row) => { setSelectedMemberId(row.id); setMemberSheetOpen(true); }}
            toolbar={
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={() => setImportMembersOpen(true)}>
                  <ArrowUpTrayIcon className="h-4 w-4 mr-1.5" />Import CSV
                </Button>
                <Button size="sm" disabled={!canWrite} onClick={() => setAddMemberOpen(true)}>
                  <UserPlusIcon className="h-4 w-4 mr-1.5" />Add Member
                </Button>
              </div>
            }
          />
        </TabsContent>

        {/* ── Households Tab ───────────────────────────────────────────────── */}
        <TabsContent value="households">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted">{households?.length ?? 0} households</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setImportHouseholdsOpen(true)}>
                <ArrowUpTrayIcon className="h-4 w-4 mr-1.5" />Import CSV
              </Button>
              <Button size="sm" disabled={!canWrite} onClick={() => setAddHouseholdOpen(true)}>
                <PlusIcon className="h-4 w-4 mr-1.5" />Add Household
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {households?.map((h) => (
              <Card key={h.id} className="p-4 ff-surface">
                <p className="font-medium text-foreground">{h.name}</p>
                <p className="text-xs text-muted mt-1">{(h as any).memberCount ?? 0} members</p>
              </Card>
            ))}
            {!households?.length && <p className="text-sm text-muted col-span-full py-8 text-center">No households yet.</p>}
          </div>
        </TabsContent>

        {/* ── Groups Tab ───────────────────────────────────────────────────── */}
        <TabsContent value="groups">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted">{groups?.length ?? 0} groups</p>
            <Button size="sm" disabled={!canWrite} onClick={() => setAddGroupOpen(true)}>
              <PlusIcon className="h-4 w-4 mr-1.5" />New Group
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {groups?.map((g) => (
              <Card key={g.id} className="p-4 ff-surface">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{g.name}</p>
                    <Badge variant="default" className="mt-1 text-xs">{g.type}</Badge>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { setGroupIdForEvent(g.id); setAddGroupEventOpen(true); }}>
                    + Event
                  </Button>
                </div>
                {groupIdForEvent === g.id && groupEvents && groupEvents.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                    {groupEvents.slice(0, 3).map((ev) => (
                      <div key={ev.id} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{ev.title}</span>
                        <span className="text-muted">{new Date(ev.startAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
            {!groups?.length && <p className="text-sm text-muted col-span-full py-8 text-center">No groups yet.</p>}
          </div>
        </TabsContent>

        {/* ── Volunteers Tab ───────────────────────────────────────────────── */}
        <TabsContent value="volunteers">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Roles */}
            <Card className="p-5 ff-surface">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Volunteer Roles</h3>
                <Button size="sm" disabled={!canWrite} onClick={() => setAddRoleOpen(true)}>
                  <PlusIcon className="h-4 w-4 mr-1" />Add Role
                </Button>
              </div>
              <div className="space-y-2">
                {volunteerRoles?.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{r.name}</p>
                      {r.description && <p className="text-xs text-muted">{r.description}</p>}
                    </div>
                    {selectedMemberId && (
                      <Button variant="outline" size="sm" disabled={!canWrite}
                        onClick={() => assignVolunteer({ memberId: selectedMemberId, roleId: r.id })}>
                        Assign
                      </Button>
                    )}
                  </div>
                ))}
                {!volunteerRoles?.length && <p className="text-sm text-muted text-center py-4">No roles yet.</p>}
              </div>
            </Card>

            {/* Staffing Gaps */}
            <Card className="p-5 ff-surface">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Staffing Gaps</h3>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted">Hrs ahead</Label>
                  <Input value={gapHoursAhead} onChange={(e) => setGapHoursAhead(e.target.value)} className="h-8 w-16 text-sm" />
                </div>
              </div>
              <div className="space-y-2">
                {staffingGaps?.gaps?.map((gap, i) => (
                  <div key={i} className="text-sm py-2 border-b border-border last:border-0">
                    <p className="font-medium">{gap.shift?.title ?? 'Unnamed shift'}</p>
                    <p className="text-xs text-muted">{(gap.shift as any)?.role?.name} · {gap.assigned}/{gap.capacity} filled</p>
                  </div>
                ))}
                {!staffingGaps?.gaps?.length && <p className="text-sm text-muted text-center py-4">No gaps in the next {gapHoursAhead}h.</p>}
              </div>
            </Card>
          </div>

          {/* Shifts calendar */}
          <Card className="mt-6 p-5 ff-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold text-foreground">Upcoming Shifts</h3>
              <div className="flex flex-wrap items-center gap-2">
                <Input type="date" value={shiftFilterFrom} onChange={(e) => setShiftFilterFrom(e.target.value)} className="h-8 text-sm" />
                <span className="text-muted text-sm">to</span>
                <Input type="date" value={shiftFilterTo} onChange={(e) => setShiftFilterTo(e.target.value)} className="h-8 text-sm" />
                <Button size="sm" disabled={!canWrite} onClick={() => setAddShiftOpen(true)}>
                  <PlusIcon className="h-4 w-4 mr-1" />New Shift
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {shiftCalendar.filter((d) => d.shifts.length > 0).map((day) => (
                <div key={day.date.toDateString()} className="rounded-md border border-border p-3">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                    {day.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  {day.shifts.map((s) => (
                    <div key={s.id} className="text-sm mb-1.5 last:mb-0">
                      <p className="font-medium truncate">{s.title}</p>
                      <p className="text-xs text-muted">{(s as any).filledCount ?? s.assignments?.length ?? 0}/{s.capacity ?? '∞'} filled</p>
                    </div>
                  ))}
                </div>
              ))}
              {shiftCalendar.every((d) => !d.shifts.length) && (
                <p className="text-sm text-muted col-span-full text-center py-6">No shifts in range.</p>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* ── Surveys Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="surveys">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted">{surveys?.length ?? 0} surveys</p>
            <Button size="sm" disabled={!canWrite} onClick={() => setAddSurveyOpen(true)}>
              <PlusIcon className="h-4 w-4 mr-1.5" />New Survey
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {surveys?.map((s) => (
              <Card key={s.id} className="p-4 ff-surface">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{s.title}</p>
                    {s.description && <p className="text-xs text-muted mt-0.5 line-clamp-2">{s.description}</p>}
                    <p className="text-xs text-muted mt-1">{s.questions?.length ?? 0} questions</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { setSurveyIdForQuestion(s.id); setSurveySummaryId(s.id); setAddQuestionOpen(true); }}>
                    + Question
                  </Button>
                </div>
                {surveySummaryId === s.id && surveySummary && (
                  <div className="mt-3 border-t border-border pt-3 text-sm">
                    <p className="text-muted">{surveySummary.totalResponses ?? 0} responses</p>
                    <div className="flex gap-2 mt-2">
                      <Button variant="outline" size="sm" onClick={handleSurveyExport} disabled={isFetchingSurveyExport}>
                        Export CSV
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => refetchSurveyAi()} disabled={isFetchingSurveyAi}>
                        AI Summary
                      </Button>
                    </div>
                    {surveySummaryAi && <p className="text-xs text-muted mt-2 line-clamp-3">{surveySummaryAi.summary}</p>}
                  </div>
                )}
              </Card>
            ))}
            {!surveys?.length && <p className="text-sm text-muted col-span-full py-8 text-center">No surveys yet.</p>}
          </div>
        </TabsContent>

        {/* ── Directory & Settings Tab ─────────────────────────────────────── */}
        <TabsContent value="settings">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Tags */}
            <Card className="p-5 ff-surface">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Tags</h3>
                <Button size="sm" disabled={!canWrite} onClick={() => setAddTagOpen(true)}>
                  <PlusIcon className="h-4 w-4 mr-1" />New Tag
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags?.map((t) => (
                  <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border border-border">
                    {t.color && <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />}
                    {t.name}
                  </span>
                ))}
                {!tags?.length && <p className="text-sm text-muted">No tags yet.</p>}
              </div>
            </Card>

            {/* Onboarding Workflows */}
            <Card className="p-5 ff-surface">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Onboarding Workflows</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={!canWrite} onClick={() => setAddStepOpen(true)}>+ Step</Button>
                  <Button size="sm" disabled={!canWrite} onClick={() => setAddWorkflowOpen(true)}>
                    <PlusIcon className="h-4 w-4 mr-1" />New
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {workflows?.map((w) => (
                  <div key={w.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{w.name}</p>
                      <p className="text-xs text-muted">{(w as any).stepCount ?? 0} steps</p>
                    </div>
                    {selectedMemberId && (
                      <Button variant="outline" size="sm" disabled={!canWrite}
                        onClick={() => assignWorkflow({ memberId: selectedMemberId, workflowId: w.id })}>
                        Assign
                      </Button>
                    )}
                  </div>
                ))}
                {!workflows?.length && <p className="text-sm text-muted py-2">No workflows yet.</p>}
              </div>
            </Card>

            {/* Directory privacy */}
            <Card className="p-5 ff-surface col-span-full">
              <h3 className="font-semibold mb-4">Directory Privacy Defaults</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { label: 'Show email', value: showEmail, setter: setShowEmail },
                  { label: 'Show phone', value: showPhone, setter: setShowPhone },
                  { label: 'Show address', value: showAddress, setter: setShowAddress },
                  { label: 'Show photo', value: showPhoto, setter: setShowPhoto },
                  { label: 'Allow quiet hours override', value: allowQuietHours, setter: setAllowQuietHours },
                ].map((opt) => (
                  <label key={opt.label} className="flex items-center gap-3 text-sm cursor-pointer">
                    <input type="checkbox" checked={opt.value} onChange={(e) => opt.setter(e.target.checked)} className="rounded border-border" />
                    {opt.label}
                  </label>
                ))}
                <div className="sm:col-span-2">
                  <Label className="text-xs text-muted mb-1 block">Visibility</Label>
                  <select value={directoryVisibility} onChange={(e) => setDirectoryVisibility(e.target.value)}
                    className="h-9 w-full max-w-xs rounded-md border border-border bg-white px-3 text-sm">
                    <option value="PUBLIC">Public</option>
                    <option value="MEMBERS_ONLY">Members only</option>
                    <option value="LEADERS_ONLY">Leaders only</option>
                    <option value="PRIVATE">Private</option>
                  </select>
                </div>
              </div>
              {selectedMemberId && (
                <Button className="mt-4" disabled={!canWrite}
                  onClick={() => updateMember({ id: selectedMemberId, data: { directoryVisibility: directoryVisibility as any, showEmailInDirectory: showEmail, showPhoneInDirectory: showPhone, showAddressInDirectory: showAddress, showPhotoInDirectory: showPhoto, allowQuietHours } })}>
                  Save for {selectedMember?.firstName ?? 'selected member'}
                </Button>
              )}
            </Card>

            {/* Directory preview */}
            <Card className="p-5 ff-surface col-span-full">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Directory Preview</h3>
                <div className="relative w-full max-w-xs">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <Input placeholder="Search directory…" value={directorySearch} onChange={(e) => setDirectorySearch(e.target.value)} className="pl-9 h-8 text-sm" />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filteredDirectory.slice(0, 30).map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                      {m.firstName[0]}{m.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{m.firstName} {m.lastName}</p>
                      {m.email && <p className="text-xs text-muted truncate">{m.email}</p>}
                    </div>
                  </div>
                ))}
              </div>
              {filteredDirectory.length > 30 && <p className="text-xs text-muted mt-3">Showing 30 of {filteredDirectory.length}</p>}
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ══════════════════════════════════════════════════════════════════════
          SHEETS & DIALOGS
      ══════════════════════════════════════════════════════════════════════ */}

      {/* ── Member Profile Sheet ─────────────────────────────────────────── */}
      <Sheet open={memberSheetOpen} onOpenChange={setMemberSheetOpen}>
        <SheetContent side="right" className="w-full max-w-2xl flex flex-col">
          <SheetHeader>
            <SheetTitle>{selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'Member Profile'}</SheetTitle>
          </SheetHeader>
          <SheetBody className="flex-1 overflow-y-auto">
            {memberProfile ? (
              <div className="space-y-6">
                {/* Profile info */}
                <section>
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Profile</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { label: 'Email', value: memberProfile.member.email },
                      { label: 'Phone', value: memberProfile.member.phone },
                      { label: 'Status', value: memberProfile.member.status },
                      { label: 'Household', value: (memberProfile.member as any).household?.name },
                    ].map((f) => f.value ? (
                      <div key={f.label}>
                        <p className="text-xs text-muted">{f.label}</p>
                        <p className="font-medium">{f.value}</p>
                      </div>
                    ) : null)}
                  </div>
                </section>

                <Separator />

                {/* Assign household */}
                <section>
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Assign to Household</h4>
                  <div className="flex gap-2">
                    <select value={primaryMemberId} onChange={(e) => setPrimaryMemberId(e.target.value)}
                      className="flex-1 h-9 rounded-md border border-border bg-white px-3 text-sm">
                      <option value="">Select household…</option>
                      {households?.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                    <Button size="sm" disabled={!canWrite || !primaryMemberId}
                      onClick={() => assignHousehold({ householdId: primaryMemberId, memberId: selectedMemberId })}>
                      Assign
                    </Button>
                  </div>
                </section>

                <Separator />

                {/* Relationships */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wide">Relationships</h4>
                    <Button variant="outline" size="sm" disabled={!canWrite} onClick={() => setAddRelationshipOpen(true)}>+ Add</Button>
                  </div>
                  <div className="space-y-2">
                    {relationships?.map((rel) => (
                      <div key={rel.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                        <div>
                          <span className="font-medium">{rel.type}</span>
                          {rel.label && <span className="text-muted ml-2">({rel.label})</span>}
                          <span className="text-muted ml-2">→ {(rel as any).relatedMember?.firstName} {(rel as any).relatedMember?.lastName}</span>
                        </div>
                        <Button variant="ghost" size="sm" disabled={!canWrite} onClick={() => deleteRelationship({ id: rel.id })} className="text-red-500 hover:text-red-700">
                          <TrashIcon className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    {!relationships?.length && <p className="text-sm text-muted">No relationships yet.</p>}
                  </div>
                </section>

                <Separator />

                {/* Onboarding */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wide">Onboarding</h4>
                    {workflows?.length ? (
                      <div className="flex gap-2">
                        <select value={assignWorkflowId} onChange={(e) => setAssignWorkflowId(e.target.value)}
                          className="h-8 rounded-md border border-border bg-white px-2 text-xs">
                          {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                        <Button size="sm" disabled={!canWrite || !assignWorkflowId}
                          onClick={() => assignWorkflow({ memberId: selectedMemberId, workflowId: assignWorkflowId })}>
                          Assign
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    {onboardingAssignments?.map((a) => (
                      <div key={a.id}>
                        <p className="text-xs font-medium text-muted mb-1">{(a as any).workflow?.name}</p>
                        {(a as any).tasks?.map((task: any) => (
                          <div key={task.id} className="text-sm flex items-center justify-between py-0.5 pl-3">
                            <span>{task.step?.name ?? 'Task'}</span>
                            <Badge variant={task.completedAt ? 'success' : 'default'}>{task.completedAt ? 'Done' : 'Pending'}</Badge>
                          </div>
                        ))}
                      </div>
                    ))}
                    {!onboardingAssignments?.length && <p className="text-sm text-muted">No workflows assigned.</p>}
                  </div>
                </section>

                <Separator />

                {/* Milestones */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wide">Milestones</h4>
                    <Button variant="outline" size="sm" disabled={!canWrite} onClick={() => setAddMilestoneOpen(true)}>+ Add</Button>
                  </div>
                  <div className="space-y-1.5">
                    {(memberProfile.member as any).milestones?.map((ms: any) => (
                      <div key={ms.id} className="text-sm flex items-center justify-between py-1">
                        <span className="font-medium">{ms.type}</span>
                        <span className="text-muted">{new Date(ms.date).toLocaleDateString()}</span>
                      </div>
                    ))}
                    {!(memberProfile.member as any).milestones?.length && <p className="text-sm text-muted">No milestones recorded.</p>}
                  </div>
                </section>

                <Separator />

                {/* Staff Messaging */}
                <section>
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Staff Notes & Messages</h4>
                  <ScrollArea className="h-48 rounded-md border border-border p-3 mb-3">
                    {orderedStaffMessages.map((msg) => (
                      <div key={msg.id} className="mb-3 last:mb-0">
                        <p className="text-xs text-muted mb-0.5">{msg.senderMember ? `${msg.senderMember.firstName} ${msg.senderMember.lastName}` : 'Staff'} · {new Date(msg.createdAt ?? '').toLocaleString()}</p>
                        <p className="text-sm">{msg.body}</p>
                      </div>
                    ))}
                    {!orderedStaffMessages.length && <p className="text-xs text-muted text-center py-4">No messages yet.</p>}
                  </ScrollArea>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Write a staff note…"
                      value={staffMessageBody}
                      onChange={(e) => setStaffMessageBody(e.target.value)}
                      className="flex-1 min-h-[60px] resize-none"
                    />
                    <Button size="sm" disabled={!canWrite || !staffMessageBody.trim()}
                      onClick={() => sendStaffMessage({ conversationId: staffConversationId, body: staffMessageBody, attachments: pendingStaffAttachments })}>
                      Send
                    </Button>
                  </div>
                </section>
              </div>
            ) : (
              <div className="space-y-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )}
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" size="sm" disabled={!canWrite || !selectedMemberId}
              onClick={() => { if (confirm('Delete this member?')) { deleteMember({ id: selectedMemberId }); setMemberSheetOpen(false); } }}
              className="text-red-600 border-red-200 hover:bg-red-50">
              Delete Member
            </Button>
            <SheetClose asChild><Button variant="outline">Close</Button></SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Add Member Dialog ────────────────────────────────────────────── */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Member</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            {addMemberError && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{addMemberError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1" /></div>
              <div><Label>Last name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1" /></div>
            </div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" /></div>
            <div><Label>Phone</Label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" /></div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button disabled={!canWrite || isCreatingMember || !firstName}
              onClick={() => createMember({ churchId, firstName, lastName, email: email || undefined, phone: phone || undefined })}>
              {isCreatingMember ? 'Adding…' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import Members Dialog ────────────────────────────────────────── */}
      <Dialog open={importMembersOpen} onOpenChange={setImportMembersOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Import Members from CSV</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadCsv('firstName,lastName,email,phone,householdName,preferredName,status,tags,notes\n', 'faithflow-member-import-template.csv')}>
                Download Template
              </Button>
              <label className="cursor-pointer inline-flex items-center h-9 px-3 text-sm rounded-md border border-border bg-white hover:bg-muted/5">
                {importFilename || 'Choose CSV file'}
                <input type="file" accept=".csv" className="sr-only" onChange={(e) => handleImportFile(e.target.files?.[0])} />
              </label>
            </div>
            {importCsv && memberImportPreview && (
              <div className="rounded-md border border-border p-3 text-sm space-y-2">
                <p><span className="font-medium">{memberImportPreview.rowCount}</span> rows detected</p>
                <div className="flex flex-wrap gap-1.5">
                  {memberImportPreview.mappedHeaders.filter((h) => h.target).map((h) => <Badge key={h.source} variant="success">{h.source} → {h.target}</Badge>)}
                  {memberImportPreview.unrecognizedHeaders.map((c) => <Badge key={c} variant="warning">{c}</Badge>)}
                </div>
                {memberImportPreview.readiness.map((check) => (
                  <div key={check.label} className={`text-xs ${check.ok ? 'text-green-700' : 'text-amber-700'}`}>
                    {check.ok ? '✓' : '⚠'} {check.label}
                  </div>
                ))}
              </div>
            )}
            {importSummary && (
              <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm">
                <p className="font-medium text-green-800">Import complete: {importSummary.created} created, {importSummary.updated} updated</p>
                {!importSummary.rolledBack && (
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => rollbackImport({ batchId: importSummary.batchId })} disabled={isRollingBackImport}>
                    Rollback Import
                  </Button>
                )}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
            <Button disabled={!canWrite || !importCsv || isImportingMembers}
              onClick={() => importMembers({ churchId, csv: importCsv, dryRun: false })}>
              {isImportingMembers ? 'Importing…' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Household Dialog ─────────────────────────────────────────── */}
      <Dialog open={addHouseholdOpen} onOpenChange={setAddHouseholdOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Household</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <div><Label>Household name</Label><Input value={householdName} onChange={(e) => setHouseholdName(e.target.value)} className="mt-1" /></div>
            <div>
              <Label>Primary member</Label>
              <select value={primaryMemberId} onChange={(e) => setPrimaryMemberId(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm">
                <option value="">Select…</option>
                {members?.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
              </select>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button disabled={!canWrite || !householdName} onClick={() => createHousehold({ churchId, name: householdName, primaryMemberId: primaryMemberId || undefined })}>
              Create Household
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import Households Dialog ─────────────────────────────────────── */}
      <Dialog open={importHouseholdsOpen} onOpenChange={setImportHouseholdsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Import Households from CSV</DialogTitle></DialogHeader>
          <DialogBody className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadCsv('name,primaryEmail,primaryPhone,memberEmails\nFamily Doe,primary@example.com,+15551234567,"member1@example.com;member2@example.com"\n', 'faithflow-household-import-template.csv')}>
                Download Template
              </Button>
              <label className="cursor-pointer inline-flex items-center h-9 px-3 text-sm rounded-md border border-border bg-white hover:bg-muted/5">
                {householdImportFilename || 'Choose CSV file'}
                <input type="file" accept=".csv" className="sr-only" onChange={(e) => handleHouseholdImportFile(e.target.files?.[0])} />
              </label>
            </div>
            {householdImportCsv && householdImportPreview && (
              <div className="rounded-md border border-border p-3 text-sm space-y-2">
                <p><span className="font-medium">{householdImportPreview.rowCount}</span> rows detected</p>
                <div className="flex flex-wrap gap-1.5">
                  {householdImportPreview.mappedHeaders.filter((h) => h.target).map((h) => <Badge key={h.source} variant="success">{h.source} → {h.target}</Badge>)}
                  {householdImportPreview.unrecognizedHeaders.map((c) => <Badge key={c} variant="warning">{c}</Badge>)}
                </div>
              </div>
            )}
            {householdImportSummary && (
              <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm">
                <p className="font-medium text-green-800">Import complete: {householdImportSummary.created} created</p>
                {!householdImportSummary.rolledBack && (
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => rollbackHouseholdImport({ batchId: householdImportSummary.batchId })} disabled={isRollingBackHouseholds}>
                    Rollback
                  </Button>
                )}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
            <Button disabled={!canWrite || !householdImportCsv || isImportingHouseholds}
              onClick={() => importHouseholds({ churchId, csv: householdImportCsv, dryRun: false })}>
              {isImportingHouseholds ? 'Importing…' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Group Dialog ─────────────────────────────────────────────── */}
      <Dialog open={addGroupOpen} onOpenChange={setAddGroupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Group</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <div><Label>Group name</Label><Input value={groupName} onChange={(e) => setGroupName(e.target.value)} className="mt-1" /></div>
            <div>
              <Label>Type</Label>
              <select value={groupType} onChange={(e) => setGroupType(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm">
                {['SMALL_GROUP', 'MINISTRY_TEAM', 'CHOIR', 'YOUTH', 'MENS', 'WOMENS', 'PRAYER', 'OUTREACH', 'OTHER'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button disabled={!canWrite || !groupName} onClick={() => createGroup({ churchId, name: groupName, type: groupType as any })}>Create Group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Group Event Dialog ────────────────────────────────────────── */}
      <Dialog open={addGroupEventOpen} onOpenChange={setAddGroupEventOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Group Event</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <div>
              <Label>Group</Label>
              <select value={groupIdForEvent} onChange={(e) => setGroupIdForEvent(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm">
                {groups?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div><Label>Title</Label><Input value={groupEventTitle} onChange={(e) => setGroupEventTitle(e.target.value)} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start</Label><Input type="datetime-local" value={groupEventStart} onChange={(e) => setGroupEventStart(e.target.value)} className="mt-1" /></div>
              <div><Label>End</Label><Input type="datetime-local" value={groupEventEnd} onChange={(e) => setGroupEventEnd(e.target.value)} className="mt-1" /></div>
            </div>
            <div><Label>Location</Label><Input value={groupEventLocation} onChange={(e) => setGroupEventLocation(e.target.value)} className="mt-1" /></div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button disabled={!canWrite || !groupEventTitle || !groupEventStart}
              onClick={() => createGroupEvent({ churchId, groupId: groupIdForEvent, title: groupEventTitle, startAt: groupEventStart, endAt: groupEventEnd || undefined, location: groupEventLocation || undefined })}>
              Create Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Volunteer Role Dialog ────────────────────────────────────── */}
      <Dialog open={addRoleOpen} onOpenChange={setAddRoleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Volunteer Role</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <div><Label>Name</Label><Input value={volunteerRoleName} onChange={(e) => setVolunteerRoleName(e.target.value)} className="mt-1" /></div>
            <div><Label>Description</Label><Textarea value={volunteerRoleDescription} onChange={(e) => setVolunteerRoleDescription(e.target.value)} className="mt-1" rows={2} /></div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button disabled={!canWrite || !volunteerRoleName} onClick={() => createVolunteerRole({ churchId, name: volunteerRoleName, description: volunteerRoleDescription || undefined })}>Create Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Shift Dialog ─────────────────────────────────────────────── */}
      <Dialog open={addShiftOpen} onOpenChange={setAddShiftOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Volunteer Shift</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <div>
              <Label>Role</Label>
              <select value={shiftRoleId} onChange={(e) => setShiftRoleId(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm">
                {volunteerRoles?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div><Label>Title</Label><Input value={shiftTitle} onChange={(e) => setShiftTitle(e.target.value)} className="mt-1" /></div>
            <div><Label>Description</Label><Input value={shiftDescription} onChange={(e) => setShiftDescription(e.target.value)} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start</Label><Input type="datetime-local" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} className="mt-1" /></div>
              <div><Label>End</Label><Input type="datetime-local" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} className="mt-1" /></div>
            </div>
            <div><Label>Capacity</Label><Input type="number" value={shiftCapacity} onChange={(e) => setShiftCapacity(e.target.value)} className="mt-1 w-28" /></div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button disabled={!canWrite || !shiftTitle || !shiftStart}
              onClick={() => createShift({ churchId, roleId: shiftRoleId, title: shiftTitle, description: shiftDescription || undefined, startAt: shiftStart, endAt: shiftEnd || undefined, capacity: shiftCapacity ? Number(shiftCapacity) : undefined })}>
              Create Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Survey Dialog ────────────────────────────────────────────── */}
      <Dialog open={addSurveyOpen} onOpenChange={setAddSurveyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Survey</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <div><Label>Title</Label><Input value={surveyTitle} onChange={(e) => setSurveyTitle(e.target.value)} className="mt-1" /></div>
            <div><Label>Description</Label><Textarea value={surveyDescription} onChange={(e) => setSurveyDescription(e.target.value)} className="mt-1" rows={2} /></div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button disabled={!canWrite || !surveyTitle} onClick={() => createSurvey({ churchId, title: surveyTitle, description: surveyDescription || undefined })}>Create Survey</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Survey Question Dialog ───────────────────────────────────── */}
      <Dialog open={addQuestionOpen} onOpenChange={setAddQuestionOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Question</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <div>
              <Label>Survey</Label>
              <select value={surveyIdForQuestion} onChange={(e) => setSurveyIdForQuestion(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm">
                {surveys?.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
            <div><Label>Question</Label><Input value={surveyQuestionPrompt} onChange={(e) => setSurveyQuestionPrompt(e.target.value)} className="mt-1" /></div>
            <div>
              <Label>Type</Label>
              <select value={surveyQuestionType} onChange={(e) => setSurveyQuestionType(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm">
                {['TEXT', 'MULTIPLE_CHOICE', 'RATING', 'NPS'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {surveyQuestionType === 'MULTIPLE_CHOICE' && (
              <div><Label>Options (comma-separated)</Label><Input value={surveyQuestionOptions} onChange={(e) => setSurveyQuestionOptions(e.target.value)} className="mt-1" /></div>
            )}
            <div><Label>Order</Label><Input type="number" value={surveyQuestionOrder} onChange={(e) => setSurveyQuestionOrder(e.target.value)} className="mt-1 w-24" /></div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button disabled={!canWrite || !surveyQuestionPrompt}
              onClick={() => addSurveyQuestion({ surveyId: surveyIdForQuestion, prompt: surveyQuestionPrompt, type: surveyQuestionType as any, order: Number(surveyQuestionOrder), options: surveyQuestionOptions ? surveyQuestionOptions.split(',').map((s) => s.trim()) : undefined })}>
              Add Question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Tag Dialog ───────────────────────────────────────────────── */}
      <Dialog open={addTagOpen} onOpenChange={setAddTagOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Tag</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <div><Label>Name</Label><Input value={tagName} onChange={(e) => setTagName(e.target.value)} className="mt-1" /></div>
            <div><Label>Color (hex)</Label><Input value={tagColor} onChange={(e) => setTagColor(e.target.value)} placeholder="#3B82F6" className="mt-1" /></div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button disabled={!canWrite || !tagName} onClick={() => createTag({ churchId, name: tagName, color: tagColor || undefined })}>Create Tag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Milestone Dialog ─────────────────────────────────────────── */}
      <Dialog open={addMilestoneOpen} onOpenChange={setAddMilestoneOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Milestone</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <div>
              <Label>Type</Label>
              <select value={milestoneType} onChange={(e) => setMilestoneType(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm">
                {['BAPTISM', 'CONFIRMATION', 'MEMBERSHIP', 'DEDICATION', 'MARRIAGE', 'OTHER'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><Label>Date</Label><Input type="date" value={milestoneDate} onChange={(e) => setMilestoneDate(e.target.value)} className="mt-1" /></div>
            <div><Label>Notes</Label><Textarea value={milestoneNotes} onChange={(e) => setMilestoneNotes(e.target.value)} className="mt-1" rows={2} /></div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button disabled={!canWrite || !selectedMemberId || !milestoneDate}
              onClick={() => createMilestone({ memberId: selectedMemberId, type: milestoneType as any, date: new Date(milestoneDate), notes: milestoneNotes || undefined })}>
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Workflow Dialog ──────────────────────────────────────────── */}
      <Dialog open={addWorkflowOpen} onOpenChange={setAddWorkflowOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Workflow</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <div><Label>Name</Label><Input value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} className="mt-1" /></div>
            <div><Label>Description</Label><Textarea value={workflowDescription} onChange={(e) => setWorkflowDescription(e.target.value)} className="mt-1" rows={2} /></div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button disabled={!canWrite || !workflowName} onClick={() => createWorkflow({ churchId, name: workflowName, description: workflowDescription || undefined })}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Step Dialog ──────────────────────────────────────────────── */}
      <Dialog open={addStepOpen} onOpenChange={setAddStepOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Workflow Step</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <div>
              <Label>Workflow</Label>
              <select value={workflowIdForStep} onChange={(e) => setWorkflowIdForStep(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm">
                {workflows?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div><Label>Step name</Label><Input value={stepName} onChange={(e) => setStepName(e.target.value)} className="mt-1" /></div>
            <div>
              <Label>Type</Label>
              <select value={stepType} onChange={(e) => setStepType(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm">
                {['WELCOME_CALL', 'EMAIL', 'MEETING', 'SURVEY', 'CLASS', 'TASK', 'OTHER'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Order</Label><Input type="number" value={stepOrder} onChange={(e) => setStepOrder(e.target.value)} className="mt-1" /></div>
              <div><Label>Due (days)</Label><Input type="number" value={stepDueDays} onChange={(e) => setStepDueDays(e.target.value)} className="mt-1" /></div>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button disabled={!canWrite || !stepName || !workflowIdForStep}
              onClick={() => createStep({ workflowId: workflowIdForStep, name: stepName, type: stepType as any, order: Number(stepOrder), dueDays: Number(stepDueDays) })}>
              Add Step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Relationship Dialog ──────────────────────────────────────── */}
      <Dialog open={addRelationshipOpen} onOpenChange={setAddRelationshipOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Relationship</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <div>
              <Label>Related member</Label>
              <select value={relationshipToMemberId} onChange={(e) => setRelationshipToMemberId(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm">
                {members?.filter((m) => m.id !== selectedMemberId).map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
              </select>
            </div>
            <div>
              <Label>Type</Label>
              <select value={relationshipType} onChange={(e) => setRelationshipType(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm">
                {['SPOUSE', 'PARENT', 'CHILD', 'SIBLING', 'FRIEND', 'MENTOR', 'MENTEE'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><Label>Label (optional)</Label><Input value={relationshipLabel} onChange={(e) => setRelationshipLabel(e.target.value)} className="mt-1" /></div>
            <div><Label>Notes</Label><Textarea value={relationshipNotes} onChange={(e) => setRelationshipNotes(e.target.value)} className="mt-1" rows={2} /></div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={relationshipReciprocal} onChange={(e) => setRelationshipReciprocal(e.target.checked)} />
              Create reciprocal relationship
            </label>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button disabled={!canWrite || !relationshipToMemberId}
              onClick={() => createRelationship({ churchId, fromMemberId: selectedMemberId, toMemberId: relationshipToMemberId, type: relationshipType as any, label: relationshipLabel || undefined, notes: relationshipNotes || undefined, createReciprocal: relationshipReciprocal })}>
              Add Relationship
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
