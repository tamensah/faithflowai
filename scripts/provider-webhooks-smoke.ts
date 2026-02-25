import { createHmac } from 'crypto';
import { prisma } from '@faithflow/database';
import {
	handlePaystackWebhook,
	handleResendWebhook,
	handleStripeWebhook,
	handleTwilioWebhook,
} from '../apps/api/src/reliability/provider-webhooks';

function toStripeSignatureHeader(rawBody: string, secret: string): string {
	const timestamp = Math.floor(Date.now() / 1000);
	const signature = createHmac('sha256', secret)
		.update(`${timestamp}.${rawBody}`)
		.digest('hex');
	return `t=${timestamp},v1=${signature}`;
}

function toPaystackSignature(rawBody: string, secret: string): string {
	return createHmac('sha512', secret).update(rawBody).digest('hex');
}

function toSvixHeaders(rawBody: string, secret: string): Headers {
	const svixId = `msg_${Date.now()}`;
	const svixTimestamp = `${Math.floor(Date.now() / 1000)}`;
	const normalizedSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
	const key = Buffer.from(normalizedSecret, 'base64');
	const signature = createHmac('sha256', key)
		.update(`${svixId}.${svixTimestamp}.${rawBody}`)
		.digest('base64');

	const headers = new Headers();
	headers.set('svix-id', svixId);
	headers.set('svix-timestamp', svixTimestamp);
	headers.set('svix-signature', `v1,${signature}`);
	return headers;
}

function toTwilioSignature(rawBody: string, url: string, token: string): string {
	const params = new URLSearchParams(rawBody);
	const grouped: Record<string, string[]> = {};
	for (const [key, value] of params.entries()) {
		if (!grouped[key]) grouped[key] = [];
		grouped[key].push(value);
	}
	const sortedKeys = Object.keys(grouped).sort();
	let data = url;
	for (const key of sortedKeys) {
		for (const value of grouped[key]) {
			data += `${key}${value}`;
		}
	}
	return createHmac('sha1', token).update(data).digest('base64');
}

