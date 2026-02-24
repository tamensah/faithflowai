import { prisma } from '@faithflow/database';

type Trend = 'up' | 'down' | 'flat';

export type ExecutiveRollups = {
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

export async function getExecutiveRollups(organizationId: string): Promise<ExecutiveRollups> {
	const now = new Date();
	const last30Start = new Date(now);
	last30Start.setDate(last30Start.getDate() - 30);
	const previous30Start = new Date(last30Start);
	previous30Start.setDate(previous30Start.getDate() - 30);

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
			where: { church: { organizationId } },
		}),
		prisma.member.count({
			where: {
				church: { organizationId },
				createdAt: { gte: last30Start },
			},
		}),
		prisma.event.count({
			where: {
				church: { organizationId },
				startDate: {
					gte: now,
					lte: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30),
				},
			},
		}),
		prisma.event.count({
			where: {
				church: { organizationId },
				startDate: {
					gte: last30Start,
					lt: now,
				},
			},
		}),
		prisma.payment.aggregate({
			where: {
				church: { organizationId },
				status: 'COMPLETED',
				createdAt: { gte: last30Start },
			},
			_sum: { amount: true },
		}),
		prisma.payment.aggregate({
			where: {
				church: { organizationId },
				status: 'COMPLETED',
				createdAt: { gte: previous30Start, lt: last30Start },
			},
			_sum: { amount: true },
		}),
		prisma.unitRoleAssignment.count({
			where: {
				organizationId,
				status: 'ACTIVE',
			},
		}),
		prisma.unitRoleAssignment.count({
			where: {
				organizationId,
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
			done: churchCount > 0,
			href: '/dashboard/org',
		},
		{
			id: 'org-units',
			label: 'Org hierarchy configured',
			done: orgUnitCount > 0,
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
