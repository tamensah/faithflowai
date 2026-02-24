type EndpointResult = {
	endpoint: string;
	status: number;
	ok: boolean;
	mode: 'authenticated' | 'unauthenticated';
	summary: string;
};

const ENDPOINTS = [
	'/api/health/api-core',
	'/api/health/provider-ops',
	'/api/health/outbox-worker',
	'/api/health/reconciliation',
];

function normalizeBaseUrl(value: string): string {
	return value.endsWith('/') ? value.slice(0, -1) : value;
}

async function callEndpoint(baseUrl: string, endpoint: string, token: string | null): Promise<EndpointResult> {
	const url = `${baseUrl}${endpoint}`;
	const headers: Record<string, string> = {};
	if (token) headers.Authorization = `Bearer ${token}`;

	const response = await fetch(url, { headers });
	const mode: EndpointResult['mode'] = token ? 'authenticated' : 'unauthenticated';
	const contentType = response.headers.get('content-type') ?? '';
	const payload = contentType.includes('application/json')
		? await response.json().catch(() => ({}))
		: await response.text().catch(() => '');

	if (token) {
		const healthyStatus = response.status === 200 || response.status === 503;
		return {
			endpoint,
			status: response.status,
			ok: healthyStatus,
			mode,
			summary:
				typeof payload === 'object' && payload
					? JSON.stringify(payload)
					: String(payload).slice(0, 200),
		};
	}

	const expectedUnauthenticated = response.status === 401 || response.status === 503;
	return {
		endpoint,
		status: response.status,
		ok: expectedUnauthenticated,
		mode,
		summary:
			typeof payload === 'object' && payload
				? JSON.stringify(payload)
				: String(payload).slice(0, 200),
	};
}

async function main() {
	const baseUrl = normalizeBaseUrl(
		process.env.ADMIN_BASE_URL?.trim() || 'https://admin-gamma-beryl.vercel.app'
	);
	const token = process.env.FAITHFLOW_HEALTHCHECK_TOKEN?.trim() || null;

	const results: EndpointResult[] = [];
	for (const endpoint of ENDPOINTS) {
		results.push(await callEndpoint(baseUrl, endpoint, token));
	}

	for (const result of results) {
		console.log(
			`${result.ok ? 'PASS' : 'FAIL'} | ${result.mode.toUpperCase()} | ${result.status} | ${result.endpoint}`
		);
	}

	const failed = results.filter((result) => !result.ok);
	if (failed.length > 0) {
		console.error('\nAdmin health smoke failed for endpoints:');
		for (const failure of failed) {
			console.error(`- ${failure.endpoint} (status=${failure.status})`);
		}
		process.exit(1);
	}

	console.log(
		`\nAdmin health smoke passed (${token ? 'authenticated' : 'unauthenticated'} mode).`
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
