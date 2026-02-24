import { prisma } from '@faithflow/database';
import { appRouter } from '../apps/api/src/router';

async function run(): Promise<void> {
	const suffix = Date.now().toString(36);
	const tenant = await prisma.tenant.create({
		data: {
			name: `E2E Tenant ${suffix}`,
			domain: `e2e-payments-${suffix}.faithflow.local`,
			schemaName: `e2e_payments_${suffix}`,
			plan: 'ENTERPRISE',
			settings: {},
		},
	});

	const organization = await prisma.organization.create({
		data: {
			tenantId: tenant.id,
			name: `E2E Org ${suffix}`,
			settings: {},
		},
	});

	const church = await prisma.church.create({
		data: {
			name: `E2E Church ${suffix}`,
			slug: `e2e-payments-${suffix}`,
			timezone: 'Africa/Accra',
			organizationId: organization.id,
		},
	});

	const member = await prisma.member.create({
		data: {
			churchId: church.id,
			firstName: 'Finance',
			lastName: 'Member',
			email: `finance-${suffix}@faithflow.test`,
		},
	});

	const actor = {
		id: `e2e-finance-actor-${suffix}`,
		organizationId: organization.id,
		roles: ['ORG_ADMIN', 'FINANCE_ADMIN', 'COMMS_ADMIN'],
		type: 'USER' as const,
	};

	const caller = appRouter.createCaller({ actor });

	const paymentKey = `payment-${suffix}`;
	const payment = await caller.payment.create({
		organizationId: organization.id,
		idempotencyKey: paymentKey,
		churchId: church.id,
		memberId: member.id,
		amount: 120.5,
		currency: 'USD',
		paymentMethod: 'CARD',
		reference: `ff-ref-${suffix}`,
		description: 'E2E test payment',
		status: 'PENDING',
	});

	const duplicatePayment = await caller.payment.create({
		organizationId: organization.id,
		idempotencyKey: paymentKey,
		churchId: church.id,
		memberId: member.id,
		amount: 120.5,
		currency: 'USD',
		paymentMethod: 'CARD',
		reference: `ff-ref-${suffix}`,
		description: 'E2E test payment',
		status: 'PENDING',
	});
	if (duplicatePayment.id !== payment.id) {
		throw new Error('Payment idempotency failed.');
	}

	const completed = await caller.payment.updateStatus({
		organizationId: organization.id,
		idempotencyKey: `payment-status-${suffix}`,
		paymentId: payment.id,
		status: 'COMPLETED',
	});

	const room = await caller.comms.createRoom({
		organizationId: organization.id,
		idempotencyKey: `room-${suffix}`,
		name: 'Finance Team',
		type: 'THREAD',
		churchId: church.id,
		participantUserIds: [],
	});

	const duplicateRoom = await caller.comms.createRoom({
		organizationId: organization.id,
		idempotencyKey: `room-${suffix}`,
		name: 'Finance Team',
		type: 'THREAD',
		churchId: church.id,
		participantUserIds: [],
	});
	if (duplicateRoom.id !== room.id) {
		throw new Error('Room idempotency failed.');
	}

	const message = await caller.comms.sendMessage({
		organizationId: organization.id,
		idempotencyKey: `message-${suffix}`,
		roomId: room.id,
		content: 'Payment completed for member giving.',
		type: 'TEXT',
	});

	const duplicateMessage = await caller.comms.sendMessage({
		organizationId: organization.id,
		idempotencyKey: `message-${suffix}`,
		roomId: room.id,
		content: 'Payment completed for member giving.',
		type: 'TEXT',
	});
	if (duplicateMessage.id !== message.id) {
		throw new Error('Message idempotency failed.');
	}

	await caller.comms.dispatch({
		organizationId: organization.id,
		idempotencyKey: `dispatch-${suffix}`,
		channel: 'EMAIL',
		recipient: 'ops@faithflow.test',
		subject: 'Daily finance digest',
		body: 'Attached are daily reconciliations.',
	});

	const summary = await caller.payment.summary({
		organizationId: organization.id,
		churchId: church.id,
	});
	if (summary.completedCount < 1) {
		throw new Error('Payment summary failed to include completed payment.');
	}

	const outboxCount = await prisma.outboxEvent.count({
		where: { organizationId: organization.id },
	});
	if (outboxCount < 5) {
		throw new Error('Expected payment/comms outbox events were not queued.');
	}

	const paymentOutbox = await caller.outbox.list({
		organizationId: organization.id,
		domain: 'PAYMENT',
		limit: 25,
	});
	if (!paymentOutbox.items.length) {
		throw new Error('Expected payment outbox events in payment domain listing.');
	}

	const candidateEvent = paymentOutbox.items.find((item) => item.status !== 'PROCESSED');
	if (!candidateEvent) {
		throw new Error('Expected at least one non-processed payment outbox event for retry checks.');
	}

	await caller.outbox.deadLetter({
		organizationId: organization.id,
		domain: 'PAYMENT',
		eventId: candidateEvent.id,
		reason: 'E2E dead-letter verification',
		idempotencyKey: `outbox-dlq-${suffix}`,
	});

	const deadLetterSnapshot = await caller.outbox.list({
		organizationId: organization.id,
		domain: 'PAYMENT',
		deadLetterOnly: true,
		limit: 25,
	});
	if (!deadLetterSnapshot.items.some((item) => item.id === candidateEvent.id)) {
		throw new Error('Dead-lettered payment event not visible in dead-letter filter.');
	}

	await caller.outbox.retry({
		organizationId: organization.id,
		domain: 'PAYMENT',
		eventId: candidateEvent.id,
		idempotencyKey: `outbox-retry-${suffix}`,
	});

	const retryEvent = await prisma.outboxEvent.findUnique({
		where: { id: candidateEvent.id },
		select: { status: true, lastError: true },
	});
	if (!retryEvent || retryEvent.status !== 'PENDING' || retryEvent.lastError !== null) {
		throw new Error('Retry action did not restore event to pending state.');
	}

	const paymentProcess = await caller.outbox.process({
		organizationId: organization.id,
		domain: 'PAYMENT',
		maxEvents: 25,
	});
	const commsProcess = await caller.outbox.process({
		organizationId: organization.id,
		domain: 'COMMS',
		maxEvents: 25,
	});
	if (paymentProcess.claimed < 1) {
		throw new Error('Expected payment outbox processor to claim events.');
	}
	if (commsProcess.claimed < 1) {
		throw new Error('Expected comms outbox processor to claim events.');
	}

	const auditCount = await prisma.auditEvent.count({
		where: { organizationId: organization.id },
	});
	if (auditCount < 5) {
		throw new Error('Expected payment/comms audit events were not written.');
	}

	console.log(
		JSON.stringify(
			{
				organizationId: organization.id,
				paymentId: payment.id,
				completedStatus: completed.status,
				roomId: room.id,
				messageId: message.id,
				outboxCount,
				paymentOutboxSummary: paymentOutbox.summary,
				paymentProcessSummary: {
					claimed: paymentProcess.claimed,
					processed: paymentProcess.processed,
					failed: paymentProcess.failed,
					deadLettered: paymentProcess.deadLettered,
				},
				commsProcessSummary: {
					claimed: commsProcess.claimed,
					processed: commsProcess.processed,
					failed: commsProcess.failed,
					deadLettered: commsProcess.deadLettered,
				},
				auditCount,
			},
			null,
			2
		)
	);

	await prisma.message.deleteMany({ where: { roomId: room.id } });
	await prisma.socketRoom.delete({ where: { id: room.id } });
	await prisma.payment.delete({ where: { id: payment.id } });
	await prisma.user.deleteMany({ where: { id: actor.id } });
	await prisma.member.delete({ where: { id: member.id } });
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
