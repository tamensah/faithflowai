import { Resend } from 'resend';

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL ?? 'FaithFlow AI <receipts@faithflow.ai>';
  await resend.emails.send({
    from,
    to,
    subject,
    html,
  });
}
