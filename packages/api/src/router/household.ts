import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { AuditActorType, ImportBatchStatus, ImportEntityType, ImportItemAction, prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { recordAuditLog } from '../audit';

const createHouseholdSchema = z.object({
  churchId: z.string(),
  name: z.string().optional(),
  primaryMemberId: z.string().optional(),
});

const updateHouseholdSchema = z.object({
  name: z.string().optional(),
  primaryMemberId: z.string().optional(),
});

const requireStaff = async (tenantId: string, clerkUserId: string) => {
  const membership = await prisma.staffMembership.findFirst({
    where: { user: { clerkUserId }, church: { organization: { tenantId } } },
  });
  if (!membership) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Staff access required' });
  }
  return membership;
};

type HouseholdImportRow = {
  name?: string;
  primaryMemberId?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  memberEmails?: string[];
};

const householdImportSchema = z.object({
  churchId: z.string(),
  csv: z.string().min(1),
  dryRun: z.boolean().optional(),
});

const headerAliases: Record<string, keyof HouseholdImportRow> = {
  name: 'name',
  household: 'name',
  primarymemberid: 'primaryMemberId',
  primarymember: 'primaryMemberId',
  primaryemail: 'primaryEmail',
  email: 'primaryEmail',
  primaryphone: 'primaryPhone',
  phone: 'primaryPhone',
  memberemails: 'memberEmails',
  members: 'memberEmails',
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

function parseHouseholdImport(csv: string): HouseholdImportRow[] {
  const rows = parseCsvRows(csv);
  if (!rows.length) return [];
  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header) => headerAliases[normalizeHeader(header)] ?? null);

  return dataRows.map((row) => {
    const record: HouseholdImportRow = {};
    headers.forEach((key, index) => {
      if (!key) return;
      const value = row[index]?.trim();
      if (!value) return;
      if (key === 'memberEmails') {
        record.memberEmails = value
          .split(/[,;]+/)
          .map((entry) => entry.trim())
          .filter(Boolean);
        return;
      }
      (record as any)[key] = value;
    });
    return record;
  });
}

