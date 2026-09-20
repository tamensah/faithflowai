import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import {
  runStreamingProviderSync,
  runSubscriptionMetadataBackfill,
  runSupportSlaAutomation,
  runTenantDomainAutomation,
  subscribeRealtime,
  verifyStreamAccessToken,
} from '@faithflow-ai/api';
import { buildServer } from './server';
import { provisionTenant } from './context';

const serverPromise: Promise<FastifyInstance> = buildServer();
const encoder = new TextEncoder();

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(body, { status, headers });
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!origin || !allowedOrigins.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

async function handleStream(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('streamToken');
  if (!token) return json({ error: 'Unauthorized' }, 401);

  const verified = verifyStreamAccessToken(token);
  if (!verified.ok) return json({ error: 'Unauthorized' }, 401);

  const tenant = await provisionTenant(verified.payload.orgId);
  const cors = corsHeaders(request);
  let close: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const write = (value: string) => {
        if (!closed) controller.enqueue(encoder.encode(value));
      };
      const unsubscribe = subscribeRealtime((event) => {
        if (event.data.tenantId !== tenant.tenantId) return;
        write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
      });
      const heartbeat = setInterval(() => {
        write(`event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
      }, 15_000);

      close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // The client may already have closed the stream.
        }
      };

      request.signal.addEventListener('abort', close, { once: true });
      write(`event: connected\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
    },
    cancel() {
      close?.();
    },
  });

  return new Response(stream, {
    headers: {
      ...cors,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

async function handleScheduledTrigger(request: Request, pathname: string) {
  if (!request.headers.get('x-neon-trigger-invocation-id')) {
    return json({ error: 'Forbidden' }, 403);
  }

  const payload = (await request.json().catch(() => ({}))) as {
    data?: { scheduled_at?: string };
  };
  let result: unknown;

  switch (pathname) {
    case '/__triggers/support-sla':
      result = await runSupportSlaAutomation({ limit: 1000, dryRun: false });
      break;
    case '/__triggers/tenant-ops':
      result = await runTenantDomainAutomation({ limit: 500, dryRun: false });
      break;
    case '/__triggers/subscription-metadata':
      result = await runSubscriptionMetadataBackfill({ limit: 500, dryRun: false });
      break;
    case '/__triggers/streaming-sync':
      result = await runStreamingProviderSync({
        limit: 200,
        dryRun: false,
        applySuggestedTransitions: true,
      });
      break;
    default:
      return json({ error: 'Not found' }, 404);
  }

  console.info('Scheduled trigger completed', {
    pathname,
    scheduledAt: payload.data?.scheduled_at ?? null,
  });

  return json({
    ok: true,
    scheduledAt: payload.data?.scheduled_at ?? null,
    result,
  });
}

async function injectFastify(request: Request) {
  const server = await serverPromise;
  const url = new URL(request.url);
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const payload = hasBody ? Buffer.from(await request.arrayBuffer()) : undefined;
  const injection: InjectOptions = {
    method: request.method as InjectOptions['method'],
    url: `${url.pathname}${url.search}`,
    headers,
    payload,
  };
  const remoteAddress = headers['x-forwarded-for']?.split(',')[0]?.trim();
  if (remoteAddress) injection.remoteAddress = remoteAddress;

  const response: LightMyRequestResponse = await server.inject(injection);

  const responseHeaders = new Headers();
  for (const [key, value] of Object.entries(response.headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) responseHeaders.append(key, entry);
    } else if (value !== undefined) {
      responseHeaders.set(key, String(value));
    }
  }

  const responseBody = new Uint8Array(response.rawPayload.byteLength);
  responseBody.set(response.rawPayload);
  const bodyForbidden =
    request.method === 'HEAD' ||
    response.statusCode === 204 ||
    response.statusCode === 205 ||
    response.statusCode === 304;
  if (bodyForbidden) responseHeaders.delete('content-length');

  return new Response(bodyForbidden ? null : responseBody, {
    status: response.statusCode,
    headers: responseHeaders,
  });
}

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/stream') {
      return handleStream(request);
    }

    if (request.method === 'POST' && url.pathname.startsWith('/__triggers/')) {
      try {
        return await handleScheduledTrigger(request, url.pathname);
      } catch (error) {
        console.error('Scheduled trigger failed', error);
        return json({ error: 'Scheduled trigger failed' }, 500);
      }
    }

    return injectFastify(request);
  },
};
