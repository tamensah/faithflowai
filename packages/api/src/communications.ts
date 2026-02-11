import {
  CommunicationChannel,
  CommunicationProvider,
  CommunicationScheduleStatus,
  CommunicationStatus,
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

  let sent = 0;
  let failed = 0;

  for (const schedule of due) {
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
