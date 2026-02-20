import { orgAppRouter } from '../../../api/src/router/org-app';
import { getActorFromClerk } from './server-actor';

export async function createOrgCaller() {
	const actor = await getActorFromClerk();
	return {
		actor,
		caller: orgAppRouter.createCaller({ actor }),
	};
}
