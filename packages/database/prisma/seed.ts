import { Prisma } from '../src/generated/prisma/client';
import { prisma } from '../src/client';

function mergeMetadata(current: Prisma.JsonValue | null | undefined, next: Record<string, unknown>) {
  const base =
    current && typeof current === 'object' && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...base, ...next } as Prisma.InputJsonValue;
}

async function main() {
  const clerkOrgId = 'org_demo';

  const tenant = await prisma.tenant.upsert({
    where: { clerkOrgId },
    update: {},
    create: {
      name: 'Demo Tenant',
      slug: 'demo-tenant',
      clerkOrgId,
    },
  });

  const upsertPlanFeature = async (planId: string, key: string, enabled: boolean, limit?: number | null) =>
    prisma.subscriptionPlanFeature.upsert({
      where: { planId_key: { planId, key } },
      update: { enabled, limit: limit ?? null },
      create: { planId, key, enabled, limit: limit ?? null },
    });

  const starterPlan = await prisma.subscriptionPlan.upsert({
    where: { code: 'starter' },
    update: {
      name: 'Starter',
      currency: 'USD',
      interval: 'MONTHLY',
      amountMinor: 4900,
      isActive: true,
      isDefault: true,
    },
    create: {
      code: 'starter',
      name: 'Starter',
      description: 'For small churches getting started with digital operations.',
      currency: 'USD',
      interval: 'MONTHLY',
      amountMinor: 4900,
      isActive: true,
      isDefault: true,
      metadata: {
        target: 'small churches',
        trialDays: 14,
      },
    },
  });

  await prisma.subscriptionPlan.update({
    where: { id: starterPlan.id },
    data: {
      metadata: mergeMetadata(starterPlan.metadata, {
        target: 'small churches',
        trialDays: 14,
      }),
    },
  });

  await prisma.subscriptionPlanFeature.upsert({
    where: { planId_key: { planId: starterPlan.id, key: 'max_members' } },
    update: { enabled: true, limit: 500 },
    create: { planId: starterPlan.id, key: 'max_members', enabled: true, limit: 500 },
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
  await upsertPlanFeature(starterPlan.id, 'pastoral_care_enabled', false);
  await upsertPlanFeature(starterPlan.id, 'content_library_enabled', true);
  await upsertPlanFeature(starterPlan.id, 'streaming_enabled', false);
  await upsertPlanFeature(starterPlan.id, 'support_center_enabled', true);
  await upsertPlanFeature(starterPlan.id, 'custom_domain_enabled', false);
  await upsertPlanFeature(starterPlan.id, 'max_events_monthly', true, 30);
  await upsertPlanFeature(starterPlan.id, 'max_expenses_monthly', true, 80);

  const growthPlan = await prisma.subscriptionPlan.upsert({
    where: { code: 'growth' },
    update: {
      name: 'Growth',
      currency: 'USD',
      interval: 'MONTHLY',
      amountMinor: 14900,
      isActive: true,
      isDefault: false,
    },
    create: {
      code: 'growth',
      name: 'Growth',
      description: 'For growing churches with multiple teams and workflows.',
      currency: 'USD',
      interval: 'MONTHLY',
      amountMinor: 14900,
      isActive: true,
      isDefault: false,
      metadata: {
        target: 'growing churches',
        trialDays: 14,
      },
    },
  });

  await prisma.subscriptionPlan.update({
    where: { id: growthPlan.id },
    data: {
      metadata: mergeMetadata(growthPlan.metadata, {
        target: 'growing churches',
        trialDays: 14,
      }),
    },
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

  const enterprisePlan = await prisma.subscriptionPlan.upsert({
    where: { code: 'enterprise' },
    update: {
      name: 'Enterprise',
      currency: 'USD',
      interval: 'MONTHLY',
      amountMinor: 0,
      isActive: true,
      isDefault: false,
    },
    create: {
      code: 'enterprise',
      name: 'Enterprise',
      description: 'For multi-campus and diaspora networks with advanced controls.',
      currency: 'USD',
      interval: 'MONTHLY',
      amountMinor: 0,
      isActive: true,
      isDefault: false,
      metadata: {
        target: 'multi-campus and diaspora networks',
        trialDays: 0,
      },
    },
  });

  await prisma.subscriptionPlan.update({
    where: { id: enterprisePlan.id },
    data: {
      metadata: mergeMetadata(enterprisePlan.metadata, {
        target: 'multi-campus and diaspora networks',
        trialDays: 0,
      }),
    },
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

  const existingActiveSubscription = await prisma.tenantSubscription.findFirst({
    where: {
      tenantId: tenant.id,
      status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED'] },
    },
  });

  if (!existingActiveSubscription) {
    await prisma.tenantSubscription.create({
      data: {
        tenantId: tenant.id,
        planId: starterPlan.id,
        status: 'ACTIVE',
        provider: 'MANUAL',
        startsAt: new Date(),
      },
    });
  }

  let organization = await prisma.organization.findFirst({
    where: { tenantId: tenant.id },
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        tenantId: tenant.id,
        name: 'Demo Organization',
      },
    });
  }

  let church = await prisma.church.findFirst({
    where: { organizationId: organization.id },
  });

  if (!church) {
    church = await prisma.church.create({
      data: {
        organizationId: organization.id,
        name: 'Demo Church',
        slug: 'demo-church',
        countryCode: 'US',
        timezone: 'UTC',
      },
    });
  }

  let campus = await prisma.campus.findFirst({
    where: { churchId: church.id },
  });

  if (!campus) {
    campus = await prisma.campus.create({
      data: {
        churchId: church.id,
        name: 'Main Campus',
        timezone: 'UTC',
      },
    });
  }

  await prisma.tenantSecurityPolicy.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      requireMfaForStaff: true,
      enforceSso: false,
      sessionTimeoutMinutes: 480,
      dataRetentionDays: 3650,
      breachContactEmail: 'security@demochurch.org',
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

  let fund = await prisma.fund.findFirst({
    where: { churchId: church.id },
  });

  if (!fund) {
    fund = await prisma.fund.create({
      data: {
        churchId: church.id,
        name: 'General Fund',
        description: 'Primary giving fund',
        isDefault: true,
      },
    });
  }

  let campaign = await prisma.campaign.findFirst({
    where: { churchId: church.id },
  });

  if (!campaign) {
    campaign = await prisma.campaign.create({
      data: {
        churchId: church.id,
        name: 'Community Outreach',
        description: 'Support local outreach initiatives',
        targetAmount: new Prisma.Decimal(5000),
        currency: 'USD',
      },
    });
  }

  const existingFundraiser = await prisma.fundraiserPage.findFirst({
    where: { churchId: church.id },
  });

  if (!existingFundraiser) {
    await prisma.fundraiserPage.create({
      data: {
        churchId: church.id,
        campaignId: campaign.id,
        name: 'Youth Missions Trip',
        slug: 'youth-missions',
        goalAmount: new Prisma.Decimal(2000),
        currency: 'USD',
        message: 'Help our youth travel for the mission trip this summer.',
      },
    });
  }

  let expenseCategory = await prisma.expenseCategory.findFirst({
    where: { churchId: church.id },
  });

  if (!expenseCategory) {
    expenseCategory = await prisma.expenseCategory.create({
      data: {
        churchId: church.id,
        name: 'Operations',
        description: 'General operating expenses',
      },
    });
  }

  const existingBudget = await prisma.budget.findFirst({
    where: { churchId: church.id },
  });

  if (!existingBudget) {
    const budget = await prisma.budget.create({
      data: {
        churchId: church.id,
        name: '2026 Operating Budget',
        startAt: new Date(new Date().getFullYear(), 0, 1),
        endAt: new Date(new Date().getFullYear(), 11, 31),
      },
    });

    await prisma.budgetItem.create({
      data: {
        budgetId: budget.id,
        categoryId: expenseCategory.id,
        name: 'Facility & Utilities',
        allocatedAmount: new Prisma.Decimal(2500),
      },
    });
  }

  const members = await prisma.member.findMany({ where: { churchId: church.id } });

  if (members.length === 0) {
    await prisma.member.createMany({
      data: [
        {
          churchId: church.id,
          firstName: 'Ava',
          lastName: 'Johnson',
          email: 'ava@demo.church',
          phone: '+15555550101',
        },
        {
          churchId: church.id,
          firstName: 'Noah',
          lastName: 'Kim',
          email: 'noah@demo.church',
          phone: '+15555550102',
        },
        {
          churchId: church.id,
          firstName: 'Mia',
          lastName: 'Santos',
          email: 'mia@demo.church',
          phone: '+15555550103',
        },
      ],
    });
  }

  const seededMembers = await prisma.member.findMany({ where: { churchId: church.id } });
  const member = seededMembers[0];

  const event = await prisma.event.create({
    data: {
      churchId: church.id,
      campusId: campus.id,
      title: 'Sunday Service',
      startAt: new Date(Date.now() + 86400000),
      endAt: new Date(Date.now() + 90000000),
      location: 'Main Auditorium',
      capacity: 250,
    },
  });

  const liveChannel = await prisma.liveStreamChannel.upsert({
    where: { churchId_name: { churchId: church.id, name: 'Main Broadcast' } },
    update: {},
    create: {
      churchId: church.id,
      campusId: campus.id,
      name: 'Main Broadcast',
      provider: 'YOUTUBE',
      playbackUrl: 'https://example.com/live/demo',
      ingestUrl: 'rtmp://example.com/live',
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
      eventId: event.id,
      title: 'Sunday Service Live Stream',
      status: 'SCHEDULED',
      moderationLevel: 'FILTERED',
      scheduledStartAt: event.startAt,
      isRecording: true,
    },
  });

  await prisma.attendance.upsert({
    where: { eventId_memberId: { eventId: event.id, memberId: member.id } },
    update: { status: 'CHECKED_IN', checkInAt: new Date() },
    create: {
      eventId: event.id,
      memberId: member.id,
      status: 'CHECKED_IN',
      checkInAt: new Date(),
    },
  });

  await prisma.donation.create({
    data: {
      churchId: church.id,
      memberId: member.id,
      fundId: fund.id,
      campaignId: campaign.id,
      amount: new Prisma.Decimal(50),
      currency: 'USD',
      status: 'COMPLETED',
      provider: 'MANUAL',
      providerRef: `seed-${Date.now()}`,
      donorName: `${member.firstName} ${member.lastName}`,
      donorEmail: member.email ?? undefined,
    },
  });

  const existingPledge = await prisma.pledge.findFirst({ where: { churchId: church.id } });
  if (!existingPledge) {
    await prisma.pledge.create({
      data: {
        churchId: church.id,
        memberId: member.id,
        amount: new Prisma.Decimal(300),
        currency: 'USD',
        notes: 'Annual pledge',
      },
    });
  }

  const existingRecurring = await prisma.recurringDonation.findFirst({ where: { churchId: church.id } });
  if (!existingRecurring) {
    await prisma.recurringDonation.create({
      data: {
        churchId: church.id,
        memberId: member.id,
        amount: new Prisma.Decimal(25),
        currency: 'USD',
        interval: 'MONTHLY',
        provider: 'STRIPE',
        startAt: new Date(),
      },
    });
  }

  const existingExpense = await prisma.expense.findFirst({ where: { churchId: church.id } });
  if (!existingExpense) {
    await prisma.expense.create({
      data: {
        churchId: church.id,
        categoryId: expenseCategory.id,
        amount: new Prisma.Decimal(120),
        currency: 'USD',
        description: 'Utility bill',
        vendor: 'City Utilities',
        occurredAt: new Date(),
      },
    });
  }

  const existingTextToGive = await prisma.textToGiveNumber.findFirst({
    where: { churchId: church.id },
  });

  if (!existingTextToGive) {
    await prisma.textToGiveNumber.create({
      data: {
        churchId: church.id,
        phoneNumber: '+15555550199',
        provider: 'STRIPE',
        defaultCurrency: 'USD',
        fundId: fund.id,
      },
    });
  }

  const user = await prisma.user.upsert({
    where: { clerkUserId: 'user_demo' },
    update: {},
    create: {
      clerkUserId: 'user_demo',
      email: 'admin@demo.church',
      name: 'Demo Admin',
      role: 'ADMIN',
    },
  });

  await prisma.staffMembership.upsert({
    where: { userId_churchId: { userId: user.id, churchId: church.id } },
    update: { role: 'ADMIN' },
    create: {
      userId: user.id,
      churchId: church.id,
      role: 'ADMIN',
    },
  });

  const existingSupportTicket = await prisma.supportTicket.findFirst({
    where: { tenantId: tenant.id, subject: 'Need help configuring recurring giving' },
  });
  if (!existingSupportTicket) {
    const supportTicket = await prisma.supportTicket.create({
      data: {
        tenantId: tenant.id,
        churchId: church.id,
        requesterEmail: member.email ?? 'member@demo.church',
        requesterName: `${member.firstName} ${member.lastName}`,
        subject: 'Need help configuring recurring giving',
        description: 'Please help us configure recurring giving for monthly pledges.',
        priority: 'NORMAL',
        source: 'IN_APP',
        firstResponseDueAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        resolutionDueAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      },
    });

    await prisma.supportTicketMessage.create({
      data: {
        ticketId: supportTicket.id,
        authorType: 'TENANT_USER',
        authorTenantUserId: 'user_demo',
        body: 'We need setup guidance for recurring giving and reminders.',
        isInternal: false,
      },
    });
  }

  const platformAdminEmail = process.env.PLATFORM_ADMIN_EMAIL;
  if (platformAdminEmail) {
    const platformUser = await prisma.platformUser.upsert({
      where: { email: platformAdminEmail.toLowerCase() },
      update: {},
      create: {
        email: platformAdminEmail.toLowerCase(),
        name: 'Platform Admin',
        status: 'ACTIVE',
      },
    });

    await prisma.platformUserRole.upsert({
      where: { platformUserId_role: { platformUserId: platformUser.id, role: 'SUPER_ADMIN' } },
      update: {},
      create: {
        platformUserId: platformUser.id,
        role: 'SUPER_ADMIN',
      },
    });
  }

  console.log(
    'Seeded demo tenant, organization, church, campus, fund, campaign, budget, pledges, recurring donations, expenses, members, event, attendance, donation, and admin user.'
  );
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
