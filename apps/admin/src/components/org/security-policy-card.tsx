'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type PolicyPayload = {
	requireVerifiedEmail: boolean;
	requireMfaForPrivilegedRoles: boolean;
	maxSessionAgeMinutes: number | null;
	allowedEmailDomains: string[];
	privilegedRoles: string[];
};

type SecurityPolicyResponse = {
	organizationId: string;
	storedPolicy?: Partial<PolicyPayload> | null;
	effectivePolicy: PolicyPayload;
};

function createIdempotencyKey(prefix: string): string {
	const random =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	return `${prefix}-${random}`;
}

function toCsv(value: string[]): string {
	return value.join(', ');
}

function parseCsv(value: string, transform: (item: string) => string): string[] {
	return Array.from(
		new Set(
			value
				.split(',')
				.map((item) => transform(item.trim()))
				.filter(Boolean)
		)
	);
}

export function SecurityPolicyCard() {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [organizationId, setOrganizationId] = useState<string>('');
	const [form, setForm] = useState<PolicyPayload>({
		requireVerifiedEmail: false,
		requireMfaForPrivilegedRoles: false,
		maxSessionAgeMinutes: null,
		allowedEmailDomains: [],
		privilegedRoles: [],
	});

	const domainCsv = useMemo(() => toCsv(form.allowedEmailDomains), [form.allowedEmailDomains]);
	const roleCsv = useMemo(() => toCsv(form.privilegedRoles), [form.privilegedRoles]);
	const [domainInput, setDomainInput] = useState('');
	const [roleInput, setRoleInput] = useState('');

	useEffect(() => {
		let active = true;
		async function loadPolicy() {
			setLoading(true);
			setError(null);
			try {
				const response = await fetch('/api/org/security-policy', { cache: 'no-store' });
				const payload = (await response.json()) as SecurityPolicyResponse & { error?: string };
				if (!response.ok) {
					throw new Error(payload.error ?? 'Failed to load security policy');
				}
				if (!active) return;
				setOrganizationId(payload.organizationId);
				setForm(payload.effectivePolicy);
				setDomainInput(toCsv(payload.effectivePolicy.allowedEmailDomains));
				setRoleInput(toCsv(payload.effectivePolicy.privilegedRoles));
			} catch (loadError) {
				if (!active) return;
				setError(loadError instanceof Error ? loadError.message : 'Failed to load security policy');
			} finally {
				if (active) setLoading(false);
			}
		}
		void loadPolicy();
		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		setDomainInput(domainCsv);
	}, [domainCsv]);

	useEffect(() => {
		setRoleInput(roleCsv);
	}, [roleCsv]);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setSuccess(null);
		setSaving(true);
		try {
			const payload = {
				idempotencyKey: createIdempotencyKey('security-policy'),
				requireVerifiedEmail: form.requireVerifiedEmail,
				requireMfaForPrivilegedRoles: form.requireMfaForPrivilegedRoles,
				maxSessionAgeMinutes: form.maxSessionAgeMinutes,
				allowedEmailDomains: parseCsv(domainInput, (value) => value.toLowerCase()),
				privilegedRoles: parseCsv(roleInput, (value) => value.toUpperCase()),
			};

			const response = await fetch('/api/org/security-policy', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const body = (await response.json()) as {
				error?: string;
				policy?: PolicyPayload;
			};
			if (!response.ok || !body.policy) {
				throw new Error(body.error ?? 'Failed to update security policy');
			}
			setForm(body.policy);
			setDomainInput(toCsv(body.policy.allowedEmailDomains));
			setRoleInput(toCsv(body.policy.privilegedRoles));
			setSuccess('Security policy updated.');
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : 'Save failed');
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="rounded-lg border border-gray-200 bg-white p-5">
			<h2 className="text-base font-semibold text-gray-900">Admin security policy (organization)</h2>
			<p className="mt-2 text-sm text-gray-600">
				Persisted per organization and enforced before privileged admin API actions execute.
			</p>
			<p className="mt-2 text-xs text-slate-500">
				Org context: {organizationId || 'loading...'}
			</p>
			<form onSubmit={handleSubmit} className="mt-4 space-y-4">
				<label className="flex items-center gap-2 text-sm text-gray-700">
					<input
						type="checkbox"
						checked={form.requireVerifiedEmail}
						onChange={(event) =>
							setForm((current) => ({ ...current, requireVerifiedEmail: event.target.checked }))
						}
						disabled={loading || saving}
					/>
					Require verified email for privileged access
				</label>
				<label className="flex items-center gap-2 text-sm text-gray-700">
					<input
						type="checkbox"
						checked={form.requireMfaForPrivilegedRoles}
						onChange={(event) =>
							setForm((current) => ({
								...current,
								requireMfaForPrivilegedRoles: event.target.checked,
							}))
						}
						disabled={loading || saving}
					/>
					Require MFA for privileged access
				</label>
				<label className="text-sm font-medium text-gray-700">
					Max session age (minutes)
					<input
						type="number"
						min={1}
						max={10080}
						value={form.maxSessionAgeMinutes ?? ''}
						onChange={(event) =>
							setForm((current) => ({
								...current,
								maxSessionAgeMinutes: event.target.value
									? Math.floor(Number(event.target.value))
									: null,
							}))
						}
						disabled={loading || saving}
						className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
						placeholder="Leave blank to disable session-age enforcement"
					/>
				</label>
				<label className="text-sm font-medium text-gray-700">
					Allowed admin email domains (comma-separated)
					<input
						value={domainInput}
						onChange={(event) => setDomainInput(event.target.value)}
						disabled={loading || saving}
						className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
						placeholder="example.org, church.org"
					/>
				</label>
				<label className="text-sm font-medium text-gray-700">
					Privileged roles (comma-separated)
					<input
						value={roleInput}
						onChange={(event) => setRoleInput(event.target.value)}
						disabled={loading || saving}
						className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
						placeholder="PLATFORM_SUPER_ADMIN, ORG_ADMIN"
					/>
				</label>
				<div className="flex items-center gap-3">
					<button
						type="submit"
						disabled={loading || saving}
						className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
					>
						{saving ? 'Saving...' : 'Save security policy'}
					</button>
					{loading && <span className="text-sm text-slate-500">Loading policy...</span>}
				</div>
				{error ? <p className="text-sm text-red-600">{error}</p> : null}
				{success ? <p className="text-sm text-emerald-700">{success}</p> : null}
			</form>
		</div>
	);
}

