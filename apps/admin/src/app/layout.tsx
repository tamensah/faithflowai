import type { Metadata } from 'next';
import { Sora, Source_Sans_3 } from 'next/font/google';
import '../styles/globals.css';
import { ClerkProvider } from '@clerk/nextjs';
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
            <AdminGate>{children}</AdminGate>
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
