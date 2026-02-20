'use client';

import { ArrowUpRightIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useMemo } from 'react';
import { useMemberProgress } from '../../components/member-portal/member-progress';
import {
  MemberPortalShell,
  MemberSectionCard,
  MemberStatCard,
  OVERVIEW_SECTION_LINKS,
} from '../../components/member-portal/member-portal-shell';

const STEP_ITEMS = [
  {
    key: 'identity',
    label: 'Complete required identity fields',
    href: '/portal/profile#identity',
    helper: 'Add preferred name, phone, and country.',
  },
  {
    key: 'privacy',
    label: 'Set privacy and notification preferences',
    href: '/portal/profile#privacy',
    helper: 'Choose visibility and communication channels.',
  },
  {
    key: 'events',
    label: 'RSVP to your next event',
    href: '/portal/events#upcoming-events',
    helper: 'Confirm participation in upcoming activities.',
  },
  {
    key: 'volunteer',
    label: 'Add volunteer availability',
    href: '/portal/volunteer#availability',
    helper: 'Share where and when you can serve.',
  },
] as const;

export default function PortalPage() {
  const { progress, completedCount, totalCount, completionPercent } = useMemberProgress();
  const sortedSteps = useMemo(
    () =>
      [...STEP_ITEMS].sort((a, b) => {
        const left = progress[a.key];
        const right = progress[b.key];
        if (left === right) return 0;
        return left ? 1 : -1;
      }),
    [progress]
  );
  const nextIncompleteStep = sortedSteps.find((step) => !progress[step.key]);
  const heroAction = nextIncompleteStep ? (
    <Link
      href={nextIncompleteStep.href}
      className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
    >
      Continue setup
    </Link>
  ) : (
    <Link
      href="/portal/messages#announcements"
      className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
    >
      View announcements
    </Link>
  );

  return (
    <MemberPortalShell
      title="Keep your church life in one place"
      description="Track attendance, giving, volunteer commitments, and care communication without jumping between disconnected pages."
      sectionLinks={OVERVIEW_SECTION_LINKS}
      actions={heroAction}
    >
      <section id="snapshot" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MemberStatCard label="Engagement" value="72%" hint="3 services in last 30 days" />
        <MemberStatCard label="Giving" value="$420" hint="Month to date" />
        <MemberStatCard label="Volunteer shifts" value="2" hint="Upcoming assignments" />
        <MemberStatCard
          label="Readiness"
          value={`${completionPercent}%`}
          hint={`${completedCount}/${totalCount} setup actions completed`}
        />
      </section>

      <MemberSectionCard
        id="next-steps"
        title="Next steps"
        description={
          completedCount === totalCount
            ? 'All onboarding actions are complete. You can continue with events, giving, and care updates.'
            : 'Complete these actions to unlock full participation across your church workspace.'
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {sortedSteps.map((step) => {
            const completed = progress[step.key];
            return (
              <Link
                key={step.key}
                href={step.href}
                className={
                  completed
                    ? 'rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900'
                    : 'rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-white'
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{step.label}</span>
                  {completed ? (
                    <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <ArrowUpRightIcon className="h-4 w-4 text-slate-500" />
                  )}
                </div>
                <p className={completed ? 'mt-1 text-xs text-emerald-700' : 'mt-1 text-xs text-slate-500'}>
                  {completed ? 'Completed. Click to review.' : step.helper}
                </p>
              </Link>
            );
          })}
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
