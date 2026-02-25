import { prisma } from '@faithflow/database';

export type BillingProvider = 'STRIPE' | 'PAYSTACK' | 'MANUAL';
export type BillingInterval = 'MONTHLY' | 'YEARLY' | 'ONE_TIME';
export type EntitlementSource = 'MANUAL' | 'BILLING';

export type AddonCatalogItem = {
	code: string;
	name: string;
	description: string;
	active: boolean;
	modules: string[];
	billing: {
		provider: BillingProvider;
		currency: string;
		amountCents: number;
		interval: BillingInterval;
		externalPriceId: string | null;
	};
};

export type AddonEntitlement = {
	code: string;
	enabled: boolean;
	source: EntitlementSource;
	billingReference: string | null;
	activatedAt: string;
	updatedAt: string;
};

export type AddonState = {
	tenantId: string;
	tenantName: string;
	plan: string;
	catalog: AddonCatalogItem[];
	entitlements: Record<string, AddonEntitlement>;
};

const DEFAULT_CATALOG: AddonCatalogItem[] = [
	{
		code: 'STREAMING_SUITE',
		name: 'Streaming Suite',
		description: 'Live stream operations, schedules, and readiness tools.',
		active: true,
		modules: ['streaming'],
		billing: {
			provider: 'STRIPE',
			currency: 'USD',
			amountCents: 4900,
			interval: 'MONTHLY',
			externalPriceId: null,
		},
	},
	{
		code: 'FACILITIES_SUITE',
		name: 'Facilities Suite',
		description: 'Facility reservations, maintenance, and ops controls.',
		active: true,
		modules: ['facilities'],
		billing: {
			provider: 'PAYSTACK',
			currency: 'GHS',
			amountCents: 8900,
			interval: 'MONTHLY',
			externalPriceId: null,
		},
	},
	{
		code: 'BIBLE_SCHOOL_SUITE',
		name: 'Bible School Suite',
		description: 'Class cohorts, enrollment workflows, and training operations.',
		active: true,
		modules: ['bible-school'],
		billing: {
			provider: 'STRIPE',
			currency: 'USD',
			amountCents: 6900,
			interval: 'MONTHLY',
			externalPriceId: null,
		},
	},
];

function asRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return fallback;
}

function normalizeCode(value: string): string {
	return value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
}

function parseCatalog(value: unknown): AddonCatalogItem[] {
	if (!Array.isArray(value)) return DEFAULT_CATALOG;
	const parsed = value
		.map((item) => {
			const record = asRecord(item);
			const billing = asRecord(record.billing);
			const modules = Array.isArray(record.modules)
				? record.modules
						.filter((entry) => typeof entry === 'string')
						.map((entry) => entry.trim().toLowerCase())
						.filter(Boolean)
				: [];
			const code = normalizeCode(asString(record.code));
			if (!code) return null;
			return {
				code,
				name: asString(record.name, code),
				description: asString(record.description),
				active: asBoolean(record.active, true),
				modules,
				billing: {
					provider: (['STRIPE', 'PAYSTACK', 'MANUAL'].includes(asString(billing.provider))
						? asString(billing.provider)
						: 'MANUAL') as BillingProvider,
					currency: asString(billing.currency, 'USD').toUpperCase(),
					amountCents: Math.max(0, Math.floor(asNumber(billing.amountCents, 0))),
					interval: (['MONTHLY', 'YEARLY', 'ONE_TIME'].includes(asString(billing.interval))
						? asString(billing.interval)
						: 'MONTHLY') as BillingInterval,
					externalPriceId: asString(billing.externalPriceId) || null,
				},
			} as AddonCatalogItem;
		})
		.filter((item): item is AddonCatalogItem => Boolean(item));

	return parsed.length ? parsed : DEFAULT_CATALOG;
}

function parseEntitlements(value: unknown): Record<string, AddonEntitlement> {
	const source = asRecord(value);
	const entries = Object.entries(source).map(([code, payload]) => {
		const item = asRecord(payload);
		const normalizedCode = normalizeCode(code);
		return [
			normalizedCode,
			{
				code: normalizedCode,
				enabled: asBoolean(item.enabled, false),
				source: (['MANUAL', 'BILLING'].includes(asString(item.source))
					? asString(item.source)
					: 'MANUAL') as EntitlementSource,
				billingReference: asString(item.billingReference) || null,
				activatedAt: asString(item.activatedAt, new Date(0).toISOString()),
				updatedAt: asString(item.updatedAt, new Date(0).toISOString()),
			} satisfies AddonEntitlement,
		] as const;
	});

	return Object.fromEntries(entries);
}

