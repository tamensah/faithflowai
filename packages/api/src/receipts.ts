import crypto from 'node:crypto';
import { prisma, ReceiptStatus } from '@faithflow-ai/database';

function generateReceiptNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const nonce = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `FF-${stamp}-${nonce}`;
}

type ReceiptAccessPayload = {
  receiptNumber: string;
  exp: number;
};

function getReceiptAccessSecret() {
  return process.env.RECEIPT_PUBLIC_SECRET ?? process.env.CLERK_SECRET_KEY ?? null;
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function createReceiptAccessToken(receiptNumber: string, expSeconds = 30 * 24 * 60 * 60) {
  const secret = getReceiptAccessSecret();
  if (!secret) return null;

  const payload: ReceiptAccessPayload = {
    receiptNumber,
    exp: Math.floor(Date.now() / 1000) + expSeconds,
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = hmacSha256(secret, body)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${body}.${signature}`;
}

export function verifyReceiptAccessToken(token: string, receiptNumber: string) {
  const secret = getReceiptAccessSecret();
  if (!secret) return { ok: false as const, error: 'Receipt access is not configured' };

  const [body, signature] = token.split('.');
  if (!body || !signature) return { ok: false as const, error: 'Invalid token format' };

  const expected = hmacSha256(secret, body);
  const provided = base64UrlDecodeToBuffer(signature);
  if (!timingSafeEqual(expected, provided)) {
    return { ok: false as const, error: 'Invalid token signature' };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(body)) as ReceiptAccessPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.receiptNumber !== receiptNumber) {
      return { ok: false as const, error: 'Token receipt mismatch' };
    }
    if (payload.exp < now) {
      return { ok: false as const, error: 'Token expired' };
    }
    return { ok: true as const, payload };
  } catch {
    return { ok: false as const, error: 'Invalid token payload' };
  }
}

export function buildPublicReceiptUrl(receiptNumber: string) {
  const token = createReceiptAccessToken(receiptNumber);
  if (!token) return null;
  const base = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/trpc\/?$/, '');
  return `${base}/public/receipts/${encodeURIComponent(receiptNumber)}?token=${encodeURIComponent(token)}`;
}

export async function ensureDonationReceipt(donationId: string) {
  const existing = await prisma.donationReceipt.findFirst({
    where: { donationId },
  });
  if (existing) {
    return existing;
  }

  const donation = await prisma.donation.findUnique({
    where: { id: donationId },
  });
  if (!donation) {
    return null;
  }

  const receiptNumber = generateReceiptNumber();
  try {
    return await prisma.donationReceipt.create({
      data: {
        donationId: donation.id,
        churchId: donation.churchId,
        receiptNumber,
        status: ReceiptStatus.ISSUED,
        metadata: {
          amount: donation.amount.toString(),
          currency: donation.currency,
          donorName: donation.donorName,
          donorEmail: donation.donorEmail,
          donorPhone: donation.donorPhone,
          provider: donation.provider,
          providerRef: donation.providerRef,
          pledgeId: donation.pledgeId,
          recurringDonationId: donation.recurringDonationId,
          isAnonymous: donation.isAnonymous,
        },
      },
    });
  } catch (error) {
    const fallback = await prisma.donationReceipt.findFirst({
      where: { donationId },
    });
    return fallback ?? null;
  }
}

export async function createDonationReceiptForManual(donationId: string) {
  return ensureDonationReceipt(donationId);
}

export async function getReceiptByNumber(receiptNumber: string) {
  return prisma.donationReceipt.findFirst({
    where: { receiptNumber },
    include: {
      donation: true,
      church: true,
    },
  });
}

export function renderReceiptHtml(receipt: Awaited<ReturnType<typeof getReceiptByNumber>>) {
  if (!receipt) {
    return '<html><body><h1>Receipt not found</h1></body></html>';
  }

  const donation = receipt.donation;
  const church = receipt.church;
  const churchName = escapeHtml(church.name);
  const donorName = donation.isAnonymous ? 'Anonymous' : escapeHtml(donation.donorName ?? 'Anonymous');
  const issuedAt = escapeHtml(new Date(receipt.issuedAt).toLocaleDateString());
  const amount = escapeHtml(donation.amount.toString());
  const currency = escapeHtml(donation.currency);
  const receiptId = escapeHtml(receipt.receiptNumber);

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Donation Receipt ${receiptId}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; padding: 32px; }
          .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; max-width: 640px; }
          h1 { font-size: 22px; margin: 0 0 8px; }
          p { margin: 6px 0; }
          .meta { font-size: 12px; color: #64748b; }
          .row { display: flex; justify-content: space-between; margin-top: 12px; }
          .total { font-size: 18px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>${churchName} Donation Receipt</h1>
          <p class="meta">Receipt #${receiptId}</p>
          <p class="meta">Issued ${issuedAt}</p>
          <hr />
          ${receipt.status === ReceiptStatus.VOIDED ? '<p class="meta"><strong>VOIDED</strong></p>' : ''}
          <p><strong>Donor</strong>: ${donorName}</p>
          <div class="row">
            <span>Amount</span>
            <span class="total">${amount} ${currency}</span>
          </div>
          <p class="meta">Thank you for your generosity.</p>
        </div>
      </body>
    </html>
  `;
}
