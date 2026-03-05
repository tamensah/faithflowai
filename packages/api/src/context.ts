export type AuthSignals = {
  sessionId?: string | null;
  sessionIssuedAtMs?: number | null;
  authMethods?: string[];
  secondFactorVerified?: boolean | null;
  emailVerified?: boolean | null;
};

export type Context = {
  userId: string | null;
  clerkOrgId: string | null;
  tenantId: string | null;
  tenantStatus: 'ACTIVE' | 'SUSPENDED' | null;
  requestIp?: string | null;
  authSignals?: AuthSignals | null;
};
