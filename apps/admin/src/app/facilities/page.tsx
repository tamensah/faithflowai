'use client';

import { useMemo, useState } from 'react';
import { Button, Card, Input } from '@faithflow-ai/ui';
import { Shell } from '../../components/Shell';
import { trpc } from '../../lib/trpc';
import { useFeatureGate } from '../../lib/entitlements';
import { FeatureLocked } from '../../components/FeatureLocked';

function toDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default function FacilitiesPage() {
  const gate = useFeatureGate('facility_management_enabled');
  const utils = trpc.useUtils();
  const now = new Date();
  const [churchId, setChurchId] = useState('');
  const [campusId, setCampusId] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [facilityType, setFacilityType] = useState('OTHER');
  const [facilityLocation, setFacilityLocation] = useState('');
  const [facilityCapacity, setFacilityCapacity] = useState('');

  const [bookingFacilityId, setBookingFacilityId] = useState('');
  const [bookingTitle, setBookingTitle] = useState('');
  const [bookingStartAt, setBookingStartAt] = useState('');
  const [bookingEndAt, setBookingEndAt] = useState('');

  const [utilFrom, setUtilFrom] = useState(toDateInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [utilTo, setUtilTo] = useState(toDateInput(now));

  const { data: churches } = trpc.church.list.useQuery({});
  const { data: campuses } = trpc.campus.list.useQuery({ churchId: churchId || undefined });
  const { data: facilities } = trpc.facility.list.useQuery({ churchId: churchId || undefined, campusId: campusId || undefined });
  const { data: bookings } = trpc.facility.listBookings.useQuery({
    churchId: churchId || undefined,
    campusId: campusId || undefined,
    limit: 100,
  });
  const utilizationInput = useMemo(
    () => ({
      churchId: churchId || undefined,
      campusId: campusId || undefined,
      from: new Date(`${utilFrom}T00:00:00.000Z`),
      to: new Date(`${utilTo}T23:59:59.999Z`),
    }),
    [churchId, campusId, utilFrom, utilTo]
  );
  const { data: utilization } = trpc.facility.utilization.useQuery(utilizationInput);

  const { mutate: createFacility, isPending: isCreatingFacility } = trpc.facility.create.useMutation({
    onSuccess: async () => {
      setFacilityName('');
      setFacilityLocation('');
      setFacilityCapacity('');
      await Promise.all([utils.facility.list.invalidate(), utils.facility.utilization.invalidate()]);
    },
  });

  const { mutate: createBooking, isPending: isCreatingBooking } = trpc.facility.createBooking.useMutation({
    onSuccess: async () => {
      setBookingTitle('');
      setBookingStartAt('');
      setBookingEndAt('');
      await Promise.all([utils.facility.listBookings.invalidate(), utils.facility.utilization.invalidate()]);
    },
  });

  return (
    <Shell>
      {!gate.isLoading && !gate.enabled ? (
        <FeatureLocked
          featureKey="facility_management_enabled"
          title="Facilities are locked"
          description="Your current subscription does not include facility management. Upgrade to restore access."
        />
      ) : (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Facilities & Scheduling</h1>
          <p className="mt-2 text-sm text-muted">Manage facility inventory, booking conflicts, and utilization across campuses.</p>
        </div>

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
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Create Facility</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input placeholder="Facility name" value={facilityName} onChange={(event) => setFacilityName(event.target.value)} />
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={facilityType}
              onChange={(event) => setFacilityType(event.target.value)}
            >
              <option value="SANCTUARY">SANCTUARY</option>
              <option value="CLASSROOM">CLASSROOM</option>
              <option value="OFFICE">OFFICE</option>
              <option value="HALL">HALL</option>
              <option value="OUTDOOR">OUTDOOR</option>
              <option value="OTHER">OTHER</option>
            </select>
            <Input placeholder="Location" value={facilityLocation} onChange={(event) => setFacilityLocation(event.target.value)} />
            <Input
              placeholder="Capacity"
              type="number"
              value={facilityCapacity}
              onChange={(event) => setFacilityCapacity(event.target.value)}
            />
          </div>
          <div className="mt-4">
            <Button
              onClick={() =>
                createFacility({
                  churchId,
                  campusId: campusId || undefined,
                  name: facilityName.trim(),
                  type: facilityType as any,
                  location: facilityLocation || undefined,
                  capacity: facilityCapacity ? Number(facilityCapacity) : undefined,
                })
              }
              disabled={!churchId || !facilityName.trim() || isCreatingFacility}
            >
              {isCreatingFacility ? 'Creating...' : 'Create facility'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Book Facility</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={bookingFacilityId}
              onChange={(event) => setBookingFacilityId(event.target.value)}
            >
              <option value="">Select facility</option>
              {facilities?.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
            <Input placeholder="Booking title" value={bookingTitle} onChange={(event) => setBookingTitle(event.target.value)} />
            <Input type="datetime-local" value={bookingStartAt} onChange={(event) => setBookingStartAt(event.target.value)} />
            <Input type="datetime-local" value={bookingEndAt} onChange={(event) => setBookingEndAt(event.target.value)} />
          </div>
          <div className="mt-4">
            <Button
              onClick={() =>
                createBooking({
                  churchId,
                  facilityId: bookingFacilityId,
                  title: bookingTitle.trim(),
                  startAt: new Date(bookingStartAt),
                  endAt: new Date(bookingEndAt),
                })
              }
              disabled={!churchId || !bookingFacilityId || !bookingTitle.trim() || !bookingStartAt || !bookingEndAt || isCreatingBooking}
            >
              {isCreatingBooking ? 'Booking...' : 'Create booking'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Utilization</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input type="date" value={utilFrom} onChange={(event) => setUtilFrom(event.target.value)} />
            <Input type="date" value={utilTo} onChange={(event) => setUtilTo(event.target.value)} />
          </div>
          <div className="mt-4 space-y-3">
            {utilization?.facilities.map((row) => (
              <div key={row.facilityId} className="rounded-md border border-border p-3">
                <p className="text-sm font-semibold">{row.facilityName}</p>
                <p className="text-xs text-muted">
                  Booked {row.bookedHours.toFixed(1)}h / window {row.totalWindowHours.toFixed(1)}h ({(row.utilizationRate * 100).toFixed(1)}%)
                </p>
              </div>
            ))}
            {!utilization?.facilities.length ? <p className="text-sm text-muted">No utilization data for selected range.</p> : null}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Upcoming Bookings</h2>
          <div className="mt-4 space-y-3">
            {bookings?.map((booking) => (
              <div key={booking.id} className="rounded-md border border-border p-3">
                <p className="text-sm font-semibold">{booking.title}</p>
                <p className="text-xs text-muted">
                  {booking.facility.name} · {new Date(booking.startAt).toLocaleString()} to {new Date(booking.endAt).toLocaleString()} · {booking.status}
                </p>
              </div>
            ))}
            {!bookings?.length ? <p className="text-sm text-muted">No bookings found.</p> : null}
          </div>
        </Card>
      </div>
      )}
    </Shell>
  );
}
