import Link from 'next/link';
import { ClerkProvider, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { SiteNav } from '../../components/site-nav';
import { SiteFooter } from '../../components/site-footer';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 py-2">
          <Link className="shrink-0 text-sm font-semibold" href="/">
            FaithFlow AI
          </Link>

          <SiteNav />

          {/* Header auth CTAs — standard SaaS pattern */}
          <div className="hidden items-center gap-2 md:flex">
            <SignedOut>
              <Link
                href="/sign-in"
                className="text-sm text-muted transition-colors hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/get-started"
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Get started
              </Link>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </header>

      {children}

      <SiteFooter />
    </>
  );
}
