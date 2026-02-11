'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { trpc } from '../lib/trpc';

function TrpcProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const tokenTemplate = process.env.NEXT_PUBLIC_CLERK_JWT_TEMPLATE;
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/trpc',
          transformer: superjson,
          headers: async () => {
            const token = await getToken(tokenTemplate ? { template: tokenTemplate } : undefined);
            return token ? { Authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return <TrpcProvider>{children}</TrpcProvider>;
}
