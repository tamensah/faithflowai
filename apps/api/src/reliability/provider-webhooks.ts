import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@faithflow/database';
import type { Prisma } from '@faithflow/database';
import {
	resolveAddonCodeFromPaymentContext,
	syncAddonEntitlementFromBillingOutcome,
} from './addon-entitlements';

export class WebhookValidationError extends Error {
	status: number;
	constructor(message: string, status = 400) {
		super(message);
		this.name = 'WebhookValidationError';
		this.status = status;
	}
}

type StripeEventPayload = {
	id: string;
	type: string;
	data?: {
		object?: Record<string, unknown>;
	};
};

type PaystackEventPayload = {
	event?: string;
	data?: Record<string, unknown>;
};

type ResendEventPayload = {
	type?: string;
	data?: Record<string, unknown>;
	created_at?: string;
};

type TwilioEventPayload = {
	MessageSid?: string;
	MessageStatus?: string;
	ErrorCode?: string;
	ErrorMessage?: string;
	To?: string;
	From?: string;
};

type PaymentWebhookStatus = 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PENDING';

const WEBHOOK_TOLERANCE_SECONDS = Number(process.env.FAITHFLOW_WEBHOOK_TOLERANCE_SECONDS ?? '300');
const WEBHOOK_ACTOR_ROLE = ['INTEGRATION'];
const DEAD_LETTER_PREFIX = 'DEAD_LETTER:';

function getEnv(name: string): string | null {
	const value = process.env[name]?.trim();
	return value ? value : null;
}

function allowUnsignedWebhooks(): boolean {
	return process.env.FAITHFLOW_ALLOW_UNSIGNED_WEBHOOKS === 'true';
}

function parseJson<T>(rawBody: string): T {
	try {
		return JSON.parse(rawBody) as T;
	} catch {
		throw new WebhookValidationError('Webhook body is not valid JSON.');
	}
}

function safeEquals(a: string, b: string): boolean {
	const left = Buffer.from(a);
	const right = Buffer.from(b);
	if (left.length !== right.length) return false;
	return timingSafeEqual(left, right);
}

function assertRecentTimestamp(timestampSeconds: number): void {
	const nowSeconds = Math.floor(Date.now() / 1000);
	if (Math.abs(nowSeconds - timestampSeconds) > WEBHOOK_TOLERANCE_SECONDS) {
		throw new WebhookValidationError('Webhook timestamp is outside allowed tolerance.');
	}
}

function asRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function reconcilePaymentFromWebhook(input: {
	provider: 'STRIPE' | 'PAYSTACK';
	providerEventId: string;
	eventType: string;
	providerReference: string;
	status: PaymentWebhookStatus;
	payload: Record<string, unknown>;
}) {
	const payment = await prisma.payment.findFirst({
		where: {
			OR: [
				{ reference: input.providerReference },
				{
					metadata: {
						path: ['providerReference'],
						equals: input.providerReference,
					},
				},
				{
					metadata: {
						path: ['providerSync', 'providerReference'],
						equals: input.providerReference,
					},
				},
			],
		},
		include: {
			church: { select: { organizationId: true } },
		},
	});

	if (!payment) {
		return {
			handled: false,
			reason: 'payment_not_found',
			providerReference: input.providerReference,
		};
	}

	const metadata = asRecord(payment.metadata);
	const providerSync = asRecord(metadata.providerSync);

	if (providerSync.lastWebhookEventId === input.providerEventId) {
		return {
			handled: true,
			duplicate: true,
			paymentId: payment.id,
			status: payment.status,
		};
	}

	const resolvedAddonCode = resolveAddonCodeFromPaymentContext({
		paymentMetadata: metadata,
		providerPayload: input.payload,
	});

	const updated = await prisma.payment.update({
		where: { id: payment.id },
		data: {
			status: input.status,
			metadata: {
				...metadata,
				...(resolvedAddonCode ? { addonCode: resolvedAddonCode } : {}),
				provider: input.provider,
				providerSync: {
					...providerSync,
					providerReference: input.providerReference,
					lastWebhookEventId: input.providerEventId,
					lastWebhookType: input.eventType,
					lastWebhookAt: new Date().toISOString(),
					providerStatus: input.status,
				},
			} as Prisma.InputJsonValue,
		},
	});

	const addonSync = await syncAddonEntitlementFromBillingOutcome({
		organizationId: payment.church.organizationId,
		addonCode: resolvedAddonCode,
		provider: input.provider,
		paymentStatus: input.status,
		providerReference: input.providerReference,
		providerEventId: input.providerEventId,
		eventType: input.eventType,
		paymentId: updated.id,
		actorId: `webhook:${input.provider.toLowerCase()}`,
		actorType: 'INTEGRATION',
	});

	await prisma.auditEvent.create({
		data: {
			organizationId: payment.church.organizationId,
			actorId: `webhook:${input.provider.toLowerCase()}`,
			actorType: 'INTEGRATION',
			actorRoles: WEBHOOK_ACTOR_ROLE,
			action: 'PAYMENT_PROVIDER_WEBHOOK',
			entityType: 'Payment',
			entityId: updated.id,
			result: 'SUCCESS',
			metadata: {
				provider: input.provider,
				eventType: input.eventType,
				providerEventId: input.providerEventId,
				providerReference: input.providerReference,
				status: input.status,
			},
		},
	});

	await prisma.outboxEvent.create({
		data: {
			organizationId: payment.church.organizationId,
			aggregateType: 'Payment',
			aggregateId: updated.id,
			eventType: 'payment.provider.reconciled',
			payload: {
				paymentId: updated.id,
				provider: input.provider,
				providerEventId: input.providerEventId,
				eventType: input.eventType,
				status: updated.status,
			} as Prisma.InputJsonValue,
		},
	});

	return {
		handled: true,
		duplicate: false,
		paymentId: updated.id,
		status: updated.status,
		addonSync,
	};
}

async function updateCommsDeliveryFromWebhook(input: {
	provider: 'RESEND' | 'TWILIO';
	providerEventId: string;
	deliveryState: 'DELIVERED' | 'PROCESSING' | 'FAILED';
	providerMessageId: string;
	reason?: string;
	payload: Record<string, unknown>;
}) {
	const event = await prisma.outboxEvent.findFirst({
		where: {
			eventType: 'comms.dispatch.requested',
			payload: {
				path: ['_dispatch', 'providerMessageId'],
				equals: input.providerMessageId,
			},
		},
		orderBy: { createdAt: 'desc' },
	});

	if (!event) {
		return {
			handled: false,
			reason: 'dispatch_not_found',
			providerMessageId: input.providerMessageId,
		};
	}

	const currentPayload = asRecord(event.payload);
	const dispatch = asRecord(currentPayload._dispatch);
	const nextPayload = toInputJson({
		...currentPayload,
		_dispatch: dispatch,
		_delivery: {
			provider: input.provider,
			providerMessageId: input.providerMessageId,
			providerEventId: input.providerEventId,
			state: input.deliveryState,
			reason: input.reason ?? null,
			updatedAt: new Date().toISOString(),
		},
	});

	const failed = input.deliveryState === 'FAILED';
	const nextStatus = failed ? 'FAILED' : 'PROCESSED';
	const lastError = failed ? `${DEAD_LETTER_PREFIX} Delivery failure: ${input.reason ?? 'unknown'}` : null;

	await prisma.outboxEvent.update({
		where: { id: event.id },
		data: {
			status: nextStatus,
			lastError,
			payload: nextPayload,
			availableAt: failed ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10) : event.availableAt,
		},
	});

	await prisma.auditEvent.create({
		data: {
			organizationId: event.organizationId,
			actorId: `webhook:${input.provider.toLowerCase()}`,
			actorType: 'INTEGRATION',
			actorRoles: WEBHOOK_ACTOR_ROLE,
			action: 'COMMS_PROVIDER_WEBHOOK',
			entityType: 'OutboxEvent',
			entityId: event.id,
			result: 'SUCCESS',
			metadata: {
				provider: input.provider,
				providerEventId: input.providerEventId,
				providerMessageId: input.providerMessageId,
				deliveryState: input.deliveryState,
				reason: input.reason ?? null,
			},
		},
	});

	return {
		handled: true,
		outboxEventId: event.id,
		deliveryState: input.deliveryState,
	};
}

