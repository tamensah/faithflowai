import { TRPCError } from '@trpc/server';

function normalizeOrigin(value?: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function configuredOrigins() {
  const envList = (process.env.ALLOWED_CHECKOUT_REDIRECT_ORIGINS ?? '')
    .split(',')
    .map((value) => normalizeOrigin(value.trim()))
    .filter((value): value is string => Boolean(value));

  const defaults = [
    normalizeOrigin(process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001'),
    normalizeOrigin(process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'),
  ].filter((value): value is string => Boolean(value));

  return new Set([...envList, ...defaults]);
}

export function isAllowedCheckoutRedirectUrl(url: string, requestOrigin?: string | null) {
  try {
    const parsedOrigin = new URL(url).origin;
    const allowed = configuredOrigins();
    const requestOriginNormalized = normalizeOrigin(requestOrigin);
    if (requestOriginNormalized) {
      allowed.add(requestOriginNormalized);
    }
    return allowed.has(parsedOrigin);
  } catch {
    return false;
  }
}

export function assertAllowedCheckoutRedirects(
  input: { successUrl?: string | null; cancelUrl?: string | null },
  requestOrigin?: string | null
) {
  if (input.successUrl && !isAllowedCheckoutRedirectUrl(input.successUrl, requestOrigin)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'successUrl must be on an allowed FaithFlow domain',
    });
  }

  if (input.cancelUrl && !isAllowedCheckoutRedirectUrl(input.cancelUrl, requestOrigin)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'cancelUrl must be on an allowed FaithFlow domain',
    });
  }
}
