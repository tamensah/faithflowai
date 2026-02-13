'use client';

import Link from 'next/link';
import { Button, Card } from '@faithflow-ai/ui';

export function ReadOnlyNotice() {
  return (
    <Card className="border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-amber-900">Read-only mode</div>
          <div className="mt-1 text-sm text-amber-900/80">
            Your subscription is inactive. You can view data, but edits are disabled until billing is updated.
          </div>
        </div>
        <Link href="/billing">
          <Button size="sm">Update billing</Button>
        </Link>
      </div>
    </Card>
  );
}

