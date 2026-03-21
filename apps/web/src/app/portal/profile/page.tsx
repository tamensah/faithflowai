'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Input } from '@faithflow-ai/ui';
import { trpc } from '../../../lib/trpc';

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return '—';
  return (typeof value === 'string' ? new Date(value) : value).toLocaleString();
};

export default function ProfilePage() {
  const utils = trpc.useUtils();
  const { data: selfProfile } = trpc.member.selfProfile.useQuery(undefined, { retry: false });
  const canEditProfile = Boolean(selfProfile?.member);

  const [preferredName, setPreferredName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
  const [directoryVisibility, setDirectoryVisibility] = useState('MEMBERS_ONLY');
  const [showEmail, setShowEmail] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [showPhoto, setShowPhoto] = useState(true);

  useEffect(() => {
    if (selfProfile?.member) {
      setPreferredName(selfProfile.member.preferredName ?? '');
      setPhone(selfProfile.member.phone ?? '');
      setAddressLine1(selfProfile.member.addressLine1 ?? '');
      setAddressLine2(selfProfile.member.addressLine2 ?? '');
      setCity(selfProfile.member.city ?? '');
      setState(selfProfile.member.state ?? '');
      setPostalCode(selfProfile.member.postalCode ?? '');
      setCountry(selfProfile.member.country ?? '');
      setDirectoryVisibility(selfProfile.member.directoryVisibility ?? 'MEMBERS_ONLY');
      setShowEmail(Boolean(selfProfile.member.showEmailInDirectory));
      setShowPhone(Boolean(selfProfile.member.showPhoneInDirectory));
      setShowAddress(Boolean(selfProfile.member.showAddressInDirectory));
      setShowPhoto(Boolean(selfProfile.member.showPhotoInDirectory));
    }
  }, [selfProfile]);

  const { mutate: updateProfile } = trpc.member.selfUpdate.useMutation({
    onSuccess: async () => {
      await utils.member.selfProfile.invalidate();
    },
  });

  return (
    <div className="space-y-6">
      {/* Engagement metrics */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Engagement</p>
          <p className="mt-2 text-2xl font-semibold">{selfProfile?.engagementScore?.score ?? 0}</p>
          <p className="mt-1 text-xs text-muted">Last seen: {formatDateTime(selfProfile?.attendance?.lastSeenAt)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Attendance</p>
          <p className="mt-2 text-2xl font-semibold">{selfProfile?.attendance?.count ?? 0}</p>
          <p className="mt-1 text-xs text-muted">Recent 90 days</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Giving</p>
          <div className="mt-2 space-y-1 text-sm">
            {(selfProfile?.giving?.totals ?? []).map((total) => (
              <div key={total.currency} className="flex items-center justify-between">
                <span className="text-muted">{total.currency}</span>
                <span className="font-semibold">{total.totalAmount?.toString() ?? '0'}</span>
              </div>
            ))}
            {!selfProfile?.giving?.totals?.length ? <p className="text-xs text-muted">No giving yet.</p> : null}
          </div>
        </Card>
      </div>

      {/* Profile form */}
      <Card className="p-4 sm:p-6">
        <h2 className="text-base font-semibold">Personal information</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input placeholder="Preferred name" value={preferredName} onChange={(e) => setPreferredName(e.target.value)} />
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="Address line 1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
          <Input placeholder="Address line 2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
          <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
          <Input placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
          <Input placeholder="Postal code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
          <Input placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
        </div>
        <div className="mt-4">
          <Button
            onClick={() =>
              updateProfile({
                preferredName: preferredName || undefined,
                phone: phone || undefined,
                addressLine1: addressLine1 || undefined,
                addressLine2: addressLine2 || undefined,
                city: city || undefined,
                state: state || undefined,
                postalCode: postalCode || undefined,
                country: country || undefined,
              })
            }
            disabled={!canEditProfile}
          >
            Save profile
          </Button>
          {!canEditProfile ? (
            <p className="mt-2 text-xs text-muted">
              Profile editing unlocks after your Clerk account is linked to a member record.
            </p>
          ) : null}
        </div>
      </Card>

      {/* Directory privacy */}
      <Card className="p-4 sm:p-6">
        <h2 className="text-base font-semibold">Directory privacy</h2>
        <p className="mt-1 text-sm text-muted">Control how you appear in the church directory.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <select
            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
            value={directoryVisibility}
            onChange={(e) => setDirectoryVisibility(e.target.value)}
          >
            <option value="PUBLIC">Public</option>
            <option value="MEMBERS_ONLY">Members only</option>
            <option value="LEADERS_ONLY">Leaders only</option>
            <option value="PRIVATE">Private</option>
          </select>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showEmail} onChange={(e) => setShowEmail(e.target.checked)} />
              Show email
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showPhone} onChange={(e) => setShowPhone(e.target.checked)} />
              Show phone
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showAddress} onChange={(e) => setShowAddress(e.target.checked)} />
              Show address
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showPhoto} onChange={(e) => setShowPhoto(e.target.checked)} />
              Show photo
            </label>
          </div>
        </div>
        <div className="mt-4">
          <Button
            onClick={() =>
              updateProfile({
                directoryVisibility: directoryVisibility as any,
                showEmailInDirectory: showEmail,
                showPhoneInDirectory: showPhone,
                showAddressInDirectory: showAddress,
                showPhotoInDirectory: showPhoto,
              })
            }
            disabled={!canEditProfile}
          >
            Update privacy
          </Button>
        </div>
      </Card>
    </div>
  );
}
