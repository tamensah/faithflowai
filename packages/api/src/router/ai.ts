import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { generateTextSimple, type AIProvider } from '@faithflow-ai/ai';
import { AuditActorType } from '@faithflow-ai/database';
import { recordAuditLog } from '../audit';

const providerSchema = z.enum(['openai', 'anthropic', 'google']).default('openai');

async function requireStaff(tenantId: string, clerkUserId: string) {
  const staff = await prisma.staffMembership.findFirst({
    where: { user: { clerkUserId }, church: { organization: { tenantId } } },
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
    .slice(0, 6);
  return Array.from(new Set(tokens));
}

type Source = {
  id: string;
  type: 'member' | 'donation' | 'event' | 'metric';
  label: string;
  timestamp?: string;
};

async function collectSources(input: { tenantId: string; churchId?: string | null; question: string }): Promise<Source[]> {
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
      label: `Giving (last 30d): count=${givingLast30._count._all} sum=${givingLast30._sum.amount?.toString() ?? '0'}`,
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
    prisma.donation.findMany({
      where: {
        church: { organization: { tenantId: input.tenantId } },
        ...baseChurchFilter,
        status: 'COMPLETED',
        OR: [{ donorName: { contains: like, mode: 'insensitive' } }, { donorEmail: { contains: like, mode: 'insensitive' } }],
      },
      select: { id: true, amount: true, currency: true, donorName: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
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
      label: `Member ${member.firstName} ${member.lastName} (${member.status})`,
      timestamp: member.updatedAt.toISOString(),
    });
  }
  for (const donation of donations) {
    sources.push({
      id: donation.id,
      type: 'donation',
      label: `Donation ${donation.amount.toString()} ${donation.currency} by ${donation.donorName ?? 'Unknown'} (${donation.createdAt.toISOString().slice(0, 10)})`,
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
      await requireStaff(ctx.tenantId!, ctx.userId!);

      const provider = (input.provider ?? 'openai') as AIProvider;
      const model = input.model?.trim() || defaultModel(provider);

      const sources = await collectSources({
        tenantId: ctx.tenantId!,
        churchId: input.churchId ?? null,
        question: input.question,
      });

      const sourcesText = sources
        .map((s, idx) => `[S${idx + 1}] type=${s.type} id=${s.id} ${s.timestamp ? `ts=${s.timestamp} ` : ''}${s.label}`)
        .join('\n');

      const prompt = [
        'You are FaithFlow AI, an assistant for church staff.',
        'Use ONLY the provided SOURCES. If a question cannot be answered from sources, say what is missing and suggest what to check next.',
        'Cite sources inline using [S#] for any factual claim derived from sources.',
        'Be concise and action-oriented.',
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

  recent: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ input, ctx }) => {
      await requireStaff(ctx.tenantId!, ctx.userId!);
      return prisma.aiInteraction.findMany({
        where: { tenantId: ctx.tenantId! },
        orderBy: { createdAt: 'desc' },
        take: input?.limit ?? 20,
      });
    }),
});
