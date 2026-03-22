'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { trpc } from '../lib/trpc';

function resolveTrpcUrl() {
  const raw = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/trpc').trim();
  const normalized = raw.replace(/\/+$/, '');
  return normalized.endsWith('/trpc') ? normalized : `${normalized}/trpc`;
}

function TrpcProvider({ children }: { children: React.ReactNode }) {
  const { getToken, orgId } = useAuth();
  const tokenTemplate = process.env.NEXT_PUBLIC_CLERK_JWT_TEMPLATE;
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: 1,
          },
        },
      })
  );
  const trpcClient = useMemo(
    () =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: resolveTrpcUrl(),
          transformer: superjson,
          headers: async () => {
            let token: string | null = null;
            try {
              token = await getToken(tokenTemplate ? { template: tokenTemplate } : undefined);
            } catch {
              // getToken throws in Core 3 when offline or session is invalid
            }
            const headers: Record<string, string> = {};
            if (token) headers.Authorization = `Bearer ${token}`;
            if (orgId) {
              headers['x-clerk-org-id'] = orgId;
              headers['x-tenant-id'] = orgId;
            }
            return headers;
          },
        }),
      ],
    }),
    [getToken, orgId, tokenTemplate]
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
