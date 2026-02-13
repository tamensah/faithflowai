'use client';

import Link from 'next/link';
import { Button, Card } from '@faithflow-ai/ui';

export function FeatureLocked({
  featureKey,
  title,
  description,
}: {
  featureKey: string;
  title: string;
  description: string;
}) {
  const href = `/billing?upgrade=1&feature=${encodeURIComponent(featureKey)}`;

  return (
    <Card className="border-destructive/20 bg-white p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted">{description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={href}>
          <Button>Upgrade to unlock</Button>
        </Link>
        <Link href="/billing">
          <Button variant="outline">Open billing</Button>
        </Link>
      </div>
      <p className="mt-3 text-xs text-muted">Feature key: {featureKey}</p>
    </Card>
  );
}
