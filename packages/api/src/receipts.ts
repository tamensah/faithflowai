import { prisma, ReceiptStatus } from '@faithflow-ai/database';

function generateReceiptNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const nonce = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FF-${stamp}-${nonce}`;
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

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Donation Receipt ${receipt.receiptNumber}</title>
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
          <h1>${church.name} Donation Receipt</h1>
          <p class="meta">Receipt #${receipt.receiptNumber}</p>
          <p class="meta">Issued ${new Date(receipt.issuedAt).toLocaleDateString()}</p>
          <hr />
          ${receipt.status === ReceiptStatus.VOIDED ? '<p class="meta"><strong>VOIDED</strong></p>' : ''}
          <p><strong>Donor</strong>: ${donation.isAnonymous ? 'Anonymous' : donation.donorName ?? 'Anonymous'}</p>
          <p><strong>Email</strong>: ${donation.isAnonymous ? 'N/A' : donation.donorEmail ?? 'N/A'}</p>
          <p><strong>Phone</strong>: ${donation.isAnonymous ? 'N/A' : donation.donorPhone ?? 'N/A'}</p>
          <div class="row">
            <span>Amount</span>
            <span class="total">${donation.amount.toString()} ${donation.currency}</span>
          </div>
          <p class="meta">Provider: ${donation.provider} · Ref: ${donation.providerRef}</p>
          <p class="meta">Thank you for your generosity.</p>
        </div>
      </body>
    </html>
  `;
}
