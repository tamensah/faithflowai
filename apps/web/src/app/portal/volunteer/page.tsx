import {
  MemberPortalShell,
  MemberSectionCard,
  VOLUNTEER_SECTION_LINKS,
} from '../../../components/member-portal/member-portal-shell';

export default function VolunteerPage() {
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
          <select className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10">
            <option>Ministry role</option>
            <option>Worship</option>
            <option>Media</option>
            <option>Hospitality</option>
            <option>Kids</option>
          </select>
          <select className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10">
            <option>Day preference</option>
            <option>Sunday</option>
            <option>Saturday</option>
            <option>Wednesday</option>
          </select>
          <input
            className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            placeholder="Start time"
          />
          <input
            className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            placeholder="End time"
          />
          <textarea
            className="md:col-span-2 min-h-[96px] rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            placeholder="Notes (optional)"
          />
          <button
            type="button"
            className="w-fit rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Save availability
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
