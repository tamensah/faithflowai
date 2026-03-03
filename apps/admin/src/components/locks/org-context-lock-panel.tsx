import { ModuleLockPanel } from './module-lock-panel';

export function OrgContextLockPanel({ moduleName }: { moduleName: string }) {
	return (
		<ModuleLockPanel
			title={`${moduleName} requires organization context`}
			reason="No active Clerk organization is selected for this admin session, so scoped data and actions are locked."
			nextSteps={[
				{ label: 'Use the organization switcher in the top navigation.', href: '/dashboard' },
				{ label: 'If needed, create/prepare org hierarchy in Organization Builder.', href: '/dashboard/org' },
				{ label: 'Return to this module after selecting the target organization.' },
			]}
			cta={[
				{ label: 'Open overview', href: '/dashboard' },
				{ label: 'Open organization builder', href: '/dashboard/org' },
			]}
		/>
	);
}
