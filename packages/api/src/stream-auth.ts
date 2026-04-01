import crypto from 'node:crypto';

type StreamAccessPayload = {
  sub: string;
  orgId: string;
  exp: number;
};

function getStreamSigningSecret() {
  return process.env.STREAM_SIGNING_SECRET ?? process.env.CLERK_SECRET_KEY ?? null;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function base64UrlDecodeToBuffer(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
}

function hmacSha256(secret: string, message: string) {
  return crypto.createHmac('sha256', secret).update(message).digest();
}

function timingSafeEqual(a: Buffer, b: Buffer) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function createStreamAccessToken(input: { userId: string; orgId: string; expSeconds?: number }) {
  const secret = getStreamSigningSecret();
  if (!secret) return null;

  const payload: StreamAccessPayload = {
    sub: input.userId,
    orgId: input.orgId,
    exp: Math.floor(Date.now() / 1000) + (input.expSeconds ?? 5 * 60),
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = hmacSha256(secret, body)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${body}.${signature}`;
}

export function verifyStreamAccessToken(token: string) {
  const secret = getStreamSigningSecret();
  if (!secret) return { ok: false as const, error: 'Stream signing is not configured' };

  const [body, signature] = token.split('.');
  if (!body || !signature) {
    return { ok: false as const, error: 'Invalid token format' };
  }

  const expected = hmacSha256(secret, body);
  const provided = base64UrlDecodeToBuffer(signature);
  if (!timingSafeEqual(expected, provided)) {
    return { ok: false as const, error: 'Invalid token signature' };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(body)) as StreamAccessPayload;
    if (!payload.sub || !payload.orgId || !payload.exp) {
      return { ok: false as const, error: 'Invalid token payload' };
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return { ok: false as const, error: 'Token expired' };
    }
    return { ok: true as const, payload };
  } catch {
    return { ok: false as const, error: 'Invalid token payload' };
  }
}
