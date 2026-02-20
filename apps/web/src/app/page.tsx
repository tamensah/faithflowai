import Link from 'next/link';

export default function Home() {
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin-gamma-beryl.vercel.app';

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <p className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
          FaithFlow AI
        </p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Trustworthy, modern church operations.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-slate-600">
          Use the refined member and admin experiences to validate end-to-end portal usability before
          beta onboarding.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Member portal</h2>
            <p className="mt-2 text-sm text-slate-600">
              Structured navigation, sticky section guide, and stronger form-state validation.
            </p>
            <Link
              href="/portal"
              className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open portal
            </Link>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Admin dashboard</h2>
            <p className="mt-2 text-sm text-slate-600">
              Continue validating platform ops and contextual sidebars in the admin app.
            </p>
            <a
              href={adminUrl}
              className="mt-5 inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Open admin
            </a>
          </article>
        </div>
      </div>
    </main>
  );
}
