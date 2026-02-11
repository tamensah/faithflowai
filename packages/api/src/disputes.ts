import fs from 'fs';
import Stripe from 'stripe';
import { TRPCError } from '@trpc/server';
import {
  DisputeEvidenceType,
  DisputeEvidenceStatus,
  PaymentProvider,
  Prisma,
  prisma,
} from '@faithflow-ai/database';

const STRIPE_FILE_EVIDENCE = new Set<DisputeEvidenceType>([
  DisputeEvidenceType.RECEIPT,
  DisputeEvidenceType.CUSTOMER_COMMUNICATION,
  DisputeEvidenceType.SHIPPING_DOCUMENTATION,
  DisputeEvidenceType.SERVICE_DOCUMENTATION,
]);

const STRIPE_EVIDENCE_FIELD: Record<DisputeEvidenceType, string> = {
  [DisputeEvidenceType.UNCATEGORIZED]: 'uncategorized_text',
  [DisputeEvidenceType.RECEIPT]: 'receipt',
  [DisputeEvidenceType.CUSTOMER_COMMUNICATION]: 'customer_communication',
  [DisputeEvidenceType.PRODUCT_DESCRIPTION]: 'product_description',
  [DisputeEvidenceType.REFUND_POLICY]: 'refund_policy',
  [DisputeEvidenceType.CUSTOMER_EMAIL]: 'customer_email_address',
  [DisputeEvidenceType.CUSTOMER_NAME]: 'customer_name',
  [DisputeEvidenceType.SHIPPING_DOCUMENTATION]: 'shipping_documentation',
  [DisputeEvidenceType.SHIPPING_TRACKING]: 'shipping_tracking_number',
  [DisputeEvidenceType.SHIPPING_DATE]: 'shipping_date',
  [DisputeEvidenceType.SERVICE_DOCUMENTATION]: 'service_documentation',
  [DisputeEvidenceType.SERVICE_DATE]: 'service_date',
};

let stripeClient: Stripe | null = null;
let stripeKey: string | null = null;

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Stripe is not configured' });
  }
  if (!stripeClient || stripeKey !== key) {
    stripeClient = new Stripe(key);
    stripeKey = key;
  }
  return stripeClient;
}

async function submitPaystackEvidence({
  disputeId,
  donation,
  evidence,
}: {
  disputeId: string;
  donation: { donorEmail?: string | null; donorName?: string | null; donorPhone?: string | null };
  evidence: { text?: string | null; description?: string | null };
}) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Paystack is not configured' });
  }

  const customer_email = donation.donorEmail ?? undefined;
  const customer_name = donation.donorName ?? undefined;
  const customer_phone = donation.donorPhone ?? undefined;
  const service_details = evidence.text || evidence.description || undefined;

  if (!customer_email || !customer_name || !customer_phone || !service_details) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Paystack evidence requires donor email, name, phone, and service details',
    });
  }

  const response = await fetch(`https://api.paystack.co/dispute/${disputeId}/evidence`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customer_email,
      customer_name,
      customer_phone,
      service_details,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new TRPCError({ code: 'BAD_GATEWAY', message: `Paystack evidence error: ${text}` });
  }

  return (await response.json()) as { status: boolean; data?: { id?: number } };
}

export async function submitStripeDispute(disputeProviderRef: string) {
  const stripe = getStripe();
  await stripe.disputes.update(disputeProviderRef, { submit: true });
}

