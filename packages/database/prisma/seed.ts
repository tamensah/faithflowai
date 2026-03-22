import { Prisma } from '../src/generated/prisma/client';
import { prisma } from '../src/client';

function mergeMetadata(current: Prisma.JsonValue | null | undefined, next: Record<string, unknown>) {
  const base =
    current && typeof current === 'object' && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...base, ...next } as Prisma.InputJsonValue;
}

const upsertPlanFeature = (planId: string, key: string, enabled: boolean, limit?: number | null) =>
  prisma.subscriptionPlanFeature.upsert({
    where: { planId_key: { planId, key } },
    update: { enabled, limit: limit ?? null },
    create: { planId, key, enabled, limit: limit ?? null },
  });

async function seedPlans() {
  // ── Starter ──────────────────────────────────────────────────────────
  const starterPlan = await prisma.subscriptionPlan.upsert({
    where: { code: 'starter' },
    update: { name: 'Starter', currency: 'USD', interval: 'MONTHLY', amountMinor: 4900, isActive: true, isDefault: true },
    create: {
      code: 'starter',
      name: 'Starter',
      description: 'For small churches getting operational clarity fast.',
      currency: 'USD',
      interval: 'MONTHLY',
      amountMinor: 4900,
      isActive: true,
      isDefault: true,
      metadata: { target: 'small churches', trialDays: 14 },
    },
  });

  await prisma.subscriptionPlan.update({
    where: { id: starterPlan.id },
    data: { metadata: mergeMetadata(starterPlan.metadata, { target: 'small churches', trialDays: 14 }) },
  });

  await prisma.subscriptionPlanFeature.upsert({
    where: { planId_key: { planId: starterPlan.id, key: 'max_members' } },
    update: { enabled: true, limit: 1000 },
    create: { planId: starterPlan.id, key: 'max_members', enabled: true, limit: 1000 },
  });
  await prisma.subscriptionPlanFeature.upsert({
    where: { planId_key: { planId: starterPlan.id, key: 'max_campuses' } },
    update: { enabled: true, limit: 1 },
    create: { planId: starterPlan.id, key: 'max_campuses', enabled: true, limit: 1 },
  });
  await prisma.subscriptionPlanFeature.upsert({
    where: { planId_key: { planId: starterPlan.id, key: 'ai_insights' } },
    update: { enabled: false, limit: null },
    create: { planId: starterPlan.id, key: 'ai_insights', enabled: false },
  });
  await upsertPlanFeature(starterPlan.id, 'membership_enabled', true);
  await upsertPlanFeature(starterPlan.id, 'events_enabled', true);
  await upsertPlanFeature(starterPlan.id, 'finance_enabled', true);
  await upsertPlanFeature(starterPlan.id, 'multi_campus_enabled', true);
  await upsertPlanFeature(starterPlan.id, 'facility_management_enabled', false);
  await upsertPlanFeature(starterPlan.id, 'pastoral_care_enabled', true);
  await upsertPlanFeature(starterPlan.id, 'content_library_enabled', true);
  await upsertPlanFeature(starterPlan.id, 'streaming_enabled', false);
  await upsertPlanFeature(starterPlan.id, 'support_center_enabled', true);
  await upsertPlanFeature(starterPlan.id, 'custom_domain_enabled', false);
  await upsertPlanFeature(starterPlan.id, 'max_events_monthly', true, 30);
  await upsertPlanFeature(starterPlan.id, 'max_expenses_monthly', true, 80);

  // ── Growth ───────────────────────────────────────────────────────────
  const growthPlan = await prisma.subscriptionPlan.upsert({
    where: { code: 'growth' },
    update: { name: 'Growth', currency: 'USD', interval: 'MONTHLY', amountMinor: 14900, isActive: true, isDefault: false },
    create: {
      code: 'growth',
      name: 'Growth',
      description: 'For growing churches running multiple campuses and global giving.',
      currency: 'USD',
      interval: 'MONTHLY',
      amountMinor: 14900,
      isActive: true,
      isDefault: false,
      metadata: { target: 'growing churches', trialDays: 14 },
    },
  });
  await prisma.subscriptionPlan.update({
    where: { id: growthPlan.id },
    data: { metadata: mergeMetadata(growthPlan.metadata, { target: 'growing churches', trialDays: 14 }) },
  });
  await prisma.subscriptionPlanFeature.upsert({
    where: { planId_key: { planId: growthPlan.id, key: 'max_members' } },
    update: { enabled: true, limit: 5000 },
    create: { planId: growthPlan.id, key: 'max_members', enabled: true, limit: 5000 },
  });
  await prisma.subscriptionPlanFeature.upsert({
    where: { planId_key: { planId: growthPlan.id, key: 'max_campuses' } },
    update: { enabled: true, limit: 5 },
    create: { planId: growthPlan.id, key: 'max_campuses', enabled: true, limit: 5 },
  });
  await prisma.subscriptionPlanFeature.upsert({
    where: { planId_key: { planId: growthPlan.id, key: 'ai_insights' } },
    update: { enabled: true, limit: null },
    create: { planId: growthPlan.id, key: 'ai_insights', enabled: true },
  });
  await upsertPlanFeature(growthPlan.id, 'membership_enabled', true);
  await upsertPlanFeature(growthPlan.id, 'events_enabled', true);
  await upsertPlanFeature(growthPlan.id, 'finance_enabled', true);
  await upsertPlanFeature(growthPlan.id, 'multi_campus_enabled', true);
  await upsertPlanFeature(growthPlan.id, 'facility_management_enabled', true);
  await upsertPlanFeature(growthPlan.id, 'pastoral_care_enabled', true);
  await upsertPlanFeature(growthPlan.id, 'content_library_enabled', true);
  await upsertPlanFeature(growthPlan.id, 'streaming_enabled', true);
  await upsertPlanFeature(growthPlan.id, 'support_center_enabled', true);
  await upsertPlanFeature(growthPlan.id, 'custom_domain_enabled', true);
  await upsertPlanFeature(growthPlan.id, 'max_events_monthly', true, 200);
  await upsertPlanFeature(growthPlan.id, 'max_expenses_monthly', true, 500);

  // ── Enterprise ───────────────────────────────────────────────────────
  const enterprisePlan = await prisma.subscriptionPlan.upsert({
    where: { code: 'enterprise' },
    update: { name: 'Enterprise', currency: 'USD', interval: 'MONTHLY', amountMinor: 0, isActive: true, isDefault: false },
    create: {
      code: 'enterprise',
      name: 'Enterprise',
      description: 'For multi-campus and diaspora networks with advanced controls.',
      currency: 'USD',
      interval: 'MONTHLY',
      amountMinor: 0,
      isActive: true,
      isDefault: false,
      metadata: { target: 'multi-campus and diaspora networks', trialDays: 0 },
    },
  });
  await prisma.subscriptionPlan.update({
    where: { id: enterprisePlan.id },
    data: { metadata: mergeMetadata(enterprisePlan.metadata, { target: 'multi-campus and diaspora networks', trialDays: 0 }) },
  });
  await prisma.subscriptionPlanFeature.upsert({
    where: { planId_key: { planId: enterprisePlan.id, key: 'max_members' } },
    update: { enabled: true, limit: null },
    create: { planId: enterprisePlan.id, key: 'max_members', enabled: true, limit: null },
  });
  await prisma.subscriptionPlanFeature.upsert({
    where: { planId_key: { planId: enterprisePlan.id, key: 'max_campuses' } },
    update: { enabled: true, limit: null },
    create: { planId: enterprisePlan.id, key: 'max_campuses', enabled: true, limit: null },
  });
  await prisma.subscriptionPlanFeature.upsert({
    where: { planId_key: { planId: enterprisePlan.id, key: 'ai_insights' } },
    update: { enabled: true, limit: null },
    create: { planId: enterprisePlan.id, key: 'ai_insights', enabled: true },
  });
  await upsertPlanFeature(enterprisePlan.id, 'membership_enabled', true);
  await upsertPlanFeature(enterprisePlan.id, 'events_enabled', true);
  await upsertPlanFeature(enterprisePlan.id, 'finance_enabled', true);
  await upsertPlanFeature(enterprisePlan.id, 'multi_campus_enabled', true);
  await upsertPlanFeature(enterprisePlan.id, 'facility_management_enabled', true);
  await upsertPlanFeature(enterprisePlan.id, 'pastoral_care_enabled', true);
  await upsertPlanFeature(enterprisePlan.id, 'content_library_enabled', true);
  await upsertPlanFeature(enterprisePlan.id, 'streaming_enabled', true);
  await upsertPlanFeature(enterprisePlan.id, 'support_center_enabled', true);
  await upsertPlanFeature(enterprisePlan.id, 'custom_domain_enabled', true);
  await upsertPlanFeature(enterprisePlan.id, 'max_events_monthly', true, null);
  await upsertPlanFeature(enterprisePlan.id, 'max_expenses_monthly', true, null);

  return { starterPlan };
}

