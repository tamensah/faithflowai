import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@faithflow-ai/api';

export const trpc = createTRPCReact<AppRouter>();