function extractAddonSettings(settings: unknown): {
	catalog: AddonCatalogItem[];
	entitlements: Record<string, AddonEntitlement>;
} {
	const root = asRecord(settings);
	const addons = asRecord(root.addons);
	return {
		catalog: parseCatalog(addons.catalog),
		entitlements: parseEntitlements(addons.entitlements),
	};
}

export function isAddonEnabled(state: AddonState, code: string): boolean {
	const normalizedCode = normalizeCode(code);
	const catalogItem = state.catalog.find((item) => item.code === normalizedCode);
	if (!catalogItem || !catalogItem.active) return false;
	return state.entitlements[normalizedCode]?.enabled === true;
}

export async function getAddonStateForOrganization(organizationId: string): Promise<AddonState> {
	const organization = await prisma.organization.findUnique({
		where: { id: organizationId },
		select: {
			tenant: {
				select: {
					id: true,
					name: true,
					plan: true,
					settings: true,
				},
			},
		},
	});

	if (!organization?.tenant) {
		throw new Error('Tenant context not found for organization.');
	}

	const parsed = extractAddonSettings(organization.tenant.settings);
	return {
		tenantId: organization.tenant.id,
		tenantName: organization.tenant.name,
		plan: organization.tenant.plan,
		catalog: parsed.catalog,
		entitlements: parsed.entitlements,
	};
}

export async function upsertAddonCatalogItem(input: {
	tenantId: string;
	item: AddonCatalogItem;
}): Promise<AddonState> {
	const tenant = await prisma.tenant.findUnique({
		where: { id: input.tenantId },
		select: { id: true, name: true, plan: true, settings: true },
	});
	if (!tenant) throw new Error('Tenant not found.');

	const parsed = extractAddonSettings(tenant.settings);
	const normalizedItem: AddonCatalogItem = {
		...input.item,
		code: normalizeCode(input.item.code),
		name: input.item.name.trim(),
		description: input.item.description.trim(),
		modules: input.item.modules.map((item) => item.trim().toLowerCase()).filter(Boolean),
		billing: {
			...input.item.billing,
			currency: input.item.billing.currency.toUpperCase(),
			amountCents: Math.max(0, Math.floor(input.item.billing.amountCents)),
			externalPriceId: input.item.billing.externalPriceId || null,
		},
	};

	const existing = parsed.catalog.filter((item) => item.code !== normalizedItem.code);
	const catalog = [...existing, normalizedItem].sort((left, right) => left.code.localeCompare(right.code));
	const nextSettings = {
		...asRecord(tenant.settings),
		addons: {
			catalog,
			entitlements: parsed.entitlements,
			updatedAt: new Date().toISOString(),
		},
	};

	await prisma.tenant.update({
		where: { id: tenant.id },
		data: { settings: nextSettings },
	});

	return {
		tenantId: tenant.id,
		tenantName: tenant.name,
		plan: tenant.plan,
		catalog,
		entitlements: parsed.entitlements,
	};
}

export async function setTenantAddonEntitlement(input: {
	tenantId: string;
	code: string;
	enabled: boolean;
	source: EntitlementSource;
	billingReference?: string | null;
}): Promise<AddonState> {
	const tenant = await prisma.tenant.findUnique({
		where: { id: input.tenantId },
		select: { id: true, name: true, plan: true, settings: true },
	});
	if (!tenant) throw new Error('Tenant not found.');

	const parsed = extractAddonSettings(tenant.settings);
	const code = normalizeCode(input.code);
	const existing = parsed.entitlements[code];
	const nowIso = new Date().toISOString();
	const entitlements: Record<string, AddonEntitlement> = {
		...parsed.entitlements,
		[code]: {
			code,
			enabled: input.enabled,
			source: input.source,
			billingReference: input.billingReference ?? null,
			activatedAt: existing?.activatedAt ?? nowIso,
			updatedAt: nowIso,
		},
	};

	const nextSettings = {
		...asRecord(tenant.settings),
		addons: {
			catalog: parsed.catalog,
			entitlements,
			updatedAt: nowIso,
		},
	};

	await prisma.tenant.update({
		where: { id: tenant.id },
		data: { settings: nextSettings },
	});

	return {
		tenantId: tenant.id,
		tenantName: tenant.name,
		plan: tenant.plan,
		catalog: parsed.catalog,
		entitlements,
	};
}
