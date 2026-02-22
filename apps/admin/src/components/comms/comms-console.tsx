'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Channel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH';

type Room = {
	id: string;
	name: string;
	type: string;
	updatedAt: string;
	_count?: { messages: number };
	participants?: Array<{ id: string; email: string | null; name: string | null; role: string }>;
};

type Message = {
	id: string;
	roomId: string;
	content: string;
	type: string;
	createdAt: string;
	sender?: { id: string; email: string | null; name: string | null; role: string };
};

type CommsBootstrap = {
	rooms: { items: Room[]; nextCursor?: string };
	messages: { items: Message[]; nextCursor?: string };
	churches: Array<{ id: string; name: string; slug: string }>;
};

const channels: Channel[] = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'];

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

export function CommsConsole() {
	const [data, setData] = useState<CommsBootstrap | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [selectedRoomId, setSelectedRoomId] = useState('');

	const [roomForm, setRoomForm] = useState({
		name: '',
		type: 'THREAD',
		churchId: '',
	});
	const [messageForm, setMessageForm] = useState({
		roomId: '',
		type: 'TEXT',
		content: '',
	});
	const [dispatchForm, setDispatchForm] = useState({
		channel: 'EMAIL' as Channel,
		churchId: '',
		recipient: '',
		subject: '',
		body: '',
		templateKey: '',
	});

	useEffect(() => {
		void loadData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedRoomId]);

	useEffect(() => {
		if (messageForm.roomId) return;
		if (!data?.rooms.items.length) return;
		setMessageForm((current) => ({ ...current, roomId: data.rooms.items[0].id }));
		setSelectedRoomId(data.rooms.items[0].id);
	}, [data?.rooms.items, messageForm.roomId]);

	const selectedRoom = useMemo(
		() => data?.rooms.items.find((item) => item.id === selectedRoomId) ?? null,
		[data?.rooms.items, selectedRoomId]
	);

	async function loadData() {
		setLoading(true);
		setError(null);
		try {
			const params = new URLSearchParams();
			if (selectedRoomId) params.set('roomId', selectedRoomId);
			const query = params.toString();
			const payload = await requestJson<CommsBootstrap>(`/api/comms${query ? `?${query}` : ''}`);
			setData(payload);

			if (!roomForm.churchId && payload.churches.length > 0) {
				setRoomForm((current) => ({ ...current, churchId: payload.churches[0].id }));
			}
			if (!dispatchForm.churchId && payload.churches.length > 0) {
				setDispatchForm((current) => ({ ...current, churchId: payload.churches[0].id }));
			}
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Failed to load comms data');
		} finally {
			setLoading(false);
		}
	}

	function clearFeedback() {
		setError(null);
		setSuccess(null);
	}

	async function handleCreateRoom(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		clearFeedback();

		if (!roomForm.name.trim()) {
			setError('Room name is required.');
			return;
		}

		try {
			const payload = await requestJson<{ room: Room }>('/api/comms', {
				method: 'POST',
				body: JSON.stringify({
					action: 'createRoom',
					idempotencyKey: createIdempotencyKey('comms-room'),
					name: roomForm.name.trim(),
					type: roomForm.type,
					churchId: roomForm.churchId || undefined,
				}),
			});

			setRoomForm((current) => ({ ...current, name: '' }));
			setSelectedRoomId(payload.room.id);
			setMessageForm((current) => ({ ...current, roomId: payload.room.id }));
			setSuccess('Room created.');
			await loadData();
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Failed to create room');
		}
	}

	async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		clearFeedback();

		if (!messageForm.roomId || !messageForm.content.trim()) {
			setError('Room and message content are required.');
			return;
		}

		try {
			await requestJson('/api/comms', {
				method: 'POST',
				body: JSON.stringify({
					action: 'sendMessage',
					idempotencyKey: createIdempotencyKey('comms-message'),
					roomId: messageForm.roomId,
					type: messageForm.type,
					content: messageForm.content.trim(),
				}),
			});
			setMessageForm((current) => ({ ...current, content: '' }));
			setSuccess('Message sent.');
			await loadData();
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Failed to send message');
		}
	}

	async function handleDispatch(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		clearFeedback();

		if (!dispatchForm.recipient.trim() || !dispatchForm.body.trim()) {
			setError('Recipient and body are required.');
			return;
		}

		try {
			await requestJson('/api/comms', {
				method: 'POST',
				body: JSON.stringify({
					action: 'dispatch',
					idempotencyKey: createIdempotencyKey('comms-dispatch'),
					channel: dispatchForm.channel,
					churchId: dispatchForm.churchId || undefined,
					recipient: dispatchForm.recipient.trim(),
					subject: dispatchForm.subject.trim() || undefined,
					body: dispatchForm.body.trim(),
					templateKey: dispatchForm.templateKey.trim() || undefined,
				}),
			});
			setDispatchForm((current) => ({
				...current,
				recipient: '',
				subject: '',
				body: '',
				templateKey: '',
			}));
			setSuccess('Dispatch request queued.');
			await loadData();
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Failed to queue dispatch');
		}
	}

	return (
		<div className="space-y-6">
			<div className="rounded-xl border border-slate-200 bg-white p-5">
				<h2 className="text-lg font-semibold text-slate-900">Comms operations</h2>
				<p className="mt-1 text-sm text-slate-600">
					Create rooms, send internal messages, and queue channel dispatches.
				</p>
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
			</div>

			<div className="grid gap-6 xl:grid-cols-2">
				<form onSubmit={handleCreateRoom} className="rounded-xl border border-slate-200 bg-white p-5">
					<h3 className="text-base font-semibold text-slate-900">Create room</h3>
					<div className="mt-4 grid gap-3">
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Room name *</span>
							<input
								value={roomForm.name}
								onChange={(event) =>
									setRoomForm((current) => ({ ...current, name: event.target.value }))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
								placeholder="Pastoral Care Follow-up"
							/>
						</label>
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Type</span>
							<input
								value={roomForm.type}
								onChange={(event) =>
									setRoomForm((current) => ({ ...current, type: event.target.value }))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							/>
						</label>
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Church</span>
							<select
								value={roomForm.churchId}
								onChange={(event) =>
									setRoomForm((current) => ({ ...current, churchId: event.target.value }))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							>
								<option value="">No church scope</option>
								{data?.churches.map((church) => (
									<option key={church.id} value={church.id}>
										{church.name}
									</option>
								))}
							</select>
						</label>
					</div>
					<button
						type="submit"
						className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
						disabled={loading}
					>
						Create room
					</button>
				</form>

				<form onSubmit={handleSendMessage} className="rounded-xl border border-slate-200 bg-white p-5">
					<h3 className="text-base font-semibold text-slate-900">Send room message</h3>
					<div className="mt-4 grid gap-3">
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Room *</span>
							<select
								value={messageForm.roomId}
								onChange={(event) => {
									setMessageForm((current) => ({ ...current, roomId: event.target.value }));
									setSelectedRoomId(event.target.value);
								}}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							>
								<option value="">Select room</option>
								{data?.rooms.items.map((room) => (
									<option key={room.id} value={room.id}>
										{room.name}
									</option>
								))}
							</select>
						</label>
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Message type</span>
							<input
								value={messageForm.type}
								onChange={(event) =>
									setMessageForm((current) => ({ ...current, type: event.target.value }))
								}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							/>
						</label>
						<label className="space-y-1 text-sm">
							<span className="text-slate-700">Content *</span>
							<textarea
								value={messageForm.content}
								onChange={(event) =>
									setMessageForm((current) => ({ ...current, content: event.target.value }))
								}
								rows={4}
								className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
								placeholder="Share the update for this room..."
							/>
						</label>
					</div>
					<button
						type="submit"
						className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
						disabled={loading}
					>
						Send message
					</button>
				</form>
			</div>

			<form onSubmit={handleDispatch} className="rounded-xl border border-slate-200 bg-white p-5">
				<h3 className="text-base font-semibold text-slate-900">Queue channel dispatch</h3>
				<div className="mt-4 grid gap-3 sm:grid-cols-2">
					<label className="space-y-1 text-sm">
						<span className="text-slate-700">Channel *</span>
						<select
							value={dispatchForm.channel}
							onChange={(event) =>
								setDispatchForm((current) => ({
									...current,
									channel: event.target.value as Channel,
								}))
							}
							className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
						>
							{channels.map((channel) => (
								<option key={channel} value={channel}>
									{channel}
								</option>
							))}
						</select>
					</label>
					<label className="space-y-1 text-sm">
						<span className="text-slate-700">Church</span>
						<select
							value={dispatchForm.churchId}
							onChange={(event) =>
								setDispatchForm((current) => ({ ...current, churchId: event.target.value }))
							}
							className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
						>
							<option value="">No church scope</option>
							{data?.churches.map((church) => (
								<option key={church.id} value={church.id}>
									{church.name}
								</option>
							))}
						</select>
					</label>
					<label className="space-y-1 text-sm">
						<span className="text-slate-700">Recipient *</span>
						<input
							value={dispatchForm.recipient}
							onChange={(event) =>
								setDispatchForm((current) => ({ ...current, recipient: event.target.value }))
							}
							className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							placeholder="user@example.com or +233..."
						/>
					</label>
					<label className="space-y-1 text-sm">
						<span className="text-slate-700">Template key</span>
						<input
							value={dispatchForm.templateKey}
							onChange={(event) =>
								setDispatchForm((current) => ({ ...current, templateKey: event.target.value }))
							}
							className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
							placeholder="welcome-series"
						/>
					</label>
					<label className="space-y-1 text-sm sm:col-span-2">
						<span className="text-slate-700">Subject</span>
						<input
							value={dispatchForm.subject}
							onChange={(event) =>
								setDispatchForm((current) => ({ ...current, subject: event.target.value }))
							}
							className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
						/>
					</label>
					<label className="space-y-1 text-sm sm:col-span-2">
						<span className="text-slate-700">Body *</span>
						<textarea
							value={dispatchForm.body}
							onChange={(event) =>
								setDispatchForm((current) => ({ ...current, body: event.target.value }))
							}
							rows={4}
							className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
						/>
					</label>
				</div>
				<button
					type="submit"
					className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
					disabled={loading}
				>
					Queue dispatch
				</button>
			</form>

			<div className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
				<div className="rounded-xl border border-slate-200 bg-white p-5">
					<div className="flex items-center justify-between">
						<h3 className="text-base font-semibold text-slate-900">Rooms</h3>
						<button
							type="button"
							onClick={() => void loadData()}
							className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
						>
							Refresh
						</button>
					</div>
					<div className="mt-3 space-y-2">
						{data?.rooms.items.length ? (
							data.rooms.items.map((room) => (
								<button
									key={room.id}
									type="button"
									onClick={() => {
										setSelectedRoomId(room.id);
										setMessageForm((current) => ({ ...current, roomId: room.id }));
									}}
									className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
										selectedRoomId === room.id
											? 'border-slate-900 bg-slate-900 text-white'
											: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
									}`}
								>
									<div className="font-medium">{room.name}</div>
									<div className={`text-xs ${selectedRoomId === room.id ? 'text-slate-200' : 'text-slate-500'}`}>
										{room.type} | {room._count?.messages ?? 0} messages
									</div>
								</button>
							))
						) : (
							<p className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
								No rooms yet.
							</p>
						)}
					</div>
				</div>

				<div className="rounded-xl border border-slate-200 bg-white p-5">
					<h3 className="text-base font-semibold text-slate-900">
						Messages {selectedRoom ? `- ${selectedRoom.name}` : ''}
					</h3>
					<div className="mt-3 space-y-3">
						{data?.messages.items.length ? (
							data.messages.items.map((message) => (
								<div key={message.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
									<div className="flex items-center justify-between gap-3">
										<div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
											{message.type}
										</div>
										<div className="text-xs text-slate-500">
											{new Date(message.createdAt).toLocaleString()}
										</div>
									</div>
									<p className="mt-2 text-sm text-slate-800">{message.content}</p>
									<div className="mt-2 text-xs text-slate-500">
										From: {message.sender?.name || message.sender?.email || message.sender?.id || 'Unknown'}
									</div>
								</div>
							))
						) : (
							<p className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
								{selectedRoom ? 'No messages yet in this room.' : 'Select a room to view messages.'}
							</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
