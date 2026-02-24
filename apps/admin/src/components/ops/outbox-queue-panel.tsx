'use client';

import { useEffect, useMemo, useState } from 'react';

type OutboxDomain = 'PAYMENT' | 'COMMS';
type OutboxStatus = 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED';

type OutboxSummary = {
	pendingCount: number;
	processingCount: number;
	processedCount: number;
	failedCount: number;
	deadLetterCount: number;
};

type OutboxItem = {
	id: string;
	eventType: string;
	aggregateType: string;
	aggregateId: string | null;
	status: OutboxStatus;
	attempts: number;
	availableAt: string;
	createdAt: string;
	lastError: string | null;
};

type OutboxResponse = {
	items: OutboxItem[];
	nextCursor?: string;
	summary: OutboxSummary;
};

const statusFilters: Array<OutboxStatus | ''> = ['', 'PENDING', 'PROCESSING', 'PROCESSED', 'FAILED'];
const deadLetterPrefix = 'DEAD_LETTER:';

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

function statusBadgeClass(status: OutboxStatus): string {
	switch (status) {
		case 'PROCESSED':
			return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		case 'PROCESSING':
			return 'border-amber-200 bg-amber-50 text-amber-700';
		case 'FAILED':
			return 'border-rose-200 bg-rose-50 text-rose-700';
		default:
			return 'border-slate-200 bg-slate-50 text-slate-700';
	}
}

type OutboxQueuePanelProps = {
	domain: OutboxDomain;
	title: string;
	description: string;
};

