import assert from 'node:assert/strict';
import test from 'node:test';
import { TRPCError } from '@trpc/server';
import { appRouter } from '@faithflow-ai/api';
import { createContext } from '../../src/context';
import { assertAllowedCheckoutRedirects } from '../../../../packages/api/src/checkout-redirects';
import { createReceiptAccessToken, renderReceiptHtml, verifyReceiptAccessToken } from '../../../../packages/api/src/receipts';
import { createStreamAccessToken, verifyStreamAccessToken } from '../../../../packages/api/src/stream-auth';

test('createContext ignores forged identity headers without a verified token', async () => {
  const ctx = await createContext({
    req: {
      headers: {
        'x-user-id': 'clerk_forged_user',
        'x-clerk-org-id': 'org_forged_org',
      },
    },
  });

  assert.equal(ctx.userId, null);
  assert.equal(ctx.clerkOrgId, null);
  assert.equal(ctx.tenantId, null);
});

test('platform bootstrap is disabled in production without an explicit allowlist', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAllowlist = process.env.PLATFORM_ADMIN_EMAILS;

  process.env.NODE_ENV = 'production';
  process.env.PLATFORM_ADMIN_EMAILS = '';

  try {
    const caller = appRouter.createCaller({
      userId: 'clerk_prod_bootstrap_tester',
      clerkOrgId: null,
      tenantId: null,
      tenantStatus: null,
      requestIp: '127.0.0.1',
      requestOrigin: 'https://admin.example.com',
      authSignals: null,
    });

    await assert.rejects(
      () => caller.platform.bootstrap({ email: 'bootstrap@example.com' }),
      (error: unknown) =>
        error instanceof Error && error.message.includes('Not allowed to bootstrap platform access')
    );
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.PLATFORM_ADMIN_EMAILS = originalAllowlist;
  }
});

test('checkout redirects are restricted to trusted origins', () => {
  assert.doesNotThrow(() => {
    assertAllowedCheckoutRedirects(
      { successUrl: 'https://preview.faithflow.local/billing', cancelUrl: 'https://preview.faithflow.local/cancel' },
      'https://preview.faithflow.local'
    );
  });

  assert.throws(
    () => {
      assertAllowedCheckoutRedirects(
        { successUrl: 'https://evil.example/steal', cancelUrl: 'https://evil.example/cancel' },
        'https://preview.faithflow.local'
      );
    },
    (error: unknown) =>
      error instanceof TRPCError &&
      error.code === 'BAD_REQUEST' &&
      error.message.includes('allowed FaithFlow domain')
  );
});

test('receipt access tokens are signed and scoped to the requested receipt', () => {
  const originalSecret = process.env.RECEIPT_PUBLIC_SECRET;
  process.env.RECEIPT_PUBLIC_SECRET = 'receipt-test-secret';

  try {
    const token = createReceiptAccessToken('FF-20260401-ABC123', 60);
    assert.ok(token);
    assert.equal(verifyReceiptAccessToken(token!, 'FF-20260401-ABC123').ok, true);
    assert.equal(verifyReceiptAccessToken(token!, 'FF-20260401-OTHER').ok, false);
  } finally {
    process.env.RECEIPT_PUBLIC_SECRET = originalSecret;
  }
});

test('public receipt html escapes donor and church fields and omits sensitive metadata', () => {
  const html = renderReceiptHtml({
    id: 'receipt_1',
    donationId: 'donation_1',
    churchId: 'church_1',
    receiptNumber: 'FF-20260401-XYZ999',
    status: 'ISSUED',
    issuedAt: new Date('2026-04-01T10:00:00.000Z'),
    voidedAt: null,
    metadata: {
      donorEmail: 'hidden@example.com',
      donorPhone: '+233555000000',
      providerRef: 'pi_secret',
    },
    donation: {
      id: 'donation_1',
      churchId: 'church_1',
      memberId: null,
      fundId: null,
      campaignId: null,
      fundraiserPageId: null,
      amount: { toString: () => '250' },
      currency: 'USD',
      provider: 'STRIPE',
      providerRef: 'pi_secret',
      status: 'SUCCEEDED',
      donorName: '<script>alert(1)</script>',
      donorEmail: 'hidden@example.com',
      donorPhone: '+233555000000',
      isAnonymous: false,
      note: null,
      metadata: null,
      createdAt: new Date('2026-04-01T09:00:00.000Z'),
      updatedAt: new Date('2026-04-01T09:00:00.000Z'),
      pledgeId: null,
      recurringDonationId: null,
      paymentIntentId: null,
      receiptSentAt: null,
      receiptSendStatus: null,
    },
    church: {
      id: 'church_1',
      organizationId: 'org_1',
      name: 'FaithFlow <Main>',
      slug: 'faithflow-main',
      countryCode: 'GH',
      timezone: 'Africa/Accra',
      settings: null,
      createdAt: new Date('2026-04-01T09:00:00.000Z'),
      updatedAt: new Date('2026-04-01T09:00:00.000Z'),
      primaryCurrency: 'USD',
    },
  } as never);

  assert.match(html, /FaithFlow &lt;Main&gt; Donation Receipt/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /hidden@example\.com/);
  assert.doesNotMatch(html, /\+233555000000/);
  assert.doesNotMatch(html, /pi_secret/);
});

test('stream access tokens are signed and short-lived', () => {
  const originalSecret = process.env.STREAM_SIGNING_SECRET;
  process.env.STREAM_SIGNING_SECRET = 'stream-test-secret';

  try {
    const token = createStreamAccessToken({ userId: 'user_1', orgId: 'org_1', expSeconds: 60 });
    assert.ok(token);
    const verified = verifyStreamAccessToken(token!);
    assert.equal(verified.ok, true);
    if (verified.ok) {
      assert.equal(verified.payload.sub, 'user_1');
      assert.equal(verified.payload.orgId, 'org_1');
    }
  } finally {
    process.env.STREAM_SIGNING_SECRET = originalSecret;
  }
});
