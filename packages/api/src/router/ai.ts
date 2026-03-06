import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { generateTextSimple, type AIProvider } from '@faithflow-ai/ai';
import { AuditActorType, CommunicationChannel, UserRole } from '@faithflow-ai/database';
import { recordAuditLog } from '../audit';
import { ensureFeatureReadAccess, ensureFeatureWriteAccess } from '../entitlements';

const providerSchema = z.enum(['openai', 'anthropic', 'google']).default('openai');

async function requireStaff(tenantId: string, clerkUserId: string) {
  const staff = await prisma.staffMembership.findFirst({
    where: { user: { clerkUserId }, church: { organization: { tenantId } } },
    include: { user: true, church: true },
  });
  if (!staff) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Staff access required' });
  }
  return staff;
}

function defaultModel(provider: AIProvider) {
  if (provider === 'openai') return process.env.AI_OPENAI_MODEL ?? 'gpt-4o-mini';
  if (provider === 'anthropic') return process.env.AI_ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-latest';
  return process.env.AI_GOOGLE_MODEL ?? 'gemini-1.5-pro';
}

function pickQueryTokens(question: string) {
  const tokens = question
    .toLowerCase()
    .split(/[^a-z0-9+@._-]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    // Drop obvious PII-like tokens (emails, long phone-like digit sequences).
    .filter((t) => !t.includes('@'))
    .filter((t) => !/^\+?\d{7,}$/.test(t))
    .slice(0, 6);
  return Array.from(new Set(tokens));
}

type Source = {
  id: string;
  type: 'member' | 'donation' | 'event' | 'metric';
  label: string;
  timestamp?: string;
};

type SummaryPack = {
  key: 'executive' | 'attendance' | 'giving' | 'volunteer';
  title: string;
  summary: string;
  highlights: string[];
  actionLabel: string;
  actionHref: string;
};

function redactEmail(value: string) {
  // Minimal email redaction for UI labels; does not attempt to parse all edge cases.
  return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted]');
}

function redactPhone(value: string) {
  return value.replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[redacted]');
}

function maskName(value: string) {
  const parts = value
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!parts.length) return 'Unknown';
  if (parts.length === 1) return `${parts[0]![0] ?? ''}***`;
  const [first, ...rest] = parts;
  return `${first} ${rest.map((entry) => `${entry[0] ?? ''}.`).join(' ')}`.trim();
}

function redactLabel(label: string) {
  return redactPhone(redactEmail(label));
}

function getQuestionGuardrailMessage(value: string) {
  const normalized = value.toLowerCase();
  if (/(api[\s_-]*key|secret|password|session cookie|jwt|bearer token|access token)/i.test(normalized)) {
    return 'FaithFlow AI will not retrieve secrets, credentials, or session data.';
  }
  if (
    /(list|export|dump|show|reveal|give me).*(emails?|phone numbers?|addresses?|contact list|member directory)/i.test(
      normalized
    )
  ) {
    return 'FaithFlow AI will not expose bulk contact data. Use approved member directory and export workflows instead.';
  }
  if (/(list|dump|show|reveal|all|every|full).*(care notes?|pastoral notes?|counseling|counselling|medical|prayer requests?)/i.test(normalized)) {
    return 'FaithFlow AI will not expose private care or counseling records in bulk.';
  }
  return null;
}

function parseJsonDraft(raw: string) {
  const trimmed = raw.trim();
  const unwrapped = trimmed.startsWith('```')
    ? trimmed
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
    : trimmed;
  try {
    const json = JSON.parse(unwrapped) as {
      subject?: string;
      body?: string;
      reviewChecklist?: string[];
    };
    return {
      subject: typeof json.subject === 'string' ? json.subject.trim() : '',
      body: typeof json.body === 'string' ? json.body.trim() : '',
      reviewChecklist: Array.isArray(json.reviewChecklist)
        ? json.reviewChecklist.map((entry) => String(entry).trim()).filter(Boolean)
        : [],
    };
  } catch {
    return {
      subject: '',
      body: trimmed,
      reviewChecklist: [
        'Confirm message accuracy and theology before sending.',
        'Confirm no private member details are present.',
      ],
    };
  }
}

