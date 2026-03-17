# FaithFlow AI — Live Streaming Manual

This manual covers everything an admin or media team member needs to manage live streams, moderation, recording, and provider sync through the FaithFlow Streaming console.

---

## Overview

FaithFlow's live streaming module lets church and campus teams broadcast services, events, and programs through major video providers while logging all operational activity for accountability. The module is available on plans that include the `STREAMING_SUITE` add-on.

Key concepts:

| Concept | What it is |
|---------|-----------|
| **Channel** | A persistent connection to a provider (YouTube, Facebook, Vimeo, or custom RTMP). Holds credentials and URLs. |
| **Session** | A single broadcast tied to a channel. Has a lifecycle: SCHEDULED → LIVE → ENDED. |
| **Provider sync** | Automated health probe that reconciles session status against the actual provider signal every 10 minutes. |
| **Moderation level** | A per-session policy that signals your team's approach: OPEN, FILTERED, or STRICT. |
| **Moderation action** | A logged intervention (warn, mute, remove, ban) recorded for accountability and review. |

---

## Setup

### 1. Enable the add-on

The streaming module is entitlement-gated. A platform admin must activate the `STREAMING_SUITE` add-on for your tenant under **Admin → Add-ons** before the streaming console becomes accessible.

### 2. Configure provider credentials

Go to **Admin → Streaming** and expand the **Channels** section.

Provider API credentials are set at the environment level (see [THIRDPARTY_CONFIG.md](THIRDPARTY_CONFIG.md) §12). When credentials are present, the provider sync uses real API data. When absent, it falls back to HTTP HEAD probing of the channel's playback URL.

| Provider | Credential env var | What it unlocks |
|----------|--------------------|-----------------|
| YouTube | `YOUTUBE_API_KEY` | Live viewer count, `lifeCycleStatus` signal |
| Facebook | `FACEBOOK_PAGE_ACCESS_TOKEN` | `live_views`, authoritative stream status |
| Vimeo | `VIMEO_ACCESS_TOKEN` | Stream status, automatic recording URL ingestion |
| Custom RTMP | _(none)_ | URL probe only |

### 3. Create a channel

Navigate to **Admin → Streaming → Create channel**.

| Field | Required | Notes |
|-------|----------|-------|
| Name | Yes | Internal label, e.g. "Sunday Main Auditorium" |
| Provider | Yes | YOUTUBE, FACEBOOK, VIMEO, or CUSTOM_RTMP |
| External ID | Recommended | Broadcast ID / Live Video ID / Live Event ID from the provider — required for API-level sync |
| Playback URL | Recommended | Public HLS/DASH URL; used for HTTP probe fallback and viewer embed links |
| Ingest URL | Optional | RTMP ingest endpoint; stored for reference by your encoder operator |

**Where to find the External ID:**
- **YouTube**: YouTube Studio → Go Live → Stream → Broadcast ID (in the URL: `youtube.com/live_streaming_analytics?v=<ID>`)
- **Facebook**: Facebook Live Producer → Live video ID in the browser URL after creation
- **Vimeo**: Vimeo dashboard → Live events → Event settings → Event ID

Channels can be edited after creation — click **Edit** on any channel in the Channels list to update URLs or the External ID.

---

## Scheduling and running a session

### Create a session

Go to **Schedule session** and fill in:

| Field | Notes |
|-------|-------|
| Channel | Select the channel this session will broadcast through |
| Title | Shown in audit logs and analytics |
| Start time | Optional — used by provider sync to suggest SCHEDULED→LIVE transition after this time |
| Moderation level | OPEN / FILTERED / STRICT (can be changed while live) |
| Record this session | Check to flag that a recording URL should be available after the session ends |

Sessions start in **SCHEDULED** status.

### Going live

Click **Go live** on a session card to manually promote it to **LIVE**. This records a `streaming.session.started` audit log entry.

Alternatively, if provider sync is configured, it will automatically suggest and apply the SCHEDULED→LIVE transition when the provider confirms the stream is broadcasting (requires `applySuggestedTransitions` to be enabled).

### Ending a session

Click **End stream** to move the session to **ENDED** and record the end time. You may also provide:
- `peakViewers` — final peak concurrent viewer count
- `totalViews` — cumulative view count
- `recordingUrl` — provider-hosted recording link

For Vimeo, the recording URL is automatically ingested by provider sync once the archive is available.

---

## Provider sync

Provider sync runs every 10 minutes via cron. It checks the health of all SCHEDULED, LIVE, and ENDED sessions and can automatically apply state transitions.

### What it checks

For each session:
1. **Provider API** (when credentials configured): queries the provider for authoritative stream status and viewer count
2. **URL probe** (fallback): HTTP HEAD request to the channel's playback URL
3. **Recording URL** (Vimeo only): fetches `record.url` once the event is archived

### Suggested transitions

| Trigger | Transition |
|---------|-----------|
| Provider confirms LIVE (or URL probe reachable after scheduled start) | SCHEDULED → LIVE |
| Provider confirms ENDED (VOD / complete / archived) | LIVE → ENDED |
| Vimeo session archived | Recording URL auto-ingested |

