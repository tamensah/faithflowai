import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import {
  AuditActorType,
  CommunicationChannel,
  CommunicationProvider,
  CommunicationScheduleStatus,
  CommunicationStatus,
  DripCampaignStatus,
  DripEnrollmentStatus,
  Prisma,
  prisma,
} from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { recordAuditLog } from '../audit';
import { dispatchScheduledCommunications, sendCommunication } from '../communications';

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

function renderTemplate(text: string, context: RecipientContext) {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const value = (context as Record<string, string | undefined>)[key];
    return value ?? '';
  });
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

    const scheduleRecords: Prisma.CommunicationScheduleCreateManyInput[] = [];
    for (const [recipient, context] of recipients.entries()) {
      const resolvedSubject = subject ? renderTemplate(subject, context) : undefined;
      const resolvedBody = renderTemplate(body, context);
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
        status: CommunicationScheduleStatus.QUEUED,
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

    return { count: scheduleRecords.length };
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
        const resolvedBody = renderTemplate(bodyBase, context);

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

    for (const [recipient, context] of recipients.entries()) {
      const resolvedSubject = subject ? renderTemplate(subject, context) : undefined;
      const resolvedBody = renderTemplate(body, context);
      const message = await prisma.communicationMessage.create({
        data: {
          churchId: input.churchId,
          templateId: template?.id ?? null,
          channel: input.channel,
          provider:
            input.channel === CommunicationChannel.EMAIL ? CommunicationProvider.RESEND : CommunicationProvider.TWILIO,
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
        templateId: template?.id ?? null,
        audience: input.audience ?? null,
      },
    });

    return { sent, failed };
  }),
});
