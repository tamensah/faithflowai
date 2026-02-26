import { prisma } from '@faithflow/database';

type Trend = 'up' | 'down' | 'flat';
const EXECUTIVE_TREND_WEEKS = 12;

export type ExecutiveTrendPoint = {
	weekStart: string;
	label: string;
	value: number;
};

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
	trends: {
		members: ExecutiveTrendPoint[];
		giving: ExecutiveTrendPoint[];
		events: ExecutiveTrendPoint[];
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

type WeeklyBucket = {
	start: Date;
	key: string;
	label: string;
};

function startOfWeekUtc(date: Date): Date {
	const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	const day = utcDate.getUTCDay();
	const offset = (day + 6) % 7;
	utcDate.setUTCDate(utcDate.getUTCDate() - offset);
	utcDate.setUTCHours(0, 0, 0, 0);
	return utcDate;
}

function addDaysUtc(date: Date, days: number): Date {
	const next = new Date(date);
	next.setUTCDate(next.getUTCDate() + days);
	return next;
}

function buildWeeklyBuckets(now: Date, weeks: number): WeeklyBucket[] {
	const currentWeekStart = startOfWeekUtc(now);
	const buckets: WeeklyBucket[] = [];
	for (let index = weeks - 1; index >= 0; index -= 1) {
		const start = addDaysUtc(currentWeekStart, index * -7);
		buckets.push({
			start,
			key: start.toISOString(),
			label: start.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				timeZone: 'UTC',
			}),
		});
	}
	return buckets;
}

function getWeekKey(date: Date): string {
	return startOfWeekUtc(date).toISOString();
}

function buildTrendSeries<T>(
	rows: T[],
	buckets: WeeklyBucket[],
	getDate: (row: T) => Date,
	getValue: (row: T) => number
): ExecutiveTrendPoint[] {
	const totals = new Map<string, number>();
	for (const bucket of buckets) totals.set(bucket.key, 0);

	for (const row of rows) {
		const key = getWeekKey(getDate(row));
		if (!totals.has(key)) continue;
		const nextValue = (totals.get(key) ?? 0) + getValue(row);
		totals.set(key, nextValue);
	}

	return buckets.map((bucket) => ({
		weekStart: bucket.key,
		label: bucket.label,
		value: totals.get(bucket.key) ?? 0,
	}));
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
	const trendBuckets = buildWeeklyBuckets(now, EXECUTIVE_TREND_WEEKS);
	const trendStart = trendBuckets[0]?.start ?? previous30Start;

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
		memberTrendRows,
		givingTrendRows,
		eventTrendRows,
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
		prisma.member.findMany({
			where: {
				...memberWhere,
				createdAt: { gte: trendStart, lte: now },
			},
			select: {
				createdAt: true,
			},
		}),
		prisma.payment.findMany({
			where: {
				...paymentWhere,
				status: 'COMPLETED',
				createdAt: { gte: trendStart, lte: now },
			},
			select: {
				createdAt: true,
				amount: true,
			},
		}),
		prisma.event.findMany({
			where: {
				...eventWhere,
				startDate: { gte: trendStart, lte: now },
			},
			select: {
				startDate: true,
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
	const membersTrend = buildTrendSeries(memberTrendRows, trendBuckets, (row) => row.createdAt, () => 1);
	const givingTrend = buildTrendSeries(
		givingTrendRows,
		trendBuckets,
		(row) => row.createdAt,
		(row) => asNumber(row.amount)
	);
	const eventsTrend = buildTrendSeries(eventTrendRows, trendBuckets, (row) => row.startDate, () => 1);

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
		trends: {
			members: membersTrend,
			giving: givingTrend,
			events: eventsTrend,
		},
	};
}
