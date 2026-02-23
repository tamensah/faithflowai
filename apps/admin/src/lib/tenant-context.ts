import { auth } from '@clerk/nextjs/server';

type TenantContext = {
  userId: string;
  clerkOrgId: string;
  tenantId: string;
  tenantStatus: 'ACTIVE' | 'SUSPENDED';
  defaultChurchId: string | null;
  churchIds: string[];
};

export async function resolveTenantContext(): Promise<TenantContext> {
  const { prisma } = await import('@faithflow-ai/database');
  const { userId, orgId } = await auth();
  if (!userId) {
    throw new Error('Unauthorized: missing authenticated Clerk session');
  }
  if (!orgId) {
    throw new Error('Forbidden: no active Clerk organization selected');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { clerkOrgId: orgId },
    select: {
      id: true,
      status: true,
      organizations: {
        select: {
          churches: {
            select: { id: true },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!tenant) {
    throw new Error('Forbidden: no tenant found for the active Clerk organization');
  }

  const churchIds = tenant.organizations.flatMap((organization) =>
    organization.churches.map((church) => church.id)
  );

  return {
    userId,
    clerkOrgId: orgId,
    tenantId: tenant.id,
    tenantStatus: tenant.status,
    defaultChurchId: churchIds[0] ?? null,
    churchIds,
  };
}
