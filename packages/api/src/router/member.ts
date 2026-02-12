import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import {
  AccessRequestStatus,
  AuditActorType,
  ImportBatchStatus,
  ImportEntityType,
  ImportItemAction,
  MemberGender,
  MemberMaritalStatus,
  MemberStatus,
  MemberDirectoryVisibility,
  prisma,
} from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { ensureFeatureEnabled, ensureFeatureLimit } from '../entitlements';
import { recordAuditLog } from '../audit';

const requireStaff = async (tenantId: string, clerkUserId: string) => {
  const membership = await prisma.staffMembership.findFirst({
    where: { user: { clerkUserId }, church: { organization: { tenantId } } },
  });
  if (!membership) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Staff access required' });
  }
  return membership;
};

const splitName = (name?: string | null) => {
  const trimmed = name?.trim();
  if (!trimmed) return { firstName: 'Member', lastName: 'Pending' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: 'Pending' };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

const createMemberSchema = z.object({
  churchId: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().optional(),
  preferredName: z.string().optional(),
  email: z.string().email().optional(),
  clerkUserId: z.string().optional(),
  phone: z.string().optional(),
  status: z.nativeEnum(MemberStatus).optional(),
  gender: z.nativeEnum(MemberGender).optional(),
  maritalStatus: z.nativeEnum(MemberMaritalStatus).optional(),
  dateOfBirth: z.coerce.date().optional(),
  joinDate: z.coerce.date().optional(),
  baptismDate: z.coerce.date().optional(),
  confirmationDate: z.coerce.date().optional(),
  avatarUrl: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  notes: z.string().optional(),
  householdId: z.string().optional(),
  directoryVisibility: z.nativeEnum(MemberDirectoryVisibility).optional(),
  showEmailInDirectory: z.boolean().optional(),
  showPhoneInDirectory: z.boolean().optional(),
  showAddressInDirectory: z.boolean().optional(),
  showPhotoInDirectory: z.boolean().optional(),
});

const updateMemberSchema = createMemberSchema.partial();

type MemberImportRow = {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  preferredName?: string;
  email?: string;
  phone?: string;
  householdName?: string;
  status?: string;
  tags?: string[];
  notes?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  dateOfBirth?: string;
  joinDate?: string;
  baptismDate?: string;
  confirmationDate?: string;
};

const memberImportSchema = z.object({
  churchId: z.string(),
  csv: z.string().min(1),
  dryRun: z.boolean().optional(),
});

const headerAliases: Record<string, keyof MemberImportRow> = {
  firstname: 'firstName',
  lastname: 'lastName',
  middlename: 'middleName',
  preferredname: 'preferredName',
  email: 'email',
  phone: 'phone',
  household: 'householdName',
  householdname: 'householdName',
  status: 'status',
  tags: 'tags',
  notes: 'notes',
  address1: 'addressLine1',
  addressline1: 'addressLine1',
  address2: 'addressLine2',
  addressline2: 'addressLine2',
  city: 'city',
  state: 'state',
  postalcode: 'postalCode',
  zipcode: 'postalCode',
  country: 'country',
  dob: 'dateOfBirth',
  dateofbirth: 'dateOfBirth',
  joindate: 'joinDate',
  baptismdate: 'baptismDate',
  confirmationdate: 'confirmationDate',
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
      if (char === '\r' && csv[i + 1] === '\n') {
        i += 1;
      }
      row.push(value.trim());
      value = '';
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }
    value += char;
  }

  if (value.length || row.length) {
    row.push(value.trim());
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

function parseMemberImport(csv: string): MemberImportRow[] {
  const rows = parseCsvRows(csv);
  if (!rows.length) return [];

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header) => headerAliases[normalizeHeader(header)] ?? null);

  return dataRows.map((row) => {
    const record: MemberImportRow = {};
    headers.forEach((key, index) => {
      if (!key) return;
      const value = row[index]?.trim();
      if (!value) return;
      if (key === 'tags') {
        record.tags = value.split(/[,;]+/).map((entry) => entry.trim()).filter(Boolean);
        return;
      }
      (record as any)[key] = value;
    });
    return record;
  });
}

