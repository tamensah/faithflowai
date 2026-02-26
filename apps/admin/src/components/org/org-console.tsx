'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

type OrgUnitRollup = {
	directChildren: number;
	totalDescendantUnits: number;
	directActiveAssignments: number;
	subtreeActiveAssignments: number;
	directLeadershipAssignments: number;
	subtreeLeadershipAssignments: number;
	activeDistinctMembers: number;
};

type OrgUnit = {
	id: string;
	name: string;
	slug: string;
	type: string;
	parentUnitId: string | null;
	countryIso2: string | null;
	rollup?: OrgUnitRollup | null;
};

type OrgAlias = {
	id: string;
	concept: string;
	singularLabel: string;
	pluralLabel: string;
};

type RoleTemplate = {
	id: string;
	code: string;
	name: string;
	isLeadership: boolean;
};

type Member = {
	id: string;
	firstName: string;
	lastName: string;
	email: string | null;
};

type RoleAssignment = {
	id: string;
	status: string;
	createdAt: string;
	startAt: string;
	endAt: string | null;
	member: { firstName: string; lastName: string; email: string | null };
	roleTemplate: { name: string; code: string };
	orgUnit: { name: string; type: string };
};

type AuditEvent = {
	id: string;
	createdAt: string;
	action: string;
	result: string;
	orgUnitId: string | null;
	actorId: string;
	entityType: string;
	entityId: string | null;
	reason: string | null;
};

type HierarchyOverview = {
	rootUnits: OrgUnit[];
	unitTypeTotals: Array<{ type: string; count: number }>;
	assignmentTotals: Array<{ status: string; count: number }>;
};

type BootstrapPayload = {
	organizationId: string;
	units: OrgUnit[];
	aliases: OrgAlias[];
	hierarchyOverview: HierarchyOverview;
	roleTemplates: RoleTemplate[];
	members: Member[];
	assignments: RoleAssignment[];
	assignmentsNextCursor?: string;
	audit: AuditEvent[];
	auditNextCursor?: string;
};

type HierarchyPayload = {
	nodes: OrgUnit[];
	overview: HierarchyOverview;
};

type RoleAssignmentListPayload = {
	items: RoleAssignment[];
	nextCursor?: string;
};

type AuditListPayload = {
	items: AuditEvent[];
	nextCursor?: string;
};

const unitTypes = [
	'HEADQUARTERS',
	'REGION',
	'BRANCH',
	'CAMPUS',
	'DIASPORA',
	'ZONE',
	'DEPARTMENT',
	'MINISTRY',
] as const;
const AUDIT_FILTER_STORAGE_KEY = 'faithflow.org.auditFilters.v1';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function toSlug(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)+/g, '');
}

function createIdempotencyKey(prefix: string): string {
	const random =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	return `${prefix}-${random}`;
}

function humanizeEnum(value: string): string {
	return value
		.toLowerCase()
		.split('_')
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(' ');
}

