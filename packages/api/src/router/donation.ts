import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import {
  AuditActorType,
  ImportBatchStatus,
  ImportEntityType,
  ImportItemAction,
  PaymentProvider,
  prisma,
} from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { emitRealtimeEvent } from '../realtime';
import { createDonationReceiptForManual } from '../receipts';
import { recordAuditLog } from '../audit';
import { ensureFeatureReadAccess, ensureFeatureWriteAccess } from '../entitlements';

const requireStaff = async (tenantId: string, clerkUserId: string) => {
  const membership = await prisma.staffMembership.findFirst({
    where: { user: { clerkUserId }, church: { organization: { tenantId } } },
  });
  if (!membership) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Staff access required' });
  }
  return membership;
};

const createDonationSchema = z.object({
  churchId: z.string(),
  memberId: z.string().optional(),
  fundId: z.string().optional(),
  campaignId: z.string().optional(),
  fundraiserPageId: z.string().optional(),
  pledgeId: z.string().optional(),
  recurringDonationId: z.string().optional(),
  amount: z.number().positive(),
  currency: z
    .string()
    .default('USD')
    .transform((value) => value.toUpperCase()),
  provider: z.nativeEnum(PaymentProvider).default(PaymentProvider.MANUAL),
  providerRef: z.string().optional(),
  isAnonymous: z.boolean().optional(),
  donorName: z.string().optional(),
  donorEmail: z.string().email().optional(),
  donorPhone: z.string().optional(),
});

type DonationImportRow = {
  amount?: string;
  currency?: string;
  donorName?: string;
  donorEmail?: string;
  donorPhone?: string;
  memberEmail?: string;
  memberPhone?: string;
  fundName?: string;
  campaignName?: string;
  createdAt?: string;
};

const donationImportSchema = z.object({
  churchId: z.string(),
  csv: z.string().min(1),
  dryRun: z.boolean().optional(),
});

const headerAliases: Record<string, keyof DonationImportRow> = {
  amount: 'amount',
  currency: 'currency',
  donorname: 'donorName',
  donoremail: 'donorEmail',
  donorphone: 'donorPhone',
  memberemail: 'memberEmail',
  memberphone: 'memberPhone',
  fund: 'fundName',
  fundname: 'fundName',
  campaign: 'campaignName',
  campaignname: 'campaignName',
  createdat: 'createdAt',
  date: 'createdAt',
};

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    if (char === '"') {
      if (inQuotes && csv[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(value.trim());
      value = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && csv[i + 1] === '\n') i += 1;
      row.push(value.trim());
      value = '';
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    value += char;
  }

  if (value.length || row.length) {
    row.push(value.trim());
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }

  return rows;
}

function parseDonationImport(csv: string): DonationImportRow[] {
  const rows = parseCsvRows(csv);
  if (!rows.length) return [];
  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header) => headerAliases[normalizeHeader(header)] ?? null);
  return dataRows.map((row) => {
    const record: DonationImportRow = {};
    headers.forEach((key, index) => {
      if (!key) return;
      const value = row[index]?.trim();
      if (!value) return;
      (record as any)[key] = value;
    });
    return record;
  });
}

