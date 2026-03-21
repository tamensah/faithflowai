import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantContext } from '@/lib/tenant-context';

const paymentStatusValues = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'] as const;
const paymentMethodValues = ['CARD', 'BANK_TRANSFER', 'MOBILE_MONEY'] as const;
const CURSOR_RE = /^[a-zA-Z0-9_-]{10,36}$/;

function resolveProvider(method: (typeof paymentMethodValues)[number]): 'MANUAL' | 'STRIPE' | 'PAYSTACK' {
  if (method === 'CARD') return 'STRIPE';
  if (method === 'MOBILE_MONEY') return 'PAYSTACK';
  return 'MANUAL';
}

function toErrorResponse(error: unknown) {
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('Unauthorized') || message.startsWith('Forbidden')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const { prisma } = await import('@faithflow-ai/database');
    const statusParam = request.nextUrl.searchParams.get('status');
    const churchIdParam = request.nextUrl.searchParams.get('churchId');
    const rawCursor = request.nextUrl.searchParams.get('cursor') ?? undefined;
    const cursor = rawCursor && CURSOR_RE.test(rawCursor) ? rawCursor : undefined;
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? '50');
    const context = await resolveTenantContext();
    const status =
      statusParam && paymentStatusValues.includes(statusParam as (typeof paymentStatusValues)[number])
        ? (statusParam as (typeof paymentStatusValues)[number])
        : undefined;
    const resolvedLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;
    const churchId =
      churchIdParam && context.churchIds.includes(churchIdParam) ? churchIdParam : undefined;

    const [items, churches, totals, groupedTotals] = await Promise.all([
      prisma.donation.findMany({
        where: {
          status,
          churchId: churchId ?? { in: context.churchIds },
        },
        orderBy: { createdAt: 'desc' },
        take: resolvedLimit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          member: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          church: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      prisma.church.findMany({
        where: { id: { in: context.churchIds } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true },
      }),
      prisma.donation.groupBy({
        by: ['status'],
        where: { churchId: churchId ?? { in: context.churchIds } },
        _count: { _all: true },
      }),
      prisma.donation.groupBy({
        by: ['currency'],
        where: {
          churchId: churchId ?? { in: context.churchIds },
          status: 'COMPLETED',
        },
        _sum: { amount: true },
      }),
    ]);

    const countByStatus = new Map<string, number>();
    for (const row of totals) countByStatus.set(row.status, row._count._all);

    return NextResponse.json({
      items: items.map((donation) => ({
        id: donation.id,
        amount: Number(donation.amount),
        currency: donation.currency,
        status: donation.status,
        paymentMethod: donation.provider === 'PAYSTACK' ? 'MOBILE_MONEY' : donation.provider === 'STRIPE' ? 'CARD' : 'BANK_TRANSFER',
        reference: donation.providerRef,
        description: null,
        createdAt: donation.createdAt,
        church: donation.church,
        member: donation.member,
      })),
      nextCursor: items.length === resolvedLimit ? items[items.length - 1]?.id : undefined,
      summary: {
        totalCount: totals.reduce((sum, row) => sum + row._count._all, 0),
        completedCount: countByStatus.get('COMPLETED') ?? 0,
        refundedCount: countByStatus.get('REFUNDED') ?? 0,
        failedCount: countByStatus.get('FAILED') ?? 0,
        completedByCurrency: groupedTotals.map((row) => ({
          currency: row.currency,
          amount: Number(row._sum.amount ?? 0),
        })),
      },
      churches,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { prisma } = await import('@faithflow-ai/database');
    const payload = (await request.json()) as {
      churchId?: string;
      memberId?: string;
      amount?: number;
      currency?: string;
      paymentMethod?: 'CARD' | 'BANK_TRANSFER' | 'MOBILE_MONEY';
      reference?: string;
      status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
    };

    if (!payload.amount || !payload.reference || !payload.paymentMethod) {
      return NextResponse.json(
        { error: 'amount, reference, and paymentMethod are required' },
        { status: 400 }
      );
    }

    const context = await resolveTenantContext();
    const churchId =
      payload.churchId && context.churchIds.includes(payload.churchId)
        ? payload.churchId
        : context.defaultChurchId;
    if (!churchId) {
      return NextResponse.json(
        { error: 'No church found for this tenant. Create a church first.' },
        { status: 400 }
      );
    }

    const payment = await prisma.donation.create({
      data: {
        churchId,
        memberId: payload.memberId,
        amount: payload.amount,
        currency: (payload.currency ?? 'USD').toUpperCase(),
        status: payload.status ?? 'PENDING',
        provider: resolveProvider(payload.paymentMethod),
        providerRef: payload.reference,
      },
      include: {
        member: {
          select: { firstName: true, lastName: true, email: true },
        },
        church: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return NextResponse.json({
      payment: {
        id: payment.id,
        amount: Number(payment.amount),
        currency: payment.currency,
        status: payment.status,
        paymentMethod:
          payment.provider === 'PAYSTACK'
            ? 'MOBILE_MONEY'
            : payment.provider === 'STRIPE'
              ? 'CARD'
              : 'BANK_TRANSFER',
        reference: payment.providerRef,
        description: null,
        createdAt: payment.createdAt,
        church: payment.church,
        member: payment.member,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { prisma } = await import('@faithflow-ai/database');
    const payload = (await request.json()) as {
      action?: 'status' | 'refund';
      paymentId?: string;
      status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
    };

    if (!payload.paymentId || !payload.action) {
      return NextResponse.json({ error: 'paymentId and action are required' }, { status: 400 });
    }

    const context = await resolveTenantContext();
    const existing = await prisma.donation.findUnique({
      where: { id: payload.paymentId },
      select: { id: true, churchId: true, status: true },
    });

    if (!existing || !context.churchIds.includes(existing.churchId)) {
      return NextResponse.json({ error: 'Payment not found in tenant scope' }, { status: 404 });
    }

    const nextStatus = payload.action === 'refund' ? 'REFUNDED' : payload.status;
    if (!nextStatus) {
      return NextResponse.json({ error: 'status is required for status updates' }, { status: 400 });
    }

    const payment = await prisma.donation.update({
      where: { id: payload.paymentId },
      data: { status: nextStatus },
      include: {
        member: {
          select: { firstName: true, lastName: true, email: true },
        },
        church: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return NextResponse.json({
      payment: {
        id: payment.id,
        amount: Number(payment.amount),
        currency: payment.currency,
        status: payment.status,
        paymentMethod:
          payment.provider === 'PAYSTACK'
            ? 'MOBILE_MONEY'
            : payment.provider === 'STRIPE'
              ? 'CARD'
              : 'BANK_TRANSFER',
        reference: payment.providerRef,
        description: null,
        createdAt: payment.createdAt,
        church: payment.church,
        member: payment.member,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
