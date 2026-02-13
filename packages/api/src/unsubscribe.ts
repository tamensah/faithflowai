import crypto from 'node:crypto';
import type { CommunicationChannel } from '@faithflow-ai/database';

export type UnsubscribePayload = {
  tenantId: string;
  channel: CommunicationChannel;
  address: string;
  memberId?: string | null;
  exp: number; // unix seconds
};

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

function hmacSha256(secret: string, message: string) {
  return crypto.createHmac('sha256', secret).update(message).digest();
}

function base64UrlDecodeToBuffer(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
}

function timingSafeEqual(a: Buffer, b: Buffer) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function apiPublicBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  return raw.replace(/\/trpc\/?$/, '');
}

export function createUnsubscribeToken(input: Omit<UnsubscribePayload, 'exp'> & { expSeconds?: number }) {
  const secret = process.env.COMMS_UNSUBSCRIBE_SECRET;
  if (!secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const exp = now + (input.expSeconds ?? 365 * 24 * 60 * 60);
  const payload: UnsubscribePayload = {
    tenantId: input.tenantId,
    channel: input.channel,
    address: input.address,
    memberId: input.memberId ?? null,
    exp,
  };

  const json = JSON.stringify(payload);
  const body = base64UrlEncode(json);
  const sig = hmacSha256(secret, body);
  const sigPart = sig.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${body}.${sigPart}`;
}

export function verifyUnsubscribeToken(token: string): { ok: true; payload: UnsubscribePayload } | { ok: false; error: string } {
  const secret = process.env.COMMS_UNSUBSCRIBE_SECRET;
  if (!secret) return { ok: false, error: 'COMMS_UNSUBSCRIBE_SECRET is not configured' };

  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, error: 'Invalid token format' };
  const [body, sigPart] = parts;
  if (!body || !sigPart) return { ok: false, error: 'Invalid token format' };

  const expected = hmacSha256(secret, body);
  const provided = base64UrlDecodeToBuffer(sigPart);
  if (!timingSafeEqual(expected, provided)) return { ok: false, error: 'Invalid token signature' };

  let payload: UnsubscribePayload;
  try {
    payload = JSON.parse(base64UrlDecode(body)) as UnsubscribePayload;
  } catch {
    return { ok: false, error: 'Invalid token payload' };
  }

  if (!payload.tenantId || !payload.channel || !payload.address || !payload.exp) {
    return { ok: false, error: 'Invalid token payload' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) return { ok: false, error: 'Token expired' };

  return { ok: true, payload };
}

export function buildUnsubscribeUrl(token: string) {
  return `${apiPublicBaseUrl()}/unsubscribe?token=${encodeURIComponent(token)}`;
}
