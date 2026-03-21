import type { Metadata } from 'next';
import Link from 'next/link';
import { Sora, Source_Sans_3 } from 'next/font/google';
import '../styles/globals.css';
import { ClerkProvider, SignedIn, UserButton } from '@clerk/nextjs';
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
        <ClerkProvider
          localization={{
            signIn: { start: { title: 'Sign in to FaithFlow AI' } },
            signUp: { start: { title: 'Create your FaithFlow AI account' } },
          }}
        >
          <Providers>
            <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
              <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 py-2">
                <Link className="text-sm font-semibold" href="/">
                  FaithFlow AI
                </Link>
                <SiteNav />
                {/* Show user avatar when signed in — sign-in CTAs live in SiteNav */}
                <SignedIn>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
              </div>
            </header>
            {children}
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
