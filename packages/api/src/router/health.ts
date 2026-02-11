import { publicProcedure, router } from '../trpc';

export const healthRouter = router({
  status: publicProcedure.query(() => ({ ok: true, timestamp: new Date().toISOString() })),
});
