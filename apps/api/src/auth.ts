import { jwtVerify, importJWK, importSPKI } from 'jose';
import { env } from './env';

export type ClerkClaims = {
  sub?: string;
  org_id?: string;
  orgId?: string;
  sid?: string;
};

let cachedKeyPromise: ReturnType<typeof importSPKI> | ReturnType<typeof importJWK> | null = null;

async function getKey() {
  if (!env.CLERK_JWT_KEY) return null;
  if (!cachedKeyPromise) {
    const trimmed = env.CLERK_JWT_KEY.trim();
    if (trimmed.startsWith('{')) {
      const jwk = JSON.parse(trimmed);
      cachedKeyPromise = importJWK(jwk, jwk.alg ?? 'RS256');
    } else {
      cachedKeyPromise = importSPKI(trimmed, 'RS256');
    }
  }
  return cachedKeyPromise;
}

export function extractBearerToken(authHeader?: string) {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export async function verifyClerkToken(token: string): Promise<ClerkClaims | null> {
  const key = await getKey();
  if (!key) return null;

  try {
    const { payload } = await jwtVerify(token, await key, {
      issuer: env.CLERK_JWT_ISSUER,
      audience: env.CLERK_JWT_AUDIENCE,
    });

    return payload as ClerkClaims;
  } catch {
    return null;
  }
}
