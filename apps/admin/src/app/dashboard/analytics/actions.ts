'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@faithflow/database';
import { createAppCaller } from '@/lib/app-caller';

export async function markInsightReviewedAction(formData: FormData): Promise<void> {
	const insightKey = formData.get('insightKey');
	const insightTitle = formData.get('insightTitle');
	const insightLevel = formData.get('insightLevel');
	if (typeof insightKey !== 'string' || !insightKey.trim()) return;
	if (typeof insightTitle !== 'string' || !insightTitle.trim()) return;

	const { actor } = await createAppCaller();
	await prisma.auditEvent.create({
		data: {
			organizationId: actor.organizationId,
			actorId: actor.id,
			actorType: actor.type,
			actorRoles: actor.roles,
			action: 'AI_INSIGHT_REVIEWED',
			entityType: 'AiInsight',
			entityId: insightKey.trim(),
			result: 'SUCCESS',
			metadata: {
				insightKey: insightKey.trim(),
				insightTitle: insightTitle.trim(),
				insightLevel: typeof insightLevel === 'string' ? insightLevel : null,
			},
		},
	});

	revalidatePath('/dashboard/analytics');
}
