import {
  GIVING_SECTION_LINKS,
  MemberPortalShell,
  MemberSectionCard,
} from '../../../components/member-portal/member-portal-shell';

export default function GivingPage() {
  return (
    <MemberPortalShell
      title="Giving and commitments"
      description="Manage one-time giving, recurring plans, and receipts with clearer financial controls."
      sectionLinks={GIVING_SECTION_LINKS}
    >
      <MemberSectionCard
        id="giving-summary"
        title="Giving summary"
        description="Current giving totals and trend indicators for this member account."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">This month</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">$0</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Year to date</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">$0</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Last gift</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">-</p>
          </div>
        </div>
      </MemberSectionCard>

      <MemberSectionCard
        id="recurring-plan"
        title="Recurring plan"
        description="Set recurring giving using your preferred cadence."
      >
        <form className="grid gap-3 lg:max-w-2xl lg:grid-cols-2">
          <input
            placeholder="Amount"
            className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
          <select className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10">
            <option>Monthly</option>
            <option>Weekly</option>
            <option>Bi-weekly</option>
          </select>
          <select className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10">
            <option>Stripe (USD)</option>
            <option>Paystack (Local)</option>
          </select>
          <button
            type="button"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Save recurring plan
          </button>
        </form>
      </MemberSectionCard>

      <MemberSectionCard
        id="receipts"
        title="Receipts"
        description="Download available receipts and contribution statements."
      >
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
          Receipts will appear after your first successful payment.
        </div>
      </MemberSectionCard>
    </MemberPortalShell>
  );
}
