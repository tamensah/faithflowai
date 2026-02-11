'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input } from '@faithflow-ai/ui';

type Fundraiser = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  campaignId?: string | null;
};

type Props = {
  churchSlug: string;
  fundraiser: Fundraiser;
};

const providerOptions = [
  { value: 'STRIPE', label: 'Stripe' },
  { value: 'PAYSTACK', label: 'Paystack' },
];
const paystackCurrencyOptions = ['GHS', 'NGN', 'KES', 'ZAR', 'USD', 'XOF'];

export default function FundraiserGiveForm({ churchSlug, fundraiser }: Props) {
  const [amount, setAmount] = useState('50');
  const [provider, setProvider] = useState('STRIPE');
  const [currency, setCurrency] = useState(fundraiser.currency || 'USD');
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

  useEffect(() => {
    setCurrency(provider === 'PAYSTACK' ? 'GHS' : fundraiser.currency || 'USD');
  }, [provider, fundraiser.currency]);

  const successUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/fundraisers/${churchSlug}/${encodeURIComponent(fundraiser.slug)}?status=success`;
  }, [churchSlug, fundraiser.slug]);

  const cancelUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/fundraisers/${churchSlug}/${encodeURIComponent(fundraiser.slug)}?status=cancel`;
  }, [churchSlug, fundraiser.slug]);

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
          fundraiserPageId: fundraiser.id,
          campaignId: fundraiser.campaignId ?? undefined,
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
      setError('Checkout failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
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
          disabled={!amount || isSubmitting || (provider === 'PAYSTACK' && !donorEmail)}
        >
          {isSubmitting ? 'Starting checkout…' : 'Continue to checkout'}
        </Button>
      </div>
    </Card>
  );
}
