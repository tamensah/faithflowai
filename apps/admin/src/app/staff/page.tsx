'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { trpc } from '../../lib/trpc';

const roleOptions = ['ADMIN', 'STAFF'] as const;

export default function StaffPage() {
  const utils = trpc.useUtils();
  const { data: churches } = trpc.church.list.useQuery({ organizationId: undefined });
  const { data: staff } = trpc.staff.list.useQuery({ churchId: undefined });
  const { data: invites } = trpc.staff.listInvites.useQuery({ status: 'PENDING' });
  const [churchId, setChurchId] = useState('');
  const [clerkUserId, setClerkUserId] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<typeof roleOptions[number]>('STAFF');
  const [inviteChurchId, setInviteChurchId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<typeof roleOptions[number]>('STAFF');
  const [staffFormError, setStaffFormError] = useState<string | null>(null);
  const [inviteFormError, setInviteFormError] = useState<string | null>(null);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  useEffect(() => {
    if (!churchId && churches?.length) {
      setChurchId(churches[0].id);
    }
  }, [churchId, churches]);

  useEffect(() => {
    if (!inviteChurchId && churches?.length) {
      setInviteChurchId(churches[0].id);
    }
  }, [inviteChurchId, churches]);

  const { mutate: upsertStaff, isPending } = trpc.staff.upsert.useMutation({
    onSuccess: async () => {
      setStaffFormError(null);
      setClerkUserId('');
      setEmail('');
      setName('');
      setRole('STAFF');
      await utils.staff.list.invalidate();
    },
  });

  const { mutate: updateRole } = trpc.staff.updateRole.useMutation({
    onSuccess: async () => {
      await utils.staff.list.invalidate();
    },
  });

  const { mutate: removeStaff } = trpc.staff.remove.useMutation({
    onSuccess: async () => {
      await utils.staff.list.invalidate();
    },
  });

  const { mutate: inviteStaff, isPending: isInviting } = trpc.staff.invite.useMutation({
    onSuccess: async () => {
      setInviteFormError(null);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('STAFF');
      await utils.staff.listInvites.invalidate();
    },
  });

  const { mutate: cancelInvite } = trpc.staff.cancelInvite.useMutation({
    onSuccess: async () => {
      await utils.staff.listInvites.invalidate();
    },
  });

  const groupedStaff = useMemo(() => {
    const map = new Map<string, typeof staff>();
    for (const entry of staff ?? []) {
      const key = entry.churchId;
      const group = map.get(key) ?? [];
      group.push(entry);
      map.set(key, group);
    }
    return Array.from(map.entries());
  }, [staff]);

  return (
    <Shell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Staff access</h1>
          <p className="mt-2 text-sm text-muted">
            Grant admin or staff roles. You need the user’s Clerk user ID to enable access.
          </p>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Add staff member</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Clerk user ID *</label>
              <Input
                placeholder="user_..."
                value={clerkUserId}
                onChange={(e) => {
                  setStaffFormError(null);
                  setClerkUserId(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Email *</label>
              <Input
                placeholder="staff@example.org"
                value={email}
                onChange={(e) => {
                  setStaffFormError(null);
                  setEmail(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Name (optional)</label>
              <Input placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof roleOptions[number])}
            >
              {roleOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
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
          </div>
          <div className="mt-4">
            <Button
              onClick={() => {
                const trimmedEmail = email.trim().toLowerCase();
                const trimmedClerkUserId = clerkUserId.trim();
                if (!trimmedClerkUserId || !trimmedEmail || !churchId) {
                  setStaffFormError('Clerk user ID, email, and church are required.');
                  return;
                }
                if (!emailRegex.test(trimmedEmail)) {
                  setStaffFormError('Enter a valid email address.');
                  return;
                }
                upsertStaff({
                  clerkUserId: trimmedClerkUserId,
                  email: trimmedEmail,
                  name: name.trim() || undefined,
                  churchId,
                  role,
                });
              }}
              disabled={!clerkUserId.trim() || !email.trim() || !churchId || isPending}
            >
              {isPending ? 'Saving…' : 'Grant access'}
            </Button>
            {staffFormError ? <p className="mt-2 text-xs text-destructive">{staffFormError}</p> : null}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Invite staff (Clerk)</h2>
          <p className="mt-1 text-sm text-muted">
            Sends a Clerk organization invite and auto‑links staff access after acceptance.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Invitee email *</label>
              <Input
                placeholder="invitee@example.org"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteFormError(null);
                  setInviteEmail(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Name (optional)</label>
              <Input
                placeholder="Name (optional)"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as typeof roleOptions[number])}
            >
              {roleOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={inviteChurchId}
              onChange={(e) => setInviteChurchId(e.target.value)}
            >
              <option value="">Select church</option>
              {churches?.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4">
            <Button
              onClick={() => {
                const trimmedEmail = inviteEmail.trim().toLowerCase();
                if (!trimmedEmail || !inviteChurchId) {
                  setInviteFormError('Invite email and church are required.');
                  return;
                }
                if (!emailRegex.test(trimmedEmail)) {
                  setInviteFormError('Enter a valid email address.');
                  return;
                }
                inviteStaff({
                  email: trimmedEmail,
                  name: inviteName.trim() || undefined,
                  churchId: inviteChurchId,
                  role: inviteRole,
                });
              }}
              disabled={!inviteEmail.trim() || !inviteChurchId || isInviting}
            >
              {isInviting ? 'Sending…' : 'Send invite'}
            </Button>
            {inviteFormError ? <p className="mt-2 text-xs text-destructive">{inviteFormError}</p> : null}
          </div>
          <div className="mt-6 space-y-2 text-sm text-muted">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase text-muted">Pending invites</p>
              <Badge variant="default">{invites?.length ?? 0}</Badge>
            </div>
            {invites?.map((invite) => (
              <div key={invite.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{invite.email}</p>
                    <p className="text-xs text-muted">
                      {invite.church?.name ?? 'Church'} · {invite.role}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{invite.status}</Badge>
                    <Button size="sm" variant="outline" onClick={() => cancelInvite({ id: invite.id })}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {!invites?.length && <p className="text-sm text-muted">No pending invites.</p>}
          </div>
        </Card>

        <div className="space-y-4">
          {groupedStaff.map(([church, entries]) => {
            const churchName = churches?.find((item) => item.id === church)?.name ?? 'Church';
            return (
              <Card key={church} className="p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{churchName}</h2>
                  <Badge variant="default">{entries?.length ?? 0} staff</Badge>
                </div>
                <div className="mt-4 space-y-3 text-sm text-muted">
                  {entries?.map((entry) => (
                    <div key={entry.id} className="rounded-md border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-foreground">
                            {entry.user?.name ?? entry.user?.email ?? entry.userId}
                          </p>
                          <p className="text-xs text-muted">{entry.user?.email ?? 'No email'}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            className="h-9 rounded-md border border-border bg-white px-2 text-sm"
                            value={entry.role}
                            onChange={(e) =>
                              updateRole({ id: entry.id, role: e.target.value as typeof roleOptions[number] })
                            }
                          >
                            {roleOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          <Button size="sm" variant="outline" onClick={() => removeStaff({ id: entry.id })}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!entries?.length && <p className="text-sm text-muted">No staff yet.</p>}
                </div>
              </Card>
            );
          })}
          {!groupedStaff.length ? (
            <Card className="p-6">
              <p className="text-sm text-muted">No staff memberships yet.</p>
            </Card>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}
