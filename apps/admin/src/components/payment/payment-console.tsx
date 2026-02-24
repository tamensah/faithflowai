'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { OutboxQueuePanel } from '@/components/ops/outbox-queue-panel';

type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
type PaymentMethod = 'CARD' | 'BANK_TRANSFER' | 'MOBILE_MONEY';
type PaymentProvider = 'AUTO' | 'STRIPE' | 'PAYSTACK';
type PaymentProviderConfig = {
	stripeConfigured: boolean;
	paystackConfigured: boolean;
};

type PaymentItem = {
	id: string;
	amount: string | number;
	currency: string;
	status: PaymentStatus;
	paymentMethod: PaymentMethod;
	metadata?: Record<string, unknown> | null;
	reference: string;
	description: string | null;
	createdAt: string;
	church: { id: string; name: string; slug: string };
	member: { firstName: string; lastName: string; email: string | null } | null;
};

type PaymentSummary = {
	totalCount: number;
	completedCount: number;
	refundedCount: number;
	failedCount: number;
	completedByCurrency: Array<{ currency: string; amount: number }>;
};

type PaymentBootstrap = {
	items: PaymentItem[];
	nextCursor?: string;
	summary: PaymentSummary;
	churches: Array<{ id: string; name: string; slug: string }>;
};

const paymentStatuses: PaymentStatus[] = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'];
const paymentMethods: PaymentMethod[] = ['CARD', 'BANK_TRANSFER', 'MOBILE_MONEY'];
const paymentProviders: PaymentProvider[] = ['AUTO', 'STRIPE', 'PAYSTACK'];

function createIdempotencyKey(prefix: string): string {
	const random =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	return `${prefix}-${random}`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...(init?.headers ?? {}),
		},
	});

	const payload = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(payload?.error ?? 'Request failed');
	}

	return payload as T;
}

function formatAmount(value: string | number, currency: string): string {
	const amount = typeof value === 'string' ? Number(value) : value;
	if (!Number.isFinite(amount)) return `${value} ${currency}`;
	try {
		return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
	} catch {
		return `${amount} ${currency}`;
	}
}

