'use client';

import { FormEvent, useState } from 'react';

export function BibleSchoolConsole() {
	const [cohortName, setCohortName] = useState('');
	const [term, setTerm] = useState('');
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setLoading(true);
		setError(null);
		setMessage(null);

		try {
			const response = await fetch('/api/bible-school', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'createCohort',
					cohortName: cohortName.trim(),
					term: term.trim() || undefined,
				}),
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(payload?.error ?? 'Bible school action failed');
			setMessage(payload?.message ?? 'Bible school cohort request captured.');
			setCohortName('');
			setTerm('');
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Bible school action failed');
		} finally {
			setLoading(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5">
			<h2 className="text-base font-semibold text-slate-900">Bible school cohort setup</h2>
			<p className="mt-1 text-sm text-slate-600">
				Capture cohort launch operations and keep a traceable audit event.
			</p>
			<label className="mt-4 block space-y-1 text-sm">
				<span className="text-slate-700">Cohort name *</span>
				<input
					value={cohortName}
					onChange={(event) => setCohortName(event.target.value)}
					className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
					required
				/>
			</label>
			<label className="mt-3 block space-y-1 text-sm">
				<span className="text-slate-700">Term</span>
				<input
					value={term}
					onChange={(event) => setTerm(event.target.value)}
					className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
					placeholder="2026 Q2"
				/>
			</label>
			<button
				type="submit"
				disabled={loading}
				className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
			>
				{loading ? 'Saving...' : 'Create cohort'}
			</button>
			{message ? (
				<p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
					{message}
				</p>
			) : null}
			{error ? (
				<p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
					{error}
				</p>
			) : null}
		</form>
	);
}
