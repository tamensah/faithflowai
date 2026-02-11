'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { trpc } from '../../lib/trpc';
import { useAuth } from '@clerk/nextjs';

const evidenceTypeOptions = [
  'UNCATEGORIZED',
  'RECEIPT',
  'CUSTOMER_COMMUNICATION',
  'PRODUCT_DESCRIPTION',
  'REFUND_POLICY',
  'CUSTOMER_EMAIL',
  'CUSTOMER_NAME',
  'SHIPPING_DOCUMENTATION',
  'SHIPPING_TRACKING',
  'SHIPPING_DATE',
  'SERVICE_DOCUMENTATION',
  'SERVICE_DATE',
];

export default function FinancePage() {
  const utils = trpc.useUtils();
  const { getToken } = useAuth();
  const [churchId, setChurchId] = useState('');
  const [statementYear, setStatementYear] = useState(String(new Date().getFullYear()));
  const [statementMemberId, setStatementMemberId] = useState('');
  const [statementEmail, setStatementEmail] = useState('');

  const [pledgeAmount, setPledgeAmount] = useState('100');
  const [pledgeCurrency, setPledgeCurrency] = useState('USD');
  const [pledgeNotes, setPledgeNotes] = useState('');

  const [recurringAmount, setRecurringAmount] = useState('25');
  const [recurringCurrency, setRecurringCurrency] = useState('USD');
  const [recurringInterval, setRecurringInterval] = useState('MONTHLY');
  const [recurringProvider, setRecurringProvider] = useState('STRIPE');
  const [recurringDonorEmail, setRecurringDonorEmail] = useState('');

  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');

  const [expenseAmount, setExpenseAmount] = useState('50');
  const [expenseCurrency, setExpenseCurrency] = useState('USD');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseCategoryId, setExpenseCategoryId] = useState('');

  const [budgetName, setBudgetName] = useState('');
  const [budgetStart, setBudgetStart] = useState('');
  const [budgetEnd, setBudgetEnd] = useState('');
  const [budgetItemName, setBudgetItemName] = useState('');
  const [budgetItemAmount, setBudgetItemAmount] = useState('1000');
  const [budgetItemCategoryId, setBudgetItemCategoryId] = useState('');
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [receiptEmail, setReceiptEmail] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [selectedPayoutId, setSelectedPayoutId] = useState('');
  const [refundDonationId, setRefundDonationId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundLookbackDays, setRefundLookbackDays] = useState('90');
  const [trendMonths, setTrendMonths] = useState('12');
  const [segmentLookbackMonths, setSegmentLookbackMonths] = useState('18');
  const [selectedDisputeId, setSelectedDisputeId] = useState('');
  const [evidenceType, setEvidenceType] = useState('UNCATEGORIZED');
  const [evidenceText, setEvidenceText] = useState('');
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [submitAfterUpload, setSubmitAfterUpload] = useState(false);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);

  const { data: churches } = trpc.church.list.useQuery({ organizationId: undefined });
  const { data: members } = trpc.member.list.useQuery({ churchId: churchId || undefined }, { enabled: Boolean(churchId) });

  useEffect(() => {
    if (!churchId && churches?.length) {
      setChurchId(churches[0].id);
    }
  }, [churchId, churches]);

  const { data: summary } = trpc.finance.reconciliationSummary.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: dashboard } = trpc.finance.dashboard.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: mismatches } = trpc.finance.reconciliationMismatches.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: donorInsights } = trpc.finance.donorInsights.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: donationTrends } = trpc.finance.donationTrends.useQuery(
    { churchId: churchId || undefined, months: Number(trendMonths || '12') },
    { enabled: Boolean(churchId) }
  );
  const { data: donationForecast } = trpc.finance.donationForecast.useQuery(
    { churchId: churchId || undefined, months: Number(trendMonths || '12') },
    { enabled: Boolean(churchId) }
  );
  const { data: donorSegments } = trpc.finance.donorSegments.useQuery(
    { churchId: churchId || undefined, lookbackMonths: Number(segmentLookbackMonths || '18') },
    { enabled: Boolean(churchId) }
  );
  const { data: aiInsights, isFetching: isFetchingInsights, refetch: refetchInsights } =
    trpc.insights.donorSummary.useQuery(
      { churchId: churchId || undefined },
      { enabled: Boolean(churchId) }
    );

  const { data: statement } = trpc.finance.tithingStatement.useQuery(
    {
      churchId: churchId || undefined,
      year: Number(statementYear),
      memberId: statementMemberId || undefined,
      donorEmail: statementEmail || undefined,
    },
    { enabled: Boolean(churchId && (statementMemberId || statementEmail)) }
  );

  const { data: pledges } = trpc.pledge.list.useQuery({ churchId: churchId || undefined }, { enabled: Boolean(churchId) });
  const { data: recurring } = trpc.recurring.list.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: categories } = trpc.expenseCategory.list.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: expenses } = trpc.expense.list.useQuery({ churchId: churchId || undefined }, { enabled: Boolean(churchId) });
  const { data: budgets } = trpc.budget.list.useQuery({ churchId: churchId || undefined }, { enabled: Boolean(churchId) });
  const { data: receipts } = trpc.receipt.list.useQuery({ churchId: churchId || undefined, limit: 20 }, { enabled: Boolean(churchId) });
  const { data: auditLogs } = trpc.audit.list.useQuery(
    { churchId: churchId || undefined, limit: 20 },
    { enabled: Boolean(churchId) }
  );
  const { data: payouts } = trpc.finance.listPayouts.useQuery(
    { churchId: churchId || undefined, limit: 20 },
    { enabled: Boolean(churchId) }
  );
  const { data: payoutTransactions } = trpc.finance.payoutTransactions.useQuery(
    { payoutId: selectedPayoutId, limit: 20 },
    { enabled: Boolean(selectedPayoutId) }
  );
  const { data: refunds } = trpc.finance.refunds.useQuery(
    { churchId: churchId || undefined, limit: 20 },
    { enabled: Boolean(churchId) }
  );
  const { data: disputes } = trpc.finance.disputes.useQuery(
    { churchId: churchId || undefined, limit: 20 },
    { enabled: Boolean(churchId) }
  );
  const { data: disputeSummary } = trpc.finance.disputeSummary.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: refundAnalytics } = trpc.finance.refundAnalytics.useQuery(
    { churchId: churchId || undefined, lookbackDays: Number(refundLookbackDays) },
    { enabled: Boolean(churchId) }
  );
  const { data: disputeEvidence } = trpc.finance.disputeEvidence.useQuery(
    { disputeId: selectedDisputeId },
    { enabled: Boolean(selectedDisputeId) }
  );

  useEffect(() => {
    if (!selectedBudgetId && budgets?.length) {
      setSelectedBudgetId(budgets[0].id);
    }
  }, [selectedBudgetId, budgets]);

  const { mutate: createPledge, isPending: isCreatingPledge } = trpc.pledge.create.useMutation({
    onSuccess: async () => {
      setPledgeNotes('');
      await utils.pledge.list.invalidate();
    },
  });

  const { mutate: createRecurring, isPending: isCreatingRecurring } = trpc.recurring.createCheckout.useMutation({
    onSuccess: async (result) => {
      await utils.recurring.list.invalidate();
      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, '_blank', 'noopener');
      }
    },
  });
  const { mutate: chargeRecurring } = trpc.recurring.chargeNow.useMutation({
    onSuccess: () => utils.recurring.list.invalidate(),
  });

  const { mutate: createCategory, isPending: isCreatingCategory } = trpc.expenseCategory.create.useMutation({
    onSuccess: async () => {
      setCategoryName('');
      setCategoryDescription('');
      await utils.expenseCategory.list.invalidate();
    },
  });

  const { mutate: createExpense, isPending: isCreatingExpense } = trpc.expense.create.useMutation({
    onSuccess: async () => {
      setExpenseDescription('');
      await utils.expense.list.invalidate();
    },
  });

  const { mutate: approveExpense } = trpc.expense.approve.useMutation({
    onSuccess: () => utils.expense.list.invalidate(),
  });
  const { mutate: rejectExpense } = trpc.expense.reject.useMutation({
    onSuccess: () => utils.expense.list.invalidate(),
  });
  const { mutate: markPaid } = trpc.expense.markPaid.useMutation({
    onSuccess: () => utils.expense.list.invalidate(),
  });

  const { mutate: createBudget, isPending: isCreatingBudget } = trpc.budget.create.useMutation({
    onSuccess: async () => {
      setBudgetName('');
      setBudgetStart('');
      setBudgetEnd('');
      await utils.budget.list.invalidate();
    },
  });

  const { mutate: addBudgetItem, isPending: isAddingBudgetItem } = trpc.budget.addItem.useMutation({
    onSuccess: async () => {
      setBudgetItemName('');
      await utils.budget.list.invalidate();
    },
  });

  const { mutate: sendReceiptEmail, isPending: isSendingReceipt } = trpc.receipt.sendEmail.useMutation({
    onSuccess: () => {
      setReceiptEmail('');
      setReceiptNumber('');
    },
  });
  const { mutate: voidReceipt, isPending: isVoidingReceipt } = trpc.receipt.void.useMutation({
    onSuccess: () => {
      setReceiptNumber('');
      setVoidReason('');
      utils.receipt.list.invalidate();
    },
  });
  const { mutate: refundDonation, isPending: isRefundingDonation } = trpc.finance.refundDonation.useMutation({
    onSuccess: () => {
      setRefundDonationId('');
      setRefundAmount('');
      setRefundReason('');
      utils.finance.refunds.invalidate();
      utils.donation.list.invalidate();
    },
  });
  const { mutate: submitDispute, isPending: isSubmittingDispute } = trpc.finance.submitDispute.useMutation({
    onSuccess: () => utils.finance.disputes.invalidate(),
  });
  const { mutate: submitEvidenceText, isPending: isSubmittingEvidence } =
    trpc.finance.submitDisputeEvidenceText.useMutation({
      onSuccess: () => {
        setEvidenceText('');
        setEvidenceDescription('');
        utils.finance.disputeEvidence.invalidate();
        utils.finance.disputes.invalidate();
      },
    });

  const uploadEvidenceFile = async () => {
    if (!selectedDisputeId || !evidenceFile) return;
    setIsUploadingEvidence(true);
    try {
      const token = await getToken();
      const form = new FormData();
      form.append('type', evidenceType);
      if (evidenceDescription) form.append('description', evidenceDescription);
      if (evidenceText) form.append('text', evidenceText);
      if (submitAfterUpload) form.append('submit', 'true');
      form.append('file', evidenceFile);

      const response = await fetch(`/api/v1/disputes/${selectedDisputeId}/evidence`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Upload failed');
      }

      setEvidenceFile(null);
      setEvidenceText('');
      setEvidenceDescription('');
      setSubmitAfterUpload(false);
      await utils.finance.disputeEvidence.invalidate();
      await utils.finance.disputes.invalidate();
    } catch (error) {
      console.error(error);
    } finally {
      setIsUploadingEvidence(false);
    }
  };
  const { mutate: syncStripePayouts, isPending: isSyncingStripe } = trpc.finance.syncStripePayouts.useMutation({
    onSuccess: () => utils.finance.listPayouts.invalidate(),
  });
  const { mutate: syncPaystackSettlements, isPending: isSyncingPaystack } =
    trpc.finance.syncPaystackSettlements.useMutation({
      onSuccess: () => utils.finance.listPayouts.invalidate(),
    });

  return (
    <Shell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Finance</h1>
          <p className="mt-2 text-muted">Reconciliation, pledges, recurring giving, budgets, and expenses.</p>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Reconciliation</h2>
          <div className="mt-4 text-sm text-muted">
            <p>Dashboard (YTD totals by currency)</p>
            <pre className="rounded-md bg-muted/10 p-3 text-xs">
              {JSON.stringify(dashboard ?? {}, null, 2)}
            </pre>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2 text-sm text-muted">
              <p>Payment intents (by status)</p>
              <pre className="rounded-md bg-muted/10 p-3 text-xs">
                {JSON.stringify(summary?.paymentIntents ?? [], null, 2)}
              </pre>
            </div>
            <div className="space-y-2 text-sm text-muted">
              <p>Donations (by status)</p>
              <pre className="rounded-md bg-muted/10 p-3 text-xs">
                {JSON.stringify(summary?.donations ?? [], null, 2)}
              </pre>
            </div>
          </div>
          <div className="mt-4 text-sm text-muted">
            Delta (successful intents - completed donations): {summary?.totals?.delta ?? 0}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm text-muted">
            <div>
              <p>Mismatched intents</p>
              <pre className="rounded-md bg-muted/10 p-3 text-xs">
                {JSON.stringify(mismatches?.intentWithoutCompletedDonation ?? [], null, 2)}
              </pre>
            </div>
            <div>
              <p>Mismatched donations</p>
              <pre className="rounded-md bg-muted/10 p-3 text-xs">
                {JSON.stringify(mismatches?.donationWithPendingIntent ?? [], null, 2)}
              </pre>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Donor insights</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm text-muted">
            <div>
              <p>Members</p>
              <pre className="rounded-md bg-muted/10 p-3 text-xs">
                {JSON.stringify(donorInsights?.members ?? [], null, 2)}
              </pre>
            </div>
            <div>
              <p>Anonymous</p>
              <pre className="rounded-md bg-muted/10 p-3 text-xs">
                {JSON.stringify(donorInsights?.anonymous ?? [], null, 2)}
              </pre>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Donation trends</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Months"
              type="number"
              value={trendMonths}
              onChange={(event) => setTrendMonths(event.target.value)}
            />
          </div>
          <div className="mt-4 text-sm text-muted">
            <p className="mb-2">Trends</p>
            <pre className="rounded-md bg-muted/10 p-3 text-xs">
              {JSON.stringify(donationTrends ?? {}, null, 2)}
            </pre>
            <p className="mb-2 mt-4">Forecast</p>
            <pre className="rounded-md bg-muted/10 p-3 text-xs">
              {JSON.stringify(donationForecast ?? {}, null, 2)}
            </pre>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Donor segments</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Lookback months"
              type="number"
              value={segmentLookbackMonths}
              onChange={(event) => setSegmentLookbackMonths(event.target.value)}
            />
          </div>
          <div className="mt-4 text-sm text-muted">
            <pre className="rounded-md bg-muted/10 p-3 text-xs">
              {JSON.stringify(donorSegments ?? {}, null, 2)}
            </pre>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Refund analytics</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Lookback days"
              type="number"
              value={refundLookbackDays}
              onChange={(event) => setRefundLookbackDays(event.target.value)}
            />
          </div>
          <div className="mt-4 text-sm text-muted">
            <pre className="rounded-md bg-muted/10 p-3 text-xs">
              {JSON.stringify(refundAnalytics ?? {}, null, 2)}
            </pre>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">AI donor insights</h2>
            <Button variant="outline" onClick={() => refetchInsights()} disabled={isFetchingInsights}>
              {isFetchingInsights ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
          <div className="mt-4 text-sm text-muted">
            <pre className="rounded-md bg-muted/10 p-3 text-xs whitespace-pre-wrap">
              {aiInsights?.summary ?? 'No insights yet.'}
            </pre>
            {aiInsights?.warnings?.length ? (
              <div className="mt-3 text-xs text-muted">
                Warnings: {aiInsights.warnings.join(' · ')}
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Tithing statement</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Year"
              value={statementYear}
              onChange={(event) => setStatementYear(event.target.value)}
            />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={statementMemberId}
              onChange={(event) => {
                setStatementMemberId(event.target.value);
                setStatementEmail('');
              }}
            >
              <option value="">Select member</option>
              {members?.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </option>
              ))}
            </select>
            <Input
              placeholder="Or donor email"
              value={statementEmail}
              onChange={(event) => {
                setStatementEmail(event.target.value);
                setStatementMemberId('');
              }}
            />
          </div>
          <div className="mt-4 text-sm text-muted">
            <pre className="rounded-md bg-muted/10 p-3 text-xs">
              {JSON.stringify(statement ?? {}, null, 2)}
            </pre>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Pledges</h2>
            <div className="mt-4 space-y-2 text-sm text-muted">
              {pledges?.map((pledge) => (
                <div key={pledge.id} className="flex items-center justify-between">
                  <span>
                    {pledge.amount.toString()} {pledge.currency}
                  </span>
                  <span>{pledge.status}</span>
                </div>
              ))}
              {!pledges?.length && <p>No pledges yet.</p>}
            </div>
            <div className="mt-4 grid gap-3">
              <Input
                placeholder="Amount"
                type="number"
                value={pledgeAmount}
                onChange={(event) => setPledgeAmount(event.target.value)}
              />
              <Input
                placeholder="Currency"
                value={pledgeCurrency}
                onChange={(event) => setPledgeCurrency(event.target.value.toUpperCase())}
              />
              <Input
                placeholder="Notes"
                value={pledgeNotes}
                onChange={(event) => setPledgeNotes(event.target.value)}
              />
              <Button
                onClick={() =>
                  createPledge({
                    churchId,
                    amount: Number(pledgeAmount),
                    currency: pledgeCurrency,
                    notes: pledgeNotes || undefined,
                  })
                }
                disabled={!churchId || !pledgeAmount || isCreatingPledge}
              >
                {isCreatingPledge ? 'Creating…' : 'Create pledge'}
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold">Recurring Donations</h2>
            <div className="mt-4 space-y-2 text-sm text-muted">
              {recurring?.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <span>
                    {item.amount.toString()} {item.currency} · {item.interval}
                  </span>
                  <span>{item.status}</span>
                  <Button size="sm" variant="outline" onClick={() => chargeRecurring({ id: item.id })}>
                    Charge now
                  </Button>
                </div>
              ))}
              {!recurring?.length && <p>No recurring donations yet.</p>}
            </div>
            <div className="mt-4 grid gap-3">
              <Input
                placeholder="Amount"
                type="number"
                value={recurringAmount}
                onChange={(event) => setRecurringAmount(event.target.value)}
              />
              <Input
                placeholder="Currency"
                value={recurringCurrency}
                onChange={(event) => setRecurringCurrency(event.target.value.toUpperCase())}
              />
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={recurringInterval}
                onChange={(event) => setRecurringInterval(event.target.value)}
              >
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="YEARLY">Yearly</option>
              </select>
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={recurringProvider}
                onChange={(event) => setRecurringProvider(event.target.value)}
              >
                <option value="STRIPE">Stripe</option>
                <option value="PAYSTACK">Paystack</option>
              </select>
              {recurringProvider === 'PAYSTACK' && (
                <Input
                  placeholder="Donor email (required for Paystack)"
                  value={recurringDonorEmail}
                  onChange={(event) => setRecurringDonorEmail(event.target.value)}
                />
              )}
              <Button
                onClick={() =>
                  createRecurring({
                    churchId,
                    amount: Number(recurringAmount),
                    currency: recurringCurrency,
                    interval: recurringInterval as 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
                    provider: recurringProvider as 'STRIPE' | 'PAYSTACK',
                    donorEmail: recurringDonorEmail || undefined,
                    successUrl: typeof window === 'undefined' ? undefined : window.location.href,
                    cancelUrl: typeof window === 'undefined' ? undefined : window.location.href,
                  })
                }
                disabled={
                  !churchId ||
                  !recurringAmount ||
                  isCreatingRecurring ||
                  (recurringProvider === 'PAYSTACK' && !recurringDonorEmail)
                }
              >
                {isCreatingRecurring ? 'Creating…' : 'Create recurring'}
              </Button>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Expense Categories</h2>
            <div className="mt-4 space-y-2 text-sm text-muted">
              {categories?.map((category) => (
                <div key={category.id} className="flex items-center justify-between">
                  <span>{category.name}</span>
                </div>
              ))}
              {!categories?.length && <p>No categories yet.</p>}
            </div>
            <div className="mt-4 grid gap-3">
              <Input
                placeholder="Category name"
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
              />
              <Input
                placeholder="Description"
                value={categoryDescription}
                onChange={(event) => setCategoryDescription(event.target.value)}
              />
              <Button
                onClick={() =>
                  createCategory({
                    churchId,
                    name: categoryName,
                    description: categoryDescription || undefined,
                  })
                }
                disabled={!churchId || !categoryName || isCreatingCategory}
              >
                {isCreatingCategory ? 'Creating…' : 'Create category'}
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold">Expenses</h2>
            <div className="mt-4 space-y-2 text-sm text-muted">
              {expenses?.map((expense) => (
                <div key={expense.id} className="rounded-md border border-border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span>
                      {expense.amount.toString()} {expense.currency}
                    </span>
                    <span>{expense.status}</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => approveExpense({ id: expense.id })}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => rejectExpense({ id: expense.id })}>
                      Reject
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => markPaid({ id: expense.id })}>
                      Mark paid
                    </Button>
                  </div>
                </div>
              ))}
              {!expenses?.length && <p>No expenses yet.</p>}
            </div>
            <div className="mt-4 grid gap-3">
              <Input
                placeholder="Amount"
                type="number"
                value={expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value)}
              />
              <Input
                placeholder="Currency"
                value={expenseCurrency}
                onChange={(event) => setExpenseCurrency(event.target.value.toUpperCase())}
              />
              <select
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={expenseCategoryId}
                onChange={(event) => setExpenseCategoryId(event.target.value)}
              >
                <option value="">Uncategorized</option>
                {categories?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Description"
                value={expenseDescription}
                onChange={(event) => setExpenseDescription(event.target.value)}
              />
              <Button
                onClick={() =>
                  createExpense({
                    churchId,
                    amount: Number(expenseAmount),
                    currency: expenseCurrency,
                    categoryId: expenseCategoryId || undefined,
                    description: expenseDescription || undefined,
                  })
                }
                disabled={!churchId || !expenseAmount || isCreatingExpense}
              >
                {isCreatingExpense ? 'Creating…' : 'Create expense'}
              </Button>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Budgets</h2>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {budgets?.map((budget) => (
              <div key={budget.id} className="rounded-md border border-border px-3 py-2">
                <div className="flex items-center justify-between">
                  <span>{budget.name}</span>
                  <span>{budget.status}</span>
                </div>
                <div className="mt-2 text-xs text-muted">
                  Items: {budget.items.length}
                </div>
              </div>
            ))}
            {!budgets?.length && <p>No budgets yet.</p>}
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Budget name"
              value={budgetName}
              onChange={(event) => setBudgetName(event.target.value)}
            />
            <Input
              placeholder="Start date"
              type="date"
              value={budgetStart}
              onChange={(event) => setBudgetStart(event.target.value)}
            />
            <Input
              placeholder="End date"
              type="date"
              value={budgetEnd}
              onChange={(event) => setBudgetEnd(event.target.value)}
            />
            <Button
              onClick={() =>
                createBudget({
                  churchId,
                  name: budgetName,
                  startAt: budgetStart,
                  endAt: budgetEnd,
                })
              }
              disabled={!churchId || !budgetName || !budgetStart || !budgetEnd || isCreatingBudget}
            >
              {isCreatingBudget ? 'Creating…' : 'Create budget'}
            </Button>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={selectedBudgetId}
              onChange={(event) => setSelectedBudgetId(event.target.value)}
            >
              {budgets?.map((budget) => (
                <option key={budget.id} value={budget.id}>
                  {budget.name}
                </option>
              ))}
            </select>
            <Input
              placeholder="Item name"
              value={budgetItemName}
              onChange={(event) => setBudgetItemName(event.target.value)}
            />
            <Input
              placeholder="Allocated amount"
              type="number"
              value={budgetItemAmount}
              onChange={(event) => setBudgetItemAmount(event.target.value)}
            />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={budgetItemCategoryId}
              onChange={(event) => setBudgetItemCategoryId(event.target.value)}
            >
              <option value="">No category</option>
              {categories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <Button
              onClick={() =>
                addBudgetItem({
                  budgetId: selectedBudgetId,
                  name: budgetItemName,
                  allocatedAmount: Number(budgetItemAmount),
                  categoryId: budgetItemCategoryId || undefined,
                })
              }
              disabled={!selectedBudgetId || !budgetItemName || !budgetItemAmount || isAddingBudgetItem}
            >
              {isAddingBudgetItem ? 'Adding…' : 'Add budget item'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Receipts</h2>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {receipts?.map((receipt) => (
              <div key={receipt.id} className="flex items-center justify-between">
                <span>
                  {receipt.receiptNumber} · {receipt.status}
                </span>
                <span>{new Date(receipt.issuedAt).toLocaleDateString()}</span>
              </div>
            ))}
            {!receipts?.length && <p>No receipts yet.</p>}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Receipt number"
              value={receiptNumber}
              onChange={(event) => setReceiptNumber(event.target.value)}
            />
            <Input
              placeholder="Recipient email"
              value={receiptEmail}
              onChange={(event) => setReceiptEmail(event.target.value)}
            />
            <Button
              onClick={() => sendReceiptEmail({ receiptNumber, to: receiptEmail })}
              disabled={!receiptNumber || !receiptEmail || isSendingReceipt}
            >
              {isSendingReceipt ? 'Sending…' : 'Send receipt'}
            </Button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Receipt number"
              value={receiptNumber}
              onChange={(event) => setReceiptNumber(event.target.value)}
            />
            <Input
              placeholder="Void reason (optional)"
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
            />
            <Button
              variant="outline"
              onClick={() => voidReceipt({ receiptNumber, reason: voidReason || undefined })}
              disabled={!receiptNumber || isVoidingReceipt}
            >
              {isVoidingReceipt ? 'Voiding…' : 'Void receipt'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Refunds & disputes</h2>
          <div className="mt-3 text-sm text-muted">
            {disputeSummary?.length ? (
              <div className="flex flex-wrap gap-3">
                {disputeSummary.map((item) => (
                  <span key={item.status}>
                    {item.status}: {item._count}
                  </span>
                ))}
              </div>
            ) : (
              <p>No disputes yet.</p>
            )}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Donation ID"
              value={refundDonationId}
              onChange={(event) => setRefundDonationId(event.target.value)}
            />
            <Input
              placeholder="Amount (optional)"
              type="number"
              value={refundAmount}
              onChange={(event) => setRefundAmount(event.target.value)}
            />
            <Input
              placeholder="Reason (optional)"
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
            />
            <Button
              onClick={() =>
                refundDonation({
                  donationId: refundDonationId,
                  amount: refundAmount ? Number(refundAmount) : undefined,
                  reason: refundReason || undefined,
                })
              }
              disabled={!refundDonationId || isRefundingDonation}
            >
              {isRefundingDonation ? 'Refunding…' : 'Issue refund'}
            </Button>
          </div>
          <div className="mt-4 space-y-2 text-sm text-muted">
            <p className="font-medium text-foreground">Recent refunds</p>
            {refunds?.map((refund) => (
              <div key={refund.id} className="flex items-center justify-between">
                <span>
                  {refund.amount.toString()} {refund.currency} · {refund.provider}
                </span>
                <span>{refund.status}</span>
              </div>
            ))}
            {!refunds?.length && <p>No refunds yet.</p>}
          </div>
          <div className="mt-4 space-y-2 text-sm text-muted">
            <p className="font-medium text-foreground">Recent disputes</p>
            {disputes?.map((dispute) => (
              <button
                key={dispute.id}
                type="button"
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                  dispute.id === selectedDisputeId ? 'border-primary text-primary' : 'border-border text-muted'
                }`}
                onClick={() => setSelectedDisputeId(dispute.id)}
              >
                <span>
                  {dispute.amount?.toString() ?? ''} {dispute.currency ?? ''} · {dispute.provider}
                </span>
                <span>{dispute.status}</span>
              </button>
            ))}
            {!disputes?.length && <p>No disputes yet.</p>}
          </div>
          {selectedDisputeId && (
            <div className="mt-6 space-y-3 text-sm text-muted">
              <p className="font-medium text-foreground">Dispute evidence</p>
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  value={evidenceType}
                  onChange={(event) => setEvidenceType(event.target.value)}
                >
                  {evidenceTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Description (optional)"
                  value={evidenceDescription}
                  onChange={(event) => setEvidenceDescription(event.target.value)}
                />
                <Input
                  placeholder="Evidence text (optional)"
                  value={evidenceText}
                  onChange={(event) => setEvidenceText(event.target.value)}
                />
                <input
                  type="file"
                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={submitAfterUpload}
                  onChange={(event) => setSubmitAfterUpload(event.target.checked)}
                />
                Submit dispute after upload (Stripe only)
              </label>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() =>
                    submitEvidenceText({
                      disputeId: selectedDisputeId,
                      type: evidenceType as any,
                      description: evidenceDescription || undefined,
                      text: evidenceText || undefined,
                      submit: submitAfterUpload,
                    })
                  }
                  disabled={isSubmittingEvidence || (!evidenceText && !evidenceDescription)}
                >
                  {isSubmittingEvidence ? 'Submitting…' : 'Submit text evidence'}
                </Button>
                <Button
                  onClick={uploadEvidenceFile}
                  disabled={!evidenceFile || isUploadingEvidence}
                >
                  {isUploadingEvidence ? 'Uploading…' : 'Upload file evidence'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => submitDispute({ disputeId: selectedDisputeId })}
                  disabled={isSubmittingDispute}
                >
                  {isSubmittingDispute ? 'Submitting…' : 'Submit dispute'}
                </Button>
              </div>
              <div className="mt-4 space-y-2">
                {disputeEvidence?.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span>
                      {item.type} · {item.status}
                    </span>
                    <span>{item.fileName ?? item.text?.slice(0, 20) ?? ''}</span>
                  </div>
                ))}
                {!disputeEvidence?.length && <p>No evidence uploaded yet.</p>}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Payout reconciliation</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => syncStripePayouts({})} disabled={isSyncingStripe}>
              {isSyncingStripe ? 'Syncing Stripe…' : 'Sync Stripe payouts'}
            </Button>
            <Button variant="outline" onClick={() => syncPaystackSettlements({})} disabled={isSyncingPaystack}>
              {isSyncingPaystack ? 'Syncing Paystack…' : 'Sync Paystack settlements'}
            </Button>
          </div>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {payouts?.map((payout) => (
              <button
                key={payout.id}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                  payout.id === selectedPayoutId ? 'border-primary text-primary' : 'border-border text-muted'
                }`}
                onClick={() => setSelectedPayoutId(payout.id)}
                type="button"
              >
                <span>
                  {payout.provider} · {payout.amount.toString()} {payout.currency}
                </span>
                <span>{payout.status}</span>
              </button>
            ))}
            {!payouts?.length && <p>No payouts synced yet.</p>}
          </div>
          {selectedPayoutId && (
            <div className="mt-4 space-y-2 text-sm text-muted">
              <p className="font-medium text-foreground">Payout transactions</p>
              {payoutTransactions?.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between">
                  <span>
                    {txn.amount.toString()} {txn.currency} · {txn.type ?? 'transaction'}
                  </span>
                  <span>{txn.sourceRef ?? txn.providerRef}</span>
                </div>
              ))}
              {!payoutTransactions?.length && <p>No transactions for this payout.</p>}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Finance exports</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {['donations', 'expenses', 'pledges', 'recurring', 'receipts', 'payouts', 'refunds', 'disputes'].map(
              (type) => (
              <Button
                key={type}
                variant="outline"
                onClick={async () => {
                  const result = await utils.finance.exportCsv.fetch({
                    type: type as any,
                    churchId: churchId || undefined,
                  });
                  const blob = new Blob([result.csv], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = result.filename;
                  link.click();
                  window.URL.revokeObjectURL(url);
                }}
                disabled={!churchId}
              >
                Export {type}
              </Button>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Recent audit logs</h2>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {auditLogs?.map((log) => (
              <div key={log.id} className="flex items-center justify-between">
                <span>
                  {log.action} · {log.targetType}
                </span>
                <span>{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
            {!auditLogs?.length && <p>No audit activity yet.</p>}
          </div>
        </Card>
      </div>
    </Shell>
  );
}
