import { clerkMiddleware } from '@clerk/nextjs/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const baseMiddleware = clerkMiddleware();

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
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
