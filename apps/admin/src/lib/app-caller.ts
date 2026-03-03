import { appRouter } from '../../../api/src/router';
import { getActorFromClerk } from './server-actor';

export async function createAppCaller() {
	const actor = await getActorFromClerk();
	return {
		actor,
		caller: appRouter.createCaller({ actor }),
	};
}
