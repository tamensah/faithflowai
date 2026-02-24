import { router } from '../trpc';
import { churchRouter } from './church';
import { memberRouter } from './member';
import { eventRouter } from './event';
import { groupRouter } from './group';
import { analyticsRouter } from './analytics';
import { orgRouter } from './org';
import { paymentRouter } from './payment';
import { commsRouter } from './comms';
import { outboxRouter } from './outbox';

export const appRouter = router({
  church: churchRouter,
  member: memberRouter,
  event: eventRouter,
  group: groupRouter,
  analytics: analyticsRouter,
  org: orgRouter,
  payment: paymentRouter,
  comms: commsRouter,
  outbox: outboxRouter,
});

export type AppRouter = typeof appRouter;
