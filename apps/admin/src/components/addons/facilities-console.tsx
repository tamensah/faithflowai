'use client';

import { FormEvent, useState } from 'react';

export function FacilitiesConsole() {
	const [facilityName, setFacilityName] = useState('');
	const [note, setNote] = useState('');
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setLoading(true);
		setError(null);
		setMessage(null);

		try {
			const response = await fetch('/api/facilities', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'createReservation',
					facilityName: facilityName.trim(),
					note: note.trim() || undefined,
				}),
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(payload?.error ?? 'Facilities action failed');
			setMessage(payload?.message ?? 'Facility reservation request captured.');
			setFacilityName('');
			setNote('');
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Facilities action failed');
		} finally {
			setLoading(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5">
			<h2 className="text-base font-semibold text-slate-900">Facility reservation</h2>
			<p className="mt-1 text-sm text-slate-600">
				Capture reservation requests and audit them as operations actions.
			</p>
			<label className="mt-4 block space-y-1 text-sm">
				<span className="text-slate-700">Facility name *</span>
				<input
					value={facilityName}
					onChange={(event) => setFacilityName(event.target.value)}
					className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
					required
				/>
			</label>
			<label className="mt-3 block space-y-1 text-sm">
				<span className="text-slate-700">Note</span>
				<textarea
					value={note}
					onChange={(event) => setNote(event.target.value)}
					className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
					rows={3}
				/>
			</label>
			<button
				type="submit"
				disabled={loading}
				className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
			>
				{loading ? 'Saving...' : 'Create reservation'}
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
