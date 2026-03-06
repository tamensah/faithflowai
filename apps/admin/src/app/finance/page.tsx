'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { trpc } from '../../lib/trpc';
import { useAuth } from '@clerk/nextjs';
import { useFeatureGate } from '../../lib/entitlements';
import { FeatureLocked } from '../../components/FeatureLocked';
import { ReadOnlyNotice } from '../../components/ReadOnlyNotice';
import { EmptyState } from '../../components/EmptyState';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { PageContextSidebar } from '../../components/PageContextSidebar';
import { useKeyboardShortcuts } from '../../lib/useKeyboardShortcuts';
import { analyzeCsvImport } from '../../lib/csvImportPreview';

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
const financeSectionOptions = [
  { key: 'operations', label: 'Operations' },
  { key: 'giving', label: 'Giving ops' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'settlements', label: 'Settlements' },
] as const;
type FinanceSectionKey = (typeof financeSectionOptions)[number]['key'];

const donationImportAliases = {
  amount: 'amount',
  currency: 'currency',
  donorname: 'donorName',
  donoremail: 'donorEmail',
  donorphone: 'donorPhone',
  memberemail: 'memberEmail',
  memberphone: 'memberPhone',
  fund: 'fundName',
  fundname: 'fundName',
  campaign: 'campaignName',
  campaignname: 'campaignName',
  createdat: 'createdAt',
  date: 'createdAt',
} as const;

