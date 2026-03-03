import { router } from '../trpc';
import { orgRouter } from './org';

export const orgAppRouter = router({
	org: orgRouter,
});