async function main() {
  const clerkOrgId = 'org_demo';

  // ── Tenant / Org / Church ────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { clerkOrgId },
    update: {},
    create: { name: 'Grace Community Church', slug: 'grace-community', clerkOrgId },
  });

  const { starterPlan } = await seedPlans();

  const existingActiveSubscription = await prisma.tenantSubscription.findFirst({
    where: { tenantId: tenant.id, status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED'] } },
  });
  if (!existingActiveSubscription) {
    await prisma.tenantSubscription.create({
      data: { tenantId: tenant.id, planId: starterPlan.id, status: 'ACTIVE', provider: 'MANUAL', startsAt: new Date() },
    });
  }

  let organization = await prisma.organization.findFirst({ where: { tenantId: tenant.id } });
  if (!organization) {
    organization = await prisma.organization.create({
      data: { tenantId: tenant.id, name: 'Grace Community Church' },
    });
  }

  let church = await prisma.church.findFirst({ where: { organizationId: organization.id } });
  if (!church) {
    church = await prisma.church.create({
      data: {
        organizationId: organization.id,
        name: 'Grace Community Church',
        slug: 'grace-community',
        countryCode: 'GH',
        timezone: 'Africa/Accra',
      },
    });
  }

  // ── Campuses ─────────────────────────────────────────────────────────
  let campus = await prisma.campus.findFirst({ where: { churchId: church.id, name: 'Accra Main Campus' } });
  if (!campus) {
    campus = await prisma.campus.create({
      data: { churchId: church.id, name: 'Accra Main Campus', timezone: 'Africa/Accra' },
    });
  }

  // ── Security policy + Domain ─────────────────────────────────────────
  await prisma.tenantSecurityPolicy.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      requireMfaForStaff: true,
      enforceSso: false,
      sessionTimeoutMinutes: 480,
      dataRetentionDays: 3650,
      breachContactEmail: 'security@gracecommunitygh.org',
    },
  });

  await prisma.tenantDomain.upsert({
    where: { tenantId_domain: { tenantId: tenant.id, domain: 'demo.faithflow.local' } },
    update: {},
    create: {
      tenantId: tenant.id,
      domain: 'demo.faithflow.local',
      status: 'ACTIVE',
      verificationToken: 'demo-token',
      dnsTarget: 'cname.faithflow.app',
      verifiedAt: new Date(),
      sslStatus: 'PROVISIONED',
    },
  });

  // ── Finance: Fund / Campaign / Fundraiser ────────────────────────────
  let fund = await prisma.fund.findFirst({ where: { churchId: church.id, isDefault: true } });
  if (!fund) {
    fund = await prisma.fund.create({
      data: { churchId: church.id, name: 'General Fund', description: 'Primary giving fund', isDefault: true },
    });
  }

  let buildingFund = await prisma.fund.findFirst({ where: { churchId: church.id, name: 'Building Fund' } });
  if (!buildingFund) {
    buildingFund = await prisma.fund.create({
      data: { churchId: church.id, name: 'Building Fund', description: 'New auditorium construction project' },
    });
  }

  let campaign = await prisma.campaign.findFirst({ where: { churchId: church.id } });
  if (!campaign) {
    campaign = await prisma.campaign.create({
      data: {
        churchId: church.id,
        name: 'New Auditorium Project',
        description: 'Support the construction of our new 2,000-seat auditorium in Accra',
        targetAmount: new Prisma.Decimal(500000),
        currency: 'GHS',
      },
    });
  }

  if (!await prisma.fundraiserPage.findFirst({ where: { churchId: church.id } })) {
    await prisma.fundraiserPage.create({
      data: {
        churchId: church.id,
        campaignId: campaign.id,
        name: 'Youth Department Pledge',
        slug: 'youth-pledge',
        goalAmount: new Prisma.Decimal(50000),
        currency: 'GHS',
        message: 'Help our youth department raise funds for the new auditorium project.',
      },
    });
  }

  // ── Finance: Expense categories + Budget ────────────────────────────
  let expenseCategory = await prisma.expenseCategory.findFirst({ where: { churchId: church.id, name: 'Operations' } });
  if (!expenseCategory) {
    expenseCategory = await prisma.expenseCategory.create({
      data: { churchId: church.id, name: 'Operations', description: 'General operating expenses' },
    });
  }

  let staffingCategory = await prisma.expenseCategory.findFirst({ where: { churchId: church.id, name: 'Staffing' } });
  if (!staffingCategory) {
    staffingCategory = await prisma.expenseCategory.create({
      data: { churchId: church.id, name: 'Staffing', description: 'Staff salaries and pastoral stipends' },
    });
  }

  if (!await prisma.budget.findFirst({ where: { churchId: church.id } })) {
    const budget = await prisma.budget.create({
      data: {
        churchId: church.id,
        name: '2026 Operating Budget',
        startAt: new Date(new Date().getFullYear(), 0, 1),
        endAt: new Date(new Date().getFullYear(), 11, 31),
      },
    });
    await prisma.budgetItem.createMany({
      data: [
        { budgetId: budget.id, categoryId: expenseCategory.id, name: 'Facility & Utilities', allocatedAmount: new Prisma.Decimal(8000) },
        { budgetId: budget.id, categoryId: staffingCategory.id, name: 'Pastoral Stipends', allocatedAmount: new Prisma.Decimal(25000) },
      ],
    });
  }

  // ── Members ──────────────────────────────────────────────────────────
  // Ghana-context demo members. idempotent: only create if church has none.
  let allMembers = await prisma.member.findMany({ where: { churchId: church.id } });

  if (allMembers.length === 0) {
    const now = new Date();
    await prisma.member.createMany({
      data: [
        // Household 1 — Asante family (husband + wife)
        {
          churchId: church.id,
          firstName: 'Kwame',
          lastName: 'Asante',
          email: 'kwame.asante@demo.church',
          phone: '+233244100101',
          gender: 'MALE',
          maritalStatus: 'MARRIED',
          status: 'ACTIVE',
          city: 'Accra',
          country: 'GH',
          joinDate: new Date(now.getFullYear() - 3, 5, 1),
          baptismDate: new Date(now.getFullYear() - 2, 8, 14),
        },
        {
          churchId: church.id,
          firstName: 'Abena',
          lastName: 'Asante',
          email: 'abena.asante@demo.church',
          phone: '+233244100102',
          gender: 'FEMALE',
          maritalStatus: 'MARRIED',
          status: 'ACTIVE',
          city: 'Accra',
          country: 'GH',
          joinDate: new Date(now.getFullYear() - 3, 5, 1),
        },
        // Household 2 — Mensah family
        {
          churchId: church.id,
          firstName: 'Kofi',
          lastName: 'Mensah',
          email: 'kofi.mensah@demo.church',
          phone: '+233244100103',
          gender: 'MALE',
          status: 'ACTIVE',
          city: 'Accra',
          country: 'GH',
          joinDate: new Date(now.getFullYear() - 1, 1, 15),
        },
        {
          churchId: church.id,
          firstName: 'Ama',
          lastName: 'Mensah',
          email: 'ama.mensah@demo.church',
          phone: '+233244100104',
          gender: 'FEMALE',
          maritalStatus: 'MARRIED',
          status: 'ACTIVE',
          city: 'Accra',
          country: 'GH',
          joinDate: new Date(now.getFullYear() - 1, 1, 15),
        },
        // Singles / young adults
        {
          churchId: church.id,
          firstName: 'Yaw',
          lastName: 'Boateng',
          email: 'yaw.boateng@demo.church',
          phone: '+233244100105',
          gender: 'MALE',
          status: 'ACTIVE',
          city: 'Accra',
          country: 'GH',
          joinDate: new Date(now.getFullYear(), 0, 10),
        },
        {
          churchId: church.id,
          firstName: 'Akosua',
          lastName: 'Darko',
          email: 'akosua.darko@demo.church',
          phone: '+233244100106',
          gender: 'FEMALE',
          status: 'ACTIVE',
          city: 'Kumasi',
          country: 'GH',
          joinDate: new Date(now.getFullYear() - 2, 9, 3),
        },
        // First timer — recently joined
        {
          churchId: church.id,
          firstName: 'Emmanuel',
          lastName: 'Tetteh',
          email: 'emmanuel.tetteh@demo.church',
          phone: '+233244100107',
          gender: 'MALE',
          status: 'ACTIVE',
          city: 'Accra',
          country: 'GH',
          joinDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7),
        },
        // Inactive member
        {
          churchId: church.id,
          firstName: 'Maame',
          lastName: 'Owusu',
          email: 'maame.owusu@demo.church',
          phone: '+233244100108',
          gender: 'FEMALE',
          status: 'INACTIVE',
          city: 'Accra',
          country: 'GH',
          joinDate: new Date(now.getFullYear() - 4, 3, 20),
        },
      ],
    });
    allMembers = await prisma.member.findMany({ where: { churchId: church.id } });
  }

  const [kwame, abena, kofi, ama, yaw, akosua, emmanuel] = allMembers;

  // ── Households ───────────────────────────────────────────────────────
  let asanteHousehold = await prisma.household.findFirst({ where: { churchId: church.id, name: 'Asante Family' } });
  if (!asanteHousehold && kwame && abena) {
    asanteHousehold = await prisma.household.create({
      data: { churchId: church.id, name: 'Asante Family', primaryMemberId: kwame.id },
    });
    await prisma.member.updateMany({
      where: { id: { in: [kwame.id, abena.id] } },
      data: { householdId: asanteHousehold.id },
    });
  }

  let mensahHousehold = await prisma.household.findFirst({ where: { churchId: church.id, name: 'Mensah Family' } });
  if (!mensahHousehold && kofi && ama) {
    mensahHousehold = await prisma.household.create({
      data: { churchId: church.id, name: 'Mensah Family', primaryMemberId: kofi.id },
    });
    await prisma.member.updateMany({
      where: { id: { in: [kofi.id, ama.id] } },
      data: { householdId: mensahHousehold.id },
    });
  }

  // ── Member tags ──────────────────────────────────────────────────────
  const tagDefs = [
    { name: 'First Timer', color: '#22c55e' },
    { name: 'Young Adult', color: '#3b82f6' },
    { name: "Men's Ministry", color: '#6366f1' },
    { name: "Women's Ministry", color: '#ec4899' },
    { name: 'Tithe Member', color: '#f59e0b' },
    { name: 'Small Group Leader', color: '#8b5cf6' },
  ];

  const tags: Record<string, string> = {};
  for (const def of tagDefs) {
    const tag = await prisma.memberTag.upsert({
      where: { churchId_name: { churchId: church.id, name: def.name } },
      update: {},
      create: { churchId: church.id, name: def.name, color: def.color },
    });
    tags[def.name] = tag.id;
  }

  // Assign tags to members
  const tagAssignments: Array<{ memberId: string; tagId: string }> = [];
  if (emmanuel) tagAssignments.push({ memberId: emmanuel.id, tagId: tags['First Timer']! });
  if (yaw) tagAssignments.push({ memberId: yaw.id, tagId: tags['Young Adult']! });
  if (akosua) tagAssignments.push({ memberId: akosua.id, tagId: tags['Young Adult']! });
  if (kwame) {
    tagAssignments.push({ memberId: kwame.id, tagId: tags["Men's Ministry"]! });
    tagAssignments.push({ memberId: kwame.id, tagId: tags['Tithe Member']! });
  }
  if (abena) tagAssignments.push({ memberId: abena.id, tagId: tags["Women's Ministry"]! });
  if (ama) tagAssignments.push({ memberId: ama.id, tagId: tags["Women's Ministry"]! });

  for (const assignment of tagAssignments) {
    await prisma.memberTagAssignment.upsert({
      where: { memberId_tagId: { memberId: assignment.memberId, tagId: assignment.tagId } },
      update: {},
      create: assignment,
    });
  }

  // ── Groups ───────────────────────────────────────────────────────────
  const mensFellowship = await prisma.group.findFirst({ where: { churchId: church.id, name: "Men's Fellowship" } }) ??
    await prisma.group.create({
      data: {
        churchId: church.id,
        name: "Men's Fellowship",
        type: 'SMALL_GROUP',
        description: 'Weekly men\'s Bible study and accountability group',
        meetingSchedule: 'Every Saturday 7:00 AM',
      },
    });

  const womenMinistry = await prisma.group.findFirst({ where: { churchId: church.id, name: "Women's Ministry" } }) ??
    await prisma.group.create({
      data: {
        churchId: church.id,
        name: "Women's Ministry",
        type: 'MINISTRY_TEAM',
        description: 'Women\'s prayer, outreach and fellowship ministry',
        meetingSchedule: 'Every Wednesday 6:00 PM',
      },
    });

  const youthGroup = await prisma.group.findFirst({ where: { churchId: church.id, name: 'Young Adults' } }) ??
    await prisma.group.create({
      data: {
        churchId: church.id,
        name: 'Young Adults',
        type: 'SMALL_GROUP',
        description: '18–35 fellowship and discipleship group',
        meetingSchedule: 'Every Friday 7:00 PM',
      },
    });

  const groupMemberships = [
    { groupId: mensFellowship.id, memberId: kwame.id, role: 'LEADER' as const },
    { groupId: mensFellowship.id, memberId: kofi.id, role: 'MEMBER' as const },
    { groupId: mensFellowship.id, memberId: yaw.id, role: 'MEMBER' as const },
    { groupId: womenMinistry.id, memberId: abena.id, role: 'LEADER' as const },
    { groupId: womenMinistry.id, memberId: ama.id, role: 'MEMBER' as const },
    { groupId: youthGroup.id, memberId: yaw.id, role: 'MEMBER' as const },
    { groupId: youthGroup.id, memberId: akosua.id, role: 'MEMBER' as const },
    { groupId: youthGroup.id, memberId: emmanuel.id, role: 'MEMBER' as const },
  ];
  for (const gm of groupMemberships) {
    await prisma.groupMember.upsert({
      where: { groupId_memberId: { groupId: gm.groupId, memberId: gm.memberId } },
      update: {},
      create: gm,
    });
  }

  // ── Volunteer ────────────────────────────────────────────────────────
  const ushersRole = await prisma.volunteerRole.upsert({
    where: { churchId_name: { churchId: church.id, name: 'Ushering Team' } },
    update: {},
    create: {
      churchId: church.id,
      name: 'Ushering Team',
      description: 'Welcome, seat, and assist congregants during Sunday services',
      status: 'OPEN',
    },
  });

  const worshipRole = await prisma.volunteerRole.upsert({
    where: { churchId_name: { churchId: church.id, name: 'Worship Team' } },
    update: {},
    create: {
      churchId: church.id,
      name: 'Worship Team',
      description: 'Lead congregational worship in song',
      status: 'OPEN',
    },
  });

  // Volunteer role assignments (standing assignment to a role)
  if (kwame) {
    await prisma.volunteerAssignment.upsert({
      where: { roleId_memberId: { roleId: ushersRole.id, memberId: kwame.id } },
      update: {},
      create: { roleId: ushersRole.id, memberId: kwame.id, status: 'ACTIVE' },
    });
  }
  if (yaw) {
    await prisma.volunteerAssignment.upsert({
      where: { roleId_memberId: { roleId: worshipRole.id, memberId: yaw.id } },
      update: {},
      create: { roleId: worshipRole.id, memberId: yaw.id, status: 'ACTIVE' },
    });
  }

  // Upcoming volunteer shift (this Sunday)
  const nextSunday = new Date();
  nextSunday.setDate(nextSunday.getDate() + ((7 - nextSunday.getDay()) % 7 || 7));
  nextSunday.setHours(8, 30, 0, 0);

  const existingShift = await prisma.volunteerShift.findFirst({ where: { churchId: church.id, roleId: ushersRole.id } });
  if (!existingShift) {
    const shift = await prisma.volunteerShift.create({
      data: {
        churchId: church.id,
        roleId: ushersRole.id,
        title: 'Sunday Morning Ushering',
        startAt: nextSunday,
        endAt: new Date(nextSunday.getTime() + 3 * 60 * 60 * 1000),
        capacity: 6,
      },
    });
    if (kwame) {
      await prisma.volunteerShiftAssignment.upsert({
        where: { shiftId_memberId: { shiftId: shift.id, memberId: kwame.id } },
        update: {},
        create: { shiftId: shift.id, memberId: kwame.id, status: 'SCHEDULED' },
      });
    }
    if (kofi) {
      await prisma.volunteerShiftAssignment.upsert({
        where: { shiftId_memberId: { shiftId: shift.id, memberId: kofi.id } },
        update: {},
        create: { shiftId: shift.id, memberId: kofi.id, status: 'SCHEDULED' },
      });
    }
  }

  // ── Admin user + Staff ───────────────────────────────────────────────
  const user = await prisma.user.upsert({
    where: { clerkUserId: 'user_demo' },
    update: {},
    create: { clerkUserId: 'user_demo', email: 'admin@gracecommunitygh.org', name: 'Demo Admin', role: 'ADMIN' },
  });

  await prisma.staffMembership.upsert({
    where: { userId_churchId: { userId: user.id, churchId: church.id } },
    update: { role: 'ADMIN' },
    create: { userId: user.id, churchId: church.id, role: 'ADMIN' },
  });

  // ── Events ───────────────────────────────────────────────────────────
  // Past event (last Sunday) — gives analytics data
  const lastSunday = new Date();
  lastSunday.setDate(lastSunday.getDate() - ((lastSunday.getDay() + 7) % 7 || 7));
  lastSunday.setHours(9, 0, 0, 0);

  let pastEvent = await prisma.event.findFirst({
    where: { churchId: church.id, title: 'Sunday Service', startAt: { lt: new Date() } },
  });
  if (!pastEvent) {
    pastEvent = await prisma.event.create({
      data: {
        churchId: church.id,
        campusId: campus.id,
        title: 'Sunday Service',
        description: 'Weekly Sunday morning worship service',
        type: 'SERVICE',
        startAt: lastSunday,
        endAt: new Date(lastSunday.getTime() + 2.5 * 60 * 60 * 1000),
        location: 'Main Auditorium',
        capacity: 500,
        checkInEnabled: true,
      },
    });
    // Attendance for past event
    for (const m of [kwame, abena, kofi, ama, yaw]) {
      if (!m) continue;
      await prisma.attendance.upsert({
        where: { eventId_memberId: { eventId: pastEvent.id, memberId: m.id } },
        update: { status: 'CHECKED_IN' },
        create: { eventId: pastEvent.id, memberId: m.id, status: 'CHECKED_IN', checkInAt: lastSunday },
      });
    }
  }

  // Upcoming event (next Sunday)
  const upcomingServiceStart = new Date(nextSunday);
  upcomingServiceStart.setHours(9, 0, 0, 0);

  let upcomingEvent = await prisma.event.findFirst({
    where: { churchId: church.id, title: 'Sunday Service', startAt: { gt: new Date() } },
  });
  if (!upcomingEvent) {
    upcomingEvent = await prisma.event.create({
      data: {
        churchId: church.id,
        campusId: campus.id,
        title: 'Sunday Service',
        description: 'Weekly Sunday morning worship service',
        type: 'SERVICE',
        startAt: upcomingServiceStart,
        endAt: new Date(upcomingServiceStart.getTime() + 2.5 * 60 * 60 * 1000),
        location: 'Main Auditorium',
        capacity: 500,
        requiresRsvp: true,
        checkInEnabled: true,
      },
    });
  }

  // Midweek prayer meeting
  const nextWednesday = new Date();
  nextWednesday.setDate(nextWednesday.getDate() + ((3 - nextWednesday.getDay() + 7) % 7 || 7));
  nextWednesday.setHours(18, 30, 0, 0);

  const prayerEvent = await prisma.event.findFirst({ where: { churchId: church.id, title: 'Midweek Prayer' } }) ??
    await prisma.event.create({
      data: {
        churchId: church.id,
        campusId: campus.id,
        title: 'Midweek Prayer',
        description: 'Corporate prayer and Bible study',
        type: 'PRAYER',
        startAt: nextWednesday,
        endAt: new Date(nextWednesday.getTime() + 90 * 60 * 1000),
        location: 'Prayer Room',
        capacity: 100,
      },
    });

  // RSVPs on upcoming event
  for (const m of [kwame, abena, yaw, akosua]) {
    if (!m || !upcomingEvent) continue;
    await prisma.eventRsvp.upsert({
      where: { eventId_memberId: { eventId: upcomingEvent.id, memberId: m.id } },
      update: {},
      create: { eventId: upcomingEvent.id, memberId: m.id, status: 'ATTENDING' },
    });
  }

  // ── Streaming ────────────────────────────────────────────────────────
  const liveChannel = await prisma.liveStreamChannel.upsert({
    where: { churchId_name: { churchId: church.id, name: 'Main Broadcast' } },
    update: {},
    create: {
      churchId: church.id,
      campusId: campus.id,
      name: 'Main Broadcast',
      provider: 'YOUTUBE',
      playbackUrl: 'https://www.youtube.com/watch?v=demo-stream',
      ingestUrl: 'rtmp://a.rtmp.youtube.com/live2',
      streamKey: 'demo-stream-key',
    },
  });

  await prisma.liveStreamSession.upsert({
    where: { id: `seed-live-${church.id}` },
    update: {},
    create: {
      id: `seed-live-${church.id}`,
      churchId: church.id,
      channelId: liveChannel.id,
      eventId: upcomingEvent?.id,
      title: 'Sunday Service Live Stream',
      status: 'SCHEDULED',
      moderationLevel: 'FILTERED',
      scheduledStartAt: upcomingServiceStart,
      isRecording: true,
    },
  });

  // ── Sermon (linked to past event) ────────────────────────────────────
  if (pastEvent && !await prisma.sermon.findFirst({ where: { churchId: church.id } })) {
    await prisma.sermon.create({
      data: {
        churchId: church.id,
        campusId: campus.id,
        eventId: pastEvent.id,
        title: 'Walking in Purpose',
        speaker: 'Pastor Samuel Owusu',
        seriesName: 'Created for More',
        summary: 'Exploring how God equips every believer with purpose and calling.',
        scriptureRefs: ['Jeremiah 29:11', 'Ephesians 2:10'],
        status: 'PUBLISHED',
        publishedAt: lastSunday,
        viewCount: 134,
      },
    });
  }

  // ── Content resource ─────────────────────────────────────────────────
  if (!await prisma.contentResource.findFirst({ where: { churchId: church.id } })) {
    await prisma.contentResource.create({
      data: {
        churchId: church.id,
        title: 'New Members Handbook 2026',
        description: 'Everything you need to know about Grace Community Church — our vision, values, and how to get connected.',
        type: 'DOCUMENT',
        visibility: 'MEMBERS_ONLY',
        tags: ['welcome', 'onboarding', 'new members'],
        isFeatured: true,
        publishedAt: new Date(),
      },
    });

    await prisma.contentResource.create({
      data: {
        churchId: church.id,
        title: 'Walking in Purpose — Sermon Notes',
        description: 'Download the study guide for this week\'s message: Walking in Purpose.',
        type: 'DOCUMENT',
        visibility: 'PUBLIC',
        tags: ['sermon', 'study guide', 'purpose'],
        publishedAt: lastSunday,
      },
    });
  }

  // ── Finance: Donations / Pledge / Recurring / Expense ───────────────
  if (!await prisma.donation.findFirst({ where: { churchId: church.id, provider: 'PAYSTACK' } })) {
    if (kwame) {
      await prisma.donation.create({
        data: {
          churchId: church.id,
          memberId: kwame.id,
          fundId: fund.id,
          amount: new Prisma.Decimal(500),
          currency: 'GHS',
          status: 'COMPLETED',
          provider: 'PAYSTACK',
          providerRef: `seed-paystack-${Date.now()}`,
          donorName: `${kwame.firstName} ${kwame.lastName}`,
          donorEmail: kwame.email ?? undefined,
        },
      });
    }
    if (abena) {
      await prisma.donation.create({
        data: {
          churchId: church.id,
          memberId: abena.id,
          fundId: buildingFund.id,
          campaignId: campaign.id,
          amount: new Prisma.Decimal(1000),
          currency: 'GHS',
          status: 'COMPLETED',
          provider: 'PAYSTACK',
          providerRef: `seed-paystack-${Date.now() + 1}`,
          donorName: `${abena.firstName} ${abena.lastName}`,
          donorEmail: abena.email ?? undefined,
        },
      });
    }
    if (kofi) {
      await prisma.donation.create({
        data: {
          churchId: church.id,
          memberId: kofi.id,
          fundId: fund.id,
          amount: new Prisma.Decimal(50),
          currency: 'USD',
          status: 'COMPLETED',
          provider: 'STRIPE',
          providerRef: `seed-stripe-${Date.now()}`,
          donorName: `${kofi.firstName} ${kofi.lastName}`,
          donorEmail: kofi.email ?? undefined,
        },
      });
    }
  }

  if (!await prisma.pledge.findFirst({ where: { churchId: church.id } }) && kwame) {
    await prisma.pledge.create({
      data: {
        churchId: church.id,
        memberId: kwame.id,
        amount: new Prisma.Decimal(5000),
        currency: 'GHS',
        notes: 'Annual pledge toward Building Fund campaign',
      },
    });
  }

  if (!await prisma.recurringDonation.findFirst({ where: { churchId: church.id } }) && abena) {
    await prisma.recurringDonation.create({
      data: {
        churchId: church.id,
        memberId: abena.id,
        amount: new Prisma.Decimal(200),
        currency: 'GHS',
        interval: 'MONTHLY',
        provider: 'PAYSTACK',
        startAt: new Date(),
      },
    });
  }

  if (!await prisma.expense.findFirst({ where: { churchId: church.id } })) {
    await prisma.expense.createMany({
      data: [
        {
          churchId: church.id,
          categoryId: expenseCategory.id,
          amount: new Prisma.Decimal(1200),
          currency: 'GHS',
          description: 'Monthly electricity bill — Accra main campus',
          vendor: 'ECG Ghana',
          occurredAt: new Date(),
          status: 'SUBMITTED',
        },
        {
          churchId: church.id,
          categoryId: staffingCategory.id,
          amount: new Prisma.Decimal(3500),
          currency: 'GHS',
          description: 'Pastoral stipend — March 2026',
          vendor: 'Internal',
          occurredAt: new Date(),
          status: 'APPROVED',
        },
      ],
    });
  }

  if (!await prisma.textToGiveNumber.findFirst({ where: { churchId: church.id } })) {
    await prisma.textToGiveNumber.create({
      data: {
        churchId: church.id,
        phoneNumber: '+233302000199',
        provider: 'STRIPE',
        defaultCurrency: 'GHS',
        fundId: fund.id,
      },
    });
  }

  // ── Care requests ────────────────────────────────────────────────────
  if (!await prisma.careRequest.findFirst({ where: { churchId: church.id } })) {
    const openCare = await prisma.careRequest.create({
      data: {
        churchId: church.id,
        campusId: campus.id,
        memberId: kwame?.id,
        requestedByMemberId: kwame?.id,
        title: 'Bereavement support — loss of father',
        details: 'Kwame lost his father last week. Please arrange a pastoral visit and check on the family.',
        status: 'OPEN',
        priority: 'HIGH',
        channel: 'WEB',
        dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.careNote.create({
      data: {
        careRequestId: openCare.id,
        authorUserId: user.id,
        note: 'Called Kwame — family is receiving visitors. Will visit Wednesday evening.',
        isPrivate: true,
      },
    });

    if (emmanuel) {
      await prisma.careRequest.create({
        data: {
          churchId: church.id,
          campusId: campus.id,
          memberId: emmanuel.id,
          requestedByMemberId: emmanuel.id,
          assignedToUserId: user.id,
          title: 'New member follow-up',
          details: 'Emmanuel joined last Sunday. Schedule a welcome call and assign a connect group.',
          status: 'IN_PROGRESS' as const,
          priority: 'NORMAL',
          channel: 'WEB',
          assignedAt: new Date(),
        },
      });
    }
  }

  // ── Communications ───────────────────────────────────────────────────
  await prisma.communicationTemplate.upsert({
    where: { churchId_name_channel: { churchId: church.id, name: 'Sunday Service Reminder', channel: 'EMAIL' } },
    update: {},
    create: {
      churchId: church.id,
      name: 'Sunday Service Reminder',
      channel: 'EMAIL',
      subject: 'Join us this Sunday at Grace Community Church 🙏',
      body: 'Dear {{firstName}},\n\nWe look forward to seeing you this Sunday for our 9:00 AM service at the Main Auditorium.\n\nSee you there!\nGrace Community Church Team',
    },
  });

  await prisma.communicationTemplate.upsert({
    where: { churchId_name_channel: { churchId: church.id, name: 'Welcome New Member', channel: 'SMS' } },
    update: {},
    create: {
      churchId: church.id,
      name: 'Welcome New Member',
      channel: 'SMS',
      body: 'Welcome to Grace Community Church, {{firstName}}! We\'re so glad you\'re here. Reply HELP for info or STOP to unsubscribe.',
    },
  });

  // ── Survey ───────────────────────────────────────────────────────────
  let survey = await prisma.survey.findFirst({ where: { churchId: church.id } });
  if (!survey) {
    survey = await prisma.survey.create({
      data: {
        churchId: church.id,
        title: 'March 2026 Member Feedback',
        description: 'Help us improve Sunday services and church programmes.',
        status: 'PUBLISHED',
        startAt: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        endAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
      },
    });

    await prisma.surveyQuestion.createMany({
      data: [
        { surveyId: survey.id, prompt: 'How would you rate this month\'s Sunday services?', type: 'RATING', order: 1, required: true },
        { surveyId: survey.id, prompt: 'Which ministry area would you like to see expanded?', type: 'MULTIPLE_CHOICE', order: 2, required: false, options: ['Youth', 'Worship', 'Outreach', 'Pastoral Care', 'Facilities'] },
        { surveyId: survey.id, prompt: 'Any suggestions or feedback for leadership?', type: 'TEXT', order: 3, required: false },
      ],
    });

    // One sample response
    if (kwame) {
      await prisma.surveyResponse.create({
        data: {
          surveyId: survey.id,
          memberId: kwame.id,
          respondentName: `${kwame.firstName} ${kwame.lastName}`,
          respondentEmail: kwame.email,
          answers: { '1': 5, '2': 'Youth', '3': 'The new media screens during worship are excellent!' },
        },
      });
    }
  }

  // ── Knowledge base article ───────────────────────────────────────────
  await prisma.kBArticle.upsert({
    where: { slug: 'how-to-set-up-online-giving' },
    update: {},
    create: {
      title: 'How to Set Up Online Giving',
      slug: 'how-to-set-up-online-giving',
      body: '## Getting Started with Online Giving\n\nFaithFlow AI supports giving via Stripe (USD) and Paystack (GHS/NGN/KES and more).\n\n### Steps\n1. Go to **Finance → Funds** and create a fund.\n2. Go to **Finance → Giving Links** to generate a shareable giving link or QR code.\n3. Share the link with your congregation via SMS, WhatsApp, or print.\n\n### Paystack Setup\n- Add your Paystack Secret Key in **Operations → Health**.\n- Test with a small transaction before going live.\n\n### Need help?\nContact support from the Help menu.',
      category: 'Finance',
      tags: ['giving', 'paystack', 'stripe', 'setup'],
      published: true,
      createdBy: 'seed',
    },
  });

  await prisma.kBArticle.upsert({
    where: { slug: 'member-portal-getting-started' },
    update: {},
    create: {
      title: 'Member Portal — Getting Started',
      slug: 'member-portal-getting-started',
      body: '## Your Member Portal\n\nThe member portal gives every church member a personal login to:\n- Update their profile and contact details\n- RSVP to events\n- View giving history\n- Sign up for volunteer shifts\n- Send messages to staff\n\n### How to Access\n1. Visit your church\'s portal URL.\n2. Click **Sign In** and use your email.\n3. If you\'re new, submit an access request — a staff member will approve it.\n\n### Privacy\nYou control what appears in the directory. Go to **Profile → Privacy** to adjust your settings.',
      category: 'Member Portal',
      tags: ['portal', 'member', 'getting started', 'access'],
      published: true,
      createdBy: 'seed',
    },
  });

  // ── Support ticket ───────────────────────────────────────────────────
  if (!await prisma.supportTicket.findFirst({ where: { tenantId: tenant.id } })) {
    const supportTicket = await prisma.supportTicket.create({
      data: {
        tenantId: tenant.id,
        churchId: church.id,
        requesterEmail: kwame?.email ?? 'member@demo.church',
        requesterName: kwame ? `${kwame.firstName} ${kwame.lastName}` : 'Demo Member',
        subject: 'Paystack giving link not loading for some members',
        description: 'Several members reported that the Paystack giving link shows a blank page on mobile. Tested on desktop and it works fine.',
        priority: 'HIGH',
        source: 'IN_APP',
        firstResponseDueAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
        resolutionDueAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    await prisma.supportTicketMessage.create({
      data: {
        ticketId: supportTicket.id,
        authorType: 'TENANT_USER',
        authorTenantUserId: 'user_demo',
        body: 'This is urgent — Sunday offering is tomorrow. Please advise.',
        isInternal: false,
      },
    });
  }

  // ── Platform admin ───────────────────────────────────────────────────
  const platformAdminEmail = process.env.PLATFORM_ADMIN_EMAIL;
  if (platformAdminEmail) {
    const platformUser = await prisma.platformUser.upsert({
      where: { email: platformAdminEmail.toLowerCase() },
      update: {},
      create: { email: platformAdminEmail.toLowerCase(), name: 'Platform Admin', status: 'ACTIVE' },
    });
    await prisma.platformUserRole.upsert({
      where: { platformUserId_role: { platformUserId: platformUser.id, role: 'SUPER_ADMIN' } },
      update: {},
      create: { platformUserId: platformUser.id, role: 'SUPER_ADMIN' },
    });
  }

  console.log([
    '✅ Seed complete — Grace Community Church (Ghana demo)',
    '   Tenant · Org · Church · 2 Campuses (Accra)',
    '   8 Members · 2 Households · 6 Tags',
    '   3 Groups · 2 Volunteer Roles · 1 Shift',
    '   2 Events (past + upcoming) · 4 RSVPs · Streaming session',
    '   1 Sermon · 2 Content resources',
    '   3 Donations (GHS + USD) · 1 Pledge · 1 Recurring · 2 Expenses',
    '   2 Care requests · 2 Comms templates · 1 Survey · 2 KB articles · 1 Support ticket',
  ].join('\n'));
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
