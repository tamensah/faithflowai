import { prisma } from '@faithflow/database';
import { orgAppRouter } from '../apps/api/src/router/org-app';

async function run(): Promise<void> {
	const suffix = Date.now().toString(36);
	const tenant = await prisma.tenant.create({
		data: {
			name: `E2E Tenant ${suffix}`,
			domain: `e2e-${suffix}.faithflow.local`,
			schemaName: `e2e_${suffix}`,
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
			slug: `e2e-church-${suffix}`,
			timezone: 'Africa/Accra',
			organizationId: organization.id,
		},
	});

	const member = await prisma.member.create({
		data: {
			churchId: church.id,
			firstName: 'Demo',
			lastName: 'Member',
			email: `member-${suffix}@faithflow.test`,
		},
	});
	const member2 = await prisma.member.create({
		data: {
			churchId: church.id,
			firstName: 'Second',
			lastName: 'Leader',
			email: `member2-${suffix}@faithflow.test`,
		},
	});

	const actor = {
		id: `e2e-actor-${suffix}`,
		organizationId: organization.id,
		roles: ['ORG_ADMIN'],
		type: 'USER' as const,
	};

	const caller = orgAppRouter.createCaller({ actor });

	const idempotencyKey = `e2e-unit-${suffix}`;
	const headquarters = await caller.org.createUnit({
		organizationId: organization.id,
		idempotencyKey,
		type: 'HEADQUARTERS',
		name: 'Headquarters',
		slug: `hq-${suffix}`,
		timezone: 'Africa/Accra',
	});

	const duplicateHeadquarters = await caller.org.createUnit({
		organizationId: organization.id,
		idempotencyKey,
		type: 'HEADQUARTERS',
		name: 'Headquarters',
		slug: `hq-${suffix}`,
		timezone: 'Africa/Accra',
	});

	if (duplicateHeadquarters.id !== headquarters.id) {
		throw new Error('Idempotency check failed: duplicate unit ids differ.');
	}

	const branch = await caller.org.createUnit({
		organizationId: organization.id,
		idempotencyKey: `e2e-branch-${suffix}`,
		type: 'BRANCH',
		name: 'Main Branch',
		slug: `branch-${suffix}`,
		parentUnitId: headquarters.id,
		timezone: 'Africa/Accra',
		countryIso2: 'GH',
	});

	await caller.org.upsertUnitAlias({
		organizationId: organization.id,
		idempotencyKey: `e2e-alias-${suffix}`,
		concept: 'BRANCH',
		singularLabel: 'Campus',
		pluralLabel: 'Campuses',
	});

	const roleTemplate = await caller.org.createRoleTemplate({
		organizationId: organization.id,
		idempotencyKey: `e2e-role-template-${suffix}`,
		code: `COORD_${suffix.toUpperCase()}`,
		name: 'Coordinator',
		isLeadership: true,
	});

	const assignment = await caller.org.assignRole({
		organizationId: organization.id,
		idempotencyKey: `e2e-assignment-${suffix}`,
		memberId: member.id,
		roleTemplateId: roleTemplate.id,
		orgUnitId: branch.id,
	});
	const assignment2 = await caller.org.assignRole({
		organizationId: organization.id,
		idempotencyKey: `e2e-assignment-2-${suffix}`,
		memberId: member2.id,
		roleTemplateId: roleTemplate.id,
		orgUnitId: branch.id,
	});

	const updatedAssignment = await caller.org.updateRoleAssignment({
		organizationId: organization.id,
		idempotencyKey: `e2e-assignment-update-${suffix}`,
		assignmentId: assignment.id,
		status: 'SUSPENDED',
	});
	if (updatedAssignment.status !== 'SUSPENDED') {
		throw new Error('Role assignment update failed: expected SUSPENDED status.');
	}

	const pagedAssignments1 = await caller.org.listRoleAssignments({
		organizationId: organization.id,
		limit: 1,
	});
	if (pagedAssignments1.items.length !== 1 || !pagedAssignments1.nextCursor) {
		throw new Error('Assignment pagination failed: expected first page with next cursor.');
	}
	const pagedAssignments2 = await caller.org.listRoleAssignments({
		organizationId: organization.id,
		limit: 5,
		cursor: pagedAssignments1.nextCursor,
	});
	if (!pagedAssignments2.items.length) {
		throw new Error('Assignment pagination failed: expected second page.');
	}

	const queriedAssignments = await caller.org.listRoleAssignments({
		organizationId: organization.id,
		limit: 10,
		query: 'Second',
	});
	if (!queriedAssignments.items.some((item) => item.member.firstName === 'Second')) {
		throw new Error('Assignment query failed: expected search result for "Second".');
	}

	const policy = {
		requireVerifiedEmail: true,
		requireMfaForPrivilegedRoles: true,
		maxSessionAgeMinutes: 30,
		allowedEmailDomains: ['faithflow.test'],
		privilegedRoles: ['ORG_ADMIN'],
	};
	await caller.org.updateSecurityPolicy({
		organizationId: organization.id,
		idempotencyKey: `e2e-security-policy-${suffix}`,
		policy,
	});
	const savedPolicy = await caller.org.getSecurityPolicy({ organizationId: organization.id });
	if (!savedPolicy.policy || savedPolicy.policy.requireMfaForPrivilegedRoles !== true) {
		throw new Error('Security policy validation failed: saved policy was not returned.');
	}

	const hierarchyOverview = await caller.org.getHierarchyOverview({
		organizationId: organization.id,
	});
	const aliases = await caller.org.listUnitAliases({ organizationId: organization.id });
	const audit = await caller.org.listAuditEvents({
		organizationId: organization.id,
		limit: 20,
	});

	const branchAlias = aliases.find((item) => item.concept === 'BRANCH');
	if (!branchAlias || branchAlias.singularLabel !== 'Campus') {
		throw new Error('Alias validation failed: BRANCH alias not saved.');
	}

	const hasRoleAudit = audit.items.some((item) => item.action === 'ROLE_ASSIGNMENT_CHANGE');
	const hasHierarchyAudit = audit.items.some((item) => item.action === 'ORG_UNIT_HIERARCHY_CHANGE');
	if (!hasRoleAudit || !hasHierarchyAudit) {
		throw new Error('Audit validation failed: missing expected audit records.');
	}
	const filteredAudit = await caller.org.listAuditEvents({
		organizationId: organization.id,
		limit: 20,
		query: 'SECURITY_POLICY_CHANGE',
	});
	if (!filteredAudit.items.some((item) => item.action === 'SECURITY_POLICY_CHANGE')) {
		throw new Error('Audit query validation failed: expected security policy event.');
	}

	const rootRollup = hierarchyOverview.rootUnits.find((item) => item.id === headquarters.id)?.rollup;
	if (!rootRollup || rootRollup.totalDescendantUnits < 1) {
		throw new Error('Rollup validation failed: expected descendant count on headquarters.');
	}

	const outboxCount = await prisma.outboxEvent.count({
		where: { organizationId: organization.id },
	});
	if (outboxCount < 4) {
		throw new Error('Outbox validation failed: expected outbox events were not written.');
	}

	console.log(
		JSON.stringify(
			{
				organizationId: organization.id,
				headquartersUnitId: headquarters.id,
				branchUnitId: branch.id,
				roleAssignmentId: assignment.id,
				roleAssignment2Id: assignment2.id,
				outboxCount,
				auditCount: audit.items.length,
			},
			null,
			2
		)
	);

	await prisma.member.delete({ where: { id: member2.id } });
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
