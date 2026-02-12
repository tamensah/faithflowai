'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, Card, Input } from '@faithflow-ai/ui';

type Status = 'idle' | 'sending' | 'sent' | 'error';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function ContactPage() {
  const [status, setStatus] = useState<Status>('idle');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [trap] = useState(''); // Honeypot (do not render visibly).

  const errors = useMemo(() => {
    const next: string[] = [];
    if (!name.trim()) next.push('Name is required.');
    if (!email.trim()) next.push('Email is required.');
    if (email.trim() && !isValidEmail(email)) next.push('Email looks invalid.');
    if (!message.trim()) next.push('Message is required.');
    return next;
  }, [email, message, name]);

  const canSend = status !== 'sending' && errors.length === 0;

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-10">
      <Badge variant="default">Contact</Badge>
      <h1 className="mt-4 text-4xl font-semibold">Talk to the team.</h1>
      <p className="mt-3 text-sm text-muted">
        For beta access, onboarding support, or enterprise setup, send a note and we will follow up.
      </p>

      <Card className="mt-8 border-border bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-foreground">Name</p>
            <Input className="mt-2" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Email</p>
            <Input
              className="mt-2"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@church.org"
              type="email"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-foreground">Organization (optional)</p>
            <Input
              className="mt-2"
              value={organization}
              onChange={(event) => setOrganization(event.target.value)}
              placeholder="Church / ministry name"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Phone (optional)</p>
            <Input
              className="mt-2"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+1 555 0100"
            />
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-foreground">Message</p>
          <textarea
            className="mt-2 min-h-[140px] w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Tell us what you want to accomplish (membership, finance, events, comms, migrations, etc)."
          />
        </div>

        {errors.length ? (
          <div className="mt-4 rounded-md border border-border bg-muted/10 p-3 text-xs text-muted">
            {errors.map((entry) => (
              <p key={entry}>• {entry}</p>
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            disabled={!canSend}
            onClick={async () => {
              setServerError(null);
              setStatus('sending');
              try {
                const res = await fetch('/api/contact', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({
                    name,
                    email,
                    organization,
                    phone,
                    message,
                    website: trap,
                  }),
                });
                const data = (await res.json()) as { ok: boolean; errors?: string[] };
                if (!res.ok || !data.ok) {
                  setStatus('error');
                  setServerError(data.errors?.[0] ?? 'Could not send message.');
                  return;
                }

                setStatus('sent');
              } catch {
                setStatus('error');
                setServerError('Could not send message.');
              }
            }}
          >
            {status === 'sending' ? 'Sending...' : 'Send message'}
          </Button>
          {status === 'sent' ? <p className="text-xs text-emerald-700">Message sent. We will reply soon.</p> : null}
        </div>

        {status === 'error' ? <p className="mt-3 text-xs text-destructive">{serverError ?? 'Could not send message.'}</p> : null}
      </Card>
    </main>
  );
}