export default function FinancePage() {
  const gate = useFeatureGate('finance_enabled');
  const utils = trpc.useUtils();
  const { getToken } = useAuth();
  const canWrite = gate.canWrite;
  const [churchId, setChurchId] = useState('');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [statementError, setStatementError] = useState<string | null>(null);
  const [statementYear, setStatementYear] = useState(String(new Date().getFullYear()));
  const [statementMemberId, setStatementMemberId] = useState('');
  const [statementEmail, setStatementEmail] = useState('');
  const [statementSendStatus, setStatementSendStatus] = useState<string>('');

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
  const [donationImportCsv, setDonationImportCsv] = useState('');
  const [donationImportFilename, setDonationImportFilename] = useState('');
  const [donationImportResult, setDonationImportResult] = useState<any>(null);
  const [donationImportBatchId, setDonationImportBatchId] = useState<string>('');
  const [operationsStatus, setOperationsStatus] = useState('');
  const [givingStatus, setGivingStatus] = useState('');
  const [accountingStatus, setAccountingStatus] = useState('');
  const [settlementsStatus, setSettlementsStatus] = useState('');
  const [exportStatus, setExportStatus] = useState('');
  const [activeSection, setActiveSection] = useState<FinanceSectionKey>('operations');
  const statementEmailRef = useRef<HTMLInputElement | null>(null);
  const donationImportRef = useRef<HTMLTextAreaElement | null>(null);

  const { data: churches, isLoading: isChurchesLoading } = trpc.church.list.useQuery({ organizationId: undefined });
  const { data: members } = trpc.member.list.useQuery({ churchId: churchId || undefined }, { enabled: Boolean(churchId) });

  useEffect(() => {
    if (!churchId && churches?.length) {
      setChurchId(churches[0].id);
    }
  }, [churchId, churches]);
  const rowClass = density === 'compact' ? 'py-1.5 text-xs' : 'py-2.5 text-sm';
  const donationImportPreview = useMemo(
    () =>
      analyzeCsvImport(donationImportCsv, donationImportAliases, [
        {
          label: 'Required amount column',
          check: (targets) => ({
            ok: targets.has('amount'),
            detail: 'Each row must map an amount column before the import can create donations.',
          }),
        },
        {
          label: 'Donor matching context',
          check: (targets) => ({
            ok:
              targets.has('donorEmail') ||
              targets.has('donorPhone') ||
              targets.has('memberEmail') ||
              targets.has('memberPhone'),
            detail: 'Email or phone columns are recommended so imported gifts can be matched to donors or members.',
          }),
        },
        {
          label: 'Posting date',
          check: (targets) => ({
            ok: targets.has('createdAt'),
            detail: 'Created date is optional, but adding it keeps historical reports and statements accurate.',
          }),
        },
      ]),
    [donationImportCsv]
  );

  useKeyboardShortcuts([
    {
      key: '/',
      onTrigger: () => statementEmailRef.current?.focus(),
    },
    {
      key: 'i',
      shift: true,
      onTrigger: () => donationImportRef.current?.focus(),
    },
  ]);

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

  const { data: pledges, isLoading: isLoadingPledges } = trpc.pledge.list.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: recurring, isLoading: isLoadingRecurring } = trpc.recurring.list.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: categories, isLoading: isLoadingCategories } = trpc.expenseCategory.list.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: expenses, isLoading: isLoadingExpenses } = trpc.expense.list.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: budgets, isLoading: isLoadingBudgets } = trpc.budget.list.useQuery(
    { churchId: churchId || undefined },
    { enabled: Boolean(churchId) }
  );
  const { data: receipts, isLoading: isLoadingReceipts } = trpc.receipt.list.useQuery(
    { churchId: churchId || undefined, limit: 20 },
    { enabled: Boolean(churchId) }
  );
  const { data: auditLogs, isLoading: isLoadingAuditLogs } = trpc.audit.list.useQuery(
    { churchId: churchId || undefined, limit: 20 },
    { enabled: Boolean(churchId) }
  );
  const { data: payouts, isLoading: isLoadingPayouts } = trpc.finance.listPayouts.useQuery(
    { churchId: churchId || undefined, limit: 20 },
    { enabled: Boolean(churchId) }
  );
  const { data: payoutTransactions, isLoading: isLoadingPayoutTransactions } = trpc.finance.payoutTransactions.useQuery(
    { payoutId: selectedPayoutId, limit: 20 },
    { enabled: Boolean(selectedPayoutId) }
  );
  const { data: refunds, isLoading: isLoadingRefunds } = trpc.finance.refunds.useQuery(
    { churchId: churchId || undefined, limit: 20 },
    { enabled: Boolean(churchId) }
  );
  const { data: disputes, isLoading: isLoadingDisputes } = trpc.finance.disputes.useQuery(
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
      setGivingStatus('Pledge created.');
      setPledgeNotes('');
      await utils.pledge.list.invalidate();
    },
    onError: (error) => setGivingStatus(error.message),
  });

  const { mutate: createRecurring, isPending: isCreatingRecurring } = trpc.recurring.createCheckout.useMutation({
    onSuccess: async (result) => {
      setGivingStatus('Recurring checkout created.');
      await utils.recurring.list.invalidate();
      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, '_blank', 'noopener');
      }
    },
    onError: (error) => setGivingStatus(error.message),
  });
  const { mutate: chargeRecurring } = trpc.recurring.chargeNow.useMutation({
    onSuccess: () => {
      setGivingStatus('Charge attempt queued.');
      return utils.recurring.list.invalidate();
    },
    onError: (error) => setGivingStatus(error.message),
  });

  const { mutate: createCategory, isPending: isCreatingCategory } = trpc.expenseCategory.create.useMutation({
    onSuccess: async () => {
      setAccountingStatus('Expense category created.');
      setCategoryName('');
      setCategoryDescription('');
      await utils.expenseCategory.list.invalidate();
    },
    onError: (error) => setAccountingStatus(error.message),
  });

  const { mutate: createExpense, isPending: isCreatingExpense } = trpc.expense.create.useMutation({
    onSuccess: async () => {
      setAccountingStatus('Expense created.');
      setExpenseDescription('');
      await utils.expense.list.invalidate();
    },
    onError: (error) => setAccountingStatus(error.message),
  });

  const { mutate: approveExpense } = trpc.expense.approve.useMutation({
    onSuccess: () => {
      setAccountingStatus('Expense approved.');
      return utils.expense.list.invalidate();
    },
    onError: (error) => setAccountingStatus(error.message),
  });
  const { mutate: rejectExpense } = trpc.expense.reject.useMutation({
    onSuccess: () => {
      setAccountingStatus('Expense rejected.');
      return utils.expense.list.invalidate();
    },
    onError: (error) => setAccountingStatus(error.message),
  });
  const { mutate: markPaid } = trpc.expense.markPaid.useMutation({
    onSuccess: () => {
      setAccountingStatus('Expense marked as paid.');
      return utils.expense.list.invalidate();
    },
    onError: (error) => setAccountingStatus(error.message),
  });

  const { mutate: createBudget, isPending: isCreatingBudget } = trpc.budget.create.useMutation({
    onSuccess: async () => {
      setAccountingStatus('Budget created.');
      setBudgetName('');
      setBudgetStart('');
      setBudgetEnd('');
      await utils.budget.list.invalidate();
    },
    onError: (error) => setAccountingStatus(error.message),
  });

  const { mutate: addBudgetItem, isPending: isAddingBudgetItem } = trpc.budget.addItem.useMutation({
    onSuccess: async () => {
      setAccountingStatus('Budget item added.');
      setBudgetItemName('');
      await utils.budget.list.invalidate();
    },
    onError: (error) => setAccountingStatus(error.message),
  });

  const { mutate: sendReceiptEmail, isPending: isSendingReceipt } = trpc.receipt.sendEmail.useMutation({
    onSuccess: () => {
      setAccountingStatus('Receipt email sent.');
      setReceiptEmail('');
      setReceiptNumber('');
    },
    onError: (error) => setAccountingStatus(error.message),
  });

  const { mutate: sendTithingStatementEmail, isPending: isSendingStatement } =
    trpc.finance.sendTithingStatementEmail.useMutation({
      onSuccess: () => setStatementSendStatus('Statement email sent.'),
      onError: (error) => setStatementSendStatus(error.message),
    });
  const { mutate: voidReceipt, isPending: isVoidingReceipt } = trpc.receipt.void.useMutation({
    onSuccess: () => {
      setAccountingStatus('Receipt voided.');
      setReceiptNumber('');
      setVoidReason('');
      utils.receipt.list.invalidate();
    },
    onError: (error) => setAccountingStatus(error.message),
  });
  const { mutate: refundDonation, isPending: isRefundingDonation } = trpc.finance.refundDonation.useMutation({
    onSuccess: () => {
      setAccountingStatus('Refund issued.');
      setRefundDonationId('');
      setRefundAmount('');
      setRefundReason('');
      utils.finance.refunds.invalidate();
      utils.donation.list.invalidate();
    },
    onError: (error) => setAccountingStatus(error.message),
  });
  const { mutate: submitDispute, isPending: isSubmittingDispute } = trpc.finance.submitDispute.useMutation({
    onSuccess: () => {
      setAccountingStatus('Dispute submitted.');
      return utils.finance.disputes.invalidate();
    },
    onError: (error) => setAccountingStatus(error.message),
  });
  const { mutate: submitEvidenceText, isPending: isSubmittingEvidence } =
    trpc.finance.submitDisputeEvidenceText.useMutation({
      onSuccess: () => {
        setAccountingStatus('Evidence submitted.');
        setEvidenceText('');
        setEvidenceDescription('');
        utils.finance.disputeEvidence.invalidate();
        utils.finance.disputes.invalidate();
      },
      onError: (error) => setAccountingStatus(error.message),
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
      setAccountingStatus('Evidence file uploaded.');
      await utils.finance.disputeEvidence.invalidate();
      await utils.finance.disputes.invalidate();
    } catch (error) {
      setAccountingStatus(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setIsUploadingEvidence(false);
    }
  };
  const { mutate: syncStripePayouts, isPending: isSyncingStripe } = trpc.finance.syncStripePayouts.useMutation({
    onSuccess: () => {
      setSettlementsStatus('Stripe payouts synced.');
      return utils.finance.listPayouts.invalidate();
    },
    onError: (error) => setSettlementsStatus(error.message),
  });
  const { mutate: syncPaystackSettlements, isPending: isSyncingPaystack } =
    trpc.finance.syncPaystackSettlements.useMutation({
      onSuccess: () => {
        setSettlementsStatus('Paystack settlements synced.');
        return utils.finance.listPayouts.invalidate();
      },
      onError: (error) => setSettlementsStatus(error.message),
    });

  const { mutate: importDonations, isPending: isImportingDonations } = trpc.donation.importCsv.useMutation({
    onSuccess: async (result) => {
      setOperationsStatus('Donation import processed.');
      setDonationImportResult(result);
      if (result?.batchId) setDonationImportBatchId(result.batchId);
      await Promise.all([utils.donation.list.invalidate(), utils.receipt.list.invalidate()]);
    },
    onError: (error) => setOperationsStatus(error.message),
  });

  const { mutate: rollbackDonationImport, isPending: isRollingBackDonationImport } = trpc.donation.rollbackImport.useMutation({
    onSuccess: async () => {
      setOperationsStatus('Import batch rolled back.');
      setDonationImportResult(null);
      setDonationImportBatchId('');
      await Promise.all([utils.donation.list.invalidate(), utils.receipt.list.invalidate()]);
    },
    onError: (error) => setOperationsStatus(error.message),
  });

  const downloadDonationTemplate = () => {
    const csv = [
      'amount,currency,donorName,donorEmail,donorPhone,memberEmail,memberPhone,fundName,campaignName,createdAt',
      '25,USD,Jane Doe,jane@example.com,+15551231234,jane@example.com,,General,,2026-02-01',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'faithflow-donations-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCreatePledge = () => {
    if (!churchId || !pledgeAmount) {
      setGivingStatus('Church and pledge amount are required.');
      return;
    }
    setGivingStatus('');
    createPledge({
      churchId,
      amount: Number(pledgeAmount),
      currency: pledgeCurrency,
      notes: pledgeNotes || undefined,
    });
  };

  const handleCreateRecurring = () => {
    if (!churchId || !recurringAmount) {
      setGivingStatus('Church and recurring amount are required.');
      return;
    }
    if (recurringProvider === 'PAYSTACK' && !recurringDonorEmail.trim()) {
      setGivingStatus('Donor email is required for Paystack recurring checkout.');
      return;
    }
    setGivingStatus('');
    createRecurring({
      churchId,
      amount: Number(recurringAmount),
      currency: recurringCurrency,
      interval: recurringInterval as 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
      provider: recurringProvider as 'STRIPE' | 'PAYSTACK',
      donorEmail: recurringDonorEmail || undefined,
      successUrl: typeof window === 'undefined' ? undefined : window.location.href,
      cancelUrl: typeof window === 'undefined' ? undefined : window.location.href,
    });
  };

  const handleCreateCategory = () => {
    if (!churchId || !categoryName.trim()) {
      setAccountingStatus('Church and category name are required.');
      return;
    }
    setAccountingStatus('');
    createCategory({
      churchId,
      name: categoryName,
      description: categoryDescription || undefined,
    });
  };

  const handleCreateExpense = () => {
    if (!churchId || !expenseAmount) {
      setAccountingStatus('Church and expense amount are required.');
      return;
    }
    setAccountingStatus('');
    createExpense({
      churchId,
      amount: Number(expenseAmount),
      currency: expenseCurrency,
      categoryId: expenseCategoryId || undefined,
      description: expenseDescription || undefined,
    });
  };

  const handleCreateBudget = () => {
    if (!churchId || !budgetName || !budgetStart || !budgetEnd) {
      setAccountingStatus('Church, budget name, and date range are required.');
      return;
    }
    setAccountingStatus('');
    createBudget({
      churchId,
      name: budgetName,
      startAt: budgetStart,
      endAt: budgetEnd,
    });
  };

  const handleAddBudgetItem = () => {
    if (!selectedBudgetId || !budgetItemName || !budgetItemAmount) {
      setAccountingStatus('Budget, item name, and allocated amount are required.');
      return;
    }
    setAccountingStatus('');
    addBudgetItem({
      budgetId: selectedBudgetId,
      name: budgetItemName,
      allocatedAmount: Number(budgetItemAmount),
      categoryId: budgetItemCategoryId || undefined,
    });
  };

  const handleSendReceipt = () => {
    if (!receiptNumber.trim() || !receiptEmail.trim()) {
      setAccountingStatus('Receipt number and recipient email are required.');
      return;
    }
    setAccountingStatus('');
    sendReceiptEmail({ receiptNumber, to: receiptEmail });
  };

  const handleVoidReceipt = () => {
    if (!receiptNumber.trim()) {
      setAccountingStatus('Receipt number is required to void a receipt.');
      return;
    }
    setAccountingStatus('');
    voidReceipt({ receiptNumber, reason: voidReason || undefined });
  };

  const handleIssueRefund = () => {
    if (!refundDonationId.trim()) {
      setAccountingStatus('Donation ID is required to issue a refund.');
      return;
    }
    setAccountingStatus('');
    refundDonation({
      donationId: refundDonationId,
      amount: refundAmount ? Number(refundAmount) : undefined,
      reason: refundReason || undefined,
    });
  };

  const handleExportCsv = async (type: string) => {
    if (!churchId) {
      setExportStatus('Select a church before exporting reports.');
      return;
    }
    try {
      setExportStatus('');
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
      setExportStatus(`${result.filename} exported.`);
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : 'Export failed.');
    }
  };

  return (
    <Shell>
      {!gate.isLoading && gate.access === 'locked' ? (
        <FeatureLocked
          featureKey="finance_enabled"
          title="Finance is locked"
          description="Your current subscription does not include finance operations. Upgrade to restore access."
        />
      ) : (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
        <div id="finance-page-sections" className="space-y-8">
        <Card className="border-primary/10 bg-gradient-to-r from-slate-950 to-primary p-6 text-primary-foreground shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">Finance operations</p>
              <h1 className="mt-2 font-display text-3xl font-semibold">Finance</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/80">
                Reconciliation, giving operations, disputes, payouts, and accounting workflows in one control plane.
              </p>
            </div>
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
              {(churches?.find((church) => church.id === churchId)?.name ?? 'No church selected')}
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-white/20 bg-white/10 p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-white/70">Donations</p>
              <p className="mt-1 text-2xl font-semibold">
                {(dashboard?.donations ?? []).reduce((sum, item) => sum + item._count, 0)}
              </p>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/10 p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-white/70">Expenses</p>
              <p className="mt-1 text-2xl font-semibold">
                {(dashboard?.expenses ?? []).reduce((sum, item) => sum + item._count, 0)}
              </p>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/10 p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-white/70">Refund cases</p>
              <p className="mt-1 text-2xl font-semibold">{refunds?.length ?? 0}</p>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/10 p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-white/70">Open disputes</p>
              <p className="mt-1 text-2xl font-semibold">
                {disputes?.filter((item) => item.status !== 'WON' && item.status !== 'LOST').length ?? 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="ff-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted">
              Shortcuts: <kbd className="rounded border px-1.5 py-0.5 text-xs">/</kbd> statement email ·{' '}
              <kbd className="rounded border px-1.5 py-0.5 text-xs">Shift</kbd>+
              <kbd className="rounded border px-1.5 py-0.5 text-xs">I</kbd> import CSV
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.1em] text-muted">Density</span>
              <div className="rounded-md border border-border bg-white p-1">
                <button
                  type="button"
                  className={`rounded px-2 py-1 text-xs ${density === 'comfortable' ? 'bg-primary text-primary-foreground' : 'text-muted'}`}
                  onClick={() => setDensity('comfortable')}
                >
                  Comfortable
                </button>
                <button
                  type="button"
                  className={`rounded px-2 py-1 text-xs ${density === 'compact' ? 'bg-primary text-primary-foreground' : 'text-muted'}`}
                  onClick={() => setDensity('compact')}
                >
                  Compact
                </button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="ff-surface p-4">
          <h2 className="text-base font-semibold">Finance workspace</h2>
          <p className="mt-1 text-xs text-muted">Use focused sections instead of one long scroll.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {financeSectionOptions.map((section) => (
              <Button
                key={section.key}
                size="sm"
                variant={activeSection === section.key ? 'default' : 'outline'}
                onClick={() => setActiveSection(section.key)}
              >
                {section.label}
              </Button>
            ))}
          </div>
        </Card>

        {gate.readOnly ? <ReadOnlyNotice /> : null}

        {activeSection === 'operations' && isChurchesLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <LoadingSkeleton lines={4} />
            <LoadingSkeleton lines={5} />
          </div>
        ) : null}

        {activeSection === 'operations' ? (
        <>
        <Card className="ff-surface p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Import donations (CSV)</h2>
              <p className="mt-2 text-sm text-muted">Dry-run, apply, and rollback donation imports.</p>
            </div>
            <Button size="sm" variant="outline" onClick={downloadDonationTemplate}>
              Download template
            </Button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setDonationImportFilename(file.name);
                setDonationImportCsv(await file.text());
              }}
            />
            <div className="text-xs text-muted">
              {donationImportFilename ? `Loaded: ${donationImportFilename}` : 'Choose a CSV file to populate the import box.'}
            </div>
          </div>

          <textarea
            ref={donationImportRef}
            className="mt-4 min-h-[140px] w-full rounded-md border border-border bg-white p-3 text-sm"
            placeholder="Paste donation CSV here..."
            value={donationImportCsv}
            onChange={(event) => setDonationImportCsv(event.target.value)}
          />
          {donationImportPreview ? (
            <div className="mt-4 rounded-xl border border-border bg-muted/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">Import mapping preview</p>
                  <p className="text-xs text-muted">
                    {donationImportPreview.rowCount} row{donationImportPreview.rowCount === 1 ? '' : 's'} detected ·{' '}
                    {donationImportPreview.recognizedCount}/{donationImportPreview.rawHeaders.length} mapped columns
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    donationImportPreview.unrecognizedHeaders.length
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-emerald-100 text-emerald-900'
                  }`}
                >
                  {donationImportPreview.unrecognizedHeaders.length ? 'Review headers' : 'Ready to import'}
                </span>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="space-y-2 text-xs text-muted">
                  {donationImportPreview.mappedHeaders.map((entry) => (
                    <div
                      key={`${entry.source}-${entry.target ?? 'unmapped'}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border bg-white px-3 py-2"
                    >
                      <span className="truncate">{entry.source}</span>
                      <span className="font-medium text-foreground">{entry.target ?? 'Unmapped'}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {donationImportPreview.readiness.map((item) => (
                    <div key={item.label} className="rounded-md border border-border bg-white px-3 py-2 text-xs text-muted">
                      <p className="font-medium text-foreground">
                        {item.label}: {item.ok ? 'OK' : 'Needs attention'}
                      </p>
                      <p className="mt-1">{item.detail}</p>
                    </div>
                  ))}
                  {donationImportPreview.sampleRows.length ? (
                    <div className="rounded-md border border-border bg-white p-3 text-xs text-muted">
                      <p className="font-medium text-foreground">Sample row</p>
                      <pre className="mt-2 whitespace-pre-wrap">
                        {JSON.stringify(donationImportPreview.sampleRows[0], null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!canWrite || !churchId || donationImportCsv.trim().length < 5 || isImportingDonations}
              onClick={() =>
                importDonations({
                  churchId,
                  csv: donationImportCsv,
                  dryRun: true,
                })
              }
            >
              {isImportingDonations ? 'Running...' : 'Dry-run import'}
            </Button>
            <Button
              disabled={!canWrite || !churchId || donationImportCsv.trim().length < 5 || isImportingDonations}
              onClick={() =>
                importDonations({
                  churchId,
                  csv: donationImportCsv,
                })
              }
            >
              {isImportingDonations ? 'Importing...' : 'Apply import'}
            </Button>
            <Button
              variant="outline"
              disabled={!canWrite || !donationImportBatchId || isRollingBackDonationImport}
              onClick={() => rollbackDonationImport({ batchId: donationImportBatchId })}
            >
              {isRollingBackDonationImport ? 'Rolling back...' : 'Rollback last batch'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">Required: select a church and provide CSV content before running import.</p>
          {operationsStatus ? <p className="mt-2 text-xs text-muted">{operationsStatus}</p> : null}

          {donationImportResult ? (
            <div className="mt-4 space-y-2 text-sm text-muted">
              <p>
                Batch: {donationImportResult.batchId ?? 'dry-run'} · Scanned: {donationImportResult.summary?.scanned ?? 0} · Created:{' '}
                {donationImportResult.summary?.created ?? 0} · Skipped: {donationImportResult.summary?.skipped ?? 0} · Errors:{' '}
                {donationImportResult.summary?.errors ?? 0}
              </p>
              {donationImportResult.errors?.length ? (
                <pre className="rounded-md bg-muted/10 p-3 text-xs">
                  {JSON.stringify(donationImportResult.errors.slice(0, 20), null, 2)}
                </pre>
              ) : null}
            </div>
          ) : null}
        </Card>

        <Card className="ff-surface p-6">
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

        <Card className="ff-surface p-6">
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

        <Card className="ff-surface p-6">
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

        <Card className="ff-surface p-6">
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

        <Card className="ff-surface p-6">
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

        <Card className="ff-surface p-6">
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
        </>
        ) : null}

        {activeSection === 'giving' ? (
        <>
        <Card className="ff-surface p-6">
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
                setStatementSendStatus('');
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
              ref={statementEmailRef}
              placeholder="Or donor email"
              value={statementEmail}
              onChange={(event) => {
                setStatementError(null);
                setStatementSendStatus('');
                setStatementEmail(event.target.value);
                setStatementMemberId('');
              }}
              aria-invalid={Boolean(statementError && !statementEmail && !statementMemberId)}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={!canWrite || !churchId || !statementYear || !(statementMemberId || statementEmail) || isSendingStatement}
              onClick={() => {
                if (!statementYear || Number.isNaN(Number(statementYear))) {
                  setStatementError('Enter a valid year for the statement.');
                  return;
                }
                if (!statementMemberId && !statementEmail.trim()) {
                  setStatementError('Select a member or provide donor email.');
                  return;
                }
                setStatementError(null);
                setStatementSendStatus('');
                sendTithingStatementEmail({
                  churchId,
                  year: Number(statementYear),
                  memberId: statementMemberId || undefined,
                  donorEmail: statementEmail || undefined,
                });
              }}
            >
              {isSendingStatement ? 'Sending…' : 'Email statement'}
            </Button>
            {statementError ? <p className="text-xs font-medium text-destructive">{statementError}</p> : null}
            {statementSendStatus ? <p className="text-xs text-muted">{statementSendStatus}</p> : null}
          </div>
          <div className="mt-4 text-sm text-muted">
            <pre className="rounded-md bg-muted/10 p-3 text-xs">
              {JSON.stringify(statement ?? {}, null, 2)}
            </pre>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="ff-surface p-6">
            <h2 className="text-lg font-semibold">Pledges</h2>
            <div className="mt-4 space-y-2 text-sm text-muted">
              {isLoadingPledges ? <p>Loading pledges...</p> : null}
              {pledges?.map((pledge) => (
                <div key={pledge.id} className={`flex items-center justify-between border-b border-border/60 ${rowClass}`}>
                  <span>
                    {pledge.amount.toString()} {pledge.currency}
                  </span>
                  <span>{pledge.status}</span>
                </div>
              ))}
              {!pledges?.length ? (
                <EmptyState
                  title="No pledges yet"
                  description="Create your first pledge to track commitment-based giving."
                />
              ) : null}
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
              <Button onClick={handleCreatePledge} disabled={!churchId || !pledgeAmount || isCreatingPledge}>
                {isCreatingPledge ? 'Creating…' : 'Create pledge'}
              </Button>
              <p className="text-xs text-muted">Required: church and amount.</p>
            </div>
          </Card>

          <Card className="ff-surface p-6">
            <h2 className="text-lg font-semibold">Recurring Donations</h2>
            <div className="mt-4 space-y-2 text-sm text-muted">
              {isLoadingRecurring ? <p>Loading recurring donations...</p> : null}
              {recurring?.map((item) => (
                <div key={item.id} className={`flex items-center justify-between border-b border-border/60 ${rowClass}`}>
                  <span>
                    {item.amount.toString()} {item.currency} · {item.interval}
                  </span>
                  <span>{item.status}</span>
                  <Button size="sm" variant="outline" onClick={() => chargeRecurring({ id: item.id })}>
                    Charge now
                  </Button>
                </div>
              ))}
              {!recurring?.length ? (
                <EmptyState
                  title="No recurring donations yet"
                  description="Set up recurring contributions to stabilize monthly cash flow."
                />
              ) : null}
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
              <Button onClick={handleCreateRecurring} disabled={
                !churchId ||
                !recurringAmount ||
                isCreatingRecurring ||
                (recurringProvider === 'PAYSTACK' && !recurringDonorEmail)
              }>
                {isCreatingRecurring ? 'Creating…' : 'Create recurring'}
              </Button>
              <p className="text-xs text-muted">
                Required: church and amount. Paystack checkout also requires donor email.
              </p>
            </div>
          </Card>
        </div>
        {givingStatus ? <p className="text-xs text-muted">{givingStatus}</p> : null}
        </>
        ) : null}

        {activeSection === 'accounting' ? (
        <>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="ff-surface p-6">
            <h2 className="text-lg font-semibold">Expense Categories</h2>
            <div className="mt-4 space-y-2 text-sm text-muted">
              {isLoadingCategories ? <p>Loading categories...</p> : null}
              {categories?.map((category) => (
                <div key={category.id} className={`flex items-center justify-between border-b border-border/60 ${rowClass}`}>
                  <span>{category.name}</span>
                </div>
              ))}
              {!categories?.length ? (
                <EmptyState
                  title="No expense categories"
                  description="Create categories so reports and budgets stay structured."
                />
              ) : null}
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
              <Button onClick={handleCreateCategory} disabled={!churchId || !categoryName || isCreatingCategory}>
                {isCreatingCategory ? 'Creating…' : 'Create category'}
              </Button>
              <p className="text-xs text-muted">Required: church and category name.</p>
            </div>
          </Card>

          <Card className="ff-surface p-6">
            <h2 className="text-lg font-semibold">Expenses</h2>
            <div className="mt-4 space-y-2 text-sm text-muted">
              {isLoadingExpenses ? <p>Loading expenses...</p> : null}
              {expenses?.map((expense) => (
                <div key={expense.id} className={`rounded-md border border-border ${density === 'compact' ? 'px-3 py-2' : 'p-3'}`}>
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
              {!expenses?.length ? (
                <EmptyState
                  title="No expenses yet"
                  description="Submitted and approved expenses will appear here for reconciliation."
                />
              ) : null}
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
              <Button onClick={handleCreateExpense} disabled={!churchId || !expenseAmount || isCreatingExpense}>
                {isCreatingExpense ? 'Creating…' : 'Create expense'}
              </Button>
              <p className="text-xs text-muted">Required: church and expense amount.</p>
            </div>
          </Card>
        </div>

        <Card className="ff-surface p-6">
          <h2 className="text-lg font-semibold">Budgets</h2>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {isLoadingBudgets ? <p>Loading budgets...</p> : null}
            {budgets?.map((budget) => (
              <div key={budget.id} className={`rounded-md border border-border ${density === 'compact' ? 'px-3 py-2' : 'p-3'}`}>
                <div className="flex items-center justify-between">
                  <span>{budget.name}</span>
                  <span>{budget.status}</span>
                </div>
                <div className="mt-2 text-xs text-muted">
                  Items: {budget.items.length}
                </div>
              </div>
            ))}
            {!budgets?.length ? (
              <EmptyState
                title="No budgets yet"
                description="Create a budget to track allocation and spending discipline."
              />
            ) : null}
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
            <Button onClick={handleCreateBudget} disabled={!churchId || !budgetName || !budgetStart || !budgetEnd || isCreatingBudget}>
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
            <Button onClick={handleAddBudgetItem} disabled={!selectedBudgetId || !budgetItemName || !budgetItemAmount || isAddingBudgetItem}>
              {isAddingBudgetItem ? 'Adding…' : 'Add budget item'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Required: budget setup needs name and date range; budget items need target budget, name, and amount.
          </p>
        </Card>

        <Card className="ff-surface p-6">
          <h2 className="text-lg font-semibold">Receipts</h2>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {isLoadingReceipts ? <p>Loading receipts...</p> : null}
            {receipts?.map((receipt) => (
              <div key={receipt.id} className={`flex items-center justify-between border-b border-border/60 ${rowClass}`}>
                <span>
                  {receipt.receiptNumber} · {receipt.status}
                </span>
                <span>{new Date(receipt.issuedAt).toLocaleDateString()}</span>
              </div>
            ))}
            {!receipts?.length ? (
              <EmptyState
                title="No receipts yet"
                description="Receipts appear after successful donations or statement issuance."
              />
            ) : null}
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
            <Button onClick={handleSendReceipt} disabled={!receiptNumber || !receiptEmail || isSendingReceipt}>
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
            <Button variant="outline" onClick={handleVoidReceipt} disabled={!receiptNumber || isVoidingReceipt}>
              {isVoidingReceipt ? 'Voiding…' : 'Void receipt'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">Required: receipt number for resend/void; recipient email required for resend.</p>
        </Card>

        <Card className="ff-surface p-6">
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
            <Button onClick={handleIssueRefund} disabled={!refundDonationId || isRefundingDonation}>
              {isRefundingDonation ? 'Refunding…' : 'Issue refund'}
            </Button>
          </div>
          <div className="mt-4 space-y-2 text-sm text-muted">
            <p className="font-medium text-foreground">Recent refunds</p>
            {isLoadingRefunds ? <p>Loading refunds...</p> : null}
            {refunds?.map((refund) => (
              <div key={refund.id} className={`flex items-center justify-between border-b border-border/60 ${rowClass}`}>
                <span>
                  {refund.amount.toString()} {refund.currency} · {refund.provider}
                </span>
                <span>{refund.status}</span>
              </div>
            ))}
            {!refunds?.length ? (
              <EmptyState
                title="No refunds yet"
                description="Refund records will appear after approved reversals."
              />
            ) : null}
          </div>
          <div className="mt-4 space-y-2 text-sm text-muted">
            <p className="font-medium text-foreground">Recent disputes</p>
            {isLoadingDisputes ? <p>Loading disputes...</p> : null}
            {disputes?.map((dispute) => (
              <button
                key={dispute.id}
                type="button"
                className={`flex w-full items-center justify-between rounded-md border px-3 text-left ${rowClass} ${
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
            {!disputes?.length ? (
              <EmptyState
                title="No disputes yet"
                description="Disputes will surface here when providers report chargeback cases."
              />
            ) : null}
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
                  <div key={item.id} className={`flex items-center justify-between border-b border-border/60 ${rowClass}`}>
                    <span>
                      {item.type} · {item.status}
                    </span>
                    <span>{item.fileName ?? item.text?.slice(0, 20) ?? ''}</span>
                  </div>
                ))}
                {!disputeEvidence?.length ? (
                  <EmptyState
                    title="No evidence uploaded"
                    description="Attach receipts, communication logs, or policies before submitting the dispute."
                  />
                ) : null}
              </div>
            </div>
          )}
        </Card>
        {accountingStatus ? <p className="text-xs text-muted">{accountingStatus}</p> : null}
        </>
        ) : null}

        {activeSection === 'settlements' ? (
        <>
        <Card className="ff-surface p-6">
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
            {isLoadingPayouts ? <p>Loading payouts...</p> : null}
            {payouts?.map((payout) => (
              <button
                key={payout.id}
                className={`flex w-full items-center justify-between rounded-md border px-3 text-left ${rowClass} ${
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
            {!payouts?.length ? (
              <EmptyState
                title="No payouts synced"
                description="Run payout sync to load settlement records from Stripe and Paystack."
              />
            ) : null}
          </div>
          {selectedPayoutId && (
            <div className="mt-4 space-y-2 text-sm text-muted">
              <p className="font-medium text-foreground">Payout transactions</p>
              {isLoadingPayoutTransactions ? <p>Loading payout transactions...</p> : null}
              {payoutTransactions?.map((txn) => (
                <div key={txn.id} className={`flex items-center justify-between border-b border-border/60 ${rowClass}`}>
                  <span>
                    {txn.amount.toString()} {txn.currency} · {txn.type ?? 'transaction'}
                  </span>
                  <span>{txn.sourceRef ?? txn.providerRef}</span>
                </div>
              ))}
              {!payoutTransactions?.length ? (
                <EmptyState
                  title="No transactions for this payout"
                  description="Select another payout or run sync if provider records are still processing."
                />
              ) : null}
            </div>
          )}
        </Card>

        <Card className="ff-surface p-6">
          <h2 className="text-lg font-semibold">Finance exports</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {['donations', 'expenses', 'pledges', 'recurring', 'receipts', 'payouts', 'refunds', 'disputes'].map(
              (type) => (
              <Button
                key={type}
                variant="outline"
                onClick={() => handleExportCsv(type)}
                disabled={!churchId}
              >
                Export {type}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Required: select a church before exporting report CSV files.</p>
          {exportStatus ? <p className="mt-2 text-xs text-muted">{exportStatus}</p> : null}
        </Card>

        <Card className="ff-surface p-6">
          <h2 className="text-lg font-semibold">Recent audit logs</h2>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {isLoadingAuditLogs ? <p>Loading audit activity...</p> : null}
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
        {settlementsStatus ? <p className="text-xs text-muted">{settlementsStatus}</p> : null}
        </>
        ) : null}
        </div>
        <PageContextSidebar rootId="finance-page-sections" title="Finance sections" />
      </div>
      )}
    </Shell>
  );
}
