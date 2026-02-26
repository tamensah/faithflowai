import Link from 'next/link';
import { headers } from 'next/headers';

type HealthItem = {
	key: string;
	label: string;
	path: string;
	href: string;
};

type HealthResult = {
	item: HealthItem;
	httpStatus: number;
	status: string;
	checkedAt: string | null;
	reasons: string[];
	summary: string;
};

const HEALTH_ITEMS: HealthItem[] = [
	{
		key: 'api-core',
		label: 'API Core',
		path: '/api/health/api-core',
		href: '/dashboard/settings',
	},
	{
		key: 'auth-guardrails',
		label: 'Auth Guardrails',
		path: '/api/health/auth-guardrails',
		href: '/dashboard/settings',
	},
	{
		key: 'provider-ops',
		label: 'Provider Ops',
		path: '/api/health/provider-ops',
		href: '/dashboard/provider-ops',
	},
	{
		key: 'outbox-worker',
		label: 'Outbox Worker',
		path: '/api/health/outbox-worker',
		href: '/dashboard/provider-ops',
	},
	{
		key: 'reconciliation',
		label: 'Reconciliation',
		path: '/api/health/reconciliation',
		href: '/dashboard/payments',
	},
];

function resolveBaseUrl(): string {
	const headerStore = headers();
	const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host');
	const proto = headerStore.get('x-forwarded-proto') ?? (host?.includes('localhost') ? 'http' : 'https');
	if (host) return `${proto}://${host}`;
	return (
		process.env.NEXT_PUBLIC_ADMIN_APP_URL ??
		process.env.NEXT_PUBLIC_ADMIN_URL ??
		process.env.NEXT_PUBLIC_APP_URL ??
		'http://localhost:3001'
	);
}

function readRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
}

function normalizeStatus(value: string): 'ok' | 'degraded' | 'down' | 'unknown' {
	const normalized = value.trim().toLowerCase();
	if (normalized === 'ok' || normalized === 'ready') return 'ok';
	if (normalized === 'degraded') return 'degraded';
	if (normalized === 'down') return 'down';
	return 'unknown';
}

function badgeClass(status: string): string {
	const normalized = normalizeStatus(status);
	if (normalized === 'ok') return 'bg-emerald-100 text-emerald-700';
	if (normalized === 'degraded') return 'bg-amber-100 text-amber-700';
	if (normalized === 'down') return 'bg-rose-100 text-rose-700';
	return 'bg-slate-100 text-slate-700';
}

function toSummary(item: HealthItem, payload: Record<string, unknown>): string {
	if (item.key === 'api-core') {
		const checks = readRecord(payload.checks);
		const database = checks.database === true ? 'db:ok' : 'db:issue';
		const auth = checks.authConfig === true ? 'auth:ok' : 'auth:issue';
		return `${database} | ${auth}`;
	}
	if (item.key === 'auth-guardrails') {
		const metrics = readRecord(payload.metrics);
		const blockedCount =
			typeof metrics.blockedCount === 'number' ? metrics.blockedCount : 0;
		const organizationsAffected =
			typeof metrics.organizationsAffected === 'number' ? metrics.organizationsAffected : 0;
		return `blocked:${blockedCount} | orgs:${organizationsAffected}`;
	}
	if (item.key === 'provider-ops') {
		const queues = readRecord(payload.queues);
		const payment = readRecord(queues.PAYMENT);
		const comms = readRecord(queues.COMMS);
		const paymentPending =
			typeof payment.processableCount === 'number' ? payment.processableCount : 0;
		const commsPending =
			typeof comms.processableCount === 'number' ? comms.processableCount : 0;
		return `processable payment:${paymentPending} | comms:${commsPending}`;
	}
	if (item.key === 'outbox-worker') {
		const domains = Array.isArray(payload.domains)
			? (payload.domains as Array<Record<string, unknown>>)
			: [];
		const failed = domains.filter((domain) => domain.ready !== true).length;
		return failed === 0 ? 'all domains ready' : `${failed} domain(s) not ready`;
	}
	if (item.key === 'reconciliation') {
		const metrics = readRecord(payload.metrics);
		const processableCount =
			typeof metrics.processableCount === 'number' ? metrics.processableCount : 0;
		const deadLetterCount =
			typeof metrics.deadLetterCount === 'number' ? metrics.deadLetterCount : 0;
		return `processable:${processableCount} | dead-letter:${deadLetterCount}`;
	}
	return 'health data available';
}

