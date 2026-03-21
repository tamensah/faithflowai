import { clerkMiddleware } from '@clerk/nextjs/server';

// Web app is fully public (marketing site + portal).
// Portal gating is handled in the portal layout component.
export default clerkMiddleware();

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
