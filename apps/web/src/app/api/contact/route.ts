import { Resend } from 'resend';

type ContactPayload = {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  organization?: unknown;
  phone?: unknown;
  // Honeypot field: bots tend to fill this.
  website?: unknown;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function safeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as ContactPayload;
    const website = safeString(payload.website);
    if (website) {
      // Pretend success to reduce bot feedback loops.
      return Response.json({ ok: true });
    }

    const name = safeString(payload.name);
    const email = safeString(payload.email);
    const message = safeString(payload.message);
    const organization = safeString(payload.organization);
    const phone = safeString(payload.phone);

    const errors: string[] = [];
    if (!name) errors.push('Name is required.');
    if (!email) errors.push('Email is required.');
    if (email && !isValidEmail(email)) errors.push('Email looks invalid.');
    if (!message) errors.push('Message is required.');
    if (message.length > 4000) errors.push('Message is too long.');

    if (errors.length) {
      return Response.json({ ok: false, errors }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    const to = process.env.CONTACT_TO_EMAIL;
    if (!apiKey || !from || !to) {
      return Response.json({ ok: false, errors: ['Contact email is not configured.'] }, { status: 503 });
    }

    const resend = new Resend(apiKey);
    const subject = `FaithFlow AI inquiry: ${name}`;

    const bodyLines = [
      `Name: ${name}`,
      `Email: ${email}`,
      organization ? `Organization: ${organization}` : null,
      phone ? `Phone: ${phone}` : null,
      '',
      'Message:',
      message,
    ].filter(Boolean) as string[];

    await resend.emails.send({
      from,
      to,
      subject,
      replyTo: email,
      text: bodyLines.join('\n'),
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, errors: ['Unexpected error.'] }, { status: 500 });
  }
}

