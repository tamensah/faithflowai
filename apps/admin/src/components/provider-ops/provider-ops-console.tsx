'use client';

import { useEffect, useState } from 'react';

type Domain = 'PAYMENT' | 'COMMS';
type Provider = 'STRIPE' | 'PAYSTACK' | 'RESEND' | 'TWILIO';
type BillingProvider = 'STRIPE' | 'PAYSTACK';
type OutcomeStatus = 'PROCESSED' | 'FAILED';

type QueueSummary = {
	pendingCount: number;
	processingCount: number;
	processedCount: number;
	failedCount: number;
	deadLetterCount: number;
};

type WebhookHealth = {
	provider: Provider;
	configured: boolean;
	endpoint: string;
	lastSeenAt: string | null;
	recentEvents: number;
};

type DeliveryOutcome = {
	id: string;
	domain: Domain;
	eventType: string;
	status: OutcomeStatus;
	attempts: number;
	availableAt: string;
	updatedAt: string;
	lastError: string | null;
	provider: Provider | null;
	mode: 'LIVE' | 'SIMULATED' | 'INTERNAL' | null;
	providerMessageId: string | null;
	deliveryState: string | null;
	aggregateType: string;
	aggregateId: string | null;
};

type ProviderOpsResponse = {
	queues: Record<Domain, QueueSummary>;
	webhookHealth: WebhookHealth[];
	recentOutcomes: DeliveryOutcome[];
	addonSyncEvents: Array<{
		id: string;
		createdAt: string;
		actorId: string;
		result: 'SUCCESS' | 'FAILED' | 'DENIED';
		addonCode: string;
		enabled: boolean | null;
		paymentStatus: string | null;
		provider: BillingProvider | null;
		providerReference: string | null;
		providerEventId: string | null;
		eventType: string | null;
		paymentId: string | null;
	}>;
};

const RUNBOOK_BASE_URL = 'https://github.com/tamensah/faithflowai/blob/main/docs/OPERATIONS_RUNBOOK.md';

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

function queueStatusClass(value: number): string {
	return value > 0 ? 'text-amber-600' : 'text-emerald-600';
}

function outcomeBadgeClass(status: OutcomeStatus): string {
	return status === 'PROCESSED'
		? 'border-emerald-200 bg-emerald-50 text-emerald-700'
		: 'border-rose-200 bg-rose-50 text-rose-700';
}

function resolveRunbookLink(outcome: DeliveryOutcome): { href: string; label: string } {
	if (outcome.domain === 'PAYMENT') {
		return {
			href: `${RUNBOOK_BASE_URL}#2-reconciliation-drift-payments`,
			label: 'Reconciliation playbook',
		};
	}
	if (outcome.domain === 'COMMS') {
		return {
			href: `${RUNBOOK_BASE_URL}#3-comms-delivery-issues`,
			label: 'Comms recovery playbook',
		};
	}
	return {
		href: `${RUNBOOK_BASE_URL}#1-webhook-delivery-failures`,
		label: 'Webhook triage playbook',
	};
}