function toDateTimeLocal(value: string | null | undefined): string {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	const timezoneOffsetMs = date.getTimezoneOffset() * 60000;
	return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string): string | undefined {
	if (!value.trim()) return undefined;
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return undefined;
	return parsed.toISOString();
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

export function OrgConsole() {
	const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
	const [hierarchy, setHierarchy] = useState<HierarchyPayload | null>(null);
	const [hierarchyParent, setHierarchyParent] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [formErrors, setFormErrors] = useState<Record<string, string>>({});
	const [assignmentSearch, setAssignmentSearch] = useState('');
	const [assignmentStatusFilter, setAssignmentStatusFilter] = useState('ALL');
	const [assignmentOrgUnitFilter, setAssignmentOrgUnitFilter] = useState('');
	const [assignmentIncludeDescendants, setAssignmentIncludeDescendants] = useState(true);
	const [assignmentLimit, setAssignmentLimit] = useState(20);
	const [auditSearch, setAuditSearch] = useState('');
	const [auditActionFilter, setAuditActionFilter] = useState('ALL');
	const [auditOrgUnitFilter, setAuditOrgUnitFilter] = useState('');
	const [auditResultFilter, setAuditResultFilter] = useState('ALL');
	const [auditLimit, setAuditLimit] = useState(20);
	const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
	const [assignmentsNextCursor, setAssignmentsNextCursor] = useState<string | undefined>();
	const [assignmentsLoading, setAssignmentsLoading] = useState(false);
	const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
	const [auditNextCursor, setAuditNextCursor] = useState<string | undefined>();
	const [auditLoading, setAuditLoading] = useState(false);

	const [unitForm, setUnitForm] = useState({
		name: '',
		slug: '',
		type: 'BRANCH',
		parentUnitId: '',
		countryIso2: 'GH',
		timezone: 'Africa/Accra',
	});

	const [roleTemplateForm, setRoleTemplateForm] = useState({
		code: '',
		name: '',
		isLeadership: true,
	});

	const [assignmentForm, setAssignmentForm] = useState({
		memberId: '',
		roleTemplateId: '',
		orgUnitId: '',
	});

	const [assignmentEditForm, setAssignmentEditForm] = useState({
		assignmentId: '',
		status: 'ACTIVE',
		startAt: '',
		endAt: '',
	});

	const [aliasForm, setAliasForm] = useState({
		concept: 'BRANCH',
		singularLabel: 'Branch',
		pluralLabel: 'Branches',
	});

	const unitOptions = useMemo(() => bootstrap?.units ?? [], [bootstrap]);
	const unitNameById = useMemo(() => {
		const map = new Map<string, string>();
		for (const unit of unitOptions) map.set(unit.id, unit.name);
		return map;
	}, [unitOptions]);
	const organizationId = bootstrap?.organizationId ?? '';

	const aliasMap = useMemo(() => {
		const map = new Map<string, OrgAlias>();
		for (const alias of bootstrap?.aliases ?? []) map.set(alias.concept, alias);
		return map;
	}, [bootstrap?.aliases]);

	const labeledUnitTypes = useMemo(
		() =>
			unitTypes.map((type) => ({
				type,
				singularLabel: aliasMap.get(type)?.singularLabel ?? humanizeEnum(type),
				pluralLabel: aliasMap.get(type)?.pluralLabel ?? `${humanizeEnum(type)}s`,
			})),
		[aliasMap]
	);
	const auditActionOptions = useMemo(() => {
		const actions = new Set<string>();
		for (const event of bootstrap?.audit ?? []) actions.add(event.action);
		for (const event of auditEvents) actions.add(event.action);
		if (auditActionFilter !== 'ALL') actions.add(auditActionFilter);
		return Array.from(actions).sort((left, right) => left.localeCompare(right));
	}, [bootstrap?.audit, auditEvents, auditActionFilter]);
	const searchParams = useSearchParams();

	useEffect(() => {
		if (typeof window === 'undefined') return;
		try {
			const raw = window.localStorage.getItem(AUDIT_FILTER_STORAGE_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw) as {
				search?: string;
				action?: string;
				orgUnitId?: string;
				result?: string;
				limit?: number;
			};
			if (typeof parsed.search === 'string') setAuditSearch(parsed.search);
			if (typeof parsed.action === 'string') setAuditActionFilter(parsed.action);
			if (typeof parsed.orgUnitId === 'string') setAuditOrgUnitFilter(parsed.orgUnitId);
			if (typeof parsed.result === 'string') setAuditResultFilter(parsed.result);
			if (parsed.limit === 20 || parsed.limit === 50 || parsed.limit === 100) setAuditLimit(parsed.limit);
		} catch {
			// Ignore malformed local storage payload.
		}
	}, []);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		window.localStorage.setItem(
			AUDIT_FILTER_STORAGE_KEY,
			JSON.stringify({
				search: auditSearch,
				action: auditActionFilter,
				orgUnitId: auditOrgUnitFilter,
				result: auditResultFilter,
				limit: auditLimit,
			})
		);
	}, [auditActionFilter, auditLimit, auditOrgUnitFilter, auditResultFilter, auditSearch]);

	useEffect(() => {
		void loadBootstrapData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		setAliasForm((current) => {
			const alias = aliasMap.get(current.concept);
			if (!alias) return current;
			return {
				...current,
				singularLabel: alias.singularLabel,
				pluralLabel: alias.pluralLabel,
			};
		});
	}, [aliasMap]);

	useEffect(() => {
		const scopedUnitId = searchParams.get('orgUnitId') ?? '';
		const includeDescendants = searchParams.get('includeDescendants') !== 'false';
		setAssignmentOrgUnitFilter(scopedUnitId);
		setAssignmentIncludeDescendants(includeDescendants);
	}, [searchParams]);

	useEffect(() => {
		if (!bootstrap) return;
		void loadAssignmentsPage();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		bootstrap?.organizationId,
		assignmentStatusFilter,
		assignmentSearch,
		assignmentOrgUnitFilter,
		assignmentIncludeDescendants,
		assignmentLimit,
	]);

	useEffect(() => {
		if (!bootstrap) return;
		void loadAuditPage();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [bootstrap?.organizationId, auditResultFilter, auditActionFilter, auditOrgUnitFilter, auditSearch, auditLimit]);

	async function loadBootstrapData() {
		setLoading(true);
		setError(null);
		try {
			const payload = await requestJson<BootstrapPayload>('/api/org/bootstrap');
			setBootstrap(payload);
			setAssignments(payload.assignments ?? []);
			setAssignmentsNextCursor(payload.assignmentsNextCursor);
			setAuditEvents(payload.audit ?? []);
			setAuditNextCursor(payload.auditNextCursor);
			await loadHierarchy(payload.organizationId, hierarchyParent || undefined);
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Failed to load');
		} finally {
			setLoading(false);
		}
	}

	async function loadAssignmentsPage(options?: { append?: boolean; cursor?: string }) {
		if (!bootstrap) return;
		setAssignmentsLoading(true);
		try {
			const params = new URLSearchParams();
			params.set('limit', String(assignmentLimit));
			if (assignmentStatusFilter !== 'ALL') params.set('status', assignmentStatusFilter);
			if (assignmentSearch.trim()) params.set('query', assignmentSearch.trim());
			if (assignmentOrgUnitFilter) params.set('orgUnitId', assignmentOrgUnitFilter);
			params.set('includeDescendants', assignmentIncludeDescendants ? 'true' : 'false');
			if (options?.cursor) params.set('cursor', options.cursor);

			const payload = await requestJson<RoleAssignmentListPayload>(
				`/api/org/role-assignments?${params.toString()}`
			);
			setAssignments((current) => (options?.append ? [...current, ...payload.items] : payload.items));
			setAssignmentsNextCursor(payload.nextCursor);
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Failed to load assignments');
		} finally {
			setAssignmentsLoading(false);
		}
	}

	async function loadAuditPage(options?: { append?: boolean; cursor?: string }) {
		if (!bootstrap) return;
		setAuditLoading(true);
		try {
			const params = new URLSearchParams();
			params.set('limit', String(auditLimit));
			if (auditResultFilter !== 'ALL') params.set('result', auditResultFilter);
			if (auditActionFilter !== 'ALL') params.set('action', auditActionFilter);
			if (auditOrgUnitFilter) params.set('orgUnitId', auditOrgUnitFilter);
			if (auditSearch.trim()) params.set('query', auditSearch.trim());
			if (options?.cursor) params.set('cursor', options.cursor);

			const payload = await requestJson<AuditListPayload>(`/api/org/audit?${params.toString()}`);
			setAuditEvents((current) => (options?.append ? [...current, ...payload.items] : payload.items));
			setAuditNextCursor(payload.nextCursor);
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Failed to load audit events');
		} finally {
			setAuditLoading(false);
		}
	}

	async function loadHierarchy(organizationIdInput?: string, parentUnitId?: string) {
		if (!organizationIdInput && !organizationId) return;
		const params = new URLSearchParams();
		if (parentUnitId) params.set('parentUnitId', parentUnitId);
		const query = params.toString();
		const payload = await requestJson<HierarchyPayload>(
			`/api/org/hierarchy${query ? `?${query}` : ''}`
		);
		setHierarchy(payload);
	}

	function resetFeedback() {
		setError(null);
		setSuccess(null);
		setFormErrors({});
	}

	async function handleCreateUnit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		resetFeedback();

		const generatedSlug = unitForm.slug ? unitForm.slug : toSlug(unitForm.name);
		const nextErrors: Record<string, string> = {};
		if (!unitForm.name.trim()) nextErrors.unitName = 'Unit name is required.';
		if (!generatedSlug || !slugPattern.test(generatedSlug)) {
			nextErrors.unitSlug = 'Slug must use lowercase letters, numbers, and hyphens.';
		}
		if (!unitForm.timezone.trim()) nextErrors.unitTimezone = 'Timezone is required.';

		if (Object.keys(nextErrors).length > 0) {
			setFormErrors(nextErrors);
			return;
		}

		try {
			await requestJson('/api/org/units', {
				method: 'POST',
				body: JSON.stringify({
					idempotencyKey: createIdempotencyKey('unit-create'),
					name: unitForm.name.trim(),
					slug: generatedSlug,
					type: unitForm.type,
					parentUnitId: unitForm.parentUnitId || undefined,
					countryIso2: unitForm.countryIso2 || undefined,
					timezone: unitForm.timezone || 'UTC',
				}),
			});
			setUnitForm((current) => ({
				...current,
				name: '',
				slug: '',
			}));
			setSuccess('Org unit created.');
			await loadBootstrapData();
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Create failed');
		}
	}

	async function handleCreateRoleTemplate(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		resetFeedback();
		try {
			await requestJson('/api/org/role-templates', {
				method: 'POST',
				body: JSON.stringify({
					idempotencyKey: createIdempotencyKey('role-template'),
					code: roleTemplateForm.code.toUpperCase(),
					name: roleTemplateForm.name,
					isLeadership: roleTemplateForm.isLeadership,
				}),
			});
			setRoleTemplateForm({ code: '', name: '', isLeadership: true });
			setSuccess('Role template created.');
			await loadBootstrapData();
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Create failed');
		}
	}

	async function handleAssignRole(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		resetFeedback();
		try {
			await requestJson('/api/org/role-assignments', {
				method: 'POST',
				body: JSON.stringify({
					idempotencyKey: createIdempotencyKey('role-assignment'),
					memberId: assignmentForm.memberId,
					roleTemplateId: assignmentForm.roleTemplateId,
					orgUnitId: assignmentForm.orgUnitId,
				}),
			});
			setAssignmentForm({ memberId: '', roleTemplateId: '', orgUnitId: '' });
			setSuccess('Role assignment created.');
			await loadBootstrapData();
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Assign failed');
		}
	}

	function openEditAssignment(assignment: RoleAssignment) {
		setAssignmentEditForm({
			assignmentId: assignment.id,
			status: assignment.status,
			startAt: toDateTimeLocal(assignment.startAt),
			endAt: toDateTimeLocal(assignment.endAt),
		});
	}

	async function handleUpdateAssignment(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!assignmentEditForm.assignmentId) return;
		resetFeedback();
		try {
			await requestJson('/api/org/role-assignments', {
				method: 'PATCH',
				body: JSON.stringify({
					operation: 'update',
					idempotencyKey: createIdempotencyKey('role-assignment-update'),
					assignmentId: assignmentEditForm.assignmentId,
					status: assignmentEditForm.status,
					startAt: fromDateTimeLocal(assignmentEditForm.startAt),
					endAt: assignmentEditForm.endAt.trim()
						? fromDateTimeLocal(assignmentEditForm.endAt)
						: null,
				}),
			});
			setSuccess('Role assignment timeline updated.');
			await loadBootstrapData();
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Update failed');
		}
	}

	async function handleAliasSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		resetFeedback();
		try {
			await requestJson('/api/org/aliases', {
				method: 'POST',
				body: JSON.stringify({
					idempotencyKey: createIdempotencyKey('alias'),
					concept: aliasForm.concept,
					singularLabel: aliasForm.singularLabel.trim(),
					pluralLabel: aliasForm.pluralLabel.trim(),
				}),
			});
			setSuccess('Alias updated.');
			await loadBootstrapData();
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Alias update failed');
		}
	}

	async function handleExportAuditCsv() {
		resetFeedback();
		try {
			const params = new URLSearchParams();
			params.set('format', 'csv');
			params.set('limit', '1000');
			if (auditResultFilter !== 'ALL') params.set('result', auditResultFilter);
			if (auditActionFilter !== 'ALL') params.set('action', auditActionFilter);
			if (auditOrgUnitFilter) params.set('orgUnitId', auditOrgUnitFilter);
			if (auditSearch.trim()) params.set('query', auditSearch.trim());

			const response = await fetch(`/api/org/audit?${params.toString()}`, {
				method: 'GET',
			});
			if (!response.ok) {
				const payload = (await response.json().catch(() => ({}))) as { error?: string };
				throw new Error(payload.error ?? 'Failed to export audit CSV');
			}

			const blob = await response.blob();
			const downloadUrl = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = downloadUrl;
			anchor.download = 'faithflow-audit.csv';
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(downloadUrl);
			setSuccess('Audit CSV exported.');
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Audit export failed');
		}
	}

	async function handleRollupRefresh() {
		resetFeedback();
		try {
			await requestJson('/api/org/rollups/refresh', {
				method: 'POST',
				body: JSON.stringify({ idempotencyKey: createIdempotencyKey('rollup-refresh') }),
			});
			setSuccess('Hierarchy rollups refreshed.');
			await loadBootstrapData();
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Refresh failed');
		}
	}

	function applyAuditPreset(preset: 'DENIED_ONLY' | 'AUTH_GUARDRAIL' | 'FINANCE') {
		if (preset === 'DENIED_ONLY') {
			setAuditSearch('');
			setAuditActionFilter('ALL');
			setAuditOrgUnitFilter('');
			setAuditResultFilter('DENIED');
			setAuditLimit(50);
			return;
		}
		if (preset === 'AUTH_GUARDRAIL') {
			setAuditSearch('');
			setAuditActionFilter('AUTH_GUARDRAIL_BLOCKED');
			setAuditOrgUnitFilter('');
			setAuditResultFilter('DENIED');
			setAuditLimit(50);
			return;
		}
		setAuditSearch('PAYMENT');
		setAuditActionFilter('ALL');
		setAuditOrgUnitFilter('');
		setAuditResultFilter('ALL');
		setAuditLimit(50);
	}

	return (
		<div className="space-y-6">
			<div className="rounded-lg border border-gray-200 bg-white p-4">
				<p className="text-sm text-gray-600">
					Organization context is derived from the active Clerk organization.
				</p>
				<div className="mt-2 flex flex-wrap items-center gap-2">
					<span className="rounded-md bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
						Org ID: {organizationId || 'loading...'}
					</span>
					<button
						type="button"
						onClick={loadBootstrapData}
						disabled={loading}
						className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
					>
						{loading ? 'Loading...' : 'Reload data'}
					</button>
					<button
						type="button"
						onClick={handleRollupRefresh}
						disabled={!bootstrap}
						className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
					>
						Refresh rollups
					</button>
				</div>
				{error && <p className="mt-2 text-sm text-red-600">{error}</p>}
				{success && <p className="mt-2 text-sm text-emerald-700">{success}</p>}
			</div>

			<div className="grid gap-6 xl:grid-cols-3">
				<div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 xl:col-span-2">
					<div className="flex items-center justify-between">
						<h2 className="text-base font-semibold text-gray-900">Executive hierarchy overview</h2>
						<select
							value={hierarchyParent}
							onChange={(event) => {
								const value = event.target.value;
								setHierarchyParent(value);
								void loadHierarchy(undefined, value || undefined);
							}}
							className="rounded-md border border-gray-300 px-3 py-2 text-sm"
						>
							<option value="">Root units</option>
							{unitOptions.map((unit) => (
								<option key={unit.id} value={unit.id}>
									{unit.name} ({aliasMap.get(unit.type)?.singularLabel ?? humanizeEnum(unit.type)})
								</option>
							))}
						</select>
					</div>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{hierarchy?.nodes.length ? (
							hierarchy.nodes.map((unit) => (
								<div key={unit.id} className="rounded border border-slate-200 p-3">
									<p className="text-sm font-semibold text-slate-900">{unit.name}</p>
									<p className="text-xs text-slate-500">
										{aliasMap.get(unit.type)?.singularLabel ?? humanizeEnum(unit.type)}
									</p>
									<p className="mt-2 text-xs text-slate-600">
										Children: {unit.rollup?.directChildren ?? 0} · Descendants:{' '}
										{unit.rollup?.totalDescendantUnits ?? 0}
									</p>
									<p className="text-xs text-slate-600">
										Active roles: {unit.rollup?.subtreeActiveAssignments ?? 0} · Leaders:{' '}
										{unit.rollup?.subtreeLeadershipAssignments ?? 0}
									</p>
								</div>
							))
						) : (
							<p className="text-sm text-slate-500">No units in this branch of the hierarchy yet.</p>
						)}
					</div>
				</div>
				<div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
					<h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Unit totals</h3>
					{bootstrap?.hierarchyOverview.unitTypeTotals.length ? (
						bootstrap.hierarchyOverview.unitTypeTotals.map((item) => (
							<div key={item.type} className="flex items-center justify-between text-sm">
								<span>{aliasMap.get(item.type)?.pluralLabel ?? `${humanizeEnum(item.type)}s`}</span>
								<span className="font-semibold">{item.count}</span>
							</div>
						))
					) : (
						<p className="text-sm text-gray-500">No hierarchy totals yet.</p>
					)}
					<div className="my-3 border-t border-slate-200" />
					<h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
						Assignment totals
					</h3>
					{bootstrap?.hierarchyOverview.assignmentTotals.length ? (
						bootstrap.hierarchyOverview.assignmentTotals.map((item) => (
							<div key={item.status} className="flex items-center justify-between text-sm">
								<span>{humanizeEnum(item.status)}</span>
								<span className="font-semibold">{item.count}</span>
							</div>
						))
					) : (
						<p className="text-sm text-gray-500">No assignments yet.</p>
					)}
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<form
					onSubmit={handleCreateUnit}
					className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
				>
					<h2 className="text-base font-semibold text-gray-900">Org builder</h2>
					<label className="text-sm font-medium text-gray-700">
						Unit name *
						<input
							value={unitForm.name}
							onChange={(event) =>
								setUnitForm((current) => ({ ...current, name: event.target.value }))
							}
							className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
							placeholder="Unit name"
							required
						/>
					</label>
					<label className="text-sm font-medium text-gray-700">
						Slug *
						<input
							value={unitForm.slug}
							onChange={(event) =>
								setUnitForm((current) => ({
									...current,
									slug: event.target.value.toLowerCase(),
								}))
							}
							className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
							placeholder="Optional. Auto-generated if left blank"
						/>
					</label>
					{formErrors.unitSlug ? (
						<p className="text-xs text-red-600">{formErrors.unitSlug}</p>
					) : null}
					<label className="text-sm font-medium text-gray-700">
						Unit type *
						<select
							value={unitForm.type}
							onChange={(event) =>
								setUnitForm((current) => ({ ...current, type: event.target.value }))
							}
							className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
						>
							{labeledUnitTypes.map((item) => (
								<option key={item.type} value={item.type}>
									{item.singularLabel}
								</option>
							))}
						</select>
					</label>
					<label className="text-sm font-medium text-gray-700">
						Parent unit
						<select
							value={unitForm.parentUnitId}
							onChange={(event) =>
								setUnitForm((current) => ({
									...current,
									parentUnitId: event.target.value,
								}))
							}
							className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
						>
							<option value="">No parent (root)</option>
							{unitOptions.map((unit) => (
								<option key={unit.id} value={unit.id}>
									{unit.name} ({aliasMap.get(unit.type)?.singularLabel ?? humanizeEnum(unit.type)})
								</option>
							))}
						</select>
					</label>
					<div className="grid gap-2 sm:grid-cols-2">
						<label className="text-sm font-medium text-gray-700">
							Country ISO2
							<input
								value={unitForm.countryIso2}
								onChange={(event) =>
									setUnitForm((current) => ({
										...current,
										countryIso2: event.target.value.toUpperCase(),
									}))
								}
								className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
								placeholder="GH"
							/>
						</label>
						<label className="text-sm font-medium text-gray-700">
							Timezone *
							<input
								value={unitForm.timezone}
								onChange={(event) =>
									setUnitForm((current) => ({ ...current, timezone: event.target.value }))
								}
								className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
								placeholder="Africa/Accra"
								required
							/>
						</label>
					</div>
					{formErrors.unitTimezone ? (
						<p className="text-xs text-red-600">{formErrors.unitTimezone}</p>
					) : null}
					<button
						type="submit"
						disabled={!bootstrap}
						className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
					>
						Create unit
					</button>
				</form>

				<form
					onSubmit={handleAliasSubmit}
					className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
				>
					<h2 className="text-base font-semibold text-gray-900">Terminology aliasing</h2>
					<p className="text-sm text-gray-600">
						Use tenant-specific labels like “Campus” instead of “Branch”.
					</p>
					<label className="text-sm font-medium text-gray-700">
						Concept *
						<select
							value={aliasForm.concept}
							onChange={(event) => {
								const concept = event.target.value;
								const preset = aliasMap.get(concept);
								setAliasForm({
									concept,
									singularLabel: preset?.singularLabel ?? humanizeEnum(concept),
									pluralLabel: preset?.pluralLabel ?? `${humanizeEnum(concept)}s`,
								});
							}}
							className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
						>
							{unitTypes.map((type) => (
								<option key={type} value={type}>
									{humanizeEnum(type)}
								</option>
							))}
						</select>
					</label>
					<label className="text-sm font-medium text-gray-700">
						Singular label *
						<input
							value={aliasForm.singularLabel}
							onChange={(event) =>
								setAliasForm((current) => ({ ...current, singularLabel: event.target.value }))
							}
							className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
							required
						/>
					</label>
					<label className="text-sm font-medium text-gray-700">
						Plural label *
						<input
							value={aliasForm.pluralLabel}
							onChange={(event) =>
								setAliasForm((current) => ({ ...current, pluralLabel: event.target.value }))
							}
							className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
							required
						/>
					</label>
					<button
						type="submit"
						disabled={!bootstrap}
						className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
					>
						Save alias
					</button>
				</form>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<form
					onSubmit={handleCreateRoleTemplate}
					className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
				>
					<h2 className="text-base font-semibold text-gray-900">Role template</h2>
					<input
						value={roleTemplateForm.code}
						onChange={(event) =>
							setRoleTemplateForm((current) => ({
								...current,
								code: event.target.value.toUpperCase(),
							}))
						}
						className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
						placeholder="Code (e.g. REGIONAL_PASTOR)"
						required
					/>
					<input
						value={roleTemplateForm.name}
						onChange={(event) =>
							setRoleTemplateForm((current) => ({ ...current, name: event.target.value }))
						}
						className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
						placeholder="Display name"
						required
					/>
					<label className="flex items-center gap-2 text-sm text-gray-700">
						<input
							type="checkbox"
							checked={roleTemplateForm.isLeadership}
							onChange={(event) =>
								setRoleTemplateForm((current) => ({
									...current,
									isLeadership: event.target.checked,
								}))
							}
						/>
						Leadership role
					</label>
					<button
						type="submit"
						disabled={!bootstrap}
						className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
					>
						Create role template
					</button>
				</form>

				<form
					onSubmit={handleAssignRole}
					className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
				>
					<h2 className="text-base font-semibold text-gray-900">Role assignment</h2>
					<select
						value={assignmentForm.memberId}
						onChange={(event) =>
							setAssignmentForm((current) => ({ ...current, memberId: event.target.value }))
						}
						className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
						required
					>
						<option value="">Select member</option>
						{bootstrap?.members.map((member) => (
							<option key={member.id} value={member.id}>
								{member.firstName} {member.lastName}
								{member.email ? ` (${member.email})` : ''}
							</option>
						))}
					</select>
					<select
						value={assignmentForm.roleTemplateId}
						onChange={(event) =>
							setAssignmentForm((current) => ({
								...current,
								roleTemplateId: event.target.value,
							}))
						}
						className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
						required
					>
						<option value="">Select role template</option>
						{bootstrap?.roleTemplates.map((role) => (
							<option key={role.id} value={role.id}>
								{role.name} ({role.code})
							</option>
						))}
					</select>
					<select
						value={assignmentForm.orgUnitId}
						onChange={(event) =>
							setAssignmentForm((current) => ({ ...current, orgUnitId: event.target.value }))
						}
						className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
						required
					>
						<option value="">Select unit</option>
						{unitOptions.map((unit) => (
							<option key={unit.id} value={unit.id}>
								{unit.name} ({aliasMap.get(unit.type)?.singularLabel ?? humanizeEnum(unit.type)})
							</option>
						))}
					</select>
					<button
						type="submit"
						disabled={!bootstrap}
						className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
					>
						Assign role
					</button>
				</form>
			</div>

			<div className="grid gap-6 xl:grid-cols-2">
				<div className="rounded-lg border border-gray-200 bg-white p-4">
					<h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
						Role assignments
					</h3>
					<div className="mt-3 grid gap-2 md:grid-cols-5">
						<input
							value={assignmentSearch}
							onChange={(event) => setAssignmentSearch(event.target.value)}
							placeholder="Search member, role, unit..."
							className="rounded-md border border-gray-300 px-3 py-2 text-sm"
						/>
						<select
							value={assignmentStatusFilter}
							onChange={(event) => setAssignmentStatusFilter(event.target.value)}
							className="rounded-md border border-gray-300 px-3 py-2 text-sm"
						>
							<option value="ALL">All statuses</option>
							<option value="PLANNED">Planned</option>
							<option value="ACTIVE">Active</option>
							<option value="SUSPENDED">Suspended</option>
							<option value="ENDED">Ended</option>
						</select>
						<select
							value={assignmentOrgUnitFilter}
							onChange={(event) => setAssignmentOrgUnitFilter(event.target.value)}
							className="rounded-md border border-gray-300 px-3 py-2 text-sm"
						>
							<option value="">All units</option>
							{unitOptions.map((unit) => (
								<option key={unit.id} value={unit.id}>
									{unit.name}
								</option>
							))}
						</select>
						<select
							value={assignmentIncludeDescendants ? 'true' : 'false'}
							onChange={(event) => setAssignmentIncludeDescendants(event.target.value === 'true')}
							className="rounded-md border border-gray-300 px-3 py-2 text-sm"
						>
							<option value="true">With descendants</option>
							<option value="false">Selected unit only</option>
						</select>
						<select
							value={assignmentLimit}
							onChange={(event) => setAssignmentLimit(Number(event.target.value))}
							className="rounded-md border border-gray-300 px-3 py-2 text-sm"
						>
							<option value={20}>Show 20</option>
							<option value={50}>Show 50</option>
							<option value={100}>Show 100</option>
						</select>
					</div>
					<div className="mt-3 space-y-2 text-sm">
						{assignments.length ? (
							assignments.map((assignment) => (
								<div key={assignment.id} className="rounded border border-gray-200 p-2">
									<div className="flex items-start justify-between gap-2">
										<div>
											<p className="font-medium text-gray-900">
												{assignment.member.firstName} {assignment.member.lastName}
											</p>
											<p className="text-gray-600">
												{assignment.roleTemplate.name}
												{' -> '}
												{assignment.orgUnit.name}
											</p>
											<p className="text-xs text-gray-500">
												{assignment.status} · Start:{' '}
												{new Date(assignment.startAt).toLocaleString()}
												{assignment.endAt
													? ` · End: ${new Date(assignment.endAt).toLocaleString()}`
													: ''}
											</p>
										</div>
										<button
											type="button"
											onClick={() => openEditAssignment(assignment)}
											className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
										>
											Edit timeline
										</button>
									</div>
								</div>
							))
						) : (
							<p className="text-gray-500">No assignments yet.</p>
						)}
					</div>
					<div className="mt-3 flex items-center justify-between">
						{assignmentsLoading ? (
							<p className="text-xs text-slate-500">Loading assignments...</p>
						) : (
							<span className="text-xs text-slate-500">
								{assignments.length} assignment{assignments.length === 1 ? '' : 's'} loaded
							</span>
						)}
						<button
							type="button"
							onClick={() => void loadAssignmentsPage({ append: true, cursor: assignmentsNextCursor })}
							disabled={!assignmentsNextCursor || assignmentsLoading}
							className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 disabled:opacity-40"
						>
							{assignmentsLoading ? 'Loading...' : assignmentsNextCursor ? 'Load more' : 'No more'}
						</button>
					</div>
					{assignmentEditForm.assignmentId ? (
						<form
							onSubmit={handleUpdateAssignment}
							className="mt-4 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-2"
						>
							<p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:col-span-2">
								Update assignment timeline
							</p>
							<label className="text-xs font-medium text-slate-700">
								Status
								<select
									value={assignmentEditForm.status}
									onChange={(event) =>
										setAssignmentEditForm((current) => ({
											...current,
											status: event.target.value,
										}))
									}
									className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
								>
									<option value="PLANNED">Planned</option>
									<option value="ACTIVE">Active</option>
									<option value="SUSPENDED">Suspended</option>
									<option value="ENDED">Ended</option>
								</select>
							</label>
							<label className="text-xs font-medium text-slate-700">
								Start
								<input
									type="datetime-local"
									value={assignmentEditForm.startAt}
									onChange={(event) =>
										setAssignmentEditForm((current) => ({
											...current,
											startAt: event.target.value,
										}))
									}
									className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
								/>
							</label>
							<label className="text-xs font-medium text-slate-700">
								End
								<input
									type="datetime-local"
									value={assignmentEditForm.endAt}
									onChange={(event) =>
										setAssignmentEditForm((current) => ({
											...current,
											endAt: event.target.value,
										}))
									}
									className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
								/>
							</label>
							<div className="flex items-end gap-2">
								<button
									type="submit"
									className="rounded bg-slate-800 px-3 py-2 text-sm font-medium text-white"
								>
									Save timeline
								</button>
								<button
									type="button"
									onClick={() =>
										setAssignmentEditForm({
											assignmentId: '',
											status: 'ACTIVE',
											startAt: '',
											endAt: '',
										})
									}
									className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
								>
									Cancel
								</button>
							</div>
						</form>
					) : null}
				</div>

				<div className="rounded-lg border border-gray-200 bg-white p-4">
					<div className="flex items-center justify-between gap-2">
						<h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
							Audit viewer
						</h3>
						<div className="flex flex-wrap items-center gap-2">
							<button
								type="button"
								onClick={() => applyAuditPreset('DENIED_ONLY')}
								className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
							>
								Denied only
							</button>
							<button
								type="button"
								onClick={() => applyAuditPreset('AUTH_GUARDRAIL')}
								className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
							>
								Auth guardrails
							</button>
							<button
								type="button"
								onClick={() => applyAuditPreset('FINANCE')}
								className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
							>
								Finance
							</button>
							<button
								type="button"
								onClick={handleExportAuditCsv}
								className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700"
							>
								Export CSV
							</button>
						</div>
					</div>
					<div className="mt-3 grid gap-2 md:grid-cols-5">
						<input
							value={auditSearch}
							onChange={(event) => setAuditSearch(event.target.value)}
							placeholder="Filter action/entity/actor..."
							className="rounded-md border border-gray-300 px-3 py-2 text-sm"
						/>
						<select
							value={auditActionFilter}
							onChange={(event) => setAuditActionFilter(event.target.value)}
							className="rounded-md border border-gray-300 px-3 py-2 text-sm"
						>
							<option value="ALL">All actions</option>
							{auditActionOptions.map((action) => (
								<option key={action} value={action}>
									{action}
								</option>
							))}
						</select>
						<select
							value={auditOrgUnitFilter}
							onChange={(event) => setAuditOrgUnitFilter(event.target.value)}
							className="rounded-md border border-gray-300 px-3 py-2 text-sm"
						>
							<option value="">All units</option>
							{unitOptions.map((unit) => (
								<option key={unit.id} value={unit.id}>
									{unit.name}
								</option>
							))}
						</select>
						<select
							value={auditResultFilter}
							onChange={(event) => setAuditResultFilter(event.target.value)}
							className="rounded-md border border-gray-300 px-3 py-2 text-sm"
						>
							<option value="ALL">All results</option>
							<option value="SUCCESS">Success</option>
							<option value="DENIED">Denied</option>
							<option value="FAILED">Failed</option>
						</select>
						<select
							value={auditLimit}
							onChange={(event) => setAuditLimit(Number(event.target.value))}
							className="rounded-md border border-gray-300 px-3 py-2 text-sm"
						>
							<option value={20}>Show 20</option>
							<option value={50}>Show 50</option>
							<option value={100}>Show 100</option>
						</select>
					</div>
					<div className="mt-3 space-y-2 text-sm">
						{auditEvents.length ? (
							auditEvents.map((event) => (
								<div key={event.id} className="rounded border border-gray-200 p-2">
									<p className="font-medium text-gray-900">
										{event.action} ({event.result})
									</p>
									<p className="text-gray-600">
										{event.entityType}
										{event.entityId ? `#${event.entityId}` : ''} by {event.actorId}
									</p>
									{event.orgUnitId ? (
										<p className="text-xs text-gray-500">
											Unit: {unitNameById.get(event.orgUnitId) ?? event.orgUnitId}
										</p>
									) : null}
									<p className="text-xs text-gray-500">
										{new Date(event.createdAt).toLocaleString()}
									</p>
									{event.reason ? (
										<p className="text-xs text-red-600">Reason: {event.reason}</p>
									) : null}
								</div>
							))
						) : (
							<p className="text-gray-500">No audit events yet.</p>
						)}
					</div>
					<div className="mt-3 flex items-center justify-between">
						{auditLoading ? (
							<p className="text-xs text-slate-500">Loading audit events...</p>
						) : (
							<span className="text-xs text-slate-500">
								{auditEvents.length} event{auditEvents.length === 1 ? '' : 's'} loaded
							</span>
						)}
						<button
							type="button"
							onClick={() => void loadAuditPage({ append: true, cursor: auditNextCursor })}
							disabled={!auditNextCursor || auditLoading}
							className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 disabled:opacity-40"
						>
							{auditLoading ? 'Loading...' : auditNextCursor ? 'Load more' : 'No more'}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