### Manual sync

Use **Admin → Streaming → Provider sync** to:
- **Preview sync** (dry-run): see what actions would be taken without applying them
- **Run provider sync**: apply suggested transitions immediately

The preview shows each session's current status, provider-confirmed status, live viewer count, and recommended action.

To disable automatic transitions on the cron, set `applySuggestedTransitions: false` in the cron body in `render.yaml`.

### Health signals

The sync records a `tenantHealthCheck` entry for every session with:
- `playbackReachable` and HTTP status code
- `providerStatus` (raw string from the provider API)
- `liveViewers` count
- `suggestedTransition` outcome

These appear in **Admin → Operations → Health** for ops visibility.

---

## Moderation

### Moderation levels

Moderation level is a signal to your moderation team — it does not automatically filter content but sets expectations and is logged.

| Level | Intended use |
|-------|-------------|
| **OPEN** | No active moderation; comments enabled freely |
| **FILTERED** | Default — team monitors and removes problematic content |
| **STRICT** | High-profile event; all interactions reviewed before appearing |

Change the level mid-session using the moderation dropdown on a session card and clicking **Save moderation**.

### Recording moderation actions

Use **Admin → Streaming → Moderation controls** to log actions taken during a stream:

| Action | When to use |
|--------|------------|
| WARN | Issue a warning to a participant |
| MUTE_PARTICIPANT | Silence a participant for a duration |
| REMOVE_PARTICIPANT | Remove a participant from the stream |
| DELETE_MESSAGE | Remove a specific chat message |
| BAN_PARTICIPANT | Permanently ban a participant |

Provide a reason (required) and optionally the participant reference (e.g. user ID or username), message reference, and duration in minutes.

Every action is stored as an audit log entry (`streaming.moderation.<action_type>`).

### Moderation timeline

Select a session to view its full moderation history — who took what action, when, and why. Useful for incident review and compliance.

---

## Analytics

The analytics tile (90-day rolling window by default) shows:

| Metric | What it means |
|--------|--------------|
| Sessions | Total session count created |
| Live now | Sessions currently in LIVE status |
| Peak viewers (sum) | Sum of peak viewer counts across all sessions |
| Total views | Sum of total view counts across all sessions |

Filter by church using the scope selector to see campus-specific metrics.

---

## Audit trail

Every streaming action generates an audit log entry visible in **Admin → Audit**:

| Action | Trigger |
|--------|---------|
| `streaming.channel.created` | Channel created |
| `streaming.channel.updated` | Channel URLs or active status changed |
| `streaming.session.created` | Session scheduled |
| `streaming.session.started` | Session manually or automatically promoted to LIVE |
| `streaming.session.ended` | Session manually ended |
| `streaming.session.synced_live` | Provider sync promoted SCHEDULED → LIVE automatically |
| `streaming.session.synced_ended` | Provider sync promoted LIVE → ENDED automatically |
| `streaming.session.recording_ingested` | Recording URL auto-populated from Vimeo |
| `streaming.session.moderation_level_updated` | Moderation level changed mid-session |
| `streaming.moderation.*` | Moderation action recorded (5 action types) |
| `streaming.provider_sync.ran` | Manual provider sync triggered from admin |

---

## Troubleshooting

### Session stuck in SCHEDULED after stream started

1. Check that the channel's **External ID** is set correctly (provider API won't return data without it).
2. Verify the provider credential env var is configured (`YOUTUBE_API_KEY`, `FACEBOOK_PAGE_ACCESS_TOKEN`, or `VIMEO_ACCESS_TOKEN`).
3. Use **Preview sync** to inspect what signal the system is receiving.
4. If provider API is unavailable, ensure the **Playback URL** is reachable — this is the fallback signal.
5. Use **Go live** button to promote manually.

### Recording URL missing after session ended

- For Vimeo: wait for the Vimeo event to reach `archived` status, then run a manual **Provider sync**.
- For YouTube / Facebook: recording URLs are not available via their APIs — enter the URL manually in the **End stream** dialog.

### Provider sync shows "Playback endpoint is unreachable"

- Confirm the stream is actually live on the provider dashboard.
- Check that the playback URL is a public HLS/DASH stream (not behind auth).
- Verify no firewall or CDN rule is blocking HEAD requests from the API server.

### "Streaming is locked" on the console

The `STREAMING_SUITE` add-on is not enabled for your tenant. Contact your platform administrator to enable it under **Admin → Add-ons**.

---

## Reference

- Provider setup: [THIRDPARTY_CONFIG.md §12](THIRDPARTY_CONFIG.md)
- Cron schedule: `render.yaml` → `faithflow-streaming-provider-sync` (every 10 minutes)
- Task endpoint: `POST /tasks/streaming/provider-sync` (requires `INTEGRATION_API_KEY`)
- Internal scheduler env: `CRON_STREAMING_PROVIDER_SYNC` (default `*/10 * * * *`)