export function OutboxQueuePanel({ domain, title, description }: OutboxQueuePanelProps) {
	const [items, setItems] = useState<OutboxItem[]>([]);
	const [summary, setSummary] = useState<OutboxSummary>({
		pendingCount: 0,
		processingCount: 0,
		processedCount: 0,
		failedCount: 0,
		deadLetterCount: 0,
	});
	const [nextCursor, setNextCursor] = useState<string | undefined>();
	const [loading, setLoading] = useState(false);
	const [query, setQuery] = useState('');
	const [status, setStatus] = useState<OutboxStatus | ''>('');
	const [deadLetterOnly, setDeadLetterOnly] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [processing, setProcessing] = useState(false);

	useEffect(() => {
		void loadData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [domain, status, deadLetterOnly]);

	const hasFilters = useMemo(
		() => Boolean(status || deadLetterOnly || query.trim()),
		[deadLetterOnly, query, status]
	);

	async function loadData(cursor?: string, append = false) {
		setLoading(true);
		if (!append) {
			setError(null);
			setSuccess(null);
		}
		try {
			const params = new URLSearchParams({ domain });
			if (status) params.set('status', status);
			if (deadLetterOnly) params.set('deadLetterOnly', 'true');
			if (query.trim()) params.set('query', query.trim());
			if (cursor) params.set('cursor', cursor);
			const payload = await requestJson<OutboxResponse>(`/api/outbox?${params.toString()}`);

			setSummary(payload.summary);
			setNextCursor(payload.nextCursor);
			setItems((current) => (append ? [...current, ...payload.items] : payload.items));
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Failed to load outbox events');
		} finally {
			setLoading(false);
		}
	}

	async function handleAction(item: OutboxItem, action: 'retry' | 'deadLetter') {
		setError(null);
		setSuccess(null);
		try {
			const reason =
				action === 'deadLetter'
					? window.prompt('Dead-letter reason', 'Awaiting provider configuration')
					: undefined;
			if (action === 'deadLetter' && !reason) {
				return;
			}

			await requestJson('/api/outbox', {
				method: 'PATCH',
				body: JSON.stringify({
					domain,
					action,
					eventId: item.id,
					reason,
					idempotencyKey: createIdempotencyKey(`outbox-${action.toLowerCase()}`),
				}),
			});
			setSuccess(action === 'retry' ? 'Event moved back to pending queue.' : 'Event moved to dead letter.');
			await loadData();
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Failed to update outbox event');
		}
	}

	async function handleProcessNow() {
		setError(null);
		setSuccess(null);
		setProcessing(true);
		try {
			const payload = await requestJson<{
				result: { claimed: number; processed: number; failed: number; deadLettered: number };
			}>('/api/outbox', {
				method: 'POST',
				body: JSON.stringify({ domain, maxEvents: 25 }),
			});
			setSuccess(
				`Processed ${payload.result.processed}/${payload.result.claimed}. Failed: ${payload.result.failed}, dead-lettered: ${payload.result.deadLettered}.`
			);
			await loadData();
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Failed to process queue');
		} finally {
			setProcessing(false);
		}
	}

	return (
		<div className="rounded-xl border border-slate-200 bg-white p-5">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h3 className="text-base font-semibold text-slate-900">{title}</h3>
					<p className="mt-1 text-sm text-slate-600">{description}</p>
				</div>
				<div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-5">
					<div className="rounded-md border border-slate-200 px-2 py-1 text-slate-600">
						Pending <span className="font-semibold text-slate-900">{summary.pendingCount}</span>
					</div>
					<div className="rounded-md border border-slate-200 px-2 py-1 text-slate-600">
						Processing <span className="font-semibold text-slate-900">{summary.processingCount}</span>
					</div>
					<div className="rounded-md border border-slate-200 px-2 py-1 text-slate-600">
						Processed <span className="font-semibold text-slate-900">{summary.processedCount}</span>
					</div>
					<div className="rounded-md border border-slate-200 px-2 py-1 text-slate-600">
						Failed <span className="font-semibold text-slate-900">{summary.failedCount}</span>
					</div>
					<div className="rounded-md border border-slate-200 px-2 py-1 text-slate-600">
						Dead letter <span className="font-semibold text-slate-900">{summary.deadLetterCount}</span>
					</div>
				</div>
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

			<div className="mt-4 flex flex-wrap items-end gap-3">
				<label className="space-y-1 text-sm">
					<span className="text-slate-700">Search</span>
					<input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === 'Enter') {
								event.preventDefault();
								void loadData();
							}
						}}
						className="rounded-md border border-slate-300 px-3 py-2 text-sm"
						placeholder="event type, aggregate id, error..."
					/>
				</label>
				<label className="space-y-1 text-sm">
					<span className="text-slate-700">Status</span>
					<select
						value={status}
						onChange={(event) => setStatus(event.target.value as OutboxStatus | '')}
						className="rounded-md border border-slate-300 px-3 py-2 text-sm"
					>
						<option value="">All statuses</option>
						{statusFilters
							.filter((entry): entry is OutboxStatus => Boolean(entry))
							.map((entry) => (
								<option key={entry} value={entry}>
									{entry}
								</option>
							))}
					</select>
				</label>
				<label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
					<input
						type="checkbox"
						checked={deadLetterOnly}
						onChange={(event) => setDeadLetterOnly(event.target.checked)}
					/>
					Dead-letter only
				</label>
				<button
					type="button"
					onClick={() => void loadData()}
					className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
				>
					Apply filters
				</button>
				<button
					type="button"
					onClick={() => void handleProcessNow()}
					className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
					disabled={processing}
				>
					{processing ? 'Processing...' : 'Process now'}
				</button>
				{hasFilters ? (
					<button
						type="button"
						onClick={() => {
							setQuery('');
							setStatus('');
							setDeadLetterOnly(false);
							void loadData();
						}}
						className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
					>
						Reset
					</button>
				) : null}
			</div>

			<div className="mt-4 overflow-x-auto">
				<table className="min-w-full divide-y divide-slate-200 text-sm">
					<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
						<tr>
							<th className="px-3 py-2">Event</th>
							<th className="px-3 py-2">Status</th>
							<th className="px-3 py-2">Attempts</th>
							<th className="px-3 py-2">Available</th>
							<th className="px-3 py-2">Error</th>
							<th className="px-3 py-2 text-right">Actions</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-200 bg-white text-slate-700">
						{items.length ? (
							items.map((item) => {
								const isDeadLettered = item.lastError?.startsWith(deadLetterPrefix) ?? false;
								return (
									<tr key={item.id}>
										<td className="px-3 py-2">
											<div className="font-medium text-slate-900">{item.eventType}</div>
											<div className="text-xs text-slate-500">
												{item.aggregateType}
												{item.aggregateId ? ` | ${item.aggregateId}` : ''}
											</div>
										</td>
										<td className="px-3 py-2">
											<span
												className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
													item.status
												)}`}
											>
												{isDeadLettered ? 'DEAD_LETTER' : item.status}
											</span>
										</td>
										<td className="px-3 py-2">{item.attempts}</td>
										<td className="px-3 py-2 text-xs text-slate-600">
											<div>{new Date(item.availableAt).toLocaleString()}</div>
											<div>{new Date(item.createdAt).toLocaleDateString()}</div>
										</td>
										<td className="max-w-xs px-3 py-2 text-xs text-slate-600">
											{item.lastError ? item.lastError : '—'}
										</td>
										<td className="px-3 py-2">
											<div className="flex justify-end gap-2">
												<button
													type="button"
													onClick={() => void handleAction(item, 'retry')}
													disabled={item.status === 'PROCESSED'}
													className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
												>
													Retry
												</button>
												<button
													type="button"
													onClick={() => void handleAction(item, 'deadLetter')}
													disabled={isDeadLettered}
													className="rounded-md border border-rose-300 px-2.5 py-1 text-xs font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
												>
													Dead-letter
												</button>
											</div>
										</td>
									</tr>
								);
							})
						) : (
							<tr>
								<td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
									{loading ? 'Loading outbox events...' : 'No events match the current filters.'}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			{nextCursor ? (
				<div className="mt-4">
					<button
						type="button"
						onClick={() => void loadData(nextCursor, true)}
						className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
						disabled={loading}
					>
						{loading ? 'Loading...' : 'Load more'}
					</button>
				</div>
			) : null}
		</div>
	);
}
