'use client';

import { FormEvent, useState } from 'react';

export function StreamingConsole() {
	const [streamKey, setStreamKey] = useState('');
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setLoading(true);
		setError(null);
		setMessage(null);

		try {
			const response = await fetch('/api/streaming', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'startChecklist',
					streamKey: streamKey.trim() || undefined,
				}),
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(payload?.error ?? 'Streaming action failed');
			setMessage(payload?.message ?? 'Streaming checklist started.');
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Streaming action failed');
		} finally {
			setLoading(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5">
			<h2 className="text-base font-semibold text-slate-900">Streaming readiness checklist</h2>
			<p className="mt-1 text-sm text-slate-600">
				Run an operator checklist and capture an audit event for the broadcast run.
			</p>
			<label className="mt-4 block space-y-1 text-sm">
				<span className="text-slate-700">Stream key (optional)</span>
				<input
					value={streamKey}
					onChange={(event) => setStreamKey(event.target.value)}
					className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
					placeholder="sunday-9am-main"
				/>
			</label>
			<button
				type="submit"
				disabled={loading}
				className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
			>
				{loading ? 'Running...' : 'Start checklist'}
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