function verifyStripeSignature(rawBody: string, header: string | null): void {
	const secret = getEnv('STRIPE_WEBHOOK_SECRET');
	if (!secret) {
		if (!allowUnsignedWebhooks()) {
			throw new WebhookValidationError('Missing STRIPE_WEBHOOK_SECRET for Stripe webhook validation.', 500);
		}
		return;
	}

	if (!header) {
		throw new WebhookValidationError('Missing Stripe signature header.');
	}

	const pairs = header.split(',').map((token) => token.trim());
	const timestamp = pairs.find((token) => token.startsWith('t='))?.slice(2);
	const signatures = pairs
		.filter((token) => token.startsWith('v1='))
		.map((token) => token.slice(3))
		.filter(Boolean);

	if (!timestamp || !signatures.length) {
		throw new WebhookValidationError('Malformed Stripe signature header.');
	}

	const timestampNumber = Number(timestamp);
	if (!Number.isFinite(timestampNumber)) {
		throw new WebhookValidationError('Invalid Stripe webhook timestamp.');
	}
	assertRecentTimestamp(timestampNumber);

	const signedPayload = `${timestamp}.${rawBody}`;
	const expectedSignature = createHmac('sha256', secret).update(signedPayload).digest('hex');
	const matches = signatures.some((signature) => safeEquals(expectedSignature, signature));
	if (!matches) {
		throw new WebhookValidationError('Stripe signature verification failed.');
	}
}

function verifyPaystackSignature(rawBody: string, header: string | null): void {
	const secret = getEnv('PAYSTACK_SECRET_KEY');
	if (!secret) {
		if (!allowUnsignedWebhooks()) {
			throw new WebhookValidationError(
				'Missing PAYSTACK_SECRET_KEY for Paystack webhook validation.',
				500
			);
		}
		return;
	}
	if (!header) {
		throw new WebhookValidationError('Missing Paystack signature header.');
	}

	const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
	if (!safeEquals(expected, header)) {
		throw new WebhookValidationError('Paystack signature verification failed.');
	}
}

