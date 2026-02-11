export type Context = {
  userId: string | null;
  clerkOrgId: string | null;
  tenantId: string | null;
  tenantStatus: 'ACTIVE' | 'SUSPENDED' | null;
};
