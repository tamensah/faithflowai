import { NextRequest, NextResponse } from 'next/server';
import {
	handleTwilioWebhook,
	WebhookValidationError,
} from '../../../../../../api/src/reliability/provider-webhooks';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
	try {
		const rawBody = await request.text();
		const result = await handleTwilioWebhook(
			rawBody,
			request.nextUrl.toString(),
			request.headers.get('x-twilio-signature')
		);
		return NextResponse.json({ ok: true, provider: 'twilio', result });
	} catch (error) {
		if (error instanceof WebhookValidationError) {
			return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
		}
		const message = error instanceof Error ? error.message : 'Twilio webhook processing failed.';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