function verifyResendSignature(rawBody: string, headers: Headers): void {
	const secret = getEnv('RESEND_WEBHOOK_SECRET');
	if (!secret) {
		if (!allowUnsignedWebhooks()) {
			throw new WebhookValidationError(
				'Missing RESEND_WEBHOOK_SECRET for Resend webhook validation.',
				500
			);
		}
		return;
	}

	const svixId = headers.get('svix-id');
	const svixTimestamp = headers.get('svix-timestamp');
	const svixSignature = headers.get('svix-signature');
	if (!svixId || !svixTimestamp || !svixSignature) {
		throw new WebhookValidationError('Missing Svix headers for Resend webhook.');
	}

	const timestampNumber = Number(svixTimestamp);
	if (!Number.isFinite(timestampNumber)) {
		throw new WebhookValidationError('Invalid Resend webhook timestamp.');
	}
	assertRecentTimestamp(timestampNumber);

	const normalizedSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
	const key = Buffer.from(normalizedSecret, 'base64');
	const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`;
	const expected = createHmac('sha256', key).update(signedPayload).digest('base64');
	const signatures = svixSignature
		.split(' ')
		.map((entry) => entry.trim())
		.map((entry) => (entry.startsWith('v1,') ? entry.slice(3) : entry))
		.filter(Boolean);

	const matches = signatures.some((entry) => safeEquals(entry, expected));
	if (!matches) {
		throw new WebhookValidationError('Resend webhook signature verification failed.');
	}
}

function verifyTwilioSignature(rawBody: string, requestUrl: string, header: string | null): void {
	const token = getEnv('TWILIO_AUTH_TOKEN');
	if (!token) {
		if (!allowUnsignedWebhooks()) {
			throw new WebhookValidationError('Missing TWILIO_AUTH_TOKEN for Twilio webhook validation.', 500);
		}
		return;
	}
	if (!header) {
		throw new WebhookValidationError('Missing Twilio signature header.');
	}

	const params = new URLSearchParams(rawBody);
	const grouped: Record<string, string[]> = {};
	params.forEach((value, key) => {
		if (!grouped[key]) grouped[key] = [];
		grouped[key].push(value);
	});
	const sortedKeys = Object.keys(grouped).sort();
	let data = requestUrl;
	for (const key of sortedKeys) {
		for (const value of grouped[key]) {
			data += `${key}${value}`;
		}
	}

	const expected = createHmac('sha1', token).update(data).digest('base64');
	if (!safeEquals(expected, header)) {
		throw new WebhookValidationError('Twilio signature verification failed.');
	}
}

export async function handleStripeWebhook(rawBody: string, signatureHeader: string | null) {
	verifyStripeSignature(rawBody, signatureHeader);

	const payload = parseJson<StripeEventPayload>(rawBody);
	const eventType = payload.type;
	const object = asRecord(payload.data?.object);

	if (eventType === 'payment_intent.succeeded') {
		const reference = typeof object.id === 'string' ? object.id : null;
		if (!reference) throw new WebhookValidationError('Stripe payload missing payment intent id.');
		return reconcilePaymentFromWebhook({
			provider: 'STRIPE',
			providerEventId: payload.id,
			eventType,
			providerReference: reference,
			status: 'COMPLETED',
			payload: asRecord(payload),
		});
	}

	if (eventType === 'payment_intent.payment_failed' || eventType === 'payment_intent.canceled') {
		const reference = typeof object.id === 'string' ? object.id : null;
		if (!reference) throw new WebhookValidationError('Stripe payload missing payment intent id.');
		return reconcilePaymentFromWebhook({
			provider: 'STRIPE',
			providerEventId: payload.id,
			eventType,
			providerReference: reference,
			status: 'FAILED',
			payload: asRecord(payload),
		});
	}

	if (eventType === 'charge.refunded') {
		const reference =
			typeof object.payment_intent === 'string'
				? object.payment_intent
				: typeof object.id === 'string'
					? object.id
					: null;
		if (!reference) throw new WebhookValidationError('Stripe refund payload missing reference.');
		return reconcilePaymentFromWebhook({
			provider: 'STRIPE',
			providerEventId: payload.id,
			eventType,
			providerReference: reference,
			status: 'REFUNDED',
			payload: asRecord(payload),
		});
	}

	return { handled: false, reason: 'unsupported_event', eventType };
}

export async function handlePaystackWebhook(rawBody: string, signatureHeader: string | null) {
	verifyPaystackSignature(rawBody, signatureHeader);
	const payload = parseJson<PaystackEventPayload>(rawBody);

	const eventType = (payload.event ?? '').toLowerCase();
	const reference =
		typeof payload.data?.reference === 'string'
			? payload.data.reference
			: typeof payload.data?.transaction === 'string'
				? payload.data.transaction
				: null;

	if (!reference) {
		return { handled: false, reason: 'missing_reference', eventType: payload.event ?? 'unknown' };
	}

	if (eventType === 'charge.success') {
		return reconcilePaymentFromWebhook({
			provider: 'PAYSTACK',
			providerEventId: String(payload.data?.id ?? payload.event ?? Date.now()),
			eventType: payload.event ?? 'charge.success',
			providerReference: reference,
			status: 'COMPLETED',
			payload: asRecord(payload),
		});
	}

	if (eventType === 'charge.failed') {
		return reconcilePaymentFromWebhook({
			provider: 'PAYSTACK',
			providerEventId: String(payload.data?.id ?? payload.event ?? Date.now()),
			eventType: payload.event ?? 'charge.failed',
			providerReference: reference,
			status: 'FAILED',
			payload: asRecord(payload),
		});
	}

	if (eventType === 'refund.processed' || eventType === 'refund.successful') {
		return reconcilePaymentFromWebhook({
			provider: 'PAYSTACK',
			providerEventId: String(payload.data?.id ?? payload.event ?? Date.now()),
			eventType: payload.event ?? 'refund.processed',
			providerReference: reference,
			status: 'REFUNDED',
			payload: asRecord(payload),
		});
	}

	return { handled: false, reason: 'unsupported_event', eventType: payload.event ?? 'unknown' };
}

export async function handleResendWebhook(rawBody: string, headers: Headers) {
	verifyResendSignature(rawBody, headers);
	const payload = parseJson<ResendEventPayload>(rawBody);
	const eventType = payload.type?.toLowerCase() ?? 'unknown';
	const messageId =
		typeof payload.data?.email_id === 'string'
			? payload.data.email_id
			: typeof payload.data?.id === 'string'
				? payload.data.id
				: null;

	if (!messageId) {
		return { handled: false, reason: 'missing_message_id', eventType };
	}

	if (eventType.includes('delivered') || eventType.includes('opened') || eventType.includes('clicked')) {
		return updateCommsDeliveryFromWebhook({
			provider: 'RESEND',
			providerEventId: `${eventType}:${payload.created_at ?? Date.now().toString()}`,
			deliveryState: 'DELIVERED',
			providerMessageId: messageId,
			payload: asRecord(payload),
		});
	}

	if (eventType.includes('failed') || eventType.includes('bounced') || eventType.includes('complained')) {
		return updateCommsDeliveryFromWebhook({
			provider: 'RESEND',
			providerEventId: `${eventType}:${payload.created_at ?? Date.now().toString()}`,
			deliveryState: 'FAILED',
			providerMessageId: messageId,
			reason: payload.type ?? 'delivery failure',
			payload: asRecord(payload),
		});
	}

	return updateCommsDeliveryFromWebhook({
		provider: 'RESEND',
		providerEventId: `${eventType}:${payload.created_at ?? Date.now().toString()}`,
		deliveryState: 'PROCESSING',
		providerMessageId: messageId,
		payload: asRecord(payload),
	});
}

export async function handleTwilioWebhook(rawBody: string, requestUrl: string, signatureHeader: string | null) {
	verifyTwilioSignature(rawBody, requestUrl, signatureHeader);

	const form = new URLSearchParams(rawBody);
	const payload: TwilioEventPayload = {
		MessageSid: form.get('MessageSid') ?? undefined,
		MessageStatus: form.get('MessageStatus') ?? undefined,
		ErrorCode: form.get('ErrorCode') ?? undefined,
		ErrorMessage: form.get('ErrorMessage') ?? undefined,
		To: form.get('To') ?? undefined,
		From: form.get('From') ?? undefined,
	};

	if (!payload.MessageSid) {
		return { handled: false, reason: 'missing_message_sid' };
	}

	const status = (payload.MessageStatus ?? '').toLowerCase();
	if (status === 'delivered' || status === 'sent' || status === 'read') {
		return updateCommsDeliveryFromWebhook({
			provider: 'TWILIO',
			providerEventId: `${payload.MessageSid}:${status || 'delivered'}`,
			deliveryState: 'DELIVERED',
			providerMessageId: payload.MessageSid,
			payload: asRecord(payload),
		});
	}

	if (status === 'failed' || status === 'undelivered') {
		return updateCommsDeliveryFromWebhook({
			provider: 'TWILIO',
			providerEventId: `${payload.MessageSid}:${status}`,
			deliveryState: 'FAILED',
			providerMessageId: payload.MessageSid,
			reason: payload.ErrorMessage || payload.ErrorCode || status,
			payload: asRecord(payload),
		});
	}

	return updateCommsDeliveryFromWebhook({
		provider: 'TWILIO',
		providerEventId: `${payload.MessageSid}:${status || 'processing'}`,
		deliveryState: 'PROCESSING',
		providerMessageId: payload.MessageSid,
		payload: asRecord(payload),
	});
}
