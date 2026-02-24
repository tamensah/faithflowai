export type ModuleGate = {
	locked: boolean;
	reason: string;
	nextSteps: string[];
};

function parseBooleanEnv(name: string, fallback: boolean): boolean {
	const value = process.env[name];
	if (!value) return fallback;
	const normalized = value.trim().toLowerCase();
	if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
	if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
	return fallback;
}

export function getModuleGate(module: 'analytics' | 'groups'): ModuleGate {
	if (module === 'analytics') {
		return {
			locked: parseBooleanEnv('FAITHFLOW_LOCK_ANALYTICS', true),
			reason:
				'Cross-unit analytics is gated until entitlement and scoped rollup parity is complete for all modules.',
			nextSteps: [
				'Set up organization hierarchy and role assignments.',
				'Complete provider and reconciliation checks in Provider Ops.',
				'Enable analytics module for this environment when rollout is approved.',
			],
		};
	}

	return {
		locked: parseBooleanEnv('FAITHFLOW_LOCK_GROUPS', true),
		reason:
			'Small groups is gated while scoped policy controls and ministry workflows are being finalized.',
		nextSteps: [
			'Configure org units and leadership role templates.',
			'Validate member and event drill-down flows for your active unit scope.',
			'Enable groups module for this environment when rollout is approved.',
		],
	};
}
