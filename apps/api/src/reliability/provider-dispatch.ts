import { prisma } from '@faithflow/database';
import type { OutboxEvent, Prisma, Payment } from '@faithflow/database';

export type OutboxDomain = 'PAYMENT' | 'COMMS';
export const DEAD_LETTER_PREFIX = 'DEAD_LETTER:';

type JsonRecord = Record<string, unknown>;
export type DispatchResult = {
	provider: string;
	mode: 'LIVE' | 'SIMULATED' | 'INTERNAL';
	providerMessageId?: string;
	details?: Record<string, unknown>;
};

type StripeIntentResponse = {
	id: string;
	status: string;
	amount: number;
	currency: string;
};

type PaystackVerifyResponse = {
	status: boolean;
	message: string;
	data?: {
		status?: string;
		reference?: string;
		currency?: string;
	};
};

export class ProviderDispatchError extends Error {
	retryable: boolean;
	constructor(message: string, options?: { retryable?: boolean }) {
		super(message);
		this.name = 'ProviderDispatchError';
		this.retryable = options?.retryable ?? true;
	}
}

function asJsonRecord(value: unknown): JsonRecord {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return value as JsonRecord;
}

function resolveDomain(eventType: string): OutboxDomain | null {
	if (eventType.startsWith('payment.')) return 'PAYMENT';
	if (eventType.startsWith('comms.')) return 'COMMS';
	return null;
}

function providerStrictMode(): boolean {
	return process.env.FAITHFLOW_PROVIDER_STRICT_MODE === 'true';
}

function readStringEnv(name: string): string | null {
	const value = process.env[name]?.trim();
	return value ? value : null;
}

function createBasicAuth(username: string, password: string): string {
	return Buffer.from(`${username}:${password}`).toString('base64');
}

async function parseJsonResponse(response: Response): Promise<unknown> {
	const contentType = response.headers.get('content-type') ?? '';
	if (!contentType.toLowerCase().includes('application/json')) {
		return { raw: await response.text() };
	}
	return response.json().catch(() => ({}));
}

function coerceStatusFromStripe(status: string): Payment['status'] {
	switch (status) {
		case 'succeeded':
			return 'COMPLETED';
		case 'canceled':
			return 'FAILED';
		default:
			return 'PENDING';
	}
}

function coerceStatusFromPaystack(status: string): Payment['status'] {
	const normalized = status.trim().toLowerCase();
	if (normalized === 'success') return 'COMPLETED';
	if (normalized === 'failed' || normalized === 'abandoned') return 'FAILED';
	return 'PENDING';
}

function shouldProcessProviderEvent(eventType: string): boolean {
	return (
		eventType === 'payment.recorded' ||
		eventType === 'payment.status.updated' ||
		eventType === 'payment.refunded'
	);
}

function resolvePaymentProvider(payment: {
	currency: string;
	metadata: unknown;
}): 'STRIPE' | 'PAYSTACK' {
	const metadata = asJsonRecord(payment.metadata);
	const providerValue = metadata.provider;
	if (typeof providerValue === 'string') {
		const normalized = providerValue.toUpperCase();
		if (normalized === 'STRIPE' || normalized === 'PAYSTACK') return normalized;
	}

	const currency = payment.currency.toUpperCase();
	if (currency === 'USD') return 'STRIPE';

	const paystackCurrencies = new Set(
		(process.env.PAYSTACK_SUPPORTED_CURRENCIES ?? 'NGN,GHS,ZAR,KES,USD')
			.split(',')
			.map((value) => value.trim().toUpperCase())
			.filter(Boolean)
	);
	if (paystackCurrencies.has(currency)) return 'PAYSTACK';
	return 'STRIPE';
}

function resolvePaymentReference(payment: {
	reference: string;
	metadata: unknown;
}): string {
	const metadata = asJsonRecord(payment.metadata);
	const candidate = metadata.providerReference;
	return typeof candidate === 'string' && candidate.trim() ? candidate : payment.reference;
}

async function updatePaymentMetadata(
	paymentId: string,
	patch: Record<string, unknown>,
	nextStatus?: Payment['status']
): Promise<void> {
	const payment = await prisma.payment.findUnique({
		where: { id: paymentId },
		select: { metadata: true, status: true },
	});
	if (!payment) return;

	const metadata = asJsonRecord(payment.metadata);
	await prisma.payment.update({
		where: { id: paymentId },
		data: {
			status: nextStatus ?? payment.status,
			metadata: {
				...metadata,
				providerSync: {
					...(asJsonRecord(metadata.providerSync) as Record<string, unknown>),
					...patch,
					lastSyncedAt: new Date().toISOString(),
				},
			} as Prisma.InputJsonValue,
		},
	});
}