export function ProviderOpsConsole() {
	const [data, setData] = useState<ProviderOpsResponse | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [runningDomain, setRunningDomain] = useState<Domain | null>(null);
	const [replayingEventId, setReplayingEventId] = useState<string | null>(null);

	useEffect(() => {
		void loadData();
	}, []);

	async function loadData() {
		setLoading(true);
		setError(null);
		try {
			const payload = await requestJson<ProviderOpsResponse>('/api/provider-ops');
			setData(payload);
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Failed to load provider ops');
		} finally {
			setLoading(false);
		}
	}

	async function processDomain(domain: Domain) {
		setError(null);
		setSuccess(null);
		setRunningDomain(domain);
		try {
			const payload = await requestJson<{
				result: { claimed: number; processed: number; failed: number; deadLettered: number };
			}>('/api/provider-ops', {
				method: 'POST',
				body: JSON.stringify({
					action: 'processDomain',
					domain,
					maxEvents: 25,
				}),
			});

			setSuccess(
				`${domain} queue run: claimed ${payload.result.claimed}, processed ${payload.result.processed}, failed ${payload.result.failed}, dead-lettered ${payload.result.deadLettered}.`
			);
			await loadData();
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Queue processing failed');
		} finally {
			setRunningDomain(null);
		}
	}

	async function replayOutcome(outcome: DeliveryOutcome) {
		setError(null);
		setSuccess(null);
		setReplayingEventId(outcome.id);
		try {
			const payload = await requestJson<{
				replay: { eventId: string };
				process?: { claimed: number; processed: number; failed: number; deadLettered: number };
			}>('/api/provider-ops', {
				method: 'POST',
				body: JSON.stringify({
					action: 'replayEvent',
					domain: outcome.domain,
					eventId: outcome.id,
					processNow: true,
					maxEvents: 10,
					idempotencyKey: createIdempotencyKey('provider-ops-replay'),
				}),
			});

			const processSummary = payload.process
				? ` Processed ${payload.process.processed}/${payload.process.claimed}.`
				: '';
			setSuccess(`Replay queued for ${outcome.eventType}.${processSummary}`);
			await loadData();
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Replay action failed');
		} finally {
			setReplayingEventId(null);
		}
	}

	const queues = data?.queues ?? {
		PAYMENT: {
			pendingCount: 0,
			processingCount: 0,
			processedCount: 0,
			failedCount: 0,
			deadLetterCount: 0,
		},
		COMMS: {
			pendingCount: 0,
			processingCount: 0,
			processedCount: 0,
			failedCount: 0,
			deadLetterCount: 0,
		},
	};

	return (
		<div className="space-y-6">
			<div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-900 to-blue-700 p-6 text-white">
				<p className="text-xs uppercase tracking-[0.2em] text-blue-200">Provider ops</p>
				<h2 className="mt-2 text-2xl font-semibold">Webhook health and delivery reliability</h2>
				<p className="mt-2 text-sm text-blue-100">
					Monitor provider readiness, inspect latest outcomes, and replay failed operations from one view.
				</p>
			</div>

			{error ? (
				<div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
					{error}
				</div>
			) : null}
			{success ? (
				<div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
					{success}
				</div>
			) : null}

			<div className="grid gap-4 xl:grid-cols-2">
				{(['PAYMENT', 'COMMS'] as const).map((domain) => (
					<div key={domain} className="rounded-xl border border-slate-200 bg-white p-5">
						<div className="flex items-center justify-between">
							<h3 className="text-base font-semibold text-slate-900">{domain} queue</h3>
							<button
								type="button"
								onClick={() => void processDomain(domain)}
								disabled={runningDomain === domain}
								className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50"
							>
								{runningDomain === domain ? 'Processing...' : 'Process now'}
							</button>
						</div>
						<div className="mt-3 grid grid-cols-2 gap-3 text-sm">
							<div className="rounded-md border border-slate-200 px-3 py-2 text-slate-600">
								Pending: <span className={queueStatusClass(queues[domain].pendingCount)}>{queues[domain].pendingCount}</span>
							</div>
							<div className="rounded-md border border-slate-200 px-3 py-2 text-slate-600">
								Processing:{' '}
								<span className={queueStatusClass(queues[domain].processingCount)}>{queues[domain].processingCount}</span>
							</div>
							<div className="rounded-md border border-slate-200 px-3 py-2 text-slate-600">
								Failed: <span className={queueStatusClass(queues[domain].failedCount)}>{queues[domain].failedCount}</span>
							</div>
							<div className="rounded-md border border-slate-200 px-3 py-2 text-slate-600">
								Dead-letter:{' '}
								<span className={queueStatusClass(queues[domain].deadLetterCount)}>{queues[domain].deadLetterCount}</span>
							</div>
						</div>
					</div>
				))}
			</div>

			<div className="rounded-xl border border-slate-200 bg-white p-5">
				<div className="flex items-center justify-between">
					<h3 className="text-base font-semibold text-slate-900">Webhook health</h3>
					<button
						type="button"
						onClick={() => void loadData()}
						className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
					>
						Refresh
					</button>
				</div>
				<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					{data?.webhookHealth.map((entry) => (
						<div key={entry.provider} className="rounded-lg border border-slate-200 p-3">
							<div className="flex items-center justify-between">
								<p className="text-sm font-semibold text-slate-900">{entry.provider}</p>
								<span
									className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
										entry.configured
											? 'bg-emerald-100 text-emerald-700'
											: 'bg-amber-100 text-amber-700'
									}`}
								>
									{entry.configured ? 'Configured' : 'Missing config'}
								</span>
							</div>
							<p className="mt-2 text-xs text-slate-500">{entry.endpoint}</p>
							<p className="mt-2 text-xs text-slate-600">
								Last event:{' '}
								{entry.lastSeenAt ? new Date(entry.lastSeenAt).toLocaleString() : 'No events yet'}
							</p>
							<p className="mt-1 text-xs text-slate-600">Recent events: {entry.recentEvents}</p>
						</div>
					)) ?? null}
				</div>
			</div>

			<div className="rounded-xl border border-slate-200 bg-white p-5">
				<div className="flex items-center justify-between">
					<h3 className="text-base font-semibold text-slate-900">Last delivery outcomes</h3>
					<p className="text-xs uppercase tracking-[0.14em] text-slate-500">
						Recent processed and failed events
					</p>
				</div>

				<div className="mt-4 overflow-x-auto">
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
							<tr>
								<th className="px-3 py-2">Event</th>
								<th className="px-3 py-2">Provider</th>
								<th className="px-3 py-2">Status</th>
								<th className="px-3 py-2">Delivery</th>
								<th className="px-3 py-2">Updated</th>
								<th className="px-3 py-2">Error</th>
								<th className="px-3 py-2 text-right">Replay</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-200">
							{data?.recentOutcomes.length ? (
								data.recentOutcomes.map((outcome) => (
									<tr key={outcome.id}>
										<td className="px-3 py-2">
											<p className="font-medium text-slate-900">{outcome.eventType}</p>
											<p className="text-xs text-slate-500">
												{outcome.domain} | {outcome.aggregateType}
											</p>
										</td>
										<td className="px-3 py-2">
											<div className="text-slate-800">{outcome.provider ?? 'N/A'}</div>
											<div className="text-xs text-slate-500">{outcome.mode ?? 'N/A'}</div>
										</td>
										<td className="px-3 py-2">
											<span
												className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${outcomeBadgeClass(
													outcome.status
												)}`}
											>
												{outcome.status}
											</span>
										</td>
										<td className="px-3 py-2 text-xs text-slate-600">
											{outcome.deliveryState ?? '—'} | attempts {outcome.attempts}
										</td>
										<td className="px-3 py-2 text-xs text-slate-600">
											{new Date(outcome.updatedAt).toLocaleString()}
										</td>
										<td className="max-w-xs px-3 py-2 text-xs text-slate-600">
											{outcome.lastError || '—'}
										</td>
										<td className="px-3 py-2 text-right">
											{outcome.status === 'FAILED' ? (
												<div className="flex items-center justify-end gap-2">
													<button
														type="button"
														onClick={() => void replayOutcome(outcome)}
														disabled={replayingEventId === outcome.id}
														className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 disabled:opacity-50"
													>
														{replayingEventId === outcome.id ? 'Replaying...' : 'Replay'}
													</button>
													<a
														href={resolveRunbookLink(outcome).href}
														target="_blank"
														rel="noreferrer"
														className="text-xs font-medium text-blue-700 underline-offset-2 hover:underline"
													>
														{resolveRunbookLink(outcome).label}
													</a>
												</div>
											) : (
												<span className="text-xs text-slate-400">—</span>
											)}
										</td>
									</tr>
								))
							) : (
								<tr>
									<td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
										{loading ? 'Loading outcomes...' : 'No provider outcomes yet.'}
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			<div className="rounded-xl border border-slate-200 bg-white p-5">
				<div className="flex items-center justify-between">
					<h3 className="text-base font-semibold text-slate-900">Add-on entitlement syncs</h3>
					<p className="text-xs uppercase tracking-[0.14em] text-slate-500">Billing-driven toggles</p>
				</div>
				<div className="mt-4 overflow-x-auto">
					<table className="min-w-full divide-y divide-slate-200 text-sm">
						<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
							<tr>
								<th className="px-3 py-2">Add-on</th>
								<th className="px-3 py-2">State</th>
								<th className="px-3 py-2">Provider</th>
								<th className="px-3 py-2">Payment</th>
								<th className="px-3 py-2">Event</th>
								<th className="px-3 py-2">Updated</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-200">
							{data?.addonSyncEvents.length ? (
								data.addonSyncEvents.map((sync) => (
									<tr key={sync.id}>
										<td className="px-3 py-2 font-medium text-slate-900">{sync.addonCode}</td>
										<td className="px-3 py-2">
											<span
												className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
													sync.enabled === true
														? 'bg-emerald-100 text-emerald-700'
														: sync.enabled === false
															? 'bg-amber-100 text-amber-700'
															: 'bg-slate-100 text-slate-700'
												}`}
											>
												{sync.enabled === true ? 'Enabled' : sync.enabled === false ? 'Disabled' : 'Unknown'}
											</span>
										</td>
										<td className="px-3 py-2 text-slate-700">
											{sync.provider ?? '—'}
											<div className="text-xs text-slate-500">{sync.paymentStatus ?? '—'}</div>
										</td>
										<td className="px-3 py-2 text-xs text-slate-600">
											{sync.paymentId ?? '—'}
											<div>{sync.providerReference ?? '—'}</div>
										</td>
										<td className="px-3 py-2 text-xs text-slate-600">
											{sync.eventType ?? '—'}
											<div>{sync.providerEventId ?? '—'}</div>
										</td>
										<td className="px-3 py-2 text-xs text-slate-600">
											{new Date(sync.createdAt).toLocaleString()}
										</td>
									</tr>
								))
							) : (
								<tr>
									<td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
										{loading ? 'Loading add-on sync events...' : 'No add-on entitlement syncs yet.'}
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