export const donationRouter = router({
  create: protectedProcedure
    .input(createDonationSchema)
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureWriteAccess(
        ctx.tenantId!,
        'finance_enabled',
        'Your subscription does not include finance operations.'
      );
      const church = await prisma.church.findFirst({
        where: {
          id: input.churchId,
          organization: { tenantId: ctx.tenantId! },
        },
      });

      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      if (input.memberId) {
        const member = await prisma.member.findFirst({
          where: {
            id: input.memberId,
            church: { organization: { tenantId: ctx.tenantId! } },
          },
        });

        if (!member) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
        }
      }

      if (input.fundId) {
        const fund = await prisma.fund.findFirst({
          where: { id: input.fundId, churchId: input.churchId },
        });
        if (!fund) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Fund not found' });
        }
      }

      if (input.campaignId) {
        const campaign = await prisma.campaign.findFirst({
          where: { id: input.campaignId, churchId: input.churchId },
        });
        if (!campaign) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
        }
      }

      if (input.fundraiserPageId) {
        const fundraiser = await prisma.fundraiserPage.findFirst({
          where: { id: input.fundraiserPageId, churchId: input.churchId },
        });
        if (!fundraiser) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Fundraiser page not found' });
        }
      }

      if (input.pledgeId) {
        const pledge = await prisma.pledge.findFirst({
          where: { id: input.pledgeId, churchId: input.churchId },
        });
        if (!pledge) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Pledge not found' });
        }
      }

      if (input.recurringDonationId) {
        const recurring = await prisma.recurringDonation.findFirst({
          where: { id: input.recurringDonationId, churchId: input.churchId },
        });
        if (!recurring) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Recurring donation not found' });
        }
      }

      if (input.provider !== PaymentProvider.MANUAL && !input.providerRef) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'providerRef is required' });
      }

      const providerRef = input.providerRef ?? `manual-${Date.now()}`;

      const donation = await prisma.donation.create({
        data: {
          churchId: input.churchId,
          memberId: input.memberId,
          fundId: input.fundId,
          campaignId: input.campaignId,
          fundraiserPageId: input.fundraiserPageId,
          pledgeId: input.pledgeId,
          recurringDonationId: input.recurringDonationId,
          amount: input.amount,
          currency: input.currency,
          status: 'COMPLETED',
          provider: input.provider,
          providerRef,
          isAnonymous: input.isAnonymous ?? false,
          donorName: input.donorName,
          donorEmail: input.donorEmail,
          donorPhone: input.donorPhone,
        },
      });

      await createDonationReceiptForManual(donation.id);

      emitRealtimeEvent({
        type: 'donation.created',
        data: {
          id: donation.id,
          churchId: donation.churchId,
          tenantId: ctx.tenantId,
          amount: donation.amount.toString(),
          currency: donation.currency,
          status: donation.status,
          provider: donation.provider,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: donation.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'donation.created',
        targetType: 'Donation',
        targetId: donation.id,
        metadata: {
          amount: donation.amount.toString(),
          currency: donation.currency,
          provider: donation.provider,
        },
      });

      return donation;
    }),

  list: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
        limit: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ input, ctx }) => {
      await ensureFeatureReadAccess(
        ctx.tenantId!,
        'finance_enabled',
        'Your subscription does not include finance operations.'
      );
      return prisma.donation.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        include: {
          member: true,
          fund: true,
          campaign: true,
          fundraiserPage: true,
          pledge: true,
          recurringDonation: true,
        },
      });
    }),

  importCsv: protectedProcedure.input(donationImportSchema).mutation(async ({ input, ctx }) => {
    await ensureFeatureWriteAccess(
      ctx.tenantId!,
      'finance_enabled',
      'Your subscription does not include finance operations.'
    );
    await requireStaff(ctx.tenantId!, ctx.userId!);
    const church = await prisma.church.findFirst({
      where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
    });
    if (!church) throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });

    const rows = parseDonationImport(input.csv);
    const summary = { scanned: rows.length, created: 0, skipped: 0, errors: 0 };
    const errors: Array<{ row: number; message: string }> = [];

    if (input.dryRun) {
      for (let i = 0; i < rows.length; i += 1) {
        const amount = Number(rows[i]?.amount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) {
          summary.skipped += 1;
          continue;
        }
        summary.created += 1;
      }
      return { dryRun: true, batchId: null, summary, errors };
    }

    const batch = await prisma.importBatch.create({
      data: {
        tenantId: ctx.tenantId!,
        churchId: input.churchId,
        entityType: ImportEntityType.DONATION,
        status: ImportBatchStatus.APPLIED,
        rowCount: rows.length,
        filename: 'donations.csv',
        createdByClerkUserId: ctx.userId ?? undefined,
      },
    });

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] ?? {};
      try {
        const amount = Number(row.amount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) {
          summary.skipped += 1;
          continue;
        }

        const currency = (row.currency ?? 'USD').toUpperCase();
        let createdAt = row.createdAt ? new Date(row.createdAt) : new Date();
        if (Number.isNaN(createdAt.getTime())) {
          createdAt = new Date();
        }

        const fundName = row.fundName?.trim();
        const campaignName = row.campaignName?.trim();

        const member =
          row.memberEmail?.trim()
            ? await prisma.member.findFirst({ where: { churchId: input.churchId, email: row.memberEmail.trim() } })
            : row.memberPhone?.trim()
              ? await prisma.member.findFirst({ where: { churchId: input.churchId, phone: row.memberPhone.trim() } })
              : null;

        const fund = fundName
          ? await prisma.fund.upsert({
              where: { churchId_name: { churchId: input.churchId, name: fundName } },
              update: {},
              create: { churchId: input.churchId, name: fundName },
            })
          : null;

        const campaign = campaignName
          ? await prisma.campaign.upsert({
              where: { churchId_name: { churchId: input.churchId, name: campaignName } },
              update: {},
              create: { churchId: input.churchId, name: campaignName, status: 'ACTIVE' },
            })
          : null;

        const donorName =
          row.donorName?.trim() ||
          (member ? `${member.firstName} ${member.lastName}`.trim() : undefined);

        const providerRef = `import-${batch.id}-${i + 1}`;
        const donation = await prisma.donation.create({
          data: {
            churchId: input.churchId,
            memberId: member?.id ?? undefined,
            fundId: fund?.id ?? undefined,
            campaignId: campaign?.id ?? undefined,
            amount,
            currency,
            status: 'COMPLETED',
            provider: PaymentProvider.MANUAL,
            providerRef,
            donorName,
            donorEmail: row.donorEmail?.trim() || member?.email || undefined,
            donorPhone: row.donorPhone?.trim() || member?.phone || undefined,
            createdAt,
          },
        });

        await prisma.importBatchItem.create({
          data: {
            batchId: batch.id,
            entityType: ImportEntityType.DONATION,
            action: ImportItemAction.CREATED,
            entityId: donation.id,
          },
        });

        await createDonationReceiptForManual(donation.id);

        summary.created += 1;
      } catch (error) {
        summary.errors += 1;
        errors.push({ row: i + 2, message: error instanceof Error ? error.message : 'Import failed' });
      }
    }

    await recordAuditLog({
      tenantId: ctx.tenantId,
      churchId: input.churchId,
      actorType: AuditActorType.USER,
      actorId: ctx.userId,
      action: 'donation.import_csv_applied',
      targetType: 'ImportBatch',
      targetId: batch.id,
      metadata: summary,
    });

    return { dryRun: false, batchId: batch.id, summary, errors };
  }),

  rollbackImport: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureWriteAccess(
        ctx.tenantId!,
        'finance_enabled',
        'Your subscription does not include finance operations.'
      );
      await requireStaff(ctx.tenantId!, ctx.userId!);
      const batch = await prisma.importBatch.findFirst({
        where: { id: input.batchId, tenantId: ctx.tenantId!, entityType: ImportEntityType.DONATION },
        include: { items: true },
      });
      if (!batch) throw new TRPCError({ code: 'NOT_FOUND', message: 'Import batch not found' });
      if (batch.status === ImportBatchStatus.ROLLED_BACK) return { ok: true, alreadyRolledBack: true };

      const createdIds = batch.items.filter((item) => item.action === ImportItemAction.CREATED).map((item) => item.entityId);
      if (createdIds.length) {
        await prisma.donationReceipt.deleteMany({ where: { donationId: { in: createdIds } } });
        await prisma.donation.deleteMany({ where: { id: { in: createdIds }, churchId: batch.churchId } });
      }

      await prisma.importBatch.update({
        where: { id: batch.id },
        data: { status: ImportBatchStatus.ROLLED_BACK },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: batch.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'donation.import_csv_rolled_back',
        targetType: 'ImportBatch',
        targetId: batch.id,
        metadata: { deletedDonations: createdIds.length },
      });

      return { ok: true, deletedDonations: createdIds.length };
    }),
});
