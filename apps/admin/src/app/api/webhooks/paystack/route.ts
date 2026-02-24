import { NextRequest, NextResponse } from 'next/server';
import {
	handlePaystackWebhook,
	WebhookValidationError,
} from '../../../../../../api/src/reliability/provider-webhooks';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
	try {
		const rawBody = await request.text();
		const result = await handlePaystackWebhook(rawBody, request.headers.get('x-paystack-signature'));
		return NextResponse.json({ ok: true, provider: 'paystack', result });
	} catch (error) {
		if (error instanceof WebhookValidationError) {
			return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
		}
		const message = error instanceof Error ? error.message : 'Paystack webhook processing failed.';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