export const householdRouter = router({
  create: protectedProcedure
    .input(createHouseholdSchema)
    .mutation(async ({ input, ctx }) => {
      await requireStaff(ctx.tenantId!, ctx.userId!);
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      if (input.primaryMemberId) {
        const member = await prisma.member.findFirst({
          where: { id: input.primaryMemberId, churchId: input.churchId },
        });
        if (!member) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Primary member not found' });
        }
      }

      return prisma.household.create({
        data: {
          churchId: input.churchId,
          name: input.name,
          primaryMemberId: input.primaryMemberId,
        },
      });
    }),

  list: protectedProcedure
    .input(z.object({ churchId: z.string().optional(), limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ input, ctx }) => {
      await requireStaff(ctx.tenantId!, ctx.userId!);
      return prisma.household.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        include: { members: true, primaryMember: true },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: updateHouseholdSchema }))
    .mutation(async ({ input, ctx }) => {
      await requireStaff(ctx.tenantId!, ctx.userId!);
      const household = await prisma.household.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!household) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Household not found' });
      }

      if (input.data.primaryMemberId) {
        const member = await prisma.member.findFirst({
          where: { id: input.data.primaryMemberId, churchId: household.churchId },
        });
        if (!member) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Primary member not found' });
        }
      }

      return prisma.household.update({
        where: { id: input.id },
        data: input.data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await requireStaff(ctx.tenantId!, ctx.userId!);
      const household = await prisma.household.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!household) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Household not found' });
      }

      return prisma.household.delete({ where: { id: input.id } });
    }),

  addMember: protectedProcedure
    .input(z.object({ householdId: z.string(), memberId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await requireStaff(ctx.tenantId!, ctx.userId!);
      const household = await prisma.household.findFirst({
        where: { id: input.householdId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!household) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Household not found' });
      }

      const member = await prisma.member.findFirst({
        where: { id: input.memberId, churchId: household.churchId },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      return prisma.member.update({
        where: { id: input.memberId },
        data: { householdId: household.id },
      });
    }),

  removeMember: protectedProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await requireStaff(ctx.tenantId!, ctx.userId!);
      const member = await prisma.member.findFirst({
        where: { id: input.memberId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      return prisma.member.update({
        where: { id: input.memberId },
        data: { householdId: null },
      });
    }),

  importCsv: protectedProcedure.input(householdImportSchema).mutation(async ({ input, ctx }) => {
    await requireStaff(ctx.tenantId!, ctx.userId!);
    const church = await prisma.church.findFirst({
      where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
    });
    if (!church) throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });

    const rows = parseHouseholdImport(input.csv);
    const summary = { scanned: rows.length, created: 0, updated: 0, skipped: 0, errors: 0 };
    const errors: Array<{ row: number; message: string }> = [];

    if (input.dryRun) {
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i] ?? {};
        const name = row.name?.trim();
        if (!name && !row.primaryMemberId && !row.primaryEmail && !row.primaryPhone) {
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
        entityType: ImportEntityType.HOUSEHOLD,
        status: ImportBatchStatus.APPLIED,
        rowCount: rows.length,
        filename: 'households.csv',
        createdByClerkUserId: ctx.userId ?? undefined,
      },
    });

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] ?? {};
      try {
        const name = row.name?.trim() || null;
        let primaryMemberId = row.primaryMemberId?.trim() || null;

        if (!primaryMemberId && row.primaryEmail) {
          const member = await prisma.member.findFirst({
            where: { churchId: input.churchId, email: row.primaryEmail.trim() },
            select: { id: true },
          });
          primaryMemberId = member?.id ?? null;
        }
        if (!primaryMemberId && row.primaryPhone) {
          const member = await prisma.member.findFirst({
            where: { churchId: input.churchId, phone: row.primaryPhone.trim() },
            select: { id: true },
          });
          primaryMemberId = member?.id ?? null;
        }

        const existing =
          primaryMemberId
            ? await prisma.household.findFirst({ where: { churchId: input.churchId, primaryMemberId } })
            : name
              ? await prisma.household.findFirst({ where: { churchId: input.churchId, name } })
              : null;

        const household = existing
          ? await prisma.household.update({
              where: { id: existing.id },
              data: { name: name ?? undefined, primaryMemberId: primaryMemberId ?? undefined },
            })
          : await prisma.household.create({
              data: { churchId: input.churchId, name: name ?? undefined, primaryMemberId: primaryMemberId ?? undefined },
            });

        if (primaryMemberId) {
          const before = await prisma.member.findUnique({ where: { id: primaryMemberId }, select: { householdId: true } });
          await prisma.member.update({ where: { id: primaryMemberId }, data: { householdId: household.id } });
          await prisma.importBatchItem.create({
            data: {
              batchId: batch.id,
              entityType: ImportEntityType.MEMBER,
              action: ImportItemAction.UPDATED,
              entityId: primaryMemberId,
              metadata: { before: { householdId: before?.householdId ?? null }, after: { householdId: household.id }, reason: 'household_primary' },
            },
          });
        }

        if (row.memberEmails?.length) {
          const members = await prisma.member.findMany({
            where: { churchId: input.churchId, email: { in: row.memberEmails } },
            select: { id: true, householdId: true },
          });
          for (const member of members) {
            const beforeHouseholdId = member.householdId ?? null;
            await prisma.member.update({ where: { id: member.id }, data: { householdId: household.id } });
            await prisma.importBatchItem.create({
              data: {
                batchId: batch.id,
                entityType: ImportEntityType.MEMBER,
                action: ImportItemAction.UPDATED,
                entityId: member.id,
                metadata: { before: { householdId: beforeHouseholdId }, after: { householdId: household.id }, reason: 'household_member' },
              },
            });
          }
        }

        await prisma.importBatchItem.create({
          data: {
            batchId: batch.id,
            entityType: ImportEntityType.HOUSEHOLD,
            action: existing ? ImportItemAction.UPDATED : ImportItemAction.CREATED,
            entityId: household.id,
            metadata: existing
              ? {
                  before: { name: existing.name ?? null, primaryMemberId: existing.primaryMemberId ?? null },
                  after: { name: household.name ?? null, primaryMemberId: household.primaryMemberId ?? null },
                }
              : { row: i + 2 },
          },
        });

        if (existing) summary.updated += 1;
        else summary.created += 1;
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
      action: 'household.import_csv_applied',
      targetType: 'ImportBatch',
      targetId: batch.id,
      metadata: summary,
    });

    return { dryRun: false, batchId: batch.id, summary, errors };
  }),

  rollbackImport: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await requireStaff(ctx.tenantId!, ctx.userId!);
      const batch = await prisma.importBatch.findFirst({
        where: { id: input.batchId, tenantId: ctx.tenantId!, entityType: ImportEntityType.HOUSEHOLD },
        include: { items: true },
      });
      if (!batch) throw new TRPCError({ code: 'NOT_FOUND', message: 'Import batch not found' });
      if (batch.status === ImportBatchStatus.ROLLED_BACK) return { ok: true, alreadyRolledBack: true };

      const createdHouseholdIds = batch.items
        .filter((item) => item.entityType === ImportEntityType.HOUSEHOLD && item.action === ImportItemAction.CREATED)
        .map((item) => item.entityId);

      const updatedHouseholdItems = batch.items.filter(
        (item) => item.entityType === ImportEntityType.HOUSEHOLD && item.action === ImportItemAction.UPDATED
      );

      const memberUpdateItems = batch.items.filter(
        (item) => item.entityType === ImportEntityType.MEMBER && item.action === ImportItemAction.UPDATED
      );

      let restoredMembers = 0;
      for (const item of memberUpdateItems) {
        const metadata = item.metadata as any;
        const beforeHouseholdId = metadata?.before?.householdId ?? null;
        await prisma.member.updateMany({
          where: { id: item.entityId, churchId: batch.churchId },
          data: { householdId: beforeHouseholdId },
        });
        restoredMembers += 1;
      }

      let restoredHouseholds = 0;
      for (const item of updatedHouseholdItems) {
        const metadata = item.metadata as any;
        const before = metadata?.before as Record<string, any> | undefined;
        if (!before) continue;
        await prisma.household.updateMany({
          where: { id: item.entityId, churchId: batch.churchId },
          data: {
            name: before.name ?? null,
            primaryMemberId: before.primaryMemberId ?? null,
          },
        });
        restoredHouseholds += 1;
      }

      let deletedHouseholds = 0;
      for (const householdId of createdHouseholdIds) {
        const linked = await prisma.member.count({ where: { churchId: batch.churchId, householdId } });
        if (linked > 0) continue;
        const result = await prisma.household.deleteMany({ where: { id: householdId, churchId: batch.churchId } });
        deletedHouseholds += result.count;
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
        action: 'household.import_csv_rolled_back',
        targetType: 'ImportBatch',
        targetId: batch.id,
        metadata: { deletedHouseholds, restoredMembers, restoredHouseholds },
      });

      return { ok: true, deletedHouseholds, restoredMembers, restoredHouseholds };
    }),
});
