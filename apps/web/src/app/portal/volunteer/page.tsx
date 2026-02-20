'use client';

import { useState } from 'react';
import { setMemberStepComplete, useMemberProgress } from '../../../components/member-portal/member-progress';
import {
  MemberPortalShell,
  MemberSectionCard,
  VOLUNTEER_SECTION_LINKS,
} from '../../../components/member-portal/member-portal-shell';

export default function VolunteerPage() {
  const { progress } = useMemberProgress();
  const [form, setForm] = useState({
    role: '',
    day: '',
    start: '',
    end: '',
    notes: '',
  });
  const [touched, setTouched] = useState(false);

  const canSave = form.role && form.day && form.start && form.end;

  return (
    <MemberPortalShell
      title="Volunteer planning"
      description="Share ministry availability and track serving assignments from a single workflow."
      sectionLinks={VOLUNTEER_SECTION_LINKS}
    >
      <MemberSectionCard
        id="availability"
        title="Availability"
        description="Submit preferred ministry roles and available times."
      >
        <form className="grid gap-3 md:grid-cols-2">
          <select
            className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            value={form.role}
            onChange={(event) => {
              setTouched(true);
              setForm((current) => ({ ...current, role: event.target.value }));
            }}
          >
            <option value="">Ministry role</option>
            <option>Worship</option>
            <option>Media</option>
            <option>Hospitality</option>
            <option>Kids</option>
          </select>
          <select
            className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            value={form.day}
            onChange={(event) => {
              setTouched(true);
              setForm((current) => ({ ...current, day: event.target.value }));
            }}
          >
            <option value="">Day preference</option>
            <option>Sunday</option>
            <option>Saturday</option>
            <option>Wednesday</option>
          </select>
          <input
            className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            placeholder="Start time"
            value={form.start}
            onChange={(event) => {
              setTouched(true);
              setForm((current) => ({ ...current, start: event.target.value }));
            }}
          />
          <input
            className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            placeholder="End time"
            value={form.end}
            onChange={(event) => {
              setTouched(true);
              setForm((current) => ({ ...current, end: event.target.value }));
            }}
          />
          <textarea
            className="md:col-span-2 min-h-[96px] rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(event) => {
              setTouched(true);
              setForm((current) => ({ ...current, notes: event.target.value }));
            }}
          />
          {touched && !canSave ? (
            <p className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Add role, day, and start/end times to save availability.
            </p>
          ) : null}
          <button
            type="button"
            disabled={!canSave}
            onClick={() => setMemberStepComplete('volunteer', true)}
            className="w-fit rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {progress.volunteer ? 'Availability saved' : 'Save availability'}
          </button>
        </form>
      </MemberSectionCard>

      <MemberSectionCard
        id="assignments"
        title="Assignments"
        description="Current volunteer assignments and service schedule."
      >
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
          No assignments yet. Staff assignments will appear here after scheduling.
        </div>
      </MemberSectionCard>

      <MemberSectionCard
        id="preferences"
        title="Service preferences"
        description="Set assignment reminders and assignment change notifications."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {['Shift reminder 24h before', 'Shift reminder 2h before', 'Assignment change alert', 'Team lead updates'].map(
            (item) => (
              <label key={item} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <input
                  defaultChecked
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
                {item}
              </label>
            )
          )}
        </div>
      </MemberSectionCard>
    </MemberPortalShell>
  );
}
