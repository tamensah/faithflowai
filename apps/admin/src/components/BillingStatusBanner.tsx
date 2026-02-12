'use client';

import Link from 'next/link';
import { Button } from '@faithflow-ai/ui';
import { trpc } from '../lib/trpc';

function daysLeft(value?: string | Date | null) {
  if (!value) return null;
  const end = typeof value === 'string' ? new Date(value) : value;
  const diffMs = end.getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

export function BillingStatusBanner() {
  const { data: current } = trpc.billing.currentSubscription.useQuery(undefined, {
    retry: false,
  });
  const { data: entitlements } = trpc.billing.entitlements.useQuery(undefined, {
    retry: false,
  });

  if (entitlements?.entitlements?.source === 'inactive_subscription') {
    return (
      <div className="border-b border-destructive/20 bg-destructive/5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="text-sm">
            <span className="font-semibold text-foreground">Subscription inactive.</span>{' '}
            <span className="text-muted">Choose a plan to restore access.</span>
          </div>
          <Link href="/billing">
            <Button size="sm">Open billing</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!current) return null;

  if (current.status === 'TRIALING') {
    const left = daysLeft(current.trialEndsAt);
    if (left !== null && left <= 3) {
      return (
        <div className="border-b border-accent/30 bg-accent/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
            <div className="text-sm">
              <span className="font-semibold text-foreground">Trial ending soon.</span>{' '}
              <span className="text-muted">
                {left} day{left === 1 ? '' : 's'} left.
              </span>
            </div>
            <Link href="/billing">
              <Button size="sm" variant="outline">
                Choose plan
              </Button>
            </Link>
          </div>
        </div>
      );
    }
  }

  if (current.status === 'PAST_DUE') {
    return (
      <div className="border-b border-destructive/20 bg-destructive/5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="text-sm">
            <span className="font-semibold text-foreground">Payment issue.</span>{' '}
            <span className="text-muted">Update billing to avoid service suspension.</span>
          </div>
          <Link href="/billing">
            <Button size="sm">Manage billing</Button>
          </Link>
        </div>
      </div>
    );
  }

  return null;
}

