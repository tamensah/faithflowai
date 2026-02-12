import type { Metadata } from 'next';
import Link from 'next/link';
import { Sora, Source_Sans_3 } from 'next/font/google';
import '../styles/globals.css';
import {
  ClerkProvider,
  OrganizationSwitcher,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs';
import { Providers } from './providers';
import { SiteNav } from '../components/site-nav';

const sora = Sora({ subsets: ['latin'], variable: '--font-sora' });
const sourceSans = Source_Sans_3({ subsets: ['latin'], variable: '--font-source-sans' });

export const metadata: Metadata = {
  title: 'FaithFlow AI',
  description: 'AI-powered church management platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${sourceSans.variable}`}>
      <body className="font-sans">
        <ClerkProvider>
          <Providers>
            <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
              <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 py-2">
                <Link className="text-sm font-semibold" href="/">
                  FaithFlow AI
                </Link>
                <SiteNav />
                <div className="flex items-center gap-2">
                  <SignedOut>
                    <SignInButton mode="modal">
                      <button className="rounded-md border border-border px-3 py-1.5 text-sm">Sign in</button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <button className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
                        Sign up
                      </button>
                    </SignUpButton>
                  </SignedOut>
                  <SignedIn>
                    <OrganizationSwitcher
                      hidePersonal
                      afterSelectOrganizationUrl="/portal"
                      afterCreateOrganizationUrl="/portal"
                    />
                    <UserButton />
                  </SignedIn>
                </div>
              </div>
            </header>
            {children}
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
