'use client';

import { useMemo, useState } from 'react';
import { setMemberStepComplete } from '../../../components/member-portal/member-progress';
import {
  MemberPortalShell,
  MemberSectionCard,
  PROFILE_SECTION_LINKS,
  PRIVACY_ACTION_BUTTON,
} from '../../../components/member-portal/member-portal-shell';

type ProfileState = {
  preferredName: string;
  phone: string;
  country: string;
  city: string;
};

const REQUIRED_FIELDS: Array<keyof ProfileState> = ['preferredName', 'phone', 'country'];

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileState>({
    preferredName: '',
    phone: '',
    country: '',
    city: '',
  });
  const [touched, setTouched] = useState(false);
  const [notifications, setNotifications] = useState({
    app: true,
    email: true,
    sms: false,
    whatsapp: false,
  });
  const [identitySaved, setIdentitySaved] = useState(false);
  const [privacySaved, setPrivacySaved] = useState(false);

  const missingFields = useMemo(
    () => REQUIRED_FIELDS.filter((field) => profile[field].trim().length === 0),
    [profile]
  );

  const isValid = missingFields.length === 0;

  return (
    <MemberPortalShell
      title="Profile and privacy controls"
      description="Keep your member profile complete so staff can schedule you correctly and communicate through your preferred channels."
      sectionLinks={PROFILE_SECTION_LINKS}
      actions={PRIVACY_ACTION_BUTTON}
    >
      <MemberSectionCard
        id="identity"
        title="Identity details"
        description="Required fields are marked and validation feedback appears before submission."
      >
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            setTouched(true);
            if (!isValid) return;
            setMemberStepComplete('identity', true);
            setIdentitySaved(true);
          }}
          onChange={() => setTouched(true)}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Preferred name *</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                value={profile.preferredName}
                onChange={(event) =>
                  setProfile((current) => ({ ...current, preferredName: event.target.value }))
                }
                placeholder="Preferred name"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Phone *</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                value={profile.phone}
                onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))}
                placeholder="+1 (000) 000-0000"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">City</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                value={profile.city}
                onChange={(event) => setProfile((current) => ({ ...current, city: event.target.value }))}
                placeholder="City"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Country *</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                value={profile.country}
                onChange={(event) =>
                  setProfile((current) => ({ ...current, country: event.target.value }))
                }
                placeholder="Country"
              />
            </label>
          </div>

          {touched && !isValid ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Fill required fields: {missingFields.join(', ')}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!isValid}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Save profile
          </button>
          {identitySaved ? <p className="text-sm text-emerald-700">Saved. Identity step completed.</p> : null}
        </form>
      </MemberSectionCard>

      <MemberSectionCard
        id="privacy"
        title="Directory privacy"
        description="Control which profile details are visible in the church directory."
      >
        <div className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Visibility level</span>
              <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10">
                <option>Members only</option>
                <option>Leaders only</option>
                <option>Hidden</option>
              </select>
            </label>
            <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              {['Show email', 'Show phone', 'Show city', 'Show photo'].map((option) => (
                <label key={option} className="flex items-center gap-2">
                  <input
                    defaultChecked
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setMemberStepComplete('privacy', true);
              setPrivacySaved(true);
            }}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Save privacy and notifications
          </button>
          {privacySaved ? <p className="text-sm text-emerald-700">Saved. Privacy step completed.</p> : null}
        </div>
      </MemberSectionCard>

      <MemberSectionCard
        id="notifications"
        title="Notification channels"
        description="Set your preferred communication channels for events and care updates."
      >
        <div className="grid gap-2 md:max-w-md">
          {(Object.entries(notifications) as Array<[keyof typeof notifications, boolean]>).map(
            ([channel, enabled]) => (
              <label
                key={channel}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="font-medium capitalize text-slate-700">{channel}</span>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() =>
                    setNotifications((current) => ({ ...current, [channel]: !current[channel] }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
              </label>
            )
          )}
        </div>
      </MemberSectionCard>
    </MemberPortalShell>
  );
}
