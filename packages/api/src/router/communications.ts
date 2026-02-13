import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import {
  AuditActorType,
  CommunicationChannel,
  CommunicationProvider,
  CommunicationScheduleStatus,
  CommunicationSuppressionReason,
  CommunicationStatus,
  DripCampaignStatus,
  DripEnrollmentStatus,
  Prisma,
  prisma,
} from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { recordAuditLog } from '../audit';
import { channelToPreference, dispatchScheduledCommunications, normalizeRecipientAddress, sendCommunication } from '../communications';
import { buildUnsubscribeUrl, createUnsubscribeToken } from '../unsubscribe';

const templateSchema = z.object({
  churchId: z.string(),
  name: z.string().min(2),
  channel: z.nativeEnum(CommunicationChannel),
  subject: z.string().optional(),
  body: z.string().min(1),
});

const audienceSchema = z.enum(['ALL_MEMBERS', 'ACTIVE_MEMBERS', 'DONORS_90_DAYS']);

const sendSchema = z
  .object({
    churchId: z.string(),
    channel: z.nativeEnum(CommunicationChannel),
    to: z.array(z.string()).optional(),
    audience: audienceSchema.optional(),
    subject: z.string().optional(),
    body: z.string().optional(),
    templateId: z.string().optional(),
  })
  .refine((data) => data.body || data.templateId, {
    message: 'body or templateId is required',
  })
  .refine((data) => (data.to && data.to.length > 0) || data.audience, {
    message: 'Provide recipients or an audience',
  });

const scheduleSchema = sendSchema.extend({
  sendAt: z.coerce.date(),
});

const createDripSchema = z.object({
  churchId: z.string(),
  name: z.string().min(2),
  description: z.string().optional(),
});

const dripStepSchema = z
  .object({
    campaignId: z.string(),
    stepOrder: z.number().min(1),
    delayHours: z.number().min(0),
    channel: z.nativeEnum(CommunicationChannel),
    subject: z.string().optional(),
    body: z.string().optional(),
    templateId: z.string().optional(),
  })
  .refine((data) => data.body || data.templateId, {
    message: 'body or templateId is required',
  })
  .refine((data) => data.channel !== CommunicationChannel.EMAIL || Boolean(data.subject || data.templateId), {
    message: 'Email steps require a subject',
  });

const enrollDripSchema = z.object({
  campaignId: z.string(),
  churchId: z.string(),
  to: z.array(z.string()).optional(),
  audience: audienceSchema.optional(),
});

type RecipientContext = {
  memberId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  donorName?: string;
  churchName?: string;
};

function normalizeSuppressionAddress(channel: CommunicationChannel, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (channel === CommunicationChannel.EMAIL) return trimmed.toLowerCase();
  return trimmed.startsWith('whatsapp:') ? trimmed.slice('whatsapp:'.length) : trimmed;
}

async function requireTenantStaff(tenantId: string, clerkUserId: string) {
  const staff = await prisma.staffMembership.findFirst({
    where: {
      user: { clerkUserId },
      church: { organization: { tenantId } },
    },
  });
  if (!staff) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Staff access required' });
  }
  return staff;
}

function renderTemplate(text: string, context: RecipientContext) {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const value = (context as Record<string, string | undefined>)[key];
    return value ?? '';
  });
}

function appendUnsubscribeFooter(html: string, unsubscribeUrl: string | null) {
  if (!unsubscribeUrl) return html;
  // Avoid double-adding if a template already includes its own footer/link.
  if (html.toLowerCase().includes('unsubscribe')) return html;
  return [
    html,
    '<hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0" />',
    `<p style="margin:0;font-size:12px;line-height:1.5;color:#64748b">`,
    `You are receiving this message from FaithFlow. `,
    `<a href="${unsubscribeUrl}" style="color:#0f172a;text-decoration:underline">Unsubscribe</a>`,
    `</p>`,
  ].join('\n');
}

