import { prisma } from '@faithflow/database';

type SignalLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type AiInsightCard = {
	key: string;
	title: string;
	level: SignalLevel;
	summary: string;
	explanation: string;
	metrics: Array<{ label: string; value: string }>;
	recommendedAction: string;
};

function formatCurrency(value: number): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 0,
	}).format(value);
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

function resolveLevel(percentageChange: number): SignalLevel {
	if (percentageChange <= -30) return 'HIGH';
	if (percentageChange <= -15) return 'MEDIUM';
	return 'LOW';
}

function resolveLeadershipLevel(coveragePercent: number, unitsWithoutLeadership: number): SignalLevel {
	if (coveragePercent < 40 || unitsWithoutLeadership >= 10) return 'HIGH';
	if (coveragePercent < 70 || unitsWithoutLeadership >= 3) return 'MEDIUM';
	return 'LOW';
}

function percentChange(current: number, previous: number): number {
	if (previous <= 0) return current > 0 ? 100 : 0;
	return ((current - previous) / previous) * 100;
}

export async function getAiInsights(organizationId: string): Promise<AiInsightCard[]> {
	const now = new Date();
	const last30Start = new Date(now);
	last30Start.setDate(last30Start.getDate() - 30);
	const previous30Start = new Date(last30Start);
	previous30Start.setDate(previous30Start.getDate() - 30);
	const inactiveWindowStart = new Date(now);
	inactiveWindowStart.setDate(inactiveWindowStart.getDate() - 60);

	const [
		eventsCurrent,
		eventsPrevious,
		givingCurrent,
		givingPrevious,
		careCandidates,
		totalUnits,
		unitsWithLeadership,
		activeLeadershipAssignments,
	] = await Promise.all([
		prisma.event.count({
			where: {
				church: { organizationId },
				startDate: { gte: last30Start, lt: now },
			},
		}),
		prisma.event.count({
			where: {
				church: { organizationId },
				startDate: { gte: previous30Start, lt: last30Start },
			},
		}),
		prisma.payment.aggregate({
			where: {
				church: { organizationId },
				status: 'COMPLETED',
				createdAt: { gte: last30Start, lt: now },
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
		prisma.member.count({
			where: {
				church: { organizationId },
				events: {
					none: {
						startDate: { gte: inactiveWindowStart, lt: now },
					},
				},
			},
		}),
		prisma.orgUnit.count({
			where: {
				organizationId,
			},
		}),
		prisma.orgUnit.count({
			where: {
				organizationId,
				roleAssignments: {
					some: {
						status: 'ACTIVE',
						roleTemplate: { isLeadership: true },
					},
				},
			},
		}),
		prisma.unitRoleAssignment.count({
			where: {
				organizationId,
				status: 'ACTIVE',
				roleTemplate: { isLeadership: true },
			},
		}),
	]);

	const givingCurrentAmount = asNumber(givingCurrent._sum.amount);
	const givingPreviousAmount = asNumber(givingPrevious._sum.amount);
	const eventChange = percentChange(eventsCurrent, eventsPrevious);
	const givingChange = percentChange(givingCurrentAmount, givingPreviousAmount);

	const attendanceLevel = resolveLevel(eventChange);
	const givingLevel = resolveLevel(givingChange);
	const careLevel: SignalLevel = careCandidates >= 50 ? 'HIGH' : careCandidates >= 20 ? 'MEDIUM' : 'LOW';
	const leadershipCoveragePercent =
		totalUnits > 0 ? Math.round((unitsWithLeadership / totalUnits) * 100) : 100;
	const unitsWithoutLeadership = Math.max(0, totalUnits - unitsWithLeadership);
	const leadershipLevel = resolveLeadershipLevel(leadershipCoveragePercent, unitsWithoutLeadership);

	return [
		{
			key: 'attendance-drop',
			title: 'Attendance momentum',
			level: attendanceLevel,
			summary:
				eventChange < 0
					? `Events are down ${Math.abs(Math.round(eventChange))}% against the prior 30-day window.`
					: 'Event cadence is stable or improving against the prior 30-day window.',
			explanation:
				'Signal is computed from event count trend (last 30 days vs previous 30 days) across the organization.',
			metrics: [
				{ label: 'Events (last 30d)', value: String(eventsCurrent) },
				{ label: 'Events (prev 30d)', value: String(eventsPrevious) },
				{ label: 'Change', value: `${Math.round(eventChange)}%` },
			],
			recommendedAction:
				attendanceLevel === 'LOW'
					? 'Maintain cadence and monitor next two weeks.'
					: 'Review event schedule by unit and run targeted member outreach.',
		},
		{
			key: 'giving-risk',
			title: 'Giving risk',
			level: givingLevel,
			summary:
				givingChange < 0
					? `Giving is down ${Math.abs(Math.round(givingChange))}% compared to the previous 30-day window.`
					: 'Giving is stable or growing compared to the previous 30-day window.',
			explanation:
				'Signal is computed from completed payment totals (USD-normalized display) over rolling 30-day windows.',
			metrics: [
				{ label: 'Giving (last 30d)', value: formatCurrency(givingCurrentAmount) },
				{ label: 'Giving (prev 30d)', value: formatCurrency(givingPreviousAmount) },
				{ label: 'Change', value: `${Math.round(givingChange)}%` },
			],
			recommendedAction:
				givingLevel === 'LOW'
					? 'Track as healthy and keep campaign cadence.'
					: 'Prioritize campaign review and reconcile provider outcomes in Provider Ops.',
		},
		{
			key: 'care-routing',
			title: 'Care routing suggestions',
			level: careLevel,
			summary: `${careCandidates} members have no event attendance in the last 60 days.`,
			explanation:
				'Signal is based on members without recent event participation; intended for pastoral follow-up routing.',
			metrics: [
				{ label: 'Inactive members (60d)', value: String(careCandidates) },
				{ label: 'Window', value: 'Rolling 60 days' },
				{ label: 'Source', value: 'Member-event associations' },
			],
			recommendedAction:
				careLevel === 'LOW'
					? 'Continue standard follow-up cadence.'
					: 'Route inactive member list to care team and assign contact owners.',
		},
		{
			key: 'leadership-coverage',
			title: 'Leadership coverage',
			level: leadershipLevel,
			summary:
				unitsWithoutLeadership > 0
					? `${unitsWithoutLeadership} org unit(s) currently have no active leadership assignment.`
					: 'All active org units currently have leadership coverage.',
			explanation:
				'Signal is computed from active leadership role assignments mapped to organizational units.',
			metrics: [
				{ label: 'Units with leadership', value: `${unitsWithLeadership}/${totalUnits}` },
				{ label: 'Coverage', value: `${leadershipCoveragePercent}%` },
				{ label: 'Active leadership roles', value: String(activeLeadershipAssignments) },
			],
			recommendedAction:
				leadershipLevel === 'LOW'
					? 'Maintain current assignment cadence and review succession monthly.'
					: 'Use Staff Console to assign leaders to uncovered units and schedule follow-up reviews.',
		},
	];
}
