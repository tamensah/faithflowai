import {
  EVENTS_SECTION_LINKS,
  MemberPortalShell,
  MemberSectionCard,
} from '../../../components/member-portal/member-portal-shell';

export default function EventsPage() {
  return (
    <MemberPortalShell
      title="Events and attendance"
      description="Discover upcoming gatherings, RSVP quickly, and keep attendance records in sync."
      sectionLinks={EVENTS_SECTION_LINKS}
    >
      <MemberSectionCard
        id="upcoming-events"
        title="Upcoming events"
        description="Published events appear here with RSVP controls and attendance notes."
      >
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="text-base font-medium text-slate-800">No upcoming events yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Ask your church staff to publish an event to enable RSVP actions.
          </p>
          <button
            type="button"
            className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            Refresh events
          </button>
        </div>
      </MemberSectionCard>

      <MemberSectionCard
        id="attendance-history"
        title="Attendance history"
        description="Recent attendance snapshots help members and staff confirm participation trends."
      >
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          No attendance records in the last 90 days.
        </div>
      </MemberSectionCard>

      <MemberSectionCard
        id="event-alerts"
        title="Event reminders"
        description="Choose how often event notifications should be sent."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
          {['24-hour reminder', '1-hour reminder', 'Post-event follow-up', 'Volunteer-specific alerts'].map(
            (setting) => (
              <label key={setting} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <input
                  defaultChecked
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
                {setting}
              </label>
            )
          )}
        </div>
      </MemberSectionCard>
    </MemberPortalShell>
  );
}