function buildSimulatedResult(provider: string, reason: string): DispatchResult {
	return {
		provider,
		mode: 'SIMULATED',
		details: { reason },
	};
}

async function verifyStripePayment(
	reference: string,
	eventId: string
): Promise<StripeIntentResponse | null> {
	const secretKey = readStringEnv('STRIPE_SECRET_KEY');
	if (!secretKey) {
		if (providerStrictMode()) {
			throw new ProviderDispatchError('Missing STRIPE_SECRET_KEY for Stripe processing.', {
				retryable: false,
			});
		}
		return null;
	}

	if (!reference.startsWith('pi_')) {
		return null;
	}

	const response = await fetch(`https://api.stripe.com/v1/payment_intents/${reference}`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${secretKey}`,
			'Idempotency-Key': `faithflow-outbox-${eventId}`,
		},
	});

	const payload = (await parseJsonResponse(response)) as StripeIntentResponse & { error?: { message?: string } };
	if (!response.ok) {
		throw new ProviderDispatchError(
			payload?.error?.message ?? `Stripe verify failed with HTTP ${response.status}.`,
			{
				retryable: response.status >= 500 || response.status === 429,
			}
		);
	}

	return payload;
}

async function refundStripePayment(reference: string, eventId: string): Promise<{ id: string } | null> {
	const secretKey = readStringEnv('STRIPE_SECRET_KEY');
	if (!secretKey) {
		if (providerStrictMode()) {
			throw new ProviderDispatchError('Missing STRIPE_SECRET_KEY for Stripe refund.', {
				retryable: false,
			});
		}
		return null;
	}

	let refundTarget: Record<string, string> | null = null;
	if (reference.startsWith('pi_')) refundTarget = { payment_intent: reference };
	if (reference.startsWith('ch_')) refundTarget = { charge: reference };
	if (!refundTarget) {
		throw new ProviderDispatchError(
			'Stripe refund requires payment_intent or charge reference (pi_/ch_).',
			{ retryable: false }
		);
	}

	const body = new URLSearchParams({
		...refundTarget,
		reason: 'requested_by_customer',
	});
	const response = await fetch('https://api.stripe.com/v1/refunds', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${secretKey}`,
			'Idempotency-Key': `faithflow-outbox-refund-${eventId}`,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: body.toString(),
	});
	const payload = (await parseJsonResponse(response)) as { id?: string; error?: { message?: string } };
	if (!response.ok) {
		throw new ProviderDispatchError(
			payload?.error?.message ?? `Stripe refund failed with HTTP ${response.status}.`,
			{
				retryable: response.status >= 500 || response.status === 429,
			}
		);
	}

	return payload.id ? { id: payload.id } : null;
}

