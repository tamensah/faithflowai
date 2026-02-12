'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Input } from '@faithflow-ai/ui';
import { trpc } from '../lib/trpc';
import { Shell } from '../components/Shell';

export default function AdminHome() {
  const utils = trpc.useUtils();
  const [orgName, setOrgName] = useState('');
  const [churchName, setChurchName] = useState('');
  const [churchSlug, setChurchSlug] = useState('');
  const [churchCountry, setChurchCountry] = useState('US');
  const [selectedChurchId, setSelectedChurchId] = useState<string | null>(null);
  const [updateCountry, setUpdateCountry] = useState('');
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [churchError, setChurchError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const countryRegex = /^[A-Z]{2}$/;

  const { data: organizations } = trpc.organization.list.useQuery();

  useEffect(() => {
    if (!organizationId && organizations?.length) {
      setOrganizationId(organizations[0].id);
    }
  }, [organizationId, organizations]);

  const { mutate: createOrganization, isPending: isCreatingOrg } = trpc.organization.create.useMutation({
    onSuccess: async (org) => {
      setOrgError(null);
      setOrgName('');
      setOrganizationId(org.id);
      await utils.organization.list.invalidate();
    },
  });

  const { data: churches } = trpc.church.list.useQuery({
    organizationId: organizationId ?? undefined,
  });

  useEffect(() => {
    if (!selectedChurchId && churches?.length) {
      setSelectedChurchId(churches[0].id);
      setUpdateCountry(churches[0].countryCode ?? '');
    }
  }, [selectedChurchId, churches]);

  const { mutate: createChurch, isPending: isCreatingChurch } = trpc.church.create.useMutation({
    onSuccess: async () => {
      setChurchError(null);
      setChurchName('');
      setChurchSlug('');
      setChurchCountry('US');
      await utils.church.list.invalidate();
    },
  });

  const { mutate: updateChurch, isPending: isUpdatingChurch } = trpc.church.update.useMutation({
    onSuccess: async () => {
      setUpdateError(null);
      await utils.church.list.invalidate();
    },
  });

  const selectedOrg = organizationId ?? organizations?.[0]?.id ?? null;

  return (
    <Shell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Admin Console</h1>
          <p className="mt-2 text-muted">
            Create your organization and churches to start managing members and events.
          </p>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Organizations</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {organizations?.map((org) => (
              <button
                key={org.id}
                className={`rounded-md border px-3 py-2 text-sm ${
                  (organizationId ?? organizations?.[0]?.id) === org.id
                    ? 'border-primary text-primary'
                    : 'border-border text-muted'
                }`}
                onClick={() => setOrganizationId(org.id)}
                type="button"
              >
                {org.name}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Organization name *</label>
              <Input
                placeholder="Organization name"
                value={orgName}
                onChange={(event) => {
                  setOrgError(null);
                  setOrgName(event.target.value);
                }}
              />
            </div>
            <Button
              onClick={() => {
                if (!orgName.trim()) {
                  setOrgError('Organization name is required.');
                  return;
                }
                createOrganization({ name: orgName.trim() });
              }}
              disabled={!orgName || isCreatingOrg}
            >
              {isCreatingOrg ? 'Creating…' : 'Create organization'}
            </Button>
          </div>
          {orgError ? <p className="mt-2 text-xs text-destructive">{orgError}</p> : null}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Churches</h2>
          <p className="mt-1 text-sm text-muted">
            Select an organization to see and create its churches.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            {churches?.map((church) => (
              <button
                key={church.id}
                className={`rounded-md border px-3 py-2 text-sm ${
                  (selectedChurchId ?? churches?.[0]?.id) === church.id
                    ? 'border-primary text-primary'
                    : 'border-border text-muted'
                }`}
                onClick={() => {
                  setSelectedChurchId(church.id);
                  setUpdateCountry(church.countryCode ?? '');
                }}
                type="button"
              >
                {church.name}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-5">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Church name *</label>
              <Input
                placeholder="Church name"
                value={churchName}
                onChange={(event) => {
                  setChurchError(null);
                  setChurchName(event.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Slug *</label>
              <Input
                placeholder="faith-center-main"
                value={churchSlug}
                onChange={(event) => {
                  setChurchError(null);
                  setChurchSlug(event.target.value.toLowerCase().replace(/\s+/g, '-'));
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Country (ISO 2) *</label>
              <Input
                placeholder="US"
                value={churchCountry}
                onChange={(event) => {
                  setChurchError(null);
                  setChurchCountry(event.target.value.toUpperCase());
                }}
              />
            </div>
            <Button
              onClick={() => {
                const name = churchName.trim();
                const slug = churchSlug.trim();
                const country = churchCountry.trim().toUpperCase();
                if (!name || !slug || !selectedOrg) {
                  setChurchError('Church name, slug, and organization are required.');
                  return;
                }
                if (!slugRegex.test(slug)) {
                  setChurchError('Slug must use lowercase letters, numbers, and hyphens only.');
                  return;
                }
                if (country && !countryRegex.test(country)) {
                  setChurchError('Country must be a valid 2-letter ISO code.');
                  return;
                }
                createChurch({
                  name,
                  slug,
                  organizationId: selectedOrg,
                  countryCode: country || undefined,
                });
              }}
              disabled={!churchName || !churchSlug || !selectedOrg || isCreatingChurch}
            >
              {isCreatingChurch ? 'Creating…' : 'Create church'}
            </Button>
          </div>
          {churchError ? <p className="mt-2 text-xs text-destructive">{churchError}</p> : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Update country (ISO 2) *</label>
              <Input
                placeholder="US"
                value={updateCountry}
                onChange={(event) => {
                  setUpdateError(null);
                  setUpdateCountry(event.target.value.toUpperCase());
                }}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                const country = updateCountry.trim().toUpperCase();
                if (!selectedChurchId) {
                  setUpdateError('Select a church first.');
                  return;
                }
                if (country && !countryRegex.test(country)) {
                  setUpdateError('Country must be a valid 2-letter ISO code.');
                  return;
                }
                updateChurch({
                  id: selectedChurchId,
                  countryCode: country || undefined,
                });
              }}
              disabled={!selectedChurchId || isUpdatingChurch}
            >
              {isUpdatingChurch ? 'Updating…' : 'Update country'}
            </Button>
          </div>
          {updateError ? <p className="mt-2 text-xs text-destructive">{updateError}</p> : null}
        </Card>
      </div>
    </Shell>
  );
}
