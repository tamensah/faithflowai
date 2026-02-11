import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { Prisma, SurveyQuestionType, SurveyStatus, prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { generateTextSimple, type AIProvider } from '@faithflow-ai/ai';
import { toCsv } from '../csv';

const providerSchema = z.enum(['openai', 'anthropic', 'google']).default('openai');

const surveySchema = z.object({
  churchId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.nativeEnum(SurveyStatus).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
});

const surveyUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.nativeEnum(SurveyStatus).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
});

const questionSchema = z.object({
  surveyId: z.string(),
  prompt: z.string().min(1),
  type: z.nativeEnum(SurveyQuestionType).optional(),
  order: z.number().int().min(1),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});

const questionUpdateSchema = z.object({
  prompt: z.string().min(1).optional(),
  type: z.nativeEnum(SurveyQuestionType).optional(),
  order: z.number().int().min(1).optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});

const responseSchema = z.object({
  surveyId: z.string(),
  memberId: z.string().optional(),
  respondentName: z.string().optional(),
  respondentEmail: z.string().optional(),
  respondentPhone: z.string().optional(),
  answers: z.record(z.string(), z.any()),
});

export const surveyRouter = router({
  createSurvey: protectedProcedure
    .input(surveySchema)
    .mutation(async ({ input, ctx }) => {
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      return prisma.survey.create({
        data: {
          churchId: input.churchId,
          title: input.title,
          description: input.description,
          status: input.status ?? SurveyStatus.DRAFT,
          startAt: input.startAt,
          endAt: input.endAt,
        },
      });
    }),

  listSurveys: protectedProcedure
    .input(z.object({ churchId: z.string().optional(), status: z.nativeEnum(SurveyStatus).optional() }))
    .query(async ({ input, ctx }) => {
      return prisma.survey.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
          ...(input.status ? { status: input.status } : {}),
        },
        include: { questions: true },
        orderBy: { createdAt: 'desc' },
      });
    }),

  updateSurvey: protectedProcedure
    .input(z.object({ id: z.string(), data: surveyUpdateSchema }))
    .mutation(async ({ input, ctx }) => {
      const survey = await prisma.survey.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!survey) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Survey not found' });
      }

      return prisma.survey.update({ where: { id: input.id }, data: input.data });
    }),

  deleteSurvey: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const survey = await prisma.survey.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!survey) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Survey not found' });
      }

      return prisma.survey.delete({ where: { id: input.id } });
    }),

  addQuestion: protectedProcedure
    .input(questionSchema)
    .mutation(async ({ input, ctx }) => {
      const survey = await prisma.survey.findFirst({
        where: { id: input.surveyId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!survey) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Survey not found' });
      }

      return prisma.surveyQuestion.create({
        data: {
          surveyId: input.surveyId,
          prompt: input.prompt,
          type: input.type ?? SurveyQuestionType.TEXT,
          order: input.order,
          required: input.required ?? false,
          options: input.options ? input.options : undefined,
        },
      });
    }),

  updateQuestion: protectedProcedure
    .input(z.object({ id: z.string(), data: questionUpdateSchema }))
    .mutation(async ({ input, ctx }) => {
      const question = await prisma.surveyQuestion.findFirst({
        where: { id: input.id, survey: { church: { organization: { tenantId: ctx.tenantId! } } } },
      });
      if (!question) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Question not found' });
      }

      return prisma.surveyQuestion.update({ where: { id: input.id }, data: input.data });
    }),

  deleteQuestion: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const question = await prisma.surveyQuestion.findFirst({
        where: { id: input.id, survey: { church: { organization: { tenantId: ctx.tenantId! } } } },
      });
      if (!question) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Question not found' });
      }

      return prisma.surveyQuestion.delete({ where: { id: input.id } });
    }),

  submitResponse: protectedProcedure
    .input(responseSchema)
    .mutation(async ({ input, ctx }) => {
      const survey = await prisma.survey.findFirst({
        where: { id: input.surveyId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!survey) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Survey not found' });
      }

      return prisma.surveyResponse.create({
        data: {
          surveyId: input.surveyId,
          memberId: input.memberId,
          respondentName: input.respondentName,
          respondentEmail: input.respondentEmail,
          respondentPhone: input.respondentPhone,
          answers: input.answers as Prisma.InputJsonValue,
        },
      });
    }),

  submitSelfResponse: protectedProcedure
    .input(z.object({ surveyId: z.string(), answers: z.record(z.string(), z.any()) }))
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

      return prisma.surveyResponse.create({
        data: {
          surveyId: input.surveyId,
          memberId: member.id,
          respondentName: `${member.firstName} ${member.lastName}`,
          respondentEmail: member.email ?? undefined,
          respondentPhone: member.phone ?? undefined,
          answers: input.answers as Prisma.InputJsonValue,
        },
      });
    }),

  listActive: protectedProcedure
    .input(z.object({ churchId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const now = new Date();
      return prisma.survey.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
          status: SurveyStatus.ACTIVE,
          AND: [
            {
              OR: [{ startAt: null }, { startAt: { lte: now } }],
            },
            {
              OR: [{ endAt: null }, { endAt: { gte: now } }],
            },
          ],
        },
        include: { questions: true },
        orderBy: { createdAt: 'desc' },
      });
    }),

  summary: protectedProcedure
    .input(z.object({ surveyId: z.string() }))
    .query(async ({ input, ctx }) => {
      const survey = await prisma.survey.findFirst({
        where: { id: input.surveyId, church: { organization: { tenantId: ctx.tenantId! } } },
        include: { questions: true },
      });
      if (!survey) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Survey not found' });
      }

      const responses = await prisma.surveyResponse.findMany({
        where: { surveyId: input.surveyId },
      });

      const summary = survey.questions.map((question) => {
        const stats: { questionId: string; prompt: string; type: SurveyQuestionType; counts?: Record<string, number>; average?: number } = {
          questionId: question.id,
          prompt: question.prompt,
          type: question.type,
        };

        if (question.type === SurveyQuestionType.SINGLE_CHOICE || question.type === SurveyQuestionType.MULTI_CHOICE) {
          const options = Array.isArray(question.options) ? (question.options as string[]) : [];
          const counts: Record<string, number> = {};
          options.forEach((option) => {
            counts[option] = 0;
          });

          for (const response of responses) {
            const value = (response.answers as Record<string, any>)[question.id];
            if (Array.isArray(value)) {
              value.forEach((item) => {
                counts[item] = (counts[item] ?? 0) + 1;
              });
            } else if (typeof value === 'string') {
              counts[value] = (counts[value] ?? 0) + 1;
            }
          }
          stats.counts = counts;
        }

        if (question.type === SurveyQuestionType.RATING) {
          let sum = 0;
          let count = 0;
          for (const response of responses) {
            const value = (response.answers as Record<string, any>)[question.id];
            if (typeof value === 'number') {
              sum += value;
              count += 1;
            }
          }
          stats.average = count ? sum / count : 0;
        }

        return stats;
      });

      return {
        totalResponses: responses.length,
        summary,
      };
    }),

  exportResponses: protectedProcedure
    .input(z.object({ surveyId: z.string() }))
    .query(async ({ input, ctx }) => {
      const survey = await prisma.survey.findFirst({
        where: { id: input.surveyId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!survey) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Survey not found' });
      }

      const responses = await prisma.surveyResponse.findMany({
        where: { surveyId: input.surveyId },
        orderBy: { createdAt: 'desc' },
      });

      const rows = responses.map((response) => ({
        id: response.id,
        memberId: response.memberId ?? '',
        respondentName: response.respondentName ?? '',
        respondentEmail: response.respondentEmail ?? '',
        respondentPhone: response.respondentPhone ?? '',
        createdAt: response.createdAt.toISOString(),
        answers: JSON.stringify(response.answers ?? {}),
      }));

      const content = toCsv(rows, [
        { key: 'id', label: 'Response ID' },
        { key: 'memberId', label: 'Member ID' },
        { key: 'respondentName', label: 'Name' },
        { key: 'respondentEmail', label: 'Email' },
        { key: 'respondentPhone', label: 'Phone' },
        { key: 'createdAt', label: 'Submitted At' },
        { key: 'answers', label: 'Answers (JSON)' },
      ]);

      return {
        filename: `survey-${survey.id}-responses.csv`,
        content,
      };
    }),

  summaryAi: protectedProcedure
    .input(
      z.object({
        surveyId: z.string(),
        provider: providerSchema.optional(),
        model: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const survey = await prisma.survey.findFirst({
        where: { id: input.surveyId, church: { organization: { tenantId: ctx.tenantId! } } },
        include: { questions: true },
      });
      if (!survey) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Survey not found' });
      }

      const responses = await prisma.surveyResponse.findMany({
        where: { surveyId: input.surveyId },
        orderBy: { createdAt: 'desc' },
      });

      const provider = (input.provider ?? 'openai') as AIProvider;
      const model =
        input.model ??
        (provider === 'openai'
          ? 'gpt-4o-mini'
          : provider === 'anthropic'
          ? 'claude-3-5-haiku-latest'
          : 'gemini-1.5-flash');

      const providerKey =
        provider === 'openai'
          ? process.env.OPENAI_API_KEY
          : provider === 'anthropic'
          ? process.env.ANTHROPIC_API_KEY
          : process.env.GOOGLE_API_KEY;

      if (!providerKey) {
        return {
          summary: `Survey ${survey.title} has ${responses.length} responses. Configure ${provider} to enable AI summaries.`,
          warnings: [`${provider} is not configured`],
        };
      }

      const openTextQuestions = survey.questions.filter((question) => question.type === SurveyQuestionType.TEXT);
      const openTextAnswers = responses.flatMap((response) =>
        openTextQuestions
          .map((question) => {
            const value = (response.answers as Record<string, any>)[question.id];
            return typeof value === 'string' ? value : null;
          })
          .filter((value): value is string => Boolean(value))
      );

      const summaryStats = {
        surveyTitle: survey.title,
        totalResponses: responses.length,
        openTextAnswers: openTextAnswers.slice(0, 200),
      };

      try {
        const prompt = `
You are a senior church engagement analyst. Summarize the survey results:
- 5 key themes from open text answers
- 3 actionable recommendations
- Any risks or follow-up needs

Data:
${JSON.stringify(summaryStats, null, 2)}
`;

        const summary = await generateTextSimple({
          provider,
          model,
          prompt,
          temperature: 0.2,
          maxTokens: 600,
        });

        return { summary, warnings: [] };
      } catch (error) {
        return {
          summary: `Survey ${survey.title} has ${responses.length} responses. AI summary failed.`,
          warnings: ['AI generation failed'],
        };
      }
    }),
});
