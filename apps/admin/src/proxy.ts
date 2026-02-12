import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher(['/sign-in(.*)']);

const baseMiddleware = clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    auth.protect();
  }
});

function isHandshakeVerificationError(error: unknown) {
  return error instanceof Error && error.message.includes('Handshake token verification failed');
}

export default async function proxy(req: NextRequest, event: NextFetchEvent) {
  try {
    return await baseMiddleware(req, event);
  } catch (error) {
    if (req.nextUrl.searchParams.has('__clerk_handshake') && isHandshakeVerificationError(error)) {
      const url = req.nextUrl.clone();
      url.searchParams.delete('__clerk_handshake');
      return NextResponse.redirect(url);
    }
    throw error;
  }
}

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
