import { prisma } from '@faithflow/database';

type Trend = 'up' | 'down' | 'flat';

type OrgUnitOption = {
	id: string;
	name: string;
	type: string;
	parentUnitId: string | null;
	churchId: string | null;
};

export type ExecutiveRollups = {
	scope: {
		selectedOrgUnitId: string | null;
		selectedOrgUnitName: string | null;
		includeDescendants: boolean;
		unitIds: string[];
		churchIds: string[];
	};
	members: {
		total: number;
		newLast30Days: number;
	};
	giving: {
		last30DaysAmount: number;
		previous30DaysAmount: number;
		trend: Trend;
	};
	events: {
		upcoming30Days: number;
		past30Days: number;
	};
	leadership: {
		activeAssignments: number;
		leadershipAssignments: number;
	};
	readiness: {
		completedChecks: number;
		totalChecks: number;
		percent: number;
		items: Array<{
			id: string;
			label: string;
			done: boolean;
			href: string;
		}>;
	};
};

export type OrganizationScope = {
	selectedOrgUnitId: string | null;
	selectedOrgUnitName: string | null;
	includeDescendants: boolean;
	unitIds: string[];
	churchIds: string[];
};

function resolveScopedUnitIds(
	units: OrgUnitOption[],
	selectedOrgUnitId: string,
	includeDescendants: boolean
): string[] {
	if (!includeDescendants) return [selectedOrgUnitId];

	const childrenByParent = new Map<string, string[]>();
	for (const unit of units) {
		if (!unit.parentUnitId) continue;
		const existing = childrenByParent.get(unit.parentUnitId) ?? [];
		existing.push(unit.id);
		childrenByParent.set(unit.parentUnitId, existing);
	}

	const scoped: string[] = [];
	const stack = [selectedOrgUnitId];
	const seen = new Set<string>();

	while (stack.length > 0) {
		const current = stack.pop() as string;
		if (seen.has(current)) continue;
		seen.add(current);
		scoped.push(current);
		const children = childrenByParent.get(current) ?? [];
		for (const child of children) stack.push(child);
	}

	return scoped;
}

