import {
  CommunicationChannel,
  CommunicationProvider,
  CommunicationScheduleStatus,
  CommunicationStatus,
  NotificationChannel,
  prisma,
} from '@faithflow-ai/database';
import { sendEmail } from './email';

type SendParams = {
  channel: CommunicationChannel;
  to: string;
  subject?: string;
  body: string;
};

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const smsFrom = process.env.TWILIO_SMS_NUMBER;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_NUMBER;

  if (!accountSid || !authToken) {
    throw new Error('Twilio is not configured');
  }

  return { accountSid, authToken, smsFrom, whatsappFrom };
}

function asWhatsappNumber(value: string) {
  return value.startsWith('whatsapp:') ? value : `whatsapp:${value}`;
}

function channelToPreference(channel: CommunicationChannel) {
  if (channel === CommunicationChannel.EMAIL) return NotificationChannel.EMAIL;
  if (channel === CommunicationChannel.SMS) return NotificationChannel.SMS;
  return NotificationChannel.WHATSAPP;
}

function readScheduleMemberId(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, unknown>).memberId;
  return typeof raw === 'string' && raw ? raw : null;
}

function readEnvInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function quietHoursEnabled() {
  // Default to enabled for SMS/WhatsApp; can be disabled explicitly via env.
  return process.env.COMMS_QUIET_HOURS_ENABLED === 'false' ? false : true;
}

function getLocalHour(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone }).formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const value = hour ? Number(hour) : NaN;
  return Number.isFinite(value) ? value : null;
}

function isQuietHour(hour: number, startHour: number, endHour: number) {
  // If start=21, end=7 -> quiet hours wrap overnight.
  if (startHour === endHour) return false;
  if (startHour < endHour) {
    return hour >= startHour && hour < endHour;
  }
  return hour >= startHour || hour < endHour;
}

async function rescheduleIfQuietHours({
  scheduleId,
  channel,
  churchTimeZone,
}: {
  scheduleId: string;
  channel: CommunicationChannel;
  churchTimeZone: string;
}) {
  if (channel === CommunicationChannel.EMAIL) return false;
  if (!quietHoursEnabled()) return false;

  const quietStart = readEnvInt('COMMS_QUIET_START_HOUR', 21);
  const quietEnd = readEnvInt('COMMS_QUIET_END_HOUR', 7);
  const incrementMinutes = readEnvInt('COMMS_QUIET_RESCHEDULE_INCREMENT_MINUTES', 30);

  const now = new Date();
  const localHour = getLocalHour(now, churchTimeZone);
  if (localHour === null) return false;
  if (!isQuietHour(localHour, quietStart, quietEnd)) return false;

  // Find the next non-quiet window by stepping forward in small increments.
  let candidate = now;
  for (let steps = 0; steps < 48; steps += 1) {
    const hour = getLocalHour(candidate, churchTimeZone);
    if (hour !== null && !isQuietHour(hour, quietStart, quietEnd)) {
      await prisma.communicationSchedule.update({
        where: { id: scheduleId },
        data: { sendAt: candidate },
      });
      return true;
    }
    candidate = new Date(candidate.getTime() + incrementMinutes * 60 * 1000);
  }

  return false;
}

