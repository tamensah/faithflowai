'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type BillingProvider = 'STRIPE' | 'PAYSTACK' | 'MANUAL';
type BillingInterval = 'MONTHLY' | 'YEARLY' | 'ONE_TIME';
type EntitlementSource = 'MANUAL' | 'BILLING';

type AddonCatalogItem = {
	code: string;
	name: string;
	description: string;
	active: boolean;
	modules: string[];
	billing: {
		provider: BillingProvider;
		currency: string;
		amountCents: number;
		interval: BillingInterval;
		externalPriceId: string | null;
	};
};

type AddonEntitlement = {
	code: string;
	enabled: boolean;
	source: EntitlementSource;
	billingReference: string | null;
	updatedAt: string;
};

type AddonState = {
	tenantId: string;
	tenantName: string;
	plan: string;
	catalog: AddonCatalogItem[];
	entitlements: Record<string, AddonEntitlement>;
};

function toCurrency(amountCents: number, currency: string): string {
	const amount = amountCents / 100;
	try {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
	} catch {
		return `${amount.toFixed(2)} ${currency}`;
	}
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
	if (!response.ok) throw new Error(payload?.error ?? 'Request failed');
	return payload as T;
}

export function AddonsConsole() {
	const [state, setState] = useState<AddonState | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [selectedCode, setSelectedCode] = useState('');

	const [catalogForm, setCatalogForm] = useState({
		code: '',
		name: '',
		description: '',
		active: true,
		modules: '',
		provider: 'STRIPE' as BillingProvider,
		currency: 'USD',
		amountCents: '4900',
		interval: 'MONTHLY' as BillingInterval,
		externalPriceId: '',
	});
	const [entitlementForm, setEntitlementForm] = useState({
		enabled: false,
		source: 'MANUAL' as EntitlementSource,
		billingReference: '',
	});

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const payload = await requestJson<{ state: AddonState }>('/api/addons');
			setState(payload.state);
			if (!selectedCode && payload.state.catalog.length > 0) {
				setSelectedCode(payload.state.catalog[0].code);
			}
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Failed to load add-ons');
		} finally {
			setLoading(false);
		}
	}, [selectedCode]);

	useEffect(() => {
		void load();
	}, [load]);

	const selectedCatalog = useMemo(
		() => state?.catalog.find((item) => item.code === selectedCode) ?? null,
		[state?.catalog, selectedCode]
	);

	useEffect(() => {
		if (!selectedCatalog) return;
		const entitlement = state?.entitlements[selectedCatalog.code];
		setEntitlementForm({
			enabled: entitlement?.enabled ?? false,
			source: entitlement?.source ?? 'MANUAL',
			billingReference: entitlement?.billingReference ?? '',
		});
	}, [selectedCatalog, state?.entitlements]);

	function clearFeedback() {
		setError(null);
		setSuccess(null);
	}

	async function handleCatalogSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		clearFeedback();
		if (!catalogForm.code.trim() || !catalogForm.name.trim()) {
			setError('Code and name are required.');
			return;
		}

		try {
			const payload = await requestJson<{ state: AddonState }>('/api/addons', {
				method: 'POST',
				body: JSON.stringify({
					action: 'upsertCatalogItem',
					item: {
						code: catalogForm.code,
						name: catalogForm.name,
						description: catalogForm.description,
						active: catalogForm.active,
						modules: catalogForm.modules
							.split(',')
							.map((item) => item.trim())
							.filter(Boolean),
						billing: {
							provider: catalogForm.provider,
							currency: catalogForm.currency,
							amountCents: Number(catalogForm.amountCents),
							interval: catalogForm.interval,
							externalPriceId: catalogForm.externalPriceId || null,
						},
					},
				}),
			});
			setState(payload.state);
			setSelectedCode(catalogForm.code.toUpperCase());
			setSuccess('Add-on catalog item saved.');
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Failed to save catalog item');
		}
	}

	async function handleEntitlementSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		clearFeedback();
		if (!selectedCatalog) {
			setError('Select a catalog item first.');
			return;
		}

		try {
			const payload = await requestJson<{ state: AddonState }>('/api/addons', {
				method: 'PATCH',
				body: JSON.stringify({
					action: 'setEntitlement',
					code: selectedCatalog.code,
					enabled: entitlementForm.enabled,
					source: entitlementForm.source,
					billingReference: entitlementForm.billingReference || null,
				}),
			});
			setState(payload.state);
			setSuccess(`Entitlement ${entitlementForm.enabled ? 'enabled' : 'disabled'} for ${selectedCatalog.code}.`);
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Failed to set entitlement');
		}
	}

	return (
		<div className="space-y-6">
			<div className="rounded-xl border border-slate-200 bg-white p-5">
				<h2 className="text-lg font-semibold text-slate-900">Tenant add-on controls</h2>
				<p className="mt-1 text-sm text-slate-600">
					Manage add-on catalog, bind tenant entitlements, and connect billing references.
				</p>
				{state ? (
					<p className="mt-2 text-sm text-slate-700">
						Tenant: <span className="font-medium">{state.tenantName}</span> | Plan:{' '}
						<span className="font-medium">{state.plan}</span>
					</p>
				) : null}
				{error ? (
					<div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
						{error}
					</div>
				) : null}
				{success ? (
					<div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
						{success}
					</div>
				) : null}
			</div>

			<div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
				<form onSubmit={handleCatalogSubmit} className="rounded-xl border border-slate-200 bg-white p-5">
					<h3 className="text-base font-semibold text-slate-900">Create or update add-on catalog item</h3>
					<div className="mt-4 grid gap-3 sm:grid-cols-2">
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Code *</span>
							<input
								value={catalogForm.code}
								onChange={(event) => setCatalogForm((current) => ({ ...current, code: event.target.value }))}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
								placeholder="STREAMING_SUITE"
							/>
						</label>
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Name *</span>
							<input
								value={catalogForm.name}
								onChange={(event) => setCatalogForm((current) => ({ ...current, name: event.target.value }))}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
								placeholder="Streaming Suite"
							/>
						</label>
						<label className="space-y-1 text-sm sm:col-span-2">
							<span className="text-slate-700">Description</span>
							<input
								value={catalogForm.description}
								onChange={(event) =>
									setCatalogForm((current) => ({ ...current, description: event.target.value }))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							/>
						</label>
						<label className="space-y-1 text-sm sm:col-span-2">
							<span className="text-slate-700">Modules (comma-separated)</span>
							<input
								value={catalogForm.modules}
								onChange={(event) =>
									setCatalogForm((current) => ({ ...current, modules: event.target.value }))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
								placeholder="streaming,bible-school,facilities"
							/>
						</label>
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Billing provider</span>
							<select
								value={catalogForm.provider}
								onChange={(event) =>
									setCatalogForm((current) => ({
										...current,
										provider: event.target.value as BillingProvider,
									}))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							>
								<option value="STRIPE">STRIPE</option>
								<option value="PAYSTACK">PAYSTACK</option>
								<option value="MANUAL">MANUAL</option>
							</select>
						</label>
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Interval</span>
							<select
								value={catalogForm.interval}
								onChange={(event) =>
									setCatalogForm((current) => ({
										...current,
										interval: event.target.value as BillingInterval,
									}))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							>
								<option value="MONTHLY">MONTHLY</option>
								<option value="YEARLY">YEARLY</option>
								<option value="ONE_TIME">ONE_TIME</option>
							</select>
						</label>
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Currency</span>
							<input
								value={catalogForm.currency}
								onChange={(event) =>
									setCatalogForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
								maxLength={3}
							/>
						</label>
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Amount (cents)</span>
							<input
								value={catalogForm.amountCents}
								onChange={(event) =>
									setCatalogForm((current) => ({ ...current, amountCents: event.target.value }))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							/>
						</label>
						<label className="space-y-1 text-sm sm:col-span-2">
							<span className="text-slate-700">External price ID</span>
							<input
								value={catalogForm.externalPriceId}
								onChange={(event) =>
									setCatalogForm((current) => ({ ...current, externalPriceId: event.target.value }))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
								placeholder="price_xxx"
							/>
						</label>
						<label className="inline-flex items-center gap-2 text-sm text-slate-700">
							<input
								type="checkbox"
								checked={catalogForm.active}
								onChange={(event) => setCatalogForm((current) => ({ ...current, active: event.target.checked }))}
							/>
							Active
						</label>
					</div>
					<button
						type="submit"
						disabled={loading}
						className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
					>
						Save catalog item
					</button>
				</form>

				<form onSubmit={handleEntitlementSubmit} className="rounded-xl border border-slate-200 bg-white p-5">
					<h3 className="text-base font-semibold text-slate-900">Tenant entitlement binding</h3>
					<div className="mt-4 grid gap-3">
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Catalog item</span>
							<select
								value={selectedCode}
								onChange={(event) => setSelectedCode(event.target.value)}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							>
								<option value="">Select add-on</option>
								{state?.catalog.map((item) => (
									<option key={item.code} value={item.code}>
										{item.code} - {item.name}
									</option>
								))}
							</select>
						</label>
						{selectedCatalog ? (
							<div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
								<p>
									Price: {toCurrency(selectedCatalog.billing.amountCents, selectedCatalog.billing.currency)} /{' '}
									{selectedCatalog.billing.interval}
								</p>
								<p>Provider: {selectedCatalog.billing.provider}</p>
								<p>Modules: {selectedCatalog.modules.join(', ') || 'none'}</p>
							</div>
						) : null}
						<label className="inline-flex items-center gap-2 text-sm text-slate-700">
							<input
								type="checkbox"
								checked={entitlementForm.enabled}
								onChange={(event) =>
									setEntitlementForm((current) => ({ ...current, enabled: event.target.checked }))
								}
							/>
							Enabled for tenant
						</label>
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Source</span>
							<select
								value={entitlementForm.source}
								onChange={(event) =>
									setEntitlementForm((current) => ({
										...current,
										source: event.target.value as EntitlementSource,
									}))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							>
								<option value="MANUAL">MANUAL</option>
								<option value="BILLING">BILLING</option>
							</select>
						</label>
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Billing reference</span>
							<input
								value={entitlementForm.billingReference}
								onChange={(event) =>
									setEntitlementForm((current) => ({ ...current, billingReference: event.target.value }))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
								placeholder="sub_xxx / paystack_plan_xxx"
							/>
						</label>
					</div>
					<button
						type="submit"
						disabled={loading || !selectedCatalog}
						className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
					>
						Save entitlement
					</button>
				</form>
			</div>

			<div className="rounded-xl border border-slate-200 bg-white p-5">
				<div className="flex items-center justify-between">
					<h3 className="text-base font-semibold text-slate-900">Catalog snapshot</h3>
					<button
						type="button"
						onClick={() => void load()}
						className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
					>
						Refresh
					</button>
				</div>
				<div className="mt-4 overflow-x-auto">
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
							<tr>
								<th className="px-3 py-2">Code</th>
								<th className="px-3 py-2">Name</th>
								<th className="px-3 py-2">Billing</th>
								<th className="px-3 py-2">Entitlement</th>
								<th className="px-3 py-2">Modules</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-200">
							{state?.catalog.length ? (
								state.catalog.map((item) => {
									const entitlement = state.entitlements[item.code];
									return (
										<tr key={item.code}>
											<td className="px-3 py-2 font-medium text-slate-900">{item.code}</td>
											<td className="px-3 py-2 text-slate-700">
												{item.name}
												<div className="text-xs text-slate-500">{item.description || '—'}</div>
											</td>
											<td className="px-3 py-2 text-slate-700">
												{toCurrency(item.billing.amountCents, item.billing.currency)} / {item.billing.interval}
												<div className="text-xs text-slate-500">{item.billing.provider}</div>
											</td>
											<td className="px-3 py-2">
												<span
													className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
														entitlement?.enabled
															? 'bg-emerald-100 text-emerald-700'
															: 'bg-amber-100 text-amber-700'
													}`}
												>
													{entitlement?.enabled ? 'Enabled' : 'Locked'}
												</span>
											</td>
											<td className="px-3 py-2 text-slate-700">{item.modules.join(', ') || '—'}</td>
										</tr>
									);
								})
							) : (
								<tr>
									<td colSpan={5} className="px-3 py-8 text-center text-slate-500">
										No add-ons configured yet.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
