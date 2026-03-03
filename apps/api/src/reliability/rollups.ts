import type { Prisma } from '@faithflow/database';

type UnitNode = {
	id: string;
	parentUnitId: string | null;
};

type UnitRollupStats = {
	directChildren: number;
	totalDescendantUnits: number;
	directActiveAssignments: number;
	subtreeActiveAssignments: number;
	directLeadershipAssignments: number;
	subtreeLeadershipAssignments: number;
	activeDistinctMembers: number;
};

type UnitRollupAccumulator = UnitRollupStats & {
	memberIds: Set<string>;
};

export async function recomputeOrgUnitRollups(
	tx: Prisma.TransactionClient,
	organizationId: string
): Promise<void> {
	const units = await tx.orgUnit.findMany({
		where: { organizationId },
		select: { id: true, parentUnitId: true },
	});

	if (!units.length) {
		await tx.orgUnitRollup.deleteMany({ where: { organizationId } });
		return;
	}

	const assignments = await tx.unitRoleAssignment.findMany({
		where: {
			organizationId,
			status: 'ACTIVE',
		},
		select: {
			orgUnitId: true,
			memberId: true,
			roleTemplate: {
				select: {
					isLeadership: true,
				},
			},
		},
	});

	const childrenByParent = new Map<string | null, string[]>();
	for (const unit of units) {
		const siblings = childrenByParent.get(unit.parentUnitId) ?? [];
		siblings.push(unit.id);
		childrenByParent.set(unit.parentUnitId, siblings);
	}

	const directActive = new Map<string, number>();
	const directLeadership = new Map<string, number>();
	const directMembers = new Map<string, Set<string>>();

	for (const assignment of assignments) {
		directActive.set(assignment.orgUnitId, (directActive.get(assignment.orgUnitId) ?? 0) + 1);
		if (assignment.roleTemplate.isLeadership) {
			directLeadership.set(
				assignment.orgUnitId,
				(directLeadership.get(assignment.orgUnitId) ?? 0) + 1
			);
		}
		const members = directMembers.get(assignment.orgUnitId) ?? new Set<string>();
		members.add(assignment.memberId);
		directMembers.set(assignment.orgUnitId, members);
	}

	const statsByUnit = new Map<string, UnitRollupAccumulator>();
	const inStack = new Set<string>();

	const compute = (unitId: string): UnitRollupAccumulator => {
		const cached = statsByUnit.get(unitId);
		if (cached) return cached;

		if (inStack.has(unitId)) {
			// Defensive guard; cycles should be prevented by validation.
			return {
				directChildren: 0,
				totalDescendantUnits: 0,
				directActiveAssignments: 0,
				subtreeActiveAssignments: 0,
				directLeadershipAssignments: 0,
				subtreeLeadershipAssignments: 0,
				activeDistinctMembers: 0,
				memberIds: new Set<string>(),
			};
		}

		inStack.add(unitId);
		const children = childrenByParent.get(unitId) ?? [];
		const memberIds = new Set(directMembers.get(unitId) ?? []);

		let totalDescendantUnits = 0;
		let subtreeActiveAssignments = directActive.get(unitId) ?? 0;
		let subtreeLeadershipAssignments = directLeadership.get(unitId) ?? 0;

		for (const childId of children) {
			const childStats = compute(childId);
			totalDescendantUnits += 1 + childStats.totalDescendantUnits;
			subtreeActiveAssignments += childStats.subtreeActiveAssignments;
			subtreeLeadershipAssignments += childStats.subtreeLeadershipAssignments;

			childStats.memberIds.forEach((memberId) => {
				memberIds.add(memberId);
			});
		}

		const stats: UnitRollupAccumulator = {
			directChildren: children.length,
			totalDescendantUnits,
			directActiveAssignments: directActive.get(unitId) ?? 0,
			subtreeActiveAssignments,
			directLeadershipAssignments: directLeadership.get(unitId) ?? 0,
			subtreeLeadershipAssignments,
			activeDistinctMembers: memberIds.size,
			memberIds,
		};

		inStack.delete(unitId);
		statsByUnit.set(unitId, stats);
		return stats;
	};

	for (const unit of units) {
		compute(unit.id);
	}

	const computedAt = new Date();
	for (const unit of units) {
		const stats = statsByUnit.get(unit.id);
		if (!stats) continue;

		await tx.orgUnitRollup.upsert({
			where: { orgUnitId: unit.id },
			update: {
				directChildren: stats.directChildren,
				totalDescendantUnits: stats.totalDescendantUnits,
				directActiveAssignments: stats.directActiveAssignments,
				subtreeActiveAssignments: stats.subtreeActiveAssignments,
				directLeadershipAssignments: stats.directLeadershipAssignments,
				subtreeLeadershipAssignments: stats.subtreeLeadershipAssignments,
				activeDistinctMembers: stats.activeDistinctMembers,
				computedAt,
			},
			create: {
				organizationId,
				orgUnitId: unit.id,
				directChildren: stats.directChildren,
				totalDescendantUnits: stats.totalDescendantUnits,
				directActiveAssignments: stats.directActiveAssignments,
				subtreeActiveAssignments: stats.subtreeActiveAssignments,
				directLeadershipAssignments: stats.directLeadershipAssignments,
				subtreeLeadershipAssignments: stats.subtreeLeadershipAssignments,
				activeDistinctMembers: stats.activeDistinctMembers,
				computedAt,
			},
		});
	}

	await tx.orgUnitRollup.deleteMany({
		where: {
			organizationId,
			orgUnitId: { notIn: units.map((unit) => unit.id) },
		},
	});
}

export function validateNoHierarchyCycle(units: UnitNode[], movingUnitId: string, newParentId?: string): void {
	if (!newParentId) return;
	if (newParentId === movingUnitId) {
		throw new Error('A unit cannot be its own parent.');
	}

	const parentByUnit = new Map<string, string | null>();
	for (const unit of units) {
		parentByUnit.set(unit.id, unit.parentUnitId);
	}
	parentByUnit.set(movingUnitId, newParentId);

	const visited = new Set<string>();
	let current: string | null = movingUnitId;
	while (current) {
		if (visited.has(current)) {
			throw new Error('Hierarchy cycle detected. Choose a different parent unit.');
		}
		visited.add(current);
		current = parentByUnit.get(current) ?? null;
	}
}