async function collectSources(input: {
  tenantId: string;
  churchId?: string | null;
  question: string;
  allowFinanceSources: boolean;
}): Promise<Source[]> {
  const tokens = pickQueryTokens(input.question);
  const baseChurchFilter = input.churchId ? { churchId: input.churchId } : {};

  const [memberCount, eventUpcomingCount, givingLast30] = await Promise.all([
    prisma.member.count({ where: { church: { organization: { tenantId: input.tenantId } } } }),
    prisma.event.count({
      where: {
        church: { organization: { tenantId: input.tenantId } },
        ...baseChurchFilter,
        startAt: { gte: new Date() },
      },
    }),
    prisma.donation.aggregate({
      where: {
        church: { organization: { tenantId: input.tenantId } },
        ...baseChurchFilter,
        status: 'COMPLETED',
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const givingLabel = input.allowFinanceSources
    ? `Giving (last 30d): count=${givingLast30._count._all} sum=${givingLast30._sum.amount?.toString() ?? '0'}`
    : `Giving (last 30d): count=${givingLast30._count._all}`;

  const sources: Source[] = [
    {
      id: 'metric:members',
      type: 'metric',
      label: `Members: ${memberCount}`,
      timestamp: new Date().toISOString(),
    },
    {
      id: 'metric:events_upcoming',
      type: 'metric',
      label: `Upcoming events: ${eventUpcomingCount}`,
      timestamp: new Date().toISOString(),
    },
    {
      id: 'metric:giving_30d',
      type: 'metric',
      label: givingLabel,
      timestamp: new Date().toISOString(),
    },
  ];

  if (!tokens.length) return sources;

  const like = tokens[0]!;
  const [members, donations, events] = await Promise.all([
    prisma.member.findMany({
      where: {
        church: { organization: { tenantId: input.tenantId } },
        ...baseChurchFilter,
        OR: [{ firstName: { contains: like, mode: 'insensitive' } }, { lastName: { contains: like, mode: 'insensitive' } }],
      },
      select: { id: true, firstName: true, lastName: true, status: true, updatedAt: true },
      take: 8,
    }),
    input.allowFinanceSources
      ? prisma.donation.findMany({
          where: {
            church: { organization: { tenantId: input.tenantId } },
            ...baseChurchFilter,
            status: 'COMPLETED',
            OR: [
              { donorName: { contains: like, mode: 'insensitive' } },
              // Note: query tokens strip emails; this is mainly for name fragments.
              { donorEmail: { contains: like, mode: 'insensitive' } },
            ],
          },
          select: { id: true, amount: true, currency: true, donorName: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 8,
        })
      : Promise.resolve([]),
    prisma.event.findMany({
      where: {
        church: { organization: { tenantId: input.tenantId } },
        ...baseChurchFilter,
        title: { contains: like, mode: 'insensitive' },
      },
      select: { id: true, title: true, startAt: true, type: true },
      orderBy: { startAt: 'desc' },
      take: 8,
    }),
  ]);

  for (const member of members) {
    sources.push({
      id: member.id,
      type: 'member',
      label: `Member ${maskName(`${member.firstName} ${member.lastName}`)} (${member.status})`,
      timestamp: member.updatedAt.toISOString(),
    });
  }
  for (const donation of donations) {
    sources.push({
      id: donation.id,
      type: 'donation',
      label: redactLabel(
        `Donation ${donation.amount.toString()} ${donation.currency} by ${maskName(donation.donorName ?? 'Unknown')} (${donation.createdAt.toISOString().slice(0, 10)})`
      ),
      timestamp: donation.createdAt.toISOString(),
    });
  }
  for (const event of events) {
    sources.push({
      id: event.id,
      type: 'event',
      label: `Event "${event.title}" (${event.type}) @ ${event.startAt.toISOString()}`,
      timestamp: event.startAt.toISOString(),
    });
  }

  return sources.slice(0, 30);
}

async function loadInsightSnapshot(input: { tenantId: string; churchId?: string | null }) {
  const churchId = input.churchId ?? null;
  const churchFilter = churchId ? { churchId } : {};
  const now = Date.now();
  const last30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const prev30 = new Date(now - 60 * 24 * 60 * 60 * 1000);
  const last90 = new Date(now - 90 * 24 * 60 * 60 * 1000);
  const yearAgo = new Date(now - 365 * 24 * 60 * 60 * 1000);

  const [membersTotal, attendanceLast30, attendancePrev30, givingLast30, givingPrev30, upcomingEvents, volunteerShifts, donorsLastYear, donorsRecent] =
    await Promise.all([
      prisma.member.count({ where: { church: { organization: { tenantId: input.tenantId } }, ...churchFilter } }),
      prisma.attendance.count({
        where: {
          event: { church: { organization: { tenantId: input.tenantId } }, ...churchFilter },
          createdAt: { gte: last30 },
        },
      }),
      prisma.attendance.count({
        where: {
          event: { church: { organization: { tenantId: input.tenantId } }, ...churchFilter },
          createdAt: { gte: prev30, lt: last30 },
        },
      }),
      prisma.donation.aggregate({
        where: {
          church: { organization: { tenantId: input.tenantId } },
          ...churchFilter,
          status: 'COMPLETED',
          createdAt: { gte: last30 },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.donation.aggregate({
        where: {
          church: { organization: { tenantId: input.tenantId } },
          ...churchFilter,
          status: 'COMPLETED',
          createdAt: { gte: prev30, lt: last30 },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.event.count({
        where: {
          church: { organization: { tenantId: input.tenantId } },
          ...churchFilter,
          startAt: { gte: new Date() },
        },
      }),
      prisma.volunteerShift.findMany({
        where: {
          church: { organization: { tenantId: input.tenantId } },
          ...churchFilter,
          startAt: { gte: new Date(), lte: new Date(now + 30 * 24 * 60 * 60 * 1000) },
        },
        select: { id: true, capacity: true, _count: { select: { assignments: true } }, startAt: true, title: true },
        take: 120,
        orderBy: { startAt: 'asc' },
      }),
      prisma.donation.findMany({
        where: {
          church: { organization: { tenantId: input.tenantId } },
          ...churchFilter,
          status: 'COMPLETED',
          createdAt: { gte: yearAgo },
        },
        select: { donorEmail: true, memberId: true },
      }),
      prisma.donation.findMany({
        where: {
          church: { organization: { tenantId: input.tenantId } },
          ...churchFilter,
          status: 'COMPLETED',
          createdAt: { gte: last90 },
        },
        select: { donorEmail: true, memberId: true },
      }),
    ]);

  const givingLast30Sum = Number(givingLast30._sum.amount?.toString() ?? '0');
  const givingPrev30Sum = Number(givingPrev30._sum.amount?.toString() ?? '0');
  const givingDelta = givingLast30Sum - givingPrev30Sum;
  const givingDeltaPct = givingPrev30Sum > 0 ? (givingDelta / givingPrev30Sum) * 100 : null;

  const attendanceDelta = attendanceLast30 - attendancePrev30;
  const attendanceDeltaPct = attendancePrev30 > 0 ? (attendanceDelta / attendancePrev30) * 100 : null;

  const shiftGaps = volunteerShifts
    .filter((shift) => typeof shift.capacity === 'number' && shift.capacity !== null)
    .map((shift) => ({
      id: shift.id,
      title: shift.title,
      startAt: shift.startAt,
      capacity: shift.capacity ?? 0,
      assigned: shift._count.assignments,
      gap: Math.max(0, (shift.capacity ?? 0) - shift._count.assignments),
    }))
    .filter((shift) => shift.gap > 0)
    .slice(0, 10);

  const lastYearSet = new Set(
    donorsLastYear
      .map((item) => item.memberId ?? item.donorEmail ?? null)
      .filter((id): id is string => Boolean(id))
  );
  const recentSet = new Set(
    donorsRecent
      .map((item) => item.memberId ?? item.donorEmail ?? null)
      .filter((id): id is string => Boolean(id))
  );
  const lapsedCount = Array.from(lastYearSet).filter((id) => !recentSet.has(id)).length;

  return {
    membersTotal,
    upcomingEvents,
    attendance: {
      last30: attendanceLast30,
      prev30: attendancePrev30,
      delta: attendanceDelta,
      deltaPct: attendanceDeltaPct,
    },
    giving: {
      last30Sum: givingLast30Sum,
      last30Count: givingLast30._count._all,
      prev30Sum: givingPrev30Sum,
      prev30Count: givingPrev30._count._all,
      delta: givingDelta,
      deltaPct: givingDeltaPct,
      lapsedCount,
    },
    volunteer: {
      shiftsNext30: volunteerShifts.length,
      gaps: shiftGaps,
    },
    asOf: new Date().toISOString(),
  };
}

function toStarterInsightResponse(snapshot: Awaited<ReturnType<typeof loadInsightSnapshot>>, allowFinanceSources: boolean) {
  return {
    membersTotal: snapshot.membersTotal,
    upcomingEvents: snapshot.upcomingEvents,
    attendance: snapshot.attendance,
    giving: {
      last30Sum: allowFinanceSources ? snapshot.giving.last30Sum : null,
      last30Count: snapshot.giving.last30Count,
      prev30Sum: allowFinanceSources ? snapshot.giving.prev30Sum : null,
      prev30Count: snapshot.giving.prev30Count,
      delta: allowFinanceSources ? snapshot.giving.delta : null,
      deltaPct: allowFinanceSources ? snapshot.giving.deltaPct : null,
      lapsedCount: allowFinanceSources ? snapshot.giving.lapsedCount : null,
    },
    volunteer: snapshot.volunteer,
    asOf: snapshot.asOf,
  };
}

function buildFallbackSummaryPacks(
  snapshot: Awaited<ReturnType<typeof loadInsightSnapshot>>,
  allowFinanceSources: boolean
): SummaryPack[] {
  return [
    {
      key: 'executive',
      title: 'Executive snapshot',
      summary: `${snapshot.membersTotal} members tracked, ${snapshot.upcomingEvents} upcoming events, and ${snapshot.volunteer.gaps.length} volunteer gap areas need attention.`,
      highlights: [
        `${snapshot.attendance.last30} attendance records in the last 30 days`,
        `${snapshot.volunteer.shiftsNext30} volunteer shifts scheduled in the next 30 days`,
        allowFinanceSources
          ? `${snapshot.giving.last30Count} gifts recorded in the last 30 days`
          : 'Giving visibility is limited to non-financial counts for this role',
      ],
      actionLabel: 'Open overview',
      actionHref: '/dashboard',
    },
    {
      key: 'attendance',
      title: 'Attendance momentum',
      summary:
        snapshot.attendance.delta >= 0
          ? `Attendance is up ${snapshot.attendance.delta} compared with the previous 30-day window.`
          : `Attendance is down ${Math.abs(snapshot.attendance.delta)} compared with the previous 30-day window.`,
      highlights: [
        `Current 30-day attendance: ${snapshot.attendance.last30}`,
        `Previous 30-day attendance: ${snapshot.attendance.prev30}`,
        snapshot.attendance.deltaPct === null
          ? 'Percentage change is unavailable because the prior period had no attendance'
          : `Delta: ${snapshot.attendance.deltaPct.toFixed(1)}%`,
      ],
      actionLabel: 'Open events',
      actionHref: '/dashboard/events',
    },
    {
      key: 'giving',
      title: 'Giving and donor risk',
      summary: allowFinanceSources
        ? `Giving moved by ${snapshot.giving.delta >= 0 ? '+' : ''}${snapshot.giving.delta.toFixed(0)} over the prior 30-day window, with ${snapshot.giving.lapsedCount} lapsed donors in the last 90 days.`
        : `Giving activity shows ${snapshot.giving.last30Count} gifts in the last 30 days. Full financial detail is restricted to tenant admins.`,
      highlights: allowFinanceSources
        ? [
            `Current 30-day total: ${snapshot.giving.last30Sum.toFixed(0)}`,
            `Previous 30-day total: ${snapshot.giving.prev30Sum.toFixed(0)}`,
            `Lapsed donor count: ${snapshot.giving.lapsedCount}`,
          ]
        : [
            `Current 30-day gift count: ${snapshot.giving.last30Count}`,
            `Previous 30-day gift count: ${snapshot.giving.prev30Count}`,
            'Revenue amounts are hidden for this role',
          ],
      actionLabel: 'Open finance',
      actionHref: '/dashboard/finance',
    },
    {
      key: 'volunteer',
      title: 'Volunteer coverage',
      summary: snapshot.volunteer.gaps.length
        ? `${snapshot.volunteer.gaps.length} upcoming shifts are understaffed and should be assigned now.`
        : 'Upcoming volunteer coverage is healthy across the next 30 days.',
      highlights: snapshot.volunteer.gaps.length
        ? snapshot.volunteer.gaps.slice(0, 3).map((gap) => `${gap.title}: gap ${gap.gap} on ${gap.startAt.toISOString().slice(0, 10)}`)
        : [`${snapshot.volunteer.shiftsNext30} shifts scheduled with no detected coverage gaps`],
      actionLabel: 'Open members',
      actionHref: '/dashboard/members',
    },
  ];
}

function parseSummaryPacks(raw: string, fallback: SummaryPack[]) {
  const trimmed = raw.trim();
  const unwrapped = trimmed.startsWith('```')
    ? trimmed
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
    : trimmed;
  try {
    const parsed = JSON.parse(unwrapped) as { packs?: Array<Partial<SummaryPack>> };
    const incoming = Array.isArray(parsed?.packs) ? parsed.packs : [];
    return fallback.map((pack) => {
      const override = incoming.find((entry) => entry.key === pack.key);
      return {
        ...pack,
        summary: typeof override?.summary === 'string' && override.summary.trim() ? override.summary.trim() : pack.summary,
        highlights: Array.isArray(override?.highlights)
          ? override.highlights.map((item) => String(item).trim()).filter(Boolean).slice(0, 3)
          : pack.highlights,
      };
    });
  } catch {
    return fallback;
  }
}

export const aiRouter = router({
  ask: protectedProcedure
    .input(
      z.object({
        question: z.string().trim().min(5).max(2000),
        churchId: z.string().optional(),
        provider: providerSchema.optional(),
        model: z.string().trim().max(120).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const staff = await requireStaff(ctx.tenantId!, ctx.userId!);
      await ensureFeatureWriteAccess(ctx.tenantId!, 'ai_insights', 'AI insights are not enabled on your current plan.');
      const guardrailMessage = getQuestionGuardrailMessage(input.question);
      if (guardrailMessage) {
        throw new TRPCError({ code: 'FORBIDDEN', message: guardrailMessage });
      }

      const provider = (input.provider ?? 'openai') as AIProvider;
      const model = input.model?.trim() || defaultModel(provider);

      const sources = await collectSources({
        tenantId: ctx.tenantId!,
        churchId: input.churchId ?? null,
        question: input.question,
        allowFinanceSources: staff.role === UserRole.ADMIN,
      });

      const sourcesText = sources
        .map((s, idx) => `[S${idx + 1}] type=${s.type} id=${s.id} ${s.timestamp ? `ts=${s.timestamp} ` : ''}${s.label}`)
        .join('\n');

      const prompt = [
        'You are FaithFlow AI, an assistant for church staff.',
        'Use ONLY the provided SOURCES. If a question cannot be answered from sources, say what is missing and suggest what to check next.',
        'Cite sources inline using [S#] for any factual claim derived from sources.',
        'Be concise and action-oriented.',
        'Do not invent personal data. Do not reveal emails, phone numbers, addresses, or private notes.',
        '',
        'SOURCES:',
        sourcesText || '(none)',
        '',
        `QUESTION: ${input.question}`,
      ].join('\n');

      const answer = await generateTextSimple({
        provider,
        model,
        prompt,
        temperature: 0.2,
        maxTokens: 700,
      });

      const interaction = await prisma.aiInteraction.create({
        data: {
          tenantId: ctx.tenantId!,
          churchId: input.churchId,
          clerkUserId: ctx.userId,
          provider,
          model,
          question: input.question,
          answer,
          sources: sources as any,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: input.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'ai.ask',
        targetType: 'AiInteraction',
        targetId: interaction.id,
        metadata: { provider, model, sourcesCount: sources.length },
      });

      return {
        id: interaction.id,
        provider,
        model,
        answer,
        sources,
        createdAt: interaction.createdAt,
      };
    }),

  generateCommunicationDraft: protectedProcedure
    .input(
      z.object({
        churchId: z.string().optional(),
        channel: z.nativeEnum(CommunicationChannel),
        objective: z.string().trim().min(10).max(1200),
        audienceHint: z.string().trim().max(300).optional(),
        tone: z.enum(['PASTORAL', 'INFORMATIVE', 'URGENT', 'FRIENDLY']).default('PASTORAL'),
        provider: providerSchema.optional(),
        model: z.string().trim().max(120).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const staff = await requireStaff(ctx.tenantId!, ctx.userId!);
      await ensureFeatureWriteAccess(ctx.tenantId!, 'ai_insights', 'AI insights are not enabled on your current plan.');
      await ensureFeatureWriteAccess(
        ctx.tenantId!,
        'communications_enabled',
        'Communications are not enabled on your current plan.'
      );
      const guardrailMessage = getQuestionGuardrailMessage(`${input.objective}\n${input.audienceHint ?? ''}`);
      if (guardrailMessage) {
        throw new TRPCError({ code: 'FORBIDDEN', message: guardrailMessage });
      }

      const provider = (input.provider ?? 'openai') as AIProvider;
      const model = input.model?.trim() || defaultModel(provider);
      const sources = await collectSources({
        tenantId: ctx.tenantId!,
        churchId: input.churchId ?? null,
        question: input.objective,
        allowFinanceSources: staff.role === UserRole.ADMIN,
      });

      const prompt = [
        'You are FaithFlow AI generating a church communication draft.',
        'Return ONLY valid JSON with keys: subject, body, reviewChecklist.',
        'subject: short line; leave empty for SMS/WhatsApp.',
        'body: ready-to-send message using plain language; no markdown.',
        'reviewChecklist: array of 3-5 short review items for a human approver.',
        'Do not include private member data, emails, phone numbers, addresses, or legal claims.',
        'Do not guarantee outcomes or imply emergency unless explicitly asked.',
        `Channel: ${input.channel}`,
        `Tone: ${input.tone}`,
        `Audience hint: ${input.audienceHint ?? 'General church audience'}`,
        `Objective: ${input.objective}`,
      ].join('\n');

      const answer = await generateTextSimple({
        provider,
        model,
        prompt,
        temperature: 0.2,
        maxTokens: 700,
      });

      const parsed = parseJsonDraft(answer);
      if (!parsed.body) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI draft did not include message body' });
      }

      const interaction = await prisma.aiInteraction.create({
        data: {
          tenantId: ctx.tenantId!,
          churchId: input.churchId,
          clerkUserId: ctx.userId,
          provider,
          model,
          question: `COMMUNICATION_DRAFT: ${input.objective}`,
          answer,
          sources: sources as any,
        },
      });

      await recordAuditLog({
        tenantId: ctx.tenantId,
        churchId: input.churchId,
        actorType: AuditActorType.USER,
        actorId: ctx.userId,
        action: 'ai.communication_draft_generated',
        targetType: 'AiInteraction',
        targetId: interaction.id,
        metadata: {
          provider,
          model,
          channel: input.channel,
          tone: input.tone,
          sourcesCount: sources.length,
        },
      });

      return {
        id: interaction.id,
        provider,
        model,
        channel: input.channel,
        subject: parsed.subject,
        body: parsed.body,
        reviewChecklist: parsed.reviewChecklist,
        createdAt: interaction.createdAt,
      };
    }),

  starterInsights: protectedProcedure
    .input(z.object({ churchId: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const staff = await requireStaff(ctx.tenantId!, ctx.userId!);
      await ensureFeatureReadAccess(ctx.tenantId!, 'ai_insights', 'AI insights are not enabled on your current plan.');
      const snapshot = await loadInsightSnapshot({ tenantId: ctx.tenantId!, churchId: input?.churchId ?? null });
      return toStarterInsightResponse(snapshot, staff.role === UserRole.ADMIN);
    }),

  summaryPacks: protectedProcedure
    .input(
      z
        .object({
          churchId: z.string().optional(),
          provider: providerSchema.optional(),
          model: z.string().trim().max(120).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const staff = await requireStaff(ctx.tenantId!, ctx.userId!);
      await ensureFeatureReadAccess(ctx.tenantId!, 'ai_insights', 'AI insights are not enabled on your current plan.');

      const allowFinanceSources = staff.role === UserRole.ADMIN;
      const snapshot = await loadInsightSnapshot({ tenantId: ctx.tenantId!, churchId: input?.churchId ?? null });
      const fallback = buildFallbackSummaryPacks(snapshot, allowFinanceSources);
      const provider = (input?.provider ?? 'openai') as AIProvider;
      const model = input?.model?.trim() || defaultModel(provider);

      try {
        const prompt = [
          'You are FaithFlow AI preparing executive summary packs for church operators.',
          'Return ONLY valid JSON with shape {"packs":[{"key","summary","highlights"}]}.',
          'Use the provided keys exactly: executive, attendance, giving, volunteer.',
          'Each summary must be one concise paragraph.',
          'Each highlights array must contain exactly 3 short bullets.',
          allowFinanceSources
            ? 'Financial amounts are allowed.'
            : 'Do not expose financial amounts or donor-identifiable financial detail. Use counts and directional language only.',
          '',
          'DATA:',
          JSON.stringify(snapshot, null, 2),
        ].join('\n');

        const raw = await generateTextSimple({
          provider,
          model,
          prompt,
          temperature: 0.2,
          maxTokens: 900,
        });

        return {
          packs: parseSummaryPacks(raw, fallback),
          generatedWithAi: true,
          warnings: [] as string[],
          asOf: snapshot.asOf,
        };
      } catch {
        return {
          packs: fallback,
          generatedWithAi: false,
          warnings: ['AI generation failed; returned fallback summary packs.'],
          asOf: snapshot.asOf,
        };
      }
    }),

  recent: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ input, ctx }) => {
      await requireStaff(ctx.tenantId!, ctx.userId!);
      await ensureFeatureReadAccess(ctx.tenantId!, 'ai_insights', 'AI insights are not enabled on your current plan.');
      return prisma.aiInteraction.findMany({
        where: { tenantId: ctx.tenantId! },
        orderBy: { createdAt: 'desc' },
        take: input?.limit ?? 20,
      });
    }),
});