async function sendTwilioMessage({
  to,
  body,
  from,
  accountSid,
  authToken,
}: {
  to: string;
  body: string;
  from: string;
  accountSid: string;
  authToken: string;
}) {
  const payload = new URLSearchParams({ To: to, From: from, Body: body });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Twilio error: ${text}`);
  }

  const json = (await response.json()) as { sid?: string };
  return json.sid ?? null;
}

export async function sendCommunication({ channel, to, subject, body }: SendParams) {
  if (channel === CommunicationChannel.EMAIL) {
    await sendEmail({ to, subject: subject ?? 'FaithFlow AI', html: body });
    return { provider: CommunicationProvider.RESEND, providerRef: null };
  }

  const { accountSid, authToken, smsFrom, whatsappFrom } = getTwilioConfig();

  if (channel === CommunicationChannel.SMS) {
    if (!smsFrom) {
      throw new Error('TWILIO_SMS_NUMBER is not configured');
    }
    const sid = await sendTwilioMessage({ to, body, from: smsFrom, accountSid, authToken });
    return { provider: CommunicationProvider.TWILIO, providerRef: sid };
  }

  if (!whatsappFrom) {
    throw new Error('TWILIO_WHATSAPP_NUMBER is not configured');
  }
  const sid = await sendTwilioMessage({
    to: asWhatsappNumber(to),
    body,
    from: asWhatsappNumber(whatsappFrom),
    accountSid,
    authToken,
  });
  return { provider: CommunicationProvider.TWILIO, providerRef: sid };
}

export async function dispatchScheduledCommunications(limit = 50) {
  const due = await prisma.communicationSchedule.findMany({
    where: {
      status: CommunicationScheduleStatus.QUEUED,
      sendAt: { lte: new Date() },
    },
    orderBy: { sendAt: 'asc' },
    take: limit,
  });

  const churchIds = Array.from(new Set(due.map((schedule) => schedule.churchId)));
  const churches = churchIds.length
    ? await prisma.church.findMany({
        where: { id: { in: churchIds } },
        select: { id: true, timezone: true },
      })
    : [];
  const timezoneByChurchId = new Map(churches.map((church) => [church.id, church.timezone || 'UTC']));

  const memberPrefRequests = due
    .map((schedule) => {
      const memberId = readScheduleMemberId(schedule.metadata);
      if (!memberId) return null;
      return { memberId, channel: channelToPreference(schedule.channel) };
    })
    .filter(Boolean) as Array<{ memberId: string; channel: NotificationChannel }>;

  const uniqueMemberIds = Array.from(new Set(memberPrefRequests.map((entry) => entry.memberId)));
  const uniqueChannels = Array.from(new Set(memberPrefRequests.map((entry) => entry.channel)));
  const preferences =
    uniqueMemberIds.length && uniqueChannels.length
      ? await prisma.notificationPreference.findMany({
          where: {
            memberId: { in: uniqueMemberIds },
            channel: { in: uniqueChannels },
          },
        })
      : [];
  const preferenceMap = new Map(preferences.map((pref) => [`${pref.memberId}:${pref.channel}`, pref.enabled]));

  let sent = 0;
  let failed = 0;

  for (const schedule of due) {
    const tz = timezoneByChurchId.get(schedule.churchId) ?? 'UTC';
    const rescheduled = await rescheduleIfQuietHours({
      scheduleId: schedule.id,
      channel: schedule.channel,
      churchTimeZone: tz,
    });
    if (rescheduled) continue;

    const memberId = readScheduleMemberId(schedule.metadata);
    if (memberId) {
      const key = `${memberId}:${channelToPreference(schedule.channel)}`;
      const enabled = preferenceMap.get(key);
      if (enabled === false) {
        await prisma.communicationSchedule.update({
          where: { id: schedule.id },
          data: {
            status: CommunicationScheduleStatus.CANCELED,
            error: 'Recipient opted out for this channel',
          },
        });
        continue;
      }
    }

    const message = await prisma.communicationMessage.create({
      data: {
        churchId: schedule.churchId,
        templateId: schedule.templateId,
        channel: schedule.channel,
        provider: schedule.provider,
        to: schedule.to,
        subject: schedule.subject,
        body: schedule.body,
        status: CommunicationStatus.QUEUED,
        metadata: schedule.metadata ?? undefined,
      },
    });

    try {
      const result = await sendCommunication({
        channel: schedule.channel,
        to: schedule.to,
        subject: schedule.subject ?? undefined,
        body: schedule.body,
      });

      await prisma.communicationMessage.update({
        where: { id: message.id },
        data: {
          status: CommunicationStatus.SENT,
          sentAt: new Date(),
          provider: result.provider,
          metadata: result.providerRef ? { providerRef: result.providerRef } : schedule.metadata ?? undefined,
        },
      });

      await prisma.communicationSchedule.update({
        where: { id: schedule.id },
        data: {
          status: CommunicationScheduleStatus.SENT,
          sentAt: new Date(),
        },
      });

      sent += 1;
    } catch (error) {
      await prisma.communicationMessage.update({
        where: { id: message.id },
        data: {
          status: CommunicationStatus.FAILED,
          error: error instanceof Error ? error.message : 'Send failed',
        },
      });

      await prisma.communicationSchedule.update({
        where: { id: schedule.id },
        data: {
          status: CommunicationScheduleStatus.FAILED,
          error: error instanceof Error ? error.message : 'Send failed',
        },
      });

      failed += 1;
    }
  }

  return { sent, failed, total: due.length };
}
