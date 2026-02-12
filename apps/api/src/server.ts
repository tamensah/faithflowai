import Fastify from 'fastify';
import cors from '@fastify/cors';
import rawBody from 'fastify-raw-body';
import formbody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { Webhook } from 'svix';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import {
  appRouter,
  checkoutInputSchema,
  createDonationCheckout,
  ensureDonationReceipt,
  emitRealtimeEvent,
  getReceiptByNumber,
  handlePaystackWebhook,
  handleStripeWebhook,
  createDisputeEvidenceRecord,
  markEvidenceFailed,
  submitDisputeEvidence,
  dispatchScheduledCommunications,
  monitorDisputes,
  scheduleVolunteerShiftReminders,
  scheduleVolunteerGapAlerts,
  handlePlatformStripeWebhook,
  handlePlatformPaystackWebhook,
  runSubscriptionAutomation,
  runSubscriptionDunning,
  runSubscriptionMetadataBackfill,
  runTenantDomainAutomation,
  runSupportSlaAutomation,
  renderReceiptHtml,
  subscribeRealtime,
  recordAuditLog,
} from '@faithflow-ai/api';
import { createContext } from './context';
import { env } from './env';
import { openApiSpec } from './openapi';
import { extractBearerToken, verifyClerkToken } from './auth';
import { provisionTenant } from './context';
import { AuditActorType, DisputeEvidenceType, EventVisibility, PaymentProvider, prisma } from '@faithflow-ai/database';
import { buildTwimlMessage, normalizePhoneNumber, parseTextToGiveBody, verifyTwilioSignature } from './twilio';
import { startInternalSchedulers } from './scheduler';

const server = Fastify({ logger: true });

function extractIntegrationKey(request: { headers: Record<string, string | string[] | undefined> }) {
  const headerKey = request.headers['x-api-key'];
  if (Array.isArray(headerKey)) return headerKey[0];
  if (typeof headerKey === 'string') return headerKey;

  const authorization = request.headers['authorization'];
  const authValue = Array.isArray(authorization) ? authorization[0] : authorization;
  if (authValue?.startsWith('Bearer ')) {
    return authValue.replace('Bearer ', '').trim();
  }
  return null;
}

async function resolveIntegrationTenant(request: { headers: Record<string, string | string[] | undefined> }) {
  const apiKey = extractIntegrationKey(request);
  if (!env.INTEGRATION_API_KEY || apiKey !== env.INTEGRATION_API_KEY) {
    throw new Error('Unauthorized');
  }

  const clerkOrgIdHeader = request.headers['x-clerk-org-id'];
  const tenantHeader = request.headers['x-tenant-id'];
  const clerkOrgId = Array.isArray(clerkOrgIdHeader) ? clerkOrgIdHeader[0] : clerkOrgIdHeader;
  const tenantId = Array.isArray(tenantHeader) ? tenantHeader[0] : tenantHeader;

  if (clerkOrgId) {
    const tenant = await prisma.tenant.findFirst({ where: { clerkOrgId } });
    if (!tenant) {
      throw new Error('Tenant not found');
    }
    return tenant.id;
  }

  if (tenantId) {
    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId } });
    if (!tenant) {
      throw new Error('Tenant not found');
    }
    return tenant.id;
  }

  throw new Error('Missing tenant header');
}

