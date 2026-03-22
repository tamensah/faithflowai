import { verifyToken } from '@clerk/backend';
import { env } from './env';

export type ClerkClaims = {
  sub?: string;
  org_id?: string;
  orgId?: string;
  sid?: string;
  iat?: number;
  amr?: unknown;
  fva?: unknown;
  email_verified?: boolean;
};

export function extractBearerToken(authHeader?: string) {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export async function verifyClerkToken(token: string): Promise<ClerkClaims | null> {
  if (!env.CLERK_SECRET_KEY) return null;
  try {
    const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
    return payload as ClerkClaims;
  } catch {
    return null;
  }
}
