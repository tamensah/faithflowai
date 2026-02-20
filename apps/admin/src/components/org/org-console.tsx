'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useEffect } from 'react';

type OrgUnit = {
	id: string;
	name: string;
	slug: string;
	type: string;
	parentUnitId: string | null;
	countryIso2: string | null;
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
	member: { firstName: string; lastName: string; email: string | null };
	roleTemplate: { name: string; code: string };
	orgUnit: { name: string; type: string };
};

type AuditEvent = {
	id: string;
	createdAt: string;
	action: string;
	result: string;
	actorId: string;
	entityType: string;
	reason: string | null;
};

type BootstrapPayload = {
	organizationId: string;
	units: OrgUnit[];
	roleTemplates: RoleTemplate[];
	members: Member[];
	assignments: RoleAssignment[];
	audit: AuditEvent[];
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...(init?.headers ?? {}),
		},
	});

	const payload = await response.json();
	if (!response.ok) {
		throw new Error(payload?.error ?? 'Request failed');
	}

	return payload as T;
}

function toSlug(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)+/g, '');
}

export function OrgConsole() {
	const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

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

	const unitOptions = useMemo(() => bootstrap?.units ?? [], [bootstrap]);
	const organizationId = bootstrap?.organizationId ?? '';

	useEffect(() => {
		void loadBootstrapData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	async function loadBootstrapData() {
		setLoading(true);
		setError(null);
		try {
			const payload = await requestJson<BootstrapPayload>('/api/org/bootstrap');
			setBootstrap(payload);
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Failed to load');
		} finally {
			setLoading(false);
		}
	}

	async function handleCreateUnit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setSuccess(null);
		try {
			await requestJson('/api/org/units', {
				method: 'POST',
				body: JSON.stringify({
					name: unitForm.name,
					slug: unitForm.slug || toSlug(unitForm.name),
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
		setError(null);
		setSuccess(null);
		try {
			await requestJson('/api/org/role-templates', {
				method: 'POST',
				body: JSON.stringify({
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
		setError(null);
		setSuccess(null);
		try {
			await requestJson('/api/org/role-assignments', {
				method: 'POST',
				body: JSON.stringify({
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
						{loading ? 'Loading...' : 'Load'}
					</button>
				</div>
				{error && <p className="mt-2 text-sm text-red-600">{error}</p>}
				{success && <p className="mt-2 text-sm text-emerald-700">{success}</p>}
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<form
					onSubmit={handleCreateUnit}
					className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
				>
					<h2 className="text-base font-semibold text-gray-900">Org builder</h2>
					<input
						value={unitForm.name}
						onChange={(event) =>
							setUnitForm((current) => ({ ...current, name: event.target.value }))
						}
						className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
						placeholder="Unit name"
						required
					/>
					<input
						value={unitForm.slug}
						onChange={(event) =>
							setUnitForm((current) => ({ ...current, slug: event.target.value }))
						}
						className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
						placeholder="Slug (optional; auto from name)"
					/>
					<select
						value={unitForm.type}
						onChange={(event) =>
							setUnitForm((current) => ({ ...current, type: event.target.value }))
						}
						className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
					>
						{[
							'HEADQUARTERS',
							'REGION',
							'BRANCH',
							'CAMPUS',
							'DIASPORA',
							'ZONE',
							'DEPARTMENT',
							'MINISTRY',
						].map((type) => (
							<option key={type} value={type}>
								{type}
							</option>
						))}
					</select>
					<select
						value={unitForm.parentUnitId}
						onChange={(event) =>
							setUnitForm((current) => ({
								...current,
								parentUnitId: event.target.value,
							}))
						}
						className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
					>
						<option value="">No parent (root)</option>
						{unitOptions.map((unit) => (
							<option key={unit.id} value={unit.id}>
								{unit.name} ({unit.type})
							</option>
						))}
					</select>
					<div className="grid gap-2 sm:grid-cols-2">
						<input
							value={unitForm.countryIso2}
							onChange={(event) =>
								setUnitForm((current) => ({
									...current,
									countryIso2: event.target.value.toUpperCase(),
								}))
							}
							className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
							placeholder="Country ISO2"
						/>
						<input
							value={unitForm.timezone}
							onChange={(event) =>
								setUnitForm((current) => ({ ...current, timezone: event.target.value }))
							}
							className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
							placeholder="Timezone"
						/>
					</div>
					<button
						type="submit"
						disabled={!bootstrap}
						className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
					>
						Create unit
					</button>
				</form>

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
			</div>

			<form
				onSubmit={handleAssignRole}
				className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
			>
				<h2 className="text-base font-semibold text-gray-900">Role assignment</h2>
				<div className="grid gap-2 md:grid-cols-3">
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
								{unit.name} ({unit.type})
							</option>
						))}
					</select>
				</div>
				<button
					type="submit"
					disabled={!bootstrap}
					className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
				>
					Assign role
				</button>
			</form>

			<div className="grid gap-6 xl:grid-cols-2">
				<div className="rounded-lg border border-gray-200 bg-white p-4">
					<h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
						Role assignments
					</h3>
					<div className="mt-3 space-y-2 text-sm">
						{bootstrap?.assignments.length ? (
							bootstrap.assignments.map((assignment) => (
									<div key={assignment.id} className="rounded border border-gray-200 p-2">
										<p className="font-medium text-gray-900">
											{assignment.member.firstName} {assignment.member.lastName}
										</p>
										<p className="text-gray-600">
											{assignment.roleTemplate.name}
											{' -> '}
											{assignment.orgUnit.name}
										</p>
									<p className="text-xs text-gray-500">
										{assignment.status} - {new Date(assignment.createdAt).toLocaleString()}
									</p>
								</div>
							))
						) : (
							<p className="text-gray-500">No assignments yet.</p>
						)}
					</div>
				</div>

				<div className="rounded-lg border border-gray-200 bg-white p-4">
					<h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
						Audit viewer
					</h3>
					<div className="mt-3 space-y-2 text-sm">
						{bootstrap?.audit.length ? (
							bootstrap.audit.map((event) => (
								<div key={event.id} className="rounded border border-gray-200 p-2">
									<p className="font-medium text-gray-900">
										{event.action} ({event.result})
									</p>
									<p className="text-gray-600">
										{event.entityType} by {event.actorId}
									</p>
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
				</div>
			</div>
		</div>
	);
}
