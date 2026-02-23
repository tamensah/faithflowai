import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '@faithflow/database';
import type { Prisma } from '@faithflow/database';
import { protectedProcedure, router } from '../trpc';
import { executeGuardedMutation } from '../security/audit';
import { ensurePolicyAllowed } from '../security/policy';
import { executeIdempotentMutation } from '../reliability/idempotency';
import { recomputeOrgUnitRollups, validateNoHierarchyCycle } from '../reliability/rollups';

const orgUnitTypeEnum = z.enum([
	'HEADQUARTERS',
	'REGION',
	'BRANCH',
	'CAMPUS',
	'DIASPORA',
	'ZONE',
	'DEPARTMENT',
	'MINISTRY',
]);

const slugSchema = z
	.string()
	.min(2)
	.max(120)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must use lowercase letters, numbers, and hyphens');

const timezoneSchema = z
	.string()
	.min(2)
	.max(120)
	.refine(
		(value) => {
			try {
				new Intl.DateTimeFormat('en-US', { timeZone: value });
				return true;
			} catch {
				return false;
			}
		},
		{ message: 'Timezone must be a valid IANA timezone.' }
	);

const countryIso2Schema = z.string().regex(/^[A-Z]{2}$/, 'Country must be a valid ISO-2 code');
const idempotencyKeySchema = z.string().min(8).max(120).optional();

const orgUnitCreateSchema = z.object({
	organizationId: z.string().min(1),
	idempotencyKey: idempotencyKeySchema,
	churchId: z.string().optional(),
	parentUnitId: z.string().optional(),
	type: orgUnitTypeEnum,
	name: z.string().min(2).max(120),
	slug: slugSchema,
	countryIso2: countryIso2Schema.optional(),
	timezone: timezoneSchema.default('UTC'),
	metadata: z.record(z.unknown()).optional(),
});

const orgUnitUpdateSchema = z.object({
	organizationId: z.string().min(1),
	idempotencyKey: idempotencyKeySchema,
	unitId: z.string().min(1),
	name: z.string().min(2).max(120).optional(),
	countryIso2: countryIso2Schema.optional(),
	timezone: timezoneSchema.optional(),
	metadata: z.record(z.unknown()).optional(),
	status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
});

const moveUnitSchema = z.object({
	organizationId: z.string().min(1),
	idempotencyKey: idempotencyKeySchema,
	unitId: z.string().min(1),
	newParentUnitId: z.string().optional(),
});

const createRoleTemplateSchema = z.object({
	organizationId: z.string().min(1),
	idempotencyKey: idempotencyKeySchema,
	code: z
		.string()
		.min(2)
		.max(60)
		.regex(/^[A-Z0-9_]+$/, 'Role code must use uppercase letters, numbers, and underscores.'),
	name: z.string().min(2).max(120),
	description: z.string().optional(),
	isLeadership: z.boolean().default(false),
	permissions: z.record(z.unknown()).optional(),
});

const assignRoleSchema = z.object({
	organizationId: z.string().min(1),
	idempotencyKey: idempotencyKeySchema,
	memberId: z.string().min(1),
	roleTemplateId: z.string().min(1),
	orgUnitId: z.string().min(1),
	startAt: z.coerce.date().optional(),
	endAt: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
});

const endRoleAssignmentSchema = z.object({
	organizationId: z.string().min(1),
	idempotencyKey: idempotencyKeySchema,
	assignmentId: z.string().min(1),
	endAt: z.coerce.date().optional(),
});

const roleAssignmentStatusEnum = z.enum(['PLANNED', 'ACTIVE', 'SUSPENDED', 'ENDED']);

const updateRoleAssignmentSchema = z
	.object({
		organizationId: z.string().min(1),
		idempotencyKey: idempotencyKeySchema,
		assignmentId: z.string().min(1),
		startAt: z.coerce.date().optional().nullable(),
		endAt: z.coerce.date().optional().nullable(),
		status: roleAssignmentStatusEnum.optional(),
		metadata: z.record(z.unknown()).optional(),
	})
	.refine(
		(value) =>
			value.startAt !== undefined ||
			value.endAt !== undefined ||
			value.status !== undefined ||
			value.metadata !== undefined,
		{
			message: 'Provide at least one update field.',
		}
	);

const adminSecurityPolicySchema = z.object({
	requireVerifiedEmail: z.boolean(),
	requireMfaForPrivilegedRoles: z.boolean(),
	maxSessionAgeMinutes: z.number().int().min(1).max(10080).nullable(),
	allowedEmailDomains: z
		.array(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, 'Domain must be valid'))
		.max(50)
		.transform((values) => Array.from(new Set(values.map((value) => value.toLowerCase())))),
	privilegedRoles: z
		.array(z.string().min(1).max(80))
		.max(50)
		.transform((values) => Array.from(new Set(values.map((value) => value.toUpperCase())))),
});

