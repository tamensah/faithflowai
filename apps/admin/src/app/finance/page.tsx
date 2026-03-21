'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DataTable,
  Textarea,
  Badge,
} from '@faithflow-ai/ui';
import type { ColumnDef } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { trpc } from '../../lib/trpc';
import { useAuth } from '@clerk/nextjs';
import { useFeatureGate } from '../../lib/entitlements';
import { FeatureLocked } from '../../components/FeatureLocked';
import { ReadOnlyNotice } from '../../components/ReadOnlyNotice';
import { EmptyState } from '../../components/EmptyState';
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

  // Workspace
  const [churchId, setChurchId] = useState('');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [activeSection, setActiveSection] = useState('operations');

  // Statement
  const [statementError, setStatementError] = useState<string | null>(null);
  const [statementYear, setStatementYear] = useState(String(new Date().getFullYear()));
  const [statementMemberId, setStatementMemberId] = useState('');
  const [statementEmail, setStatementEmail] = useState('');
  const [statementSendStatus, setStatementSendStatus] = useState('');

  // Pledge dialog
  const [pledgeOpen, setPledgeOpen] = useState(false);
  const [pledgeAmount, setPledgeAmount] = useState('100');
  const [pledgeCurrency, setPledgeCurrency] = useState('USD');
  const [pledgeNotes, setPledgeNotes] = useState('');

  // Recurring dialog
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [recurringAmount, setRecurringAmount] = useState('25');
  const [recurringCurrency, setRecurringCurrency] = useState('USD');
  const [recurringInterval, setRecurringInterval] = useState('MONTHLY');
  const [recurringProvider, setRecurringProvider] = useState('STRIPE');
  const [recurringDonorEmail, setRecurringDonorEmail] = useState('');

  // Category dialog
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');

  // Expense dialog
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('50');
  const [expenseCurrency, setExpenseCurrency] = useState('USD');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseCategoryId, setExpenseCategoryId] = useState('');

  // Budget dialog
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetName, setBudgetName] = useState('');
  const [budgetStart, setBudgetStart] = useState('');
  const [budgetEnd, setBudgetEnd] = useState('');

  // Budget item dialog
  const [budgetItemOpen, setBudgetItemOpen] = useState(false);
  const [budgetItemName, setBudgetItemName] = useState('');
  const [budgetItemAmount, setBudgetItemAmount] = useState('1000');
  const [budgetItemCategoryId, setBudgetItemCategoryId] = useState('');
  const [selectedBudgetId, setSelectedBudgetId] = useState('');

  // Receipts
  const [receiptEmail, setReceiptEmail] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [voidReason, setVoidReason] = useState('');

  // Refunds / disputes
  const [refundDonationId, setRefundDonationId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundLookbackDays, setRefundLookbackDays] = useState('90');
  const [selectedDisputeId, setSelectedDisputeId] = useState('');
  const [evidenceType, setEvidenceType] = useState('UNCATEGORIZED');
  const [evidenceText, setEvidenceText] = useState('');
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [submitAfterUpload, setSubmitAfterUpload] = useState(false);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);

  // Settlements
  const [selectedPayoutId, setSelectedPayoutId] = useState('');

  // Import
  const [donationImportCsv, setDonationImportCsv] = useState('');
  const [donationImportFilename, setDonationImportFilename] = useState('');
  const [donationImportResult, setDonationImportResult] = useState<any>(null);
  const [donationImportBatchId, setDonationImportBatchId] = useState('');

  // Analytics
  const [trendMonths, setTrendMonths] = useState('12');
  const [segmentLookbackMonths, setSegmentLookbackMonths] = useState('18');

  // Status messages
  const [operationsStatus, setOperationsStatus] = useState('');
  const [givingStatus, setGivingStatus] = useState('');
  const [accountingStatus, setAccountingStatus] = useState('');
  const [settlementsStatus, setSettlementsStatus] = useState('');
  const [exportStatus, setExportStatus] = useState('');

  const statementEmailRef = useRef<HTMLInputElement | null>(null);
  const donationImportRef = useRef<HTMLTextAreaElement | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: churches } = trpc.church.list.useQuery({ organizationId: undefined });
  const { data: members } = trpc.member.list.useQuery({ churchId: churchId || undefined }, { enabled: Boolean(churchId) });

  useEffect(() => {
    if (!churchId && churches?.length) setChurchId(churches[0].id);
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
            detail: 'Email or phone columns help match imported gifts to donors or members.',
          }),
        },
        {
          label: 'Posting date',
          check: (targets) => ({
            ok: targets.has('createdAt'),
            detail: 'Created date is optional, but keeps historical reports accurate.',
          }),
        },
      ]),
    [donationImportCsv]
  );

  useKeyboardShortcuts([
    { key: '/', onTrigger: () => statementEmailRef.current?.focus() },
    { key: 'i', shift: true, onTrigger: () => donationImportRef.current?.focus() },
  ]);

  const { data: summary } = trpc.finance.reconciliationSummary.useQuery({ churchId: churchId || undefined }, { enabled: Boolean(churchId) });
  const { data: dashboard } = trpc.finance.dashboard.useQuery({ churchId: churchId || undefined }, { enabled: Boolean(churchId) });
  const { data: mismatches } = trpc.finance.reconciliationMismatches.useQuery({ churchId: churchId || undefined }, { enabled: Boolean(churchId) });
  const { data: donorInsights } = trpc.finance.donorInsights.useQuery({ churchId: churchId || undefined }, { enabled: Boolean(churchId) });
  const { data: donationTrends } = trpc.finance.donationTrends.useQuery({ churchId: churchId || undefined, months: Number(trendMonths || '12') }, { enabled: Boolean(churchId) });
  const { data: donationForecast } = trpc.finance.donationForecast.useQuery({ churchId: churchId || undefined, months: Number(trendMonths || '12') }, { enabled: Boolean(churchId) });
  const { data: donorSegments } = trpc.finance.donorSegments.useQuery({ churchId: churchId || undefined, lookbackMonths: Number(segmentLookbackMonths || '18') }, { enabled: Boolean(churchId) });
  const { data: aiInsights, isFetching: isFetchingInsights, refetch: refetchInsights } = trpc.insights.donorSummary.useQuery({ churchId: churchId || undefined }, { enabled: Boolean(churchId) });
  const { data: statement } = trpc.finance.tithingStatement.useQuery({ churchId: churchId || undefined, year: Number(statementYear), memberId: statementMemberId || undefined, donorEmail: statementEmail || undefined }, { enabled: Boolean(churchId && (statementMemberId || statementEmail)) });
  const { data: pledges, isLoading: isLoadingPledges } = trpc.pledge.list.useQuery({ churchId: churchId || undefined }, { enabled: Boolean(churchId) });
  const { data: recurring, isLoading: isLoadingRecurring } = trpc.recurring.list.useQuery({ churchId: churchId || undefined }, { enabled: Boolean(churchId) });
  const { data: categories, isLoading: isLoadingCategories } = trpc.expenseCategory.list.useQuery({ churchId: churchId || undefined }, { enabled: Boolean(churchId) });
  const { data: expenses, isLoading: isLoadingExpenses } = trpc.expense.list.useQuery({ churchId: churchId || undefined }, { enabled: Boolean(churchId) });
  const { data: budgets, isLoading: isLoadingBudgets } = trpc.budget.list.useQuery({ churchId: churchId || undefined }, { enabled: Boolean(churchId) });
  const { data: receipts, isLoading: isLoadingReceipts } = trpc.receipt.list.useQuery({ churchId: churchId || undefined, limit: 20 }, { enabled: Boolean(churchId) });
  const { data: auditLogs, isLoading: isLoadingAuditLogs } = trpc.audit.list.useQuery({ churchId: churchId || undefined, limit: 20 }, { enabled: Boolean(churchId) });
  const { data: payouts, isLoading: isLoadingPayouts } = trpc.finance.listPayouts.useQuery({ churchId: churchId || undefined, limit: 20 }, { enabled: Boolean(churchId) });
  const { data: payoutTransactions, isLoading: isLoadingPayoutTransactions } = trpc.finance.payoutTransactions.useQuery({ payoutId: selectedPayoutId, limit: 20 }, { enabled: Boolean(selectedPayoutId) });
  const { data: refunds, isLoading: isLoadingRefunds } = trpc.finance.refunds.useQuery({ churchId: churchId || undefined, limit: 20 }, { enabled: Boolean(churchId) });
  const { data: disputes, isLoading: isLoadingDisputes } = trpc.finance.disputes.useQuery({ churchId: churchId || undefined, limit: 20 }, { enabled: Boolean(churchId) });
  const { data: disputeSummary } = trpc.finance.disputeSummary.useQuery({ churchId: churchId || undefined }, { enabled: Boolean(churchId) });
  const { data: refundAnalytics } = trpc.finance.refundAnalytics.useQuery({ churchId: churchId || undefined, lookbackDays: Number(refundLookbackDays) }, { enabled: Boolean(churchId) });
  const { data: disputeEvidence } = trpc.finance.disputeEvidence.useQuery({ disputeId: selectedDisputeId }, { enabled: Boolean(selectedDisputeId) });

  useEffect(() => {
    if (!selectedBudgetId && budgets?.length) setSelectedBudgetId(budgets[0].id);
  }, [selectedBudgetId, budgets]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const { mutate: createPledge, isPending: isCreatingPledge } = trpc.pledge.create.useMutation({
    onSuccess: async () => {
      setGivingStatus('Pledge created.');
      setPledgeNotes('');
      setPledgeOpen(false);
      await utils.pledge.list.invalidate();
    },
    onError: (e) => setGivingStatus(e.message),
  });

  const { mutate: createRecurring, isPending: isCreatingRecurring } = trpc.recurring.createCheckout.useMutation({
    onSuccess: async (result) => {
      setGivingStatus('Recurring checkout created.');
      setRecurringOpen(false);
      await utils.recurring.list.invalidate();
      if (result.checkoutUrl) window.open(result.checkoutUrl, '_blank', 'noopener');
    },
    onError: (e) => setGivingStatus(e.message),
  });

  const { mutate: chargeRecurring } = trpc.recurring.chargeNow.useMutation({
    onSuccess: () => { setGivingStatus('Charge attempt queued.'); return utils.recurring.list.invalidate(); },
    onError: (e) => setGivingStatus(e.message),
  });

  const { mutate: createCategory, isPending: isCreatingCategory } = trpc.expenseCategory.create.useMutation({
    onSuccess: async () => {
      setAccountingStatus('Category created.');
      setCategoryName('');
      setCategoryDescription('');
      setCategoryOpen(false);
      await utils.expenseCategory.list.invalidate();
    },
    onError: (e) => setAccountingStatus(e.message),
  });

  const { mutate: createExpense, isPending: isCreatingExpense } = trpc.expense.create.useMutation({
    onSuccess: async () => {
      setAccountingStatus('Expense created.');
      setExpenseDescription('');
      setExpenseOpen(false);
      await utils.expense.list.invalidate();
    },
    onError: (e) => setAccountingStatus(e.message),
  });

  const { mutate: approveExpense } = trpc.expense.approve.useMutation({
    onSuccess: () => { setAccountingStatus('Expense approved.'); return utils.expense.list.invalidate(); },
    onError: (e) => setAccountingStatus(e.message),
  });
  const { mutate: rejectExpense } = trpc.expense.reject.useMutation({
    onSuccess: () => { setAccountingStatus('Expense rejected.'); return utils.expense.list.invalidate(); },
    onError: (e) => setAccountingStatus(e.message),
  });
  const { mutate: markPaid } = trpc.expense.markPaid.useMutation({
    onSuccess: () => { setAccountingStatus('Expense marked as paid.'); return utils.expense.list.invalidate(); },
    onError: (e) => setAccountingStatus(e.message),
  });

  const { mutate: createBudget, isPending: isCreatingBudget } = trpc.budget.create.useMutation({
    onSuccess: async () => {
      setAccountingStatus('Budget created.');
      setBudgetName('');
      setBudgetStart('');
      setBudgetEnd('');
      setBudgetOpen(false);
      await utils.budget.list.invalidate();
    },
    onError: (e) => setAccountingStatus(e.message),
  });

  const { mutate: addBudgetItem, isPending: isAddingBudgetItem } = trpc.budget.addItem.useMutation({
    onSuccess: async () => {
      setAccountingStatus('Budget item added.');
      setBudgetItemName('');
      setBudgetItemOpen(false);
      await utils.budget.list.invalidate();
    },
    onError: (e) => setAccountingStatus(e.message),
  });

  const { mutate: sendReceiptEmail, isPending: isSendingReceipt } = trpc.receipt.sendEmail.useMutation({
    onSuccess: () => { setAccountingStatus('Receipt email sent.'); setReceiptEmail(''); setReceiptNumber(''); },
    onError: (e) => setAccountingStatus(e.message),
  });

  const { mutate: sendTithingStatementEmail, isPending: isSendingStatement } = trpc.finance.sendTithingStatementEmail.useMutation({
    onSuccess: () => setStatementSendStatus('Statement email sent.'),
    onError: (e) => setStatementSendStatus(e.message),
  });

  const { mutate: voidReceipt, isPending: isVoidingReceipt } = trpc.receipt.void.useMutation({
    onSuccess: () => {
      setAccountingStatus('Receipt voided.');
      setReceiptNumber('');
      setVoidReason('');
      utils.receipt.list.invalidate();
    },
    onError: (e) => setAccountingStatus(e.message),
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
    onError: (e) => setAccountingStatus(e.message),
  });

  const { mutate: submitDispute, isPending: isSubmittingDispute } = trpc.finance.submitDispute.useMutation({
    onSuccess: () => { setAccountingStatus('Dispute submitted.'); return utils.finance.disputes.invalidate(); },
    onError: (e) => setAccountingStatus(e.message),
  });

  const { mutate: submitEvidenceText, isPending: isSubmittingEvidence } = trpc.finance.submitDisputeEvidenceText.useMutation({
    onSuccess: () => {
      setAccountingStatus('Evidence submitted.');
      setEvidenceText('');
      setEvidenceDescription('');
      utils.finance.disputeEvidence.invalidate();
      utils.finance.disputes.invalidate();
    },
    onError: (e) => setAccountingStatus(e.message),
  });

  const { mutate: syncStripePayouts, isPending: isSyncingStripe } = trpc.finance.syncStripePayouts.useMutation({
    onSuccess: () => { setSettlementsStatus('Stripe payouts synced.'); return utils.finance.listPayouts.invalidate(); },
    onError: (e) => setSettlementsStatus(e.message),
  });

  const { mutate: syncPaystackSettlements, isPending: isSyncingPaystack } = trpc.finance.syncPaystackSettlements.useMutation({
    onSuccess: () => { setSettlementsStatus('Paystack settlements synced.'); return utils.finance.listPayouts.invalidate(); },
    onError: (e) => setSettlementsStatus(e.message),
  });

  const { mutate: importDonations, isPending: isImportingDonations } = trpc.donation.importCsv.useMutation({
    onSuccess: async (result) => {
      setOperationsStatus('Donation import processed.');
      setDonationImportResult(result);
      if (result?.batchId) setDonationImportBatchId(result.batchId);
      await Promise.all([utils.donation.list.invalidate(), utils.receipt.list.invalidate()]);
    },
    onError: (e) => setOperationsStatus(e.message),
  });

  const { mutate: rollbackDonationImport, isPending: isRollingBackDonationImport } = trpc.donation.rollbackImport.useMutation({
    onSuccess: async () => {
      setOperationsStatus('Import batch rolled back.');
      setDonationImportResult(null);
      setDonationImportBatchId('');
      await Promise.all([utils.donation.list.invalidate(), utils.receipt.list.invalidate()]);
    },
    onError: (e) => setOperationsStatus(e.message),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
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
    if (!churchId || !pledgeAmount) { setGivingStatus('Church and pledge amount are required.'); return; }
    setGivingStatus('');
    createPledge({ churchId, amount: Number(pledgeAmount), currency: pledgeCurrency, notes: pledgeNotes || undefined });
  };

  const handleCreateRecurring = () => {
    if (!churchId || !recurringAmount) { setGivingStatus('Church and amount are required.'); return; }
    if (recurringProvider === 'PAYSTACK' && !recurringDonorEmail.trim()) { setGivingStatus('Donor email required for Paystack.'); return; }
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
    if (!churchId || !categoryName.trim()) { setAccountingStatus('Church and category name are required.'); return; }
    setAccountingStatus('');
    createCategory({ churchId, name: categoryName, description: categoryDescription || undefined });
  };

  const handleCreateExpense = () => {
    if (!churchId || !expenseAmount) { setAccountingStatus('Church and expense amount are required.'); return; }
    setAccountingStatus('');
    createExpense({ churchId, amount: Number(expenseAmount), currency: expenseCurrency, categoryId: expenseCategoryId || undefined, description: expenseDescription || undefined });
  };

  const handleCreateBudget = () => {
    if (!churchId || !budgetName || !budgetStart || !budgetEnd) { setAccountingStatus('Church, budget name, and date range are required.'); return; }
    setAccountingStatus('');
    createBudget({ churchId, name: budgetName, startAt: budgetStart, endAt: budgetEnd });
  };

  const handleAddBudgetItem = () => {
    if (!selectedBudgetId || !budgetItemName || !budgetItemAmount) { setAccountingStatus('Budget, item name, and amount are required.'); return; }
    setAccountingStatus('');
    addBudgetItem({ budgetId: selectedBudgetId, name: budgetItemName, allocatedAmount: Number(budgetItemAmount), categoryId: budgetItemCategoryId || undefined });
  };

  const handleSendReceipt = () => {
    if (!receiptNumber.trim() || !receiptEmail.trim()) { setAccountingStatus('Receipt number and recipient email are required.'); return; }
    setAccountingStatus('');
    sendReceiptEmail({ receiptNumber, to: receiptEmail });
  };

  const handleVoidReceipt = () => {
    if (!receiptNumber.trim()) { setAccountingStatus('Receipt number is required to void a receipt.'); return; }
    setAccountingStatus('');
    voidReceipt({ receiptNumber, reason: voidReason || undefined });
  };

  const handleIssueRefund = () => {
    if (!refundDonationId.trim()) { setAccountingStatus('Donation ID is required to issue a refund.'); return; }
    setAccountingStatus('');
    refundDonation({ donationId: refundDonationId, amount: refundAmount ? Number(refundAmount) : undefined, reason: refundReason || undefined });
  };

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

  const handleExportCsv = async (type: string) => {
    if (!churchId) { setExportStatus('Select a church before exporting reports.'); return; }
    try {
      setExportStatus('');
      const result = await utils.finance.exportCsv.fetch({ type: type as any, churchId: churchId || undefined });
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

  // ── Table column definitions ───────────────────────────────────────────────
  const pledgeColumns: ColumnDef<NonNullable<typeof pledges>[number], unknown>[] = [
    { accessorKey: 'amount', header: 'Amount', cell: ({ row }) => `${row.original.amount} ${row.original.currency}` },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge variant={getValue() === 'FULFILLED' ? 'success' : 'default'}>{String(getValue())}</Badge> },
    { accessorKey: 'notes', header: 'Notes', cell: ({ getValue }) => <span className="text-muted">{String(getValue() ?? '—')}</span> },
  ];

  const recurringColumns: ColumnDef<NonNullable<typeof recurring>[number], unknown>[] = [
    { accessorKey: 'amount', header: 'Amount', cell: ({ row }) => `${row.original.amount} ${row.original.currency}` },
    { accessorKey: 'interval', header: 'Interval' },
    { accessorKey: 'provider', header: 'Provider' },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge variant={getValue() === 'ACTIVE' ? 'success' : 'default'}>{String(getValue())}</Badge> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); chargeRecurring({ id: row.original.id }); }}>
          Charge now
        </Button>
      ),
    },
  ];

  const expenseColumns: ColumnDef<NonNullable<typeof expenses>[number], unknown>[] = [
    { accessorKey: 'amount', header: 'Amount', cell: ({ row }) => `${row.original.amount} ${row.original.currency}` },
    { accessorKey: 'description', header: 'Description', cell: ({ getValue }) => <span className="text-muted">{String(getValue() ?? '—')}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge variant={getValue() === 'APPROVED' ? 'success' : getValue() === 'REJECTED' ? 'warning' : 'default'}>{String(getValue())}</Badge> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); approveExpense({ id: row.original.id }); }}>Approve</Button>
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); rejectExpense({ id: row.original.id }); }}>Reject</Button>
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); markPaid({ id: row.original.id }); }}>Mark paid</Button>
        </div>
      ),
    },
  ];

  const receiptColumns: ColumnDef<NonNullable<typeof receipts>[number], unknown>[] = [
    { accessorKey: 'receiptNumber', header: 'Receipt #' },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge variant={getValue() === 'VOIDED' ? 'warning' : 'default'}>{String(getValue())}</Badge> },
    { accessorKey: 'issuedAt', header: 'Issued', cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString() },
  ];

  const refundColumns: ColumnDef<NonNullable<typeof refunds>[number], unknown>[] = [
    { accessorKey: 'amount', header: 'Amount', cell: ({ row }) => `${row.original.amount} ${row.original.currency}` },
    { accessorKey: 'provider', header: 'Provider' },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge variant={getValue() === 'SUCCEEDED' ? 'success' : 'default'}>{String(getValue())}</Badge> },
  ];

  const disputeColumns: ColumnDef<NonNullable<typeof disputes>[number], unknown>[] = [
    { accessorKey: 'amount', header: 'Amount', cell: ({ row }) => `${row.original.amount ?? ''} ${row.original.currency ?? ''}` },
    { accessorKey: 'provider', header: 'Provider' },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge variant={getValue() === 'WON' ? 'success' : getValue() === 'LOST' ? 'warning' : 'default'}>{String(getValue())}</Badge> },
  ];

  const payoutColumns: ColumnDef<NonNullable<typeof payouts>[number], unknown>[] = [
    { accessorKey: 'provider', header: 'Provider' },
    { accessorKey: 'amount', header: 'Amount', cell: ({ row }) => `${row.original.amount} ${row.original.currency}` },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge variant={getValue() === 'PAID' ? 'success' : 'default'}>{String(getValue())}</Badge> },
  ];

  const auditColumns: ColumnDef<NonNullable<typeof auditLogs>[number], unknown>[] = [
    { accessorKey: 'action', header: 'Action' },
    { accessorKey: 'targetType', header: 'Type' },
    { accessorKey: 'createdAt', header: 'Date', cell: ({ getValue }) => new Date(getValue() as string).toLocaleString() },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Shell>
      {!gate.isLoading && gate.access === 'locked' ? (
        <FeatureLocked
          featureKey="finance_enabled"
          title="Finance is locked"
          description="Your current subscription does not include finance operations. Upgrade to restore access."
        />
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <Card className="border-primary/10 bg-gradient-to-r from-slate-950 to-primary p-6 text-primary-foreground shadow-lg">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">Finance operations</p>
                <h1 className="mt-2 font-display text-3xl font-semibold">Finance</h1>
                <p className="mt-2 max-w-2xl text-sm text-white/80">
                  Reconciliation, giving operations, disputes, payouts, and accounting workflows in one control plane.
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                  {churches?.find((c) => c.id === churchId)?.name ?? 'No church selected'}
                </span>
                <div className="flex items-center gap-1.5 rounded-md border border-white/25 bg-white/10 p-1">
                  <button
                    type="button"
                    className={`rounded px-2 py-1 text-xs ${density === 'comfortable' ? 'bg-white/20 font-semibold' : 'text-white/60'}`}
                    onClick={() => setDensity('comfortable')}
                  >
                    Comfortable
                  </button>
                  <button
                    type="button"
                    className={`rounded px-2 py-1 text-xs ${density === 'compact' ? 'bg-white/20 font-semibold' : 'text-white/60'}`}
                    onClick={() => setDensity('compact')}
                  >
                    Compact
                  </button>
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Donations', value: (dashboard?.donations ?? []).reduce((s, i) => s + i._count, 0) },
                { label: 'Expenses', value: (dashboard?.expenses ?? []).reduce((s, i) => s + i._count, 0) },
                { label: 'Refund cases', value: refunds?.length ?? 0 },
                { label: 'Open disputes', value: disputes?.filter((d) => d.status !== 'WON' && d.status !== 'LOST').length ?? 0 },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-white/20 bg-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-white/70">{kpi.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{kpi.value}</p>
                </div>
              ))}
            </div>
          </Card>

          {gate.readOnly ? <ReadOnlyNotice /> : null}

          {/* Keyboard hint */}
          <p className="text-xs text-muted">
            Shortcuts: <kbd className="rounded border px-1.5 py-0.5 text-xs">/</kbd> statement email ·{' '}
            <kbd className="rounded border px-1.5 py-0.5 text-xs">Shift</kbd>+<kbd className="rounded border px-1.5 py-0.5 text-xs">I</kbd> import CSV
          </p>

          {/* Tabs */}
          <Tabs value={activeSection} onValueChange={setActiveSection}>
            <div className="sticky top-16 z-10 -mx-4 border-b border-border/50 bg-white/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="operations">Operations</TabsTrigger>
                <TabsTrigger value="giving">Giving ops</TabsTrigger>
                <TabsTrigger value="accounting">Accounting</TabsTrigger>
                <TabsTrigger value="settlements">Settlements</TabsTrigger>
              </TabsList>
            </div>

            {/* ── Operations ─────────────────────────────────────────────── */}
            <TabsContent value="operations" className="mt-6 space-y-6">
              {/* CSV Import */}
              <Card className="ff-surface p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Import donations (CSV)</h2>
                    <p className="mt-1 text-sm text-muted">Dry-run, apply, and rollback donation imports.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={downloadDonationTemplate}>Download template</Button>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <label className="cursor-pointer rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground hover:bg-muted/5">
                    Choose file
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setDonationImportFilename(file.name);
                        setDonationImportCsv(await file.text());
                      }}
                    />
                  </label>
                  <span className="text-xs text-muted">{donationImportFilename || 'No file chosen'}</span>
                </div>

                <Textarea
                  ref={donationImportRef}
                  className="mt-4 min-h-[120px]"
                  placeholder="Paste donation CSV here…"
                  value={donationImportCsv}
                  onChange={(e) => setDonationImportCsv(e.target.value)}
                />

                {donationImportPreview ? (
                  <div className="mt-4 rounded-xl border border-border bg-muted/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">Import mapping preview</p>
                        <p className="text-xs text-muted">
                          {donationImportPreview.rowCount} row{donationImportPreview.rowCount === 1 ? '' : 's'} ·{' '}
                          {donationImportPreview.recognizedCount}/{donationImportPreview.rawHeaders.length} mapped
                        </p>
                      </div>
                      <Badge variant={donationImportPreview.unrecognizedHeaders.length ? 'warning' : 'success'}>
                        {donationImportPreview.unrecognizedHeaders.length ? 'Review headers' : 'Ready to import'}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <div className="space-y-1.5 text-xs text-muted">
                        {donationImportPreview.mappedHeaders.map((entry) => (
                          <div key={`${entry.source}-${entry.target ?? 'unmapped'}`} className="flex items-center justify-between gap-3 rounded-md border border-border bg-white px-3 py-2">
                            <span className="truncate">{entry.source}</span>
                            <span className="font-medium text-foreground">{entry.target ?? 'Unmapped'}</span>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        {donationImportPreview.readiness.map((item) => (
                          <div key={item.label} className="rounded-md border border-border bg-white px-3 py-2 text-xs">
                            <p className="font-medium text-foreground">{item.label}: {item.ok ? '✓ OK' : '⚠ Needs attention'}</p>
                            <p className="mt-0.5 text-muted">{item.detail}</p>
                          </div>
                        ))}
                        {donationImportPreview.sampleRows[0] ? (
                          <div className="rounded-md border border-border bg-white p-3 text-xs">
                            <p className="font-medium text-foreground">Sample row</p>
                            <pre className="mt-1 whitespace-pre-wrap text-muted">{JSON.stringify(donationImportPreview.sampleRows[0], null, 2)}</pre>
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
                    onClick={() => importDonations({ churchId, csv: donationImportCsv, dryRun: true })}
                  >
                    {isImportingDonations ? 'Running…' : 'Dry-run import'}
                  </Button>
                  <Button
                    disabled={!canWrite || !churchId || donationImportCsv.trim().length < 5 || isImportingDonations}
                    onClick={() => importDonations({ churchId, csv: donationImportCsv })}
                  >
                    {isImportingDonations ? 'Importing…' : 'Apply import'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!canWrite || !donationImportBatchId || isRollingBackDonationImport}
                    onClick={() => rollbackDonationImport({ batchId: donationImportBatchId })}
                  >
                    {isRollingBackDonationImport ? 'Rolling back…' : 'Rollback last batch'}
                  </Button>
                </div>
                {operationsStatus ? <p className="mt-2 text-xs text-muted">{operationsStatus}</p> : null}

                {donationImportResult ? (
                  <div className="mt-4 rounded-lg border border-border bg-muted/5 p-4 text-sm">
                    <p className="font-medium">
                      Batch: {donationImportResult.batchId ?? 'dry-run'} · Scanned: {donationImportResult.summary?.scanned ?? 0} · Created: {donationImportResult.summary?.created ?? 0} · Skipped: {donationImportResult.summary?.skipped ?? 0} · Errors: {donationImportResult.summary?.errors ?? 0}
                    </p>
                    {donationImportResult.errors?.length ? (
                      <pre className="mt-2 rounded-md bg-muted/10 p-3 text-xs">
                        {JSON.stringify(donationImportResult.errors.slice(0, 20), null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ) : null}
              </Card>

              {/* Reconciliation */}
              <Card className="ff-surface p-6">
                <h2 className="text-lg font-semibold">Reconciliation</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-white p-4 text-center">
                    <p className="text-xs text-muted">Delta</p>
                    <p className="mt-1 text-2xl font-semibold">{summary?.totals?.delta ?? 0}</p>
                    <p className="text-xs text-muted">intents − donations</p>
                  </div>
                  <div className="rounded-lg border border-border bg-white p-4">
                    <p className="mb-2 text-xs font-semibold text-muted">Payment intents by status</p>
                    {(summary?.paymentIntents ?? []).map((pi: any) => (
                      <div key={pi.status} className="flex justify-between text-xs"><span>{pi.status}</span><span className="font-medium">{pi._count}</span></div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-border bg-white p-4">
                    <p className="mb-2 text-xs font-semibold text-muted">Donations by status</p>
                    {(summary?.donations ?? []).map((d: any) => (
                      <div key={d.status} className="flex justify-between text-xs"><span>{d.status}</span><span className="font-medium">{d._count}</span></div>
                    ))}
                  </div>
                </div>
                {((mismatches?.intentWithoutCompletedDonation?.length ?? 0) > 0 || (mismatches?.donationWithPendingIntent?.length ?? 0) > 0) ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold text-amber-800">Intents without completed donation ({mismatches?.intentWithoutCompletedDonation?.length ?? 0})</p>
                      {mismatches?.intentWithoutCompletedDonation?.slice(0, 5).map((m: any) => (
                        <p key={m.id} className="mt-1 truncate text-xs text-amber-700">{m.id}</p>
                      ))}
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold text-amber-800">Donations with pending intent ({mismatches?.donationWithPendingIntent?.length ?? 0})</p>
                      {mismatches?.donationWithPendingIntent?.slice(0, 5).map((m: any) => (
                        <p key={m.id} className="mt-1 truncate text-xs text-amber-700">{m.id}</p>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-emerald-700">No reconciliation mismatches found.</p>
                )}
              </Card>

              {/* Donor Insights + AI */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="ff-surface p-6">
                  <h2 className="text-lg font-semibold">Donor insights</h2>
                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-muted">Members</p>
                      {(donorInsights?.members ?? []).slice(0, 5).map((m: any) => (
                        <div key={m.id ?? m.email} className="flex justify-between border-b border-border/60 py-1.5 text-xs">
                          <span>{m.name ?? m.email}</span>
                          <span className="font-medium">{m.totalAmount ?? m._sum?.amount ?? ''}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-muted">Anonymous</p>
                      {(donorInsights?.anonymous ?? []).slice(0, 3).map((a: any, i: number) => (
                        <div key={i} className="flex justify-between border-b border-border/60 py-1.5 text-xs">
                          <span>Anonymous</span>
                          <span className="font-medium">{a.totalAmount ?? a._sum?.amount ?? ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>

                <Card className="ff-surface p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">AI donor insights</h2>
                    <Button variant="outline" size="sm" onClick={() => refetchInsights()} disabled={isFetchingInsights}>
                      {isFetchingInsights ? 'Refreshing…' : 'Refresh'}
                    </Button>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm text-muted">{aiInsights?.summary ?? 'No insights yet.'}</p>
                  {aiInsights?.warnings?.length ? (
                    <p className="mt-2 text-xs text-muted">Warnings: {aiInsights.warnings.join(' · ')}</p>
                  ) : null}
                </Card>
              </div>

              {/* Trends & Segments */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="ff-surface p-6">
                  <h2 className="text-lg font-semibold">Donation trends</h2>
                  <div className="mt-3 flex items-center gap-3">
                    <Input
                      placeholder="Months"
                      type="number"
                      className="w-28"
                      value={trendMonths}
                      onChange={(e) => setTrendMonths(e.target.value)}
                    />
                    <span className="text-xs text-muted">months lookback</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {((donationTrends as any)?.monthly ?? []).slice(-4).map((m: any) => (
                      <div key={m.month} className="rounded-lg border border-border bg-white p-3 text-xs">
                        <p className="font-semibold">{m.month}</p>
                        <p className="mt-1 text-xl font-bold">{m.total ?? m.amount ?? 0}</p>
                        <p className="text-muted">{m.count ?? 0} gifts</p>
                      </div>
                    ))}
                  </div>
                  {donationForecast ? (
                    <div className="mt-4 rounded-lg border border-primary/10 bg-primary/5 p-3 text-xs">
                      <p className="font-semibold text-primary">Forecast</p>
                      <p className="mt-1 text-muted">Next period: {(donationForecast as any).nextPeriod ?? JSON.stringify(donationForecast)}</p>
                    </div>
                  ) : null}
                </Card>

                <Card className="ff-surface p-6">
                  <h2 className="text-lg font-semibold">Donor segments</h2>
                  <div className="mt-3 flex items-center gap-3">
                    <Input
                      placeholder="Months"
                      type="number"
                      className="w-28"
                      value={segmentLookbackMonths}
                      onChange={(e) => setSegmentLookbackMonths(e.target.value)}
                    />
                    <span className="text-xs text-muted">months lookback</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {Object.entries(donorSegments ?? {}).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2 text-xs">
                        <span className="capitalize">{key}</span>
                        <span className="font-semibold">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Refund analytics */}
              <Card className="ff-surface p-6">
                <h2 className="text-lg font-semibold">Refund analytics</h2>
                <div className="mt-3 flex items-center gap-3">
                  <Input
                    placeholder="Lookback days"
                    type="number"
                    className="w-32"
                    value={refundLookbackDays}
                    onChange={(e) => setRefundLookbackDays(e.target.value)}
                  />
                  <span className="text-xs text-muted">days lookback</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {Object.entries(refundAnalytics ?? {}).map(([key, val]) => (
                    <div key={key} className="rounded-lg border border-border bg-white p-3 text-xs">
                      <p className="capitalize text-muted">{key}</p>
                      <p className="mt-1 text-lg font-bold">{String(val)}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            {/* ── Giving ops ─────────────────────────────────────────────── */}
            <TabsContent value="giving" className="mt-6 space-y-6">
              {/* Tithing statement */}
              <Card className="ff-surface p-6">
                <h2 className="text-lg font-semibold">Tithing statement</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Input placeholder="Year" value={statementYear} onChange={(e) => setStatementYear(e.target.value)} />
                  <select
                    className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                    value={statementMemberId}
                    onChange={(e) => { setStatementSendStatus(''); setStatementMemberId(e.target.value); setStatementEmail(''); }}
                  >
                    <option value="">Select member</option>
                    {members?.map((m) => (
                      <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                    ))}
                  </select>
                  <Input
                    ref={statementEmailRef}
                    placeholder="Or donor email"
                    value={statementEmail}
                    onChange={(e) => { setStatementError(null); setStatementSendStatus(''); setStatementEmail(e.target.value); setStatementMemberId(''); }}
                    aria-invalid={Boolean(statementError && !statementEmail && !statementMemberId)}
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    disabled={!canWrite || !churchId || !statementYear || !(statementMemberId || statementEmail) || isSendingStatement}
                    onClick={() => {
                      if (!statementYear || Number.isNaN(Number(statementYear))) { setStatementError('Enter a valid year.'); return; }
                      if (!statementMemberId && !statementEmail.trim()) { setStatementError('Select a member or provide donor email.'); return; }
                      setStatementError(null);
                      setStatementSendStatus('');
                      sendTithingStatementEmail({ churchId, year: Number(statementYear), memberId: statementMemberId || undefined, donorEmail: statementEmail || undefined });
                    }}
                  >
                    {isSendingStatement ? 'Sending…' : 'Email statement'}
                  </Button>
                  {statementError ? <p className="text-xs font-medium text-destructive">{statementError}</p> : null}
                  {statementSendStatus ? <p className="text-xs text-muted">{statementSendStatus}</p> : null}
                </div>
                {statement ? (
                  <div className="mt-4 rounded-lg border border-border bg-muted/5 p-3 text-xs text-muted">
                    <p className="font-medium text-foreground">Statement preview</p>
                    <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(statement, null, 2)}</pre>
                  </div>
                ) : null}
              </Card>

              {/* Pledges */}
              <Card className="ff-surface p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Pledges</h2>
                  <Button size="sm" onClick={() => setPledgeOpen(true)} disabled={!canWrite || !churchId}>+ Add pledge</Button>
                </div>
                <div className="mt-4">
                  <DataTable
                    columns={pledgeColumns}
                    data={pledges ?? []}
                    isLoading={isLoadingPledges}
                    emptyMessage="No pledges yet. Create your first pledge to track commitment-based giving."
                  />
                </div>
                {givingStatus ? <p className="mt-2 text-xs text-muted">{givingStatus}</p> : null}
              </Card>

              {/* Recurring Donations */}
              <Card className="ff-surface p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Recurring donations</h2>
                  <Button size="sm" onClick={() => setRecurringOpen(true)} disabled={!canWrite || !churchId}>+ Add recurring</Button>
                </div>
                <div className="mt-4">
                  <DataTable
                    columns={recurringColumns}
                    data={recurring ?? []}
                    isLoading={isLoadingRecurring}
                    emptyMessage="No recurring donations yet. Set up contributions to stabilize monthly cash flow."
                  />
                </div>
              </Card>
            </TabsContent>

            {/* ── Accounting ──────────────────────────────────────────────── */}
            <TabsContent value="accounting" className="mt-6 space-y-6">
              {/* Expense Categories + Expenses */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="ff-surface p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">Expense categories</h2>
                    <Button size="sm" onClick={() => setCategoryOpen(true)} disabled={!canWrite || !churchId}>+ Add category</Button>
                  </div>
                  <div className="mt-4 space-y-1.5">
                    {isLoadingCategories ? <p className="text-xs text-muted">Loading…</p> : null}
                    {categories?.map((cat) => (
                      <div key={cat.id} className={`flex items-center justify-between rounded-md border border-border bg-white px-3 ${rowClass}`}>
                        <span>{cat.name}</span>
                      </div>
                    ))}
                    {!categories?.length && !isLoadingCategories ? (
                      <EmptyState title="No expense categories" description="Create categories so reports and budgets stay structured." />
                    ) : null}
                  </div>
                </Card>

                <Card className="ff-surface p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">Expenses</h2>
                    <Button size="sm" onClick={() => setExpenseOpen(true)} disabled={!canWrite || !churchId}>+ Add expense</Button>
                  </div>
                  <div className="mt-4">
                    <DataTable
                      columns={expenseColumns}
                      data={expenses ?? []}
                      isLoading={isLoadingExpenses}
                      emptyMessage="No expenses yet. Submitted and approved expenses will appear here."
                    />
                  </div>
                </Card>
              </div>

              {/* Budgets */}
              <Card className="ff-surface p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Budgets</h2>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setBudgetItemOpen(true)} disabled={!canWrite || !selectedBudgetId}>+ Add item</Button>
                    <Button size="sm" onClick={() => setBudgetOpen(true)} disabled={!canWrite || !churchId}>+ New budget</Button>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {isLoadingBudgets ? <p className="text-xs text-muted">Loading…</p> : null}
                  {budgets?.map((budget) => (
                    <button
                      key={budget.id}
                      type="button"
                      className={`w-full rounded-lg border p-4 text-left transition-colors ${selectedBudgetId === budget.id ? 'border-primary bg-primary/5' : 'border-border bg-white hover:bg-muted/5'}`}
                      onClick={() => setSelectedBudgetId(budget.id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{budget.name}</span>
                        <Badge variant={(budget.status as string) === 'APPROVED' ? 'success' : 'default'}>{budget.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted">{budget.items.length} item{budget.items.length === 1 ? '' : 's'}</p>
                    </button>
                  ))}
                  {!budgets?.length && !isLoadingBudgets ? (
                    <EmptyState title="No budgets yet" description="Create a budget to track allocation and spending discipline." />
                  ) : null}
                </div>
                {accountingStatus ? <p className="mt-2 text-xs text-muted">{accountingStatus}</p> : null}
              </Card>

              {/* Receipts */}
              <Card className="ff-surface p-6">
                <h2 className="text-lg font-semibold">Receipts</h2>
                <div className="mt-4">
                  <DataTable
                    columns={receiptColumns}
                    data={receipts ?? []}
                    isLoading={isLoadingReceipts}
                    emptyMessage="No receipts yet. Receipts appear after successful donations or statement issuance."
                  />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Input placeholder="Receipt number" value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} />
                  <Input placeholder="Recipient email" value={receiptEmail} onChange={(e) => setReceiptEmail(e.target.value)} />
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleSendReceipt} disabled={!receiptNumber || !receiptEmail || isSendingReceipt} className="flex-1">
                      {isSendingReceipt ? 'Sending…' : 'Send receipt'}
                    </Button>
                    <Button variant="outline" onClick={handleVoidReceipt} disabled={!receiptNumber || isVoidingReceipt}>
                      {isVoidingReceipt ? 'Voiding…' : 'Void'}
                    </Button>
                  </div>
                </div>
                <div className="mt-2">
                  <Input placeholder="Void reason (optional)" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
                </div>
              </Card>

              {/* Refunds & Disputes */}
              <Card className="ff-surface p-6">
                <h2 className="text-lg font-semibold">Refunds & disputes</h2>

                {/* Dispute summary */}
                {disputeSummary?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {disputeSummary.map((item) => (
                      <Badge key={item.status} variant="default">{item.status}: {item._count}</Badge>
                    ))}
                  </div>
                ) : null}

                {/* Issue refund */}
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Input placeholder="Donation ID" value={refundDonationId} onChange={(e) => setRefundDonationId(e.target.value)} />
                  <Input placeholder="Amount (optional)" type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
                  <Input placeholder="Reason (optional)" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
                </div>
                <Button className="mt-3" onClick={handleIssueRefund} disabled={!refundDonationId || isRefundingDonation}>
                  {isRefundingDonation ? 'Refunding…' : 'Issue refund'}
                </Button>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <div>
                    <p className="mb-3 text-sm font-semibold">Recent refunds</p>
                    <DataTable
                      columns={refundColumns}
                      data={refunds ?? []}
                      isLoading={isLoadingRefunds}
                      emptyMessage="No refunds yet."
                    />
                  </div>
                  <div>
                    <p className="mb-3 text-sm font-semibold">Disputes</p>
                    <DataTable
                      columns={disputeColumns}
                      data={disputes ?? []}
                      isLoading={isLoadingDisputes}
                      onRowClick={(row) => setSelectedDisputeId(row.id)}
                      emptyMessage="No disputes yet."
                    />
                  </div>
                </div>

                {/* Dispute evidence panel */}
                {selectedDisputeId ? (
                  <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="font-semibold">Dispute evidence — {selectedDisputeId.slice(0, 8)}…</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)}>
                        {evidenceTypeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <Input placeholder="Description (optional)" value={evidenceDescription} onChange={(e) => setEvidenceDescription(e.target.value)} />
                      <Input placeholder="Evidence text (optional)" value={evidenceText} onChange={(e) => setEvidenceText(e.target.value)} />
                      <input type="file" className="h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-sm" onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)} />
                    </div>
                    <label className="mt-3 flex items-center gap-2 text-xs text-muted">
                      <input type="checkbox" checked={submitAfterUpload} onChange={(e) => setSubmitAfterUpload(e.target.checked)} />
                      Submit dispute after upload (Stripe only)
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => submitEvidenceText({ disputeId: selectedDisputeId, type: evidenceType as any, description: evidenceDescription || undefined, text: evidenceText || undefined, submit: submitAfterUpload })} disabled={isSubmittingEvidence || (!evidenceText && !evidenceDescription)}>
                        {isSubmittingEvidence ? 'Submitting…' : 'Submit text evidence'}
                      </Button>
                      <Button onClick={uploadEvidenceFile} disabled={!evidenceFile || isUploadingEvidence}>
                        {isUploadingEvidence ? 'Uploading…' : 'Upload file evidence'}
                      </Button>
                      <Button variant="outline" onClick={() => submitDispute({ disputeId: selectedDisputeId })} disabled={isSubmittingDispute}>
                        {isSubmittingDispute ? 'Submitting…' : 'Submit dispute'}
                      </Button>
                    </div>
                    <div className="mt-4 space-y-1.5">
                      {disputeEvidence?.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-md border border-border bg-white px-3 py-2 text-xs">
                          <span>{item.type} · {item.status}</span>
                          <span className="text-muted">{item.fileName ?? item.text?.slice(0, 20) ?? ''}</span>
                        </div>
                      ))}
                      {!disputeEvidence?.length ? (
                        <p className="text-xs text-muted">No evidence uploaded yet. Attach receipts, communication logs, or policies before submitting.</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {accountingStatus ? <p className="mt-3 text-xs text-muted">{accountingStatus}</p> : null}
              </Card>
            </TabsContent>

            {/* ── Settlements ─────────────────────────────────────────────── */}
            <TabsContent value="settlements" className="mt-6 space-y-6">
              {/* Payouts */}
              <Card className="ff-surface p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Payout reconciliation</h2>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => syncStripePayouts({})} disabled={isSyncingStripe}>
                      {isSyncingStripe ? 'Syncing Stripe…' : 'Sync Stripe'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => syncPaystackSettlements({})} disabled={isSyncingPaystack}>
                      {isSyncingPaystack ? 'Syncing Paystack…' : 'Sync Paystack'}
                    </Button>
                  </div>
                </div>
                <div className="mt-4">
                  <DataTable
                    columns={payoutColumns}
                    data={payouts ?? []}
                    isLoading={isLoadingPayouts}
                    onRowClick={(row) => setSelectedPayoutId(row.id)}
                    emptyMessage="No payouts synced. Run payout sync to load settlement records."
                  />
                </div>

                {selectedPayoutId ? (
                  <div className="mt-6 rounded-xl border border-border bg-muted/5 p-4">
                    <p className="font-semibold">Payout transactions</p>
                    <div className="mt-3 space-y-1.5">
                      {isLoadingPayoutTransactions ? <p className="text-xs text-muted">Loading…</p> : null}
                      {payoutTransactions?.map((txn) => (
                        <div key={txn.id} className={`flex items-center justify-between border-b border-border/60 ${rowClass}`}>
                          <span>{txn.amount.toString()} {txn.currency} · {txn.type ?? 'transaction'}</span>
                          <span className="text-muted">{txn.sourceRef ?? txn.providerRef}</span>
                        </div>
                      ))}
                      {!payoutTransactions?.length && !isLoadingPayoutTransactions ? (
                        <p className="text-xs text-muted">No transactions for this payout.</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {settlementsStatus ? <p className="mt-2 text-xs text-muted">{settlementsStatus}</p> : null}
              </Card>

              {/* Exports */}
              <Card className="ff-surface p-6">
                <h2 className="text-lg font-semibold">Finance exports</h2>
                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  {['donations', 'expenses', 'pledges', 'recurring', 'receipts', 'payouts', 'refunds', 'disputes'].map((type) => (
                    <Button key={type} variant="outline" size="sm" onClick={() => handleExportCsv(type)} disabled={!churchId} className="capitalize">
                      Export {type}
                    </Button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">Select a church before exporting.</p>
                {exportStatus ? <p className="mt-2 text-xs text-muted">{exportStatus}</p> : null}
              </Card>

              {/* Audit logs */}
              <Card className="ff-surface p-6">
                <h2 className="text-lg font-semibold">Recent audit logs</h2>
                <div className="mt-4">
                  <DataTable
                    columns={auditColumns}
                    data={auditLogs ?? []}
                    isLoading={isLoadingAuditLogs}
                    emptyMessage="No audit activity yet."
                  />
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* ── Dialogs ──────────────────────────────────────────────────────────── */}

      {/* Add Pledge */}
      <Dialog open={pledgeOpen} onOpenChange={setPledgeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add pledge</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Amount" type="number" value={pledgeAmount} onChange={(e) => setPledgeAmount(e.target.value)} />
              <Input placeholder="Currency" value={pledgeCurrency} onChange={(e) => setPledgeCurrency(e.target.value.toUpperCase())} />
            </div>
            <Input placeholder="Notes (optional)" value={pledgeNotes} onChange={(e) => setPledgeNotes(e.target.value)} />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPledgeOpen(false)}>Cancel</Button>
            <Button onClick={handleCreatePledge} disabled={!churchId || !pledgeAmount || isCreatingPledge}>
              {isCreatingPledge ? 'Creating…' : 'Create pledge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Recurring */}
      <Dialog open={recurringOpen} onOpenChange={setRecurringOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add recurring donation</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Amount" type="number" value={recurringAmount} onChange={(e) => setRecurringAmount(e.target.value)} />
              <Input placeholder="Currency" value={recurringCurrency} onChange={(e) => setRecurringCurrency(e.target.value.toUpperCase())} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={recurringInterval} onChange={(e) => setRecurringInterval(e.target.value)}>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="YEARLY">Yearly</option>
              </select>
              <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={recurringProvider} onChange={(e) => setRecurringProvider(e.target.value)}>
                <option value="STRIPE">Stripe</option>
                <option value="PAYSTACK">Paystack</option>
              </select>
            </div>
            {recurringProvider === 'PAYSTACK' && (
              <Input placeholder="Donor email (required for Paystack)" value={recurringDonorEmail} onChange={(e) => setRecurringDonorEmail(e.target.value)} />
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecurringOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateRecurring}
              disabled={!churchId || !recurringAmount || isCreatingRecurring || (recurringProvider === 'PAYSTACK' && !recurringDonorEmail)}
            >
              {isCreatingRecurring ? 'Creating…' : 'Create recurring'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category */}
      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add expense category</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <Input placeholder="Category name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
            <Input placeholder="Description (optional)" value={categoryDescription} onChange={(e) => setCategoryDescription(e.target.value)} />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCategory} disabled={!churchId || !categoryName || isCreatingCategory}>
              {isCreatingCategory ? 'Creating…' : 'Create category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Expense */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add expense</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Amount" type="number" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} />
              <Input placeholder="Currency" value={expenseCurrency} onChange={(e) => setExpenseCurrency(e.target.value.toUpperCase())} />
            </div>
            <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={expenseCategoryId} onChange={(e) => setExpenseCategoryId(e.target.value)}>
              <option value="">Uncategorized</option>
              {categories?.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
            <Input placeholder="Description (optional)" value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateExpense} disabled={!churchId || !expenseAmount || isCreatingExpense}>
              {isCreatingExpense ? 'Creating…' : 'Create expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Budget */}
      <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New budget</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <Input placeholder="Budget name" value={budgetName} onChange={(e) => setBudgetName(e.target.value)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Start date" type="date" value={budgetStart} onChange={(e) => setBudgetStart(e.target.value)} />
              <Input placeholder="End date" type="date" value={budgetEnd} onChange={(e) => setBudgetEnd(e.target.value)} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateBudget} disabled={!churchId || !budgetName || !budgetStart || !budgetEnd || isCreatingBudget}>
              {isCreatingBudget ? 'Creating…' : 'Create budget'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Budget Item */}
      <Dialog open={budgetItemOpen} onOpenChange={setBudgetItemOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add budget item</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={selectedBudgetId} onChange={(e) => setSelectedBudgetId(e.target.value)}>
              <option value="">Select budget</option>
              {budgets?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <Input placeholder="Item name" value={budgetItemName} onChange={(e) => setBudgetItemName(e.target.value)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Allocated amount" type="number" value={budgetItemAmount} onChange={(e) => setBudgetItemAmount(e.target.value)} />
              <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={budgetItemCategoryId} onChange={(e) => setBudgetItemCategoryId(e.target.value)}>
                <option value="">No category</option>
                {categories?.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetItemOpen(false)}>Cancel</Button>
            <Button onClick={handleAddBudgetItem} disabled={!selectedBudgetId || !budgetItemName || !budgetItemAmount || isAddingBudgetItem}>
              {isAddingBudgetItem ? 'Adding…' : 'Add item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