function asNumber(value: unknown): number {
	if (typeof value === 'number') return value;
	if (value && typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
		return value.toNumber();
	}
	if (typeof value === 'string') {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

function resolveTrend(current: number, previous: number): Trend {
	if (current > previous) return 'up';
	if (current < previous) return 'down';
	return 'flat';
}

export async function listOrganizationUnits(organizationId: string): Promise<OrgUnitOption[]> {
	return prisma.orgUnit.findMany({
		where: { organizationId },
		orderBy: [{ type: 'asc' }, { name: 'asc' }],
		select: {
			id: true,
			name: true,
			type: true,
			parentUnitId: true,
			churchId: true,
		},
	});
}

export async function resolveOrganizationScope(input: {
	organizationId: string;
	orgUnitId?: string | null;
	includeDescendants?: boolean;
}): Promise<OrganizationScope> {
	const includeDescendants = input.includeDescendants ?? true;
	if (!input.orgUnitId) {
		return {
			selectedOrgUnitId: null,
			selectedOrgUnitName: null,
			includeDescendants,
			unitIds: [],
			churchIds: [],
		};
	}

	const units = await listOrganizationUnits(input.organizationId);
	const selectedUnit = units.find((unit) => unit.id === input.orgUnitId) ?? null;
	if (!selectedUnit) {
		return {
			selectedOrgUnitId: null,
			selectedOrgUnitName: null,
			includeDescendants,
			unitIds: [],
			churchIds: [],
		};
	}

	const scopedUnitIds = resolveScopedUnitIds(units, selectedUnit.id, includeDescendants);
	const scopedChurchIds = Array.from(
		new Set(
			units
				.filter((unit) => scopedUnitIds.includes(unit.id))
				.map((unit) => unit.churchId)
				.filter((churchId): churchId is string => Boolean(churchId))
		)
	);

	return {
		selectedOrgUnitId: selectedUnit.id,
		selectedOrgUnitName: selectedUnit.name,
		includeDescendants,
		unitIds: scopedUnitIds,
		churchIds: scopedChurchIds,
	};
}

export async function getExecutiveRollups(input: {
	organizationId: string;
	orgUnitId?: string | null;
	includeDescendants?: boolean;
}): Promise<ExecutiveRollups> {
	const organizationId = input.organizationId;
	const includeDescendants = input.includeDescendants ?? true;
	const now = new Date();
	const last30Start = new Date(now);
	last30Start.setDate(last30Start.getDate() - 30);
	const previous30Start = new Date(last30Start);
	previous30Start.setDate(previous30Start.getDate() - 30);

	const scope = await resolveOrganizationScope({
		organizationId,
		orgUnitId: input.orgUnitId,
		includeDescendants,
	});
	const scopedUnitIds = scope.unitIds;
	const scopedChurchIds = scope.churchIds;
	const scopeSelected = Boolean(scope.selectedOrgUnitId);

	const memberWhere =
		scopedChurchIds.length > 0 ? { churchId: { in: scopedChurchIds } } : { church: { organizationId } };
	const eventWhere =
		scopedChurchIds.length > 0 ? { churchId: { in: scopedChurchIds } } : { church: { organizationId } };
	const paymentWhere =
		scopedChurchIds.length > 0 ? { churchId: { in: scopedChurchIds } } : { church: { organizationId } };
	const assignmentWhere =
		scopedUnitIds.length > 0
			? { organizationId, orgUnitId: { in: scopedUnitIds } }
			: { organizationId };

	const [
		membersTotal,
		membersNewLast30Days,
		upcomingEvents,
		pastEventsLast30Days,
		givingLast30Days,
		givingPrevious30Days,
		activeAssignments,
		leadershipAssignments,
		churchCount,
		orgUnitCount,
		roleTemplateCount,
		organization,
	] = await Promise.all([
		prisma.member.count({
			where: memberWhere,
		}),
		prisma.member.count({
			where: {
				...memberWhere,
				createdAt: { gte: last30Start },
			},
		}),
		prisma.event.count({
			where: {
				...eventWhere,
				startDate: {
					gte: now,
					lte: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30),
				},
			},
		}),
		prisma.event.count({
			where: {
				...eventWhere,
				startDate: {
					gte: last30Start,
					lt: now,
				},
			},
		}),
		prisma.payment.aggregate({
			where: {
				...paymentWhere,
				status: 'COMPLETED',
				createdAt: { gte: last30Start },
			},
			_sum: { amount: true },
		}),
		prisma.payment.aggregate({
			where: {
				...paymentWhere,
				status: 'COMPLETED',
				createdAt: { gte: previous30Start, lt: last30Start },
			},
			_sum: { amount: true },
		}),
		prisma.unitRoleAssignment.count({
			where: {
				...assignmentWhere,
				status: 'ACTIVE',
			},
		}),
		prisma.unitRoleAssignment.count({
			where: {
				...assignmentWhere,
				status: 'ACTIVE',
				roleTemplate: { isLeadership: true },
			},
		}),
		prisma.church.count({
			where: { organizationId },
		}),
		prisma.orgUnit.count({
			where: { organizationId },
		}),
		prisma.roleTemplate.count({
			where: { organizationId },
		}),
		prisma.organization.findUnique({
			where: { id: organizationId },
			select: { settings: true },
		}),
	]);

	const givingCurrent = asNumber(givingLast30Days._sum.amount);
	const givingPrevious = asNumber(givingPrevious30Days._sum.amount);
	const settings =
		organization?.settings && typeof organization.settings === 'object' && !Array.isArray(organization.settings)
			? (organization.settings as Record<string, unknown>)
			: {};
	const securityPolicyValue =
		settings.securityPolicy && typeof settings.securityPolicy === 'object' && !Array.isArray(settings.securityPolicy)
			? settings.securityPolicy
			: null;

	const readinessItems = [
		{
			id: 'church',
			label: 'At least one church created',
			done: scopeSelected ? scopedChurchIds.length > 0 : churchCount > 0,
			href: '/dashboard/org',
		},
		{
			id: 'org-units',
			label: 'Org hierarchy configured',
			done: scopeSelected ? scopedUnitIds.length > 0 : orgUnitCount > 0,
			href: '/dashboard/org',
		},
		{
			id: 'role-templates',
			label: 'Role templates created',
			done: roleTemplateCount > 0,
			href: '/dashboard/org',
		},
		{
			id: 'staff-assignments',
			label: 'Active staff role assignments',
			done: activeAssignments > 0,
			href: '/dashboard/staff',
		},
		{
			id: 'policy',
			label: 'Admin security policy saved',
			done: Boolean(securityPolicyValue),
			href: '/dashboard/settings',
		},
	];

	const completedChecks = readinessItems.filter((item) => item.done).length;
	const totalChecks = readinessItems.length;
	const percent = totalChecks === 0 ? 0 : Math.round((completedChecks / totalChecks) * 100);

	return {
		scope: {
			selectedOrgUnitId: scope.selectedOrgUnitId,
			selectedOrgUnitName: scope.selectedOrgUnitName,
			includeDescendants,
			unitIds: scopedUnitIds,
			churchIds: scopedChurchIds,
		},
		members: {
			total: membersTotal,
			newLast30Days: membersNewLast30Days,
		},
		giving: {
			last30DaysAmount: givingCurrent,
			previous30DaysAmount: givingPrevious,
			trend: resolveTrend(givingCurrent, givingPrevious),
		},
		events: {
			upcoming30Days: upcomingEvents,
			past30Days: pastEventsLast30Days,
		},
		leadership: {
			activeAssignments,
			leadershipAssignments,
		},
		readiness: {
			completedChecks,
			totalChecks,
			percent,
			items: readinessItems,
		},
	};
}