const getSecurityPolicySchema = z.object({
	organizationId: z.string().min(1),
});

const updateSecurityPolicySchema = z.object({
	organizationId: z.string().min(1),
	idempotencyKey: idempotencyKeySchema,
	policy: adminSecurityPolicySchema,
});

const upsertUnitAliasSchema = z.object({
	organizationId: z.string().min(1),
	idempotencyKey: idempotencyKeySchema,
	concept: orgUnitTypeEnum,
	singularLabel: z
		.string()
		.min(2)
		.max(40)
		.regex(/^[A-Za-z][A-Za-z0-9 -]*$/, 'Singular label must be human-readable text'),
	pluralLabel: z
		.string()
		.min(2)
		.max(40)
		.regex(/^[A-Za-z][A-Za-z0-9 -]*$/, 'Plural label must be human-readable text'),
});

const roleAssignmentListSchema = z.object({
	organizationId: z.string().min(1),
	status: z.enum(['PLANNED', 'ACTIVE', 'SUSPENDED', 'ENDED']).optional(),
	limit: z.number().min(1).max(200).default(50),
	cursor: z.string().optional(),
	query: z.string().min(1).max(120).optional(),
});

const auditListSchema = z.object({
	organizationId: z.string().min(1),
	limit: z.number().min(1).max(200).default(50),
	cursor: z.string().optional(),
	action: z.string().optional(),
	result: z.enum(['SUCCESS', 'DENIED', 'FAILED']).optional(),
	query: z.string().min(1).max(120).optional(),
});

const hierarchyNodesSchema = z.object({
	organizationId: z.string().min(1),
	parentUnitId: z.string().optional(),
});

const hierarchyOverviewSchema = z.object({
	organizationId: z.string().min(1),
});

const refreshRollupsSchema = z.object({
	organizationId: z.string().min(1),
	idempotencyKey: idempotencyKeySchema,
});

function normalizeSlug(value: string): string {
	return value.trim().toLowerCase();
}

function asJsonObject(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
}

function getOrganizationSecurityPolicy(value: unknown) {
	const settings = asJsonObject(value);
	const candidate = settings.securityPolicy;
	const parsed = adminSecurityPolicySchema.safeParse(candidate);
	return parsed.success ? parsed.data : null;
}

type OrgMutationEvent = {
	eventType: string;
	aggregateType: string;
	aggregateId?: string | null;
	payload: Record<string, unknown>;
};