async function verifyPaystackPayment(reference: string): Promise<PaystackVerifyResponse | null> {
	const secretKey = readStringEnv('PAYSTACK_SECRET_KEY');
	if (!secretKey) {
		if (providerStrictMode()) {
			throw new ProviderDispatchError('Missing PAYSTACK_SECRET_KEY for Paystack processing.', {
				retryable: false,
			});
		}
		return null;
	}

	const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${secretKey}`,
		},
	});

	const payload = (await parseJsonResponse(response)) as PaystackVerifyResponse;
	if (!response.ok || payload.status !== true) {
		throw new ProviderDispatchError(
			payload?.message ?? `Paystack verify failed with HTTP ${response.status}.`,
			{
				retryable: response.status >= 500 || response.status === 429,
			}
		);
	}
	return payload;
}

async function refundPaystack(reference: string): Promise<Record<string, unknown> | null> {
	const secretKey = readStringEnv('PAYSTACK_SECRET_KEY');
	if (!secretKey) {
		if (providerStrictMode()) {
			throw new ProviderDispatchError('Missing PAYSTACK_SECRET_KEY for Paystack refund.', {
				retryable: false,
			});
		}
		return null;
	}

	const response = await fetch('https://api.paystack.co/refund', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${secretKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ transaction: reference }),
	});
	const payload = (await parseJsonResponse(response)) as Record<string, unknown> & {
		status?: boolean;
		message?: string;
	};
	if (!response.ok || payload.status !== true) {
		throw new ProviderDispatchError(
			(typeof payload.message === 'string' ? payload.message : null) ??
				`Paystack refund failed with HTTP ${response.status}.`,
			{
				retryable: response.status >= 500 || response.status === 429,
			}
		);
	}
	return payload;
}

async function dispatchPaymentEvent(event: OutboxEvent): Promise<DispatchResult> {
	if (!shouldProcessProviderEvent(event.eventType)) {
		return { provider: 'PAYMENT_INTERNAL', mode: 'INTERNAL' };
	}

	const payload = asJsonRecord(event.payload);
	const paymentId = typeof payload.paymentId === 'string' ? payload.paymentId : null;
	if (!paymentId) {
		throw new ProviderDispatchError('Payment outbox payload is missing paymentId.', { retryable: false });
	}

	const payment = await prisma.payment.findUnique({
		where: { id: paymentId },
		select: {
			id: true,
			currency: true,
			status: true,
			reference: true,
			metadata: true,
			church: { select: { organizationId: true } },
		},
	});
	if (!payment || payment.church.organizationId !== event.organizationId) {
		throw new ProviderDispatchError('Payment not found for outbox processing scope.', {
			retryable: false,
		});
	}

	const provider = resolvePaymentProvider(payment);
	const reference = resolvePaymentReference(payment);

	if (provider === 'STRIPE') {
		if (event.eventType === 'payment.refunded') {
			const refund = await refundStripePayment(reference, event.id);
			if (!refund) return buildSimulatedResult('STRIPE', 'Missing Stripe credentials in non-strict mode.');
			await updatePaymentMetadata(payment.id, { provider: 'STRIPE', refundId: refund.id }, 'REFUNDED');
			return { provider: 'STRIPE', mode: 'LIVE', details: { refundId: refund.id } };
		}

		const intent = await verifyStripePayment(reference, event.id);
		if (!intent) return buildSimulatedResult('STRIPE', 'Missing Stripe credentials or non-PI reference.');
		const nextStatus = coerceStatusFromStripe(intent.status);
		await updatePaymentMetadata(payment.id, {
			provider: 'STRIPE',
			providerReference: intent.id,
			remoteStatus: intent.status,
			currency: intent.currency,
		}, nextStatus);
	return {
		provider: 'STRIPE',
		mode: 'LIVE',
		providerMessageId: intent.id,
		details: {
			providerReference: intent.id,
			remoteStatus: intent.status,
		},
	};
	}

	if (event.eventType === 'payment.refunded') {
		const refund = await refundPaystack(reference);
		if (!refund) return buildSimulatedResult('PAYSTACK', 'Missing Paystack credentials in non-strict mode.');
		await updatePaymentMetadata(payment.id, { provider: 'PAYSTACK', refund: refund }, 'REFUNDED');
		return { provider: 'PAYSTACK', mode: 'LIVE', details: { refund: true } };
	}

	const verification = await verifyPaystackPayment(reference);
	if (!verification) return buildSimulatedResult('PAYSTACK', 'Missing Paystack credentials in non-strict mode.');
	const remoteStatus = verification.data?.status ?? 'pending';
	const nextStatus = coerceStatusFromPaystack(remoteStatus);
	await updatePaymentMetadata(
		payment.id,
		{
			provider: 'PAYSTACK',
			providerReference: verification.data?.reference ?? reference,
			remoteStatus,
		},
		nextStatus
	);
	return {
		provider: 'PAYSTACK',
		mode: 'LIVE',
		providerMessageId: verification.data?.reference ?? reference,
		details: {
			providerReference: verification.data?.reference ?? reference,
			remoteStatus,
		},
	};
}

function normalizePhoneForWhatsapp(value: string): string {
	return value.startsWith('whatsapp:') ? value : `whatsapp:${value}`;
}

async function dispatchResendEmail(payload: JsonRecord, eventId: string): Promise<Record<string, unknown> | null> {
	const apiKey = readStringEnv('RESEND_API_KEY');
	const fromEmail = readStringEnv('RESEND_FROM_EMAIL');
	if (!apiKey || !fromEmail) {
		if (providerStrictMode()) {
			throw new ProviderDispatchError('Missing RESEND_API_KEY or RESEND_FROM_EMAIL for email dispatch.', {
				retryable: false,
			});
		}
		return null;
	}

	const recipient = typeof payload.recipient === 'string' ? payload.recipient : null;
	const body = typeof payload.body === 'string' ? payload.body : null;
	if (!recipient || !body) {
		throw new ProviderDispatchError('Email dispatch payload requires recipient and body.', {
			retryable: false,
		});
	}

	const subject =
		typeof payload.subject === 'string' && payload.subject.trim()
			? payload.subject.trim()
			: 'FaithFlow update';

	const response = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			'Idempotency-Key': `faithflow-outbox-${eventId}`,
		},
		body: JSON.stringify({
			from: fromEmail,
			to: [recipient],
			subject,
			text: body,
		}),
	});

	const parsed = (await parseJsonResponse(response)) as Record<string, unknown>;
	if (!response.ok) {
		throw new ProviderDispatchError(
			(typeof parsed.message === 'string' ? parsed.message : null) ??
				`Resend request failed with HTTP ${response.status}.`,
			{
				retryable: response.status >= 500 || response.status === 429,
			}
		);
	}
	return parsed;
}

async function dispatchTwilioMessage(
	payload: JsonRecord,
	channel: 'SMS' | 'WHATSAPP'
): Promise<Record<string, unknown> | null> {
	const accountSid = readStringEnv('TWILIO_ACCOUNT_SID');
	const authToken = readStringEnv('TWILIO_AUTH_TOKEN');
	const fromSms = readStringEnv('TWILIO_PHONE_NUMBER');
	const fromWhatsapp = readStringEnv('TWILIO_WHATSAPP_NUMBER');
	if (!accountSid || !authToken || !fromSms) {
		if (providerStrictMode()) {
			throw new ProviderDispatchError(
				'Missing Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER).',
				{ retryable: false }
			);
		}
		return null;
	}

	const recipient = typeof payload.recipient === 'string' ? payload.recipient : null;
	const body = typeof payload.body === 'string' ? payload.body : null;
	if (!recipient || !body) {
		throw new ProviderDispatchError('Twilio dispatch payload requires recipient and body.', {
			retryable: false,
		});
	}

	const to = channel === 'WHATSAPP' ? normalizePhoneForWhatsapp(recipient) : recipient;
	const from = channel === 'WHATSAPP' ? normalizePhoneForWhatsapp(fromWhatsapp ?? fromSms) : fromSms;

	const form = new URLSearchParams({
		To: to,
		From: from,
		Body: body,
	});

	const response = await fetch(
		`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
		{
			method: 'POST',
			headers: {
				Authorization: `Basic ${createBasicAuth(accountSid, authToken)}`,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: form.toString(),
		}
	);

	const parsed = (await parseJsonResponse(response)) as Record<string, unknown> & {
		message?: string;
	};
	if (!response.ok) {
		throw new ProviderDispatchError(
			(typeof parsed.message === 'string' ? parsed.message : null) ??
				`Twilio request failed with HTTP ${response.status}.`,
			{
				retryable: response.status >= 500 || response.status === 429,
			}
		);
	}
	return parsed;
}

