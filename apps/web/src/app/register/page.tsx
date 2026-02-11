'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Input, Badge } from '@faithflow-ai/ui';
import { trpc } from '../../lib/trpc';

export default function RegistrationPage() {
  const { data: churches } = trpc.church.publicList.useQuery({ limit: 20 });
  const [churchId, setChurchId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!churchId && churches?.length) {
      setChurchId(churches[0].id);
    }
  }, [churchId, churches]);

  const { mutate: startRegistration, isPending } = trpc.registration.start.useMutation({
    onSuccess: (data) => {
      setResult(data);
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <Card className="p-6">
        <h1 className="text-2xl font-semibold">Join FaithFlow</h1>
        <p className="mt-2 text-sm text-muted">Register your membership and verify your email.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <select
            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
            value={churchId}
            onChange={(e) => setChurchId(e.target.value)}
          >
            <option value="">Select church</option>
            {churches?.map((church) => (
              <option key={church.id} value={church.id}>
                {church.name}
              </option>
            ))}
          </select>
          <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="mt-4">
          <Button
            onClick={() =>
              startRegistration({
                churchId,
                firstName,
                lastName,
                email,
                phone: phone || undefined,
              })
            }
            disabled={!churchId || !firstName || !lastName || !email || isPending}
          >
            {isPending ? 'Submitting…' : 'Submit registration'}
          </Button>
        </div>
      </Card>

      {result ? (
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Verification</h2>
            <Badge variant="default">{result.delivery}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted">Check your email to verify your membership.</p>
          {result.verificationLink ? (
            <p className="mt-2 text-sm text-muted">
              Manual link (dev):{' '}
              <a className="text-primary underline" href={result.verificationLink}>
                Verify membership
              </a>
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
