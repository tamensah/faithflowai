import type { Prisma } from '@faithflow/database';

export type OutboxMutationEvent = {
	aggregateType: string;
	aggregateId?: string | null;
	eventType: string;
	payload: Record<string, unknown>;
	availableAt?: Date;
};

export async function enqueueOutboxEvents(
	tx: Prisma.TransactionClient,
	organizationId: string,
	events: OutboxMutationEvent[] | undefined
): Promise<void> {
	if (!events?.length) return;

	for (const event of events) {
		await tx.outboxEvent.create({
			data: {
				organizationId,
				aggregateType: event.aggregateType,
				aggregateId: event.aggregateId ?? undefined,
				eventType: event.eventType,
				payload: event.payload as Prisma.InputJsonValue,
				availableAt: event.availableAt ?? new Date(),
			},
		});
	}
}
