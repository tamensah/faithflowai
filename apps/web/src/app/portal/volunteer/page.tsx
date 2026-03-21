'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Input } from '@faithflow-ai/ui';
import { trpc } from '../../../lib/trpc';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return '—';
  return (typeof value === 'string' ? new Date(value) : value).toLocaleString();
};

export default function VolunteerPage() {
  const utils = trpc.useUtils();
  const { data: selfProfile } = trpc.member.selfProfile.useQuery(undefined, { retry: false });
  const churchId = selfProfile?.member?.churchId;

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

  const [availabilityRoleId, setAvailabilityRoleId] = useState('');
  const [availabilityDay, setAvailabilityDay] = useState('SUNDAY');
  const [availabilityStart, setAvailabilityStart] = useState('09:00');
  const [availabilityEnd, setAvailabilityEnd] = useState('12:00');
  const [availabilityNotes, setAvailabilityNotes] = useState('');
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  useEffect(() => {
    if (!availabilityRoleId && volunteerRoles?.length) setAvailabilityRoleId(volunteerRoles[0].id);
  }, [availabilityRoleId, volunteerRoles]);

  const { mutate: assignShift } = trpc.volunteer.selfAssignShift.useMutation();
  const { mutate: cancelShift } = trpc.volunteer.selfCancelShift.useMutation();
  const { mutate: setAvailability } = trpc.volunteer.setSelfAvailability.useMutation({
    onSuccess: async () => {
      setAvailabilityError(null);
      setAvailabilityNotes('');
      await utils.volunteer.selfAvailability.invalidate();
    },
  });
  const { mutate: deleteAvailability } = trpc.volunteer.deleteAvailability.useMutation({
    onSuccess: async () => {
      await utils.volunteer.selfAvailability.invalidate();
    },
  });

  const myShiftIds = useMemo(
    () => new Set(myAssignments?.map((a) => a.shiftId) ?? []),
    [myAssignments]
  );

  const availabilityStartValid = timeRegex.test(availabilityStart);
  const availabilityEndValid = timeRegex.test(availabilityEnd);
  const availabilityWindowValid =
    availabilityStartValid &&
    availabilityEndValid &&
    availabilityStart.replace(':', '') < availabilityEnd.replace(':', '');
  const canSaveAvailability = Boolean(
    availabilityDay && availabilityStart && availabilityEnd && availabilityWindowValid
  );

  return (
    <div className="space-y-6">
      {/* Shifts */}
      <Card className="p-4 sm:p-6">
        <h2 className="text-base font-semibold">Volunteer Shifts</h2>

        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-muted">Upcoming shifts</p>
          <div className="space-y-2">
            {shifts?.map((shift) => {
              const assignedCount =
                shift.assignments?.filter((a) => a.status !== 'CANCELED').length ?? 0;
              const capacity = shift.capacity ?? null;
              const isAssigned = myShiftIds.has(shift.id);
              return (
                <div key={shift.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{shift.title}</p>
                      <p className="text-xs text-muted">
                        {shift.role?.name ?? 'Role'} · {formatDateTime(shift.startAt)} →{' '}
                        {formatDateTime(shift.endAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="default">
                        {assignedCount}
                        {capacity ? ` / ${capacity}` : ''} assigned
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
            {!shifts?.length ? <p className="text-sm text-muted">No upcoming shifts.</p> : null}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-sm font-medium text-muted">My assignments</p>
          <div className="space-y-2">
            {myAssignments?.map((assignment) => (
              <div key={assignment.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{assignment.shift.title}</p>
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
            {!myAssignments?.length ? <p className="text-sm text-muted">No assignments yet.</p> : null}
          </div>
        </div>
      </Card>

      {/* Availability */}
      <Card className="p-4 sm:p-6">
        <h2 className="text-base font-semibold">Volunteer Availability</h2>
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
            {days.map((day) => (
              <option key={day} value={day}>
                {day.charAt(0) + day.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <Input
            type="time"
            placeholder="Start (HH:MM)"
            value={availabilityStart}
            onChange={(e) => {
              setAvailabilityError(null);
              setAvailabilityStart(e.target.value);
            }}
          />
          <Input
            type="time"
            placeholder="End (HH:MM)"
            value={availabilityEnd}
            onChange={(e) => {
              setAvailabilityError(null);
              setAvailabilityEnd(e.target.value);
            }}
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
              if (!canSaveAvailability) {
                setAvailabilityError(
                  'Enter a valid time window where start time is before end time.'
                );
                return;
              }
              setAvailabilityError(null);
              setAvailability({
                roleId: availabilityRoleId || undefined,
                dayOfWeek: availabilityDay as any,
                startTime: availabilityStart,
                endTime: availabilityEnd,
                notes: availabilityNotes || undefined,
              });
            }}
            disabled={!canSaveAvailability}
          >
            Save availability
          </Button>
          {availabilityError ? (
            <p className="mt-2 text-xs text-destructive">{availabilityError}</p>
          ) : null}
        </div>
        <div className="mt-4 space-y-2">
          {myAvailability?.map((slot) => (
            <div key={slot.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
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
          {!myAvailability?.length ? (
            <p className="text-sm text-muted">No availability recorded yet.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