async function loadSuppressionsAndPrefs(input: {
  tenantId: string;
  channel: CommunicationChannel;
  recipients: Array<{ to: string; memberId?: string | null }>;
}) {
  const suppressionAddresses = Array.from(
    new Set(
      input.recipients
        .map((r) => normalizeRecipientAddress(input.channel, r.to))
        .filter(Boolean)
    )
  );
  const suppressions = suppressionAddresses.length
    ? await prisma.communicationSuppression.findMany({
        where: {
          tenantId: input.tenantId,
          channel: input.channel,
          address: { in: suppressionAddresses },
        },
        select: { address: true, reason: true },
      })
    : [];
  const suppressionMap = new Map(suppressions.map((row) => [row.address, row.reason]));

  const memberIds = Array.from(new Set(input.recipients.map((r) => r.memberId).filter(Boolean))) as string[];
  const prefChannel = channelToPreference(input.channel);
  const prefs = memberIds.length
    ? await prisma.notificationPreference.findMany({
        where: {
          memberId: { in: memberIds },
          channel: prefChannel,
        },
        select: { memberId: true, enabled: true },
      })
    : [];
  const prefMap = new Map(prefs.map((row) => [row.memberId, row.enabled]));

  return { suppressionMap, prefMap };
}

async function resolveAudienceRecipients({
  churchId,
  channel,
  audience,
}: {
  churchId: string;
  channel: CommunicationChannel;
  audience: z.infer<typeof audienceSchema>;
}) {
  const recipients = new Map<string, RecipientContext>();
  const church = await prisma.church.findUnique({ where: { id: churchId } });
  const churchName = church?.name ?? '';

  const addRecipient = (to: string, context: RecipientContext) => {
    if (!to) return;
    if (!recipients.has(to)) {
      recipients.set(to, context);
    }
  };

  if (audience === 'ALL_MEMBERS' || audience === 'ACTIVE_MEMBERS') {
    const members = await prisma.member.findMany({
      where: {
        churchId,
        ...(audience === 'ACTIVE_MEMBERS' ? { status: 'ACTIVE' } : {}),
      },
    });
    for (const member of members) {
      const to =
        channel === CommunicationChannel.EMAIL ? member.email ?? '' : member.phone ?? '';
      addRecipient(to, {
        memberId: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email ?? undefined,
        phone: member.phone ?? undefined,
        churchName,
      });
    }
  }

  if (audience === 'DONORS_90_DAYS') {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const donations = await prisma.donation.findMany({
      where: { churchId, createdAt: { gte: since }, status: 'COMPLETED' },
      select: {
        donorEmail: true,
        donorPhone: true,
        donorName: true,
        member: true,
      },
    });

    for (const donation of donations) {
      const to =
        channel === CommunicationChannel.EMAIL
          ? donation.donorEmail ?? donation.member?.email ?? ''
          : donation.donorPhone ?? donation.member?.phone ?? '';
      addRecipient(to, {
        memberId: donation.member?.id,
        firstName: donation.member?.firstName,
        lastName: donation.member?.lastName,
        email: donation.donorEmail ?? donation.member?.email ?? undefined,
        phone: donation.donorPhone ?? donation.member?.phone ?? undefined,
        donorName: donation.donorName ?? undefined,
        churchName,
      });
    }
  }

  return { recipients, churchName };
}

