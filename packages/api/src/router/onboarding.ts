import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { OnboardingStepType, OnboardingTaskStatus, OnboardingWorkflowStatus, prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';

const workflowSchema = z.object({
  churchId: z.string(),
  name: z.string().min(1),
  status: z.nativeEnum(OnboardingWorkflowStatus).optional(),
  description: z.string().optional(),
});

const workflowUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.nativeEnum(OnboardingWorkflowStatus).optional(),
  description: z.string().optional(),
});

const stepSchema = z.object({
  workflowId: z.string(),
  name: z.string().min(1),
  type: z.nativeEnum(OnboardingStepType).optional(),
  order: z.number().int().min(1),
  description: z.string().optional(),
  dueDays: z.number().int().min(0).optional(),
});

const stepUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.nativeEnum(OnboardingStepType).optional(),
  order: z.number().int().min(1).optional(),
  description: z.string().optional(),
  dueDays: z.number().int().min(0).optional(),
});

export const onboardingRouter = router({
  createWorkflow: protectedProcedure
    .input(workflowSchema)
    .mutation(async ({ input, ctx }) => {
      const church = await prisma.church.findFirst({
        where: { id: input.churchId, organization: { tenantId: ctx.tenantId! } },
      });
      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      return prisma.onboardingWorkflow.create({
        data: {
          churchId: input.churchId,
          name: input.name,
          status: input.status ?? OnboardingWorkflowStatus.ACTIVE,
          description: input.description,
        },
      });
    }),

  listWorkflows: protectedProcedure
    .input(z.object({ churchId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      return prisma.onboardingWorkflow.findMany({
        where: {
          church: { organization: { tenantId: ctx.tenantId! } },
          ...(input.churchId ? { churchId: input.churchId } : {}),
        },
        include: { steps: true },
        orderBy: { createdAt: 'desc' },
      });
    }),

  updateWorkflow: protectedProcedure
    .input(z.object({ id: z.string(), data: workflowUpdateSchema }))
    .mutation(async ({ input, ctx }) => {
      const workflow = await prisma.onboardingWorkflow.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!workflow) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow not found' });
      }

      return prisma.onboardingWorkflow.update({
        where: { id: input.id },
        data: input.data,
      });
    }),

  deleteWorkflow: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const workflow = await prisma.onboardingWorkflow.findFirst({
        where: { id: input.id, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!workflow) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow not found' });
      }

      return prisma.onboardingWorkflow.delete({ where: { id: input.id } });
    }),

  createStep: protectedProcedure
    .input(stepSchema)
    .mutation(async ({ input, ctx }) => {
      const workflow = await prisma.onboardingWorkflow.findFirst({
        where: { id: input.workflowId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!workflow) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow not found' });
      }

      return prisma.onboardingStep.create({
        data: {
          workflowId: input.workflowId,
          name: input.name,
          type: input.type ?? OnboardingStepType.OTHER,
          order: input.order,
          description: input.description,
          dueDays: input.dueDays,
        },
      });
    }),

  listSteps: protectedProcedure
    .input(z.object({ workflowId: z.string() }))
    .query(async ({ input, ctx }) => {
      const workflow = await prisma.onboardingWorkflow.findFirst({
        where: { id: input.workflowId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!workflow) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow not found' });
      }

      return prisma.onboardingStep.findMany({
        where: { workflowId: input.workflowId },
        orderBy: { order: 'asc' },
      });
    }),

  updateStep: protectedProcedure
    .input(z.object({ id: z.string(), data: stepUpdateSchema }))
    .mutation(async ({ input, ctx }) => {
      const step = await prisma.onboardingStep.findFirst({
        where: { id: input.id, workflow: { church: { organization: { tenantId: ctx.tenantId! } } } },
      });
      if (!step) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Step not found' });
      }

      return prisma.onboardingStep.update({
        where: { id: input.id },
        data: input.data,
      });
    }),

  deleteStep: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const step = await prisma.onboardingStep.findFirst({
        where: { id: input.id, workflow: { church: { organization: { tenantId: ctx.tenantId! } } } },
      });
      if (!step) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Step not found' });
      }

      return prisma.onboardingStep.delete({ where: { id: input.id } });
    }),

  assignMember: protectedProcedure
    .input(z.object({ memberId: z.string(), workflowId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const member = await prisma.member.findFirst({
        where: { id: input.memberId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      const workflow = await prisma.onboardingWorkflow.findFirst({
        where: { id: input.workflowId, churchId: member.churchId },
        include: { steps: true },
      });
      if (!workflow) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow not found' });
      }

      const onboarding = await prisma.memberOnboarding.create({
        data: {
          memberId: member.id,
          workflowId: workflow.id,
          status: OnboardingTaskStatus.PENDING,
        },
      });

      if (workflow.steps.length) {
        const now = new Date();
        await prisma.memberOnboardingTask.createMany({
          data: workflow.steps.map((step) => ({
            onboardingId: onboarding.id,
            stepId: step.id,
            status: OnboardingTaskStatus.PENDING,
            dueDate: step.dueDays != null ? new Date(now.getTime() + step.dueDays * 24 * 60 * 60 * 1000) : null,
          })),
        });
      }

      return onboarding;
    }),

  memberAssignments: protectedProcedure
    .input(z.object({ memberId: z.string() }))
    .query(async ({ input, ctx }) => {
      const member = await prisma.member.findFirst({
        where: { id: input.memberId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      return prisma.memberOnboarding.findMany({
        where: { memberId: input.memberId },
        include: { workflow: true, tasks: { include: { step: true } } },
        orderBy: { startedAt: 'desc' },
      });
    }),

  updateTask: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        status: z.nativeEnum(OnboardingTaskStatus),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const task = await prisma.memberOnboardingTask.findFirst({
        where: { id: input.taskId, onboarding: { member: { church: { organization: { tenantId: ctx.tenantId! } } } } },
      });
      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
      }

      const updated = await prisma.memberOnboardingTask.update({
        where: { id: input.taskId },
        data: {
          status: input.status,
          notes: input.notes,
          completedAt: input.status === OnboardingTaskStatus.COMPLETED ? new Date() : null,
        },
      });

      const remaining = await prisma.memberOnboardingTask.count({
        where: { onboardingId: task.onboardingId, status: OnboardingTaskStatus.PENDING },
      });

      if (remaining === 0) {
        await prisma.memberOnboarding.update({
          where: { id: task.onboardingId },
          data: { status: OnboardingTaskStatus.COMPLETED, completedAt: new Date() },
        });
      }

      return updated;
    }),
});
