'use client';

import { useMemo, useState } from 'react';
import {
  MemberPortalShell,
  MemberSectionCard,
  PRAYER_SECTION_LINKS,
} from '../../../components/member-portal/member-portal-shell';

export default function PrayerPage() {
  const [topic, setTopic] = useState('');
  const [details, setDetails] = useState('');
  const [privateToPastors, setPrivateToPastors] = useState(true);
  const [touched, setTouched] = useState(false);

  const canSubmit = useMemo(() => topic.trim().length > 0, [topic]);

  return (
    <MemberPortalShell
      title="Prayer and care requests"
      description="Submit prayer requests and care updates directly to your church support team."
      sectionLinks={PRAYER_SECTION_LINKS}
    >
      <MemberSectionCard
        id="request-form"
        title="Request form"
        description="Requests are routed to your pastoral care team with privacy controls."
      >
        <form
          className="space-y-3 lg:max-w-2xl"
          onChange={() => setTouched(true)}
          onSubmit={(event) => event.preventDefault()}
        >
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            placeholder="Prayer topic *"
          />
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            className="min-h-[120px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            placeholder="Details (optional)"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={privateToPastors}
              onChange={() => setPrivateToPastors((current) => !current)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
            />
            Keep request private to pastors only
          </label>
          {touched && !canSubmit ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Prayer topic is required.
            </p>
          ) : null}
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Submit request
          </button>
        </form>
      </MemberSectionCard>

      <MemberSectionCard
        id="active-requests"
        title="Active requests"
        description="Track open prayer requests and follow-up status."
      >
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
          No active requests.
        </div>
      </MemberSectionCard>

      <MemberSectionCard
        id="care-guidance"
        title="Care guidance"
        description="What to expect after submitting a request."
      >
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            Request acknowledgement target: under 24 hours.
          </li>
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            Escalation requests route to the pastoral care lead.
          </li>
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            Private requests remain limited to authorized care staff.
          </li>
        </ul>
      </MemberSectionCard>
    </MemberPortalShell>
  );
}
