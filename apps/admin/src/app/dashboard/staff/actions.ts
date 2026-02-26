'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createOrgCaller } from '@/lib/org-caller';

type AssignmentQuickAction = 'activate' | 'suspend' | 'end';

function parseQuickAction(value: FormDataEntryValue | null): AssignmentQuickAction | null {
	if (value === 'activate' || value === 'suspend' || value === 'end') return value;
	return null;
}

function parseOptionalDate(value: FormDataEntryValue | null): Date | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	const parsed = new Date(trimmed);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseAssignmentStatus(value: FormDataEntryValue | null): 'ACTIVE' | 'PLANNED' {
	return value === 'PLANNED' ? 'PLANNED' : 'ACTIVE';
}

export async function createAssignmentAction(formData: FormData): Promise<void> {
	const memberId = formData.get('memberId');
	const roleTemplateId = formData.get('roleTemplateId');
	const orgUnitId = formData.get('orgUnitId');
	if (typeof memberId !== 'string' || !memberId) return;
	if (typeof roleTemplateId !== 'string' || !roleTemplateId) return;
	if (typeof orgUnitId !== 'string' || !orgUnitId) return;

	const startAt = parseOptionalDate(formData.get('startAt'));
	const status = parseAssignmentStatus(formData.get('status'));
	const { caller, actor } = await createOrgCaller();
	const organizationId = actor.organizationId;
	const idempotencyKey = `staff-create-${randomUUID()}`;

	const created = await caller.org.assignRole({
		organizationId,
		idempotencyKey,
		memberId,
		roleTemplateId,
		orgUnitId,
		startAt,
	});

	if (status !== 'ACTIVE') {
		await caller.org.updateRoleAssignment({
			organizationId,
			idempotencyKey: `staff-create-status-${randomUUID()}`,
			assignmentId: created.id,
			status,
			metadata: {
				source: 'admin-staff-console',
				action: 'create-with-status',
			},
		});
	}

	revalidatePath('/dashboard');
	revalidatePath('/dashboard/staff');
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
