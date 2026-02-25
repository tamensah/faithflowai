import { prisma } from '@faithflow/database';
import type { Prisma } from '@faithflow/database';

type JsonRecord = Record<string, unknown>;
type BillingProvider = 'STRIPE' | 'PAYSTACK';
type BillingPaymentStatus = 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PENDING';

const ADDON_CODE_FIELDS = [
	'addonCode',
	'addon_code',
	'addOnCode',
	'addon',
	'moduleCode',
	'module_code',
	'entitlementCode',
	'entitlement_code',
] as const;

function asRecord(value: unknown): JsonRecord {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return value as JsonRecord;
}

function asString(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeAddonCode(value: string | null): string | null {
	if (!value) return null;
	const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
	return normalized || null;
}

function findAddonCodeInRecord(record: JsonRecord): string | null {
	for (const key of ADDON_CODE_FIELDS) {
		const direct = asString(record[key]);
		if (direct) return normalizeAddonCode(direct);
	}

	const addonRecord = asRecord(record.addon);
	for (const key of ['code', 'addonCode', 'addon_code']) {
		const nested = asString(addonRecord[key]);
		if (nested) return normalizeAddonCode(nested);
	}

	const subscriptionRecord = asRecord(record.subscription);
	for (const key of ['addonCode', 'addon_code']) {
		const nested = asString(subscriptionRecord[key]);
		if (nested) return normalizeAddonCode(nested);
	}

	const metadataRecord = asRecord(record.metadata);
	for (const key of ADDON_CODE_FIELDS) {
		const nested = asString(metadataRecord[key]);
		if (nested) return normalizeAddonCode(nested);
	}

	const customFields = Array.isArray(metadataRecord.custom_fields) ? metadataRecord.custom_fields : [];
	for (const field of customFields) {
		const customField = asRecord(field);
		const variableName = asString(customField.variable_name)?.toLowerCase();
		if (!variableName) continue;
		if (variableName.includes('addon') || variableName.includes('entitlement')) {
			const value = asString(customField.value);
			if (value) return normalizeAddonCode(value);
		}
	}

	return null;
}

export function resolveAddonCodeFromPaymentContext(input: {
	paymentMetadata?: unknown;
	providerPayload?: unknown;
}): string | null {
	const paymentMetadata = asRecord(input.paymentMetadata);
	const fromPaymentMetadata = findAddonCodeInRecord(paymentMetadata);
	if (fromPaymentMetadata) return fromPaymentMetadata;

	const payloadRoot = asRecord(input.providerPayload);
	const payloadData = asRecord(payloadRoot.data);
	const payloadObject = asRecord(payloadData.object);

	return (
		findAddonCodeInRecord(payloadRoot) ??
		findAddonCodeInRecord(payloadData) ??
		findAddonCodeInRecord(payloadObject) ??
		null
	);
}

function resolveEntitlementEnabledFromStatus(status: BillingPaymentStatus): boolean | null {
	if (status === 'COMPLETED') return true;
	if (status === 'FAILED' || status === 'REFUNDED') return false;
	return null;
}

export async function syncAddonEntitlementFromBillingOutcome(input: {
	organizationId: string;
	addonCode: string | null;
	provider: BillingProvider;
	paymentStatus: BillingPaymentStatus;
	providerReference?: string | null;
	providerEventId?: string | null;
	eventType?: string | null;
	paymentId?: string | null;
	actorId: string;
	actorType: string;
}): Promise<{ applied: boolean; reason: string; addonCode: string | null; enabled: boolean | null }> {
	const addonCode = normalizeAddonCode(input.addonCode);
	const enabled = resolveEntitlementEnabledFromStatus(input.paymentStatus);

	if (!addonCode) {
		return { applied: false, reason: 'missing_addon_code', addonCode: null, enabled };
	}
	if (enabled === null) {
		return { applied: false, reason: 'status_not_toggleable', addonCode, enabled };
	}

	const organization = await prisma.organization.findUnique({
		where: { id: input.organizationId },
		select: {
			id: true,
			tenant: {
				select: {
					id: true,
					settings: true,
				},
			},
		},
	});
	if (!organization?.tenant) {
		return { applied: false, reason: 'tenant_not_found', addonCode, enabled };
	}

	const root = asRecord(organization.tenant.settings);
	const addons = asRecord(root.addons);
	const entitlements = asRecord(addons.entitlements);
	const existing = asRecord(entitlements[addonCode]);
	const existingEventId = asString(existing.lastBillingEventId);
	if (input.providerEventId && existingEventId === input.providerEventId) {
		return { applied: false, reason: 'duplicate_provider_event', addonCode, enabled };
	}

	const nowIso = new Date().toISOString();
	const existingActivatedAt = asString(existing.activatedAt);
	const billingReference = asString(input.providerReference) ?? null;
	const nextEntitlement = {
		...existing,
		code: addonCode,
		enabled,
		source: 'BILLING',
		billingReference: billingReference ?? null,
		activatedAt: enabled ? existingActivatedAt ?? nowIso : existingActivatedAt ?? nowIso,
		updatedAt: nowIso,
		lastBillingProvider: input.provider,
		lastBillingStatus: input.paymentStatus,
		lastBillingEventId: input.providerEventId ?? null,
		lastBillingEventType: input.eventType ?? null,
		lastPaymentId: input.paymentId ?? null,
	} satisfies JsonRecord;

	const nextSettings = {
		...root,
		addons: {
			...addons,
			entitlements: {
				...entitlements,
				[addonCode]: nextEntitlement,
			},
			updatedAt: nowIso,
		},
	};

	await prisma.tenant.update({
		where: { id: organization.tenant.id },
		data: { settings: toInputJson(nextSettings) },
	});

	await prisma.auditEvent.create({
		data: {
			organizationId: input.organizationId,
			actorId: input.actorId,
			actorType: input.actorType,
			actorRoles: ['INTEGRATION'],
			action: 'ADDON_ENTITLEMENT_BILLING_SYNC',
			entityType: 'TenantAddonEntitlement',
			entityId: addonCode,
			result: 'SUCCESS',
			metadata: {
				addonCode,
				enabled,
				provider: input.provider,
				status: input.paymentStatus,
				providerReference: input.providerReference ?? null,
				providerEventId: input.providerEventId ?? null,
				eventType: input.eventType ?? null,
				paymentId: input.paymentId ?? null,
			},
		},
	});

	return { applied: true, reason: 'synced', addonCode, enabled };
}
