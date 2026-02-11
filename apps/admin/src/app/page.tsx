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

  const { data: organizations } = trpc.organization.list.useQuery();

  useEffect(() => {
    if (!organizationId && organizations?.length) {
      setOrganizationId(organizations[0].id);
    }
  }, [organizationId, organizations]);

  const { mutate: createOrganization, isPending: isCreatingOrg } = trpc.organization.create.useMutation({
    onSuccess: async (org) => {
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
      setChurchName('');
      setChurchSlug('');
      setChurchCountry('US');
      await utils.church.list.invalidate();
    },
  });

  const { mutate: updateChurch, isPending: isUpdatingChurch } = trpc.church.update.useMutation({
    onSuccess: async () => {
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
            <Input
              placeholder="Organization name"
              value={orgName}
              onChange={(event) => setOrgName(event.target.value)}
            />
            <Button
              onClick={() => createOrganization({ name: orgName })}
              disabled={!orgName || isCreatingOrg}
            >
              {isCreatingOrg ? 'Creating…' : 'Create organization'}
            </Button>
          </div>
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
            <Input
              placeholder="Church name"
              value={churchName}
              onChange={(event) => setChurchName(event.target.value)}
            />
            <Input
              placeholder="Slug"
              value={churchSlug}
              onChange={(event) => setChurchSlug(event.target.value)}
            />
            <Input
              placeholder="Country (ISO 2)"
              value={churchCountry}
              onChange={(event) => setChurchCountry(event.target.value.toUpperCase())}
            />
            <Button
              onClick={() =>
                createChurch({
                  name: churchName,
                  slug: churchSlug,
                  organizationId: selectedOrg ?? '',
                  countryCode: churchCountry || undefined,
                })
              }
              disabled={!churchName || !churchSlug || !selectedOrg || isCreatingChurch}
            >
              {isCreatingChurch ? 'Creating…' : 'Create church'}
            </Button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              placeholder="Update country (ISO 2)"
              value={updateCountry}
              onChange={(event) => setUpdateCountry(event.target.value.toUpperCase())}
            />
            <Button
              variant="outline"
              onClick={() =>
                updateChurch({
                  id: selectedChurchId ?? '',
                  countryCode: updateCountry || undefined,
                })
              }
              disabled={!selectedChurchId || isUpdatingChurch}
            >
              {isUpdatingChurch ? 'Updating…' : 'Update country'}
            </Button>
          </div>
        </Card>
      </div>
    </Shell>
  );
}
