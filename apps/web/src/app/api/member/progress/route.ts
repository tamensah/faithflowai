import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

type MemberProgress = {
  identity: boolean;
  privacy: boolean;
  events: boolean;
  volunteer: boolean;
};

const DEFAULT_PROGRESS: MemberProgress = {
  identity: false,
  privacy: false,
  events: false,
  volunteer: false,
};

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

function isProgressPayload(value: unknown): value is MemberProgress {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return ['identity', 'privacy', 'events', 'volunteer'].every(
    (key) => typeof candidate[key] === 'boolean'
  );
}

async function getClerkServerClient() {
  return typeof clerkClient === 'function' ? await clerkClient() : clerkClient;
}

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ progress: DEFAULT_PROGRESS }, { status: 401 });
  }

  const client = await getClerkServerClient();
  const user = await client.users.getUser(userId);
  const progress = normalizeProgress(user.publicMetadata?.memberProgress);

  return NextResponse.json({ progress });
}

export async function PUT(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const candidate = (body as { progress?: unknown }).progress;
  if (!isProgressPayload(candidate)) {
    return NextResponse.json(
      { error: 'Progress payload must include boolean keys for all steps.' },
      { status: 400 }
    );
  }

  const progress = normalizeProgress(candidate);
  const client = await getClerkServerClient();
  const user = await client.users.getUser(userId);
  const publicMetadata = (user.publicMetadata ?? {}) as Record<string, unknown>;

  await client.users.updateUserMetadata(userId, {
    publicMetadata: { ...publicMetadata, memberProgress: progress },
  });

  return NextResponse.json({ progress });
}
