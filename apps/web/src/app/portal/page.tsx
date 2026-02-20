import {
  COMMON_ACTION_BUTTON,
  MemberPortalShell,
  MemberSectionCard,
  MemberStatCard,
  OVERVIEW_SECTION_LINKS,
  PROFILE_ACTION_BUTTON,
} from '../../components/member-portal/member-portal-shell';

export default function PortalPage() {
  return (
    <MemberPortalShell
      title="Keep your church life in one place"
      description="Track attendance, giving, volunteer commitments, and care communication without jumping between disconnected pages."
      sectionLinks={OVERVIEW_SECTION_LINKS}
      actions={
        <>
          {PROFILE_ACTION_BUTTON}
          {COMMON_ACTION_BUTTON}
        </>
      }
    >
      <section id="snapshot" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MemberStatCard label="Engagement" value="72%" hint="3 services in last 30 days" />
        <MemberStatCard label="Giving" value="$420" hint="Month to date" />
        <MemberStatCard label="Volunteer shifts" value="2" hint="Upcoming assignments" />
        <MemberStatCard label="Readiness" value="86%" hint="2 profile items missing" />
      </section>

      <MemberSectionCard
        id="next-steps"
        title="Next steps"
        description="Complete these actions to unlock full participation across your church workspace."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            'Complete required identity fields',
            'Set privacy and notification preferences',
            'RSVP to your next event',
            'Add volunteer availability',
          ].map((item) => (
            <div
              key={item}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
            >
              {item}
            </div>
          ))}
        </div>
      </MemberSectionCard>

      <MemberSectionCard
        id="goals"
        title="Member goals"
        description="You can use this area as the default weekly checklist during beta onboarding and staff walkthroughs."
      >
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6">
          <p className="text-sm text-slate-600">
            No personal goals configured yet. Ask staff to enable growth goals and discipleship tracking for your church.
          </p>
        </div>
      </MemberSectionCard>
    </MemberPortalShell>
  );
}