export const communicationsRouter = router({
  suppressions: protectedProcedure
    .input(
      z
        .object({
          channel: z.nativeEnum(CommunicationChannel).optional(),
          q: z.string().trim().max(120).optional(),
          limit: z.number().min(1).max(200).default(50),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      await requireTenantStaff(ctx.tenantId!, ctx.userId!);
      const q = input?.q?.trim().toLowerCase();
      return prisma.communicationSuppression.findMany({
        where: {
          tenantId: ctx.tenantId!,
          ...(input?.channel ? { channel: input.channel } : {}),
          ...(q ? { address: { contains: q, mode: 'insensitive' } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: input?.limit ?? 50,
      });
    }),

  addSuppression: protectedProcedure
    .input(
      z.object({
        channel: z.nativeEnum(CommunicationChannel),
        address: z.string().min(3).max(200),
        reason: z.nativeEnum(CommunicationSuppressionReason).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireTenantStaff(ctx.tenantId!, ctx.userId!);
      const address = normalizeSuppressionAddress(input.channel, input.address);
      if (!address) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid address' });
      }

      const suppression = await prisma.communicationSuppression.upsert({
        where: {
          tenantId_channel_address: {
            tenantId: ctx.tenantId!,
            channel: input.channel,
            address,
          },
        },
        update: {
          reason: input.reason ?? CommunicationSuppressionReason.ADMIN_SUPPRESS,
          createdByClerkUserId: ctx.userId ?? undefined,
        },
        create: {
          tenantId: ctx.tenantId!,
          channel: input.channel,
          address,
          reason: input.reason ?? CommunicationSuppressionReason.ADMIN_SUPPRESS,
          createdByClerkUserId: ctx.userId ?? undefined,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'communications.suppression_added',
        targetType: 'CommunicationSuppression',
        targetId: suppression.id,
        metadata: { channel: suppression.channel, address: suppression.address, reason: suppression.reason },
      });

      return suppression;
    }),

  removeSuppression: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await requireTenantStaff(ctx.tenantId!, ctx.userId!);
      const suppression = await prisma.communicationSuppression.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId! },
      });
      if (!suppression) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Suppression not found' });
      }

      await prisma.communicationSuppression.delete({ where: { id: input.id } });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'communications.suppression_removed',
        targetType: 'CommunicationSuppression',
        targetId: input.id,
        metadata: { channel: suppression.channel, address: suppression.address, reason: suppression.reason },
      });

      return { ok: true };
    }),

  templates: protectedProcedure
    .input(z.object({ churchId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      return prisma.communicationTemplate.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  createTemplate: protectedProcedure
    .input(templateSchema)
    .mutation(async ({ input, ctx }) => {
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      if (input.channel === CommunicationChannel.EMAIL && !input.subject) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Email templates require a subject' });
      }

      const template = await prisma.communicationTemplate.create({
        data: {
          churchId: input.churchId,
          name: input.name,
          channel: input.channel,
          subject: input.subject,
          body: input.body,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: input.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'communications.template_created',
        targetType: 'CommunicationTemplate',
        targetId: template.id,
        metadata: { channel: template.channel, name: template.name },
      });

      return template;
    }),

  messages: protectedProcedure
    .input(z.object({ churchId: z.string().optional(), limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ input, ctx }) => {
      return prisma.communicationMessage.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });
    }),

  summary: protectedProcedure
    .input(z.object({ churchId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      return prisma.communicationMessage.groupBy({
        by: ['status', 'channel'],
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        _count: true,
      });
    }),

  schedules: protectedProcedure
    .input(z.object({ churchId: z.string().optional(), limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ input, ctx }) => {
      return prisma.communicationSchedule.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { sendAt: 'asc' },
        take: input.limit,
      });
    }),

  schedule: protectedProcedure.input(scheduleSchema).mutation(async ({ input, ctx }) => {
    const church = await prisma.church.findFirst({
      where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
    });
    if (!church) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
    }

    const template = input.templateId
      ? await prisma.communicationTemplate.findFirst({
          where: { id: input.templateId, churchId: input.churchId },
        })
      : null;

    const subject = template?.subject ?? input.subject;
    const body = template?.body ?? input.body ?? '';

    if (input.channel === CommunicationChannel.EMAIL && !subject) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Email requires a subject' });
    }
    if (!body) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Message body is required' });
    }
    if (template && template.channel !== input.channel) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Template channel mismatch' });
    }

    const recipients = new Map<string, RecipientContext>();
    if (input.audience) {
      const resolved = await resolveAudienceRecipients({
        churchId: input.churchId,
        channel: input.channel,
        audience: input.audience,
      });
      for (const [to, context] of resolved.recipients.entries()) {
        recipients.set(to, context);
      }
    }

    for (const recipient of input.to ?? []) {
      const trimmed = recipient.trim();
      if (!trimmed) continue;
      if (!recipients.has(trimmed)) {
        recipients.set(trimmed, {
          email: input.channel === CommunicationChannel.EMAIL ? trimmed : undefined,
          phone: input.channel !== CommunicationChannel.EMAIL ? trimmed : undefined,
          churchName: church.name,
        });
      }
    }

    if (recipients.size === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No valid recipients found' });
    }

    const recipientList = Array.from(recipients.entries()).map(([to, context]) => ({
      to,
      memberId: context.memberId ?? null,
    }));
    const { suppressionMap, prefMap } = await loadSuppressionsAndPrefs({
      tenantId: ctx.tenantId!,
      channel: input.channel,
      recipients: recipientList,
    });

    const scheduleRecords: Prisma.CommunicationScheduleCreateManyInput[] = [];
    for (const [recipient, context] of recipients.entries()) {
      const resolvedSubject = subject ? renderTemplate(subject, context) : undefined;
      const resolvedBodyRaw = renderTemplate(body, context);

      const normalizedAddress = normalizeRecipientAddress(input.channel, recipient);
      const suppressionReason = normalizedAddress ? suppressionMap.get(normalizedAddress) : undefined;
      const memberPref = context.memberId ? prefMap.get(context.memberId) : undefined;
      const optedOut = memberPref === false;

      const unsubscribeToken =
        input.channel === CommunicationChannel.EMAIL && normalizedAddress
          ? createUnsubscribeToken({
              tenantId: ctx.tenantId!,
              channel: input.channel,
              address: normalizedAddress,
              memberId: context.memberId ?? null,
            })
          : null;
      const unsubscribeUrl = unsubscribeToken ? buildUnsubscribeUrl(unsubscribeToken) : null;
      const resolvedBody =
        input.channel === CommunicationChannel.EMAIL
          ? appendUnsubscribeFooter(resolvedBodyRaw, unsubscribeUrl)
          : resolvedBodyRaw;
      scheduleRecords.push({
        churchId: input.churchId,
        templateId: template?.id ?? null,
        channel: input.channel,
        provider:
          input.channel === CommunicationChannel.EMAIL ? CommunicationProvider.RESEND : CommunicationProvider.TWILIO,
        to: recipient,
        subject: resolvedSubject,
        body: resolvedBody,
        sendAt: input.sendAt,
        status: suppressionReason || optedOut ? CommunicationScheduleStatus.CANCELED : CommunicationScheduleStatus.QUEUED,
        error: suppressionReason
          ? `Suppressed recipient (${suppressionReason})`
          : optedOut
            ? 'Recipient opted out for this channel'
            : undefined,
        metadata: { audience: input.audience ?? null, memberId: context.memberId ?? null },
      });
    }

    await prisma.communicationSchedule.createMany({ data: scheduleRecords });

    await recordAuditLog({
      tenantId: ctx.tenantId,
      churchId: input.churchId,
      actorType: AuditActorType.USER,
      actorId: ctx.userId,
      action: 'communications.scheduled',
      targetType: 'CommunicationSchedule',
      metadata: { channel: input.channel, count: scheduleRecords.length, sendAt: input.sendAt.toISOString() },
    });

    const queued = scheduleRecords.filter((row) => row.status === CommunicationScheduleStatus.QUEUED).length;
    const canceled = scheduleRecords.filter((row) => row.status === CommunicationScheduleStatus.CANCELED).length;
    return { count: scheduleRecords.length, queued, canceled };
  }),

  dispatchDue: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
    .mutation(async ({ input, ctx }) => {
      const result = await dispatchScheduledCommunications(input.limit);
      await recordAuditLog({
        tenantId: ctx.tenantId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'communications.dispatch_due',
        targetType: 'CommunicationSchedule',
        metadata: result,
      });
      return result;
    }),

  drips: protectedProcedure
    .input(z.object({ churchId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      return prisma.communicationDripCampaign.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  createDrip: protectedProcedure.input(createDripSchema).mutation(async ({ input, ctx }) => {
    const church = await prisma.church.findFirst({
      where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
    });
    if (!church) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
    }

    const campaign = await prisma.communicationDripCampaign.create({
      data: {
        churchId: input.churchId,
        name: input.name,
        description: input.description,
        status: DripCampaignStatus.ACTIVE,
      },
    });

    await recordAuditLog({
      tenantId: ctx.tenantId,
      churchId: input.churchId,
      actorType: AuditActorType.USER,
      actorId: ctx.userId,
      action: 'communications.drip_created',
      targetType: 'CommunicationDripCampaign',
      targetId: campaign.id,
      metadata: { name: campaign.name },
    });

    return campaign;
  }),

  dripSteps: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ input, ctx }) => {
      const campaign = await prisma.communicationDripCampaign.findFirst({
        where: { id: input.campaignId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Drip campaign not found' });
      }

      return prisma.communicationDripStep.findMany({
        where: { campaignId: input.campaignId },
        orderBy: { stepOrder: 'asc' },
      });
    }),

  addDripStep: protectedProcedure.input(dripStepSchema).mutation(async ({ input, ctx }) => {
    const campaign = await prisma.communicationDripCampaign.findFirst({
      where: { id: input.campaignId, church: { organization: { tenantId: ctx.tenantId! } } },
    });
    if (!campaign) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Drip campaign not found' });
    }

    const existingStep = await prisma.communicationDripStep.findFirst({
      where: { campaignId: input.campaignId },
      orderBy: { stepOrder: 'asc' },
    });
    if (existingStep && existingStep.channel !== input.channel) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'All drip steps must use the same channel in this version.',
      });
    }

    const template = input.templateId
      ? await prisma.communicationTemplate.findFirst({
          where: { id: input.templateId, churchId: campaign.churchId },
        })
      : null;

    if (template && template.channel !== input.channel) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Template channel mismatch' });
    }

    const step = await prisma.communicationDripStep.create({
      data: {
        campaignId: input.campaignId,
        stepOrder: input.stepOrder,
        delayHours: input.delayHours,
        channel: input.channel,
        templateId: template?.id ?? null,
        subject: input.subject,
        body: input.body ?? template?.body ?? '',
      },
    });

    await recordAuditLog({
      tenantId: ctx.tenantId,
      churchId: campaign.churchId,
      actorType: AuditActorType.USER,
      actorId: ctx.userId,
      action: 'communications.drip_step_added',
      targetType: 'CommunicationDripStep',
      targetId: step.id,
      metadata: { campaignId: input.campaignId, stepOrder: input.stepOrder },
    });

    return step;
  }),

  enrollDrip: protectedProcedure.input(enrollDripSchema).mutation(async ({ input, ctx }) => {
    const campaign = await prisma.communicationDripCampaign.findFirst({
      where: { id: input.campaignId, church: { organization: { tenantId: ctx.tenantId! } } },
    });
    if (!campaign) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Drip campaign not found' });
    }

    const steps = await prisma.communicationDripStep.findMany({
      where: { campaignId: input.campaignId },
      orderBy: { stepOrder: 'asc' },
    });
    if (steps.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Drip campaign has no steps' });
    }

    const church = await prisma.church.findUnique({ where: { id: campaign.churchId } });

    const recipients = new Map<string, RecipientContext>();
    if (input.audience) {
      const resolved = await resolveAudienceRecipients({
        churchId: input.churchId,
        channel: steps[0].channel,
        audience: input.audience,
      });
      for (const [to, context] of resolved.recipients.entries()) {
        recipients.set(to, context);
      }
    }
    for (const recipient of input.to ?? []) {
      const trimmed = recipient.trim();
      if (!trimmed) continue;
      if (!recipients.has(trimmed)) {
        recipients.set(trimmed, { churchName: church?.name });
      }
    }
    if (recipients.size === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No recipients to enroll' });
    }

    const templates = await prisma.communicationTemplate.findMany({
      where: { churchId: campaign.churchId },
    });
    const templateMap = new Map(templates.map((template) => [template.id, template]));

    const now = Date.now();
    let enrollCount = 0;
    let scheduleCount = 0;

    for (const [recipient, context] of recipients.entries()) {
      const existing = await prisma.communicationDripEnrollment.findFirst({
        where: { campaignId: input.campaignId, recipient },
      });
      if (existing) continue;

      const enrollment = await prisma.communicationDripEnrollment.create({
        data: {
          campaignId: input.campaignId,
          churchId: input.churchId,
          recipient,
          donorEmail: context.email,
          donorPhone: context.phone,
          status: DripEnrollmentStatus.ACTIVE,
        },
      });
      enrollCount += 1;

      for (const step of steps) {
        const template = step.templateId ? templateMap.get(step.templateId) ?? null : null;
        const subjectBase = step.subject ?? template?.subject ?? undefined;
        const bodyBase = step.body || template?.body || '';
        const resolvedSubject = subjectBase ? renderTemplate(subjectBase, context) : undefined;
        const resolvedBodyRaw = renderTemplate(bodyBase, context);
        const normalizedAddress = normalizeRecipientAddress(step.channel, recipient);
        const unsubscribeToken =
          step.channel === CommunicationChannel.EMAIL && normalizedAddress
            ? createUnsubscribeToken({
                tenantId: ctx.tenantId!,
                channel: step.channel,
                address: normalizedAddress,
                memberId: context.memberId ?? null,
              })
            : null;
        const unsubscribeUrl = unsubscribeToken ? buildUnsubscribeUrl(unsubscribeToken) : null;
        const resolvedBody =
          step.channel === CommunicationChannel.EMAIL
            ? appendUnsubscribeFooter(resolvedBodyRaw, unsubscribeUrl)
            : resolvedBodyRaw;

        await prisma.communicationSchedule.create({
          data: {
            churchId: input.churchId,
            templateId: step.templateId,
            dripEnrollmentId: enrollment.id,
            dripStepId: step.id,
            channel: step.channel,
            provider: step.channel === CommunicationChannel.EMAIL ? CommunicationProvider.RESEND : CommunicationProvider.TWILIO,
            to: recipient,
            subject: resolvedSubject,
            body: resolvedBody,
            sendAt: new Date(now + step.delayHours * 60 * 60 * 1000),
            status: CommunicationScheduleStatus.QUEUED,
            metadata: {
              dripCampaignId: input.campaignId,
              stepOrder: step.stepOrder,
              audience: input.audience ?? null,
              memberId: context.memberId ?? null,
            },
          },
        });
        scheduleCount += 1;
      }
    }

    await recordAuditLog({
      tenantId: ctx.tenantId,
      churchId: input.churchId,
      actorType: AuditActorType.USER,
      actorId: ctx.userId,
      action: 'communications.drip_enrolled',
      targetType: 'CommunicationDripCampaign',
      targetId: input.campaignId,
      metadata: { enrolled: enrollCount, schedules: scheduleCount, audience: input.audience ?? null },
    });

    return { enrolled: enrollCount, schedules: scheduleCount };
  }),

  send: protectedProcedure.input(sendSchema).mutation(async ({ input, ctx }) => {
    const church = await prisma.church.findFirst({
      where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
    });
    if (!church) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
    }

    const template = input.templateId
      ? await prisma.communicationTemplate.findFirst({
          where: { id: input.templateId, churchId: input.churchId },
        })
      : null;

    const subject = template?.subject ?? input.subject;
    const body = template?.body ?? input.body ?? '';

    if (input.channel === CommunicationChannel.EMAIL && !subject) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Email requires a subject' });
    }
    if (!body) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Message body is required' });
    }
    if (template && template.channel !== input.channel) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Template channel mismatch' });
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    const recipients = new Map<string, RecipientContext>();
    let churchName = church.name;

    if (input.audience) {
      const resolved = await resolveAudienceRecipients({
        churchId: input.churchId,
        channel: input.channel,
        audience: input.audience,
      });
      churchName = resolved.churchName || churchName;
      for (const [to, context] of resolved.recipients.entries()) {
        recipients.set(to, context);
      }
    }

    for (const recipient of input.to ?? []) {
      const trimmed = recipient.trim();
      if (!trimmed) continue;
      if (!recipients.has(trimmed)) {
        recipients.set(trimmed, {
          email: input.channel === CommunicationChannel.EMAIL ? trimmed : undefined,
          phone: input.channel !== CommunicationChannel.EMAIL ? trimmed : undefined,
          churchName,
        });
      }
    }

    if (recipients.size === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No valid recipients found' });
    }

    const recipientList = Array.from(recipients.entries()).map(([to, context]) => ({
      to,
      memberId: context.memberId ?? null,
    }));
    const { suppressionMap, prefMap } = await loadSuppressionsAndPrefs({
      tenantId: ctx.tenantId!,
      channel: input.channel,
      recipients: recipientList,
    });

    for (const [recipient, context] of recipients.entries()) {
      const resolvedSubject = subject ? renderTemplate(subject, context) : undefined;
      const resolvedBodyRaw = renderTemplate(body, context);

      const normalizedAddress = normalizeRecipientAddress(input.channel, recipient);
      const suppressionReason = normalizedAddress ? suppressionMap.get(normalizedAddress) : undefined;
      const memberPref = context.memberId ? prefMap.get(context.memberId) : undefined;
      const optedOut = memberPref === false;

      if (suppressionReason || optedOut) {
        skipped += 1;
        continue;
      }

      const unsubscribeToken =
        input.channel === CommunicationChannel.EMAIL && normalizedAddress
          ? createUnsubscribeToken({
              tenantId: ctx.tenantId!,
              channel: input.channel,
              address: normalizedAddress,
              memberId: context.memberId ?? null,
            })
          : null;
      const unsubscribeUrl = unsubscribeToken ? buildUnsubscribeUrl(unsubscribeToken) : null;
      const resolvedBody =
        input.channel === CommunicationChannel.EMAIL
          ? appendUnsubscribeFooter(resolvedBodyRaw, unsubscribeUrl)
          : resolvedBodyRaw;

      const message = await prisma.communicationMessage.create({
        data: {
          churchId: input.churchId,
          templateId: template?.id ?? null,
          channel: input.channel,
          provider: input.channel === CommunicationChannel.EMAIL ? CommunicationProvider.RESEND : CommunicationProvider.TWILIO,
          to: recipient,
          subject: resolvedSubject,
          body: resolvedBody,
          status: CommunicationStatus.QUEUED,
        },
      });

      try {
        const result = await sendCommunication({
          channel: input.channel,
          to: recipient,
          subject: resolvedSubject,
          body: resolvedBody,
        });

        await prisma.communicationMessage.update({
          where: { id: message.id },
          data: {
            status: CommunicationStatus.SENT,
            sentAt: new Date(),
            provider: result.provider,
            metadata: result.providerRef ? { providerRef: result.providerRef } : undefined,
          },
        });

        sent += 1;
      } catch (error) {
        await prisma.communicationMessage.update({
          where: { id: message.id },
          data: {
            status: CommunicationStatus.FAILED,
            error: error instanceof Error ? error.message : 'Send failed',
          },
        });
        failed += 1;
      }
    }

    await recordAuditLog({
      tenantId: ctx.tenantId,
      churchId: input.churchId,
      actorType: AuditActorType.USER,
      actorId: ctx.userId,
      action: 'communications.sent',
      targetType: 'CommunicationBatch',
      targetId: template?.id ?? null,
      metadata: {
        channel: input.channel,
        sent,
        failed,
        skipped,
        templateId: template?.id ?? null,
        audience: input.audience ?? null,
      },
    });

    return { sent, failed, skipped };
  }),
});
