import { notFound } from 'next/navigation';
import FundraiserGiveForm from './FundraiserGiveForm';

type FundraiserPayload = {
  fundraiser: {
    id: string;
    name: string;
    slug: string;
    message?: string | null;
    currency: string;
    goalAmount?: string | null;
    church: { name: string; slug: string };
    campaign?: { name: string } | null;
    campaignId?: string | null;
  };
  totals: { currency: string; _sum: { amount: string | null } }[];
};

export default async function FundraiserPage({
  params,
}: {
  params: { churchSlug: string; slug: string };
}) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const base = apiBase.replace(/\/trpc\/?$/, '');
  const response = await fetch(`${base}/public/fundraisers/${params.churchSlug}/${params.slug}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    notFound();
  }

  const payload = (await response.json()) as FundraiserPayload;
  const { fundraiser, totals } = payload;

  const totalByCurrency = totals.reduce<Record<string, number>>((acc, entry) => {
    const amount = entry._sum.amount ? Number(entry._sum.amount) : 0;
    acc[entry.currency] = (acc[entry.currency] ?? 0) + amount;
    return acc;
  }, {});

  const raised = fundraiser.currency ? totalByCurrency[fundraiser.currency] ?? 0 : 0;
  const goalAmount = fundraiser.goalAmount ? Number(fundraiser.goalAmount) : null;
  const progress = goalAmount && goalAmount > 0 ? Math.min(100, (raised / goalAmount) * 100) : null;

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted">{fundraiser.church.name}</p>
          <h1 className="mt-3 text-4xl font-semibold text-foreground">{fundraiser.name}</h1>
          {fundraiser.campaign?.name && (
            <p className="mt-2 text-sm text-muted">Campaign: {fundraiser.campaign.name}</p>
          )}
          {fundraiser.message && <p className="mt-4 text-muted">{fundraiser.message}</p>}
        </div>

        <div className="rounded-xl border border-border bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted">Raised</p>
              <p className="text-2xl font-semibold text-foreground">
                {raised.toFixed(2)} {fundraiser.currency}
              </p>
            </div>
            {goalAmount !== null && (
              <div>
                <p className="text-sm text-muted">Goal</p>
                <p className="text-2xl font-semibold text-foreground">
                  {goalAmount.toFixed(2)} {fundraiser.currency}
                </p>
              </div>
            )}
          </div>
          {progress !== null && (
            <div className="mt-4">
              <div className="h-2 w-full rounded-full bg-muted/20">
                <div className="h-2 rounded-full bg-foreground" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted">{progress.toFixed(1)}% funded</p>
            </div>
          )}
        </div>

        <FundraiserGiveForm churchSlug={fundraiser.church.slug} fundraiser={fundraiser} />
      </div>
    </main>
  );
}