async function fetchHealthResult(baseUrl: string, item: HealthItem): Promise<HealthResult> {
	const token = process.env.FAITHFLOW_HEALTHCHECK_TOKEN?.trim();
	const response = await fetch(`${baseUrl}${item.path}`, {
		cache: 'no-store',
		headers: token ? { 'x-healthcheck-token': token } : undefined,
	});
	const payload = await response
		.json()
		.catch(() => ({} as Record<string, unknown>));
	const payloadRecord = readRecord(payload);
	const status =
		typeof payloadRecord.status === 'string'
			? payloadRecord.status
			: response.ok
				? 'ok'
				: 'down';
	const reasons = Array.isArray(payloadRecord.reasons)
		? payloadRecord.reasons.filter((value): value is string => typeof value === 'string')
		: [];
	return {
		item,
		httpStatus: response.status,
		status,
		checkedAt: typeof payloadRecord.checkedAt === 'string' ? payloadRecord.checkedAt : null,
		reasons,
		summary: toSummary(item, payloadRecord),
	};
}

export default async function OpsHealthPage() {
	const baseUrl = resolveBaseUrl();
	const results = await Promise.all(
		HEALTH_ITEMS.map(async (item): Promise<HealthResult> => {
			try {
				return await fetchHealthResult(baseUrl, item);
			} catch (error) {
				return {
					item,
					httpStatus: 503,
					status: 'down',
					checkedAt: null,
					reasons: [error instanceof Error ? error.message : 'Unable to fetch health endpoint'],
					summary: 'endpoint unavailable',
				};
			}
		})
	);

	const downCount = results.filter((result) => normalizeStatus(result.status) === 'down').length;
	const degradedCount = results.filter(
		(result) => normalizeStatus(result.status) === 'degraded'
	).length;
	const okCount = results.filter((result) => normalizeStatus(result.status) === 'ok').length;

	return (
		<div className="space-y-6">
			<div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-900 to-blue-700 p-6 text-white">
				<p className="text-xs uppercase tracking-[0.2em] text-blue-200">Operations health</p>
				<h1 className="mt-2 text-3xl font-semibold">Platform readiness and alert state</h1>
				<p className="mt-2 text-sm text-blue-100">
					Aggregated health checks for API core, auth guardrails, provider ops, outbox worker, and
					reconciliation.
				</p>
				<div className="mt-4 flex flex-wrap gap-3">
					<span className="rounded-md border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium">
						OK: {okCount}
					</span>
					<span className="rounded-md border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium">
						Degraded: {degradedCount}
					</span>
					<span className="rounded-md border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium">
						Down: {downCount}
					</span>
					<Link
						href="/dashboard/ops-health"
						className="rounded-md border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium text-white"
					>
						Refresh
					</Link>
				</div>
			</div>

			<div className="grid gap-4 xl:grid-cols-2">
				{results.map((result) => (
					<div key={result.item.key} className="rounded-xl border border-slate-200 bg-white p-5">
						<div className="flex items-center justify-between gap-3">
							<h2 className="text-base font-semibold text-slate-900">{result.item.label}</h2>
							<span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass(result.status)}`}>
								{result.status.toUpperCase()}
							</span>
						</div>
						<p className="mt-2 text-sm text-slate-600">{result.summary}</p>
						<p className="mt-1 text-xs text-slate-500">
							HTTP {result.httpStatus} {result.checkedAt ? `| ${new Date(result.checkedAt).toLocaleString()}` : ''}
						</p>
						{result.reasons.length ? (
							<ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-rose-700">
								{result.reasons.slice(0, 3).map((reason) => (
									<li key={reason}>{reason}</li>
								))}
							</ul>
						) : (
							<p className="mt-3 text-xs text-emerald-700">No active alerts.</p>
						)}
						<div className="mt-4">
							<Link
								href={result.item.href}
								className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
							>
								Open module
							</Link>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