async function run() {
	const suffix = Date.now().toString(36);

	process.env.STRIPE_WEBHOOK_SECRET = 'whsec_stripe_test_secret';
	process.env.PAYSTACK_SECRET_KEY = 'sk_test_paystack_secret';
	process.env.RESEND_WEBHOOK_SECRET = `whsec_${Buffer.from('resend_webhook_secret').toString('base64')}`;
	process.env.TWILIO_AUTH_TOKEN = 'twilio_auth_token_test';
	process.env.FAITHFLOW_ALLOW_UNSIGNED_WEBHOOKS = 'false';

	const tenant = await prisma.tenant.create({
		data: {
			name: `Webhook Tenant ${suffix}`,
			domain: `webhook-${suffix}.faithflow.local`,
			schemaName: `webhook_${suffix}`,
			plan: 'ENTERPRISE',
			settings: {
				addons: {
					entitlements: {
						FACILITIES_SUITE: {
							code: 'FACILITIES_SUITE',
							enabled: true,
							source: 'MANUAL',
							billingReference: null,
							activatedAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
						},
					},
				},
			},
		},
	});
	const organization = await prisma.organization.create({
		data: {
			tenantId: tenant.id,
			name: `Webhook Org ${suffix}`,
			settings: {},
		},
	});
	const church = await prisma.church.create({
		data: {
			name: `Webhook Church ${suffix}`,
			slug: `webhook-${suffix}`,
			timezone: 'Africa/Accra',
			organizationId: organization.id,
		},
	});

	const stripePayment = await prisma.payment.create({
		data: {
			churchId: church.id,
			amount: '55',
			currency: 'USD',
			status: 'PENDING',
			paymentMethod: 'CARD',
			reference: `pi_${suffix}`,
			description: 'Webhook stripe payment',
			metadata: {
				provider: 'STRIPE',
				providerReference: `pi_${suffix}`,
				addonCode: 'STREAMING_SUITE',
			},
		},
	});
	const paystackPayment = await prisma.payment.create({
		data: {
			churchId: church.id,
			amount: '80',
			currency: 'GHS',
			status: 'PENDING',
			paymentMethod: 'MOBILE_MONEY',
			reference: `pst_ref_${suffix}`,
			description: 'Webhook paystack payment',
			metadata: {
				provider: 'PAYSTACK',
				providerReference: `pst_ref_${suffix}`,
				addonCode: 'FACILITIES_SUITE',
			},
		},
	});

	const resendOutbox = await prisma.outboxEvent.create({
		data: {
			organizationId: organization.id,
			aggregateType: 'CommsDispatch',
			eventType: 'comms.dispatch.requested',
			status: 'PROCESSED',
			payload: {
				channel: 'EMAIL',
				recipient: 'member@example.com',
				body: 'Welcome',
				_dispatch: {
					provider: 'RESEND',
					mode: 'LIVE',
					providerMessageId: `re_msg_${suffix}`,
				},
			},
		},
	});

	const twilioOutbox = await prisma.outboxEvent.create({
		data: {
			organizationId: organization.id,
			aggregateType: 'CommsDispatch',
			eventType: 'comms.dispatch.requested',
			status: 'PROCESSED',
			payload: {
				channel: 'SMS',
				recipient: '+15550001111',
				body: 'Schedule changed',
				_dispatch: {
					provider: 'TWILIO',
					mode: 'LIVE',
					providerMessageId: `SM${suffix}`,
				},
			},
		},
	});

	const stripeBody = JSON.stringify({
		id: `evt_${suffix}`,
		type: 'payment_intent.succeeded',
		data: { object: { id: `pi_${suffix}` } },
	});
	await handleStripeWebhook(
		stripeBody,
		toStripeSignatureHeader(stripeBody, process.env.STRIPE_WEBHOOK_SECRET!)
	);

	const paystackBody = JSON.stringify({
		event: 'charge.failed',
		data: { id: `evt_paystack_${suffix}`, reference: `pst_ref_${suffix}` },
	});
	await handlePaystackWebhook(
		paystackBody,
		toPaystackSignature(paystackBody, process.env.PAYSTACK_SECRET_KEY!)
	);

	const resendBody = JSON.stringify({
		type: 'email.delivered',
		created_at: new Date().toISOString(),
		data: { email_id: `re_msg_${suffix}` },
	});
	await handleResendWebhook(
		resendBody,
		toSvixHeaders(resendBody, process.env.RESEND_WEBHOOK_SECRET!)
	);

	const twilioRaw = new URLSearchParams({
		MessageSid: `SM${suffix}`,
		MessageStatus: 'undelivered',
		ErrorCode: '30003',
		ErrorMessage: 'Unknown destination handset',
	}).toString();
	const twilioUrl = 'https://admin.example.com/api/webhooks/twilio';
	await handleTwilioWebhook(
		twilioRaw,
		twilioUrl,
		toTwilioSignature(twilioRaw, twilioUrl, process.env.TWILIO_AUTH_TOKEN!)
	);

	const [stripeUpdated, paystackUpdated, resendUpdated, twilioUpdated, tenantUpdated, auditCount] = await Promise.all([
		prisma.payment.findUnique({ where: { id: stripePayment.id }, select: { status: true } }),
		prisma.payment.findUnique({ where: { id: paystackPayment.id }, select: { status: true } }),
		prisma.outboxEvent.findUnique({ where: { id: resendOutbox.id }, select: { status: true, payload: true } }),
		prisma.outboxEvent.findUnique({
			where: { id: twilioOutbox.id },
			select: { status: true, lastError: true, payload: true },
		}),
		prisma.tenant.findUnique({ where: { id: tenant.id }, select: { settings: true } }),
		prisma.auditEvent.count({ where: { organizationId: organization.id } }),
	]);

	if (stripeUpdated?.status !== 'COMPLETED') {
		throw new Error('Stripe webhook did not reconcile payment to COMPLETED.');
	}
	if (paystackUpdated?.status !== 'FAILED') {
		throw new Error('Paystack webhook did not reconcile payment to FAILED.');
	}
	if (resendUpdated?.status !== 'PROCESSED') {
		throw new Error('Resend webhook did not keep outbox event as PROCESSED.');
	}
	if (twilioUpdated?.status !== 'FAILED' || !twilioUpdated.lastError?.startsWith('DEAD_LETTER:')) {
		throw new Error('Twilio failure webhook did not move outbox event to failed dead-letter state.');
	}
	const entitlements = ((tenantUpdated?.settings as Record<string, unknown> | undefined)?.addons as
		| Record<string, unknown>
		| undefined)?.entitlements as Record<string, { enabled?: boolean }> | undefined;
	if (entitlements?.STREAMING_SUITE?.enabled !== true) {
		throw new Error('Stripe webhook did not enable STREAMING_SUITE entitlement.');
	}
	if (entitlements?.FACILITIES_SUITE?.enabled !== false) {
		throw new Error('Paystack failed webhook did not disable FACILITIES_SUITE entitlement.');
	}
	if (auditCount < 6) {
		throw new Error('Expected webhook audit records were not generated.');
	}

	console.log(
		JSON.stringify(
			{
				organizationId: organization.id,
				stripeStatus: stripeUpdated.status,
				paystackStatus: paystackUpdated.status,
				streamingEntitled: entitlements?.STREAMING_SUITE?.enabled ?? null,
				facilitiesEntitled: entitlements?.FACILITIES_SUITE?.enabled ?? null,
				resendStatus: resendUpdated.status,
				twilioStatus: twilioUpdated.status,
				auditCount,
			},
			null,
			2
		)
	);

	await prisma.outboxEvent.deleteMany({ where: { organizationId: organization.id } });
	await prisma.auditEvent.deleteMany({ where: { organizationId: organization.id } });
	await prisma.payment.deleteMany({ where: { churchId: church.id } });
	await prisma.church.delete({ where: { id: church.id } });
	await prisma.organization.delete({ where: { id: organization.id } });
	await prisma.tenant.delete({ where: { id: tenant.id } });
}

run()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
