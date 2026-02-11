import type { Context } from '@faithflow-ai/api';
import { prisma } from '@faithflow-ai/database';
import { extractBearerToken, verifyClerkToken } from './auth';

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

export async function resolveTenant(clerkOrgId: string) {
  return prisma.tenant.upsert({
    where: { clerkOrgId },
    update: {},
    create: {
      name: `Tenant ${clerkOrgId}`,
      slug: normalizeSlug(clerkOrgId) || clerkOrgId,
      clerkOrgId,
    },
  });
}

async function ensureDefaultOrgAndChurch(tenantId: string, clerkOrgId: string) {
  const existingOrg = await prisma.organization.findFirst({
    where: { tenantId },
  });

  if (existingOrg) {
    return;
  }

  const org = await prisma.organization.create({
    data: {
      tenantId,
      name: `Default Organization`,
    },
  });

  const church = await prisma.church.create({
    data: {
      organizationId: org.id,
      name: 'Default Church',
      slug: normalizeSlug(`church-${clerkOrgId}`) || 'default-church',
      countryCode: 'US',
      timezone: 'UTC',
    },
  });

  await prisma.campus.create({
    data: {
      churchId: church.id,
      name: 'Main Campus',
      timezone: 'UTC',
    },
  });
}

export async function provisionTenant(clerkOrgId: string) {
  const tenant = await resolveTenant(clerkOrgId);
  await ensureDefaultOrgAndChurch(tenant.id, clerkOrgId);
  return {
    tenantId: tenant.id,
    tenantStatus: tenant.status,
  };
}

export async function createContext({ req }: { req: { headers: Record<string, string | string[] | undefined> } }): Promise<Context> {
  const authHeader = req.headers['authorization'];
  const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  let userId: string | null = null;
  let clerkOrgId: string | null = null;

  const bearer = extractBearerToken(token);
  if (bearer) {
    const claims = await verifyClerkToken(bearer);
    userId = claims?.sub ?? null;
    clerkOrgId = (claims?.org_id ?? claims?.orgId) ?? null;
  } else {
    const fallbackUser = req.headers['x-user-id'];
    userId = Array.isArray(fallbackUser) ? fallbackUser[0] : fallbackUser ?? null;

    const fallbackOrg = req.headers['x-tenant-id'];
    clerkOrgId = Array.isArray(fallbackOrg) ? fallbackOrg[0] : fallbackOrg ?? null;
  }

  const tenant = clerkOrgId ? await provisionTenant(clerkOrgId) : null;

  return {
    userId,
    clerkOrgId,
    tenantId: tenant?.tenantId ?? null,
    tenantStatus: tenant?.tenantStatus ?? null,
  };
}
