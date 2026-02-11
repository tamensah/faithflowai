'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, Badge, Button } from '@faithflow-ai/ui';
import { trpc } from '../../../lib/trpc';

export default function VerifyRegistrationPage() {
  const searchParams = useSearchParams();
  const registrationId = searchParams.get('registrationId') ?? '';
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'idle' | 'verifying' | 'verified' | 'error'>('idle');
  const [error, setError] = useState<string>('');

  const { mutate: verify } = trpc.registration.verify.useMutation({
    onSuccess: () => {
      setStatus('verified');
    },
    onError: (err) => {
      setStatus('error');
      setError(err.message);
    },
  });

  useEffect(() => {
    if (!registrationId || !token) return;
    setStatus('verifying');
    verify({ registrationId, token });
  }, [registrationId, token, verify]);

  return (
    <div className="mx-auto max-w-xl space-y-6 p-8">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Membership verification</h1>
          <Badge variant="default">{status}</Badge>
        </div>
        {status === 'verifying' && <p className="mt-3 text-sm text-muted">Verifying your membership...</p>}
        {status === 'verified' && (
          <p className="mt-3 text-sm text-muted">You are verified. You can now sign in to the member portal.</p>
        )}
        {status === 'error' && (
          <div className="mt-3 text-sm text-muted">
            <p>Verification failed: {error}</p>
            <Button className="mt-3" onClick={() => verify({ registrationId, token })}>
              Retry
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