export const orgRouter = router({
	createUnit: protectedProcedure
		.input(orgUnitCreateSchema)
		.mutation(async ({ ctx, input }) =>
			executeGuardedMutation({
				actor: ctx.actor,
				action: 'ORG_UNIT_WRITE',
				scope: { organizationId: input.organizationId },
				entityType: 'OrgUnit',
				orgUnitId: input.parentUnitId,
				metadata: { type: input.type, name: input.name, slug: input.slug },
				execute: async () =>
					executeIdempotentMutation({
						organizationId: input.organizationId,
						actor: ctx.actor,
						action: 'ORG_CREATE_UNIT',
						idempotencyKey: input.idempotencyKey,
						requestFingerprint: input,
						execute: async (tx) => {
							if (input.parentUnitId) {
								const parent = await tx.orgUnit.findFirst({
									where: {
										id: input.parentUnitId,
										organizationId: input.organizationId,
									},
									select: { id: true },
								});
								if (!parent) {
									throw new TRPCError({
										code: 'BAD_REQUEST',
										message: 'Parent unit must belong to the same organization.',
									});
								}
							}

							const unit = await tx.orgUnit.create({
								data: {
									organizationId: input.organizationId,
									churchId: input.churchId,
									parentUnitId: input.parentUnitId,
									type: input.type,
									name: input.name.trim(),
									slug: normalizeSlug(input.slug),
									countryIso2: input.countryIso2,
									timezone: input.timezone,
									metadata: input.metadata as Prisma.InputJsonValue,
								},
							});

							await tx.auditEvent.create({
								data: {
									organizationId: input.organizationId,
									orgUnitId: unit.id,
									actorId: ctx.actor.id,
									actorType: ctx.actor.type,
									actorRoles: ctx.actor.roles.map((role) => role.toUpperCase()),
									action: 'ORG_UNIT_HIERARCHY_CHANGE',
									entityType: 'OrgUnit',
									entityId: unit.id,
									result: 'SUCCESS',
									metadata: {
										operation: 'CREATE',
										parentUnitId: input.parentUnitId,
									},
								},
							});

							await recomputeOrgUnitRollups(tx, input.organizationId);

							const outbox: OrgMutationEvent[] = [
								{
									eventType: 'org.unit.created',
									aggregateType: 'OrgUnit',
									aggregateId: unit.id,
									payload: {
										organizationId: input.organizationId,
										unitId: unit.id,
										parentUnitId: input.parentUnitId ?? null,
										type: input.type,
									},
								},
							];

							return { result: unit, outboxEvents: outbox };
						},
					}),
			})
		),

	updateUnit: protectedProcedure
		.input(orgUnitUpdateSchema)
		.mutation(async ({ ctx, input }) =>
			executeGuardedMutation({
				actor: ctx.actor,
				action: 'ORG_UNIT_WRITE',
				scope: { organizationId: input.organizationId },
				entityType: 'OrgUnit',
				entityId: input.unitId,
				orgUnitId: input.unitId,
				metadata: { operation: 'UPDATE' },
				execute: async () =>
					executeIdempotentMutation({
						organizationId: input.organizationId,
						actor: ctx.actor,
						action: 'ORG_UPDATE_UNIT',
						idempotencyKey: input.idempotencyKey,
						requestFingerprint: input,
						execute: async (tx) => {
							const existing = await tx.orgUnit.findFirst({
								where: {
									id: input.unitId,
									organizationId: input.organizationId,
								},
								select: { id: true },
							});
							if (!existing) {
								throw new TRPCError({
									code: 'NOT_FOUND',
									message: 'Org unit not found for this organization.',
								});
							}

							const unit = await tx.orgUnit.update({
								where: { id: input.unitId },
								data: {
									name: input.name?.trim(),
									countryIso2: input.countryIso2,
									timezone: input.timezone,
									metadata: input.metadata as Prisma.InputJsonValue,
									status: input.status,
								},
							});

							const outbox: OrgMutationEvent[] = [
								{
									eventType: 'org.unit.updated',
									aggregateType: 'OrgUnit',
									aggregateId: unit.id,
									payload: {
										organizationId: input.organizationId,
										unitId: unit.id,
										status: input.status ?? unit.status,
									},
								},
							];

							return { result: unit, outboxEvents: outbox };
						},
					}),
			})
		),

	moveUnit: protectedProcedure
		.input(moveUnitSchema)
		.mutation(async ({ ctx, input }) =>
			executeGuardedMutation({
				actor: ctx.actor,
				action: 'ORG_UNIT_WRITE',
				scope: { organizationId: input.organizationId },
				entityType: 'OrgUnit',
				entityId: input.unitId,
				orgUnitId: input.unitId,
				metadata: { operation: 'MOVE', newParentUnitId: input.newParentUnitId },
				execute: async () =>
					executeIdempotentMutation({
						organizationId: input.organizationId,
						actor: ctx.actor,
						action: 'ORG_MOVE_UNIT',
						idempotencyKey: input.idempotencyKey,
						requestFingerprint: input,
						execute: async (tx) => {
							const unit = await tx.orgUnit.findFirst({
								where: {
									id: input.unitId,
									organizationId: input.organizationId,
								},
								select: { id: true, parentUnitId: true },
							});
							if (!unit) {
								throw new TRPCError({
									code: 'NOT_FOUND',
									message: 'Org unit not found for this organization.',
								});
							}

							const units = await tx.orgUnit.findMany({
								where: { organizationId: input.organizationId },
								select: { id: true, parentUnitId: true },
							});

							if (input.newParentUnitId) {
								const parent = units.find((candidate) => candidate.id === input.newParentUnitId);
								if (!parent) {
									throw new TRPCError({
										code: 'BAD_REQUEST',
										message: 'New parent unit must belong to the same organization.',
									});
								}

								try {
									validateNoHierarchyCycle(units, input.unitId, input.newParentUnitId);
								} catch (error) {
									throw new TRPCError({
										code: 'BAD_REQUEST',
										message: error instanceof Error ? error.message : 'Invalid hierarchy move.',
									});
								}
							}

							const moved = await tx.orgUnit.update({
								where: { id: input.unitId },
								data: { parentUnitId: input.newParentUnitId ?? null },
							});

							await tx.auditEvent.create({
								data: {
									organizationId: input.organizationId,
									orgUnitId: moved.id,
									actorId: ctx.actor.id,
									actorType: ctx.actor.type,
									actorRoles: ctx.actor.roles.map((role) => role.toUpperCase()),
									action: 'ORG_UNIT_HIERARCHY_CHANGE',
									entityType: 'OrgUnit',
									entityId: moved.id,
									result: 'SUCCESS',
									metadata: {
										operation: 'MOVE',
										fromParentUnitId: unit.parentUnitId,
										toParentUnitId: input.newParentUnitId ?? null,
									},
								},
							});

							await recomputeOrgUnitRollups(tx, input.organizationId);

							const outbox: OrgMutationEvent[] = [
								{
									eventType: 'org.unit.moved',
									aggregateType: 'OrgUnit',
									aggregateId: moved.id,
									payload: {
										organizationId: input.organizationId,
										unitId: moved.id,
										fromParentUnitId: unit.parentUnitId,
										toParentUnitId: input.newParentUnitId ?? null,
									},
								},
							];

							return { result: moved, outboxEvents: outbox };
						},
					}),
			})
		),

	createRoleTemplate: protectedProcedure
		.input(createRoleTemplateSchema)
		.mutation(async ({ ctx, input }) =>
			executeGuardedMutation({
				actor: ctx.actor,
				action: 'ROLE_ASSIGNMENT_WRITE',
				scope: { organizationId: input.organizationId },
				entityType: 'RoleTemplate',
				metadata: { code: input.code, name: input.name },
				execute: async () =>
					executeIdempotentMutation({
						organizationId: input.organizationId,
						actor: ctx.actor,
						action: 'ORG_CREATE_ROLE_TEMPLATE',
						idempotencyKey: input.idempotencyKey,
						requestFingerprint: input,
						execute: async (tx) => {
							const roleTemplate = await tx.roleTemplate.create({
								data: {
									organizationId: input.organizationId,
									code: input.code.toUpperCase(),
									name: input.name.trim(),
									description: input.description,
									isLeadership: input.isLeadership,
									permissions: input.permissions as Prisma.InputJsonValue,
								},
							});

							const outbox: OrgMutationEvent[] = [
								{
									eventType: 'org.role_template.created',
									aggregateType: 'RoleTemplate',
									aggregateId: roleTemplate.id,
									payload: {
										organizationId: input.organizationId,
										roleTemplateId: roleTemplate.id,
										code: roleTemplate.code,
									},
								},
							];

							return { result: roleTemplate, outboxEvents: outbox };
						},
					}),
			})
		),

	assignRole: protectedProcedure
		.input(assignRoleSchema)
		.mutation(async ({ ctx, input }) =>
			executeGuardedMutation({
				actor: ctx.actor,
				action: 'ROLE_ASSIGNMENT_WRITE',
				scope: { organizationId: input.organizationId },
				entityType: 'UnitRoleAssignment',
				orgUnitId: input.orgUnitId,
				metadata: {
					roleTemplateId: input.roleTemplateId,
					memberId: input.memberId,
				},
				execute: async () =>
					executeIdempotentMutation({
						organizationId: input.organizationId,
						actor: ctx.actor,
						action: 'ORG_ASSIGN_ROLE',
						idempotencyKey: input.idempotencyKey,
						requestFingerprint: input,
						execute: async (tx) => {
							const [member, roleTemplate, orgUnit] = await Promise.all([
								tx.member.findUnique({
									where: { id: input.memberId },
									select: { id: true, church: { select: { organizationId: true } } },
								}),
								tx.roleTemplate.findFirst({
									where: {
										id: input.roleTemplateId,
										organizationId: input.organizationId,
									},
									select: { id: true },
								}),
								tx.orgUnit.findFirst({
									where: { id: input.orgUnitId, organizationId: input.organizationId },
									select: { id: true },
								}),
							]);

							if (!member || member.church.organizationId !== input.organizationId) {
								throw new TRPCError({
									code: 'BAD_REQUEST',
									message: 'Member must belong to the target organization.',
								});
							}
							if (!roleTemplate) {
								throw new TRPCError({
									code: 'BAD_REQUEST',
									message: 'Role template not found for organization.',
								});
							}
							if (!orgUnit) {
								throw new TRPCError({
									code: 'BAD_REQUEST',
									message: 'Org unit not found for organization.',
								});
							}

							const assignment = await tx.unitRoleAssignment.create({
								data: {
									organizationId: input.organizationId,
									memberId: input.memberId,
									roleTemplateId: input.roleTemplateId,
									orgUnitId: input.orgUnitId,
									status: 'ACTIVE',
									startAt: input.startAt ?? new Date(),
									endAt: input.endAt,
									metadata: input.metadata as Prisma.InputJsonValue,
								},
							});

							await tx.auditEvent.create({
								data: {
									organizationId: input.organizationId,
									orgUnitId: input.orgUnitId,
									actorId: ctx.actor.id,
									actorType: ctx.actor.type,
									actorRoles: ctx.actor.roles.map((role) => role.toUpperCase()),
									action: 'ROLE_ASSIGNMENT_CHANGE',
									entityType: 'UnitRoleAssignment',
									entityId: assignment.id,
									result: 'SUCCESS',
									metadata: {
										operation: 'ASSIGN',
										roleTemplateId: input.roleTemplateId,
										memberId: input.memberId,
									},
								},
							});

							await recomputeOrgUnitRollups(tx, input.organizationId);

							const outbox: OrgMutationEvent[] = [
								{
									eventType: 'org.role_assignment.assigned',
									aggregateType: 'UnitRoleAssignment',
									aggregateId: assignment.id,
									payload: {
										organizationId: input.organizationId,
										assignmentId: assignment.id,
										memberId: input.memberId,
										roleTemplateId: input.roleTemplateId,
										orgUnitId: input.orgUnitId,
									},
								},
							];

							return { result: assignment, outboxEvents: outbox };
						},
					}),
			})
		),

	endRoleAssignment: protectedProcedure
		.input(endRoleAssignmentSchema)
		.mutation(async ({ ctx, input }) =>
			executeGuardedMutation({
				actor: ctx.actor,
				action: 'ROLE_ASSIGNMENT_WRITE',
				scope: { organizationId: input.organizationId },
				entityType: 'UnitRoleAssignment',
				entityId: input.assignmentId,
				metadata: { operation: 'END' },
				execute: async () =>
					executeIdempotentMutation({
						organizationId: input.organizationId,
						actor: ctx.actor,
						action: 'ORG_END_ROLE_ASSIGNMENT',
						idempotencyKey: input.idempotencyKey,
						requestFingerprint: input,
						execute: async (tx) => {
							const assignment = await tx.unitRoleAssignment.findFirst({
								where: {
									id: input.assignmentId,
									organizationId: input.organizationId,
								},
								select: { id: true, orgUnitId: true },
							});
							if (!assignment) {
								throw new TRPCError({
									code: 'NOT_FOUND',
									message: 'Role assignment not found for this organization.',
								});
							}

							const ended = await tx.unitRoleAssignment.update({
								where: { id: input.assignmentId },
								data: {
									status: 'ENDED',
									endAt: input.endAt ?? new Date(),
								},
							});

							await tx.auditEvent.create({
								data: {
									organizationId: input.organizationId,
									orgUnitId: assignment.orgUnitId,
									actorId: ctx.actor.id,
									actorType: ctx.actor.type,
									actorRoles: ctx.actor.roles.map((role) => role.toUpperCase()),
									action: 'ROLE_ASSIGNMENT_CHANGE',
									entityType: 'UnitRoleAssignment',
									entityId: ended.id,
									result: 'SUCCESS',
									metadata: { operation: 'END' },
								},
							});

							await recomputeOrgUnitRollups(tx, input.organizationId);

							const outbox: OrgMutationEvent[] = [
								{
									eventType: 'org.role_assignment.ended',
									aggregateType: 'UnitRoleAssignment',
									aggregateId: ended.id,
									payload: {
										organizationId: input.organizationId,
										assignmentId: ended.id,
										orgUnitId: assignment.orgUnitId,
									},
								},
							];

							return { result: ended, outboxEvents: outbox };
						},
					}),
			})
		),

	updateRoleAssignment: protectedProcedure
		.input(updateRoleAssignmentSchema)
		.mutation(async ({ ctx, input }) =>
			executeGuardedMutation({
				actor: ctx.actor,
				action: 'ROLE_ASSIGNMENT_WRITE',
				scope: { organizationId: input.organizationId },
				entityType: 'UnitRoleAssignment',
				entityId: input.assignmentId,
				metadata: { operation: 'UPDATE' },
				execute: async () =>
					executeIdempotentMutation({
						organizationId: input.organizationId,
						actor: ctx.actor,
						action: 'ORG_UPDATE_ROLE_ASSIGNMENT',
						idempotencyKey: input.idempotencyKey,
						requestFingerprint: input,
						execute: async (tx) => {
							const existing = await tx.unitRoleAssignment.findFirst({
								where: {
									id: input.assignmentId,
									organizationId: input.organizationId,
								},
								select: {
									id: true,
									orgUnitId: true,
									status: true,
									startAt: true,
									endAt: true,
									metadata: true,
								},
							});
							if (!existing) {
								throw new TRPCError({
									code: 'NOT_FOUND',
									message: 'Role assignment not found for this organization.',
								});
							}

							const nextStatus = input.status ?? existing.status;
							const nextEndAt =
								input.endAt === undefined
									? existing.endAt
									: input.endAt ?? (nextStatus === 'ENDED' ? new Date() : null);
							const nextStartAt =
								input.startAt === undefined ? existing.startAt : input.startAt ?? existing.startAt;

							const updated = await tx.unitRoleAssignment.update({
								where: { id: input.assignmentId },
								data: {
									status: nextStatus,
									startAt: nextStartAt,
									endAt: nextEndAt,
									metadata:
										input.metadata === undefined
											? undefined
											: (input.metadata as Prisma.InputJsonValue),
								},
							});

							await tx.auditEvent.create({
								data: {
									organizationId: input.organizationId,
									orgUnitId: existing.orgUnitId,
									actorId: ctx.actor.id,
									actorType: ctx.actor.type,
									actorRoles: ctx.actor.roles.map((role) => role.toUpperCase()),
									action: 'ROLE_ASSIGNMENT_CHANGE',
									entityType: 'UnitRoleAssignment',
									entityId: updated.id,
									result: 'SUCCESS',
									metadata: {
										operation: 'UPDATE',
										previousStatus: existing.status,
										nextStatus,
									},
								},
							});

							await recomputeOrgUnitRollups(tx, input.organizationId);

							const outbox: OrgMutationEvent[] = [
								{
									eventType: 'org.role_assignment.updated',
									aggregateType: 'UnitRoleAssignment',
									aggregateId: updated.id,
									payload: {
										organizationId: input.organizationId,
										assignmentId: updated.id,
										orgUnitId: existing.orgUnitId,
										status: updated.status,
									},
								},
							];

							return { result: updated, outboxEvents: outbox };
						},
					}),
			})
		),

	getSecurityPolicy: protectedProcedure
		.input(getSecurityPolicySchema)
		.query(async ({ ctx, input }) => {
			ensurePolicyAllowed(ctx.actor, 'ORG_UNIT_READ', {
				organizationId: input.organizationId,
			});

			const organization = await prisma.organization.findUnique({
				where: { id: input.organizationId },
				select: { settings: true },
			});

			if (!organization) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Organization not found.',
				});
			}

			return {
				policy: getOrganizationSecurityPolicy(organization.settings),
			};
		}),

	updateSecurityPolicy: protectedProcedure
		.input(updateSecurityPolicySchema)
		.mutation(async ({ ctx, input }) =>
			executeGuardedMutation({
				actor: ctx.actor,
				action: 'ORG_UNIT_WRITE',
				scope: { organizationId: input.organizationId },
				entityType: 'Organization',
				entityId: input.organizationId,
				metadata: { operation: 'UPDATE_SECURITY_POLICY' },
				execute: async () =>
					executeIdempotentMutation({
						organizationId: input.organizationId,
						actor: ctx.actor,
						action: 'ORG_UPDATE_SECURITY_POLICY',
						idempotencyKey: input.idempotencyKey,
						requestFingerprint: input,
						execute: async (tx) => {
							const organization = await tx.organization.findUnique({
								where: { id: input.organizationId },
								select: { id: true, settings: true },
							});
							if (!organization) {
								throw new TRPCError({
									code: 'NOT_FOUND',
									message: 'Organization not found.',
								});
							}

							const currentSettings = asJsonObject(organization.settings);
							const updatedSettings: Record<string, unknown> = {
								...currentSettings,
								securityPolicy: input.policy,
							};

							await tx.organization.update({
								where: { id: input.organizationId },
								data: {
									settings: updatedSettings as Prisma.InputJsonValue,
								},
							});

							await tx.auditEvent.create({
								data: {
									organizationId: input.organizationId,
									actorId: ctx.actor.id,
									actorType: ctx.actor.type,
									actorRoles: ctx.actor.roles.map((role) => role.toUpperCase()),
									action: 'SECURITY_POLICY_CHANGE',
									entityType: 'Organization',
									entityId: input.organizationId,
									result: 'SUCCESS',
									metadata: {
										operation: 'UPDATE',
										policy: input.policy,
									},
								},
							});

							const outbox: OrgMutationEvent[] = [
								{
									eventType: 'org.security_policy.updated',
									aggregateType: 'Organization',
									aggregateId: input.organizationId,
									payload: {
										organizationId: input.organizationId,
										policy: input.policy,
									},
								},
							];

							return { result: { policy: input.policy }, outboxEvents: outbox };
						},
					}),
			})
		),

	upsertUnitAlias: protectedProcedure
		.input(upsertUnitAliasSchema)
		.mutation(async ({ ctx, input }) =>
			executeGuardedMutation({
				actor: ctx.actor,
				action: 'ORG_UNIT_WRITE',
				scope: { organizationId: input.organizationId },
				entityType: 'OrgUnitAlias',
				metadata: {
					concept: input.concept,
					singularLabel: input.singularLabel,
					pluralLabel: input.pluralLabel,
				},
				execute: async () =>
					executeIdempotentMutation({
						organizationId: input.organizationId,
						actor: ctx.actor,
						action: 'ORG_UPSERT_UNIT_ALIAS',
						idempotencyKey: input.idempotencyKey,
						requestFingerprint: input,
						execute: async (tx) => {
							const alias = await tx.orgUnitAlias.upsert({
								where: {
									organizationId_concept: {
										organizationId: input.organizationId,
										concept: input.concept,
									},
								},
								update: {
									singularLabel: input.singularLabel.trim(),
									pluralLabel: input.pluralLabel.trim(),
								},
								create: {
									organizationId: input.organizationId,
									concept: input.concept,
									singularLabel: input.singularLabel.trim(),
									pluralLabel: input.pluralLabel.trim(),
								},
							});

							const outbox: OrgMutationEvent[] = [
								{
									eventType: 'org.unit_alias.updated',
									aggregateType: 'OrgUnitAlias',
									aggregateId: alias.id,
									payload: {
										organizationId: input.organizationId,
										concept: input.concept,
										singularLabel: alias.singularLabel,
										pluralLabel: alias.pluralLabel,
									},
								},
							];

							return { result: alias, outboxEvents: outbox };
						},
					}),
			})
		),

	refreshHierarchyRollups: protectedProcedure
		.input(refreshRollupsSchema)
		.mutation(async ({ ctx, input }) =>
			executeGuardedMutation({
				actor: ctx.actor,
				action: 'ORG_UNIT_WRITE',
				scope: { organizationId: input.organizationId },
				entityType: 'OrgUnitRollup',
				metadata: { operation: 'REFRESH' },
				execute: async () =>
					executeIdempotentMutation({
						organizationId: input.organizationId,
						actor: ctx.actor,
						action: 'ORG_REFRESH_ROLLUPS',
						idempotencyKey: input.idempotencyKey,
						requestFingerprint: input,
						execute: async (tx) => {
							await recomputeOrgUnitRollups(tx, input.organizationId);
							const count = await tx.orgUnitRollup.count({
								where: { organizationId: input.organizationId },
							});
							return {
								result: { computed: count, computedAt: new Date().toISOString() },
								outboxEvents: [
									{
										eventType: 'org.rollups.refreshed',
										aggregateType: 'OrgUnitRollup',
										payload: {
											organizationId: input.organizationId,
											computed: count,
										},
									},
								],
							};
						},
					}),
			})
		),

	listUnits: protectedProcedure
		.input(
			z.object({
				organizationId: z.string().min(1),
				parentUnitId: z.string().optional(),
			})
		)
		.query(async ({ ctx, input }) => {
			ensurePolicyAllowed(ctx.actor, 'ORG_UNIT_READ', {
				organizationId: input.organizationId,
			});

			return prisma.orgUnit.findMany({
				where: {
					organizationId: input.organizationId,
					parentUnitId: input.parentUnitId,
				},
				orderBy: [{ type: 'asc' }, { name: 'asc' }],
			});
		}),

	listHierarchyNodes: protectedProcedure.input(hierarchyNodesSchema).query(async ({ ctx, input }) => {
		ensurePolicyAllowed(ctx.actor, 'ORG_UNIT_READ', {
			organizationId: input.organizationId,
		});

		const nodes = await prisma.orgUnit.findMany({
			where: {
				organizationId: input.organizationId,
				parentUnitId: input.parentUnitId ?? null,
			},
			orderBy: [{ type: 'asc' }, { name: 'asc' }],
			include: {
				rollup: true,
			},
		});

		return nodes;
	}),

	getHierarchyOverview: protectedProcedure
		.input(hierarchyOverviewSchema)
		.query(async ({ ctx, input }) => {
			ensurePolicyAllowed(ctx.actor, 'ORG_UNIT_READ', {
				organizationId: input.organizationId,
			});

			const [rootUnits, unitTypeTotals, assignmentTotals] = await Promise.all([
				prisma.orgUnit.findMany({
					where: {
						organizationId: input.organizationId,
						parentUnitId: null,
					},
					orderBy: [{ type: 'asc' }, { name: 'asc' }],
					include: {
						rollup: true,
					},
				}),
				prisma.orgUnit.groupBy({
					by: ['type'],
					where: { organizationId: input.organizationId },
					_count: { _all: true },
				}),
				prisma.unitRoleAssignment.groupBy({
					by: ['status'],
					where: { organizationId: input.organizationId },
					_count: { _all: true },
				}),
			]);

			return {
				rootUnits,
				unitTypeTotals: unitTypeTotals.map((item) => ({ type: item.type, count: item._count._all })),
				assignmentTotals: assignmentTotals.map((item) => ({
					status: item.status,
					count: item._count._all,
				})),
			};
		}),

	listUnitAliases: protectedProcedure
		.input(
			z.object({
				organizationId: z.string().min(1),
			})
		)
		.query(async ({ ctx, input }) => {
			ensurePolicyAllowed(ctx.actor, 'ORG_UNIT_READ', {
				organizationId: input.organizationId,
			});

			return prisma.orgUnitAlias.findMany({
				where: { organizationId: input.organizationId },
				orderBy: { concept: 'asc' },
			});
		}),

	listRoleTemplates: protectedProcedure
		.input(
			z.object({
				organizationId: z.string().min(1),
			})
		)
		.query(async ({ ctx, input }) => {
			ensurePolicyAllowed(ctx.actor, 'ORG_UNIT_READ', {
				organizationId: input.organizationId,
			});

			return prisma.roleTemplate.findMany({
				where: { organizationId: input.organizationId },
				orderBy: [{ isLeadership: 'desc' }, { name: 'asc' }],
			});
		}),

	listMembers: protectedProcedure
		.input(
			z.object({
				organizationId: z.string().min(1),
				limit: z.number().min(1).max(500).default(200),
			})
		)
		.query(async ({ ctx, input }) => {
			ensurePolicyAllowed(ctx.actor, 'ORG_UNIT_READ', {
				organizationId: input.organizationId,
			});

			return prisma.member.findMany({
				where: {
					church: {
						organizationId: input.organizationId,
					},
				},
				orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
				take: input.limit,
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
				},
			});
		}),

	listRoleAssignments: protectedProcedure
		.input(roleAssignmentListSchema)
		.query(async ({ ctx, input }) => {
			ensurePolicyAllowed(ctx.actor, 'ORG_UNIT_READ', {
				organizationId: input.organizationId,
			});

			const items = await prisma.unitRoleAssignment.findMany({
				where: {
					organizationId: input.organizationId,
					status: input.status,
					OR: input.query
						? [
								{
									member: {
										is: {
											firstName: { contains: input.query, mode: 'insensitive' },
										},
									},
								},
								{
									member: {
										is: {
											lastName: { contains: input.query, mode: 'insensitive' },
										},
									},
								},
								{
									member: {
										is: {
											email: { contains: input.query, mode: 'insensitive' },
										},
									},
								},
								{
									roleTemplate: {
										is: {
											name: { contains: input.query, mode: 'insensitive' },
										},
									},
								},
								{
									roleTemplate: {
										is: {
											code: { contains: input.query, mode: 'insensitive' },
										},
									},
								},
								{
									orgUnit: {
										is: {
											name: { contains: input.query, mode: 'insensitive' },
										},
									},
								},
							]
						: undefined,
				},
				orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
				take: input.limit + 1,
				cursor: input.cursor ? { id: input.cursor } : undefined,
				include: {
					member: {
						select: {
							firstName: true,
							lastName: true,
							email: true,
						},
					},
					roleTemplate: {
						select: {
							name: true,
							code: true,
						},
					},
					orgUnit: {
						select: {
							name: true,
							type: true,
						},
					},
				},
			});

			let nextCursor: string | undefined;
			if (items.length > input.limit) {
				const next = items.pop();
				nextCursor = next?.id;
			}

			return { items, nextCursor };
		}),

	listAuditEvents: protectedProcedure
		.input(auditListSchema)
		.query(async ({ ctx, input }) => {
			ensurePolicyAllowed(ctx.actor, 'AUDIT_READ', {
				organizationId: input.organizationId,
			});

			const items = await prisma.auditEvent.findMany({
				where: {
					organizationId: input.organizationId,
					action: input.action,
					result: input.result,
					OR: input.query
						? [
								{ action: { contains: input.query, mode: 'insensitive' } },
								{ entityType: { contains: input.query, mode: 'insensitive' } },
								{ actorId: { contains: input.query, mode: 'insensitive' } },
								{ reason: { contains: input.query, mode: 'insensitive' } },
							]
						: undefined,
				},
				orderBy: { createdAt: 'desc' },
				take: input.limit + 1,
				cursor: input.cursor ? { id: input.cursor } : undefined,
			});

			let nextCursor: string | undefined;
			if (items.length > input.limit) {
				const next = items.pop();
				nextCursor = next?.id;
			}

			return { items, nextCursor };
		}),
});