async function computeEngagementScore(memberId: string) {
  const now = new Date();
  const recentSince = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const attendanceCount = await prisma.attendance.count({
    where: { memberId, createdAt: { gte: recentSince } },
  });

  const donationCount = await prisma.donation.count({
    where: { memberId, status: 'COMPLETED', createdAt: { gte: recentSince } },
  });

  const groupCount = await prisma.groupMember.count({
    where: { memberId },
  });

  const volunteerCount = await prisma.volunteerAssignment.count({
    where: { memberId, status: 'ACTIVE' },
  });

  const onboarding = await prisma.memberOnboarding.findFirst({
    where: { memberId, status: 'COMPLETED' },
  });

  let score = 0;
  if (attendanceCount > 0) score += 25;
  if (attendanceCount >= 2) score += 10;
  if (donationCount > 0) score += 20;
  if (groupCount > 0) score += 15;
  if (volunteerCount > 0) score += 15;
  if (onboarding) score += 15;

  if (score > 100) score = 100;

  return {
    score,
    breakdown: {
      attendanceCount,
      donationCount,
      groupCount,
      volunteerCount,
      onboardingCompleted: Boolean(onboarding),
      asOf: now,
    },
  };
}

export const memberRouter = router({
  create: protectedProcedure
    .input(createMemberSchema)
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureEnabled(
        ctx.tenantId!,
        'membership_enabled',
        'Your subscription does not include membership management.'
      );
      const currentMemberCount = await prisma.member.count({
        where: { church: { organization: { tenantId: ctx.tenantId! } } },
      });
      await ensureFeatureLimit(
        ctx.tenantId!,
        'max_members',
        currentMemberCount,
        1,
        'Member limit reached for your subscription.'
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

      if (input.householdId) {
        const household = await prisma.household.findFirst({
          where: { id: input.householdId, churchId: input.churchId },
        });
        if (!household) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Household not found' });
        }
      }

      return prisma.member.create({
        data: {
          churchId: input.churchId,
          firstName: input.firstName,
          lastName: input.lastName,
          middleName: input.middleName,
          preferredName: input.preferredName,
          email: input.email,
          clerkUserId: input.clerkUserId,
          phone: input.phone,
          status: input.status,
          gender: input.gender,
          maritalStatus: input.maritalStatus,
          dateOfBirth: input.dateOfBirth,
          joinDate: input.joinDate,
          baptismDate: input.baptismDate,
          confirmationDate: input.confirmationDate,
          avatarUrl: input.avatarUrl,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2,
          city: input.city,
          state: input.state,
          postalCode: input.postalCode,
          country: input.country,
          emergencyContactName: input.emergencyContactName,
          emergencyContactPhone: input.emergencyContactPhone,
          notes: input.notes,
          householdId: input.householdId,
          directoryVisibility: input.directoryVisibility,
          showEmailInDirectory: input.showEmailInDirectory,
          showPhoneInDirectory: input.showPhoneInDirectory,
          showAddressInDirectory: input.showAddressInDirectory,
          showPhotoInDirectory: input.showPhotoInDirectory,
        },
      });
    }),

  list: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
        query: z.string().optional(),
        status: z.nativeEnum(MemberStatus).optional(),
        tagId: z.string().optional(),
        groupId: z.string().optional(),
        limit: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ input, ctx }) => {
      const query = input.query?.trim();
      return prisma.member.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.tagId ? { tagAssignments: { some: { tagId: input.tagId } } } : {}),
          ...(input.groupId ? { groupMemberships: { some: { groupId: input.groupId } } } : {}),
          ...(query
            ? {
                OR: [
                  { firstName: { contains: query, mode: 'insensitive' } },
                  { lastName: { contains: query, mode: 'insensitive' } },
                  { preferredName: { contains: query, mode: 'insensitive' } },
                  { email: { contains: query, mode: 'insensitive' } },
                  { phone: { contains: query, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        include: {
          household: true,
          tagAssignments: { include: { tag: true } },
        },
      });
    }),

  directory: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
        viewer: z.enum(['PUBLIC', 'MEMBER', 'LEADER']).default('MEMBER'),
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const allowedVisibilities =
        input.viewer === 'PUBLIC'
          ? [MemberDirectoryVisibility.PUBLIC]
          : input.viewer === 'LEADER'
          ? [MemberDirectoryVisibility.PUBLIC, MemberDirectoryVisibility.MEMBERS_ONLY, MemberDirectoryVisibility.LEADERS_ONLY]
          : [MemberDirectoryVisibility.PUBLIC, MemberDirectoryVisibility.MEMBERS_ONLY];

      return prisma.member.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
          directoryVisibility: { in: allowedVisibilities },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        take: input.limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          preferredName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          directoryVisibility: true,
          showEmailInDirectory: true,
          showPhoneInDirectory: true,
          showAddressInDirectory: true,
          showPhotoInDirectory: true,
        },
      }).then((records) =>
        records.map((member) => ({
          ...member,
          email: member.showEmailInDirectory ? member.email : null,
          phone: member.showPhoneInDirectory ? member.phone : null,
          avatarUrl: member.showPhotoInDirectory ? member.avatarUrl : null,
          addressLine1: member.showAddressInDirectory ? member.addressLine1 : null,
          addressLine2: member.showAddressInDirectory ? member.addressLine2 : null,
          city: member.showAddressInDirectory ? member.city : null,
          state: member.showAddressInDirectory ? member.state : null,
          postalCode: member.showAddressInDirectory ? member.postalCode : null,
          country: member.showAddressInDirectory ? member.country : null,
        }))
      );
    }),

  profile: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const member = await prisma.member.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
        include: {
          household: true,
          tagAssignments: { include: { tag: true } },
          milestones: true,
          groupMemberships: { include: { group: true } },
          volunteerAssignments: { include: { role: true } },
        },
      });

      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      const donations = await prisma.donation.groupBy({
        by: ['currency'],
        where: { memberId: input.id, status: 'COMPLETED' },
        _sum: { amount: true },
        _count: true,
      });

      const lastDonation = await prisma.donation.findFirst({
        where: { memberId: input.id, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, amount: true, currency: true },
      });

      const attendanceCount = await prisma.attendance.count({
        where: { memberId: input.id },
      });

      const lastAttendance = await prisma.attendance.findFirst({
        where: { memberId: input.id },
        orderBy: [{ checkInAt: 'desc' }, { createdAt: 'desc' }],
        select: { checkInAt: true, createdAt: true },
      });

      const engagementScore = await computeEngagementScore(input.id);

      return {
        member,
        giving: {
          totals: donations.map((row) => ({
            currency: row.currency,
            totalAmount: row._sum.amount,
            count: row._count,
          })),
          lastDonationAt: lastDonation?.createdAt ?? null,
          lastDonationAmount: lastDonation?.amount ?? null,
          lastDonationCurrency: lastDonation?.currency ?? null,
        },
        attendance: {
          count: attendanceCount,
          lastSeenAt: lastAttendance?.checkInAt ?? lastAttendance?.createdAt ?? null,
        },
        engagementScore,
      };
    }),

  engagementSummary: protectedProcedure
    .input(z.object({ churchId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const baseFilter = {
        church: { organization: { tenantId: ctx.tenantId! } },
        ...(input.churchId ? { churchId: input.churchId } : {}),
      };
      const memberFilter = {
        ...(input.churchId ? { churchId: input.churchId } : {}),
        church: { organization: { tenantId: ctx.tenantId! } },
      };

      const totalMembers = await prisma.member.count({ where: baseFilter });
      const statusCounts = await prisma.member.groupBy({
        by: ['status'],
        where: baseFilter,
        _count: true,
      });

      const now = new Date();
      const newSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const activitySince = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const lapsedSince = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);

      const newMembers = await prisma.member.count({
        where: { ...baseFilter, createdAt: { gte: newSince } },
      });

      const attendance = await prisma.attendance.groupBy({
        by: ['memberId'],
        where: {
          member: memberFilter,
          createdAt: { gte: activitySince },
        },
        _max: { createdAt: true, checkInAt: true },
      });

      const donations = await prisma.donation.groupBy({
        by: ['memberId'],
        where: {
          member: memberFilter,
          status: 'COMPLETED',
          createdAt: { gte: activitySince },
          memberId: { not: null },
        },
        _max: { createdAt: true },
      });

      const activeIds = new Set<string>();
      for (const entry of attendance) {
        if (!entry.memberId) continue;
        activeIds.add(entry.memberId);
      }
      for (const entry of donations) {
        if (!entry.memberId || !entry._max.createdAt) continue;
        activeIds.add(entry.memberId);
      }

      const active = activeIds.size;
      const lapsed = await prisma.member.count({
        where: {
          ...baseFilter,
          id: { notIn: Array.from(activeIds) },
          createdAt: { lt: lapsedSince },
        },
      });

      return {
        totalMembers,
        statusCounts,
        newMembers,
        activeMembers: active,
        lapsedMembers: lapsed,
      };
    }),

  analytics: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
        lookbackDays: z.number().int().min(7).max(365).default(90),
      })
    )
    .query(async ({ input, ctx }) => {
      const baseFilter = {
        church: { organization: { tenantId: ctx.tenantId! } },
        ...(input.churchId ? { churchId: input.churchId } : {}),
      };
      const since = new Date(Date.now() - input.lookbackDays * 24 * 60 * 60 * 1000);

      const totalMembers = await prisma.member.count({ where: baseFilter });
      const activeMembers = await prisma.member.count({
        where: { ...baseFilter, status: MemberStatus.ACTIVE },
      });
      const newMembers = await prisma.member.count({
        where: {
          ...baseFilter,
          OR: [{ joinDate: { gte: since } }, { createdAt: { gte: since } }],
        },
      });
      const recentAttendance = await prisma.member.count({
        where: { ...baseFilter, attendance: { some: { checkInAt: { gte: since } } } },
      });
      const recentDonors = await prisma.member.count({
        where: {
          ...baseFilter,
          donations: { some: { status: 'COMPLETED', createdAt: { gte: since } } },
        },
      });
      const volunteers = await prisma.member.count({
        where: { ...baseFilter, volunteerAssignments: { some: { status: 'ACTIVE' } } },
      });
      const groupMembers = await prisma.member.count({
        where: { ...baseFilter, groupMemberships: { some: {} } },
      });
      const lapsedMembers = await prisma.member.count({
        where: {
          ...baseFilter,
          createdAt: { lt: since },
          attendance: { none: { checkInAt: { gte: since } } },
        },
      });

      const missingContact = await prisma.member.count({
        where: { ...baseFilter, email: null, phone: null },
      });

      return {
        lookbackDays: input.lookbackDays,
        totalMembers,
        activeMembers,
        newMembers,
        recentAttendance,
        recentDonors,
        volunteers,
        groupMembers,
        lapsedMembers,
        missingContact,
      };
    }),

  segments: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
        lookbackDays: z.number().int().min(7).max(365).default(90),
        limit: z.number().int().min(1).max(50).default(8),
      })
    )
    .query(async ({ input, ctx }) => {
      const baseFilter = {
        church: { organization: { tenantId: ctx.tenantId! } },
        ...(input.churchId ? { churchId: input.churchId } : {}),
      };
      const since = new Date(Date.now() - input.lookbackDays * 24 * 60 * 60 * 1000);

      const select = {
        id: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        email: true,
        phone: true,
        status: true,
      };

      const buildSegment = async (key: string, label: string, where: Record<string, any>) => {
        const [count, members] = await Promise.all([
          prisma.member.count({ where: { ...baseFilter, ...where } }),
          prisma.member.findMany({
            where: { ...baseFilter, ...where },
            take: input.limit,
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
            select,
          }),
        ]);
        return { key, label, count, members };
      };

      return [
        await buildSegment('new_members', 'New members', {
          OR: [{ joinDate: { gte: since } }, { createdAt: { gte: since } }],
        }),
        await buildSegment('active_attenders', 'Active attenders', {
          attendance: { some: { checkInAt: { gte: since } } },
        }),
        await buildSegment('recent_donors', 'Recent donors', {
          donations: { some: { status: 'COMPLETED', createdAt: { gte: since } } },
        }),
        await buildSegment('volunteers', 'Active volunteers', {
          volunteerAssignments: { some: { status: 'ACTIVE' } },
        }),
        await buildSegment('group_members', 'Group members', {
          groupMemberships: { some: {} },
        }),
        await buildSegment('lapsed_members', 'Lapsed members', {
          createdAt: { lt: since },
          attendance: { none: { checkInAt: { gte: since } } },
        }),
        await buildSegment('missing_contact', 'Missing contact info', {
          email: null,
          phone: null,
        }),
      ];
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: updateMemberSchema }))
    .mutation(async ({ input, ctx }) => {
      const member = await prisma.member.findFirst({
        where: {
          id: input.id,
          church: { organization: { tenantId: ctx.tenantId! } },
        },
      });

      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      if (input.data.clerkUserId) {
        const existing = await prisma.member.findFirst({
          where: {
            clerkUserId: input.data.clerkUserId,
            id: { not: input.id },
          },
        });
        if (existing) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Clerk user already linked to another member' });
        }
      }

      if (input.data.householdId) {
        const household = await prisma.household.findFirst({
          where: { id: input.data.householdId, churchId: member.churchId },
        });
        if (!household) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Household not found' });
        }
      }

      return prisma.member.update({ where: { id: input.id }, data: input.data });
    }),

  selfProfile: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId || !ctx.tenantId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const member = await prisma.member.findFirst({
      where: { clerkUserId: ctx.userId, church: { organization: { tenantId: ctx.tenantId } } },
      include: {
        household: true,
        tagAssignments: { include: { tag: true } },
        milestones: true,
        groupMemberships: { include: { group: true } },
        volunteerAssignments: { include: { role: true } },
      },
    });

    if (!member) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
    }

    const donations = await prisma.donation.groupBy({
      by: ['currency'],
      where: { memberId: member.id, status: 'COMPLETED' },
      _sum: { amount: true },
      _count: true,
    });

    const lastDonation = await prisma.donation.findFirst({
      where: { memberId: member.id, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, amount: true, currency: true },
    });

    const attendanceCount = await prisma.attendance.count({
      where: { memberId: member.id },
    });

    const lastAttendance = await prisma.attendance.findFirst({
      where: { memberId: member.id },
      orderBy: [{ checkInAt: 'desc' }, { createdAt: 'desc' }],
      select: { checkInAt: true, createdAt: true },
    });

    const engagementScore = await computeEngagementScore(member.id);

    return {
      member,
      giving: {
        totals: donations.map((row) => ({
          currency: row.currency,
          totalAmount: row._sum.amount,
          count: row._count,
        })),
        lastDonationAt: lastDonation?.createdAt ?? null,
        lastDonationAmount: lastDonation?.amount ?? null,
        lastDonationCurrency: lastDonation?.currency ?? null,
      },
      attendance: {
        count: attendanceCount,
        lastSeenAt: lastAttendance?.checkInAt ?? lastAttendance?.createdAt ?? null,
      },
      engagementScore,
    };
  }),

  myAccessRequest: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId || !ctx.tenantId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    return prisma.memberAccessRequest.findFirst({
      where: { clerkUserId: ctx.userId, church: { organization: { tenantId: ctx.tenantId } } },
      orderBy: { createdAt: 'desc' },
      include: { church: true },
    });
  }),

  requestAccess: protectedProcedure
    .input(
      z.object({
        churchId: z.string(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.userId || !ctx.tenantId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }

      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      return prisma.memberAccessRequest.upsert({
        where: { churchId_clerkUserId: { churchId: input.churchId, clerkUserId: ctx.userId } },
        update: {
          name: input.name ?? undefined,
          email: input.email ?? undefined,
          message: input.message ?? undefined,
          status: AccessRequestStatus.PENDING,
        },
        create: {
          churchId: input.churchId,
          clerkUserId: ctx.userId,
          name: input.name ?? undefined,
          email: input.email ?? undefined,
          message: input.message ?? undefined,
          status: AccessRequestStatus.PENDING,
        },
        include: { church: true },
      });
    }),

  listAccessRequests: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
        status: z.nativeEnum(AccessRequestStatus).optional(),
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireStaff(ctx.tenantId!, ctx.userId!);
      return prisma.memberAccessRequest.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
          ...(input.status ? { status: input.status } : {}),
        },
        include: { church: true, member: true },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });
    }),

  approveAccessRequest: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await requireStaff(ctx.tenantId!, ctx.userId!);
      const request = await prisma.memberAccessRequest.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
        include: { church: true },
      });
      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Access request not found' });
      }

      const existingMember = await prisma.member.findFirst({
        where: { clerkUserId: request.clerkUserId, churchId: request.churchId },
      });

      const member =
        existingMember ??
        (await prisma.member.create({
          data: {
            churchId: request.churchId,
            clerkUserId: request.clerkUserId,
            email: request.email ?? undefined,
            ...splitName(request.name),
          },
        }));

      return prisma.memberAccessRequest.update({
        where: { id: request.id },
        data: {
          status: AccessRequestStatus.APPROVED,
          memberId: member.id,
          approvedAt: new Date(),
        },
        include: { church: true, member: true },
      });
    }),

  denyAccessRequest: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await requireStaff(ctx.tenantId!, ctx.userId!);
      const request = await prisma.memberAccessRequest.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Access request not found' });
      }
      return prisma.memberAccessRequest.update({
        where: { id: request.id },
        data: {
          status: AccessRequestStatus.DENIED,
          deniedAt: new Date(),
        },
        include: { church: true },
      });
    }),

  selfUpdate: protectedProcedure
    .input(
      z.object({
        preferredName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        avatarUrl: z.string().optional(),
        addressLine1: z.string().optional(),
        addressLine2: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
        emergencyContactName: z.string().optional(),
        emergencyContactPhone: z.string().optional(),
        notes: z.string().optional(),
        directoryVisibility: z.nativeEnum(MemberDirectoryVisibility).optional(),
        showEmailInDirectory: z.boolean().optional(),
        showPhoneInDirectory: z.boolean().optional(),
        showAddressInDirectory: z.boolean().optional(),
        showPhotoInDirectory: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.userId || !ctx.tenantId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }

      const member = await prisma.member.findFirst({
        where: { clerkUserId: ctx.userId, church: { organization: { tenantId: ctx.tenantId } } },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member profile not linked to this user yet' });
      }

      return prisma.member.update({
        where: { id: member.id },
        data: input,
      });
    }),

  importCsv: protectedProcedure
    .input(memberImportSchema)
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureEnabled(
        ctx.tenantId!,
        'membership_enabled',
        'Your subscription does not include membership management.'
      );
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      const rows = parseMemberImport(input.csv);
      if (rows.length > 2000) {
        throw new TRPCError({ code: 'PAYLOAD_TOO_LARGE', message: 'CSV exceeds 2000 rows' });
      }

      const summary = {
        total: rows.length,
        created: 0,
        updated: 0,
        skipped: 0,
        warnings: [] as string[],
        errors: [] as string[],
        batchId: null as string | null,
      };
      let currentMemberCount = await prisma.member.count({
        where: { church: { organization: { tenantId: ctx.tenantId! } } },
      });

      const batch = input.dryRun
        ? null
        : await prisma.importBatch.create({
            data: {
              tenantId: ctx.tenantId!,
              churchId: input.churchId,
              entityType: ImportEntityType.MEMBER,
              filename: null,
              rowCount: rows.length,
              createdByClerkUserId: ctx.userId ?? undefined,
            },
          });
      summary.batchId = batch?.id ?? null;

      const batchItems: Array<{ entityType: ImportEntityType; action: ImportItemAction; entityId: string }> = [];

      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 2;
        const firstName = row.firstName?.trim();
        const lastName = row.lastName?.trim();

        if (!firstName || !lastName) {
          summary.skipped += 1;
          summary.warnings.push(`Row ${rowNumber}: Missing first or last name.`);
          continue;
        }

        const email = row.email?.trim().toLowerCase();
        const phone = row.phone?.trim();
        const statusKey = row.status?.trim().toUpperCase();
        const status =
          statusKey && Object.values(MemberStatus).includes(statusKey as MemberStatus)
            ? (statusKey as MemberStatus)
            : undefined;

        if (row.status && !status) {
          summary.warnings.push(`Row ${rowNumber}: Unknown status "${row.status}".`);
        }

        const parseDate = (value?: string) => {
          if (!value) return undefined;
          const parsed = new Date(value);
          return Number.isNaN(parsed.getTime()) ? undefined : parsed;
        };

        let member = email
          ? await prisma.member.findFirst({ where: { churchId: input.churchId, email } })
          : null;
        if (!member && phone) {
          member = await prisma.member.findFirst({ where: { churchId: input.churchId, phone } });
        }

        const householdName = row.householdName?.trim();
        let householdId: string | undefined;

        if (householdName) {
          const existingHousehold = await prisma.household.findFirst({
            where: { churchId: input.churchId, name: householdName },
          });
          if (existingHousehold) {
            householdId = existingHousehold.id;
          } else if (!input.dryRun) {
            const createdHousehold = await prisma.household.create({
              data: { churchId: input.churchId, name: householdName },
            });
            householdId = createdHousehold.id;
          }
        }

        if (input.dryRun) {
          if (member) {
            summary.updated += 1;
          } else {
            await ensureFeatureLimit(
              ctx.tenantId!,
              'max_members',
              currentMemberCount,
              summary.created + 1,
              'Member limit reached for your subscription.'
            );
            summary.created += 1;
          }
          continue;
        }

        const data = {
          firstName,
          lastName,
          middleName: row.middleName?.trim() || undefined,
          preferredName: row.preferredName?.trim() || undefined,
          email: email || undefined,
          phone: phone || undefined,
          status: status ?? undefined,
          addressLine1: row.addressLine1?.trim() || undefined,
          addressLine2: row.addressLine2?.trim() || undefined,
          city: row.city?.trim() || undefined,
          state: row.state?.trim() || undefined,
          postalCode: row.postalCode?.trim() || undefined,
          country: row.country?.trim() || undefined,
          dateOfBirth: parseDate(row.dateOfBirth),
          joinDate: parseDate(row.joinDate),
          baptismDate: parseDate(row.baptismDate),
          confirmationDate: parseDate(row.confirmationDate),
          notes: row.notes?.trim() || undefined,
          householdId,
        };

        try {
          if (member) {
            member = await prisma.member.update({ where: { id: member.id }, data });
            summary.updated += 1;
            if (batch) batchItems.push({ entityType: ImportEntityType.MEMBER, action: ImportItemAction.UPDATED, entityId: member.id });
          } else {
            await ensureFeatureLimit(
              ctx.tenantId!,
              'max_members',
              currentMemberCount,
              1,
              `Member limit reached for your subscription at row ${rowNumber}.`
            );
            member = await prisma.member.create({ data: { ...data, churchId: input.churchId } });
            summary.created += 1;
            currentMemberCount += 1;
            if (batch) batchItems.push({ entityType: ImportEntityType.MEMBER, action: ImportItemAction.CREATED, entityId: member.id });
          }
        } catch (error) {
          summary.errors.push(`Row ${rowNumber}: Failed to save member.`);
          continue;
        }

        if (member && row.tags?.length) {
          for (const tagName of row.tags) {
            const tag = await prisma.memberTag.upsert({
              where: { churchId_name: { churchId: input.churchId, name: tagName } },
              update: {},
              create: { churchId: input.churchId, name: tagName },
            });
            await prisma.memberTagAssignment.upsert({
              where: { memberId_tagId: { memberId: member.id, tagId: tag.id } },
              update: {},
              create: { memberId: member.id, tagId: tag.id },
            });
          }
        }
      }

      if (batch) {
        if (batchItems.length) {
          await prisma.importBatchItem.createMany({
            data: batchItems.map((item) => ({
              batchId: batch.id,
              entityType: item.entityType,
              action: item.action,
              entityId: item.entityId,
            })),
          });
        }

        await recordAuditLog({
          tenantId: ctx.tenantId,
          churchId: input.churchId,
          actorType: AuditActorType.USER,
          actorId: ctx.userId,
          action: 'members.import_csv_applied',
          targetType: 'ImportBatch',
          targetId: batch.id,
          metadata: {
            total: summary.total,
            created: summary.created,
            updated: summary.updated,
            skipped: summary.skipped,
            errors: summary.errors.length,
          },
        });
      }

      return summary;
    }),

  rollbackImport: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ensureFeatureEnabled(
        ctx.tenantId!,
        'membership_enabled',
        'Your subscription does not include membership management.'
      );
      if (!ctx.userId || !ctx.tenantId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }
      await requireStaff(ctx.tenantId!, ctx.userId!);

      const batch = await prisma.importBatch.findFirst({
        where: {
          id: input.batchId,
          tenantId: ctx.tenantId!,
          entityType: ImportEntityType.MEMBER,
          status: ImportBatchStatus.APPLIED,
        },
      });
      if (!batch) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Import batch not found or already rolled back' });
      }

      const items = await prisma.importBatchItem.findMany({
        where: {
          batchId: batch.id,
          entityType: ImportEntityType.MEMBER,
          action: ImportItemAction.CREATED,
        },
        select: { entityId: true },
      });
      const ids = items.map((row) => row.entityId);

      const deleted = ids.length
        ? await prisma.member.deleteMany({
            where: { id: { in: ids }, churchId: batch.churchId },
          })
        : { count: 0 };

      await prisma.importBatch.update({
        where: { id: batch.id },
        data: { status: 'ROLLED_BACK' },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: batch.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'members.import_csv_rolled_back',
        targetType: 'ImportBatch',
        targetId: batch.id,
        metadata: { deletedMembers: deleted.count },
      });

      return { ok: true, deletedMembers: deleted.count };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const member = await prisma.member.findFirst({
        where: {
          id: input.id,
          church: { organization: { tenantId: ctx.tenantId! } },
        },
      });

      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      return prisma.member.delete({ where: { id: input.id } });
    }),
});
