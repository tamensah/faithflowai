'use client';

import { useEffect, useMemo, useState } from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Card, Input } from '@faithflow-ai/ui';

const providerOptions = [
  { value: 'STRIPE', label: 'Stripe' },
  { value: 'PAYSTACK', label: 'Paystack' },
];
const paystackCurrencyOptions = ['GHS', 'NGN', 'KES', 'ZAR', 'USD', 'XOF'];

function GivePageContent() {
  const params = useSearchParams();
  const [churchSlug, setChurchSlug] = useState('demo-church');
  const [amount, setAmount] = useState('50');
  const [provider, setProvider] = useState('STRIPE');
  const [currency, setCurrency] = useState('USD');
  const [fundId, setFundId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [fundraiserPageId, setFundraiserPageId] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBase = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    return base.replace(/\/trpc\/?$/, '');
  }, []);

  const successUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/give?status=success`;
  }, []);

  const cancelUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/give?status=cancel`;
  }, []);

  useEffect(() => {
    setCurrency(provider === 'PAYSTACK' ? 'GHS' : 'USD');
  }, [provider]);

  useEffect(() => {
    if (!params) return;
    const slug = params.get('church');
    const amountParam = params.get('amount');
    const providerParam = params.get('provider');
    const currencyParam = params.get('currency');
    const fundParam = params.get('fundId');
    const campaignParam = params.get('campaignId');
    const fundraiserParam = params.get('fundraiserPageId');

    if (slug) setChurchSlug(slug);
    if (amountParam) setAmount(amountParam);
    if (providerParam && ['STRIPE', 'PAYSTACK'].includes(providerParam)) {
      setProvider(providerParam);
    }
    if (currencyParam) setCurrency(currencyParam.toUpperCase());
    if (fundParam) setFundId(fundParam);
    if (campaignParam) setCampaignId(campaignParam);
    if (fundraiserParam) setFundraiserPageId(fundraiserParam);
  }, [params]);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/public/giving/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            churchSlug,
            amount: Number(amount),
            currency,
            provider,
            donorEmail: donorEmail || undefined,
            donorName: donorName || undefined,
            donorPhone: donorPhone || undefined,
            fundId: fundId || undefined,
            campaignId: campaignId || undefined,
            fundraiserPageId: fundraiserPageId || undefined,
            isAnonymous: isAnonymous || undefined,
            successUrl,
            cancelUrl,
          }),
      });

      if (!response.ok) {
        throw new Error('Unable to start checkout');
      }

      const payload = (await response.json()) as { checkoutUrl?: string };
      if (payload.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
      }
    } catch (err) {
      setError('Checkout failed. Please verify the church slug and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted">FaithFlow AI Giving</p>
          <h1 className="mt-3 text-4xl font-semibold text-foreground">Give to your church</h1>
          <p className="mt-3 text-muted">Secure giving with Stripe or Paystack.</p>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted">Church slug</label>
              <Input value={churchSlug} onChange={(event) => setChurchSlug(event.target.value)} />
            </div>

            <div>
              <label className="text-sm text-muted">Amount</label>
              <Input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </div>

            <div>
              <label className="text-sm text-muted">Currency</label>
              {provider === 'PAYSTACK' ? (
                <select
                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                >
                  {paystackCurrencyOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              ) : (
                <Input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
              )}
            </div>

            <div>
              <label className="text-sm text-muted">Provider</label>
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
              >
                {providerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-muted">Name (optional)</label>
              <Input value={donorName} onChange={(event) => setDonorName(event.target.value)} />
            </div>

            <div>
              <label className="text-sm text-muted">Email (required for Paystack)</label>
              <Input value={donorEmail} onChange={(event) => setDonorEmail(event.target.value)} />
            </div>

            <div>
              <label className="text-sm text-muted">Phone (optional)</label>
              <Input value={donorPhone} onChange={(event) => setDonorPhone(event.target.value)} />
            </div>

            <div className="flex items-center gap-2 text-sm text-muted">
              <input
                id="anonymous"
                type="checkbox"
                checked={isAnonymous}
                onChange={(event) => setIsAnonymous(event.target.checked)}
              />
              <label htmlFor="anonymous">Make this gift anonymous</label>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button
              onClick={handleSubmit}
              disabled={!amount || !churchSlug || isSubmitting || (provider === 'PAYSTACK' && !donorEmail)}
            >
              {isSubmitting ? 'Starting checkout…' : 'Continue to checkout'}
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}

export default function GivePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background px-6 py-12" />}>
      <GivePageContent />
    </Suspense>
  );
}
