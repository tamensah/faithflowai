import assert from 'node:assert/strict';
import test from 'node:test';

process.env.DATABASE_URL ??= 'postgresql://faithflow:faithflow@127.0.0.1:5432/faithflow';
process.env.ALLOWED_ORIGINS = 'https://faithflow.example';

const handlerPromise = import('../../src/neon-function').then((module) => module.default);

test('Neon adapter serves Fastify routes', async () => {
  const handler = await handlerPromise;
  const response = await handler.fetch(new Request('https://api.example/health'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
});

test('Neon scheduled routes reject ordinary public calls', async () => {
  const handler = await handlerPromise;
  const response = await handler.fetch(
    new Request('https://api.example/__triggers/support-sla', {
      method: 'POST',
      body: '{}',
    })
  );
  assert.equal(response.status, 403);
});

test('Neon adapter preserves empty CORS preflight responses', async () => {
  const handler = await handlerPromise;
  const response = await handler.fetch(
    new Request('https://api.example/health', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://faithflow.example',
        'access-control-request-method': 'GET',
      },
    })
  );
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://faithflow.example');
  assert.equal(await response.text(), '');
});
