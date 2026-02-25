import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@faithflow/database';
import { createAppCaller } from '@/lib/app-caller';

const paymentStatusValues = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'] as const;

export async function GET(request: NextRequest) {
	const statusParam = request.nextUrl.searchParams.get('status');
	const churchId = request.nextUrl.searchParams.get('churchId') ?? undefined;
	const addonCode = request.nextUrl.searchParams.get('addonCode') ?? undefined;
	const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined;
	const limit = Number(request.nextUrl.searchParams.get('limit') ?? '50');

	try {
		const { caller, actor } = await createAppCaller();
		const organizationId = actor.organizationId;
		const status =
			statusParam && paymentStatusValues.includes(statusParam as (typeof paymentStatusValues)[number])
				? (statusParam as (typeof paymentStatusValues)[number])
				: undefined;

		const [list, summary, churches] = await Promise.all([
			caller.payment.list({
				organizationId,
				churchId,
				status,
				addonCode,
				limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50,
				cursor,
			}),
			caller.payment.summary({ organizationId, churchId, addonCode }),
			prisma.church.findMany({
				where: { organizationId },
				orderBy: { name: 'asc' },
				select: { id: true, name: true, slug: true },
			}),
		]);

		return NextResponse.json({
			...list,
			summary,
			churches,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		const status = message.startsWith('Unauthorized') ? 401 : 403;
		return NextResponse.json({ error: message }, { status });
	}
}

export async function POST(request: NextRequest) {
	const payload = (await request.json()) as {
		idempotencyKey?: string;
		churchId?: string;
		memberId?: string;
		amount?: number;
		currency?: string;
		paymentMethod?: 'CARD' | 'BANK_TRANSFER' | 'MOBILE_MONEY';
		reference?: string;
		description?: string;
		status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
		metadata?: Record<string, unknown>;
	};

	if (!payload.amount || !payload.reference || !payload.paymentMethod) {
		return NextResponse.json(
			{
				error: 'amount, reference, and paymentMethod are required',
			},
			{ status: 400 }
		);
	}

	try {
		const { caller, actor } = await createAppCaller();
		const organizationId = actor.organizationId;
		const churchId =
			payload.churchId ??
			(
				await prisma.church.findFirst({
					where: { organizationId },
					orderBy: { createdAt: 'asc' },
					select: { id: true },
				})
			)?.id;

		if (!churchId) {
			return NextResponse.json(
				{ error: 'No church found in this organization. Create a church first.' },
				{ status: 400 }
			);
		}

		const payment = await caller.payment.create({
			organizationId,
			idempotencyKey: payload.idempotencyKey ?? request.headers.get('x-idempotency-key') ?? undefined,
			churchId,
			memberId: payload.memberId,
			amount: payload.amount,
			currency: payload.currency ?? 'USD',
			paymentMethod: payload.paymentMethod,
			reference: payload.reference,
			description: payload.description,
			status: payload.status ?? 'PENDING',
			metadata: payload.metadata,
		});

		return NextResponse.json({ payment });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 403 });
	}
}

export async function PATCH(request: NextRequest) {
	const payload = (await request.json()) as {
		idempotencyKey?: string;
		action?: 'status' | 'refund';
		paymentId?: string;
		status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
		reason?: string;
		metadata?: Record<string, unknown>;
	};

	if (!payload.paymentId || !payload.action) {
		return NextResponse.json({ error: 'paymentId and action are required' }, { status: 400 });
	}

	try {
		const { caller, actor } = await createAppCaller();
		const organizationId = actor.organizationId;
		const idempotencyKey = payload.idempotencyKey ?? request.headers.get('x-idempotency-key') ?? undefined;

		if (payload.action === 'refund') {
			if (!payload.reason) {
				return NextResponse.json({ error: 'reason is required for refunds' }, { status: 400 });
			}

			const payment = await caller.payment.refund({
				organizationId,
				idempotencyKey,
				paymentId: payload.paymentId,
				reason: payload.reason,
				metadata: payload.metadata,
			});
			return NextResponse.json({ payment });
		}

		if (!payload.status) {
			return NextResponse.json({ error: 'status is required for status updates' }, { status: 400 });
		}

		const payment = await caller.payment.updateStatus({
			organizationId,
			idempotencyKey,
			paymentId: payload.paymentId,
			status: payload.status,
			metadata: payload.metadata,
		});
		return NextResponse.json({ payment });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: message }, { status: 403 });
	}
}
