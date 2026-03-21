import Link from 'next/link';

const footerNav = [
  {
    heading: 'Product',
    links: [
      { href: '/', label: 'Overview' },
      { href: '/features', label: 'Features' },
      { href: '/plans', label: 'Pricing' },
      { href: '/guide', label: 'Admin guide' },
      { href: '/about', label: 'About' },
    ],
  },
  {
    heading: 'Access',
    links: [
      { href: '/sign-in', label: 'Sign in' },
      { href: '/sign-up', label: 'Create account' },
      { href: '/get-started', label: 'Church onboarding' },
      { href: '/portal', label: 'Member portal' },
    ],
  },
  {
    heading: 'Modules',
    links: [
      { href: '/features#finance', label: 'Finance & giving' },
      { href: '/features#membership', label: 'Membership' },
      { href: '/features#events', label: 'Events & check-in' },
      { href: '/features#communications', label: 'Communications' },
      { href: '/features#volunteer', label: 'Volunteer' },
      { href: '/features#support-center', label: 'Support center' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About FaithFlow AI' },
      { href: '/contact', label: 'Contact us' },
      { href: '/guide', label: 'Documentation' },
    ],
  },
];

const trustItems = [
  'Stripe PCI-compliant payments',
  'Paystack for African currencies',
  'Row-level tenant isolation',
  'Clerk identity & SSO',
  'GDPR-aware data handling',
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-white">
      {/* Main footer */}
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1.6fr_repeat(4,_1fr)]">
          {/* Brand column */}
          <div className="space-y-5">
            <div>
              <p className="text-base font-semibold text-foreground">FaithFlow AI</p>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
                A complete operating system for the modern church — finance, membership,
                events, communications, and AI insights in one unified platform.
              </p>
            </div>

            {/* Trust signals */}
            <div className="space-y-1.5">
              {trustItems.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-secondary" />
                  <p className="text-xs text-muted">{item}</p>
                </div>
              ))}
            </div>

            {/* Payment badges */}
            <div className="flex flex-wrap gap-2">
              {['Stripe', 'Paystack'].map((p) => (
                <span
                  key={p}
                  className="rounded-md border border-border bg-muted/5 px-2.5 py-1 text-xs font-medium text-muted"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>

          {/* Nav columns */}
          {footerNav.map((col) => (
            <div key={col.heading}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                {col.heading}
              </p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-sm text-muted transition-colors hover:text-foreground"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Legal bar */}
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <p className="text-xs text-muted">
            © {year} FaithFlow AI. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-4 text-xs text-muted">
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacy policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Terms of service
            </Link>
            <Link href="/contact" className="transition-colors hover:text-foreground">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
