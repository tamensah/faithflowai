import crypto from 'crypto';

export type TwilioMessage = {
  From?: string;
  To?: string;
  Body?: string;
  MessageSid?: string;
};

export function normalizePhoneNumber(value: string) {
  return value.replace(/[^\d+]/g, '');
}

export function buildTwimlMessage(text: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(text)}</Message></Response>`;
}

function escapeXml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function parseTextToGiveBody(body: string) {
  const trimmed = body.trim();
  const upper = trimmed.toUpperCase();
  const tokens = upper.split(/\s+/);
  const amountMatch = trimmed.match(/(\d+(?:\.\d+)?)/);
  const amount = amountMatch ? Number(amountMatch[1]) : null;

  const emailToken = trimmed.split(/\s+/).find((token) => token.includes('@'));
  const currencyToken = tokens.find((token) => token.length === 3 && /^[A-Z]{3}$/.test(token));

  return {
    amount,
    currency: currencyToken ?? null,
    email: emailToken ?? null,
  };
}

export function computeTwilioSignature(url: string, params: Record<string, string>, authToken: string) {
  const sortedKeys = Object.keys(params).sort();
  const data = url + sortedKeys.map((key) => `${key}${params[key]}`).join('');
  const hmac = crypto.createHmac('sha1', authToken).update(data).digest('base64');
  return hmac;
}

export function verifyTwilioSignature({
  url,
  params,
  signature,
  authToken,
}: {
  url: string;
  params: Record<string, string>;
  signature: string;
  authToken: string;
}) {
  const expected = computeTwilioSignature(url, params, authToken);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}
