import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@faithflow/database';
import { createAppCaller } from '@/lib/app-caller';
import { requireDatabaseForApi } from '@/lib/database-guard';
import {
	getAddonStateForOrganization,
	setTenantAddonEntitlement,
	upsertAddonCatalogItem,
	type AddonCatalogItem,
	type BillingInterval,
	type BillingProvider,
	type EntitlementSource,
} from '@/lib/addon-entitlements';

const WRITER_ROLES = new Set(['PLATFORM_SUPER_ADMIN', 'ORG_ADMIN']);

function canWrite(roles: string[]): boolean {
	return roles.some((role) => WRITER_ROLES.has(role));
}

function parseHttpStatus(error: unknown): number {
	const message = error instanceof Error ? error.message.toLowerCase() : '';
	if (message.includes('unauthorized')) return 401;
	if (message.includes('forbidden')) return 403;
	if (message.includes('not found')) return 404;
	if (message.includes('invalid') || message.includes('required')) return 400;
	return 500;
}

export async function GET() {
	const dbUnavailable = requireDatabaseForApi('addons.get');
	if (dbUnavailable) return dbUnavailable;

	try {
		const { actor } = await createAppCaller();
		const state = await getAddonStateForOrganization(actor.organizationId);
		return NextResponse.json({ state });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to load add-on state';
		return NextResponse.json({ error: message }, { status: parseHttpStatus(error) });
	}
}

export async function POST(request: NextRequest) {
	const dbUnavailable = requireDatabaseForApi('addons.post');
	if (dbUnavailable) return dbUnavailable;

	const payload = (await request.json().catch(() => ({}))) as {
		action?: 'upsertCatalogItem';
		item?: {
			code?: string;
			name?: string;
			description?: string;
			active?: boolean;
			modules?: string[];
			billing?: {
				provider?: BillingProvider;
				currency?: string;
				amountCents?: number;
				interval?: BillingInterval;
				externalPriceId?: string | null;
			};
		};
	};

	if (payload.action !== 'upsertCatalogItem') {
		return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
	}
	if (!payload.item?.code || !payload.item?.name || !payload.item.billing) {
		return NextResponse.json({ error: 'item.code, item.name, and item.billing are required.' }, { status: 400 });
	}

	try {
		const { actor } = await createAppCaller();
		if (!canWrite(actor.roles)) {
			return NextResponse.json({ error: 'Forbidden: add-on catalog management requires admin role.' }, { status: 403 });
		}

		const organization = await prisma.organization.findUnique({
			where: { id: actor.organizationId },
			select: { tenantId: true },
		});
		if (!organization) {
			return NextResponse.json({ error: 'Organization not found.' }, { status: 404 });
		}

		const item: AddonCatalogItem = {
			code: payload.item.code,
			name: payload.item.name,
			description: payload.item.description ?? '',
			active: payload.item.active ?? true,
			modules: payload.item.modules ?? [],
			billing: {
				provider: payload.item.billing.provider ?? 'MANUAL',
				currency: payload.item.billing.currency ?? 'USD',
				amountCents: Number(payload.item.billing.amountCents ?? 0),
				interval: payload.item.billing.interval ?? 'MONTHLY',
				externalPriceId: payload.item.billing.externalPriceId ?? null,
			},
		};

		const state = await upsertAddonCatalogItem({
			tenantId: organization.tenantId,
			item,
		});
		return NextResponse.json({ state });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to save add-on catalog item';
		return NextResponse.json({ error: message }, { status: parseHttpStatus(error) });
	}
}

export async function PATCH(request: NextRequest) {
	const dbUnavailable = requireDatabaseForApi('addons.patch');
	if (dbUnavailable) return dbUnavailable;

	const payload = (await request.json().catch(() => ({}))) as {
		action?: 'setEntitlement';
		code?: string;
		enabled?: boolean;
		source?: EntitlementSource;
		billingReference?: string | null;
	};

	if (payload.action !== 'setEntitlement') {
		return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
	}
	if (!payload.code || typeof payload.enabled !== 'boolean') {
		return NextResponse.json({ error: 'code and enabled are required.' }, { status: 400 });
	}

	try {
		const { actor } = await createAppCaller();
		if (!canWrite(actor.roles)) {
			return NextResponse.json({ error: 'Forbidden: entitlement management requires admin role.' }, { status: 403 });
		}

		const organization = await prisma.organization.findUnique({
			where: { id: actor.organizationId },
			select: { tenantId: true },
		});
		if (!organization) {
			return NextResponse.json({ error: 'Organization not found.' }, { status: 404 });
		}

		const state = await setTenantAddonEntitlement({
			tenantId: organization.tenantId,
			code: payload.code,
			enabled: payload.enabled,
			source: payload.source ?? 'MANUAL',
			billingReference: payload.billingReference ?? null,
		});

		return NextResponse.json({ state });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to set entitlement';
		return NextResponse.json({ error: message }, { status: parseHttpStatus(error) });
	}
}
