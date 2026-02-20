import {
  MemberPortalShell,
  MemberSectionCard,
  MESSAGES_SECTION_LINKS,
} from '../../../components/member-portal/member-portal-shell';

export default function MessagesPage() {
  return (
    <MemberPortalShell
      title="Messages and updates"
      description="Follow direct communication from pastors, ministry leads, and support staff."
      sectionLinks={MESSAGES_SECTION_LINKS}
    >
      <MemberSectionCard
        id="inbox"
        title="Inbox"
        description="Direct messages from church staff and ministry teams."
      >
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
          No messages yet. Staff replies and ministry messages will appear here.
        </div>
      </MemberSectionCard>

      <MemberSectionCard
        id="announcements"
        title="Announcements"
        description="General updates posted by your church leadership."
      >
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          There are no active announcements.
        </div>
      </MemberSectionCard>

      <MemberSectionCard
        id="message-preferences"
        title="Message preferences"
        description="Configure communication channels for announcements and direct messages."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:max-w-2xl">
          {['In-app notifications', 'Email digest', 'SMS alerts', 'WhatsApp updates'].map((channel) => (
            <label key={channel} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <input
                defaultChecked={channel !== 'SMS alerts'}
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
              />
              {channel}
            </label>
          ))}
        </div>
      </MemberSectionCard>
    </MemberPortalShell>
  );
}