function toIcsDate(value: Date) {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcs(value?: string | null) {
  if (!value) return '';
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function buildEventIcs(
  event: { id: string; title: string; description?: string | null; location?: string | null; startAt: Date; endAt: Date },
  churchSlug: string,
  baseUrl: string
) {
  const eventUrl = `${baseUrl}/events/${encodeURIComponent(churchSlug)}/${event.id}`;
  return [
    'BEGIN:VEVENT',
    `UID:${event.id}@faithflow`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(event.startAt)}`,
    `DTEND:${toIcsDate(event.endAt)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(event.description || '')}`,
    `LOCATION:${escapeIcs(event.location || '')}`,
    `URL:${eventUrl}`,
    'END:VEVENT',
  ].join('\r\n');
}

function buildCalendarIcs(
  events: Array<{ id: string; title: string; description?: string | null; location?: string | null; startAt: Date; endAt: Date }>,
  churchName: string,
  churchSlug: string,
  baseUrl: string
) {
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FaithFlow AI//EN',
    `X-WR-CALNAME:${escapeIcs(churchName)} Events`,
    'CALSCALE:GREGORIAN',
  ].join('\r\n');

  const body = events.map((event) => buildEventIcs(event, churchSlug, baseUrl)).join('\r\n');
  return `${header}\r\n${body}\r\nEND:VCALENDAR`;
}

async function start() {
  await server.register(cors, {
    origin: env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()),
    credentials: true,
  });

  await server.register(rawBody, {
    field: 'rawBody',
    global: false,
    encoding: 'utf8',
    runFirst: true,
  });

  await server.register(formbody);
  await server.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
    },
  });

  await server.register(swagger, {
    mode: 'static',
    specification: { document: openApiSpec },
  });

  await server.register(swaggerUI, {
    routePrefix: '/docs',
  });

  await server.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: { router: appRouter, createContext },
  });

  server.get('/public/churches/:slug', async (request, reply) => {
    const slug = (request.params as { slug?: string })?.slug;
    if (!slug) {
      reply.code(400).send({ error: 'Missing slug' });
      return;
    }

    try {
      const result = await appRouter
        .createCaller({ userId: null, clerkOrgId: null, tenantId: null, tenantStatus: null })
        .giving.churchBySlug({ slug });
      reply.send(result);
    } catch (error) {
      reply.code(404).send({ error: 'Church not found' });
    }
  });

  server.get('/public/events/:churchSlug', async (request, reply) => {
    const churchSlug = (request.params as { churchSlug?: string })?.churchSlug;
    if (!churchSlug) {
      reply.code(400).send({ error: 'Missing church slug' });
      return;
    }

    const church = await prisma.church.findFirst({
      where: { slug: churchSlug },
      select: { id: true, name: true, slug: true, timezone: true },
    });
    if (!church) {
      reply.code(404).send({ error: 'Church not found' });
      return;
    }

    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const events = await prisma.event.findMany({
      where: { churchId: church.id, visibility: EventVisibility.PUBLIC, endAt: { gte: from } },
      orderBy: { startAt: 'asc' },
    });

    reply.send({ church, events });
  });

  server.get('/public/events/:churchSlug/calendar.ics', async (request, reply) => {
    const churchSlug = (request.params as { churchSlug?: string })?.churchSlug;
    if (!churchSlug) {
      reply.code(400).send('Missing church slug');
      return;
    }

    const church = await prisma.church.findFirst({
      where: { slug: churchSlug },
      select: { id: true, name: true, slug: true },
    });
    if (!church) {
      reply.code(404).send('Church not found');
      return;
    }

    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const events = await prisma.event.findMany({
      where: {
        churchId: church.id,
        visibility: EventVisibility.PUBLIC,
        startAt: { lte: to },
        endAt: { gte: from },
      },
      orderBy: { startAt: 'asc' },
    });

    const baseUrl = env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
    const calendar = buildCalendarIcs(events, church.name, church.slug, baseUrl);
    reply.header('Content-Type', 'text/calendar; charset=utf-8').send(calendar);
  });

  server.get('/public/events/:churchSlug/:eventId.ics', async (request, reply) => {
    const params = request.params as { churchSlug?: string; eventId?: string };
    if (!params?.churchSlug || !params?.eventId) {
      reply.code(400).send('Missing event params');
      return;
    }

    const church = await prisma.church.findFirst({
      where: { slug: params.churchSlug },
      select: { id: true, name: true, slug: true },
    });
    if (!church) {
      reply.code(404).send('Church not found');
      return;
    }

    const event = await prisma.event.findFirst({
      where: { id: params.eventId, churchId: church.id, visibility: EventVisibility.PUBLIC },
    });
    if (!event) {
      reply.code(404).send('Event not found');
      return;
    }

    const baseUrl = env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
    const calendar = buildCalendarIcs([event], church.name, church.slug, baseUrl);
    reply.header('Content-Type', 'text/calendar; charset=utf-8').send(calendar);
  });

  server.get('/public/fundraisers/:churchSlug/:slug', async (request, reply) => {
    const params = request.params as { churchSlug?: string; slug?: string };
    if (!params?.churchSlug || !params?.slug) {
      reply.code(400).send({ error: 'Missing fundraiser params' });
      return;
    }

    try {
      const fundraiser = await appRouter
        .createCaller({ userId: null, clerkOrgId: null, tenantId: null, tenantStatus: null })
        .fundraiser.getBySlug({ churchSlug: params.churchSlug, slug: params.slug });
      reply.send(fundraiser);
    } catch (error) {
      reply.code(404).send({ error: 'Fundraiser not found' });
    }
  });

  server.get('/public/receipts/:receiptNumber', async (request, reply) => {
    const receiptNumber = (request.params as { receiptNumber?: string })?.receiptNumber;
    if (!receiptNumber) {
      reply.code(400).send({ error: 'Missing receipt number' });
      return;
    }

    const receipt = await getReceiptByNumber(receiptNumber);
    if (!receipt) {
      reply.code(404).send({ error: 'Receipt not found' });
      return;
    }

    const html = renderReceiptHtml(receipt);
    reply.header('Content-Type', 'text/html; charset=utf-8').send(html);
  });

  const manualDonationSchema = z.object({
    churchId: z.string(),
    memberId: z.string().optional(),
    fundId: z.string().optional(),
    campaignId: z.string().optional(),
    amount: z.number().positive(),
    currency: z.string().default('USD'),
    donorName: z.string().optional(),
    donorEmail: z.string().email().optional(),
    donorPhone: z.string().optional(),
    isAnonymous: z.boolean().optional(),
  });

  server.get('/api/v1/churches', async (request, reply) => {
    try {
      const tenantId = await resolveIntegrationTenant(request);
      const churches = await prisma.church.findMany({
        where: { organization: { tenantId } },
        orderBy: { createdAt: 'asc' },
      });
      reply.send({ data: churches });
    } catch (error) {
      reply.code(401).send({ error: error instanceof Error ? error.message : 'Unauthorized' });
    }
  });

  server.get('/api/v1/funds', async (request, reply) => {
    try {
      const tenantId = await resolveIntegrationTenant(request);
      const churchId = (request.query as { churchId?: string })?.churchId;
      const funds = await prisma.fund.findMany({
        where: {
          church: { organization: { tenantId } },
          ...(churchId ? { churchId } : {}),
        },
        orderBy: { createdAt: 'asc' },
      });
      reply.send({ data: funds });
    } catch (error) {
      reply.code(401).send({ error: error instanceof Error ? error.message : 'Unauthorized' });
    }
  });

  server.get('/api/v1/campaigns', async (request, reply) => {
    try {
      const tenantId = await resolveIntegrationTenant(request);
      const churchId = (request.query as { churchId?: string })?.churchId;
      const campaigns = await prisma.campaign.findMany({
        where: {
          church: { organization: { tenantId } },
          ...(churchId ? { churchId } : {}),
        },
        orderBy: { createdAt: 'asc' },
      });
      reply.send({ data: campaigns });
    } catch (error) {
      reply.code(401).send({ error: error instanceof Error ? error.message : 'Unauthorized' });
    }
  });

  server.get('/api/v1/donations', async (request, reply) => {
    try {
      const tenantId = await resolveIntegrationTenant(request);
      const query = request.query as { churchId?: string; limit?: string };
      const limit = query?.limit ? Math.min(Number(query.limit), 200) : 50;
      const donations = await prisma.donation.findMany({
        where: {
          church: { organization: { tenantId } },
          ...(query?.churchId ? { churchId: query.churchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: Number.isNaN(limit) ? 50 : limit,
      });
      reply.send({ data: donations });
    } catch (error) {
      reply.code(401).send({ error: error instanceof Error ? error.message : 'Unauthorized' });
    }
  });

  server.post('/api/v1/donations/manual', async (request, reply) => {
    try {
      const tenantId = await resolveIntegrationTenant(request);
      const input = manualDonationSchema.parse(request.body);

      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId } },
      });
      if (!church) {
        reply.code(404).send({ error: 'Church not found' });
        return;
      }

      if (input.memberId) {
        const member = await prisma.member.findFirst({
          where: { id: input.memberId, churchId: input.churchId },
        });
        if (!member) {
          reply.code(404).send({ error: 'Member not found' });
          return;
        }
      }

      if (input.fundId) {
        const fund = await prisma.fund.findFirst({ where: { id: input.fundId, churchId: input.churchId } });
        if (!fund) {
          reply.code(404).send({ error: 'Fund not found' });
          return;
        }
      }

      if (input.campaignId) {
        const campaign = await prisma.campaign.findFirst({
          where: { id: input.campaignId, churchId: input.churchId },
        });
        if (!campaign) {
          reply.code(404).send({ error: 'Campaign not found' });
          return;
        }
      }

      const donation = await prisma.donation.create({
        data: {
          churchId: input.churchId,
          memberId: input.memberId,
          fundId: input.fundId,
          campaignId: input.campaignId,
          amount: input.amount,
          currency: input.currency.toUpperCase(),
          status: 'COMPLETED',
          provider: PaymentProvider.MANUAL,
          providerRef: `manual-${Date.now()}`,
          isAnonymous: input.isAnonymous ?? false,
          donorName: input.donorName,
          donorEmail: input.donorEmail,
          donorPhone: input.donorPhone,
        },
      });

      await ensureDonationReceipt(donation.id);
      emitRealtimeEvent({
        type: 'donation.created',
        data: {
          id: donation.id,
          churchId: donation.churchId,
          tenantId,
          amount: donation.amount.toString(),
          currency: donation.currency,
          status: donation.status,
          provider: donation.provider,
        },
      });

      await recordAuditLog({
        tenantId,
        churchId: donation.churchId,
        actorType: AuditActorType.SYSTEM,
        action: 'donation.imported',
        targetType: 'Donation',
        targetId: donation.id,
        metadata: {
          amount: donation.amount.toString(),
          currency: donation.currency,
          provider: donation.provider,
        },
      });

      reply.send({ data: donation });
    } catch (error) {
      reply.code(400).send({ error: error instanceof Error ? error.message : 'Invalid request' });
    }
  });

  const evidenceTextSchema = z.object({
    type: z.nativeEnum(DisputeEvidenceType),
    description: z.string().optional(),
    text: z.string().optional(),
    submit: z.coerce.boolean().optional(),
  });

  server.post('/api/v1/disputes/:id/evidence', async (request, reply) => {
    try {
      const token = extractBearerToken(request.headers.authorization);
      if (!token) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }
      const claims = await verifyClerkToken(token);
      const clerkOrgId = claims?.org_id ?? claims?.orgId;
      if (!claims?.sub || !clerkOrgId) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }
      const tenant = await provisionTenant(clerkOrgId);
      if (tenant.tenantStatus === 'SUSPENDED') {
        reply.code(403).send({ error: 'Tenant suspended' });
        return;
      }

      const disputeId = (request.params as { id?: string })?.id;
      if (!disputeId) {
        reply.code(400).send({ error: 'Missing dispute id' });
        return;
      }

      const dispute = await prisma.dispute.findFirst({
        where: { id: disputeId, church: { organization: { tenantId: tenant.tenantId } } },
      });
      if (!dispute) {
        reply.code(404).send({ error: 'Dispute not found' });
        return;
      }

      if (request.isMultipart()) {
        const data = await request.file();
        if (!data) {
          reply.code(400).send({ error: 'Missing evidence file' });
          return;
        }
        const fieldValue = (value?: unknown) =>
          typeof value === 'string' ? value : (value as { value?: string } | undefined)?.value ?? '';

        const fields = data.fields ?? {};
        const typeValue = fieldValue(fields.type);
        const description = fieldValue(fields.description);
        const text = fieldValue(fields.text);
        const submitValue = fieldValue(fields.submit);
        const submit = submitValue === 'true' || submitValue === '1';

        if (!Object.values(DisputeEvidenceType).includes(typeValue as DisputeEvidenceType)) {
          reply.code(400).send({ error: 'Invalid evidence type' });
          return;
        }

        const uploadDir = path.join(process.cwd(), 'apps', 'api', 'uploads', 'disputes', disputeId);
        await fs.mkdir(uploadDir, { recursive: true });
        const safeName = `${Date.now()}-${path.basename(data.filename)}`;
        const filePath = path.join(uploadDir, safeName);
        const buffer = await data.toBuffer();
        await fs.writeFile(filePath, buffer);

        const evidence = await createDisputeEvidenceRecord({
          disputeId,
          type: typeValue as DisputeEvidenceType,
          description: description || undefined,
          text: text || undefined,
          filePath,
          fileName: data.filename,
          fileMime: data.mimetype,
          fileSize: buffer.length,
        });

        if (dispute.provider === PaymentProvider.STRIPE) {
          try {
            await submitDisputeEvidence({ disputeId, evidenceId: evidence.id, submit });
          } catch (error) {
            await markEvidenceFailed({
              evidenceId: evidence.id,
              error: error instanceof Error ? error.message : 'Evidence submission failed',
            });
            reply.code(400).send({ error: error instanceof Error ? error.message : 'Evidence submission failed' });
            return;
          }
        }

        reply.send({ data: evidence });
        return;
      }

      const input = evidenceTextSchema.parse(request.body);
      const evidence = await createDisputeEvidenceRecord({
        disputeId,
        type: input.type,
        description: input.description ?? undefined,
        text: input.text ?? undefined,
      });

      if (dispute.provider === PaymentProvider.STRIPE) {
        try {
          await submitDisputeEvidence({ disputeId, evidenceId: evidence.id, submit: input.submit });
        } catch (error) {
          await markEvidenceFailed({
            evidenceId: evidence.id,
            error: error instanceof Error ? error.message : 'Evidence submission failed',
          });
          reply.code(400).send({ error: error instanceof Error ? error.message : 'Evidence submission failed' });
          return;
        }
      }

      reply.send({ data: evidence });
    } catch (error) {
      reply.code(400).send({ error: error instanceof Error ? error.message : 'Invalid request' });
    }
  });

  server.post('/tasks/communications/dispatch', async (request, reply) => {
    try {
      const apiKey = extractIntegrationKey(request);
      if (!env.INTEGRATION_API_KEY || apiKey !== env.INTEGRATION_API_KEY) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }

      const body = (request.body ?? {}) as { limit?: number };
      const limit = typeof body.limit === 'number' ? body.limit : 50;
      const result = await dispatchScheduledCommunications(Math.min(limit, 200));
      reply.send(result);
    } catch (error) {
      reply.code(400).send({ error: error instanceof Error ? error.message : 'Dispatch failed' });
    }
  });

  server.post('/tasks/disputes/monitor', async (request, reply) => {
    try {
      const apiKey = extractIntegrationKey(request);
      if (!env.INTEGRATION_API_KEY || apiKey !== env.INTEGRATION_API_KEY) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }

      const body = (request.body ?? {}) as { limit?: number };
      const limit = typeof body.limit === 'number' ? body.limit : 100;
      const result = await monitorDisputes(Math.min(limit, 200));
      reply.send(result);
    } catch (error) {
      reply.code(400).send({ error: error instanceof Error ? error.message : 'Monitor failed' });
    }
  });

  server.post('/tasks/subscriptions/automate', async (request, reply) => {
    try {
      const apiKey = extractIntegrationKey(request);
      if (!env.INTEGRATION_API_KEY || apiKey !== env.INTEGRATION_API_KEY) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }

      const body = (request.body ?? {}) as { expirePastDueAfterDays?: number; limitTenants?: number };
      const result = await runSubscriptionAutomation({
        expirePastDueAfterDays: body.expirePastDueAfterDays,
        limitTenants: body.limitTenants,
      });
      reply.send(result);
    } catch (error) {
      request.log.error({ error }, 'Subscription automation failed');
      reply.code(500).send({ error: 'Subscription automation failed' });
    }
  });

  server.post('/tasks/subscriptions/dunning', async (request, reply) => {
    try {
      const apiKey = extractIntegrationKey(request);
      if (!env.INTEGRATION_API_KEY || apiKey !== env.INTEGRATION_API_KEY) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }

      const body = (request.body ?? {}) as {
        graceDays?: number;
        limit?: number;
        tenantIds?: string[];
        dryRun?: boolean;
      };
      const result = await runSubscriptionDunning({
        graceDays: body.graceDays,
        limit: body.limit,
        tenantIds: body.tenantIds,
        dryRun: body.dryRun,
      });
      reply.send(result);
    } catch (error) {
      request.log.error({ error }, 'Subscription dunning failed');
      reply.code(500).send({ error: 'Subscription dunning failed' });
    }
  });

  server.post('/tasks/subscriptions/metadata-backfill', async (request, reply) => {
    try {
      const apiKey = extractIntegrationKey(request);
      if (!env.INTEGRATION_API_KEY || apiKey !== env.INTEGRATION_API_KEY) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }

      const body = (request.body ?? {}) as {
        limit?: number;
        tenantIds?: string[];
        subscriptionIds?: string[];
        dryRun?: boolean;
      };

      const result = await runSubscriptionMetadataBackfill({
        limit: typeof body.limit === 'number' ? body.limit : 250,
        tenantIds: body.tenantIds,
        subscriptionIds: body.subscriptionIds,
        dryRun: body.dryRun,
      });
      reply.send(result);
    } catch (error) {
      request.log.error({ error }, 'Subscription metadata backfill failed');
      reply.code(500).send({ error: 'Subscription metadata backfill failed' });
    }
  });

  server.post('/tasks/tenant-ops/automate', async (request, reply) => {
    try {
      const apiKey = extractIntegrationKey(request);
      if (!env.INTEGRATION_API_KEY || apiKey !== env.INTEGRATION_API_KEY) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }

      const body = (request.body ?? {}) as {
        tenantId?: string;
        limit?: number;
        sslExpiryWarningDays?: number;
        dryRun?: boolean;
      };
      const result = await runTenantDomainAutomation({
        tenantId: body.tenantId,
        limit: typeof body.limit === 'number' ? body.limit : 250,
        sslExpiryWarningDays: typeof body.sslExpiryWarningDays === 'number' ? body.sslExpiryWarningDays : 30,
        dryRun: body.dryRun,
      });
      reply.send(result);
    } catch (error) {
      request.log.error({ error }, 'Tenant ops automation failed');
      reply.code(500).send({ error: 'Tenant ops automation failed' });
    }
  });

  server.post('/tasks/support/sla', async (request, reply) => {
    try {
      const apiKey = extractIntegrationKey(request);
      if (!env.INTEGRATION_API_KEY || apiKey !== env.INTEGRATION_API_KEY) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }

      const body = (request.body ?? {}) as {
        tenantId?: string;
        limit?: number;
        dryRun?: boolean;
      };
      const result = await runSupportSlaAutomation({
        tenantId: body.tenantId,
        limit: typeof body.limit === 'number' ? body.limit : 500,
        dryRun: body.dryRun,
      });
      reply.send(result);
    } catch (error) {
      request.log.error({ error }, 'Support SLA automation failed');
      reply.code(500).send({ error: 'Support SLA automation failed' });
    }
  });

  server.post('/tasks/volunteer/reminders', async (request, reply) => {
    try {
      const apiKey = extractIntegrationKey(request);
      if (!env.INTEGRATION_API_KEY || apiKey !== env.INTEGRATION_API_KEY) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }

      const body = (request.body ?? {}) as { hoursAhead?: number; limit?: number };
      const hoursAhead = typeof body.hoursAhead === 'number' ? body.hoursAhead : 24;
      const limit = typeof body.limit === 'number' ? body.limit : 200;
      const result = await scheduleVolunteerShiftReminders(hoursAhead, Math.min(limit, 500));
      reply.send(result);
    } catch (error) {
      reply.code(400).send({ error: error instanceof Error ? error.message : 'Reminder dispatch failed' });
    }
  });

  server.post('/tasks/volunteer/gap-alerts', async (request, reply) => {
    try {
      const apiKey = extractIntegrationKey(request);
      if (!env.INTEGRATION_API_KEY || apiKey !== env.INTEGRATION_API_KEY) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }

      const body = (request.body ?? {}) as { hoursAhead?: number; limit?: number };
      const hoursAhead = typeof body.hoursAhead === 'number' ? body.hoursAhead : 48;
      const limit = typeof body.limit === 'number' ? body.limit : 200;
      const result = await scheduleVolunteerGapAlerts(hoursAhead, Math.min(limit, 500));
      reply.send(result);
    } catch (error) {
      reply.code(400).send({ error: error instanceof Error ? error.message : 'Gap alert dispatch failed' });
    }
  });

  server.post('/public/giving/checkout', async (request, reply) => {
    try {
      const input = checkoutInputSchema.parse(request.body);
      const result = await createDonationCheckout({ ...input, tenantId: null });
      reply.send(result);
    } catch (error) {
      request.log.error({ error }, 'Public checkout failed');
      reply.code(400).send({ error: 'Unable to create checkout' });
    }
  });

  server.post('/webhooks/clerk', { config: { rawBody: true } }, async (request, reply) => {
    const payload = (request as typeof request & { rawBody?: string }).rawBody;
    if (!payload) {
      reply.code(400).send({ error: 'Missing payload' });
      return;
    }

    if (!env.CLERK_WEBHOOK_SECRET) {
      request.log.error('CLERK_WEBHOOK_SECRET is not set');
      reply.code(500).send({ error: 'Webhook not configured' });
      return;
    }

    const svixId = Array.isArray(request.headers['svix-id']) ? request.headers['svix-id'][0] : request.headers['svix-id'];
    const svixTimestamp = Array.isArray(request.headers['svix-timestamp'])
      ? request.headers['svix-timestamp'][0]
      : request.headers['svix-timestamp'];
    const svixSignature = Array.isArray(request.headers['svix-signature'])
      ? request.headers['svix-signature'][0]
      : request.headers['svix-signature'];

    if (!svixId || !svixTimestamp || !svixSignature) {
      reply.code(400).send({ error: 'Missing Svix headers' });
      return;
    }

    const webhook = new Webhook(env.CLERK_WEBHOOK_SECRET);
    let event: { type: string; data: { id?: string } };

    try {
      event = webhook.verify(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as { type: string; data: { id?: string } };
    } catch (error) {
      request.log.warn({ error }, 'Invalid Clerk webhook');
      reply.code(400).send({ error: 'Invalid signature' });
      return;
    }

    if (event.type === 'organization.created' && event.data?.id) {
      await provisionTenant(event.data.id);
    }

    reply.code(200).send({ ok: true });
  });

  server.post('/webhooks/stripe', { config: { rawBody: true } }, async (request, reply) => {
    const payload = (request as typeof request & { rawBody?: string | Buffer }).rawBody;
    const signature = Array.isArray(request.headers['stripe-signature'])
      ? request.headers['stripe-signature'][0]
      : request.headers['stripe-signature'];

    if (!payload || !signature || !env.STRIPE_WEBHOOK_SECRET) {
      reply.code(400).send({ error: 'Missing Stripe webhook data' });
      return;
    }

    try {
      const result = await handleStripeWebhook(payload, signature, env.STRIPE_WEBHOOK_SECRET);
      reply.send(result);
    } catch (error) {
      request.log.error({ error }, 'Stripe webhook failed');
      reply.code(400).send({ error: 'Stripe webhook error' });
    }
  });

  server.post('/webhooks/paystack', { config: { rawBody: true } }, async (request, reply) => {
    const payload = (request as typeof request & { rawBody?: string }).rawBody;
    const signature = Array.isArray(request.headers['x-paystack-signature'])
      ? request.headers['x-paystack-signature'][0]
      : request.headers['x-paystack-signature'];

    const paystackSecret = env.PAYSTACK_WEBHOOK_SECRET ?? env.PAYSTACK_SECRET_KEY;

    if (!payload || !signature || !paystackSecret) {
      reply.code(400).send({ error: 'Missing Paystack webhook data' });
      return;
    }

    try {
      const result = await handlePaystackWebhook(payload, signature, paystackSecret);
      reply.send(result);
    } catch (error) {
      request.log.error({ error }, 'Paystack webhook failed');
      reply.code(400).send({ error: 'Paystack webhook error' });
    }
  });

  server.post('/webhooks/stripe/platform', { config: { rawBody: true } }, async (request, reply) => {
    const payload = (request as typeof request & { rawBody?: string | Buffer }).rawBody;
    const signature = Array.isArray(request.headers['stripe-signature'])
      ? request.headers['stripe-signature'][0]
      : request.headers['stripe-signature'];

    if (!payload || !signature || !env.PLATFORM_STRIPE_WEBHOOK_SECRET || !env.STRIPE_SECRET_KEY) {
      reply.code(400).send({ error: 'Missing platform Stripe webhook configuration' });
      return;
    }

    try {
      const result = await handlePlatformStripeWebhook(
        payload,
        signature,
        env.PLATFORM_STRIPE_WEBHOOK_SECRET,
        env.STRIPE_SECRET_KEY
      );
      reply.send(result);
    } catch (error) {
      request.log.error({ error }, 'Platform Stripe webhook failed');
      reply.code(400).send({ error: 'Platform Stripe webhook error' });
    }
  });

  server.post('/webhooks/paystack/platform', { config: { rawBody: true } }, async (request, reply) => {
    const payload = (request as typeof request & { rawBody?: string }).rawBody;
    const signature = Array.isArray(request.headers['x-paystack-signature'])
      ? request.headers['x-paystack-signature'][0]
      : request.headers['x-paystack-signature'];

    const paystackSecret = env.PLATFORM_PAYSTACK_WEBHOOK_SECRET ?? env.PAYSTACK_WEBHOOK_SECRET ?? env.PAYSTACK_SECRET_KEY;

    if (!payload || !signature || !paystackSecret) {
      reply.code(400).send({ error: 'Missing platform Paystack webhook configuration' });
      return;
    }

    try {
      const result = await handlePlatformPaystackWebhook(payload, signature, paystackSecret);
      reply.send(result);
    } catch (error) {
      request.log.error({ error }, 'Platform Paystack webhook failed');
      reply.code(400).send({ error: 'Platform Paystack webhook error' });
    }
  });

  server.post('/webhooks/twilio/sms', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, string>;
    const from = body.From ?? '';
    const to = body.To ?? '';
    const messageBody = body.Body ?? '';
    const messageSid = body.MessageSid ?? undefined;

    const signature = Array.isArray(request.headers['x-twilio-signature'])
      ? request.headers['x-twilio-signature'][0]
      : request.headers['x-twilio-signature'];

    if (env.TWILIO_AUTH_TOKEN) {
      if (!signature) {
        reply.type('text/xml').send(buildTwimlMessage('Missing signature.'));
        return;
      }
      const url =
        env.TWILIO_WEBHOOK_URL ??
        `${request.protocol}://${request.headers.host}${request.raw.url}`;
      const valid = verifyTwilioSignature({
        url,
        params: body,
        signature,
        authToken: env.TWILIO_AUTH_TOKEN,
      });

      if (!valid) {
        reply.type('text/xml').send(buildTwimlMessage('Invalid signature.'));
        return;
      }
    }

    const normalizedTo = normalizePhoneNumber(to);
    const normalizedFrom = normalizePhoneNumber(from);

    const number = await prisma.textToGiveNumber.findFirst({
      where: { phoneNumber: normalizedTo },
      include: { church: { include: { organization: true } } },
    });

    if (!number || !number.church) {
      reply.type('text/xml').send(buildTwimlMessage('This giving number is not configured.'));
      return;
    }

    const messageRecord = await prisma.textToGiveMessage.create({
      data: {
        churchId: number.churchId,
        numberId: number.id,
        messageSid,
        fromNumber: normalizedFrom,
        toNumber: normalizedTo,
        body: messageBody,
        status: 'RECEIVED',
      },
    });

    const parsed = parseTextToGiveBody(messageBody);
    if (!parsed.amount || Number.isNaN(parsed.amount)) {
      await prisma.textToGiveMessage.update({
        where: { id: messageRecord.id },
        data: { status: 'FAILED', error: 'Missing amount' },
      });
      reply
        .type('text/xml')
        .send(buildTwimlMessage('Reply with an amount, e.g. GIVE 50 USD.'));
      return;
    }

    const currency = (parsed.currency ?? number.defaultCurrency).toUpperCase();
    const provider = number.provider ?? PaymentProvider.STRIPE;
    const donorEmail = parsed.email ?? undefined;

    if (provider === PaymentProvider.PAYSTACK && !donorEmail) {
      await prisma.textToGiveMessage.update({
        where: { id: messageRecord.id },
        data: { status: 'FAILED', error: 'Missing email for Paystack' },
      });
      reply
        .type('text/xml')
        .send(buildTwimlMessage('Paystack requires an email. Reply like: GIVE 50 GHS you@email.com'));
      return;
    }

    const webBase = env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
    const successUrl = `${webBase}/give?status=success&church=${number.church.slug}`;
    const cancelUrl = `${webBase}/give?status=cancel&church=${number.church.slug}`;

    try {
      const result = await createDonationCheckout({
        churchId: number.churchId,
        amount: parsed.amount,
        currency,
        provider,
        donorEmail,
        donorPhone: normalizedFrom,
        fundId: number.fundId ?? undefined,
        campaignId: number.campaignId ?? undefined,
        successUrl,
        cancelUrl,
        tenantId: null,
      });

      await prisma.textToGiveMessage.update({
        where: { id: messageRecord.id },
        data: {
          status: 'CHECKOUT_CREATED',
          amount: parsed.amount,
          currency,
          provider,
          checkoutUrl: result.checkoutUrl,
        },
      });

      await recordAuditLog({
        tenantId: number.church.organization.tenantId,
        churchId: number.churchId,
        actorType: AuditActorType.WEBHOOK,
        action: 'text_to_give.checkout_created',
        targetType: 'TextToGiveMessage',
        targetId: messageRecord.id,
        metadata: {
          amount: parsed.amount,
          currency,
          provider,
        },
      });

      reply.type('text/xml').send(buildTwimlMessage(`Complete your gift: ${result.checkoutUrl}`));
    } catch (error) {
      await prisma.textToGiveMessage.update({
        where: { id: messageRecord.id },
        data: { status: 'FAILED', error: error instanceof Error ? error.message : 'Checkout failed' },
      });
      reply
        .type('text/xml')
        .send(buildTwimlMessage('Unable to start checkout. Please try again later.'));
    }
  });

  server.get('/health', async () => ({ ok: true, timestamp: new Date().toISOString() }));

  server.get('/stream', async (request, reply) => {
    const tokenFromHeader = extractBearerToken(request.headers.authorization);
    const tokenFromQuery = typeof request.query === 'object' && request.query ? (request.query as any).token : null;
    const token = tokenFromHeader ?? tokenFromQuery;

    if (!token || typeof token !== 'string') {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    const claims = await verifyClerkToken(token);
    const clerkOrgId = claims?.org_id ?? claims?.orgId;

    if (!claims?.sub || !clerkOrgId) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    const tenantId = await provisionTenant(clerkOrgId);

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const send = (event: { type: string; data: Record<string, unknown> }) => {
      if (event.data.tenantId !== tenantId) return;
      reply.raw.write(`event: ${event.type}\n`);
      reply.raw.write(`data: ${JSON.stringify(event.data)}\n\n`);
    };

    const unsubscribe = subscribeRealtime(send);

    const heartbeat = setInterval(() => {
      reply.raw.write(`event: heartbeat\n`);
      reply.raw.write(`data: ${JSON.stringify({ ts: Date.now() })}\n\n`);
    }, 15000);

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  const scheduler = startInternalSchedulers(server.log);
  server.addHook('onClose', async () => {
    scheduler.stop();
  });

  await server.listen({ port: env.PORT, host: '0.0.0.0' });
}

start().catch((error) => {
  server.log.error(error);
  process.exit(1);
});
