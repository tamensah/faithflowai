import { initTRPC } from '@trpc/server';
import { TRPCError } from '@trpc/server';
import type { PolicyActor } from './security/policy';

type TrpcContext = {
	actor?: PolicyActor | null;
};

const t = initTRPC.context<TrpcContext>().create({
	// Keep transformer default to avoid runtime dependency coupling in this app package.
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

const requireActor = middleware(({ ctx, next }) => {
	if (!ctx.actor) {
		throw new TRPCError({
			code: 'UNAUTHORIZED',
			message: 'Authenticated actor context is required.',
		});
	}

	return next({
		ctx: {
			...ctx,
			actor: ctx.actor,
		},
	});
});

export const protectedProcedure = t.procedure.use(requireActor);
export type AppContext = TrpcContext;
