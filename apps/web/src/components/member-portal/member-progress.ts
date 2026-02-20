'use client';

import { useEffect, useMemo, useState } from 'react';

export type MemberStepKey = 'identity' | 'privacy' | 'events' | 'volunteer';

type MemberProgress = Record<MemberStepKey, boolean>;

const MEMBER_PROGRESS_STORAGE_KEY = 'faithflow.member.progress.v1';
const MEMBER_PROGRESS_EVENT = 'faithflow:member-progress-updated';

const DEFAULT_PROGRESS: MemberProgress = {
  identity: false,
  privacy: false,
  events: false,
  volunteer: false,
};

let cachedProgress: MemberProgress = DEFAULT_PROGRESS;

function isBrowser() {
  return typeof window !== 'undefined';
}

function normalizeProgress(value: unknown): MemberProgress {
  if (!value || typeof value !== 'object') return DEFAULT_PROGRESS;
  const candidate = value as Partial<MemberProgress>;
  return {
    identity: Boolean(candidate.identity),
    privacy: Boolean(candidate.privacy),
    events: Boolean(candidate.events),
    volunteer: Boolean(candidate.volunteer),
  };
}

function readMemberProgress(): MemberProgress {
  if (!isBrowser()) return DEFAULT_PROGRESS;
  try {
    const raw = window.localStorage.getItem(MEMBER_PROGRESS_STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    return normalizeProgress(JSON.parse(raw));
  } catch {
    return DEFAULT_PROGRESS;
  }
}

function writeMemberProgress(progress: MemberProgress) {
  cachedProgress = progress;
  if (!isBrowser()) return;
  window.localStorage.setItem(MEMBER_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  window.dispatchEvent(new CustomEvent(MEMBER_PROGRESS_EVENT, { detail: progress }));
}

async function fetchProgressFromBackend() {
  const response = await fetch('/api/member/progress', { method: 'GET', cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to fetch member progress');
  }
  const payload = (await response.json()) as { progress?: unknown };
  return normalizeProgress(payload.progress);
}

async function syncProgressToBackend(progress: MemberProgress) {
  const response = await fetch('/api/member/progress', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ progress }),
  });
  if (!response.ok) {
    throw new Error('Failed to persist member progress');
  }
}

export async function setMemberStepComplete(step: MemberStepKey, completed: boolean) {
  const progress = cachedProgress ?? readMemberProgress();
  const next = { ...progress, [step]: completed };
  writeMemberProgress(next);

  try {
    await syncProgressToBackend(next);
  } catch {
    // Keep local optimistic state; hook will reconcile on next backend read.
  }
}

export function useMemberProgress() {
  const [progress, setProgress] = useState<MemberProgress>(DEFAULT_PROGRESS);

  useEffect(() => {
    const local = readMemberProgress();
    cachedProgress = local;
    setProgress(local);

    fetchProgressFromBackend()
      .then((serverProgress) => {
        writeMemberProgress(serverProgress);
        setProgress(serverProgress);
      })
      .catch(() => {
        // Anonymous/local sessions keep local fallback until authenticated backend sync is available.
      });

    const handleStorage = (event: StorageEvent) => {
      if (event.key === MEMBER_PROGRESS_STORAGE_KEY) {
        const next = readMemberProgress();
        cachedProgress = next;
        setProgress(next);
      }
    };

    const handleProgressUpdated = () => {
      const next = readMemberProgress();
      cachedProgress = next;
      setProgress(next);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(MEMBER_PROGRESS_EVENT, handleProgressUpdated as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(MEMBER_PROGRESS_EVENT, handleProgressUpdated as EventListener);
    };
  }, []);

  const summary = useMemo(() => {
    const values = Object.values(progress);
    const totalCount = values.length;
    const completedCount = values.filter(Boolean).length;
    const completionPercent = Math.round((completedCount / totalCount) * 100);
    return { totalCount, completedCount, completionPercent };
  }, [progress]);

  return { progress, ...summary };
}
