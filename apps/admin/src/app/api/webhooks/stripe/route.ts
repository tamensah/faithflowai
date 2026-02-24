import { NextRequest, NextResponse } from 'next/server';
import {
	handleStripeWebhook,
	WebhookValidationError,
} from '../../../../../../api/src/reliability/provider-webhooks';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
	try {
		const rawBody = await request.text();
		const result = await handleStripeWebhook(rawBody, request.headers.get('stripe-signature'));
		return NextResponse.json({ ok: true, provider: 'stripe', result });
	} catch (error) {
		if (error instanceof WebhookValidationError) {
			return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
		}
		const message = error instanceof Error ? error.message : 'Stripe webhook processing failed.';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