export async function submitStripeEvidence({
  disputeProviderRef,
  evidence,
}: {
  disputeProviderRef: string;
  evidence: {
    type: DisputeEvidenceType;
    text?: string | null;
    filePath?: string | null;
    fileName?: string | null;
    fileMime?: string | null;
  };
}) {
  const stripe = getStripe();
  const field = STRIPE_EVIDENCE_FIELD[evidence.type];

  if (STRIPE_FILE_EVIDENCE.has(evidence.type)) {
    if (!evidence.filePath || !evidence.fileName) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Evidence file is required' });
    }
    const fileBuffer = await fs.promises.readFile(evidence.filePath);
    const file = await stripe.files.create({
      purpose: 'dispute_evidence',
      file: {
        data: fileBuffer,
        name: evidence.fileName,
        type: evidence.fileMime ?? 'application/octet-stream',
      },
    });

    await stripe.disputes.update(disputeProviderRef, {
      evidence: {
        [field]: file.id,
      } as Record<string, string>,
    });

    return { providerRef: file.id };
  }

  const textValue = evidence.text?.trim();
  if (!textValue) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Evidence text is required' });
  }

  await stripe.disputes.update(disputeProviderRef, {
    evidence: {
      [field]: textValue,
    } as Record<string, string>,
  });

  return { providerRef: null };
}

export async function createDisputeEvidenceRecord({
  disputeId,
  type,
  description,
  text,
  filePath,
  fileName,
  fileMime,
  fileSize,
}: {
  disputeId: string;
  type: DisputeEvidenceType;
  description?: string | null;
  text?: string | null;
  filePath?: string | null;
  fileName?: string | null;
  fileMime?: string | null;
  fileSize?: number | null;
}) {
  return prisma.disputeEvidence.create({
    data: {
      disputeId,
      type,
      description: description ?? undefined,
      text: text ?? undefined,
      filePath: filePath ?? undefined,
      fileName: fileName ?? undefined,
      fileMime: fileMime ?? undefined,
      fileSize: fileSize ?? undefined,
      status: DisputeEvidenceStatus.PENDING,
    },
  });
}

export async function markEvidenceSubmitted({
  evidenceId,
  providerRef,
}: {
  evidenceId: string;
  providerRef?: string | null;
}) {
  return prisma.disputeEvidence.update({
    where: { id: evidenceId },
    data: {
      status: DisputeEvidenceStatus.SUBMITTED,
      providerRef: providerRef ?? undefined,
      error: null,
    },
  });
}

export async function markEvidenceFailed({
  evidenceId,
  error,
}: {
  evidenceId: string;
  error: string;
}) {
  return prisma.disputeEvidence.update({
    where: { id: evidenceId },
    data: {
      status: DisputeEvidenceStatus.FAILED,
      error,
    },
  });
}

export async function submitDisputeEvidence({
  disputeId,
  evidenceId,
  submit,
}: {
  disputeId: string;
  evidenceId: string;
  submit?: boolean;
}) {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Dispute not found' });
  }
  const evidence = await prisma.disputeEvidence.findUnique({ where: { id: evidenceId } });
  if (!evidence) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Evidence not found' });
  }

  if (dispute.provider === PaymentProvider.STRIPE) {
    const result = await submitStripeEvidence({
      disputeProviderRef: dispute.providerRef,
      evidence: {
        type: evidence.type,
        text: evidence.text,
        filePath: evidence.filePath,
        fileName: evidence.fileName,
        fileMime: evidence.fileMime,
      },
    });
    await markEvidenceSubmitted({ evidenceId, providerRef: result.providerRef });
    if (submit) {
      await submitStripeDispute(dispute.providerRef);
    }
    return;
  }

  if (dispute.provider === PaymentProvider.PAYSTACK) {
    const donation = dispute.donationId
      ? await prisma.donation.findUnique({
          where: { id: dispute.donationId },
          include: { member: true },
        })
      : null;
    if (!donation) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Donation details are required to submit Paystack evidence',
      });
    }

    const payload = await submitPaystackEvidence({
      disputeId: dispute.providerRef,
      donation: {
        donorEmail: donation.donorEmail ?? donation.member?.email,
        donorName:
          donation.donorName ?? (donation.member ? `${donation.member.firstName} ${donation.member.lastName}` : null),
        donorPhone: donation.donorPhone ?? donation.member?.phone,
      },
      evidence: { text: evidence.text, description: evidence.description },
    });

    await markEvidenceSubmitted({
      evidenceId,
      providerRef: payload.data?.id ? String(payload.data.id) : undefined,
    });
    return;
  }

  throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unsupported provider' });
}
