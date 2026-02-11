'use client';

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { trpc } from '../../lib/trpc';

const providerOptions = [
  { value: 'STRIPE', label: 'Stripe' },
  { value: 'PAYSTACK', label: 'Paystack' },
];
const paystackCurrencyOptions = ['GHS', 'NGN', 'KES', 'ZAR', 'USD', 'XOF'];

export default function GivingPage() {
  const utils = trpc.useUtils();
  const [churchId, setChurchId] = useState('');
  const [amount, setAmount] = useState('50');
  const [provider, setProvider] = useState('STRIPE');
  const [currency, setCurrency] = useState('USD');
  const [donorEmail, setDonorEmail] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [fundId, setFundId] = useState<string>('');
  const [campaignId, setCampaignId] = useState<string>('');
  const [fundraiserPageId, setFundraiserPageId] = useState<string>('');
  const [newFundName, setNewFundName] = useState('');
  const [newFundDescription, setNewFundDescription] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignTarget, setNewCampaignTarget] = useState('');
  const [newFundraiserName, setNewFundraiserName] = useState('');
  const [newFundraiserSlug, setNewFundraiserSlug] = useState('');
  const [newFundraiserGoal, setNewFundraiserGoal] = useState('');
  const [newFundraiserMessage, setNewFundraiserMessage] = useState('');
  const [newFundraiserCampaignId, setNewFundraiserCampaignId] = useState('');
  const [textNumber, setTextNumber] = useState('');
  const [textProvider, setTextProvider] = useState('STRIPE');
  const [textCurrency, setTextCurrency] = useState('USD');
  const [textFundId, setTextFundId] = useState('');
  const [textCampaignId, setTextCampaignId] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const { data: churches } = trpc.church.list.useQuery({ organizationId: undefined });

  useEffect(() => {
    if (!churchId && churches?.length) {
      setChurchId(churches[0].id);
    }
  }, [churchId, churches]);

  const { data: funds } = trpc.fund.list.useQuery({ churchId: churchId || undefined });
  const { data: campaigns } = trpc.campaign.list.useQuery({ churchId: churchId || undefined });
  const { data: campaignStats } = trpc.campaign.stats.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: fundraiserStats } = trpc.fundraiser.stats.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );

  const { data: donations } = trpc.donation.list.useQuery(
    { churchId: churchId || undefined, limit: 20 },
    { enabled: Boolean(churchId) }
  );
  const { data: textNumbers } = trpc.textToGive.list.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: textMessages } = trpc.textToGive.messages.useQuery(
    { churchId: churchId || undefined, limit: 10 },
    { enabled: Boolean(churchId) }
  );

  const { mutate: createCheckout, isPending: isCreatingCheckout } = trpc.giving.createCheckout.useMutation({
    onSuccess: (result) => {
      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, '_blank', 'noopener');
      }
    },
  });

  const { mutate: createFund, isPending: isCreatingFund } = trpc.fund.create.useMutation({
    onSuccess: async () => {
      setNewFundName('');
      setNewFundDescription('');
      await utils.fund.list.invalidate();
    },
  });

  const { mutate: createCampaign, isPending: isCreatingCampaign } = trpc.campaign.create.useMutation({
    onSuccess: async () => {
      setNewCampaignName('');
      setNewCampaignTarget('');
      await utils.campaign.list.invalidate();
      await utils.campaign.stats.invalidate();
    },
  });

  const { mutate: createFundraiser, isPending: isCreatingFundraiser } = trpc.fundraiser.create.useMutation({
    onSuccess: async () => {
      setNewFundraiserName('');
      setNewFundraiserSlug('');
      setNewFundraiserGoal('');
      setNewFundraiserMessage('');
      setNewFundraiserCampaignId('');
      await utils.fundraiser.stats.invalidate();
    },
  });

  const { mutate: createTextNumber, isPending: isCreatingTextNumber } = trpc.textToGive.create.useMutation({
    onSuccess: async () => {
      setTextNumber('');
      setTextProvider('STRIPE');
      setTextCurrency('USD');
      setTextFundId('');
      setTextCampaignId('');
      await utils.textToGive.list.invalidate();
      await utils.textToGive.messages.invalidate();
    },
  });

  const baseSuccessUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/giving?status=success`;
  }, []);

  const baseCancelUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/giving?status=cancel`;
  }, []);

  useEffect(() => {
    setCurrency(provider === 'PAYSTACK' ? 'GHS' : 'USD');
  }, [provider]);

  const selectedChurch = churches?.find((church) => church.id === churchId);

  const shareLink = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
    const fundraiser = fundraiserStats?.find((item) => item.fundraiser.id === fundraiserPageId);
    if (fundraiser?.fundraiser.slug && selectedChurch?.slug) {
      return new URL(`/fundraisers/${selectedChurch.slug}/${fundraiser.fundraiser.slug}`, base).toString();
    }
    const url = new URL('/give', base);
    if (selectedChurch?.slug) {
      url.searchParams.set('church', selectedChurch.slug);
    }
    if (amount) {
      url.searchParams.set('amount', amount);
    }
    if (provider) {
      url.searchParams.set('provider', provider);
    }
    if (currency) {
      url.searchParams.set('currency', currency);
    }
    if (fundId) {
      url.searchParams.set('fundId', fundId);
    }
    if (campaignId) {
      url.searchParams.set('campaignId', campaignId);
    }
    return url.toString();
  }, [selectedChurch?.slug, amount, provider, currency, fundId, campaignId, fundraiserPageId, fundraiserStats]);

  useEffect(() => {
    if (!shareLink) return;
    QRCode.toDataURL(shareLink, { width: 200, margin: 1 })
      .then((url: string) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(null));
  }, [shareLink]);

  return (
    <Shell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Giving</h1>
          <p className="mt-2 text-muted">Create funds, campaigns, and live checkout links.</p>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Create checkout</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <label className="text-sm text-muted">Church</label>
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={churchId}
                onChange={(event) => setChurchId(event.target.value)}
              >
                {churches?.map((church) => (
                  <option key={church.id} value={church.id}>
                    {church.name}
                  </option>
                ))}
              </select>

              <label className="text-sm text-muted">Fund</label>
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={fundId}
                onChange={(event) => setFundId(event.target.value)}
              >
                <option value="">General</option>
                {funds?.map((fund) => (
                  <option key={fund.id} value={fund.id}>
                    {fund.name}
                  </option>
                ))}
              </select>

              <label className="text-sm text-muted">Campaign</label>
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={campaignId}
                onChange={(event) => setCampaignId(event.target.value)}
              >
                <option value="">None</option>
                {campaigns?.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>

              <label className="text-sm text-muted">Fundraiser page</label>
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={fundraiserPageId}
                onChange={(event) => setFundraiserPageId(event.target.value)}
              >
                <option value="">None</option>
                {fundraiserStats?.map((item) => (
                  <option key={item.fundraiser.id} value={item.fundraiser.id}>
                    {item.fundraiser.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-sm text-muted">Amount</label>
              <Input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />

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

              <label className="text-sm text-muted">Donor name</label>
              <Input value={donorName} onChange={(event) => setDonorName(event.target.value)} />

              <label className="text-sm text-muted">Donor email</label>
              <Input value={donorEmail} onChange={(event) => setDonorEmail(event.target.value)} />

              <label className="text-sm text-muted">Donor phone</label>
              <Input value={donorPhone} onChange={(event) => setDonorPhone(event.target.value)} />

              <Button
                onClick={() =>
                  createCheckout({
                    churchId,
                    amount: Number(amount),
                    currency,
                    provider: provider as 'STRIPE' | 'PAYSTACK',
                    donorName: donorName || undefined,
                    donorEmail: donorEmail || undefined,
                    donorPhone: donorPhone || undefined,
                    fundId: fundId || undefined,
                    campaignId: campaignId || undefined,
                    fundraiserPageId: fundraiserPageId || undefined,
                    successUrl: baseSuccessUrl || undefined,
                    cancelUrl: baseCancelUrl || undefined,
                  })
                }
                disabled={
                  !churchId || !amount || isCreatingCheckout || (provider === 'PAYSTACK' && !donorEmail)
                }
              >
                {isCreatingCheckout ? 'Creating…' : 'Create checkout link'}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Shareable giving link</h2>
          <p className="mt-2 text-sm text-muted">Use this link for QR codes, slides, and text-to-give.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="space-y-3">
              <Input value={shareLink} readOnly />
              <Button
                variant="outline"
                onClick={() => navigator.clipboard?.writeText(shareLink)}
                disabled={!shareLink}
              >
                Copy link
              </Button>
            </div>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR code" className="h-40 w-40 rounded-md border border-border" />
            ) : (
              <div className="flex h-40 w-40 items-center justify-center rounded-md border border-border text-xs text-muted">
                QR pending
              </div>
            )}
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Funds</h2>
            <div className="mt-4 space-y-2 text-sm text-muted">
              {funds?.map((fund) => (
                <div key={fund.id} className="flex items-center justify-between">
                  <span>{fund.name}</span>
                  <span>{fund.isDefault ? 'Default' : ''}</span>
                </div>
              ))}
              {!funds?.length && <p>No funds yet.</p>}
            </div>

            <div className="mt-4 grid gap-3">
              <Input
                placeholder="New fund name"
                value={newFundName}
                onChange={(event) => setNewFundName(event.target.value)}
              />
              <Input
                placeholder="Description"
                value={newFundDescription}
                onChange={(event) => setNewFundDescription(event.target.value)}
              />
              <Button
                onClick={() =>
                  createFund({
                    churchId,
                    name: newFundName,
                    description: newFundDescription || undefined,
                    isDefault: !funds?.length,
                  })
                }
                disabled={!churchId || !newFundName || isCreatingFund}
              >
                {isCreatingFund ? 'Creating…' : 'Create fund'}
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold">Campaigns</h2>
            <div className="mt-4 space-y-2 text-sm text-muted">
              {campaignStats?.map((item) => (
                <div key={item.campaign.id} className="flex items-center justify-between">
                  <span>{item.campaign.name}</span>
                  <span>
                    {Object.entries(item.totals)
                      .map(([curr, total]) => `${total.toFixed(2)} ${curr}`)
                      .join(', ') || '0'}
                  </span>
                </div>
              ))}
              {!campaignStats?.length && <p>No campaigns yet.</p>}
            </div>

            <div className="mt-4 grid gap-3">
              <Input
                placeholder="Campaign name"
                value={newCampaignName}
                onChange={(event) => setNewCampaignName(event.target.value)}
              />
              <Input
                placeholder="Target amount (optional)"
                type="number"
                value={newCampaignTarget}
                onChange={(event) => setNewCampaignTarget(event.target.value)}
              />
              <Button
                onClick={() =>
                  createCampaign({
                    churchId,
                    name: newCampaignName,
                    targetAmount: newCampaignTarget ? Number(newCampaignTarget) : undefined,
                    currency,
                  })
                }
                disabled={!churchId || !newCampaignName || isCreatingCampaign}
              >
                {isCreatingCampaign ? 'Creating…' : 'Create campaign'}
              </Button>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Fundraiser pages</h2>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {fundraiserStats?.map((item) => (
              <div key={item.fundraiser.id} className="flex items-center justify-between">
                <span>
                  {item.fundraiser.name} · {item.fundraiser.slug}
                </span>
                <span>
                  {Object.entries(item.totals)
                    .map(([curr, total]) => `${total.toFixed(2)} ${curr}`)
                    .join(', ') || '0'}
                </span>
              </div>
            ))}
            {!fundraiserStats?.length && <p>No fundraisers yet.</p>}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Fundraiser name"
              value={newFundraiserName}
              onChange={(event) => setNewFundraiserName(event.target.value)}
            />
            <Input
              placeholder="Slug (e.g. youth-mission)"
              value={newFundraiserSlug}
              onChange={(event) => setNewFundraiserSlug(event.target.value)}
            />
            <Input
              placeholder="Goal amount (optional)"
              type="number"
              value={newFundraiserGoal}
              onChange={(event) => setNewFundraiserGoal(event.target.value)}
            />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={newFundraiserCampaignId}
              onChange={(event) => setNewFundraiserCampaignId(event.target.value)}
            >
              <option value="">Link to campaign (optional)</option>
              {campaigns?.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
            <Input
              placeholder="Short message (optional)"
              value={newFundraiserMessage}
              onChange={(event) => setNewFundraiserMessage(event.target.value)}
            />
            <Button
              onClick={() =>
                createFundraiser({
                  churchId,
                  name: newFundraiserName,
                  slug: newFundraiserSlug,
                  goalAmount: newFundraiserGoal ? Number(newFundraiserGoal) : undefined,
                  currency,
                  message: newFundraiserMessage || undefined,
                  campaignId: newFundraiserCampaignId || undefined,
                })
              }
              disabled={!churchId || !newFundraiserName || !newFundraiserSlug || isCreatingFundraiser}
            >
              {isCreatingFundraiser ? 'Creating…' : 'Create fundraiser'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Text-to-give</h2>
          <p className="mt-1 text-sm text-muted">Bind Twilio numbers to churches for SMS giving.</p>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {textNumbers?.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <span>
                  {item.phoneNumber} · {item.provider} · {item.defaultCurrency}
                </span>
                <span>{item.fund?.name ?? 'General'}</span>
              </div>
            ))}
            {!textNumbers?.length && <p>No text-to-give numbers yet.</p>}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Twilio number (E.164)"
              value={textNumber}
              onChange={(event) => setTextNumber(event.target.value)}
            />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={textProvider}
              onChange={(event) => setTextProvider(event.target.value)}
            >
              <option value="STRIPE">Stripe</option>
              <option value="PAYSTACK">Paystack</option>
            </select>
            <Input
              placeholder="Default currency"
              value={textCurrency}
              onChange={(event) => setTextCurrency(event.target.value.toUpperCase())}
            />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={textFundId}
              onChange={(event) => setTextFundId(event.target.value)}
            >
              <option value="">Default fund</option>
              {funds?.map((fund) => (
                <option key={fund.id} value={fund.id}>
                  {fund.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={textCampaignId}
              onChange={(event) => setTextCampaignId(event.target.value)}
            >
              <option value="">Optional campaign</option>
              {campaigns?.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
            <Button
              onClick={() =>
                createTextNumber({
                  churchId,
                  phoneNumber: textNumber,
                  provider: textProvider as 'STRIPE' | 'PAYSTACK',
                  defaultCurrency: textCurrency,
                  fundId: textFundId || undefined,
                  campaignId: textCampaignId || undefined,
                })
              }
              disabled={!churchId || !textNumber || isCreatingTextNumber}
            >
              {isCreatingTextNumber ? 'Creating…' : 'Add text-to-give number'}
            </Button>
          </div>
          <div className="mt-6 text-sm text-muted">
            <p className="font-medium text-foreground">Recent SMS</p>
            <div className="mt-2 space-y-2">
              {textMessages?.map((msg) => (
                <div key={msg.id} className="flex items-center justify-between">
                  <span>
                    {msg.fromNumber} → {msg.toNumber} · {msg.body}
                  </span>
                  <span>{msg.status}</span>
                </div>
              ))}
              {!textMessages?.length && <p>No inbound SMS yet.</p>}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Recent donations</h2>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {donations?.map((donation) => (
              <div key={donation.id} className="flex items-center justify-between">
                <span>
                  {donation.isAnonymous
                    ? 'Anonymous'
                    : donation.donorName || donation.member?.firstName || 'Anonymous'}{' '}
                  · {donation.amount.toString()} {donation.currency}
                </span>
                <span>{donation.status}</span>
              </div>
            ))}
            {!donations?.length && <p>No donations yet.</p>}
          </div>
        </Card>
      </div>
    </Shell>
  );
}
