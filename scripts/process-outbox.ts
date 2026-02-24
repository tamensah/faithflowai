import { prisma } from '@faithflow/database';
import {
	listOrganizationsWithPendingOutbox,
	processOutboxBatch,
	type OutboxProcessResult,
} from '../apps/api/src/reliability/outbox-processor';
import type { OutboxDomain } from '../apps/api/src/reliability/provider-dispatch';

type Args = {
	domain?: OutboxDomain;
	organizationId?: string;
	maxEvents: number;
};

function parseArgs(argv: string[]): Args {
	const args: Args = { maxEvents: 25 };
	for (const token of argv) {
		if (token.startsWith('--domain=')) {
			const value = token.split('=')[1]?.toUpperCase();
			if (value === 'PAYMENT' || value === 'COMMS') {
				args.domain = value;
			}
		} else if (token.startsWith('--organizationId=')) {
			const value = token.split('=')[1];
			if (value) args.organizationId = value;
		} else if (token.startsWith('--maxEvents=')) {
			const raw = Number(token.split('=')[1]);
			if (Number.isFinite(raw)) {
				args.maxEvents = Math.min(Math.max(Math.floor(raw), 1), 100);
			}
		}
	}
	return args;
}

async function runDomain(
	domain: OutboxDomain,
	organizationId: string | undefined,
	maxEvents: number
): Promise<OutboxProcessResult[]> {
	const orgIds = organizationId
		? [organizationId]
		: await listOrganizationsWithPendingOutbox(domain);

	const results: OutboxProcessResult[] = [];
	for (const orgId of orgIds) {
		results.push(
			await processOutboxBatch({
				organizationId: orgId,
				domain,
				maxEvents,
			})
		);
	}
	return results;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const domains: OutboxDomain[] = args.domain ? [args.domain] : ['PAYMENT', 'COMMS'];

	const allResults: OutboxProcessResult[] = [];
	for (const domain of domains) {
		const results = await runDomain(domain, args.organizationId, args.maxEvents);
		allResults.push(...results);
	}

	const summary = allResults.reduce(
		(acc, result) => {
			acc.claimed += result.claimed;
			acc.processed += result.processed;
			acc.failed += result.failed;
			acc.deadLettered += result.deadLettered;
			return acc;
		},
		{ claimed: 0, processed: 0, failed: 0, deadLettered: 0 }
	);

	console.log(
		JSON.stringify(
			{
				ranAt: new Date().toISOString(),
				args,
				summary,
				results: allResults,
			},
			null,
			2
		)
	);
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
