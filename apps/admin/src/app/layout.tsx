import type { Metadata } from 'next';
import { Sora, Source_Sans_3 } from 'next/font/google';
import '../styles/globals.css';
import { ClerkProvider, OrganizationSwitcher, SignedIn, UserButton } from '@clerk/nextjs';
import { Providers } from './providers';
import { AdminGate } from '../components/AdminGate';

const sora = Sora({ subsets: ['latin'], variable: '--font-sora' });
const sourceSans = Source_Sans_3({ subsets: ['latin'], variable: '--font-source-sans' });

export const metadata: Metadata = {
  title: 'FaithFlow AI Admin',
  description: 'Administrative console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${sourceSans.variable}`}>
      <body className="font-sans">
        <ClerkProvider>
          <Providers>
            <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
              <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
                <p className="text-sm font-semibold">FaithFlow AI Admin</p>
                <SignedIn>
                  <div className="flex items-center gap-2">
                    <OrganizationSwitcher
                      hidePersonal
                      afterSelectOrganizationUrl="/"
                      afterCreateOrganizationUrl="/"
                    />
                    <UserButton />
                  </div>
                </SignedIn>
              </div>
            </header>
            <AdminGate>{children}</AdminGate>
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