async function dispatchCommsEvent(event: OutboxEvent): Promise<DispatchResult> {
	if (event.eventType !== 'comms.dispatch.requested') {
		return { provider: 'COMMS_INTERNAL', mode: 'INTERNAL' };
	}

	const payload = asJsonRecord(event.payload);
	const channel = typeof payload.channel === 'string' ? payload.channel.toUpperCase() : null;

	if (channel === 'EMAIL') {
		const result = await dispatchResendEmail(payload, event.id);
		if (!result) return buildSimulatedResult('RESEND', 'Missing email provider credentials in non-strict mode.');
	return {
		provider: 'RESEND',
		mode: 'LIVE',
		providerMessageId: typeof result.id === 'string' ? result.id : undefined,
		details: { emailId: result.id },
	};
	}

	if (channel === 'SMS' || channel === 'WHATSAPP') {
		const result = await dispatchTwilioMessage(payload, channel);
		if (!result) return buildSimulatedResult('TWILIO', 'Missing Twilio credentials in non-strict mode.');
	return {
		provider: 'TWILIO',
		mode: 'LIVE',
		providerMessageId: typeof result.sid === 'string' ? result.sid : undefined,
		details: { messageSid: result.sid, channel },
	};
	}

	if (channel === 'PUSH') {
		if (providerStrictMode()) {
			throw new ProviderDispatchError('Push dispatch provider is not configured yet.', {
				retryable: false,
			});
		}
		return buildSimulatedResult('PUSH', 'Push provider not configured.');
	}

	throw new ProviderDispatchError('Unsupported comms channel.', { retryable: false });
}

export async function dispatchOutboxEvent(
	event: OutboxEvent
): Promise<{ domain: OutboxDomain; result: DispatchResult }> {
	const domain = resolveDomain(event.eventType);
	if (!domain) {
		throw new ProviderDispatchError(`Unsupported outbox event type: ${event.eventType}`, {
			retryable: false,
		});
	}

	if (domain === 'PAYMENT') {
		const result = await dispatchPaymentEvent(event);
		return { domain, result };
	}
	const result = await dispatchCommsEvent(event);
	return { domain, result };
}
