type CheckLevel = 'pass' | 'warn' | 'fail';

type CheckResult = {
	level: CheckLevel;
	title: string;
	detail: string;
};

const REQUIRED_ENV_KEYS = [
	'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
	'CLERK_SECRET_KEY',
	'STRIPE_SECRET_KEY',
	'STRIPE_WEBHOOK_SECRET',
	'PAYSTACK_SECRET_KEY',
	'RESEND_API_KEY',
	'RESEND_FROM_EMAIL',
	'RESEND_WEBHOOK_SECRET',
	'TWILIO_ACCOUNT_SID',
	'TWILIO_AUTH_TOKEN',
	'TWILIO_PHONE_NUMBER',
	'TWILIO_WHATSAPP_NUMBER',
	'FAITHFLOW_HEALTHCHECK_TOKEN',
];

const HEALTH_ENDPOINTS = [
	'/api/health/api-core',
	'/api/health/auth-guardrails',
	'/api/health/provider-ops',
	'/api/health/outbox-worker',
	'/api/health/reconciliation',
];

function parseFlag(flag: string): boolean {
	return process.argv.includes(flag);
}

function normalizeBaseUrl(value: string): string {
	return value.endsWith('/') ? value.slice(0, -1) : value;
}

function inferRepoFromRemote(): { owner: string; repo: string } | null {
	const remote = process.env.GIT_REMOTE_URL;
	if (!remote) return null;
	const cleaned = remote.replace(/\.git$/, '');
	const match = cleaned.match(/github\.com[:/](.+)\/(.+)$/);
	if (!match) return null;
	return { owner: match[1], repo: match[2] };
}

async function getOriginRemote(): Promise<string | null> {
	try {
		const { execSync } = await import('node:child_process');
		return execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
	} catch {
		return null;
	}
}

function readEnvChecks(): CheckResult[] {
	const missing = REQUIRED_ENV_KEYS.filter((key) => !process.env[key]?.trim());
	if (missing.length === 0) {
		return [
			{
				level: 'pass',
				title: 'Provider env keys',
				detail: `All required provider/auth keys are present (${REQUIRED_ENV_KEYS.length}).`,
			},
		];
	}
	return [
		{
			level: 'warn',
			title: 'Provider env keys',
			detail: `Missing ${missing.length} keys: ${missing.join(', ')}`,
		},
	];
}

async function runHealthChecks(): Promise<CheckResult[]> {
	const base = process.env.ADMIN_BASE_URL?.trim();
	if (!base) {
		return [
			{
				level: 'warn',
				title: 'Admin health endpoints',
				detail: 'Skipped: set ADMIN_BASE_URL to run live health checks.',
			},
		];
	}

	const url = normalizeBaseUrl(base);
	const token = process.env.FAITHFLOW_HEALTHCHECK_TOKEN?.trim();
	const headers: Record<string, string> = token
		? { Authorization: `Bearer ${token}` }
		: {};

	const results: CheckResult[] = [];
	for (const endpoint of HEALTH_ENDPOINTS) {
		try {
			const response = await fetch(`${url}${endpoint}`, { headers });
			if (response.status === 200) {
				results.push({
					level: 'pass',
					title: `Health ${endpoint}`,
					detail: 'Healthy (200).',
				});
				continue;
			}
			if (response.status === 401) {
				results.push({
					level: 'warn',
					title: `Health ${endpoint}`,
					detail: 'Unauthorized (401). Provide FAITHFLOW_HEALTHCHECK_TOKEN to verify protected health checks.',
				});
				continue;
			}
			if (response.status === 503) {
				results.push({
					level: 'warn',
					title: `Health ${endpoint}`,
					detail: 'Service unavailable (503). Usually indicates config or readiness thresholds are not met.',
				});
				continue;
			}
			results.push({
				level: 'fail',
				title: `Health ${endpoint}`,
				detail: `Unexpected status ${response.status}.`,
			});
		} catch (error) {
			results.push({
				level: 'fail',
				title: `Health ${endpoint}`,
				detail: error instanceof Error ? error.message : String(error),
			});
		}
	}
	return results;
}

async function runBranchProtectionChecks(): Promise<CheckResult[]> {
	const token = process.env.GITHUB_TOKEN?.trim();
	if (!token) {
		return [
			{
				level: 'warn',
				title: 'Branch protection',
				detail: 'Skipped: set GITHUB_TOKEN (repo admin scope) to verify required status checks.',
			},
		];
	}

	const origin = (await getOriginRemote()) ?? '';
	process.env.GIT_REMOTE_URL = origin;
	const repoInfo = inferRepoFromRemote();
	if (!repoInfo) {
		return [
			{
				level: 'fail',
				title: 'Branch protection',
				detail: 'Could not infer GitHub owner/repo from origin remote.',
			},
		];
	}

	const requiredCheck = 'workspace-dependency-guard';
	const branches = ['main', 'develop'];
	const results: CheckResult[] = [];

	for (const branch of branches) {
		try {
			const response = await fetch(
				`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/branches/${branch}/protection`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
						Accept: 'application/vnd.github+json',
						'X-GitHub-Api-Version': '2022-11-28',
					},
				}
			);

			if (response.status === 404) {
				results.push({
					level: 'warn',
					title: `Branch protection (${branch})`,
					detail: 'No protection config found.',
				});
				continue;
			}

			if (!response.ok) {
				results.push({
					level: 'fail',
					title: `Branch protection (${branch})`,
					detail: `GitHub API returned ${response.status}.`,
				});
				continue;
			}

			const payload = (await response.json()) as {
				required_status_checks?: {
					contexts?: string[];
					checks?: { context: string }[];
				};
			};

			const contexts = new Set<string>();
			for (const value of payload.required_status_checks?.contexts ?? []) contexts.add(value);
			for (const check of payload.required_status_checks?.checks ?? []) {
				if (check?.context) contexts.add(check.context);
			}

			if (contexts.has(requiredCheck)) {
				results.push({
					level: 'pass',
					title: `Branch protection (${branch})`,
					detail: `Required check present: ${requiredCheck}.`,
				});
			} else {
				results.push({
					level: 'warn',
					title: `Branch protection (${branch})`,
					detail: `Missing required check: ${requiredCheck}. Run pnpm ops:enforce-required-checks.`,
				});
			}
		} catch (error) {
			results.push({
				level: 'fail',
				title: `Branch protection (${branch})`,
				detail: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return results;
}

function printResults(results: CheckResult[]) {
	for (const result of results) {
		const marker = result.level === 'pass' ? 'PASS' : result.level === 'warn' ? 'WARN' : 'FAIL';
		console.log(`${marker} | ${result.title} | ${result.detail}`);
	}
}

async function main() {
	const strict = parseFlag('--strict');

	const checks: CheckResult[] = [];
	checks.push(...readEnvChecks());
	checks.push(...(await runHealthChecks()));
	checks.push(...(await runBranchProtectionChecks()));

	printResults(checks);

	const hasFailure = checks.some((item) => item.level === 'fail');
	const hasWarning = checks.some((item) => item.level === 'warn');

	if (hasFailure || (strict && hasWarning)) {
		process.exit(1);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
