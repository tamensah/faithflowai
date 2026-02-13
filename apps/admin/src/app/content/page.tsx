'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { trpc } from '../../lib/trpc';
import { useFeatureGate } from '../../lib/entitlements';
import { FeatureLocked } from '../../components/FeatureLocked';
import { ReadOnlyNotice } from '../../components/ReadOnlyNotice';

const sermonStatusOptions = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
const resourceTypeOptions = ['DOCUMENT', 'VIDEO', 'AUDIO', 'LINK', 'IMAGE', 'OTHER'] as const;
const resourceVisibilityOptions = ['PUBLIC', 'MEMBERS_ONLY', 'LEADERS_ONLY', 'PRIVATE'] as const;

export default function ContentPage() {
  const gate = useFeatureGate('content_library_enabled');
  const utils = trpc.useUtils();
  const canWrite = gate.canWrite;
  const [churchId, setChurchId] = useState('');
  const [campusId, setCampusId] = useState('');

  const [sermonTitle, setSermonTitle] = useState('');
  const [sermonSpeaker, setSermonSpeaker] = useState('');
  const [sermonSeries, setSermonSeries] = useState('');
  const [sermonSummary, setSermonSummary] = useState('');
  const [sermonStatus, setSermonStatus] = useState<typeof sermonStatusOptions[number]>('DRAFT');

  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceDescription, setResourceDescription] = useState('');
  const [resourceType, setResourceType] = useState<typeof resourceTypeOptions[number]>('DOCUMENT');
  const [resourceVisibility, setResourceVisibility] =
    useState<typeof resourceVisibilityOptions[number]>('MEMBERS_ONLY');
  const [resourceLink, setResourceLink] = useState('');
  const [resourceTags, setResourceTags] = useState('');
  const [resourceFeatured, setResourceFeatured] = useState(false);

  const { data: churches } = trpc.church.list.useQuery({});
  const { data: campuses } = trpc.campus.list.useQuery({ churchId: churchId || undefined });

  useEffect(() => {
    if (!churchId && churches?.length) {
      setChurchId(churches[0].id);
    }
  }, [churchId, churches]);

  const sermonListInput = useMemo(
    () => ({
      churchId: churchId || undefined,
      campusId: campusId || undefined,
      limit: 100,
    }),
    [churchId, campusId]
  );
  const resourceListInput = useMemo(
    () => ({
      churchId: churchId || undefined,
      campusId: campusId || undefined,
      limit: 100,
    }),
    [churchId, campusId]
  );

  const { data: sermons } = trpc.content.listSermons.useQuery(sermonListInput, { enabled: Boolean(churchId) });
  const { data: resources } = trpc.content.listResources.useQuery(resourceListInput, { enabled: Boolean(churchId) });
  const { data: analytics } = trpc.content.analytics.useQuery(
    { churchId: churchId || undefined, campusId: campusId || undefined },
    { enabled: Boolean(churchId) }
  );

  const { mutate: createSermon, isPending: isCreatingSermon } = trpc.content.createSermon.useMutation({
    onSuccess: async () => {
      setSermonTitle('');
      setSermonSpeaker('');
      setSermonSeries('');
      setSermonSummary('');
      setSermonStatus('DRAFT');
      await Promise.all([utils.content.listSermons.invalidate(), utils.content.analytics.invalidate()]);
    },
  });

  const { mutate: publishSermon } = trpc.content.publishSermon.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.content.listSermons.invalidate(), utils.content.analytics.invalidate()]);
    },
  });

  const { mutate: createResource, isPending: isCreatingResource } = trpc.content.createResource.useMutation({
    onSuccess: async () => {
      setResourceTitle('');
      setResourceDescription('');
      setResourceType('DOCUMENT');
      setResourceVisibility('MEMBERS_ONLY');
      setResourceLink('');
      setResourceTags('');
      setResourceFeatured(false);
      await Promise.all([utils.content.listResources.invalidate(), utils.content.analytics.invalidate()]);
    },
  });

  return (
    <Shell>
      {!gate.isLoading && gate.access === 'locked' ? (
        <FeatureLocked
          featureKey="content_library_enabled"
          title="Content library is locked"
          description="Your current subscription does not include the content library. Upgrade to restore access."
        />
      ) : (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Sermons & Content Library</h1>
          <p className="mt-2 text-sm text-muted">Publish sermons and resources with campus-aware visibility controls.</p>
        </div>

        {gate.readOnly ? <ReadOnlyNotice /> : null}

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Scope</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={churchId}
              onChange={(event) => {
                setChurchId(event.target.value);
                setCampusId('');
              }}
            >
              <option value="">Select church</option>
              {churches?.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={campusId}
              onChange={(event) => setCampusId(event.target.value)}
            >
              <option value="">All campuses</option>
              {campuses?.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-muted sm:grid-cols-2 lg:grid-cols-4">
            <p>Sermons: {sermons?.length ?? 0}</p>
            <p>Resources: {resources?.length ?? 0}</p>
            <p>Featured resources: {analytics?.featuredResources ?? 0}</p>
            <p>Total sermon views: {analytics?.totalSermonViews ?? 0}</p>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Create Sermon</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input placeholder="Title" value={sermonTitle} onChange={(event) => setSermonTitle(event.target.value)} />
            <Input placeholder="Speaker" value={sermonSpeaker} onChange={(event) => setSermonSpeaker(event.target.value)} />
            <Input placeholder="Series name" value={sermonSeries} onChange={(event) => setSermonSeries(event.target.value)} />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={sermonStatus}
              onChange={(event) => setSermonStatus(event.target.value as typeof sermonStatusOptions[number])}
            >
              {sermonStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <Input
              className="sm:col-span-2"
              placeholder="Summary"
              value={sermonSummary}
              onChange={(event) => setSermonSummary(event.target.value)}
            />
          </div>
          <div className="mt-4">
            <Button
              disabled={!canWrite || !churchId || !sermonTitle.trim() || isCreatingSermon}
              onClick={() =>
                createSermon({
                  churchId,
                  campusId: campusId || undefined,
                  title: sermonTitle.trim(),
                  speaker: sermonSpeaker.trim() || undefined,
                  seriesName: sermonSeries.trim() || undefined,
                  summary: sermonSummary.trim() || undefined,
                  status: sermonStatus,
                })
              }
            >
              {isCreatingSermon ? 'Creating...' : 'Create sermon'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Create Resource</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input placeholder="Title" value={resourceTitle} onChange={(event) => setResourceTitle(event.target.value)} />
            <Input
              placeholder="Description"
              value={resourceDescription}
              onChange={(event) => setResourceDescription(event.target.value)}
            />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={resourceType}
              onChange={(event) => setResourceType(event.target.value as typeof resourceTypeOptions[number])}
            >
              {resourceTypeOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={resourceVisibility}
              onChange={(event) =>
                setResourceVisibility(event.target.value as typeof resourceVisibilityOptions[number])
              }
            >
              {resourceVisibilityOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <Input
              placeholder="Link URL (optional)"
              value={resourceLink}
              onChange={(event) => setResourceLink(event.target.value)}
            />
            <Input
              placeholder="Tags (comma separated)"
              value={resourceTags}
              onChange={(event) => setResourceTags(event.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
              <input
                type="checkbox"
                checked={resourceFeatured}
                disabled={!canWrite}
                onChange={(event) => setResourceFeatured(event.target.checked)}
              />
              Feature this resource
            </label>
          </div>
          <div className="mt-4">
            <Button
              disabled={!canWrite || !churchId || !resourceTitle.trim() || isCreatingResource}
              onClick={() =>
                createResource({
                  churchId,
                  campusId: campusId || undefined,
                  title: resourceTitle.trim(),
                  description: resourceDescription.trim() || undefined,
                  type: resourceType,
                  visibility: resourceVisibility,
                  linkUrl: resourceLink.trim() || undefined,
                  tags: resourceTags
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                  isFeatured: resourceFeatured,
                })
              }
            >
              {isCreatingResource ? 'Creating...' : 'Create resource'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Sermons</h2>
          <div className="mt-4 space-y-3">
            {sermons?.map((sermon) => (
              <div key={sermon.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{sermon.title}</p>
                    <p className="text-xs text-muted">
                      {sermon.speaker || 'No speaker'} · {sermon.status} · Views {sermon.viewCount}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canWrite}
                    onClick={() => publishSermon({ id: sermon.id, published: sermon.status !== 'PUBLISHED' })}
                  >
                    {sermon.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                  </Button>
                </div>
              </div>
            ))}
            {!sermons?.length ? <p className="text-sm text-muted">No sermons yet.</p> : null}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Resources</h2>
          <div className="mt-4 space-y-3">
            {resources?.map((resource) => (
              <div key={resource.id} className="rounded-md border border-border p-3">
                <p className="text-sm font-semibold">{resource.title}</p>
                <p className="text-xs text-muted">
                  {resource.type} · {resource.visibility}
                  {resource.isFeatured ? ' · featured' : ''}
                </p>
              </div>
            ))}
            {!resources?.length ? <p className="text-sm text-muted">No resources yet.</p> : null}
          </div>
        </Card>
      </div>
      )}
    </Shell>
  );
}
