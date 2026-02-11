import cron, { type ScheduledTask } from 'node-cron';
import { runSubscriptionMetadataBackfill, runSupportSlaAutomation, runTenantDomainAutomation } from '@faithflow-ai/api';
import type { FastifyBaseLogger } from 'fastify';
import { env } from './env';

function isTruthy(value?: string | null) {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

type SchedulerHandle = {
  stop: () => void;
  enabled: boolean;
};

export function startInternalSchedulers(log: FastifyBaseLogger): SchedulerHandle {
  if (!isTruthy(env.ENABLE_INTERNAL_SCHEDULER)) {
    log.info('Internal scheduler disabled');
    return {
      enabled: false,
      stop: () => undefined,
    };
  }

  const timezone = env.SCHEDULER_TIMEZONE;
  const tasks: ScheduledTask[] = [];
  const register = (name: string, expression: string, runner: () => Promise<unknown>) => {
    const task = cron.schedule(
      expression,
      async () => {
        const startedAt = Date.now();
        try {
          const result = await runner();
          log.info({ schedulerJob: name, durationMs: Date.now() - startedAt, result }, 'Scheduler job completed');
        } catch (error) {
          log.error(
            { schedulerJob: name, durationMs: Date.now() - startedAt, error },
            'Scheduler job failed'
          );
        }
      },
      {
        timezone,
      }
    );
    tasks.push(task);
    log.info({ schedulerJob: name, expression, timezone }, 'Scheduler job registered');
  };

  register('subscription-metadata-backfill', env.CRON_SUBSCRIPTION_METADATA_BACKFILL, () =>
    runSubscriptionMetadataBackfill({ limit: 500, dryRun: false })
  );
  register('tenant-ops-automation', env.CRON_TENANT_OPS_AUTOMATE, () =>
    runTenantDomainAutomation({ limit: 500, dryRun: false })
  );
  register('support-sla-sweep', env.CRON_SUPPORT_SLA_SWEEP, () =>
    runSupportSlaAutomation({ limit: 1000, dryRun: false })
  );

  return {
    enabled: true,
    stop: () => {
      for (const task of tasks) {
        task.stop();
        task.destroy();
      }
      log.info('Internal scheduler stopped');
    },
  };
}
