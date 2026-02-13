function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

type EmailCta = { label: string; href: string };

export function renderBaseEmail(input: {
  title: string;
  greeting?: string;
  intro?: string;
  bullets?: string[];
  cta?: EmailCta;
  outro?: string;
  footer?: string;
}) {
  const title = escapeHtml(input.title);
  const greeting = input.greeting ? `<p style="margin:0 0 12px 0;">${escapeHtml(input.greeting)}</p>` : '';
  const intro = input.intro ? `<p style="margin:0 0 12px 0;">${escapeHtml(input.intro)}</p>` : '';
  const bullets = input.bullets?.length
    ? `<ul style="margin:0 0 16px 18px; padding:0;">${input.bullets
        .map((b) => `<li style="margin:0 0 6px 0;">${escapeHtml(b)}</li>`)
        .join('')}</ul>`
    : '';
  const cta = input.cta
    ? `<p style="margin:18px 0 0 0;"><a href="${escapeHtml(
        input.cta.href
      )}" style="display:inline-block; background:#0f172a; color:#ffffff; text-decoration:none; padding:10px 14px; border-radius:10px; font-weight:600;">${escapeHtml(
        input.cta.label
      )}</a></p>`
    : '';
  const outro = input.outro ? `<p style="margin:18px 0 0 0;">${escapeHtml(input.outro)}</p>` : '';
  const footer = escapeHtml(input.footer ?? 'FaithFlow AI');

  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${title}</title>`,
    '</head>',
    '<body style="margin:0; padding:0; background:#f8fafc; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">',
    '<div style="padding:24px;">',
    '<div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden;">',
    '<div style="padding:18px 22px; background:linear-gradient(90deg, rgba(16,185,129,0.10), rgba(14,116,144,0.10)); border-bottom:1px solid #e2e8f0;">',
    '<div style="font-weight:800; letter-spacing:0.4px; color:#0f172a;">FaithFlow AI</div>',
    '</div>',
    '<div style="padding:22px;">',
    `<h1 style="margin:0 0 12px 0; font-size:18px; line-height:1.3; color:#0f172a;">${title}</h1>`,
    '<div style="font-size:14px; line-height:1.55; color:#334155;">',
    greeting,
    intro,
    bullets,
    cta,
    outro,
    '</div>',
    '<div style="margin-top:20px; padding-top:14px; border-top:1px solid #e2e8f0; font-size:12px; color:#64748b;">',
    `${footer}`,
    '</div>',
    '</div>',
    '</div>',
    '</div>',
    '</body>',
    '</html>',
  ].join('');
}

export function renderTrialEndingEmail(input: { trialEndsAtIso: string; billingUrl: string }) {
  return renderBaseEmail({
    title: 'Your FaithFlow trial is ending soon',
    greeting: 'Hello,',
    intro: `Your trial ends on ${input.trialEndsAtIso.slice(0, 10)}. To avoid any interruption, choose a plan and complete billing setup.`,
    bullets: ['Pick a tier that matches your church size', 'Complete checkout (Stripe or Paystack)', 'Return to admin to continue setup'],
    cta: { label: 'Manage billing', href: input.billingUrl },
    outro: 'If you have already completed billing, you can ignore this notice.',
    footer: 'FaithFlow Billing Operations',
  });
}

export function renderPastDueEmail(input: { planName: string; periodEndIso?: string | null; billingUrl: string }) {
  return renderBaseEmail({
    title: 'Action required: subscription payment issue',
    greeting: 'Hello,',
    intro: `Your FaithFlow ${input.planName} subscription is currently past due${
      input.periodEndIso ? ` as of ${input.periodEndIso.slice(0, 10)}` : ''
    }. Please update billing to avoid service suspension.`,
    bullets: ['Update payment method (Stripe portal)', 'Retry checkout (Paystack)', 'Confirm invoices are paid'],
    cta: { label: 'Open billing', href: input.billingUrl },
    outro: 'If payment has already been completed, you can ignore this notice.',
    footer: 'FaithFlow Billing Operations',
  });
}

export function renderWelcomeOrgEmail(input: { churchName: string; adminUrl: string }) {
  return renderBaseEmail({
    title: `Welcome to FaithFlow AI`,
    greeting: 'Hello,',
    intro: `Your church workspace (${input.churchName}) is ready. Next, complete onboarding and invite your staff.`,
    bullets: ['Finish church setup (profile, campuses, giving funds)', 'Invite staff admins and team members', 'Import members and donations'],
    cta: { label: 'Open admin', href: input.adminUrl },
    outro: 'Reply to this email if you want help migrating your data or configuring payments.',
    footer: 'FaithFlow Onboarding',
  });
}

export function renderMemberVerificationEmail(input: { firstName: string; churchName: string; verifyUrl: string }) {
  return renderBaseEmail({
    title: 'Verify your membership',
    greeting: `Hello ${input.firstName},`,
    intro: `Please verify your membership registration for ${input.churchName}.`,
    cta: { label: 'Verify membership', href: input.verifyUrl },
    outro: 'If you did not request this, you can ignore this email.',
    footer: 'FaithFlow Membership',
  });
}

export function renderTithingStatementEmail(input: {
  churchName: string;
  year: number;
  totals: Record<string, number>;
  adminUrl?: string;
}) {
  const totalsList = Object.entries(input.totals)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([currency, amount]) => `${currency} ${amount.toFixed(2)}`);

  return renderBaseEmail({
    title: `Tithing statement (${input.year})`,
    greeting: 'Hello,',
    intro: `Here is your giving statement for ${input.churchName} for ${input.year}.`,
    bullets: totalsList.length ? totalsList : ['No completed gifts recorded for this period.'],
    cta: input.adminUrl ? { label: 'Open giving history', href: input.adminUrl } : undefined,
    outro: 'If you believe this is incorrect, reply to this email and a staff member will review it.',
    footer: 'FaithFlow Finance',
  });
}
