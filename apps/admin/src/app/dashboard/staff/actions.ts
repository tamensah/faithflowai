'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createOrgCaller } from '@/lib/org-caller';

type AssignmentQuickAction = 'activate' | 'suspend' | 'end';

function parseQuickAction(value: FormDataEntryValue | null): AssignmentQuickAction | null {
	if (value === 'activate' || value === 'suspend' || value === 'end') return value;
	return null;
}

export async function updateAssignmentStatusAction(formData: FormData): Promise<void> {
	const assignmentId = formData.get('assignmentId');
	const action = parseQuickAction(formData.get('action'));
	if (typeof assignmentId !== 'string' || !assignmentId || !action) return;

	const { caller, actor } = await createOrgCaller();
	const organizationId = actor.organizationId;
	const idempotencyKey = `staff-quick-${randomUUID()}`;

	if (action === 'end') {
		await caller.org.endRoleAssignment({
			organizationId,
			idempotencyKey,
			assignmentId,
			endAt: new Date(),
		});
	} else {
		await caller.org.updateRoleAssignment({
			organizationId,
			idempotencyKey,
			assignmentId,
			status: action === 'activate' ? 'ACTIVE' : 'SUSPENDED',
			endAt: action === 'activate' ? null : undefined,
			metadata: {
				source: 'admin-staff-console',
				action,
			},
		});
	}

	revalidatePath('/dashboard');
	revalidatePath('/dashboard/staff');
}
