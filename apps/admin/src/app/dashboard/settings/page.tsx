import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@faithflow/database';
import { OrgContextLockPanel } from '@/components/locks/org-context-lock-panel';
import { SecurityPolicyCard } from '@/components/org/security-policy-card';

function formatViolationReason(reason: string | null): string {
	switch (reason) {
		case 'EMAIL_NOT_VERIFIED':
			return 'Verified email required';
		case 'MFA_REQUIRED':
			return 'MFA required';
		case 'SESSION_AGE_EXCEEDED':
			return 'Session age exceeded';
		case 'EMAIL_DOMAIN_NOT_ALLOWED':
			return 'Email domain not allowed';
		default:
			return reason ?? 'Unknown';
	}
}

export default async function SettingsPage() {
	const { orgId } = await auth();
	if (!orgId) {
		return (
			<div className="space-y-4">
				<h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
				<OrgContextLockPanel moduleName="Settings" />
			</div>
		);
	}

	const guardrailBlocks = await prisma.auditEvent.findMany({
		where: {
			organizationId: orgId,
			action: 'AUTH_GUARDRAIL_BLOCKED',
		},
		orderBy: { createdAt: 'desc' },
		take: 8,
		select: {
			id: true,
			actorId: true,
			reason: true,
			createdAt: true,
		},
	});

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
				<p className="mt-2 text-sm text-gray-600">
					System settings are moving to scoped organization controls.
				</p>
			</div>

			<div className="rounded-lg border border-gray-200 bg-white p-5">
				<h2 className="text-base font-semibold text-gray-900">
					Organization configuration
				</h2>
				<p className="mt-2 text-sm text-gray-600">
					Use the Organization Builder for org units, role templates, assignments, and
					audit traces.
				</p>
				<Link
					href="/dashboard/org"
					className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
				>
					Open Organization Builder
				</Link>
			</div>

			<SecurityPolicyCard />

			<div className="rounded-lg border border-gray-200 bg-white p-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 className="text-base font-semibold text-gray-900">Recent guardrail blocks</h2>
						<p className="mt-1 text-sm text-gray-600">
							Latest privileged access denials for this organization.
						</p>
					</div>
					<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
						{guardrailBlocks.length} recent events
					</span>
				</div>
				{guardrailBlocks.length ? (
					<div className="mt-4 overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-200 text-sm">
							<thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
								<tr>
									<th className="px-3 py-2">Reason</th>
									<th className="px-3 py-2">Actor</th>
									<th className="px-3 py-2">When</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-200">
								{guardrailBlocks.map((event) => (
									<tr key={event.id}>
										<td className="px-3 py-2 font-medium text-slate-900">
											{formatViolationReason(event.reason)}
										</td>
										<td className="px-3 py-2 text-slate-700">{event.actorId}</td>
										<td className="px-3 py-2 text-slate-600">
											{new Date(event.createdAt).toLocaleString()}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<p className="mt-4 text-sm text-slate-600">
						No guardrail blocks recorded yet for this organization.
					</p>
				)}
			</div>
		</div>
	);
}
