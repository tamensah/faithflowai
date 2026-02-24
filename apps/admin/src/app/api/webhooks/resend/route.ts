import { NextRequest, NextResponse } from 'next/server';
import {
	handleResendWebhook,
	WebhookValidationError,
} from '../../../../../../api/src/reliability/provider-webhooks';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
	try {
		const rawBody = await request.text();
		const result = await handleResendWebhook(rawBody, request.headers);
		return NextResponse.json({ ok: true, provider: 'resend', result });
	} catch (error) {
		if (error instanceof WebhookValidationError) {
			return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
		}
		const message = error instanceof Error ? error.message : 'Resend webhook processing failed.';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