export function PaymentConsole({ providerConfig }: { providerConfig: PaymentProviderConfig }) {
	const [data, setData] = useState<PaymentBootstrap | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const [filterStatus, setFilterStatus] = useState<PaymentStatus | ''>('');
	const [filterChurchId, setFilterChurchId] = useState('');

	const [createForm, setCreateForm] = useState({
		churchId: '',
		memberId: '',
		amount: '',
		currency: 'USD',
		paymentMethod: 'CARD' as PaymentMethod,
		paymentProvider: 'AUTO' as PaymentProvider,
		providerReference: '',
		reference: '',
		description: '',
		status: 'PENDING' as PaymentStatus,
	});

	const [actionForm, setActionForm] = useState({
		paymentId: '',
		action: 'status' as 'status' | 'refund',
		status: 'COMPLETED' as PaymentStatus,
		reason: '',
	});

	const activeChurchId = filterChurchId || undefined;
	const activeStatus = filterStatus || undefined;

	useEffect(() => {
		void loadData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [filterStatus, filterChurchId]);

	const selectedPayment = useMemo(
		() => data?.items.find((item) => item.id === actionForm.paymentId) ?? null,
		[data?.items, actionForm.paymentId]
	);
	const selectedPaymentProviderRaw =
		selectedPayment?.metadata && typeof selectedPayment.metadata.provider === 'string'
			? selectedPayment.metadata.provider.toUpperCase()
			: 'AUTO';
	const selectedPaymentProvider: PaymentProvider =
		selectedPaymentProviderRaw === 'STRIPE' || selectedPaymentProviderRaw === 'PAYSTACK'
			? (selectedPaymentProviderRaw as PaymentProvider)
			: 'AUTO';

	function providerEnabled(provider: PaymentProvider): boolean {
		if (provider === 'AUTO') return true;
		if (provider === 'STRIPE') return providerConfig.stripeConfigured;
		return providerConfig.paystackConfigured;
	}

	const createProviderLocked = !providerEnabled(createForm.paymentProvider);
	const refundProviderLocked =
		actionForm.action === 'refund' &&
		selectedPaymentProvider !== 'AUTO' &&
		!providerEnabled(selectedPaymentProvider);

	async function loadData() {
		setLoading(true);
		setError(null);
		try {
			const params = new URLSearchParams();
			if (activeStatus) params.set('status', activeStatus);
			if (activeChurchId) params.set('churchId', activeChurchId);
			const query = params.toString();
			const payload = await requestJson<PaymentBootstrap>(`/api/payment${query ? `?${query}` : ''}`);
			setData(payload);

			if (!createForm.churchId && payload.churches.length > 0) {
				setCreateForm((current) => ({ ...current, churchId: payload.churches[0].id }));
			}
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Failed to load payments');
		} finally {
			setLoading(false);
		}
	}

	function clearFeedback() {
		setError(null);
		setSuccess(null);
	}

	async function handleCreate(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		clearFeedback();

		if (!createForm.churchId || !createForm.amount || !createForm.reference) {
			setError('Church, amount, and reference are required.');
			return;
		}

		try {
			await requestJson('/api/payment', {
				method: 'POST',
				body: JSON.stringify({
					idempotencyKey: createIdempotencyKey('payment-create'),
					churchId: createForm.churchId,
					memberId: createForm.memberId || undefined,
					amount: Number(createForm.amount),
					currency: createForm.currency.toUpperCase(),
					paymentMethod: createForm.paymentMethod,
					metadata: {
						provider: createForm.paymentProvider,
						providerReference: createForm.providerReference || undefined,
					},
					reference: createForm.reference,
					description: createForm.description || undefined,
					status: createForm.status,
				}),
			});
			setCreateForm((current) => ({
				...current,
				memberId: '',
				amount: '',
				reference: '',
				providerReference: '',
				description: '',
			}));
			setSuccess('Payment recorded.');
			await loadData();
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Create failed');
		}
	}

	async function handleAction(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		clearFeedback();

		if (!actionForm.paymentId) {
			setError('Select a payment record first.');
			return;
		}

		if (actionForm.action === 'refund' && !actionForm.reason.trim()) {
			setError('Refund reason is required.');
			return;
		}

		try {
			await requestJson('/api/payment', {
				method: 'PATCH',
				body: JSON.stringify({
					idempotencyKey: createIdempotencyKey('payment-action'),
					action: actionForm.action,
					paymentId: actionForm.paymentId,
					status: actionForm.action === 'status' ? actionForm.status : undefined,
					reason: actionForm.action === 'refund' ? actionForm.reason : undefined,
				}),
			});
			setActionForm((current) => ({ ...current, reason: '' }));
			setSuccess(actionForm.action === 'refund' ? 'Payment refunded.' : 'Payment status updated.');
			await loadData();
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Update failed');
		}
	}

	return (
		<div className="space-y-6">
			<div className="rounded-xl border border-slate-200 bg-white p-5">
				<h2 className="text-lg font-semibold text-slate-900">Payment activity</h2>
				<p className="mt-1 text-sm text-slate-600">
					Record giving transactions, update payment states, and trigger refunds.
				</p>
				<div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
					<span className="font-medium">Provider readiness:</span> Stripe{' '}
					{providerConfig.stripeConfigured ? 'configured' : 'locked'} | Paystack{' '}
					{providerConfig.paystackConfigured ? 'configured' : 'locked'}
				</div>

				{error ? (
					<div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
						{error}
					</div>
				) : null}
				{success ? (
					<div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
						{success}
					</div>
				) : null}

				<div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<div className="rounded-lg border border-slate-200 p-3">
						<p className="text-xs uppercase tracking-[0.16em] text-slate-500">Total payments</p>
						<p className="mt-1 text-2xl font-semibold text-slate-900">{data?.summary.totalCount ?? 0}</p>
					</div>
					<div className="rounded-lg border border-slate-200 p-3">
						<p className="text-xs uppercase tracking-[0.16em] text-slate-500">Completed</p>
						<p className="mt-1 text-2xl font-semibold text-slate-900">{data?.summary.completedCount ?? 0}</p>
					</div>
					<div className="rounded-lg border border-slate-200 p-3">
						<p className="text-xs uppercase tracking-[0.16em] text-slate-500">Refunded</p>
						<p className="mt-1 text-2xl font-semibold text-slate-900">{data?.summary.refundedCount ?? 0}</p>
					</div>
					<div className="rounded-lg border border-slate-200 p-3">
						<p className="text-xs uppercase tracking-[0.16em] text-slate-500">Failed</p>
						<p className="mt-1 text-2xl font-semibold text-slate-900">{data?.summary.failedCount ?? 0}</p>
					</div>
				</div>

				{data?.summary.completedByCurrency?.length ? (
					<div className="mt-3 text-sm text-slate-600">
						Completed totals:{' '}
						{data.summary.completedByCurrency
							.map((row) => formatAmount(row.amount, row.currency))
							.join(' | ')}
					</div>
				) : null}
			</div>

			<div className="grid gap-6 xl:grid-cols-2">
				<form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-5">
					<h3 className="text-base font-semibold text-slate-900">Record payment</h3>
					<div className="mt-4 grid gap-3 sm:grid-cols-2">
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Church *</span>
							<select
								value={createForm.churchId}
								onChange={(event) =>
									setCreateForm((current) => ({ ...current, churchId: event.target.value }))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							>
								<option value="">Select church</option>
								{data?.churches.map((church) => (
									<option key={church.id} value={church.id}>
										{church.name}
									</option>
								))}
							</select>
						</label>
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Member ID</span>
							<input
								value={createForm.memberId}
								onChange={(event) =>
									setCreateForm((current) => ({ ...current, memberId: event.target.value }))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
								placeholder="Optional"
							/>
						</label>
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Amount *</span>
							<input
								type="number"
								min="0.01"
								step="0.01"
								value={createForm.amount}
								onChange={(event) =>
									setCreateForm((current) => ({ ...current, amount: event.target.value }))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
								placeholder="0.00"
							/>
						</label>
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Currency</span>
							<input
								value={createForm.currency}
								onChange={(event) =>
									setCreateForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))
								}
								maxLength={3}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							/>
						</label>
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Method *</span>
							<select
								value={createForm.paymentMethod}
								onChange={(event) =>
									setCreateForm((current) => ({
										...current,
										paymentMethod: event.target.value as PaymentMethod,
									}))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							>
								{paymentMethods.map((method) => (
									<option key={method} value={method}>
										{method}
									</option>
								))}
							</select>
						</label>
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Provider</span>
							<select
								value={createForm.paymentProvider}
								onChange={(event) =>
									setCreateForm((current) => ({
										...current,
										paymentProvider: event.target.value as PaymentProvider,
									}))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							>
								{paymentProviders.map((provider) => (
									<option key={provider} value={provider} disabled={!providerEnabled(provider)}>
										{provider}
									</option>
								))}
							</select>
						</label>
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Initial status</span>
							<select
								value={createForm.status}
								onChange={(event) =>
									setCreateForm((current) => ({ ...current, status: event.target.value as PaymentStatus }))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							>
								{paymentStatuses.map((status) => (
									<option key={status} value={status}>
										{status}
									</option>
								))}
							</select>
						</label>
						<label className="space-y-1 text-sm sm:col-span-2">
							<span className="text-slate-700">Reference *</span>
							<input
								value={createForm.reference}
								onChange={(event) =>
									setCreateForm((current) => ({ ...current, reference: event.target.value }))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
								placeholder="TXN-2026-0001"
							/>
						</label>
						<label className="space-y-1 text-sm sm:col-span-2">
							<span className="text-slate-700">Provider reference</span>
							<input
								value={createForm.providerReference}
								onChange={(event) =>
									setCreateForm((current) => ({
										...current,
										providerReference: event.target.value,
									}))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
								placeholder="pi_..., ch_..., or paystack reference"
							/>
						</label>
						<label className="space-y-1 text-sm sm:col-span-2">
							<span className="text-slate-700">Description</span>
							<input
								value={createForm.description}
								onChange={(event) =>
									setCreateForm((current) => ({ ...current, description: event.target.value }))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							/>
						</label>
					</div>
					<button
						type="submit"
						className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
						disabled={loading || createProviderLocked}
					>
						Save payment
					</button>
					{createProviderLocked ? (
						<p className="mt-2 text-xs text-amber-700">
							This provider is locked in the current environment. Configure provider credentials to continue.
						</p>
					) : null}
				</form>

				<form onSubmit={handleAction} className="rounded-xl border border-slate-200 bg-white p-5">
					<h3 className="text-base font-semibold text-slate-900">Update or refund</h3>
					<div className="mt-4 grid gap-3">
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Payment record *</span>
							<select
								value={actionForm.paymentId}
								onChange={(event) =>
									setActionForm((current) => ({ ...current, paymentId: event.target.value }))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							>
								<option value="">Select payment</option>
								{data?.items.map((item) => (
									<option key={item.id} value={item.id}>
										{item.reference} - {formatAmount(item.amount, item.currency)}
									</option>
								))}
							</select>
						</label>
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Action *</span>
							<select
								value={actionForm.action}
								onChange={(event) =>
									setActionForm((current) => ({
										...current,
										action: event.target.value as 'status' | 'refund',
									}))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							>
								<option value="status">Set status</option>
								<option value="refund">Refund payment</option>
							</select>
						</label>
						{actionForm.action === 'status' ? (
							<label className="space-y-1 text-sm">
								<span className="text-slate-700">Status *</span>
								<select
									value={actionForm.status}
									onChange={(event) =>
										setActionForm((current) => ({
											...current,
											status: event.target.value as PaymentStatus,
										}))
									}
									className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
								>
									{paymentStatuses.map((status) => (
										<option key={status} value={status}>
											{status}
										</option>
									))}
								</select>
							</label>
						) : (
							<label className="space-y-1 text-sm">
								<span className="text-slate-700">Refund reason *</span>
								<input
									value={actionForm.reason}
									onChange={(event) =>
										setActionForm((current) => ({ ...current, reason: event.target.value }))
									}
									className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
								/>
							</label>
						)}
					</div>

					{selectedPayment ? (
						<div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
							{selectedPayment.reference} | {selectedPayment.status} |{' '}
							{formatAmount(selectedPayment.amount, selectedPayment.currency)}
						</div>
					) : null}

					<button
						type="submit"
						className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
						disabled={loading || refundProviderLocked}
					>
						Apply action
					</button>
					{refundProviderLocked ? (
						<p className="mt-2 text-xs text-amber-700">
							Refund is locked because the selected provider ({selectedPaymentProvider}) is not configured.
						</p>
					) : null}
				</form>
			</div>

			<div className="rounded-xl border border-slate-200 bg-white p-5">
				<div className="flex flex-wrap items-end gap-3">
					<h3 className="text-base font-semibold text-slate-900">Recent payments</h3>
					<label className="space-y-1 text-sm">
						<span className="text-slate-700">Filter status</span>
						<select
							value={filterStatus}
							onChange={(event) => setFilterStatus(event.target.value as PaymentStatus | '')}
							className="rounded-md border border-slate-300 px-3 py-2 text-sm"
						>
							<option value="">All</option>
							{paymentStatuses.map((status) => (
								<option key={status} value={status}>
									{status}
								</option>
							))}
						</select>
					</label>
					<label className="space-y-1 text-sm">
						<span className="text-slate-700">Filter church</span>
						<select
							value={filterChurchId}
							onChange={(event) => setFilterChurchId(event.target.value)}
							className="rounded-md border border-slate-300 px-3 py-2 text-sm"
						>
							<option value="">All churches</option>
							{data?.churches.map((church) => (
								<option key={church.id} value={church.id}>
									{church.name}
								</option>
							))}
						</select>
					</label>
					<button
						type="button"
						onClick={() => void loadData()}
						className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
					>
						Refresh
					</button>
				</div>

				<div className="mt-4 overflow-x-auto">
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
							<tr>
								<th className="px-3 py-2">Reference</th>
								<th className="px-3 py-2">Amount</th>
								<th className="px-3 py-2">Status</th>
								<th className="px-3 py-2">Method</th>
								<th className="px-3 py-2">Provider</th>
								<th className="px-3 py-2">Church</th>
								<th className="px-3 py-2">Member</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-200 bg-white text-slate-700">
							{data?.items.length ? (
								data.items.map((item) => (
									<tr key={item.id}>
										<td className="px-3 py-2">
											<div className="font-medium text-slate-900">{item.reference}</div>
											<div className="text-xs text-slate-500">
												{new Date(item.createdAt).toLocaleString()}
											</div>
										</td>
										<td className="px-3 py-2">{formatAmount(item.amount, item.currency)}</td>
										<td className="px-3 py-2">{item.status}</td>
										<td className="px-3 py-2">{item.paymentMethod}</td>
										<td className="px-3 py-2">
											{typeof item.metadata?.provider === 'string'
												? item.metadata.provider
												: 'AUTO'}
										</td>
										<td className="px-3 py-2">{item.church.name}</td>
										<td className="px-3 py-2">
											{item.member
												? `${item.member.firstName} ${item.member.lastName}`.trim()
												: '—'}
										</td>
									</tr>
								))
							) : (
								<tr>
									<td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
										{loading ? 'Loading payments...' : 'No payments found for the selected filters.'}
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			<OutboxQueuePanel
				domain="PAYMENT"
				title="Payment delivery queue"
				description="Track payment outbox retries, failures, and dead-letter actions for provider delivery."
			/>
		</div>
	);
}
